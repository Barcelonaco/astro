<?php

namespace App\Helpers;

use Sober\Controller\Controller;

/**
 * Gestionnaire des Actions et des Method pour l'ajax
 *
 * ⚠️ Ne pas effacer ce fichier ni le modifier
 */
class AjaxController extends Controller
{
    /**
     * @var string|mixed
     * Fonction utilisée
     */
    private string $postAction = '';

    /**
     * @var string
     * Class de l'ajax
     */
    private string $postMethod = '';

    public function __construct()
    {
        if (isset($_POST[ 'action' ]) && isset($_POST[ 'method' ])) {
            $postAction = $_POST[ 'action' ];
            $postMethod = 'App\Helpers\Ajax' . ucfirst($_POST[ 'method' ]);

            if (class_exists($postMethod) && method_exists($postMethod, $postAction)) {
                $object = new $postMethod();
                return $object->$postAction();
            } else {
                echo '<pre>';
                var_dump('Class or Method ' . $postMethod . '@' . $postAction . ' not found.');
                die();
            }
        }
    }
}
