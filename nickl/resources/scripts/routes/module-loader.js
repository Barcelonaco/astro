const modulesMap = {
    'module-hero': () => import('../modules/module-hero.js'),
    'module-event-slider': () => import('../modules/module-events-slider.js'),
    'module-news-slider': () => import('../modules/module-news-slider.js'),
    'module-logos-slider': () => import('../modules/module-logos-slider.js'),
    'module-insta-slider': () => import('../modules/module-insta-slider.js'),
    'module-accordion': () => import('../modules/module-accordion.js'),
    'module-map': () => import('../modules/module-map.js'),
    'module-clickable': () => import('../modules/module-clickable.js'),
    'module-contact': () => import('../modules/module-contact.js'),
    'module-contact': () => import('../modules/module-map.js'),
    'module-link': () => import('../modules/module-link.js'),
    'module-quote': () => import('../modules/module-quote.js'),
    'module-files': () => import('../modules/module-files.js'),
    'module-form': () => import('../modules/module-form.js'),
    'module-gallery': () => import('../modules/module-gallery.js'),
    'module-head-text': () => import('../modules/module-head-text.js'),
    'module-icons': () => import('../modules/module-icons.js'),
    'module-images-slider': () => import('../modules/module-images-slider.js'),
    'module-key-figures': () => import('../modules/module-key-figures.js'),
    'module-posts-list': () => import('../modules/module-posts-list.js'),
    'module-references': () => import('../modules/module-references.js'),
    'module-team': () => import('../modules/module-team.js'),
    'module-text': () => import('../modules/module-text.js'),
    'module-text-image': () => import('../modules/module-text-image.js'),
    'module-video': () => import('../modules/module-video.js'),
    'module-text-video-slider': () => import('../modules/module-text-video-slider.js'),
    'module-google-reviews': () => import('../modules/module-google-reviews.js'),
};

export default function loadModules()
{
    const loadedModules = new Set();

    document.querySelectorAll('[class*="module-"]').forEach(el => {
        const classesToLoad = [...el.classList].filter(cls => cls.startsWith('module-') && modulesMap[cls]);

        classesToLoad.forEach(cls => {
            const key = `${cls}-${el.dataset.moduleId || el.dataset.id || el.id || Math.random()}`;

            if (!loadedModules.has(key)) {
                modulesMap[cls]()
                .then(module => {
                    if (typeof module.default === 'function') {
                        module.default(el);
                        loadedModules.add(key);
                    }
                  })
                  .catch(error => {
                        console.error(`❌ Erreur lors du chargement du module "${cls}" :`, error);
                    });
            }
        });
    });
}
