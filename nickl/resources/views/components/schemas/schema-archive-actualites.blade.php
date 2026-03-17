@php
    $data = [
        "@context" => "https://schema.org",
        "@type" => "CollectionPage",
        "name" => "Actualités de " . get_bloginfo('name'),
        "description" => "Toutes les actualités de " . get_bloginfo('name')
    ];
@endphp

<script type="application/ld+json">
{!! json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) !!}
</script>