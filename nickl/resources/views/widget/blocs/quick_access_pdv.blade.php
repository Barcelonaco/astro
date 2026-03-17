@php 

use App\Helpers\GlobalHelper;

@endphp

<div class="module link-module pdv-functions">
  <h3>Fonctionnalités spéciales</h3>
  <hr>
  <div class="wrapper">   
    <div class="row">
      <h4>
        {{ bcn_pll('Alertes') }}
      </h4>
      <div class="links">
        <a href="{{ admin_url() . 'edit.php?post_type=alertes' }}"
           title="{{ bcn_pll('Voir toutes les alertes') }}">
          <span class="icon">{!! GlobalHelper::displaySvg('alertes.svg') !!}</span>
          <span>{{ bcn_pll('Liste des alertes') }}</span></a>
        <a href="{{ admin_url() . 'post-new.php?post_type=alertes' }}"
           title="{{ bcn_pll('Ajouter une alerte') }}">
          <span class="icon add">{!! GlobalHelper::displaySvg('alertes.svg') !!}</span>
          <span>{{ bcn_pll('Ajouter') }}</span></a>
      </div>
    </div>

    <div class="row">
      <h4>
        {{ bcn_pll('Conseils municipaux') }}
      </h4>
      <div class="links">
        <a href="{{ admin_url() . 'edit.php?post_type=conseils_municipaux' }}"
           title="{{ bcn_pll('Voir tous les conseils municipaux') }}">
          <span class="icon">{!! GlobalHelper::displaySvg('conseils-municipaux.svg') !!}</span>
          <span>{{ bcn_pll('Liste des conseils municipaux') }}</span></a>
        <a href="{{ admin_url() . 'post-new.php?post_type=conseils_municipaux' }}"
           title="{{ bcn_pll('Ajouter un conseils municipal') }}">
          <span class="icon add">{!! GlobalHelper::displaySvg('conseils-municipaux.svg') !!}</span>
          <span>{{ bcn_pll('Ajouter') }}</span> </a>
      </div>
    </div>

    {{-- @if (get_field('is_associations', 'options')) --}}
      <div class="row">
        <h4>
          {{ bcn_pll('Associations') }}
        </h4>
        <div class="links">
          <a href="{{ admin_url() . 'edit.php?post_type=associations' }}"
            title="{{ bcn_pll('Voir toutes les associations') }}">
            <span class="icon">{!! GlobalHelper::displaySvg('associations.svg') !!}</span>
            <span>{{ bcn_pll('Liste des associations') }}</span></a>
          <a href="{{ admin_url() . 'post-new.php?post_type=associations' }}"
            title="{{ bcn_pll('Ajouter une association') }}">
            <span class="icon add">{!! GlobalHelper::displaySvg('associations.svg') !!}</span>
            <span>{{ bcn_pll('Ajouter') }}</span> </a>
        </div>
      </div>
    {{-- @endif --}}
    
    {{-- @if (get_field('is_commerces', 'options')) --}}
      <div class="row">
        <h4>
          {{ bcn_pll('Commerces') }}
        </h4>
        <div class="links">
          <a href="{{ admin_url() . 'edit.php?post_type=commerces' }}"
            title="{{ bcn_pll('Voir tous les commerces') }}">
            <span class="icon">{!! GlobalHelper::displaySvg('commerces.svg') !!}</span>
            <span>{{ bcn_pll('Liste des commerces') }}</span></a>
          <a href="{{ admin_url() . 'post-new.php?post_type=commerces' }}"
            title="{{ bcn_pll('Ajouter un commerce') }}">
            <span class="icon add">{!! GlobalHelper::displaySvg('commerces.svg') !!}</span>
            <span>{{ bcn_pll('Ajouter') }}</span></a>
        </div>
      </div>
    {{-- @endif --}}

    {{-- @if (get_field('is_santes', 'options')) --}}
      <div class="row">
        <h4>
          {{ bcn_pll('Santé') }}
        </h4>
        <div class="links">
          <a href="{{ admin_url() . 'edit.php?post_type=santes' }}"
            title="{{ bcn_pll('Voir tous les établissements') }}">
            <span class="icon">{!! GlobalHelper::displaySvg('santes.svg') !!}</span>
            <span>{{ bcn_pll('Liste des établissements') }}</span></a>
          <a href="{{ admin_url() . 'post-new.php?post_type=santes' }}"
            title="{{ bcn_pll('Ajouter un établissement') }}">
            <span class="icon add">{!! GlobalHelper::displaySvg('santes.svg') !!}</span>
            <span>{{ bcn_pll('Ajouter') }}</span></a>
        </div>
      </div>
    {{-- @endif --}}
    
    <div class="row">
      <h4>
        {{ bcn_pll('Publications') }}
      </h4>
      <div class="links">
        <a href="{{ admin_url() . 'edit.php?post_type=publications' }}"
           title="{{ bcn_pll('Voir toutes les publications') }}">
          <span class="icon">{!! GlobalHelper::displaySvg('publications.svg') !!}</span>
          <span>{{ bcn_pll('Liste des publications') }}</span></a>
        <a href="{{ admin_url() . 'post-new.php?post_type=publications' }}"
           title="{{ bcn_pll('Ajouter une publication') }}">
          <span class="icon add">{!! GlobalHelper::displaySvg('publications.svg') !!}</span>
          <span>{{ bcn_pll('Ajouter') }}</span></a>
      </div>
    </div>    
  </div>
</div>