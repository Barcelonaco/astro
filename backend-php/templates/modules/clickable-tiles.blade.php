@php
    use App\Helpers\GlobalHelper;

    $first_item = array_slice($list_items, 0, 1);
    $second_item = array_slice($list_items, 1, 1);
    if (count($list_items) === 6) {
        $other_items = array_slice($list_items, 2);
    } else {
        $other_items = array_slice($list_items, 1);
    }
@endphp

<div id="{{ $id_bloc }}"
    class="module module-clickable @if(!isset($columns) || $columns == 0) {{ $classes }} @endif{{isset($customClasses) ? ' ' . $customClasses : '' }} {{ isset($reusable_bloc) ? 'reusable-bloc' : '' }}">

    @if (!empty($backgroundImage) && !isset($columns))
        <div class="background"
            style="{{ GlobalHelper::displayBackground($backgroundImage['url'], isset($reusable_bloc))}}; opacity: {{ e($backgroundImage['opacity']) }};">
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

        @if ($interlocking_tiles)
            <div class="cols-wrapper items-{{ count($list_items) }}">
                @if (count($list_items) === 8)
                <div class="items">
                        @foreach ($list_items as $item)
                            @include('components.clickable-item', ['item' => $item, 'module' => $module, 'list_items' => $list_items])
                        @endforeach
                    </div>
                @else
                    {{-- Colonne 1 --}}
                    <div class="items col col-1">
                        @foreach ($first_item as $item)
                            @include('components.clickable-item', ['item' => $item, 'module' => $module, 'list_items' => $list_items])
                        @endforeach
                    </div>

                    {{-- Colonne 1bis si 6 items --}}
                    @if (count($list_items) === 6)
                        <div class="items col col-1-bis">
                            @foreach ($second_item as $item)
                                @include('components.clickable-item', ['item' => $item, 'module' => $module, 'list_items' => $list_items])
                            @endforeach
                        </div>
                    @endif

                    {{-- Colonne 2 --}}
                    @if (count($other_items) > 0)
                        <div class="items col col-2">
                            @foreach ($other_items as $item)
                                @include('components.clickable-item', ['item' => $item, 'module' => $module, 'list_items' => $list_items])
                            @endforeach
                        </div>
                    @endif
                @endif
            </div>
        @else
            <div class="list items items-{{ count($list_items) }}">
                @foreach ($list_items as $item)
                    @include('components.clickable-item', ['item' => $item, 'module' => $module, 'list_items' => $list_items])
                @endforeach
            </div>
        @endif
    </div>
</div>
