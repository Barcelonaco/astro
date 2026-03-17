<?php

return [
    'default' => env('CACHE_DRIVER', 'file'),

    'stores' => [
        'file' => [
            'driver' => 'file',
            'path' => '/var/www/html/Nickl/web/app/cache/acorn/framework/cache',
        ],
    ],
];
