@php
    use App\Helpers\GlobalHelper;
@endphp
<div class="no-cookies-wrapper js_show-cookies">
    <div class="no-cookies">
        <span class="no-cookies-icon" aria-hidden="true">{!! GlobalHelper::displaySvg('cookies-light.svg') !!}</span>
        {{-- @TODODEV - Rendre ce texte traductible --}}
        <p class="no-cookies-txt">
            {!! bcn_pll('Pour afficher ce contenu<br>vous devez accepter les cookies') !!} 
            <button type="button" data-cc="show-preferencesModal" aria-haspopup="dialog">{{ $cat }}</button>.
        </p>
    </div>{{-- /.no-cookies --}}
</div>{{-- /.no-cookies-wrapper --}}

<script>
    // Attendez que le DOM soit entièrement chargé avant d'attacher l'événement
    document.addEventListener("DOMContentLoaded", function() {
        // Cibler le bouton avec data-cc="c-settings"
        const button = document.querySelector('[data-cc="c-settings"]');
        
        if (button) {
            button.addEventListener('click', function() {
                // Ouvrir la modal de consentement après le clic sur le bouton
                window.cookieconsent.show(); // Ou selon la méthode spécifique pour afficher la modal (si vous utilisez une autre bibliothèque ou méthode)
            });
        }
    });
</script>
