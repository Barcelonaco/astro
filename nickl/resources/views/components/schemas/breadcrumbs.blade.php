@php
  // Initialize breadcrumbs array with home
  $breadcrumbs = [
    [
      '@type' => 'ListItem',
      'position' => 1,
      'name' => 'Accueil',
      'item' => home_url('/'),
    ],
  ];

  $position = 2;

  // Don't show breadcrumbs on front page
  if (!is_front_page()) {

    // Single Page
    if (is_page() && !is_front_page()) {
      $page_id = get_the_ID();
      $ancestors = get_post_ancestors($page_id);

      // Reverse to show from parent to child
      $ancestors = array_reverse($ancestors);

      // Add parent pages
      foreach ($ancestors as $ancestor_id) {
        $breadcrumbs[] = [
          '@type' => 'ListItem',
          'position' => $position++,
          'name' => get_the_title($ancestor_id),
          'item' => get_permalink($ancestor_id),
        ];
      }

      // Add current page
      $breadcrumbs[] = [
        '@type' => 'ListItem',
        'position' => $position++,
        'name' => get_the_title(),
        'item' => get_permalink(),
      ];
    }

    // Single Post (Blog article)
    elseif (is_single() && !is_attachment()) {
      $post_type = get_post_type();

      // For standard posts
      if ($post_type === 'post') {
        // Add blog page if set
        $blog_page_id = get_option('page_for_posts');
        if ($blog_page_id) {
          $breadcrumbs[] = [
            '@type' => 'ListItem',
            'position' => $position++,
            'name' => get_the_title($blog_page_id),
            'item' => get_permalink($blog_page_id),
          ];
        }

        // Add main category
        $categories = get_the_category();
        if (!empty($categories)) {
          $main_category = $categories[0];

          // Add parent categories if any
          if ($main_category->parent) {
            $parent_cats = [];
            $parent_id = $main_category->parent;

            while ($parent_id) {
              $parent_cat = get_category($parent_id);
              array_unshift($parent_cats, $parent_cat);
              $parent_id = $parent_cat->parent;
            }

            foreach ($parent_cats as $parent_cat) {
              $breadcrumbs[] = [
                '@type' => 'ListItem',
                'position' => $position++,
                'name' => $parent_cat->name,
                'item' => get_category_link($parent_cat->term_id),
              ];
            }
          }

          $breadcrumbs[] = [
            '@type' => 'ListItem',
            'position' => $position++,
            'name' => $main_category->name,
            'item' => get_category_link($main_category->term_id),
          ];
        }
      }
      // For custom post types
      else {
        $post_type_object = get_post_type_object($post_type);
        if ($post_type_object && $post_type_object->has_archive) {
          $breadcrumbs[] = [
            '@type' => 'ListItem',
            'position' => $position++,
            'name' => $post_type_object->labels->name,
            'item' => get_post_type_archive_link($post_type),
          ];
        }

        // Add taxonomy terms if available
        $taxonomies = get_object_taxonomies($post_type, 'objects');
        foreach ($taxonomies as $taxonomy) {
          if ($taxonomy->public) {
            $terms = get_the_terms(get_the_ID(), $taxonomy->name);
            if (!empty($terms) && !is_wp_error($terms)) {
              $main_term = $terms[0];
              $breadcrumbs[] = [
                '@type' => 'ListItem',
                'position' => $position++,
                'name' => $main_term->name,
                'item' => get_term_link($main_term),
              ];
              break;
            }
          }
        }
      }

      // Add current post
      $breadcrumbs[] = [
        '@type' => 'ListItem',
        'position' => $position++,
        'name' => get_the_title(),
        'item' => get_permalink(),
      ];
    }

    // Category Archive
    elseif (is_category()) {
      $category = get_queried_object();

      // Add parent categories
      if ($category->parent) {
        $parent_cats = [];
        $parent_id = $category->parent;

        while ($parent_id) {
          $parent_cat = get_category($parent_id);
          array_unshift($parent_cats, $parent_cat);
          $parent_id = $parent_cat->parent;
        }

        foreach ($parent_cats as $parent_cat) {
          $breadcrumbs[] = [
            '@type' => 'ListItem',
            'position' => $position++,
            'name' => $parent_cat->name,
            'item' => get_category_link($parent_cat->term_id),
          ];
        }
      }

      $breadcrumbs[] = [
        '@type' => 'ListItem',
        'position' => $position++,
        'name' => $category->name,
        'item' => get_category_link($category->term_id),
      ];
    }

    // Tag Archive
    elseif (is_tag()) {
      $tag = get_queried_object();
      $breadcrumbs[] = [
        '@type' => 'ListItem',
        'position' => $position++,
        'name' => $tag->name,
        'item' => get_tag_link($tag->term_id),
      ];
    }

    // Custom Taxonomy Archive
    elseif (is_tax()) {
      $term = get_queried_object();
      $taxonomy = get_taxonomy($term->taxonomy);

      // Add post type archive if available
      if ($taxonomy->object_type && !empty($taxonomy->object_type)) {
        $post_type = $taxonomy->object_type[0];
        $post_type_object = get_post_type_object($post_type);
        if ($post_type_object && $post_type_object->has_archive) {
          $breadcrumbs[] = [
            '@type' => 'ListItem',
            'position' => $position++,
            'name' => $post_type_object->labels->name,
            'item' => get_post_type_archive_link($post_type),
          ];
        }
      }

      $breadcrumbs[] = [
        '@type' => 'ListItem',
        'position' => $position++,
        'name' => $term->name,
        'item' => get_term_link($term),
      ];
    }

    // Post Type Archive
    elseif (is_post_type_archive()) {
      $post_type = get_query_var('post_type');
      $post_type_object = get_post_type_object($post_type);

      if ($post_type_object) {
        $breadcrumbs[] = [
          '@type' => 'ListItem',
          'position' => $position++,
          'name' => $post_type_object->labels->name,
          'item' => get_post_type_archive_link($post_type),
        ];
      }
    }

    // Author Archive
    elseif (is_author()) {
      $author = get_queried_object();
      $breadcrumbs[] = [
        '@type' => 'ListItem',
        'position' => $position++,
        'name' => 'Auteur : ' . $author->display_name,
        'item' => get_author_posts_url($author->ID),
      ];
    }

    // Date Archive
    elseif (is_date()) {
      if (is_day()) {
        $breadcrumbs[] = [
          '@type' => 'ListItem',
          'position' => $position++,
          'name' => get_the_date('F Y'),
          'item' => get_year_link(get_the_date('Y')),
        ];
        $breadcrumbs[] = [
          '@type' => 'ListItem',
          'position' => $position++,
          'name' => get_the_date(),
          'item' => get_day_link(get_the_date('Y'), get_the_date('m'), get_the_date('d')),
        ];
      } elseif (is_month()) {
        $breadcrumbs[] = [
          '@type' => 'ListItem',
          'position' => $position++,
          'name' => get_the_date('Y'),
          'item' => get_year_link(get_the_date('Y')),
        ];
        $breadcrumbs[] = [
          '@type' => 'ListItem',
          'position' => $position++,
          'name' => get_the_date('F Y'),
          'item' => get_month_link(get_the_date('Y'), get_the_date('m')),
        ];
      } elseif (is_year()) {
        $breadcrumbs[] = [
          '@type' => 'ListItem',
          'position' => $position++,
          'name' => get_the_date('Y'),
          'item' => get_year_link(get_the_date('Y')),
        ];
      }
    }

    // Search Results
    elseif (is_search()) {
      $breadcrumbs[] = [
        '@type' => 'ListItem',
        'position' => $position++,
        'name' => 'Résultats de recherche pour : ' . get_search_query(),
        'item' => get_search_link(),
      ];
    }

    // 404 Page
    elseif (is_404()) {
      $breadcrumbs[] = [
        '@type' => 'ListItem',
        'position' => $position++,
        'name' => 'Page introuvable',
        'item' => home_url($_SERVER['REQUEST_URI']),
      ];
    }
  }

  $data = [
    '@context' => 'https://schema.org',
    '@type' => 'BreadcrumbList',
    'itemListElement' => $breadcrumbs,
  ];
@endphp
@if (count($breadcrumbs) > 1)
  <script type="application/ld+json">
  {!! json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) !!}
  </script>
@endif