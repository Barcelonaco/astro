/**
 * ImageGalleryView — sidebar widgets "Image du produit" + "Galerie produit".
 *
 * Utilise le media picker natif du CMS via window.parent.openExternalMediaPicker
 * (single) et window.parent.openExternalMediaPickerMultiple (multi).
 */

import { BaseView } from '../../_lib/View.js';
import { h, qs } from '../../_lib/dom.js';

export class ImageGalleryView extends BaseView {
  mount({ imageRoot, galleryRoot }) {
    this.imageRoot = imageRoot;
    this.galleryRoot = galleryRoot;
    this._gallery = [];
    this._renderImage();
    this._renderGallery();
    return this;
  }

  render(state) {
    // Featured image
    const fi = state.product.featured_image;
    const url = typeof fi === 'string' ? fi : (fi?.url || '');
    const preview = qs('#pe-featured-preview', this.imageRoot);
    if (url) {
      preview.innerHTML = '';
      preview.style.backgroundImage = `url("${url}")`;
      preview.classList.add('has-img');
    } else {
      preview.textContent = 'Aucune image';
      preview.style.backgroundImage = '';
      preview.classList.remove('has-img');
    }
    const clearBtn = qs('#pe-featured-clear', this.imageRoot);
    if (clearBtn) clearBtn.style.display = url ? '' : 'none';

    // Gallery
    this._gallery = (state.product.custom_fields?.gallery || []).map(g =>
      typeof g === 'string' ? { url: g } : g
    );
    this._renderGalleryItems();
  }

  _renderImage() {
    this.imageRoot.replaceChildren(
      h('div', { id: 'pe-featured-preview', class: 'pe-featured-img', style: 'cursor:pointer',
        onclick: () => this._openFeaturedPicker(),
      }, 'Aucune image'),
      h('div', { style: 'display:flex;gap:8px;margin-top:8px' },
        h('button', { type: 'button', class: 'btn btn-sm btn-outline', onclick: () => this._openFeaturedPicker() }, 'Choisir'),
        h('button', { type: 'button', id: 'pe-featured-clear', class: 'btn btn-sm btn-outline', style: 'display:none',
          onclick: () => {
            this.handlers.onChange?.({ featured_image: null });
          }
        }, 'Retirer'),
      ),
    );
  }

  _openFeaturedPicker() {
    if (!window.parent?.openExternalMediaPicker) return;
    window.parent.openExternalMediaPicker((item) => {
      const payload = {
        id: item.id, url: item.url, alt: item.alt || '', title: item.title || '',
        width: item.width || null, height: item.height || null,
        sizes: { thumbnail: item.url, half: item.url, banner: item.url },
      };
      this.handlers.onChange?.({ featured_image: payload });
    }, 'image');
  }

  _renderGallery() {
    this.galleryRoot.replaceChildren(
      h('div', { id: 'pe-gallery-items', style: 'display:flex;flex-wrap:wrap;gap:6px' }),
      h('div', { style: 'margin-top:8px' },
        h('button', { type: 'button', class: 'btn btn-sm btn-outline', onclick: () => this._openGalleryPicker() }, 'Ajouter des images'),
      ),
    );
  }

  _openGalleryPicker() {
    if (!window.parent?.openExternalMediaPickerMultiple) return;
    window.parent.openExternalMediaPickerMultiple((items) => {
      const newItems = items.map(item => ({
        id: item.id, url: item.url, alt: item.alt || '', title: item.title || '',
        width: item.width || null, height: item.height || null,
      }));
      const merged = [...this._gallery, ...newItems];
      this._gallery = merged;
      this.handlers.onChangeGallery?.(merged);
      this._renderGalleryItems();
    }, 'image');
  }

  _removeGalleryItem(index) {
    this._gallery.splice(index, 1);
    this.handlers.onChangeGallery?.([...this._gallery]);
    this._renderGalleryItems();
  }

  _renderGalleryItems() {
    const container = qs('#pe-gallery-items', this.galleryRoot);
    if (!container) return;
    if (this._gallery.length === 0) {
      container.replaceChildren(h('span', { style: 'color:#999;font-size:13px' }, 'Aucune image'));
      return;
    }
    container.replaceChildren(
      ...this._gallery.map((item, i) => {
        const url = item.url || item;
        return h('div', { style: 'position:relative;display:inline-block' },
          h('img', { src: url, style: 'width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid #e0e0e0' }),
          h('button', { type: 'button',
            style: 'position:absolute;top:-6px;right:-6px;background:#e74c3c;color:#fff;border:0;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:18px;text-align:center',
            onclick: () => this._removeGalleryItem(i),
          }, '\u00d7'),
        );
      })
    );
  }
}
