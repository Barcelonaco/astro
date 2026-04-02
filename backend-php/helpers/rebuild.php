<?php
/**
 * Frontend rebuild helper.
 * Triggers an Astro build in the background when content changes.
 * Debounced: skips if a build was requested less than 3 seconds ago.
 */

function trigger_frontend_rebuild(string $reason = ''): void {
    $lockFile = __DIR__ . '/../uploads/.rebuild.lock';
    $statusFile = __DIR__ . '/../uploads/.rebuild_status.json';
    $logFile = __DIR__ . '/../uploads/.rebuild.log';
    $frontendDir = realpath(__DIR__ . '/../../frontend');

    if (!$frontendDir) return;

    // Debounce: skip if a build was requested less than 3s ago
    if (file_exists($statusFile)) {
        $status = json_decode(file_get_contents($statusFile), true);
        if (isset($status['requested_at']) && (time() - $status['requested_at']) < 3) {
            return;
        }
    }

    // If a build is currently running, just mark that another one is needed
    if (file_exists($lockFile)) {
        @file_put_contents($statusFile, json_encode([
            'status' => 'queued',
            'reason' => $reason,
            'requested_at' => time(),
        ]));
        return;
    }

    // Write status
    @file_put_contents($statusFile, json_encode([
        'status' => 'building',
        'reason' => $reason,
        'requested_at' => time(),
    ]));

    // Also invalidate bootstrap cache
    @unlink(__DIR__ . '/../uploads/.bootstrap_cache.json');

    // Build script: lock → build → unlock → check if queued → rebuild again
    $scriptFile = __DIR__ . '/../scripts/rebuild.sh';
    if (!file_exists($scriptFile)) return;

    // Run build in background, detached from PHP process
    $cmd = sprintf(
        'bash %s > %s 2>&1 & echo $!',
        escapeshellarg($scriptFile),
        escapeshellarg($logFile)
    );
    exec($cmd, $output);
}

function get_rebuild_status(): array {
    $statusFile = __DIR__ . '/../uploads/.rebuild_status.json';
    $lockFile = __DIR__ . '/../uploads/.rebuild.lock';

    if (!file_exists($statusFile)) {
        return ['status' => 'idle'];
    }

    $status = json_decode(file_get_contents($statusFile), true) ?: ['status' => 'idle'];

    // If lock exists, build is running
    if (file_exists($lockFile)) {
        $status['status'] = 'building';
    }

    return $status;
}
