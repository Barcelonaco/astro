@php
    use App\Helpers\GlobalHelper;
@endphp
<main id="main" class="main-page page-protected" role="main">
    <section>
        <div class="module module-protected has-background-image">
            <div class="background" style="background-image: url('{{ GlobalHelper::getImageOrReplacement('banner', 0)['url'] }}'); 'opacity: 0.1"></div>
            <div class="container">
                <div class="form-column"> 
                <h1>Accès restreint</h1>
                    {!! get_the_password_form() !!}
                </div>
            </div>
        </div>
    </section>
</main>
