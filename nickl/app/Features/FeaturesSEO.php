<?php

namespace App\Features;

use App\Posttype\CptReferences;
use App\Posttype\CptNews;
use App\Helpers\GlobalHelper;

class FeaturesSEO
{
    public function hooks()
    {
        
        add_filter( 'wpseo_should_add_subdirectory_multisite_xml_sitemaps', '__return_false' );
    }

    public function saveContentInWPContent($pid)
{
    // Exclure les révisions et autosaves
    if (wp_is_post_revision($pid) || wp_is_post_autosave($pid)) {
        error_log("🛑 Exclusion : Révision ou autosave détectée pour le post ID $pid");
        return;
    }

    // Vérifier si c'est une publication et non une simple mise à jour
    $postStatus = get_post_status($pid);
    if ($postStatus !== 'publish') {
        error_log("🛑 Exclusion : Post $pid n'est pas publié (Status: $postStatus)");
        return;
    }

    $cptRefs = new CptReferences();
    $cptNews = new CptNews();
    $postName = get_post_field('post_name', $pid);
    $postType = get_post_type($pid);
    $continue = true;

    // Vérification des types de post autorisés
    $postTypes = [
        'page',
        $cptRefs->getSlug(),
        $cptNews->getSlug(),
    ];

    if (!in_array($postType, $postTypes)) {
        error_log("🛑 Exclusion : Type de post non autorisé ($postType) pour l'ID $pid");
        $continue = false;
    }

    if (empty($postName)) {
        error_log("🛑 Exclusion : Le post ID $pid n'a pas de slug.");
        $continue = false;
    }

    if (GlobalHelper::isWoocommercePage($pid)) {
        error_log("🛑 Exclusion : Le post ID $pid est une page WooCommerce.");
        $continue = false;
    }

    if (!$continue) {
        return;
    }

    // Éviter la boucle infinie en supprimant temporairement le hook
    remove_action('save_post', [$this, 'saveContentInWPContent']);

    $url = get_permalink($pid) . '?without_head_and_foot=1';

    error_log("✅ Mise à jour du post $pid avec le contenu de $url");

    if (false !== ($content = $this->getContentFromUrl($url))) {
        wp_update_post([
            'ID' => $pid,
            'post_content' => $content
        ]);
    } else {
        error_log("⚠️ Échec de récupération du contenu pour $url");
    }

    // Réactiver le hook après mise à jour
    add_action('save_post', [$this, 'saveContentInWPContent'], 10, 1);
}

    


    /**
     * @param $url
     * @return bool|string
     *
     * Retourne le code html de la page sans le header et le footer
     */
    public function getContentFromUrl($url)
    {
        $htaccess = env('HTACCESS');
        $htpasswd = env('HTPASSWD');

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_REFERER, $url);

        if (WP_ENV != 'production' && !empty($htaccess) || !empty($htpasswd)) {
            curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_ANY);
            curl_setopt($ch, CURLOPT_USERPWD, $htaccess.':'.$htpasswd);
        }
        $result = curl_exec($ch);

        curl_close($ch);
        return $result;
    }
}
