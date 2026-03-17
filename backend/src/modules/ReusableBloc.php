<?php

namespace App\Modules;


use App\Modules\BlockParams;
use App\Posttype\CptReusableBlock;

use Extended\ACF\Fields\Layout;
use Extended\ACF\Fields\Message;
use Extended\ACF\Fields\Select;

class ReusableBloc
{
    public static function getLayout()
    {
        $transient = get_transient('_reusable_bloc_list');

        if ($transient) {
            foreach ($transient as $pid => $title){
                $listPosts[$pid] = $title;
            }
        }

        if (isset($listPosts)) {
            return Layout::make(__('Bloc réutilisable', THEME_TEXTDOMAIN), 'reusable-bloc')
                ->layout('block')
                ->fields([
                    Select::make(__('Choisissez un bloc à insérer', THEME_TEXTDOMAIN), 'bloc_id')
                        ->wrapper(['width' => 50])
                        ->choices($listPosts),
                    BlockParams::getIsVisible()
                ]);

        } else {
            $cptSlug = new CptReusableBlock();
            return Layout::make(__('Bloc réutilisable', THEME_TEXTDOMAIN), 'reusable-bloc')
                ->layout('block')
                ->fields([
                    Message::make(__('vous devez d\'abord créer un bloc en vous rendant sur cette page', THEME_TEXTDOMAIN) . '<br>=> <a href="' . admin_url() . 'post-new.php?post_type=' . $cptSlug->getSlug() . '" target="_blank">'  . __('Ajouter un bloc', THEME_TEXTDOMAIN) . '</a>'),
                    BlockParams::getIsVisible()
                ]);
        }

    }
}
