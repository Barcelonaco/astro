import $ from 'jquery';
import Router from './util/Router';
import common from './routes/common';
import './routes/accessibilty.js';
import './routes/cookie';
import './routes/ia';
import './autoload/AjaxRefs';
//import './ajax/pagination.js';
import loadModules from "@scripts/routes/module-loader.js";


// Vérifie si les conteneurs existent avant d'importer les scripts correspondants
document.addEventListener('DOMContentLoaded', async () => {

  const newsContainer = document.querySelector('.js_news-container');
  const eventsContainer = document.querySelector('.js_events-container');


  if (newsContainer) {
    const { default: AjaxNews } = await import('@scripts/autoload/AjaxNews.js');
    new AjaxNews(newsContainer);
  }

  if (eventsContainer) {
    const { default: AjaxEvents } = await import('@scripts/autoload/AjaxEvents.js');
    new AjaxEvents(eventsContainer);
  }
});
document.addEventListener('DOMContentLoaded', () => {
  loadModules();
});


document.addEventListener('DOMContentLoaded', () => {
  const lazyVideos = document.querySelectorAll('.js_lazy-video');
  const options = { rootMargin: "200px", threshold: 0.25 };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const video = entry.target;
        const src = video.dataset.src;
        if (src) {
          const source = document.createElement('source');
          source.src = src;
          source.type = 'video/mp4';
          video.appendChild(source);
          video.load();
          video.play();
        }
        obs.unobserve(video);
      }
    });
  }, options);

  lazyVideos.forEach(video => observer.observe(video));
});

/** Populate Router instance with DOM routes */
const routes = new Router({
  common, // All pages
});

/** Ensure DOM is ready before executing */
$(function () {
  routes.loadEvents();
});

/**
 * Webpack Hot Module Replacement
 * @see {@link https://webpack.js.org/api/hot-module-replacement/}
 */

/*
if (import.meta.webpackHot) {
  import.meta.webpackHot.accept(console.error);
}
*/
