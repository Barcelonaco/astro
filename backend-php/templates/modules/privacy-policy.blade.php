<div id="{{ $id_bloc ?? '' }}" class="module module-privacy-policy {{ $classes ?? '' }}">

    @if (!empty($backgroundImage))
        <div class="background"
            style="background-image: url({{ $backgroundImage['url'] ?? '' }}); opacity: {{ $backgroundImage['opacity'] ?? 10 }};">
        </div>
    @endif

    <div class="container">
        <div class="privacy-policy-content editor" style="max-width:900px;margin:0 auto;">
            <h2>Politique de confidentialit&eacute;</h2>

            @if (!empty($site_url) && !empty($owner_name))
                <p>Le site web <a href="{{ $site_url }}">{{ $site_url }}</a> est d&eacute;tenu par {{ $owner_name }}, qui est un contr&ocirc;leur de donn&eacute;es de vos donn&eacute;es personnelles.</p>
            @endif

            @if (!empty($site_url))
                <p>Nous avons adopt&eacute; cette politique de confidentialit&eacute;, qui d&eacute;termine la mani&egrave;re dont nous traitons les informations collect&eacute;es par <a href="{{ $site_url }}">{{ $site_url }}</a>.</p>
            @endif

            <h3>Les informations personnelles que nous collectons</h3>
            <p>Lorsque vous visitez le site, nous recueillons automatiquement certaines informations sur votre appareil (navigateur, adresse IP, fuseau horaire, cookies).</p>

            <h3>Pourquoi traitons-nous vos donn&eacute;es ?</h3>
            <p>Notre priorit&eacute; absolue est la s&eacute;curit&eacute; des donn&eacute;es des clients. Les informations collect&eacute;es sont utilis&eacute;es pour identifier les cas d'abus et &eacute;tablir des statistiques d'utilisation.</p>

            <h3>Vos droits</h3>
            <p>Droit d'acc&egrave;s, de rectification, &agrave; l'effacement, de restreindre le traitement, &agrave; la portabilit&eacute;, d'opposition, et relatifs au profilage.</p>

            <h3>S&eacute;curit&eacute; / Divulgation / Cookies</h3>
            <p style="opacity:0.5;font-style:italic;">Les sections d&eacute;taill&eacute;es (cookies, balises, s&eacute;curit&eacute;, divulgation l&eacute;gale) sont g&eacute;n&eacute;r&eacute;es automatiquement sur le site.</p>

            @if (!empty($contact_email))
                <h3>Informations de contact</h3>
                <p>Courriel : <a href="mailto:{{ $contact_email }}">{{ $contact_email }}</a></p>
            @endif
        </div>
    </div>
</div>
