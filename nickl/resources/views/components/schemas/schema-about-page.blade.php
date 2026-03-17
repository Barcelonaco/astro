@php
  $type = env('NICKL_PDV') === "PDV" ? 'Mairie' : 'Organization';
  $data = [
    "@context" => "https://schema.org",
    "@type" => $type,
    "name" => $schema['schema_name'] ?? get_bloginfo('name'),
    "description" => $schema['schema_description'] ?? get_bloginfo('description'),
    "mainEntity" => [
      "@type" => $type,
      "name" => $schema['schema_name'] ?? get_bloginfo('name')
    ]
  ];
@endphp

<script type="application/ld+json">
{!! json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) !!}
</script>