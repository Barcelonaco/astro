@php
    use App\Posttype\CptNews;
    use App\Helpers\ThemeHelper;
    use App\Helpers\NewsHelper;
    $cptSlug = new CptNews();
    $term = get_queried_object();
    $data = NewsHelper::getNews($term, 0, -1);
    $terms = NewsHelper::getTerms();
    $termLongDesc = get_term_meta($term->term_id, 'short_description', true);
    $imgBanner = get_field('header_img', 'options_' . $cptSlug->getSlug());
@endphp

@extends('layouts.app')
@section('content')
    @if (!empty($imgBanner))
        @include('modules.banner', ['h1_in_header' => get_field('h1_in_header')])
    @endif
    <main id="main" class="main-page page-archive-news js_actu-container" role="main">
        <section>
            @if (get_field('show_breadcrumb', 'options') && function_exists('yoast_breadcrumb'))
              @include('components.breadcrumb')
            @endif
            <div class="container-large">

                @if (empty($imgBanner))
                    <h1 class="title-page title-section-2">{!! ThemeHelper::title() . ' > ' . $term->name !!}</h1>
                @endif

                @if (!empty($term->description))
                    <div class="txt editor desc">{!! $term->description !!}</div>
                @endif

                @if ($data['posts'])

                    <ul class="list-single js_list-actu">

                        @foreach ($data['posts'] as $actu)
                            @if(is_array($actu))
                                {!! view('components.preview-actualites', ['post' => $actu])->render() !!}
                            @else
                                {!! view('components.preview-actualites', ['pid' => $actu->ID])->render() !!}
                            @endif
                        @endforeach

                    </ul>{{-- /.list-single --}}

                    @if ($data['max_pages'] >= $data['next_page'])
                        <div class="btn-more-wrapper js_list-pagination">
                            <button type="button"
                                    class="btn btn-tertiary js_load-more"
                                    data-page="{{ $data['next_page'] }}">{{ bcn_pll('Voir plus d\'actualités') }}</button>
                        </div>
                    @endif
                @endif

            </div>{{-- /.container-large --}}
            <div class="container-large">
                @if (!empty($termLongDesc))
                <div class="txt editor desc">
                    {!! wpautop($termLongDesc) !!}
                </div>
                @endif
            </div>
        </section>
    </main>{{-- /.page-archive-news-taxo --}}

@endsection