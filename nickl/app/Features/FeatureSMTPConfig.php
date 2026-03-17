<?php
namespace App\Features;
use Bandco\Core\WordplateInit;

class FeatureSMTPConfig extends WordplateInit
{
    public function hooks()
    {
        if (strpos($_SERVER['SERVER_NAME'], '.lan') !== false) {
            add_action('phpmailer_init', [$this, 'localMailtrap']);
        } else {
            // Sur OVH, il est CRITIQUE que le "Return-Path" (Envelope From) corresponde au "From" du header
            // sinon SPF échoue car c'est l'utilisateur linux (ex: client@ovh) qui est utilisé.
            add_action('phpmailer_init', [$this, 'fixOvhSender']);
        }

        add_filter('wp_mail_from', [$this, 'checkSender']);
    }

    public function getDomainName()
    {
        $url = home_url();
        $host = parse_url($url, PHP_URL_HOST);
        if (str_starts_with($host, 'www.')) {
            $host = substr($host, 4);
        }
        return $host;
    }

    public function checkSender($from)
    {
        $domain = $this->getDomainName();
        // Si l'email vient déjà du bon domaine, on ne touche à rien
        if (str_ends_with($from, '@' . $domain)) {
            return $from;
        }

        $new_from = 'noreply@' . $domain;
        error_log('[FeatureSMTPConfig] wp_mail_from filter: forcing ' . $new_from . ' (was ' . $from . ')');
        return $new_from;
    }

    /**
     * Correction spécifique pour OVH et le standard mail()
     * Force le "Envelope-From" (Sender) à être identique au "Header-From".
     */
    public function fixOvhSender($phpmailer)
    {
        if (!empty($phpmailer->From)) {
            $phpmailer->Sender = $phpmailer->From;
            // On s'assure que le Return-Path est aussi aligné si PHPMailer ne le fait pas auto
            // $phpmailer->addCustomHeader('Return-Path', $phpmailer->From); 
        }
    }

    // Ancienne config SMTP (gardée pour référence ou futur usage)
    public function customSmtp($phpmailer)
    {
        // ...
    }

    public function localMailtrap($phpmailer)
    {
        $phpmailer->isSMTP();
        $phpmailer->Host = '127.0.0.1';
        $phpmailer->Port = 1025;
        $phpmailer->SMTPAuth = false;
        error_log('[FeatureSMTPConfig] localMailtrap configured: 127.0.0.1:1025 for ' . $_SERVER['SERVER_NAME']);
    }
}