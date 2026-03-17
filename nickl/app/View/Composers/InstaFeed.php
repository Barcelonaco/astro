<?php

namespace App\View\Composers;

use Roots\Acorn\View\Composer;
use App\Helpers\GlobalHelper;
use GuzzleHttp\Client;

class InstaFeed extends Composer
{
    /**
     * @var mixed|null
     */
    private static mixed $accessToken;
    private $module;


    /**
     * Vues associées à ce Composer.
     */
    protected static $views = [
        'modules.insta-feed',
    ];


    /**
     * Données passées à la vue.
     */
    public function with()
    {
        // Récupération des données seulement ici
        $this->module = $this->view->getData()['module'] ?? [];

        return [
            'id_bloc' => $this->getId($this->module),
            'title_module' => $this->module['title'] ?? '',
            'classes' => $this->getClasses($this->module),
            'backgroundImage' => $this->getBackgroundImage($this->module),
            'title_bloc' => $module['title'] ?? '',
            'title_style' => $module['title_style'] ?? '',
            'title_align' => $module['title_align'] ?? '',
            'posts' => $this->getInstagramPosts(),
            'link' => $this->getCta(),
            'catchphrase' => $this->getCatchphrase(),
        ];
    }

    /**
     * Génère l'ID du bloc.
     */
    protected function getId($module)
    {
        $idBloc = $module['id_bloc'] ?? null;
        return $idBloc ? GlobalHelper::slugify($idBloc) : GlobalHelper::getAutoSectionId();
    }

    /**
     * Génère les classes CSS du module.
     */
    protected function getClasses($module)
    {
        return implode(' ', array_filter([
            'module',
            !empty($module['bg_img']) && !empty($module['bg_parallax']) ? 'parallax' : '',
            !empty($module['bg_img']) ? 'has-background-image' : '',
            $module['bloc_color'] ?? '',
            $module['padding_top'] ?? '',
            $module['padding_bottom'] ?? '',
        ]));
    }

    /**
     * Récupère l'image d'arrière-plan et son opacité.
     */
    protected function getBackgroundImage($module)
    {
        return !empty($module['bg_img']) ? [
            'url' => $module['bg_img']['sizes']['banner'],
            $module['bg_opacity'] !== '' ? $module['bg_opacity'] / 100 : 1,
        ] : null;
    }



    public function getInstagramPosts()
    {
        $client = new Client();
        $id_account = $this->getIdAccount();
        $token = $this->getLongLivedAccessToken();

        $response = $client->get("https://graph.facebook.com/v19.0/{$id_account}/media?fields=id,caption,media_type,media_url,timestamp,permalink&access_token={$token}");

        $posts = json_decode($response->getBody()->getContents(), true) ?? [];
        return $posts;
    }
    public function getLongLivedAccessToken()
    {
        // Chemin spécifique au site courant (multisite-friendly)
        $upload_dir = wp_upload_dir();
        $filePath = $upload_dir['basedir'] . '/instagram_token.json';

        $regenThreshold = 86400; // 24 heures en secondes

        // Vérifie si un jeton existe déjà
        if (file_exists($filePath)) {
            $tokenData = json_decode(file_get_contents($filePath), true);

            if (isset($tokenData['access_token'], $tokenData['expires_at'])) {
                // Si le jeton est encore valide pour plus de 24h, on le garde
                if (time() < $tokenData['expires_at'] - $regenThreshold) {
                    return $tokenData['access_token'];
                }
            }
        }

        // Sinon, on le régénère pour le site courant
        return $this->refreshAccessTokenForCurrentSite($filePath);
    }
    private function refreshAccessTokenForCurrentSite($filePath)
    {
        $client = new \GuzzleHttp\Client();

        $shortLivedToken = get_field('access_token_instagram', 'option') ?? null;
        $client_id       = get_field('id_application_instagram', 'option') ?? null;
        $secret_key      = get_field('secret_key_application_instagram', 'option') ?? null;

        if (!$shortLivedToken || !$client_id || !$secret_key) {
            error_log("[" . ($_SERVER['HTTP_HOST'] ?? 'CLI') . "] Paramètres manquants pour le token longue durée.");
            return null;
        }

        try {
            $url = sprintf(
                'https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=%s&client_secret=%s&fb_exchange_token=%s',
                urlencode($client_id),
                urlencode($secret_key),
                urlencode($shortLivedToken)
            );

            $response = $client->get($url);
            $data = json_decode($response->getBody()->getContents(), true);


            if (!isset($data['access_token'])) {
                error_log("[" . ($_SERVER['HTTP_HOST'] ?? 'CLI') . "] Erreur API : " . json_encode($data));
                return null;
            }

            $accessToken = $data['access_token'];
            $expiresIn = $data['expires_in'] ?? (60 * 24 * 60 * 60); // fallback 60 jours
            $expiresAt = time() + $expiresIn;

            file_put_contents($filePath, json_encode([
                'access_token' => $accessToken,
                'expires_at' => $expiresAt,
            ]));

            return $accessToken;

        } catch (\Exception $e) {
            error_log("[" . ($_SERVER['HTTP_HOST'] ?? 'CLI') . "] Erreur token longue durée : " . $e->getMessage());
            return null;
        }
    }
    protected function getIdAccount()
    {
        return $this->getIdInstaAccount();
    }
    protected function getIdInstaAccount(){
        $client = new \GuzzleHttp\Client();
        $accessToken = $this->getLongLivedAccessToken();
        // 1. Obtenir la page Facebook associée
        $response = $client->get("https://graph.facebook.com/me/accounts?access_token={$accessToken}");

        $pageId = json_decode($response->getBody(), true)['data'][0]['id'] ?? null;


        $response = $client->get("https://graph.facebook.com/{$pageId}?fields=instagram_business_account&access_token={$accessToken}");

        $igUserId = json_decode($response->getBody(), true)['instagram_business_account']['id'];

        return $igUserId;
    }
    protected function getCta()
    {
        return get_field('link_account_instagram', 'options') ?? '';
    }

    private function getCatchphrase()
    {
        return $this->module['catchphrase'] ?? '';
    }
    public static function getExpirationDate() {
        // Utilise le répertoire d’upload du site courant (compatible multisite)
        $upload_dir = wp_upload_dir();
        $filePath = $upload_dir['basedir'] . '/instagram_token.json';

        if (!file_exists($filePath)) {
            return "Aucun jeton d'accès trouvé.";
        }

        $tokenData = json_decode(file_get_contents($filePath), true);

        if (isset($tokenData['expires_at'])) {
            $expiresAt = $tokenData['expires_at']; // timestamp UNIX
            return "Le jeton expire le : " . date('d/m/Y à H:i:s', $expiresAt);
        }

        return "Aucune date d'expiration trouvée.";
    }
}
