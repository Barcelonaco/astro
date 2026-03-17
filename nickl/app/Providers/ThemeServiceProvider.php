<?php

namespace App\Providers;

use Roots\Acorn\Sage\SageServiceProvider;
use App\View\Composers\ImagesSlider;
use function Roots\bundle;

class ThemeServiceProvider extends SageServiceProvider
{
    /**
     * Register any application services.
     *
     * @return void
     */
    public function register()
    {
        parent::register();
        
        if (is_plugin_active('indus-core/indus-core.php') && class_exists(\IndusCore\PluginServiceProvider::class)) {
            $this->app->register(\IndusCore\PluginServiceProvider::class);
        }
    }

    /**
     * Bootstrap any application services.
     *
     * @return void
     */
    public function boot()
    {
        // Exécution de l'initialisation sans parent
        parent::boot();

        // Charger les fichiers ACF, à ne faire qu'à l'initialisation du projet
        //$this->loadACF();

        add_action('admin_enqueue_scripts', function () {
            bundle('admin')->enqueue();
        });
        add_action('app_enqueue_scripts', function () {
            bundle('app')->enqueue();
        });
        add_action('editor_enqueue_scripts', function () {
            bundle('editor')->enqueue();
        });
    }

    /**
     * Load ACF field files from the FieldGroup directory.
     *
     * @return void
     */
    protected function loadACF()
    {
        // Récupération du chemin correct du dossier FieldGroup
        $acfPath = get_theme_file_path('app/FieldGroup');

        if (is_dir($acfPath)) {
            $files = glob($acfPath . '/*.php');

            if (!empty($files)) {
                foreach ($files as $file) {
                    require_once $file;
                }
                //\Log::info('ACF Fields chargés depuis : ' . $acfPath . ' : ' . $file);
            } else {
                //\Log::warning('Aucun fichier ACF trouvé dans : ' . $acfPath);
            }
        } else {
            //\Log::error('Le dossier ACF est introuvable : ' . $acfPath);
        }
    }

    /**
     * Indicate if the provider is deferred (lazy-loaded).
     *
     * @return bool
     */
    public function isDeferred()
    {
        return false; // Retourné false si tu ne veux pas que le service soit différé
    }
}
