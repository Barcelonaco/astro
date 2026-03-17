@extends('layouts.app')
@section('content')

    <main id="main" class="main-page page-error-404" role="main">
        <section>
            <div class="content-404">
                <div class="background">

                    @if ($imgBanner)
                        <div class="background">
                          <img src="{{ $imgBanner['url'] }}" alt="{{ $imgBanner['alt'] }}" class="illus">
                        </div>
                    @endif

                </div>
                <div class="container">
                    <h1 class="title-page title-section-1">
                        <span class="small">{{ bcn_pll('Erreur') }}</span>
                        <span class="large">404</span>
                        {{ bcn_pll('Sincèrement désolé !') }}
                    </h1>
                    <div class="txt editor">
                        <p>{!! bcn_pll('La page que vous avez demandée n’existe pas.<br> L’adresse saisie est peut-être incorrecte ou la page peut avoir été déplacée.') !!}</p>
                    </div>
                    <div class="btn-wrapper">
                        <a href="{{ home_url('/') }}"
                           class="btn btn-primary">{{ bcn_pll('Retour à l\'accueil')}}</a>
                    </div>
                </div>{{-- /.container --}}
            </div>{{-- /.content-404 --}}
        </section>
    </main>{{-- /.page-404 --}}

@endsection