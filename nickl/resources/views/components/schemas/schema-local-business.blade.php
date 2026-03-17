@php
  // Récupération des données ACF

  $address = $schema['schema_address'] ?? [];
  $address = get_field('address', 'option');


  // Construction du tableau sameAs
  $sameAsArray = array_filter([
    get_field('facebook', 'option') ?? '',
    get_field('instagram', 'option') ?? '',
    get_field('twitter', 'option') ?? '',
    get_field('tiktok', 'option') ?? '',
    get_field('youtube', 'option') ?? '',
    get_field('tripadvisor', 'option') ?? '',
    get_field('pinterest', 'option') ?? '',
    get_field('linkedin', 'option') ?? '',
  ]);

  $data = [
    "@context" => "https://schema.org",
    "@type" => "FAQPage",
    "url" => get_permalink(),
    "name" => $schema['schema_name'] ?? get_bloginfo('name'),
    "telephone" => $schema['schema_phone'] ?? get_field('phone', 'option'),
    "address" => [
      "@type" => "PostalAddress",
      "streetAddress" => $schema['schema_address']['address'] ?? $address['address'],
      "addressLocality" => $schema['schema_address']['city'] ?? $address['city'],
      "addressRegion" => $schema['schema_address']['state'] ?? $address['state'],
      "postalCode" => $schema['schema_address']['post_code'] ?? $address['post_code'],
      "addressCountry" => $schema['schema_address']['country_short'] ?? $address['country_short']
    ],
    "geo" => [
      "@type" => "GeoCoordinates",
      "latitude" => $schema['schema_address']['lat'] ?? $address['lat'],
      "longitude" => $schema['schema_address']['lng'] ?? $address['lng']
    ],
    "openingHours" => $schema['schema_opening'] ?? '',
    "sameAs" => $sameAsArray
  ];

  $data = array_filter($data, function ($value) {
    return !empty($value) || $value === 0;
  });
@endphp
<script type="application/ld+json">
{!! json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) !!}
</script>