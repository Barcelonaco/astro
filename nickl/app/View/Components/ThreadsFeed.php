<?php

namespace App\View\Components;

use GuzzleHttp\Client;

class ThreadsFeed
{

   public static function getThreadsPosts(){
       $client = new Client();
       $id_account = self::getIdAccount();

       $response = $client->get('https://graph.threads.net/v1.0/'. $id_account .'/media', [
           'query' => [
               'fields' => 'id,caption,media_type,media_url,thumbnail_url,permalink',
               'access_token' => self::getLongLivedAccessToken(),
           ]
       ]);

       $posts = json_decode($response->getBody()->getContents(), true);
       return $posts;
   }

   public static function getIdAccount(){
       return get_field('id_account_threads', 'options') ?? '';
   }
    public static function getLinkAccount()
    {
        return get_field('link_account_threads', 'options') ?? '';
    }
    public static function getLongLivedAccessToken()
    {
        $filePath = get_template_directory() . '/config/threads_access_token_data.json';

        // Vérifier si un token valide existe déjà
        if (file_exists($filePath)) {
            $tokenData = json_decode(file_get_contents($filePath), true);

            if (isset($tokenData['access_token'], $tokenData['expires_at'])) {
                // Vérifier si le token expire dans moins d'une heure (3600s) et le régénérer si nécessaire
                if (time() < $tokenData['expires_at'] - 3600) {
                    return $tokenData['access_token'];
                }
            }
        }

        // Si pas de token valide, on le régénère
        return self::refreshAccessToken($filePath);
    }
    private static function refreshAccessToken($filePath)
    {
        $client = new Client();

        $shortLivedToken = get_field('access_token_threads', 'options') ?? null;
        $client_id = get_field('id_application_threads', 'options') ?? null;
        $secret_key = get_field('secret_key_application_threads', 'options') ?? null;

        if (!$shortLivedToken || !$client_id || !$secret_key) {
            error_log("Erreur : Paramètres manquants pour générer le jeton longue durée.");
            return null;
        }

        try {
            $response = $client->get('https://graph.facebook.com/v22.0/oauth/access_token', [
                'query' => [
                    'grant_type'        => 'fb_exchange_token',
                    'client_id'         => $client_id,
                    'client_secret'     => $secret_key,
                    'fb_exchange_token' => $shortLivedToken,
                ]
            ]);

            $data = json_decode($response->getBody()->getContents(), true);

            if (!isset($data['access_token'])) {
                error_log("Erreur : Réponse API invalide - " . json_encode($data));
                return null;
            }

            $accessToken = $data['access_token'];
            $expiresAt = time() + ($data['expires_in'] ?? 60 * 24 * 60 * 60); // Utilise expires_in ou une valeur par défaut (60 jours)

            // S'assurer que le dossier existe
            if (!is_dir(dirname($filePath))) {
                mkdir(dirname($filePath), 0755, true);
            }

            // Stocker le token et la date d'expiration dans un fichier JSON
            file_put_contents($filePath, json_encode([
                'access_token' => $accessToken,
                'expires_at'   => $expiresAt
            ]));

            return $accessToken;
        } catch (\Exception $e) {
            error_log("Erreur lors de la récupération du jeton longue durée : " . $e->getMessage());
            return null;
        }
    }
}
