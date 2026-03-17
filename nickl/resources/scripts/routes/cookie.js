import { run } from "vanilla-cookieconsent";
import $ from "jquery";

console.log('cookie.js');

// Met à jour le consentement pour Google
const updateGoogleConsent = (cookie) => {
  if (typeof window.gtag !== 'function') {
    return;
  }

  const consentMode = {
    ad_storage: cookie?.categories?.includes('ads') ? 'granted' : 'denied',
    analytics_storage: cookie?.categories?.includes('analytics') ? 'granted' : 'denied',
    personalization_storage: cookie?.categories?.includes('personalization') ? 'granted' : 'denied',
    ad_user_data: cookie?.categories?.includes('user') ? 'granted' : 'denied',
    ad_personalization: cookie?.categories?.includes('personalization') ? 'granted' : 'denied',
    security_storage: 'granted',
    functionality_storage: 'granted',
  };

  window.gtag('consent', 'update', consentMode);
};

// Gère le cookie personnalisé "map"
const setMapCookie = (cookie) => {
  const cooks = window.cookieconsent.get();
  const hasAds = cookie?.categories?.includes('ads');

  if (hasAds && !cooks.map) {
    window.cookieconsent.set('map', 1, { expires: 182, path: '/' });
  } else if (!hasAds && cooks.map) {
    window.cookieconsent.remove('map', { path: '/' });
  }
};

// Gère le cookie personnalisé "alertClose"
const setPopinCookie = (cookie) => {
  const alertCloseKey = 'alertClose';
  const hasAdsConsent = cookie?.categories?.includes('ads');

  const getCookie = (name) =>
    document.cookie.split('; ').find(row => row.startsWith(name + '='))?.split('=')[1];

  const deleteCookie = (name) =>
    document.cookie = `${name}=; Max-Age=0; path=/`;

  if (hasAdsConsent && !getCookie(alertCloseKey)) {
    document.cookie = `${alertCloseKey}=1; Max-Age=${60 * 60 * 24 * 182}; path=/`;
  } else if (!hasAdsConsent && getCookie(alertCloseKey)) {
    deleteCookie(alertCloseKey);
  }
};

// Lancement de Cookie Consent
run({
  cookie: { name: 'cc_cookie' },
  guiOptions: {
    consentModal: {
      layout: 'box',
      position: 'bottom left',
      transition: 'slide',
    },
    preferencesModal: {
      layout: 'box',
      transition: 'slide',
    },
  },
  onFirstConsent: ({ cookie }) => {
    console.log('CookieConsent: First Consent', cookie);
    updateGoogleConsent(cookie);
    setPopinCookie(cookie);
  },
  onConsent: ({ cookie }) => {
    console.log('CookieConsent: Consent updated', cookie);
    updateGoogleConsent(cookie);
  },
  onChange: ({ cookie }) => {
    console.log('CookieConsent: Selection changed', cookie);
    updateGoogleConsent(cookie);
    setPopinCookie(cookie);
    setMapCookie(cookie);
  },
  onModalShow: ({ modalName }) => {
    // console.log('CookieConsent: Modal showing', modalName);
  },
  onModalReady: ({ modalName }) => {
    console.log('CookieConsent: Modal ready', modalName);
  },
  categories: {
    necessary: {
      enabled: true,
      readOnly: true
    },
    analytics: {
      autoClear: {
        cookies: [{ name: /^_ga/ }, { name: '_gid' }]
      },
      services: [{
        name: 'ga',
        label: 'Google Analytics',
        onAccept: () => updateGoogleConsent({ categories: ['analytics'] }),
        onReject: () => updateGoogleConsent({ categories: [] })
      }]
    },
    ads: {
      autoClear: {
        cookies: [{ name: 'ad_cookie' }]
      },
      services: [{
        name: 'ads_service',
        label: 'Publicités',
        onAccept: () => updateGoogleConsent({ categories: ['ads'] }),
        onReject: () => updateGoogleConsent({ categories: [] })
      }]
    },
    personalization: {
      services: [{
        name: 'personalization',
        label: 'Personnalisation annonce',
        onAccept: () => updateGoogleConsent({ categories: ['personalization'] }),
        onReject: () => updateGoogleConsent({ categories: [] })
      }]
    },
    user: {
      services: [{
        name: 'personal_data',
        label: 'Données personnelles',
        onAccept: () => updateGoogleConsent({ categories: ['user'] }),
        onReject: () => updateGoogleConsent({ categories: [] })
      }]
    }
  },
  language: {
    default: 'fr',
    translations: {
      fr: {
        consentModal: {
          title: 'Hello ! voici des <span class="large">Cookies</span>',
          description: `Ce site utilise des cookies essentiels pour assurer son bon fonctionnement et des cookies de suivi pour comprendre comment vous interagissez avec lui. Ce dernier ne sera fixé qu'après accord.<br><br>
                        <button type="button" data-cc="show-preferencesModal" aria-haspopup="dialog" class="cc-link">Choisir mes préférences</button><br>
                        <a href="/politique-de-confidentialite/" class="cc-link">Voir la politique de confidentialité</a>`,
          acceptAllBtn: 'Tout accepter',
          acceptNecessaryBtn: 'Tout rejeter',
        },
        preferencesModal: {
          title: 'Gestion de préférence des cookies',
          acceptAllBtn: 'Tout accepter',
          acceptNecessaryBtn: 'Tout rejeter',
          savePreferencesBtn: 'Enregistrer',
          closeIconLabel: 'Fermer',
          sections: [
            {
              title: 'Votre choix de confidentialité',
              description: `Dans ce panneau, vous pouvez exprimer certaines préférences liées au traitement de vos informations personnelles. Vous pouvez revoir et modifier ces choix à tout moment en rouvrant ce panneau via le lien fourni.`,
            },
            {
              title: 'Cookies nécessaires',
              description: 'Ces cookies sont indispensables au bon fonctionnement du site.',
              linkedCategory: 'necessary',
            },
            {
              title: 'Publicitaires',
              description: 'Ces cookies permettent d’améliorer l’expérience utilisateur.',
              linkedCategory: 'ads',
            },
            {
              title: 'Google Analytics',
              description: "Ces cookies permettent d'analyser les statistiques du site.",
              linkedCategory: 'analytics',
            },
            {
              title: 'Données personnelles',
              description: "Ces cookies permettent d'utiliser les données personnelles.",
              linkedCategory: 'user',
            },
            {
              title: 'Personnalisation annonces',
              description: "Ces cookies permettent de personnaliser les annonces.",
              linkedCategory: 'personalization',
            },
            {
              title: "Plus d'informations",
              description: `Pour toute question concernant notre politique en matière de cookies, veuillez <a href="#contact-page">nous contacter</a>`
            }
          ]
        }
      }
    }
  }
}).then((cc) => {
  const init = () => {
    const getCookie = (name) =>
      document.cookie.split('; ').find(row => row.startsWith(name + '='))?.split('=')[1];

    const alertClose = getCookie('alertClose');

    if (alertClose === '1') {
      closePopin('alert');
    } else {
      openPopin('alert');
    }

    document.querySelectorAll('.js_close-popin-alert, .btn-wrapper, .popin-alert-wrapper').forEach(el => {
      el.addEventListener('click', (e) => {
        if (el.classList.contains('popin-alert-wrapper') && e.target !== el) {
          return;
        }

        if (cc?.categories?.includes('ads')) {
          cc.set('alertClose', 1, { expires: 182, path: '/' });
        }

        closePopin('alert');
      });
    });

    setTimeout(() => {
      const modalTitle = document.querySelector("#cc-main .cm__body h2");
      if (modalTitle) {
        modalTitle.innerHTML = 'Hello ! voici des <span class="large">Cookies</span>';
        modalTitle.outerHTML = `<div class="cm__title">${modalTitle.innerHTML}</div>`;
      }
    }, 500);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
});

// Fonctions d'ouverture/fermeture de popin
function openPopin(popin, slide) {
  const wrapper = $(`.popin-wrapper[data-popin="${popin}"]`);
  wrapper.show(0).addClass('active');
  document.body.style.overflow = 'hidden';

  if (slide) {
    const slider = wrapper.find('.slider')[0]?.swiper;
    if (slider) {
      slider.slideToLoop(slide - 1);
    }
  }
}

function closePopin(popin) {
  const el = $(`.popin-wrapper[data-popin="${popin}"]`);
  el.removeClass('active');
  document.body.style.overflow = '';
  setTimeout(() => {
    el.hide(0);
  }, 600);
}
