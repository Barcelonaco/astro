<?php

namespace App\Helpers;

class AcfHelper
{
    public function getAllModulesLayouts($columns = false): array
    {
        $moduleNames = [
            'TextSimple',
            'TextImage',
            'HeadText',
            'SliderTextVideo',
            'Accordion',
            'KeyFigures',
            'Quote',
            'TextScrolling',
            'LinkAlone',

            'Gallery',
            'Video',
            'ImagesSlider',
            'Files',
            'ImagesVideosParallax',
            'IconLogo',
            'SliderLogo',
            'Ornament',
            'IllusVideo',

            'ClickableTiles',
            'FreePost',
            'NewsSlider',
            'EventsSlider',
            'BlocReferences',
            'Team',
            'Contact',
            'Map',

            'GoogleReviews',
            'Summary',
            'Form',
            'ReusableBloc',
            'ColumnsTab',
            'Separator',
            'NewsletterForm',
            'Review',
            'Widget',
            'PlanSite',

        ];

        if ($columns) {
            $exclude = [
                'ColumnsTab',
                'Contact',
                'FreePost',
                'HeadText',
                'IllusVideo',
                'ImagesVideosParallax',
                'PlanSite',
                'SliderTextVideo'
            ];
            $moduleNames = array_filter($moduleNames, fn($m) => !in_array($m, $exclude));
            $moduleNames = array_values($moduleNames);
        }

        $layouts = [];
        $no_layouts = [];

        foreach ($moduleNames as $module) {
            $fqcn = "App\\Modules\\$module";

            if (!class_exists($fqcn)) {
                continue;
            }

            if (!method_exists($fqcn, 'getLayout')) {
                continue;
            }

            try {
                if (is_callable([$fqcn, 'getLayout'])) {

                    $result = call_user_func([$fqcn, 'getLayout'], $columns);
                } else {
                    $instance = new $fqcn();
                    $result = $instance->getLayout($columns);
                }
            } catch (\Throwable $e) {
                $no_layouts[] = ["error", $module];
                continue;
            }
            if ($result) {
                $layouts[] = $result;
            }
        }


        // PDV
        if (defined('NICKL_PDV') && NICKL_PDV === 'PDV') {
            $layouts = array_merge($layouts, $this->getLayoutPDV());
        }

        if (class_exists('WooCommerce')) {
            array_splice($layouts, 23, 0, $this->getLayoutWoocommerce());
        }

        $option_insta = get_option('options_id_application_instagram');
        if ($option_insta) {
            $layouts = array_merge($layouts, $this->getLayoutInsta());
        }
        $layouts = array_merge($layouts, $this->getCustomLayout());
        $layouts = array_values($layouts);
        // self::$cachedLayouts = $layouts;

        return $layouts;
    }
    /**
     * Layouts supplémentaires pour le mode PDV (plugins spécifiques)
     *
     * @return array
     */
    public function getLayoutPDV(): array
    {
        if (!function_exists('is_plugin_active')) {
            if (defined('ABSPATH')) {
                require_once ABSPATH . 'wp-admin/includes/plugin.php';
            } else {
                return [];
            }
        }

        $layouts = [];

        if (is_plugin_active('bcnco-api-meteo/api-meteo.php') && class_exists('\\Meteo\\Modules\\Meteo')) {
            $layouts[] = (new \Meteo\Modules\Meteo())->getLayout();
        }
        if (is_plugin_active('bcnco-one-click-services/one-click-services.php') && class_exists('\\OneClickServices\\Modules\\OneClickServices')) {
            $layouts[] = (new \OneClickServices\Modules\OneClickServices())->getLayout();
        }
        if (is_plugin_active('bcnco-contact-elus/contact-elus-core.php') && class_exists('\\ContactElus\\Modules\\ContactElus')) {
            $layouts[] = (new \ContactElus\Modules\ContactElus())->getLayout();
        }
        if (is_plugin_active('conseils-municipaux/conseils-municipaux-core.php') && class_exists('\\ConseilsMunicipaux\\Modules\\ConseilsMunicipaux')) {
            $layouts[] = (new \ConseilsMunicipaux\Modules\ConseilsMunicipaux())->getLayout();
        }
        if (is_plugin_active('bcnco-contribution-citoyenne/bcnco-contribution-citoyenne.php') && class_exists('\\ContributionCitoyenne\\Modules\\ContributionCitoyenne')) {
            $layouts[] = (new \ContributionCitoyenne\Modules\ContributionCitoyenne())->getLayout();
        }

        // self::$cachedLayouts = $layouts;
        return $layouts;
    }

    /**
     * Layouts pour WooCommerce (si présent)
     *
     * @return array
     */
    public function getLayoutWoocommerce(): array
    {
        $layouts = [];

        $fqcn = '\\App\\Modules\\Product';
        if (class_exists($fqcn) && method_exists($fqcn, 'getLayout')) {
            if (is_callable([$fqcn, 'getLayout'])) {
                $layouts[] = call_user_func([$fqcn, 'getLayout']);
            } else {
                $layouts[] = (new $fqcn())->getLayout();
            }
        }

        return $layouts;
    }

    public function getLayoutInsta(): array
    {
        $layouts = [];

        $fqcn = '\\App\\Modules\\InstaFeed';
        if (class_exists($fqcn) && method_exists($fqcn, 'getLayout')) {
            if (is_callable([$fqcn, 'getLayout'])) {
                $layouts[] = call_user_func([$fqcn, 'getLayout']);
            } else {
                $layouts[] = (new $fqcn())->getLayout();
            }
        }

        return $layouts;
    }

    public function getCustomLayout(): array
    {
        $layouts = [];
        if (is_plugin_active('indus-core-illustration/indus-core-illustration.php') && class_exists('\\IndusCoreIllustration\\FieldGroup\\Modules\\Illustration')) {
            $layouts[] = (new \IndusCoreIllustration\FieldGroup\Modules\Illustration())->getLayout();
        }
        return $layouts;
    }
}
