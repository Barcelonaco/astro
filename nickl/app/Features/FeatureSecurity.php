<?php

namespace App\Features;
class FeatureSecurity
{
    public function hooks()
    {
        add_action('do_feed', [$this, 'disableFedd'], 1);
        add_action('do_feed_rdf', [$this, 'disableFedd'], 1);
        add_action('do_feed_rss', [$this, 'disableFedd'], 1);
        add_action('do_feed_rss2', [$this, 'disableFedd'], 1);
        add_action('do_feed_atom', [$this, 'disableFedd'], 1);
        add_action('do_feed_rss2_comments', [$this, 'disableFedd'], 1);
        add_action('do_feed_atom_comments', [$this, 'disableFedd'], 1);
        add_filter('login_errors', [$this, 'loginErrorMessage']);
        add_filter('wp_headers', [$this, 'disableXPingback']);
        add_filter( 'map_meta_cap', [$this, 'my_map_meta_cap'], 1, 3 );
    }


    public function loginErrorMessage($error)
    {
        if (strpos($error, 'n’est pas inscrit sur ce site')
            || strpos($error, 'is not registered on this site')
            || strpos($error, 'ce mot de passe ne correspond pas à l’identifiant')
            || strpos($error, 'The password you entered for the username')
        ) {
            $error = '<strong>Erreur :</strong> Les informations saisies sont incorrects, merci de vérifier.';
        }

        return $error;
    }

    public function stopPings($vectors)
    {
        unset($vectors[ 'pingback.ping' ]);
        return $vectors;
    }

    public function disableXPingback($headers)
    {
        unset($headers[ 'X-Pingback' ]);

        return $headers;
    }

    public function disableFedd()
    {
        wp_die('No feeds available!');
    }

    public function my_map_meta_cap( $caps, $cap, $user_id ) {
        if ( 'unfiltered_html' === $cap && user_can( $user_id, 'adminsite' ) )
            $caps = array( 'unfiltered_html' );

        return $caps;
    }
}