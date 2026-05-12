<div id="{{ $id_bloc ?? '' }}" class="module module-legal-notice {{ $classes ?? '' }}">

    @if (!empty($backgroundImage))
        <div class="background"
            style="background-image: url({{ $backgroundImage['url'] ?? '' }}); opacity: {{ $backgroundImage['opacity'] ?? 10 }};">
        </div>
    @endif

    <div class="container">
        <div class="legal-notice-content editor" style="max-width:900px;margin:0 auto;">
            <h2>Mentions L&eacute;gales</h2>

            <h3>D&eacute;finitions</h3>
            <p><strong>Client</strong> : tout professionnel ou personne physique capable au sens des articles 1123 et suivants du Code civil, ou personne morale, qui visite le Site objet des pr&eacute;sentes conditions g&eacute;n&eacute;rales.</p>

            <h3>1. Pr&eacute;sentation du site internet.</h3>
            @if (!empty($site_url))
                <p>En vertu de l'article 6 de la loi n&deg; 2004-575 du 21 juin 2004, il est pr&eacute;cis&eacute; aux utilisateurs du site <a href="{{ $site_url }}">{{ $site_url }}</a> :</p>
            @endif

            @if (!empty($owner_name))
                <p><strong>Propri&eacute;taire</strong> : {{ $owner_name }}
                @if (!empty($owner_capital)) Capital social de {{ $owner_capital }} @endif
                @if (!empty($owner_vat)) Num&eacute;ro de TVA: {{ $owner_vat }} @endif
                @if (!empty($owner_address)) &ndash; {{ $owner_address }} @endif
                </p>
            @endif

            @if (!empty($publication_manager))
                <p><strong>Responsable publication</strong> : {{ $publication_manager }}
                @if (!empty($publication_email)) &ndash; <a href="mailto:{{ $publication_email }}">{{ $publication_email }}</a> @endif
                </p>
            @endif

            @if (!empty($webmaster_name))
                <p><strong>Webmaster</strong> : {{ $webmaster_name }}
                @if (!empty($webmaster_email)) &ndash; <a href="mailto:{{ $webmaster_email }}">{{ $webmaster_email }}</a> @endif
                </p>
            @endif

            @if (!empty($host_name))
                <p><strong>H&eacute;bergeur</strong> : {{ $host_name }}
                @if (!empty($host_address)) &ndash; {{ $host_address }} @endif
                </p>
            @endif

            @if (!empty($dpo_name))
                <p><strong>D&eacute;l&eacute;gu&eacute; &agrave; la protection des donn&eacute;es</strong> : {{ $dpo_name }}
                @if (!empty($dpo_email)) &ndash; <a href="mailto:{{ $dpo_email }}">{{ $dpo_email }}</a> @endif
                </p>
            @endif

            <p style="opacity:0.5;font-style:italic;margin-top:2rem;">Les articles 2 &agrave; 10 (CGU, propri&eacute;t&eacute; intellectuelle, RGPD, cookies, etc.) sont g&eacute;n&eacute;r&eacute;s automatiquement sur le site.</p>

            @if (!empty($jurisdiction))
                <p><strong>Tribunal comp&eacute;tent</strong> : {{ $jurisdiction }}</p>
            @endif
        </div>
    </div>
</div>
