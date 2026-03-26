<?php

function generate_slug(string $text): string {
    $slug = mb_strtolower($text, 'UTF-8');
    // Transliterate common accented characters
    $slug = transliterator_transliterate('Any-Latin; Latin-ASCII; Lower()', $slug) ?: $slug;
    // Replace non-alphanumeric with hyphens
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);
    // Trim hyphens
    return trim($slug, '-');
}
