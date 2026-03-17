<?php 

  // Récupération du type de header
  $headerType = get_field('header_type') ?? 'default';
 
?>
<div class="page-header">

@if($headerType === 'hero')
  @include('modules.hero')
@elseif($headerType === 'banner')
{!! $title !!}
  @include('modules.banner')
@else
@endif
</div>
