<?php
/**
 * Frontend rebuild helper.
 * Triggers an Astro build in the background when content changes.
 * Debounced: skips if a build was requested less than 3 seconds ago.
 */

/**
 * Trigger a frontend rebuild.
 *
 * @param string $reason   Description of why the rebuild was triggered
 * @param bool   $wait     If true, block until the build finishes (synchronous)
 */
function trigger_frontend_rebuild(string $reason = '', bool $wait = true): void {
    $lockFile = __DIR__ . '/../uploads/.rebuild.lock';
    $statusFile = __DIR__ . '/../uploads/.rebuild_status.json';
    $logFile = __DIR__ . '/../uploads/.rebuild.log';
    $frontendDir = realpath(__DIR__ . '/../../frontend');

    if (!$frontendDir) return;

    // Debounce: skip if a build was requested less than 3s ago
    if (file_exists($statusFile)) {
        $status = json_decode(file_get_contents($statusFile), true);
        if (isset($status['requested_at']) && (time() - $status['requested_at']) < 3) {
            // If waiting, still wait for the in-progress build to finish
            if ($wait) wait_for_rebuild($statusFile, $lockFile);
            return;
        }
    }

    // If a build is currently running, queue and optionally wait
    if (file_exists($lockFile)) {
        @file_put_contents($statusFile, json_encode([
            'status' => 'queued',
            'reason' => $reason,
            'requested_at' => time(),
        ]));
        if ($wait) wait_for_rebuild($statusFile, $lockFile);
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

    // Run build in background
    $cmd = sprintf(
        'bash %s > %s 2>&1 & echo $!',
        escapeshellarg($scriptFile),
        escapeshellarg($logFile)
    );
    exec($cmd, $output);

    // Wait for the build to complete before returning the response
    if ($wait) {
        // Small delay to let the script create the lock file
        usleep(200000); // 200ms
        wait_for_rebuild($statusFile, $lockFile);
    }
}

/**
 * Poll until the rebuild is finished (done or error). Max 120s timeout.
 */
function wait_for_rebuild(string $statusFile, string $lockFile, int $maxWait = 120): void {
    set_time_limit($maxWait + 10);
    $start = time();
    while ((time() - $start) < $maxWait) {
        // No lock file = build finished (or never started)
        if (!file_exists($lockFile)) {
            if (file_exists($statusFile)) {
                $status = json_decode(file_get_contents($statusFile), true);
                $s = $status['status'] ?? '';
                if ($s === 'done' || $s === 'error') return;
            } else {
                return;
            }
        }
        usleep(500000); // poll every 500ms
    }
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
