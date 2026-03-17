@php
    $data = [
        "@context" => "https://schema.org",
        "@type" => "WebSite",
        "name" => get_bloginfo('name'),
        "url" => home_url('/'),
        "description" => get_bloginfo('description'),
        "publisher" => [
            "@type" => "Organization",
            "name" => get_bloginfo('name'),
        ],
    ];
@endphp

<script type="application/ld+json">
{!! json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) !!}
</script>