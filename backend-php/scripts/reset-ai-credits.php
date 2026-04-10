#!/usr/bin/env php
<?php
/**
 * Monthly AI Credit Reset
 * Cron: 0 0 1 * * php /path/to/backend-php/scripts/reset-ai-credits.php
 */

require_once __DIR__ . '/../vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->load();

require_once __DIR__ . '/../config/database.php';

$db = Database::getInstance();
$currentMonth = date('Y-m');

// Check if already reset this month
$stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'ai_last_reset_date'");
$stmt->execute();
$lastReset = $stmt->fetchColumn();

if ($lastReset && strpos($lastReset, $currentMonth) === 0) {
    echo "[{$currentMonth}] Already reset. Skipping.\n";
    exit(0);
}

// Get monthly credit amount
$stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'ai_monthly_credits'");
$stmt->execute();
$amount = (float) ($stmt->fetchColumn() ?: 0);

if ($amount <= 0) {
    echo "[{$currentMonth}] No monthly credits configured. Skipping.\n";
    exit(0);
}

// Insert monthly credit allocation
$stmt = $db->prepare("INSERT INTO ai_credits (credits, source, note) VALUES (?, 'monthly_reset', ?)");
$stmt->execute([$amount, "Allocation mensuelle {$currentMonth}"]);

// Update last reset date
$stmt = $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('ai_last_reset_date', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
$stmt->execute([date('Y-m-d')]);

echo "[{$currentMonth}] Added \${$amount} credits.\n";
