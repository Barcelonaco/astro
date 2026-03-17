#!/usr/bin/env node
/**
 * Compiles SCSS module files to CSS.
 * Run from: nickl/resources/styles/
 *   node compile-modules.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../backend/public/admin/modules');

// Map from admin layout name → SCSS partial name (without leading _ and .scss)
const MODULE_MAP = {
  'accordion':              'accordion',
  'banner':                 'banner',
  'clickable-tiles':        'clickable',
  'columns-tab':            'columns',
  'contact':                'contact',
  'events-slider':          'event-slider',
  'featured_products':      'featured_products',
  'files':                  'files',
  'form':                   'form',
  'gallery':                'gallery',
  'head-text':              'head-text',
  'hero':                   'hero',
  'icons':                  'icons',
  'illustration-video':     'illustration-video',
  'images-slider':          'images-slider',
  'images-videos-parallax': 'images-videos-parallax',
  'insta-slider':           'insta-slider',
  'key-figures':            'key-figures',
  'link':                   'link',
  'logos-slider':           'logos-slider',
  'map':                    'map',
  'news-slider':            'news-slider',
  'newsletter-form':        'newsletter-form',
  'ornament':               'ornament',
  'plansite':               'plansite',
  'free-post':              'posts-list',
  'quote':                  'quote',
  'references':             'references',
  'review':                 'review',
  'separator':              'separator',
  'share':                  'share',
  'summary':                'summary',
  'team':                   'team',
  'text-image':             'text-image',
  'text-scrolling':         'text-scrolling',
  'text-video-slider':      'text-video-slider',
  'text':                   'text',
  'video':                  'video',
};

let success = 0;
let failed = 0;

for (const [layout, scssName] of Object.entries(MODULE_MAP)) {
  const scssPath = path.join(__dirname, 'modules', `_${scssName}.scss`);
  if (!fs.existsSync(scssPath)) {
    console.warn(`[SKIP] No SCSS file for: modules/_${scssName}.scss`);
    continue;
  }

  // Build a temporary SCSS entry that pulls in base + module
  const scssInput = `@import 'base/common'; @import 'components/buttons'; @import 'modules/modules'; @import 'modules/${scssName}';`;
  const outPath = path.join(outDir, `${layout}.css`);

  try {
    const css = execSync(
      `echo ${JSON.stringify(scssInput)} | npx sass --stdin --no-source-map --quiet-deps --style=expanded`,
      { cwd: __dirname, encoding: 'utf-8' }
    );
    fs.writeFileSync(outPath, css);
    console.log(`[OK]   ${layout}.css`);
    success++;
  } catch (err) {
    const msg = err.stderr || err.message || '';
    console.error(`[FAIL] ${layout}.css — ${msg.split('\n').find(l => l.includes('Error')) || msg.slice(0, 120)}`);
    failed++;
  }
}

console.log(`\nDone: ${success} compiled, ${failed} failed.`);
