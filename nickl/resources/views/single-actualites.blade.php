@php
  use App\Helpers\GlobalHelper;
  use App\Helpers\ThemeHelper;
  use App\Helpers\NewsHelper;
  use App\Taxonomy\TaxoNewsCategory;

  $isWebLex = $isWebLex ?? false;
  $pid = $isWebLex ? $post['id'] : get_the_ID();
  $taxoSlug = new TaxoNewsCategory();
  $data = $isWebLex ? NewsHelper::getNewsFromWebLex(null, 0, -1) : NewsHelper::getNews(null, 0, -1);
  $h1InHeader = $isWebLex ? true : ThemeHelper::getH1InHeader($pid);
  $titleInHeader = $isWebLex ? true : ThemeHelper::getTitleInHeader($pid);
  $bg = $isWebLex ? ['url' => $post['image'] ?? ''] : ['url' => (get_the_post_thumbnail_url($pid) ? get_the_post_thumbnail_url($pid, 'banner') : '')];
  $prevId = null;
  $nextId = null;

  foreach ($data['posts'] as $k => $item) {
    $itemId = $isWebLex ? $item['id'] : $item->ID;
    if ($itemId == $pid) {
      if (isset($data['posts'][$k - 1])) {
        $prevId = $data['posts'][$k - 1];
      }
      if (isset($data['posts'][$k + 1])) {
        $nextId = $data['posts'][$k + 1];
      }
      break;
    }
  }

  if ($prevId && $nextId) {
    $justify = 'space-between';
  } elseif (!$prevId && $nextId) {
    $justify = 'flex-end';
  } else {
    $justify = 'flex-start';
  }
  $showBreadcrumb = get_field('show_breadcrumb', 'options') && function_exists('yoast_breadcrumb');
  $showShareBtn = get_field('pages_share_btn', 'options') && !get_field('share_btn_position', 'options');
@endphp

@extends('layouts.app')

@section('content')

  <main id="main" class="main-page page-single-news" role="main">
    <section>
      @if ($showBreadcrumb || $showShareBtn)
        <div class="container sub-header">
          @if ($showBreadcrumb)
            @include('components.breadcrumb')
          @endif

          @if ($showShareBtn)
            @include('modules.share', ['share_btn_position' => 'top'])
          @endif
        </div>
      @endif
      <article>
        <div class="head">
          <div class="container">
            <div class="category">
              @if ($isWebLex)
                {{ $post['rubrique'] ?? 'PETITE HISTOIRE DU JOUR' }}
              @else
                {{ GlobalHelper::getTerms($pid, $taxoSlug->getSlug()) }}
              @endif
            </div>
            @if ($titleInHeader !== 'hideTitle')
              @if ($h1InHeader === 'yes')
                <h1 class="title title-section-1">
                  {!! $isWebLex ? $post['title'] : NewsHelper::title($pid) !!}
                </h1>
              @else
                <p class="title title-section-1">
                  {!! $isWebLex ? $post['title'] : NewsHelper::title($pid) !!}
                </p>
              @endif
            @endif

            <time class="date">
              {{ $isWebLex ? date('d/m/Y', strtotime($post['created'])) : get_the_date('d/m/Y', $pid) }}
            </time>

            @if ($bg && !empty($bg['url']))
              <div class="illus-wrapper">
                <img src="{{ $bg['url'] }}"
                     alt="{{ $isWebLex ? $post['title'] : get_post_meta(get_post_thumbnail_id($pid), '_wp_attachment_image_alt', TRUE) }}"
                     class="illus">
              </div>
            @endif
          </div>
        </div>

        @if($isWebLex)
          <div id="" class="module module-text no-background-color padding-top-small">
            <div class="container">
              <div class="txt editor"
                   style="translate: none; rotate: none; scale: none; opacity: 1; transform: translate(0px, 0px);">
                {!! $post['content'] !!}
              </div>
            </div>
          </div>
        @else

          @if(is_array($modules) && count($modules) > 0)
            @foreach($modules as $module)
              @if(isset($module['acf_fc_layout']) && !empty($module['acf_fc_layout']) && ($module['is_visible'] ?? 'yes') !== 'no')
                @php
                  try {
                @endphp
                  @includeIf('modules.' . $module['acf_fc_layout'], ['module' => $module, 'number' => 'section_' . $loop->iteration])
                @php
                  } catch (\Throwable $e) {
                    if (defined('WP_DEBUG') && WP_DEBUG) {
                      echo '<!-- MODULE ERROR ['.$module['acf_fc_layout'].']: '.esc_html($e->getMessage()).' -->';
                      error_log('Module render error ['.$module['acf_fc_layout'].']: '.$e->getMessage().' in '.$e->getFile().':'.$e->getLine());
                    }
                  }
                @endphp
              @endif
            @endforeach
          @endif
        @endif

        @if ($prevId || $nextId)
          <div class="container">
            <div class="btn-wrapper {{ $justify }}">
              @if ($prevId)
                @php
                  if ($isWebLex) {
                    $prevPost = NewsHelper::getSingleWebLex($prevId['id']);
                    if(isset($prevPost['url']) && !empty($prevPost['url'])) {
                      $urlWeblex = $prevPost['url'];
                      $urlWeblex = str_contains($urlWeblex, 'https://www.weblex.fr/') ? explode('https://www.weblex.fr/weblex-actualite', $urlWeblex)[1] : explode('la-petite-histoire-du-jour', $urlWeblex)[1];
                      $prevUrlWeblex = home_url() . '/actualites/weblex/' . $urlWeblex;
                    }
                    else{
                      $prevUrlWeblex = home_url() . '/actualites';
                    }
                  }

                  $prevUrl = $isWebLex ? $prevUrlWeblex : get_permalink($prevId->ID);
                  $prevTitle = $isWebLex ? $prevPost['title'] : NewsHelper::title($prevId->ID);
                @endphp
                <a href="{{ $prevUrl }}" class="btn btn-tertiary prev">
                  < {!! $prevTitle !!}
                </a>
              @endif

              @if ($nextId)
                @php
                  if ($isWebLex) {
                    $nextPost = NewsHelper::getSingleWebLex($nextId['id']);
                    if(isset($nextPost['url']) && !empty($nextPost['url'])) {
                      $urlWeblex = $nextPost['url'];
                      $urlWeblex = str_contains($urlWeblex, 'https://www.weblex.fr/') ? explode('https://www.weblex.fr/weblex-actualite', $urlWeblex)[1] : explode('la-petite-histoire-du-jour', $urlWeblex)[1];
                      $nextUrlWeblex = home_url() . '/actualites/weblex/' . $urlWeblex;
                    }
                    else{
                      $nextUrlWeblex = home_url() . '/actualites';
                    }
                  }

                  $nextUrl = $isWebLex ? $nextUrlWeblex : get_permalink($nextId->ID);
                  $nextTitle = $isWebLex ? $nextPost['title'] : NewsHelper::title($nextId->ID);
                @endphp
                <a href="{{ $nextUrl }}" class="btn btn-tertiary next">{!! $nextTitle !!} ></a>
              @endif
            </div>
          </div>
        @endif        
      </article>

      @include('modules.share')
      
    </section>
  </main>

@endsection
