{{-- Page d'administration de gestion des crédits IA --}}
<div class="ia wrap">
  <h1>Gestion des Crédits IA Claude</h1>

  <div class="ia-credit-summary">
    <div class="card">
      <h2>Configuration</h2>

      <form id="api-key-form" style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #eee;">
        <label for="ia_api_key" style="display: block; font-weight: bold; margin-bottom: 5px;">Clé API Claude
          (Anthropic)</label>
        <div style="display: flex; gap: 10px; align-items: center;">
          <div style="position: relative;">
            <input type="password" id="ia_api_key" name="api_key" value="{{ $current_api_key ? $current_api_key : '' }}"
              style="width: 400px; padding-right: 30px;" placeholder="sk-ant-...">
            <span id="toggle-api-key"
              style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; color: #666;"
              title="Afficher/Masquer">
              <span class="dashicons dashicons-visibility"></span>
            </span>
          </div>
          <button type="submit" class="button button-primary">Sauvegarder la clé</button>
          @if($current_api_key && function_exists('get_field') && get_field('ia_api_key', 'option') == $current_api_key && !get_option('ia_api_key_manual'))
            <span class="description" style="align-self: center;"></span>
          @endif
        </div>
        <p class="description">La clé est stockée de manière sécurisée. Laissez vide pour supprimer.</p>
      </form>

      @if(get_option('ia_usage_stats'))
        <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ff9800; margin-bottom: 20px;">
          <h3>Migration des statistiques</h3>
          <p>Des statistiques d'utilisation de l'ancien système ont été détectées. Vous pouvez les migrer vers le pot
            commun actuel.</p>
          <button type="button" class="button button-secondary" id="migrate-stats">Migrer les anciennes
            statistiques</button>
        </div>
      @endif
    </div>
  </div>

  <div class="card" style="margin-top: 20px; padding: 20px; text-align: center; border-left: 4px solid #2271b1;">
    <h2>Crédit Global du Site</h2>
    <div
      style="font-size: 3em; font-weight: bold; color: {{ $stats['remaining_credit'] <= 0 ? '#d63638' : '#00a32a' }}">
      {{ number_format($stats['remaining_credit'], 2) }}€
    </div>
    <p>sur {{ number_format($stats['total_credit'], 2) }}€ disponibles</p>

    <div style="margin-top: 20px;">
      <button type="button" class="button button-primary add-credit-btn">Ajouter du crédit</button>
    </div>

    <div style="display: flex; justify-content: space-around; margin-top: 30px; background: #f0f0f1; padding: 15px;">
      <div>
        <strong>Total Utilisé</strong><br>
        {{ number_format($stats['used_credit'], 2) }}€
      </div>
      <div>
        <strong>Requêtes Totales</strong><br>
        {{ number_format($stats['request_count']) }}
      </div>
      <div>
        <strong>Tokens Total</strong><br>
        {{ number_format($stats['total_input'] + $stats['total_output']) }}
      </div>
    </div>
  </div>

  @if(!empty($stats['credit_history']))
    <div class="card" style="margin-top: 20px;">
      <h3>Historique des ajouts de crédits</h3>
      <table class="wp-list-table widefat fixed striped">
        <thead>
          <tr>
            <th>Date</th>
            <th>Montant</th>
            <th>Raison</th>
            <th>Ajouté par</th>
          </tr>
        </thead>
        <tbody>
          @foreach(array_reverse($stats['credit_history']) as $history)
            <tr>
              <td>{{ date('d/m/Y H:i', strtotime($history['date'])) }}</td>
              <td style="color: green; font-weight: bold;">+${{ number_format($history['amount'], 2) }}</td>
              <td>{{ $history['reason'] }}</td>
              <td>
                @php $user = get_userdata($history['added_by']); @endphp
                {{ $user ? $user->display_name : 'ID #' . $history['added_by'] }}
              </td>
            </tr>
          @endforeach
        </tbody>
      </table>
    </div>
  @endif

  <h2>Consommation par Utilisateur</h2>

  @if(empty($users_usage))
    <p>Aucune utilisation enregistrée pour le moment.</p>
  @else
    <table class="wp-list-table widefat fixed striped">
      <thead>
        <tr>
          <th>Utilisateur</th>
          <th>Coût Total</th>
          <th>Part du budget</th>
          <th>Requêtes</th>
          <th>Dernière utilisation</th>
        </tr>
      </thead>
      <tbody>
        @foreach($users_usage as $userId => $usage)
          @php
            $percentage = $stats['used_credit'] > 0 ? ($usage['total_cost'] / $stats['used_credit']) * 100 : 0;
          @endphp
          <tr>
            <td>
              <strong>{{ $usage['username'] ?? 'User #' . $userId }}</strong>
            </td>
            <td>{{ number_format($usage['total_cost'], 2) }} €</td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill" style="width: {{ min(100, $percentage) }}%"></div>
              </div>
              <span>{{ number_format($percentage, 1) }}%</span>
            </td>
            <td>{{ number_format($usage['request_count']) }}</td>
            <td>{{ date('d/m/Y H:i:s', strtotime($usage['last_used'])) ?? 'N/A' }}</td>
          </tr>
        @endforeach
      </tbody>
    </table>
  @endif
</div>

{{-- Modal pour ajouter du crédit --}}
<div id="add-credit-modal" class="ia-modal" style="display: none;">
  <div class="ia-modal-content">
    <span class="ia-modal-close">&times;</span>
    <h2>Ajouter du crédit</h2>
    <form id="add-credit-form">
      <input type="hidden" name="user_id" value="0"> <!-- Global -->

      <p>
        <label for="credit-amount">Montant (€):</label>
        <input type="number" id="credit-amount" name="amount" step="0.01" min="0.01" required>
      </p>

      <p>
        <label for="credit-reason">Raison:</label>
        <input type="text" id="credit-reason" name="reason" placeholder="Ex: Ajout manuel, Bonus, etc." required>
      </p>

      <p>
        <button type="submit" class="button button-primary">Ajouter</button>
        <button type="button" class="button button-secondary ia-modal-close">Annuler</button>
      </p>
    </form>
  </div>
</div>

<style>
  .ia.wrap .card {
    max-width: 1420px;
  }

  .ia-credit-summary {
    margin: 40px 0;
  }

  .ia-credit-summary .card {
    padding: 20px;
    background: #fff;
    border: 1px solid #ccd0d4;
    box-shadow: 0 1px 1px rgba(0, 0, 0, .04);
    max-width: 1420px;
  }

  .status-critical {
    background-color: #fee;
  }

  .status-warning {
    background-color: #ffeaa7;
  }

  .status-ok {
    background-color: #d4edda;
  }

  .progress-bar {
    width: 100px;
    height: 20px;
    background: #e0e0e0;
    border-radius: 10px;
    overflow: hidden;
    display: inline-block;
    vertical-align: middle;
    margin-right: 10px;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4caf50, #ff9800, #f44336);
    transition: width 0.3s;
  }

  .ia-modal {
    display: none;
    position: fixed;
    z-index: 100000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: auto;
    background-color: rgba(0, 0, 0, 0.5);
  }

  .ia-modal-content {
    background-color: #fefefe;
    margin: 10% auto;
    padding: 20px;
    border: 1px solid #888;
    width: 500px;
    max-width: 90%;
    border-radius: 5px;
  }

  .ia-modal-close {
    color: #aaa;
    float: right;
    font-size: 28px;
    font-weight: bold;
    cursor: pointer;
  }

  .ia-modal-close:hover,
  .ia-modal-close:focus {
    color: #000;
  }

  .ia-modal-content label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
  }

  .ia-modal-content input[type="number"],
  .ia-modal-content input[type="text"] {
    width: 100%;
    padding: 8px;
    margin-bottom: 10px;
  }
</style>

<script>
  jQuery(document).ready(function ($) {
    // Modal
    const modal = $('#add-credit-modal');

    $('.add-credit-btn').on('click', function () {
      modal.show();
    });

    $('.ia-modal-close').on('click', function () {
      modal.hide();
    });

    $(window).on('click', function (e) {
      if ($(e.target).is(modal)) {
        modal.hide();
      }
    });

    // Toggle visibilité clé API
    $('#toggle-api-key').on('click', function () {
      const input = $('#ia_api_key');
      const icon = $(this).find('.dashicons');

      if (input.attr('type') === 'password') {
        input.attr('type', 'text');
        icon.removeClass('dashicons-visibility').addClass('dashicons-hidden');
      } else {
        input.attr('type', 'password');
        icon.removeClass('dashicons-hidden').addClass('dashicons-visibility');
      }
    });

    // Ajouter du crédit
    $('#add-credit-form').on('submit', function (e) {
      e.preventDefault();

      const data = {
        action: 'ia_add_credit',
        user_id: $('#modal-user-id').val(),
        amount: $('#credit-amount').val(),
        reason: $('#credit-reason').val()
      };

      $.post(ajaxurl, data, function (response) {
        if (response.success) {
          alert(response.data.message);
          location.reload();
        } else {
          alert('Erreur: ' + response.data);
        }
      });
    });

    // Migration des statistiques
    $('#migrate-stats').on('click', function () {
      if (!confirm('Voulez-vous importer les anciennes statistiques vers votre compte ? Cette action est irréversible.')) {
        return;
      }

      const button = $(this);
      button.text('Migration en cours...').prop('disabled', true);

      $.post(ajaxurl, { action: 'ia_migrate_old_stats' }, function (response) {
        if (response.success) {
          alert(response.data);
          location.reload();
        } else {
          button.text('Migrer les anciennes statistiques vers mon compte').prop('disabled', false);
          alert('Erreur: ' + response.data);
        }
      });
    });

    // Sauvegarder la clé API
    $('#api-key-form').on('submit', function (e) {
      e.preventDefault();

      const button = $(this).find('button[type="submit"]');
      const originalText = button.text();
      button.text('Sauvegarde...').prop('disabled', true);

      const data = {
        action: 'ia_save_api_key',
        api_key: $('#ia_api_key').val()
      };

      $.post(ajaxurl, data, function (response) {
        button.text(originalText).prop('disabled', false);
        if (response.success) {
          alert(response.data);
          location.reload();
        } else {
          alert('Erreur: ' + response.data);
        }
      });
    });

    // Réinitialiser tous les crédits
    $('#reset-all-credits').on('click', function () {
      if (!confirm('Êtes-vous sûr de vouloir réinitialiser tous les crédits mensuels maintenant ?')) {
        return;
      }

      $.post(ajaxurl, { action: 'ia_reset_monthly_credits' }, function (response) {
        if (response.success) {
          alert(response.data);
          location.reload();
        } else {
          alert('Erreur: ' + response.data);
        }
      });
    });
  });
</script>