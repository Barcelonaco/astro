@if (has_nav_menu('header-primary-navigation')) 
    <div class="menu-wrapper">
        {!! wp_nav_menu(['theme_location' => 'header-primary-navigation', 'container_class' => 'menu-wrapper', 'depth' => 3]) !!}
    </div>
@endif
