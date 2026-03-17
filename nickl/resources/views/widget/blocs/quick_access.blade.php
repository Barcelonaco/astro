@php 

use App\Helpers\GlobalHelper;

@endphp

<div class="module link-module">
  <h3>Accès rapide</h3>
  <hr>
  <div class="wrapper">   
    @if (class_exists('woocommerce') && !get_field('is_commercial', 'options'))
      <div class="row">
        <h4>
          {{ bcn_pll('Votre catalogue en ligne') }}
        </h4>
        <div class="links">
          <a href="{{ admin_url() . 'edit.php?post_type=product' }}"
             title="{{ bcn_pll('Voir la liste des produits') }}">
            <span class="icon">{!! GlobalHelper::displaySvg('products.svg') !!}</span>
            <span>{{ bcn_pll('Liste des produits') }}</span></a>
          <a href="{{ admin_url() . 'post-new.php?post_type=product' }}"
             title="{{ bcn_pll('Ajouter un produit') }}">
            <span class="icon add">{!! GlobalHelper::displaySvg('products.svg') !!}</span>
            <span>{{ bcn_pll('Ajouter') }}</span> </a>
        </div>
      </div>
    @endif
    <div class="row">
      <h4>
        {{ bcn_pll('Actualités') }}
      </h4>
      <div class="links">
        <a href="{{ admin_url() . 'edit.php?post_type=' . $news->getSlug() }}"
           title="{{ bcn_pll('Voir toutes les actualités') }}">
          <span class="icon">{!! GlobalHelper::displaySvg('news.svg') !!}</span>
          <span>{{ bcn_pll('Liste des actus') }}</span></a>
        <a href="{{ admin_url() . 'post-new.php?post_type=' . $news->getSlug() }}"
           title="{{ bcn_pll('Ajouter une actu') }}">
          <span class="icon add">{!! GlobalHelper::displaySvg('news.svg') !!}</span>
          <span>{{ bcn_pll('Ajouter') }}</span> </a>
      </div>
    </div>

    <div class="row">
      <h4>
        {{ bcn_pll('Références') }}
      </h4>
      <div class="links">
        <a href="{{ admin_url() . 'edit.php?post_type=' . $references->getSlug() }}"
           title="{{ bcn_pll('Voir toutes les références') }}">
          <span class="icon">{!! GlobalHelper::displaySvg('refs.svg') !!}</span>
          <span>{{ bcn_pll('Liste des références') }}</span></a>
        <a href="{{ admin_url() . 'post-new.php?post_type=' . $references->getSlug() }}"
           title="{{ bcn_pll('Ajouter une référence') }}">
          <span class="icon add">{!! GlobalHelper::displaySvg('refs.svg') !!}</span>
          <span>{{ bcn_pll('Ajouter') }}</span></a>
      </div>
    </div>

    <div class="row">
      <h4>
        {{ bcn_pll('Pages') }}
      </h4>
      <div class="links">
        <a href="{{ admin_url() . 'edit.php?post_type=page' }}"
           title="{{ bcn_pll('Voir toutes les pages') }}">
          <span class="icon">{!! GlobalHelper::displaySvg('pages.svg') !!}</span>
          <span>{{ bcn_pll('Liste des pages') }}</span></a>
        <a href="{{ admin_url() . 'post-new.php?post_type=page' }}"
           title="{{ bcn_pll('Ajouter une page') }}">
          <span class="icon add">{!! GlobalHelper::displaySvg('pages.svg') !!}</span>
          <span>{{ bcn_pll('Ajouter') }}</span> </a>
      </div>
    </div>

    <div class="row">
      <h4>
        {{ bcn_pll('Événements') }}
      </h4>
      <div class="links">
        <a href="{{ admin_url() . 'edit.php?post_type=evenements' }}"
           title="{{ bcn_pll('Voir touts les événements') }}">
          <span class="icon">{!! GlobalHelper::displaySvg('events.svg') !!}</span>
          <span>{{ bcn_pll('Liste des événements') }}</span></a>
        <a href="{{ admin_url() . 'post-new.php?post_type=evenements' }}"
           title="{{ bcn_pll('Ajouter un événements') }}">
          <span class="icon add">{!! GlobalHelper::displaySvg('events.svg') !!}</span>
          <span>{{ bcn_pll('Ajouter') }}</span></a>
      </div>
    </div>

    <div class="row full">
      <h4>
        {{ bcn_pll('Autres') }}
      </h4>
      <div class="links">
        <a href="{{ admin_url() . 'nav-menus.php' }}"
           title="{{ bcn_pll('Accéder aux menus') }}">
          <span class="icon">{!! GlobalHelper::displaySvg('menus.svg') !!}</span>
          <span>{{ bcn_pll('Menus') }}</span></a>
        <a href="{{ admin_url() . 'admin.php?page=params' }}"
           title="{{ bcn_pll('Accèder aux paramètres du site') }}">
          <span class="icon">{!! GlobalHelper::displaySvg('settings.svg') !!}</span>
          <span>{{ bcn_pll('Paramètres') }}</span></a>
        <a href="https://tutos.nickl.fr/"
           title="{{ bcn_pll('Accèder aux tutos Nickl') }}" target=_blank>
          <span class="icon">{!! GlobalHelper::displaySvg('tutos.svg') !!}</span>
          <span>{{ bcn_pll('Les tutos') }}</span></a>
        <a href="https://demo.nickl.fr/"
           title="{{ bcn_pll('Accèder aux site démo') }}" target=_blank>
          <span class="icon">{!! GlobalHelper::displaySvg('demo.svg') !!}</span>
          <span>{{ bcn_pll('Site démo') }}</span></a>
        <a href="{{ admin_url() . 'profile.php' }}"
           title="Accéder à votre profil">
          <span class="icon">{!! GlobalHelper::displaySvg('profile.svg') !!}</span>
          <span>{{ bcn_pll('Mon profil') }}</span></a>
        <a href="{{ home_url() . '/login?action=logout' }}"
           title="{{ bcn_pll('Se déconnecter') }}">
          <span class="icon">{!! GlobalHelper::displaySvg('logout.svg') !!}</span>
          <span>{{ bcn_pll('Déconnexion') }}</span></a>
      </div>
    </div>
  </div>
</div>
