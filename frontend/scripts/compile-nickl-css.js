/**
 * Compile Nickl SCSS → CSS.
 * Reproduces the same output as Nickl's Bud config:
 *   - app.scss → app.css (base + components + partials)
 *   - Each module SCSS → individual CSS file (loaded per-page by ModuleStyles)
 *
 * Usage: node scripts/compile-nickl-css.js
 */

import * as sass from 'sass';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, '../src/styles/nickl');
const outDir = resolve(__dirname, '../public/nickl-assets/css');

mkdirSync(outDir, { recursive: true });

// Module entries: output name → source file (same mapping as bud.config.js)
const moduleEntries = {
  'accordion':                'modules/_accordion.scss',
  'banner':                   'modules/_banner.scss',
  'hero':                     'modules/_hero.scss',
  'clickable-tiles':          'modules/_clickable.scss',
  'columns-tab':              'modules/_columns.scss',
  'contact':                  'modules/_contact.scss',
  'events-slider':            'modules/_event-slider.scss',
  'featured_products':        'modules/_featured_products.scss',
  'files':                    'modules/_files.scss',
  'form':                     'modules/_form.scss',
  'gallery':                  'modules/_gallery.scss',
  'head-text':                'modules/_head-text.scss',
  'icons':                    'modules/_icons.scss',
  'illustration-video':       'modules/_illustration-video.scss',
  'images-videos-parallax':   'modules/_images-videos-parallax.scss',
  'images-slider':            'modules/_images-slider.scss',
  'insta-slider':             'modules/_insta-slider.scss',
  'key-figures':              'modules/_key-figures.scss',
  'link':                     'modules/_link.scss',
  'logos-slider':             'modules/_logos-slider.scss',
  'map':                      'modules/_map.scss',
  'news-slider':              'modules/_news-slider.scss',
  'newsletter-form':          'modules/_newsletter-form.scss',
  'ornament':                 'modules/_ornament.scss',
  'plansite':                 'modules/_plansite.scss',
  'free-post':                'modules/_posts-list.scss',
  'quote':                    'modules/_quote.scss',
  'references':               'modules/_references.scss',
  'review':                   'modules/_review.scss',
  'separator':                'modules/_separator.scss',
  'share':                    'modules/_share.scss',
  'summary':                  'modules/_summary.scss',
  'team':                     'modules/_team.scss',
  'text':                     'modules/_text.scss',
  'text-image':               'modules/_text-image.scss',
  'text-scrolling':           'modules/_text-scrolling.scss',
  'text-video-slider':        'modules/_text-video-slider.scss',
  'video':                    'modules/_video.scss',
};

// All entries: app.scss + individual modules
const allEntries = {
  'app': 'app.scss',
  ...moduleEntries,
};

let compiled = 0;
let failed = 0;

for (const [name, file] of Object.entries(allEntries)) {
  const inputPath = resolve(srcDir, file);
  const outputPath = resolve(outDir, `${name}.css`);

  try {
    const result = sass.compile(inputPath, {
      style: 'compressed',
      loadPaths: [srcDir],
      silenceDeprecations: ['import'],
    });
    writeFileSync(outputPath, result.css);
    compiled++;
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`);
    failed++;
  }
}

console.log(`Nickl CSS: ${compiled} compiled, ${failed} failed`);
if (failed > 0) process.exit(1);
