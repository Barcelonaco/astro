@php
    use App\Helpers\SearchHelper as SearchH;
    use App\Helpers\Helper as Helper;
    $args = [
            's' => get_query_var('s') ? get_query_var('s') : null,
            'relevanssi' => true
    ];

    $datas = new WP_Query($args);
    $datas->parse_query($args);
    relevanssi_do_query($datas);
    $resultWord = (int) $datas->found_posts > 1 ? 'résultats' : 'résultat';
@endphp
@extends('layouts.app')

@section('content')

    <main id="main" class="main-page page-search" role="main">
        <section>
            <div class="container">

                <h1 class="title-page title-section-2">{{ bcn_pll('Votre recherche') }}</h1>

                <p class="nbr-results">{{ (int) $datas->found_posts }} {{ bcn_pll($resultWord . ' pour') }}
                    "{{ esc_html( get_search_query() ) }}"</p>

                @if (!have_posts())

                    <div class="no-results">
                        <div class="txt editor">
                            <p><b>{{ bcn_pll('Aucun résultat ne correspond à votre recherche.') }}</b></p>
                        </div> {{-- /.txt--}}
                        <div class="btn-wrapper">
                            <button type="button"
                                    class="btn btn-primary js_btn-toggle-search">{{ bcn_pll('Effectuer une nouvelle recherche') }}</button>
                        </div>
                    </div>{{-- /.no-results--}}

                @else

                    <ul class="list-results">
                        @while ( have_posts() )
                            @php
                                the_post();
                                $pid = get_the_ID();
                            @endphp
                            <li class="item" role="article">
                                <a href="{{ get_permalink($pid) }}" class="link" rel="bookmark">
                                    @if (has_post_thumbnail($pid))
                                        <div class="illus-wrapper">
                                            <img src="{{ get_the_post_thumbnail_url($pid, 'half') }}" alt="{{ get_post_meta(get_post_thumbnail_id($pid), '_wp_attachment_image_alt', TRUE) }}" class="illus">
                                        </div>
                                    @endif
                                    <div class="desc">
{{--                                        <p class="category">Catégorie</p>--}}
                                        <h2 class="title title-section-3">{!! html_entity_decode(get_the_title($pid)) !!}</h2>
                                        <div class="editor txt">
                                            <p>{!! get_the_excerpt($pid) !!}</p>
                                        </div>
                                        <div class="btn-wrapper">
                                            <span class="fake-link btn btn-tertiary">{{ bcn_pll('Lire l\'article') }}</span>
                                        </div>
                                        <time class="date">{{ get_the_date('d/m/Y', $pid) }}</time>
                                    </div>{{-- /.desc--}}
                                </a>{{-- /.link--}}
                            </li>{{-- /.item--}}
                        @endwhile


                    </ul>{{-- /.list-results--}}

                @endif

                @php
                    SearchH::searchPagination();
                @endphp

            </div> {{-- /.container--}}
        </section>
    </main> {{-- /.page-search --}}

@endsection
