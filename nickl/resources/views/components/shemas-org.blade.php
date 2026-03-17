@include('components.schemas.breadcrumbs')

@if(is_post_type_archive('actualites'))
  @include('components.schemas.schema-archive-actualites')
@endif

@if(is_post_type_archive('evenements'))
  @include('components.schemas.schema-archive-evenements')
@endif

@if(is_post_type_archive('references'))
  @include('components.schemas.schema-archive-references')
@endif

@php
  $schema = get_field('flexible_schemas') ?? [];
@endphp

@if(!empty($schema))
  @if($schema[0]['acf_fc_layout'] == 'organisation')
    @include('components.schemas.schema-org', ['schema' => $schema[0]])
  @elseif($schema[0]['acf_fc_layout'] == 'faq')
    @include('components.schemas.schema-faq', ['schema' => $schema[0]])
  @elseif($schema[0]['acf_fc_layout'] == 'contactPage')
    @include('components.schemas.schema-contact-page', ['schema' => $schema[0]])
  @elseif($schema[0]['acf_fc_layout'] == 'aboutPage')
    @include('components.schemas.schema-about-page', ['schema' => $schema[0]])
  @else
    @include('components.schemas.schema-website', ['schema' => $schema[0]])
  @endif
@else
  @include('components.schemas.schema-website')
@endif
