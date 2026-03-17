@php
  use App\Helpers\GlobalHelper;

  $file = GlobalHelper::getImageOrReplacement('', $item['file']['ID']);

@endphp

@if (!empty($item['title']) || !empty($item['catchphrase']) || (!$module['clickable_block'] && (!empty($item['primary_link']) || !empty($item['secondary_link']))))
  <div class="item has-desc {{ $orientation == false ? 'landscape' : '' }}" role="article">
    @else
  <div class="item no-desc {{ $orientation == false ? 'landscape' : '' }}" role="article">
@endif

        @if (!$module['clickable_block'])
          <div class="item-content">
            @else
              @if (!empty($item['primary_link']['url']))
                <a href="{{ $item['primary_link']['url'] ?? '#' }}"
                   class="item-content"
                   target="{{ $item['primary_link']['target'] ?? '_self' }}"
                   rel="bookmark">
                  @endif
                  @endif

                  @if (in_array($item['file']['mime_type'], ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']))
                    <div class="illus-wrapper">
                      @if (count($list_items) < 2)
                        <img src="{{ $item['file']['url'] }}" alt="" class="illus">
                      @else
                        <img src="{{ $item['file']['url'] }}" alt="" class="illus">
                      @endif
                      <div class="overlay">
                        <span class="icon" aria-hidden="false"><?= GlobalHelper::displaySvg('eye.svg') ?></span>
                          <?= bcn_pll('En savoir plus') ?>
                      </div>
                    </div>
                  @elseif (in_array($item['file']['mime_type'], ['video/mp4', 'video/quicktime', 'video/mpeg']))
                    <div class="video-wrapper">
                      <video class="background-video" autoplay loop muted playsinline>
                        <source src="{{ $item['file']['url'] }}" type="video/mp4">
                      </video>
                      <div class="overlay">
                        <span class="icon" aria-hidden="false"><?= GlobalHelper::displaySvg('eye.svg') ?></span>
                          <?= bcn_pll('En savoir plus') ?>
                      </div>
                    </div>
                  @endif

                  @if (!empty($item['title']) || !empty($item['catchphrase']) || !$module['clickable_block'])
                    <div class="desc">
                      @if (!empty($item['title']))
                        <h3 class="title">{{ $item['title'] }}</h3>
                      @endif
                      @if (!empty($item['catchphrase']))
                        <div class="editor txt">
                          <p>{{ $item['catchphrase'] }}</p>
                        </div>
                      @endif

                      @if (!$module['clickable_block'] && (!empty($item['primary_link']) || !empty($item['secondary_link'])))
                        <div class="btn-wrapper">
                          @if (!empty($item['primary_link']['url']))
                            <a href="{{ $item['primary_link']['url'] }}"
                               class="btn btn-primary"
                               target="{{ $item['primary_link']['target'] ?? '_self' }}">
                              {{ $item['primary_link']['title'] }}
                            </a>
                          @endif
                          @if (!empty($item['secondary_link']['url']))
                            <a href="{{ $item['secondary_link']['url'] }}"
                               class="btn btn-secondary"
                               target="{{ $item['secondary_link']['target'] ?? '_self' }}">
                              {{ $item['secondary_link']['title'] }}
                            </a>
                          @endif
                        </div>
                      @endif
                    </div>
              @endif

              @if (!$module['clickable_block'])
          </div>
          @else
            @if (!empty($item['primary_link']['url']))
              </a>
        @endif
        @endif
      </div>
