@php
    $transient = get_transient('_reusable_bloc_list');
    if (empty($transient) || !isset($transient[$module['bloc_id']])) {
        return;
    }
    $modules = get_fields($module['bloc_id']);
@endphp

@if (isset($modules['flexible_modules']) && !empty($modules['flexible_modules']))
    @foreach($modules['flexible_modules'] as $module)
        @if(isset($module['acf_fc_layout']) && !empty($module['acf_fc_layout']) && ($module['is_visible'] ?? 'yes') !== 'no')
            @php
                try {
            @endphp
                @includeIf('modules.' . $module['acf_fc_layout'], ['module' => $module, 'reusable_bloc' => 'reusable-bloc'])
            @php
                } catch (\Throwable $e) {
                    if (defined('WP_DEBUG') && WP_DEBUG) {
                        echo '<!-- MODULE ERROR ['.$module['acf_fc_layout'].']: '.esc_html($e->getMessage()).' -->';
                        error_log('Module render error ['.$module['acf_fc_layout'].']: '.$e->getMessage().' in '.$e->getFile().':'.$e->getLine());
                    }
                }
            @endphp
        @endif
    @endforeach
@endif