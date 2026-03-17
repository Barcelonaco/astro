/**
 * Script pour afficher le statut du crédit IA dans l'interface admin
 */
jQuery(document).ready(function($) {
    // Vérifier si on est sur une page d'édition avec l'IA
    if (!$('#generateaicontent').length && !$('#generateaicontent_simple').length) {
        return;
    }

    // Créer un conteneur pour afficher le crédit
    const creditDisplay = $('<div id="ia-credit-status" style="margin: 10px 0; padding: 10px; border-radius: 5px; font-size: 13px;"></div>');

    // Insérer avant le bouton de génération
    if ($('#generateaicontent').length) {
        $('#generateaicontent').before(creditDisplay);
    } else if ($('#generateaicontent_simple').length) {
        $('#generateaicontent_simple').before(creditDisplay);
    }

    // Fonction pour mettre à jour l'affichage du crédit
    function updateCreditDisplay() {
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'get_ia_credit_status'
            },
            success: function(response) {
                if (response.success) {
                    const data = response.data;
                    const percentage = data.percentage_used;

                    let statusClass = 'status-ok';
                    let statusColor = '#4caf50';
                    let statusIcon = '✓';

                    if (percentage >= 90) {
                        statusClass = 'status-critical';
                        statusColor = '#f44336';
                        statusIcon = '⚠️';
                    } else if (percentage >= 70) {
                        statusClass = 'status-warning';
                        statusColor = '#ff9800';
                        statusIcon = '⚠';
                    }

                    creditDisplay.html(`
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <strong style="color: ${statusColor};">${statusIcon} Crédit IA:</strong>
                                <span style="font-weight: bold; color: ${statusColor};">${data.remaining_credit.toFixed(2)}€</span>
                                <span style="color: #666;"> / ${data.total_credit.toFixed(2)}€</span>
                            </div>
                            <div style="font-size: 11px; color: #666;">
                                ${data.request_count} requêtes ce mois
                            </div>
                        </div>
                        <div style="width: 100%; background: #e0e0e0; border-radius: 10px; height: 8px; margin-top: 8px; overflow: hidden;">
                            <div style="height: 100%; width: ${Math.min(100, percentage)}%; background: ${statusColor}; transition: width 0.3s;"></div>
                        </div>
                    `);

                    creditDisplay.css({
                        'background': statusClass === 'status-critical' ? '#fee' : (statusClass === 'status-warning' ? '#fff3cd' : '#d4edda'),
                        'border': `1px solid ${statusColor}`
                    });

                    // Désactiver le bouton si crédit épuisé
                    if (data.remaining_credit <= 0) {
                        $('#generateaicontent, #generateaicontent_simple').prop('disabled', true).css('opacity', '0.5');
                        creditDisplay.append('<div style="margin-top: 8px; color: #f44336; font-weight: bold;">⛔ Crédit épuisé - Contactez l\'administrateur</div>');
                    }
                }
            },
            error: function() {
                creditDisplay.html('<div style="color: #f44336;">Impossible de charger le statut du crédit</div>');
            }
        });
    }

    // Mettre à jour au chargement
    updateCreditDisplay();

    // Intercepter les clics sur les boutons de génération pour rafraîchir après
    $(document).on('ajaxSuccess', function(event, xhr, settings) {
        if (settings.data && settings.data.includes('action=generer_contenu_ia_claude')) {
            // Attendre un peu que le serveur mette à jour les stats
            setTimeout(updateCreditDisplay, 1000);
        }
    });
});
