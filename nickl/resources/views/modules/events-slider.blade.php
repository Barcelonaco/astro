@php
    use App\Helpers\GlobalHelper;
    use App\Helpers\EventsHelper;
    use App\Taxonomy\TaxoEventsType;
    use App\Posttype\CptEvents;

    $taxoType = new TaxoEventsType();
    $cptEvents = new CptEvents();
    $imagesRatio = get_option('options_evenements_images_ratio');

    if (!empty($backgroundImage)) {
        if(isset($reusable_bloc) && !empty($reusable_bloc)) {
            $background_image = GlobalHelper::displayBackground($backgroundImage['url']);
        } else {
            $background_image = 'background-image: url('. e($backgroundImage['url']) .')';
        }
    }

    if (isset($columns) && $columns == 'module-in-column') {
        $id_bloc = '';
    }
    $hasAutoPosts = is_array($posts) && !empty($posts['posts']);
    $isManual = !empty($module['is_manual']) && !empty($module['events_id']);
@endphp

<div id="{{ $id_bloc }}"
    class="module module-event-slider @if(!isset($columns) || $columns == 0) {{  $classes }} @endif">

    @if (!empty($backgroundImage) && !isset($columns))
        <div class="background"
            style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
        </div>
    @endif

    <div class="container-large">

        @if (!isset($columns))
            @include('components.bloc-title-module', [
                'title_bloc' => $title_bloc,
                'title_style' => $title_style,
                'title_align' => $title_align,
            ])
        @endif

        @if ($hasAutoPosts || $isManual)

            <div class="slider-wrapper">
                <div
                    class="swiper slider js_events-slider columns-{{ $hasAutoPosts ? count($posts['posts']) : null }} {{ $imagesRatio ? $imagesRatio : '' }}">
                    <div class="swiper-wrapper">
                        @if ($module['is_manual'] == 1 && !empty($module['events_id']))
                            @foreach($module['events_id'] as $event)
                                <?php            $post = get_post($event); ?>
                                {!! view('components.preview-events', ['post' => $post, 'imagesRatio' => $imagesRatio])->render() !!}
                            @endforeach
                        @else
                            @foreach($posts['posts'] as $event)
                                {!! view('components.preview-events', ['post' => $event, 'imagesRatio' => $imagesRatio])->render() !!}
                            @endforeach
                        @endif
                    </div>{{-- /.swiper-wrapper --}}
                </div>{{-- /.slider --}}
                <button type="button" class="slider-navigation prev"></button>
                <button type="button" class="slider-navigation next"></button>
            </div>{{-- /.slider-wrapper --}}

        @else
            <p>Il n'y a aucun événement à venir pour le moment.</p>
        @endif

        @if (($module['display_archive_link']))
            <div class="btn-more-wrapper">
                <a href="{{ get_post_type_archive_link($cptEvents->getSlug()) }}"
                    class="btn btn-tertiary events-link">{{ !empty($module['archive_link_label']) ? $module['archive_link_label'] : bcn_pll('Voir tous les évènements') }}</a>
            </div>{{-- /.btn-more-wrapper --}}
        @endif
    </div>{{-- /.container-large --}}
</div>{{-- /.module-event --}}
