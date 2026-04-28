<div id="{{ isset($columns) ? '' : $id_bloc }}" class="module module-before-after @if ($module['orientation'] == 'vertical') is-vertical @else is-horizontal @endif {{ isset($columns) ? '' : $classes }}">

  @if (!empty($backgroundImage) && !isset($columns))
    <div class="background"
      style="background-image: url({{ $backgroundImage['url'] }}); opacity: {{ $backgroundImage['opacity'] }};">
    </div>
  @endif

  @if (!isset($columns))
  <div class="container">
    @if (!empty($title_bloc))
      <h2 class="title-module title-section-2">{{ $title_bloc }}</h2>
    @endif
  @endif

    @if (!empty($module['image_before']) && !empty($module['image_after']))
      <div class="ba-wrapper" style="position:relative; width:100%; max-width:1100px; margin:0 auto; overflow:hidden; user-select:none; touch-action:none; cursor:grab;">
        <img src="{{ $module['image_before']['sizes']['banner'] ?? $module['image_before']['url'] }}" alt="{{ $module['image_before']['alt'] ?? '' }}" class="ba-before" style="display:block; width:100%; height:auto; pointer-events:none;">

        <div class="ba-after" aria-hidden="true" style="position:absolute; inset:0; overflow:hidden; clip-path: @if ($module['orientation'] == 'vertical') inset(0 0 50% 0) @else inset(0 50% 0 0) @endif;">
          <img src="{{ $module['image_after']['sizes']['banner'] ?? $module['image_after']['url'] }}" alt="{{ $module['image_after']['alt'] ?? '' }}" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; pointer-events:none;">
        </div>

        @if (!empty($module['show_labels']))
          <span class="ba-label ba-label-before" style="position:absolute; bottom:16px; left:16px; padding:6px 14px; background:rgba(0,0,0,.6); color:#fff; font-size:.85em; border-radius:4px; pointer-events:none; z-index:1;">{{ $module['label_before'] ?? 'Avant' }}</span>
          <span class="ba-label ba-label-after" style="position:absolute; bottom:16px; right:16px; padding:6px 14px; background:rgba(0,0,0,.6); color:#fff; font-size:.85em; border-radius:4px; pointer-events:none; z-index:1;">{{ $module['label_after'] ?? 'Après' }}</span>
        @endif

        <div class="ba-handle" aria-hidden="true" style="position:absolute; background:#fff; box-shadow:0 0 0 1px rgba(0,0,0,.15), 0 4px 12px rgba(0,0,0,.25); pointer-events:none; z-index:2; @if ($module['orientation'] == 'vertical') left:0; right:0; top:50%; height:2px; transform:translateY(-50%); @else top:0; bottom:0; left:50%; width:2px; transform:translateX(-50%); @endif"></div>
        <div class="ba-knob" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:44px; height:44px; border-radius:50%; background:#fff; box-shadow:0 0 0 1px rgba(0,0,0,.15), 0 4px 12px rgba(0,0,0,.3); z-index:3;"></div>
      </div>
    @else
      <p style="text-align:center; opacity:0.5;">Sélectionnez 2 images pour afficher l'aperçu.</p>
    @endif
  @if (!isset($columns))
  </div>
  @endif
</div>
