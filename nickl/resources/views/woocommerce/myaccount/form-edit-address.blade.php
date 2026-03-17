<?php
// Récupère l'adresse à modifier (facturation ou livraison)
$address_type = isset($_GET['address_type']) ? sanitize_text_field($_GET['address_type']) : 'billing';

// Vérifie si l'utilisateur est connecté
if (is_user_logged_in()) {
  // Affiche le formulaire d'édition d'adresse
  woocommerce_account_edit_address($address_type);
} else {
  // Si l'utilisateur n'est pas connecté, redirige vers la page de connexion
  wp_redirect(wp_login_url());
  exit;
}
?>
