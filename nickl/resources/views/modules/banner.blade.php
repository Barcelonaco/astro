<div id="{{ $number ?? 'section_0' }}"
    class="module module-banner-page{{ $titleInHeader ? '' : ' hide_banner_title' }}{{ $heightBanner ? ' ' . $heightBanner : ' small' }}{{ $title_size ? ' h1-' . $title_size : '' }}">
    @if ($heightBanner !== 'none' && $imgBanner)
        <div class="background">
            <img src="{{ $imgBanner['url'] }}" fetchpriority="high"
                alt="{{ get_post_meta(get_post_thumbnail_id($id), '_wp_attachment_image_alt', true) }}" class="illus">
        </div>
    @endif
    @if (($isWooCommercePage && $heightBanner !== 'none') || !$isWooCommercePage)
        <div class="container-large">
            <div class="desc">
                @if ($titleInHeader !== 'hideTitle')
                    @if ($h1InHeader === 'yes')
                        <h1 class="title title-section-1">{!! $term ? $term : $title !!}</h1>
                    @else
                        <p class="title title-section-1">{!! $term ? $term : $title !!}</p>
                    @endif
                @endif
            </div>
        </div>{{-- /.container-large --}}
    @endif
</div>{{-- /.module-banner-page --}}