@php
    use App\Helpers\GooglePlacesHelper;
    use App\Helpers\GlobalHelper;

    // Si on est dans une colonne, $id peut être vide
    if (isset($columns) && $columns == 'module-in-column') {
        $id_bloc = '';
    } else {
        $id_bloc = $id ?? '';
    }

    $reviewsData = [];
    $reviews = [];
    $rating = 0;
    $total = 0;
    $error = null;

    // Récupération des données ACF
    $placeId = $module['place_id'] ?? '';
    // Gestion du cas où $module est un array ACF standard
    if (isset($google_reviews) && is_array($google_reviews)) {
         $placeId = $google_reviews['place_id'] ?? $placeId;
         $limit = $google_reviews['limit'] ?? 5; // Default higher for slider
         $minRating = $google_reviews['min_rating'] ?? 4;
    } else {
         $limit = $module['limit'] ?? 5;
         $minRating = $module['min_rating'] ?? 4;
    }

    if (!empty($placeId)) {
        $reviewsData = GooglePlacesHelper::getReviews($placeId);

        if (isset($reviewsData['error'])) {
            $error = $reviewsData['error'];
        } else {
            $reviews = $reviewsData['reviews'] ?? [];
            $rating = $reviewsData['rating'] ?? 0;
            $total = $reviewsData['user_ratings_total'] ?? 0;

            // Filtrage et Limitation
            if (!empty($reviews) && is_array($reviews)) {
                $reviews = array_filter($reviews, function($review) use ($minRating) {
                    return isset($review['rating']) && $review['rating'] >= $minRating;
                });
                $reviews = array_slice($reviews, 0, intval($limit));
            }
        }
    }
@endphp

<div id="{{ $id_bloc }}" class="module module-google-reviews {{ $classes ?? '' }}">

    {{-- Fond d'écran standard --}}
    @if (!empty($backgroundImage) && !isset($columns))
        <div class="background"
            style="{{ GlobalHelper::displayBackground($backgroundImage['url'] ?? '')}}; opacity: {{ e($backgroundImage['opacity'] ?? 1) }};">
        </div>
    @endif

    <div class="container-large">
        @if (!empty($title_bloc))
          @include('components.bloc-title-module', [
              'title_bloc' => $title_bloc,
              'title_style' => $title_style ?? '2',
              'title_align' => $title_align ?? 'center',
          ])
        @endif

        @if($error)
           <div class="alert alert-warning" style="color: red; text-align: center;">
               {{ $error }}
           </div>
        @elseif(empty($placeId))
            <p style="text-align: center;">Veuillez configurer un Place ID dans les paramètres du module.</p>
        @elseif(empty($reviews) && !$error)
           <p style="text-align: center;">Aucun avis ne correspond à vos critères pour le moment.</p>
        @else
            <div class="google-reviews-header">
                <div class="rating-badge">
                    <span class="score">{{ $rating }}</span>
                    <span class="stars">
                        @for($i=1; $i<=5; $i++)
                            @if($i <= round($rating)) ★ @else ☆ @endif
                        @endfor
                    </span>
                    <span class="total">({{ $total }} avis)</span>
                </div>
                <div class="powered-by">
                     <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png" alt="Powered by Google" loading="lazy" width="144" height="18">
                </div>
            </div>

            <div class="reviews-slider-wrapper">
                <div class="swiper js_google-reviews-slider">
                    <div class="swiper-wrapper">
                        @foreach($reviews as $review)
                            <div class="swiper-slide review-card">
                                <div class="review-header">
                                    <img src="{{ $review['profile_photo_url'] }}" alt="{{ $review['author_name'] }}" class="author-photo" loading="lazy">
                                    <div class="author-info">
                                        <p class="author-name">{{ $review['author_name'] }}</p>
                                        <div class="review-meta">
                                            <span class="stars-sm">
                                                @for($i=1; $i<=5; $i++)
                                                    @if($i <= $review['rating']) ★ @else ☆ @endif
                                                @endfor
                                            </span>
                                            <span class="time">{{ $review['relative_time_description'] }}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="review-body">
                                    <div class="review-text-content">
                                        {{ $review['text'] }}
                                    </div>
                                    @if(strlen($review['text']) > 150)
                                        <button class="read-more-btn">Lire plus</button>
                                    @endif
                                </div>
                            </div>
                        @endforeach
                    </div>
                </div>
                {{-- Navigation --}}
                <div class="google-reviews-nav prev"></div>
                <div class="google-reviews-nav next"></div>
                <div class="google-reviews-pagination"></div>
            </div>
        @endif
    </div>
</div>

<style>
/* Module Google Reviews Styles */
.module-google-reviews .google-reviews-header {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 10px;
    margin-bottom: 30px;
}
.module-google-reviews .rating-badge {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1.2rem;
    flex-wrap: wrap;
    justify-content: center;
}
.module-google-reviews .rating-badge .score {
    font-size: 2.5rem;
    font-weight: bold;
    color: #ebb30e;
}
.module-google-reviews .rating-badge .stars {
    color: #ebb30e;
    font-size: 1.5rem;
    letter-spacing: 2px;
}

/* Slider Styles */
.module-google-reviews .reviews-slider-wrapper {
    position: relative;
    padding: 0 40px; /* Space for arrows */
}
.module-google-reviews .swiper {
    padding-bottom: 40px; /* Space for pagination */
    padding-top: 10px; /* Space for shadow header */
}
.module-google-reviews .review-card {
    background: #fff;
    padding: 25px;
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.08); /* Slightly stronger shadow */
    display: flex;
    flex-direction: column;
    height: auto;
    border: 1px solid #f0f0f0;
}

.module-google-reviews .review-header {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 15px;
    border-bottom: 1px solid #eee;
    padding-bottom: 15px;
}
.module-google-reviews .author-photo {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    object-fit: cover;
}
.module-google-reviews .author-name {
    font-weight: bold;
    margin: 0;
    font-size: 1rem;
    line-height: 1.2;
}
.module-google-reviews .review-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.85rem;
    color: #666;
    margin-top: 5px;
}
.module-google-reviews .stars-sm {
    color: #ebb30e;
    letter-spacing: 1px;
}

.module-google-reviews .review-body {
    flex-grow: 1;
    position: relative;
}

/* Read More Logic */
.module-google-reviews .review-text-content {
    font-size: 0.95rem;
    line-height: 1.6;
    color: #333;
    overflow: hidden;
    max-height: 100px; /* Limit height initially */
    transition: max-height 0.3s ease;
}
.module-google-reviews .review-text-content.expanded {
    max-height: none;
}
.module-google-reviews .read-more-btn {
    background: none;
    border: none;
    color: var(--color-primary, #007bff);
    font-weight: bold;
    cursor: pointer;
    padding: 0;
    margin-top: 10px;
    font-size: 0.9rem;
    text-decoration: underline;
}

.module-google-reviews .powered-by img {
    opacity: 0.8;
}

/* Navigation Replacements (Matches your theme arrows hopefully) */
.module-google-reviews .google-reviews-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    width: 40px;
    height: 40px;
    cursor: pointer;
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
}
.module-google-reviews .google-reviews-nav.prev {
    left: 0;
    /* Use theme variables or encoded SVG if needed, for now standard swiper-like arrows */
    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="black"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>');
}
.module-google-reviews .google-reviews-nav.next {
    right: 0;
    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="black"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>');
}
.module-google-reviews .google-reviews-pagination {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    text-align: center;
    z-index: 10;
}
</style>
