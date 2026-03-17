@php
  $data = [
    "@context" => "https://schema.org",
    "@type" => "CollectionPage",
    "name" => "Références de " . get_bloginfo('name'),
    "description" => "Toutes les références de " . get_bloginfo('name')
  ];
@endphp

<script type="application/ld+json">
{!! json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) !!}
</script>