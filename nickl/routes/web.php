<?php

use Illuminate\Support\Facades\Route;
use App\Helpers\NewsHelper;



Route::any('/actualites/weblex/{slug}', function ($slug) {
    $post = NewsHelper::getSingleWebLexBySlug($slug);

    if (!$post) {
        abort(404);
    }
    return view('single-actualites', [
        'post' => $post,
        'isWebLex' => true,
    ]);

})->name('weblex.single');
