@if (has_nav_menu('header-secondary-navigation'))
    {!! wp_nav_menu(['theme_location' => 'header-secondary-navigation', 'container_class' => 'menu-wrapper', 'depth' => 1]) !!}
@endif
