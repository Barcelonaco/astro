import * as path from 'node:path'
import glob from 'fast-glob'

export default async app => {
  /**
   * Application assets & entrypoints
   */
  app
    .hash(false)
    .entry({
      app: ['@styles/app.scss', '@scripts/app.js'],
      admin: ['@styles/admin.scss', '@scripts/admin.js'],
      ajaxRefs: ['@scripts/autoload/AjaxRefs.js'],
      ajaxNews: ['@scripts/autoload/AjaxNews.js'],
      ajaxEvents: ['@scripts/autoload/AjaxEvents.js'],
      autoload: ['@scripts/autoload/autoload.js'],
    })
    .assets(['images', 'css', 'js'])


  /**
   * Set public path
   */
  app.setPublicPath('/app/themes/nickl/public')

  /**
   * Development server settings
   */
  app
    .setUrl('https://localhost:3000')
    .setProxyUrl('https://demo.nickl.lan')
    .watch([
      'resources/views/**/*.blade.php',
      'resources/styles/**/*.scss',
      'resources/scripts/**/*.js',
    ])

  app.alias({
    '@images': path.resolve('resources/images'),
  })

  /**
   * Generate WordPress `theme.json`
   */
  app.wpjson
    .setSettings({
      background: {
        backgroundImage: true,
      },
      color: {
        custom: false,
        customDuotone: false,
        customGradient: false,
        defaultDuotone: false,
        defaultGradients: false,
        defaultPalette: false,
        duotone: [],
      },
      custom: {
        spacing: {},
        typography: {
          'font-size': {},
          'line-height': {},
        },
      },
      spacing: {
        padding: true,
        units: ['px', '%', 'em', 'rem', 'vw', 'vh'],
      },
      typography: {
        customFontSize: false,
      },
    })
    .enable()

  /**
   * Use @roots/bud-swc for SWC loader
   */
  app.use(['@roots/bud-swc', '@roots/bud-sass'])

  /**
   * Configure Sass Loader
   * We are keeping the `includePaths` here to help Sass resolve imports more easily.
   * However, if you are explicitly adding `@use` statements in each module file,
   * the `additionalData` for global injection can be removed or made more specific.
   *
   * If `additionalData` causes issues with your explicit `@use` statements,
   * you can remove the `additionalData` block entirely from here.
   * If you still want to inject globally for other files (e.g., your main app.scss),
   * consider if `additionalData` is the best approach or if you should `@use` there too.
   */
  app
    .entry('accordion', ['@styles/modules/_accordion.scss'])
    .entry('banner', ['@styles/modules/_banner.scss'])
    .entry('hero', ['@styles/modules/_hero.scss'])
    .entry('clickable-tiles', ['@styles/modules/_clickable.scss'])
    .entry('columns-tab', ['@styles/modules/_columns.scss'])
    .entry('contact', ['@styles/modules/_contact.scss'])
    .entry('events-slider', ['@styles/modules/_event-slider.scss'])
    .entry('featured_products', ['@styles/modules/_featured_products.scss'])
    .entry('files', ['@styles/modules/_files.scss'])
    .entry('form', ['@styles/modules/_form.scss'])
    .entry('gallery', ['@styles/modules/_gallery.scss'])
    .entry('head-text', ['@styles/modules/_head-text.scss'])
    .entry('icons', ['@styles/modules/_icons.scss'])
    .entry('illustration-video', ['@styles/modules/_illustration-video.scss'])
    .entry('images-videos-parallax', ['@styles/modules/_images-videos-parallax.scss'])
    .entry('images-slider', ['@styles/modules/_images-slider.scss'])
    .entry('insta-slider', ['@styles/modules/_insta-slider.scss'])
    .entry('key-figures', ['@styles/modules/_key-figures.scss'])
    .entry('link', ['@styles/modules/_link.scss'])
    .entry('logos-slider', ['@styles/modules/_logos-slider.scss'])
    .entry('map', ['@styles/modules/_map.scss'])
    .entry('news-slider', ['@styles/modules/_news-slider.scss'])
    .entry('newsletter-form', ['@styles/modules/_newsletter-form.scss'])
    .entry('ornament', ['@styles/modules/_ornament.scss'])
    .entry('plansite', ['@styles/modules/_plansite.scss'])
    .entry('free-post', ['@styles/modules/_posts-list.scss'])
    .entry('quote', ['@styles/modules/_quote.scss'])
    .entry('references', ['@styles/modules/_references.scss'])
    .entry('review', ['@styles/modules/_review.scss'])
    .entry('separator', ['@styles/modules/_separator.scss'])
    .entry('share', ['@styles/modules/_share.scss'])
    .entry('summary', ['@styles/modules/_summary.scss'])
    .entry('team', ['@styles/modules/_team.scss'])
    .entry('text', ['@styles/modules/_text.scss'])
    .entry('text-image', ['@styles/modules/_text-image.scss'])
    .entry('text-scrolling', ['@styles/modules/_text-scrolling.scss'])
    .entry('text-video-slider', ['@styles/modules/_text-video-slider.scss'])
    .entry('video', ['@styles/modules/_video.scss'])
}