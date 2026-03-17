@php
  use App\Helpers\GlobalHelper;
  use App\Helpers\IaCreditManager;

  // Récupérer les stats GLOBALES
  $creditManager = IaCreditManager::getInstance();
  $stats = $creditManager->getGlobalStats();

  $remaining = $stats['remaining_credit'];
  $total = $stats['total_credit'];
  $used = $stats['used_credit'];
  $percentage = $total > 0 ? ($used / $total) * 100 : 0;

  // Déterminer le statut
  $statusClass = 'status-ok';
  $statusMessage = 'Crédit Site Disponible';
  if ($percentage >= 90) {
    $statusClass = 'status-critical';
    $statusMessage = 'Crédit Site presque épuisé !';
  } elseif ($percentage >= 70) {
    $statusClass = 'status-warning';
    $statusMessage = 'Attention au crédit global';
  }
@endphp

<div class="module link-module ia-stats-module {{ $statusClass }}">
  <h3>{{ __('Crédit IA', 'sage') }}</h3>
  <hr>
  <div class="wrapper">
    <div class="row full">
      <div class="ia-stats-summary" style="text-align: center; padding: 20px 0;">
        <div class="status-badge"
          style="display: inline-block; padding: 5px 15px; border-radius: 20px; margin-bottom: 10px; font-size: 0.9em; font-weight: bold;">
          {{ $statusMessage }}
        </div>

        <div class="cost-value" style="font-size: 2.5em; font-weight: bold; line-height: 1; margin: 10px 0;">
          {{ number_format($remaining, 2) }}€
        </div>

        <div class="credit-subtitle" style="color: #666; font-size: 0.9em; margin-bottom: 15px;">
          sur {{ number_format($total, 2) }}€ disponibles pour tout le site
        </div>

        <div class="progress-bar-container"
          style="width: 100%; background: #e0e0e0; border-radius: 10px; height: 25px; overflow: hidden; margin: 15px 0;">
          <div class="progress-bar-fill"
            style="height: 100%; width: {{ min(100, $percentage) }}%; transition: width 0.3s;"></div>
        </div>

        <div class="usage-info" style="font-size: 0.85em; color: #666;">
          Utilisé globalement: {{ number_format($used, 2) }}€ ({{ number_format($percentage, 1) }}%)
        </div>
      </div>

      <div class="ia-stats-details"
        style="display: flex; justify-content: space-around; background: #f9f9f9; padding: 10px; border-radius: 5px; margin-top: 10px;">
        <div class="stat-item" style="text-align: center;">
          <span
            style="display: block; font-weight: bold; font-size: 1.2em; color: #333;">{{ number_format($stats['total_input']) }}</span>
          <span style="display: block; font-size: 0.8em; color: #777;">Tokens Input</span>
        </div>
        <div class="stat-item" style="text-align: center;">
          <span
            style="display: block; font-weight: bold; font-size: 1.2em; color: #333;">{{ number_format($stats['total_output']) }}</span>
          <span style="display: block; font-size: 0.8em; color: #777;">Tokens Output</span>
        </div>
        <div class="stat-item" style="text-align: center;">
          <span
            style="display: block; font-weight: bold; font-size: 1.2em; color: #333;">{{ number_format($stats['request_count']) }}</span>
          <span style="display: block; font-size: 0.8em; color: #777;">Requêtes</span>
        </div>
      </div>

      @if($remaining <= 0)
        <div class="credit-alert"
          style="background: #fee; border: 1px solid #f44336; padding: 10px; margin-top: 15px; border-radius: 5px; text-align: center;">
          <strong>⚠️ Crédit Site Épuisé</strong><br>
          <small>L'IA est désactivée pour tous les utilisateurs.</small>
        </div>
      @endif
    </div>
  </div>
</div>

<style>
  .ia-stats-module.status-ok .progress-bar-fill {
    background: linear-gradient(90deg, #4caf50, #8bc34a);
  }

  .ia-stats-module.status-warning .progress-bar-fill {
    background: linear-gradient(90deg, #ff9800, #ffc107);
  }

  .ia-stats-module.status-critical .progress-bar-fill {
    background: linear-gradient(90deg, #f44336, #e91e63);
  }

  .ia-stats-module.status-ok .cost-value {
    color: #4caf50;
  }

  .ia-stats-module.status-warning .cost-value {
    color: #ff9800;
  }

  .ia-stats-module.status-critical .cost-value {
    color: #f44336;
  }

  .ia-stats-module.status-ok .status-badge {
    background: #d4edda;
    color: #155724;
  }

  .ia-stats-module.status-warning .status-badge {
    background: #fff3cd;
    color: #856404;
  }

  .ia-stats-module.status-critical .status-badge {
    background: #f8d7da;
    color: #721c24;
  }
</style>
