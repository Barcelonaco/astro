@php
    use App\Helpers\GlobalHelper;
    use App\Posttype\CptReferences;
    use App\Taxonomy\TaxoReferencesCategory;

    $taxoRef = new TaxoReferencesCategory();
    $cptSlug = new CptReferences();

    if (isset($columns) && $columns == 'module-in-column') {
        $id_bloc = '';
    }

    if (!empty($backgroundImage)) {
        if(isset($reusable_bloc) && !empty($reusable_bloc)) {
            $background_image = GlobalHelper::displayBackground($backgroundImage['url']);
        } else {
            $background_image = 'background-image: url('. e($backgroundImage['url']) .')';
        }
    }
@endphp

<div id="{{ $id_bloc }}" class="module module-references {{isset($columns) ? '' : $classes }}">

    @if (!empty($backgroundImage) && !isset($columns))
        <div class="background"
            style="{{ GlobalHelper::displayBackground($backgroundImage['url'])}}; opacity: {{ e($backgroundImage['opacity']) }};">
        </div>
    @endif

    @if (isset($refs['posts']) && !empty($refs['posts']))

        <div class="container-large">

            @if (!isset($columns))
                @include('components.bloc-title-module', [
                    'title_bloc' => $title_bloc,
                    'title_style' => $title_style,
                    'title_align' => $title_align,
                ])
            @endif

            <ul class="list">

                @foreach($refs['posts'] as $ref)
                    {!! view('components.preview-references', ['pid' => $ref->ID])->render() !!}
                @endforeach

            </ul>{{-- /.list --}}

            @if ($module['display_archive_link'])
                <div class="btn-more-wrapper">
                    <a href="{{home_url() . "/" . $cptSlug->getSlug()}}"
                        class="btn btn-tertiary color-primary">{{ !empty($module['archive_link_label']) ? $module['archive_link_label'] : bcn_pll('Voir toutes les références') }}</a>
                </div>
            @endif

        </div>{{-- /.container-large --}}

    @endif

    @if (isset($refs['posts']) && !empty($refs['posts']))
        @foreach($refs['posts'] as $ref)
            @include('components.preview-popin-references', ['pid' => $ref->ID])
        @endforeach
    @endif

</div>{{-- /.module-references --}}
