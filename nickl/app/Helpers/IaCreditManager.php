<?php

namespace App\Helpers;

/**
 * Gestionnaire de crédits API IA par utilisateur
 * Limite: 2$/mois par défaut avec possibilité d'ajouter du crédit
 * Pattern: Singleton pour éviter les instanciations multiples
 */
class IaCreditManager
{
    const DEFAULT_MONTHLY_LIMIT = 2.00; // $2 par mois
    const OPTION_PREFIX = 'ia_credit_';

    private static $instance = null;

    /**
     * Récupère l'instance unique (Singleton)
     * @return IaCreditManager
     */
    public static function getInstance()
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructeur privé pour empêcher l'instanciation directe
     */
    private function __construct()
    {
        add_action('admin_menu', [$this, 'addAdminMenu']);
        add_action('wp_ajax_ia_add_credit', [$this, 'ajaxAddCredit']);
        add_action('wp_ajax_ia_reset_monthly_credits', [$this, 'ajaxResetMonthlyCredits']);
        add_action('wp_ajax_ia_save_api_key', [$this, 'ajaxSaveApiKey']);
        add_action('wp_ajax_ia_migrate_old_stats', [$this, 'ajaxMigrateOldStats']);

        // Cron job pour réinitialiser les crédits mensuels
        add_action('ia_monthly_credit_reset', [$this, 'resetAllMonthlyCredits']);

        // Activer le cron si pas déjà fait
        if (!wp_next_scheduled('ia_monthly_credit_reset')) {
            wp_schedule_event(strtotime('first day of next month midnight'), 'monthly', 'ia_monthly_credit_reset');
        }
    }

    /**
     * Empêcher le clonage de l'instance
     */
    private function __clone()
    {
    }

    /**
     * Empêcher la désérialisation de l'instance
     */
    public function __wakeup()
    {
        throw new \Exception("Cannot unserialize singleton");
    }

    /**
     * Vérifie si le crédit GLOBAL est suffisant
     * @param float $estimatedCost Coût estimé de la requête
     * @return array
     */
    public function checkGlobalCredit($estimatedCost = 0)
    {
        $stats = $this->getGlobalStats();
        $remaining = $stats['remaining_credit'];

        if ($remaining <= 0) {
            return [
                'allowed' => false,
                'remaining' => 0,
                'message' => 'Crédit global du site épuisé. Contactez l\'administrateur.'
            ];
        }

        if ($estimatedCost > 0 && $remaining < $estimatedCost) {
            return [
                'allowed' => false,
                'remaining' => $remaining,
                'message' => sprintf('Crédit global insuffisant. Restant: $%.4f, Requis: $%.4f', $remaining, $estimatedCost)
            ];
        }

        return [
            'allowed' => true,
            'remaining' => $remaining,
            'message' => 'OK'
        ];
    }

    /**
     * Enregistre l'utilisation dans le pot commun
     */
    public function logUsage($userId, $cost, $inputTokens, $outputTokens)
    {
        $stats = $this->getGlobalStats();

        // Mise à jour globale
        $stats['used_credit'] += $cost;
        $stats['remaining_credit'] = max(0, $stats['total_credit'] - $stats['used_credit']);
        $stats['total_input'] += $inputTokens;
        $stats['total_output'] += $outputTokens;
        $stats['request_count']++;
        $stats['last_used'] = current_time('mysql');

        // Historique global (avec ID utilisateur)
        if (!isset($stats['history'])) {
            $stats['history'] = [];
        }
        $stats['history'][] = [
            'date' => current_time('mysql'),
            'user_id' => $userId,
            'input' => $inputTokens,
            'output' => $outputTokens,
            'cost' => $cost
        ];

        if (count($stats['history']) > 100) {
            array_shift($stats['history']);
        }

        // Mise à jour des stats individuelles (juste pour le tracking, pas de limite)
        $this->logUserUsage($userId, $cost, $inputTokens, $outputTokens);

        $this->saveGlobalStats($stats);
    }

    /**
     * Log l'utilisation spécifique d'un utilisateur (pour les stats admin)
     */
    private function logUserUsage($userId, $cost, $input, $output)
    {
        $userStats = get_option(self::OPTION_PREFIX . 'user_usage_' . $userId, [
            'total_cost' => 0,
            'request_count' => 0,
            'username' => get_userdata($userId)->display_name
        ]);

        $userStats['total_cost'] += $cost;
        $userStats['request_count']++;
        $userStats['last_used'] = current_time('mysql');

        update_option(self::OPTION_PREFIX . 'user_usage_' . $userId, $userStats);
    }

    /**
     * Ajoute du crédit au pot commun
     */
    public function addGlobalCredit($amount, $reason = 'Ajout manuel')
    {
        $stats = $this->getGlobalStats();
        $stats['total_credit'] += $amount;
        $stats['remaining_credit'] = max(0, $stats['total_credit'] - $stats['used_credit']);

        if (!isset($stats['credit_history'])) {
            $stats['credit_history'] = [];
        }
        $stats['credit_history'][] = [
            'date' => current_time('mysql'),
            'amount' => $amount,
            'reason' => $reason,
            'added_by' => get_current_user_id()
        ];

        $this->saveGlobalStats($stats);
        error_log("IaCreditManager: Added $amount to global credit. Reason: $reason");
    }

    /**
     * Réinitialise le crédit global du mois
     */
    public function resetMonthlyGlobalCredit()
    {
        $stats = $this->getGlobalStats();

        // Archivage
        $monthKey = date('Y-m', strtotime('-1 month'));
        $archive = get_option(self::OPTION_PREFIX . 'global_archive', []);
        $archive[$monthKey] = [
            'used_credit' => $stats['used_credit'],
            'total_input' => $stats['total_input'],
            'total_output' => $stats['total_output'],
            'request_count' => $stats['request_count']
        ];
        update_option(self::OPTION_PREFIX . 'global_archive', $archive);

        // Reset (On garde la structure mais on remet les compteurs à 0)
        $stats['total_credit'] = self::DEFAULT_MONTHLY_LIMIT;
        $stats['used_credit'] = 0;
        $stats['remaining_credit'] = self::DEFAULT_MONTHLY_LIMIT;
        $stats['total_input'] = 0;
        $stats['total_output'] = 0;
        $stats['request_count'] = 0;
        $stats['reset_date'] = current_time('mysql');
        //$stats['history'] = []; // On peut garder l'historique ou le vider

        // Reset aussi les compteurs individuels des utilisateurs
        $this->resetAllUserUsages();

        $this->saveGlobalStats($stats);
        error_log("IaCreditManager: Global monthly credit reset");
    }

    private function resetAllUserUsages()
    {
        global $wpdb;
        $options = $wpdb->get_results(
            "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE '" . self::OPTION_PREFIX . "user_usage_%'"
        );
        foreach ($options as $option) {
            delete_option($option->option_name);
        }
    }

    public function getGlobalStats()
    {
        $default = [
            'total_credit' => self::DEFAULT_MONTHLY_LIMIT,
            'used_credit' => 0,
            'remaining_credit' => self::DEFAULT_MONTHLY_LIMIT,
            'total_input' => 0,
            'total_output' => 0,
            'request_count' => 0,
            'reset_date' => current_time('mysql'),
            'history' => [],
            'credit_history' => []
        ];

        $stats = get_option(self::OPTION_PREFIX . 'global_stats', $default);
        return array_merge($default, $stats);
    }

    private function saveGlobalStats($stats)
    {
        update_option(self::OPTION_PREFIX . 'global_stats', $stats);
    }

    /**
     * Récupère la liste des utilisateurs ayant consommé du crédit
     */
    public function getUsersUsage()
    {
        global $wpdb;
        $users = [];
        $options = $wpdb->get_results(
            "SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE '" . self::OPTION_PREFIX . "user_usage_%'"
        );

        foreach ($options as $option) {
            if (preg_match('/user_usage_(\d+)$/', $option->option_name, $matches)) {
                $userId = (int) $matches[1];
                $data = unserialize($option->option_value);
                $users[$userId] = $data;
            }
        }
        return $users;
    }

    /**
     * Ajoute le menu admin
     */
    public function addAdminMenu()
    {
        add_submenu_page(
            'options-general.php',
            'Gestion Crédits IA',
            'Crédits IA',
            'manage_options',
            'ia-credit-manager',
            [$this, 'renderAdminPage']
        );
    }

    /**
     * Affiche la page admin
     */
    public function renderAdminPage()
    {
        if (!current_user_can('manage_options')) {
            wp_die('Non autorisé');
        }

        $globalStats = $this->getGlobalStats();
        $usersUsage = $this->getUsersUsage();

        echo \Roots\view('admin.ia-credit-manager', [
            'stats' => $globalStats,
            'users_usage' => $usersUsage,
            'default_limit' => self::DEFAULT_MONTHLY_LIMIT,
            'current_api_key' => $this->getApiKey()
        ]);
    }

    /**
     * AJAX: Ajouter du crédit
     */
    public function ajaxAddCredit()
    {
        if (!current_user_can('manage_options'))
            wp_send_json_error('Non autorisé');

        $amount = floatval($_POST['amount'] ?? 0);
        $reason = sanitize_text_field($_POST['reason'] ?? 'Ajout manuel');

        if ($amount <= 0)
            wp_send_json_error('Montant invalide');

        $this->addGlobalCredit($amount, $reason);

        wp_send_json_success([
            'message' => 'Crédit global ajouté avec succès',
            'stats' => $this->getGlobalStats()
        ]);
    }

    /**
     * AJAX: Réinitialiser les crédits mensuels
     */
    public function ajaxResetMonthlyCredits()
    {
        if (!current_user_can('manage_options'))
            wp_send_json_error('Non autorisé');
        $this->resetMonthlyGlobalCredit();
        wp_send_json_success('Crédit global réinitialisé');
    }

    /**
     * AJAX: Sauvegarder la clé API
     */
    public function ajaxSaveApiKey()
    {
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Non autorisé');
        }

        $apiKey = sanitize_text_field($_POST['api_key'] ?? '');
        dd($_POST['api_key'])

        if (empty($apiKey)) {
            delete_option('ia_api_key_manual');
            delete_option('ia_api_key');
            wp_send_json_success('Clé API supprimée');
            return;
        }

        // Sauvegarde dans une option WP standard
        update_option('ia_api_key_manual', $apiKey);

        wp_send_json_success('Clé API sauvegardée avec succès');
    }

    /**
     * Récupère la clé API (Priorité: Option Manuelle > ACF > False)
     * @return string|false
     */
    public function getApiKey()
    {
        // 1. Chercher dans nos réglages manuels
        $manualKey = get_option('ia_api_key_manual');
        if ($manualKey) {
            return $manualKey;
        }

        // 2. Chercher dans ACF (rétrocompatibilité)
        if (function_exists('get_field')) {
            $acfKey = get_field('ia_api_key', 'option');
            if ($acfKey) {
                return $acfKey;
            }
        }

        /* if(get_env('CLAUDE_API_KEY')) {
            return get_env('CLAUDE_API_KEY');
        } */

        return false;
    }

    /**
     * Migration : Importe old ia_usage_stats dans le pot commun
     */
    public function ajaxMigrateOldStats()
    {
        if (!current_user_can('manage_options'))
            wp_send_json_error('Non autorisé');

        $oldStats = get_option('ia_usage_stats');
        if (!$oldStats || empty($oldStats['total_cost'])) {
            wp_send_json_error('Aucune ancienne statistique trouvée.');
        }

        $globalStats = $this->getGlobalStats();

        // Ajouter l'ancien coût au pot commun
        $oldCost = (float) $oldStats['total_cost'];
        $globalStats['used_credit'] += $oldCost;
        $globalStats['total_input'] += (int) ($oldStats['total_input'] ?? 0);
        $globalStats['total_output'] += (int) ($oldStats['total_output'] ?? 0);
        $globalStats['request_count'] += count($oldStats['history'] ?? []);

        // Recalculer le restant
        $globalStats['remaining_credit'] = max(0, $globalStats['total_credit'] - $globalStats['used_credit']);

        $this->saveGlobalStats($globalStats);

        // Supprimer l'ancienne option
        delete_option('ia_usage_stats');

        wp_send_json_success(sprintf('Migration réussie. Coût ajouté au pot commun: $%.4f', $oldCost));
    }
}
