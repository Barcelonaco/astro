@php
    use App\Helpers\GlobalHelper;

    if (!empty($backgroundImage)) {
        if(isset($reusable_bloc) && !empty($reusable_bloc)) {
            $background_image = GlobalHelper::displayBackground($backgroundImage['url']);
        } else {
            $background_image = 'background-image: url('. e($backgroundImage['url']) .')';
        }
    }

    if (isset($columns) && $columns == 'module-in-column') {
        $id_bloc = '';
    }
@endphp

<div id="{{ $id_bloc }}" class="module module-files {{isset($columns) ? '' : $classes }}">

    @if (!empty($backgroundImage) && !isset($columns))
        <div class="background"
            style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
        </div>
    @endif

    <div class="container-large">

        @if (!isset($columns))
            @include('components.bloc-title-module', [
                'title_bloc' => $title_bloc,
                'title_style' => $title_style,
                'title_align' => $title_align,
            ])
        @endif
        <ul class="list columns-{{ isset($module['files']) ? count($module['files']) : '' }} {{ $files_preview ? 'files_preview' : '' }}">

            @foreach($module['files'] as $file)

                @if (isset($file['file']['url']) || !empty($file['file']['url']))
                    <li class="item">
                        {{-- {!! do_shortcode('[pdfjs-viewer url="' . $file['file']['url'] .'" viewer_width=700
                        viewer_height=800 fullscreen=true download="new"]') !!} --}}

                        @if (isset($files_preview) && $files_preview !== false)
                            <div class="module-pdf-viewer__frame">
                                <iframe src="{{$file['file']['url']}}" title="{{$file['file']['name']}}" loading="lazy"
                                    referrerpolicy="no-referrer"></iframe>
                                @if (isset($module['files']) && count($module['files']) > 2)
                                    <div class="overlay">
                                        <a href="{{$file['file']['url']}}" target="_blank" title="Agrandir"
                                            class="btn btn-primary"><span class="icon"
                                                aria-hidden="false"><?= GlobalHelper::displaySvg('eye.svg') ?></span> Agrandir</a>
                                    </div>
                                @endif
                            </div>
                        @else
                            <p>{{ $file['title'] ? $file['title'] : $file['file']['name'] }}</p>
                            <a href="{{$file['file']['url']}}" target="_blank" title="Visualiser {{$file['file']['name']}}"
                                class="btn btn-primary"></span>Visualiser</a>
                            <a href="{{$file['file']['url']}}" target="_blank" title="Télécharger {{$file['file']['name']}}"
                                class="btn btn-secondary color-secondary"
                                download="{{$file['file']['name']}}"></span>Télécharger</a>
                        @endif
                    </li>{{-- /.item --}}
                @endif
            @endforeach

        </ul>{{-- /.list --}}
    </div>{{-- /.container-large --}}
</div>{{-- /.module-posts-list --}}
