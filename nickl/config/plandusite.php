<?php
/**
 * @package Générer plan du site
 * @version 1.0
 */
/*
Plugin Name: Générer le plan du site
Description: Permet de générer automatiquement le plan du site en utilisant le shortcode [plan_du_site] sur une page
Author: Tony Archambeau
Version: 1.0
Author URI: http://tonyarchambeau.com/
*/


// [plan_du_site]
if (!function_exists('plan_du_site_func')) {
	function plan_du_site_func() {
		$return = '';
	
		// List the pages
		$return .= '<div class="list">';
		$return .= '<div class="item"><h2>'.__('Les pages').'</h2>';
		$return .= '<ul>';
		$return .= wp_list_pages('title_li=&echo=0');
		$return .= '</ul></div>';
	
		// Display the posts with post type "actualites"
		if (!function_exists('displayActualitesPostType')) {
			function displayActualitesPostType() 
			{	
				$title = get_field('title', 'options_actualites');
				// List  the posts with post type "actualites"
				$args = array(
					'numberposts'	=> 100,
					'post_type'		=> 'actualites'
				);
				$my_posts = get_posts( $args );
				$html = '';
				if (count($my_posts) > 0) {
					$html .= '<div class="item"><h2>'.__('Les actualités').'</h2>';
					$html .= '<ul>';
					$html .= "\t\t".'<li><a href="'.home_url('/').'actualites">'. ($title ?: 'Actualités') . '</a> </li>'."\n";
					foreach($my_posts as $my_post) {
						$html .= "\t\t".'<li><a href="'.get_permalink($my_post->ID).'">'.$my_post->post_title.'</a> </li>'."\n";
					}
					
					$html .= '</ul></div>';
				}
				return $html;
			}
		}
		
		// Display the posts with post type "references"
		if (!function_exists('displayRefsPostType')) {
			function displayRefsPostType() 
			{				
				$title = get_field('title', 'options_references');
				// List the posts with post type "references"
				$args = array(
					'numberposts'	=> 100,
					'post_type'		=> 'references'
				);
				$my_posts = get_posts( $args );
				$html = '';
				if (count($my_posts) > 0) {
					$html .= '<div class="item"><h2>Les références</h2>';
					$html .= '<ul>';
					$html .= "\t\t".'<li><a href="'.home_url('/').'references">'. ($title ?: 'Références') . '</a> </li>'."\n";
					if (get_field('ref_display', 'options_references') !== 'popup')	{
						foreach($my_posts as $my_post) {
							$html .= "\t\t".'<li><a href="'.get_permalink($my_post->ID).'">'.$my_post->post_title.'</a> </li>'."\n";
						}
					}
					$html .= '</ul></div>';
				}
				return $html;
			}
		}
		// Display the posts with post type "evenements"
		if (!function_exists('displayEventsPostType')) {
			function displayEventsPostType() 
			{
				$title = get_field('title', 'options_evenements');
				// List the posts with post type "evenements"
				$args = array(
					'numberposts'	=> 100,
					'post_type'		=> 'evenements'
				);
				$my_posts = get_posts( $args );
				$html = '';
				if (count($my_posts) > 0) {
					$html .= '<div class="item"><h2>'.__('Les événements').'</h2>';
					$html .= '<ul>';
					$html .= "\t\t".'<li><a href="'.home_url('/').'evenements">'. ($title ?: 'Événements') . '</a> </li>'."\n";
					foreach($my_posts as $my_post) {
						$html .= "\t\t".'<li><a href="'.get_permalink($my_post->ID).'">'.$my_post->post_title.'</a> </li>'."\n";
					}
					
					$html .= '</ul></div>';
				}
				return $html;
			}
		}
		// // Display the products	
        // function displayProducts() 
        // {
        //     $my_products = wc_get_products(['limit' => -1]);
        //     $html = '';

        //     if (count($my_products) > 0) {
        //         $html .= '<div class="item"><h2>' . __('Les produits') . '</h2>';
        //         $html .= '<ul>';
        //         $html .= "\t\t" . '<li><a href="' . home_url('/boutique') . '">Boutique</a></li>' . "\n";

        //         foreach ($my_products as $product) {
        //             $html .= "\t\t" . '<li><a href="' . get_permalink($product->get_id()) . '">' . esc_html($product->get_name()) . '</a></li>' . "\n";
        //         }

        //         $html .= '</ul></div>';
        //     }

        //     return $html;
        // }		
	
		$return .= displayActualitesPostType();	
		$return .= displayRefsPostType();
		$return .= displayEventsPostType();		
		// if (function_exists('is_woocommerce') && is_woocommerce()) {
		// 	$return .= displayProducts();
		// }
		$return .= '</div>';			
		return $return;
	}
}
add_shortcode( 'plan_du_site', 'plan_du_site_func' );