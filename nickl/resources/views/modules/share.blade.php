@php
    use App\Helpers\GlobalHelper;
    use Detection\MobileDetect;

    $detect = new MobileDetect;
    $id_bloc = get_sub_field('id_bloc');
    if ($detect->is('iOS')) {
        $share = GlobalHelper::displaySvg('share-ios.svg');
    } else {
        $share = GlobalHelper::displaySvg('share-androidos.svg');
    }
    if (isset($columns) && $columns == 'module-in-column') {
        $id_bloc = '';
    }
@endphp

<div id="{{ $id_bloc }}"
    class="module module-share padding-top-small padding-bottom-small{{$share_btn_position ? ' ' . $share_btn_position : ''}}">
    <div class="container">
        <div class="cols-wrapper">
            <div class="col col-1">
                <p class="title-list">
                    <span class="icon" aria-hidden="true">{!! $share !!}</span>
                    Partager
                </p>
            </div>{{-- /.col-1 --}}

            <div class="col col-2">
                <ul class="social-networks">
                    <li>
                        @php
                            $title = html_entity_decode(get_the_title(), ENT_QUOTES, 'UTF-8');
                            $url = get_permalink();

                            $subject = rawurlencode($title);
                            $body = rawurlencode($title . ' : ' . $url);
                        @endphp

                        <a href="mailto:?subject={{ $subject }}&amp;body={{ $body }}" class="link"
                            title="Partager par mail">
                            <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('mail.svg') !!}</span>
                        </a>
                    </li>
                    <li>
                        <a href="https://www.facebook.com/sharer/sharer.php?u={{ urlencode(get_permalink()) }}"
                            target="_blank" class="link" title="Partager sur Facebook">
                            <span class="icon"
                                aria-hidden="true">{!! GlobalHelper::displaySvg('facebook.svg') !!}</span>
                        </a>
                    </li>
                    <li>
                        <a href="https://www.threads.net/share?url={{ urlencode(get_permalink()) }}" target="_blank"
                            class="link" title="Partager sur Threads">
                            <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('threads.svg') !!}</span>
                        </a>
                    </li>
                    <li>
                        <a href="https://www.linkedin.com/sharing/share-offsite/?url={{ urlencode(get_permalink()) }}"
                            target="_blank" class="link" title="Partager sur Linkedin">
                            <span class="icon"
                                aria-hidden="true">{!! GlobalHelper::displaySvg('linkedin.svg') !!}</span>
                        </a>
                    </li>
                    <li>
                        <a href="https://twitter.com/intent/tweet?url={{ urlencode(get_permalink()) }}&text={{ urlencode(get_the_title()) }}"
                            target="_blank" class="link" title="Partager sur X">
                            <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('x.svg') !!}</span>
                        </a>
                    </li>
                    <li>
                        <a href="https://www.pinterest.com/pin/create/button/?url={{ urlencode(get_permalink()) }}&media={{ urlencode(wp_get_attachment_url(get_post_thumbnail_id())) }}&description={{ urlencode(get_the_title()) }}"
                            target="_blank" class="link" title="Partager sur Pinterest">
                            <span class="icon"
                                aria-hidden="true">{!! GlobalHelper::displaySvg('pinterest.svg') !!}</span>
                        </a>
                    </li>
                    <li>
                        <a href="whatsapp://send?text={{ urlencode(get_the_title() . ': ' . get_permalink()) }}"
                            target="_blank" class="link" title="Partager dans une conversation Whatsapp">
                            <span class="icon"
                                aria-hidden="true">{!! GlobalHelper::displaySvg('whatsapp.svg') !!}</span>
                        </a>
                    </li>
                    <li>
                        <button class="link js_copy-link" title="Copier le lien dans le press-papier">
                            <span class="icon" aria-hidden="true">{!! GlobalHelper::displaySvg('link.svg') !!}</span>
                            <span>Le lien à bien été copié</span>
                        </button>
                    </li>
                </ul>
            </div>{{-- /.col-2 --}}
        </div>{{-- /.cols-wrapper --}}
    </div>{{-- /.container --}}
</div>{{-- /.module-share --}}