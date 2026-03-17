<?php

add_filter('acym_get_files', function($files, $folder, $pattern) {
    return is_array($files) ? $files : [];
}, 10, 3);
