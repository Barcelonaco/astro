<div class="module module-portfolio-grid {{ $classes ?? '' }}">
  <div class="container">
    @if(!empty($block_title))
      <h2 class="module-title">{{ $block_title }}</h2>
    @endif
    <div class="portfolio-grid-list">
      @if(!empty($module['projects']))
        @foreach($module['projects'] as $project)
          <div class="portfolio-item">
            @if(!empty($project['image']))
              <div class="portfolio-image">
                <img src="{{ $project['image']['url'] ?? '' }}" alt="{{ $project['title'] ?? '' }}">
              </div>
            @endif
            <div class="portfolio-info">
              <h3>{{ $project['title'] ?? '' }}</h3>
              @if(!empty($project['client']))
                <p class="portfolio-client">{{ $project['client'] }}</p>
              @endif
            </div>
          </div>
        @endforeach
      @endif
    </div>
  </div>
</div>
