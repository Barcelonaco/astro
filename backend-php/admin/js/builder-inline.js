// builder-inline.js — Inline editing (contenteditable) for the page builder
// Extracted from app.js (lines 10283-10863)

let _inlineToolbar = null;
let _inlineSourceTextarea = null;

function _prettifyHtmlSource(html) {
  return String(html || '')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\s*(<(p|h[1-6]|ul|ol|li|blockquote|div|figure|table|tr|td|th|thead|tbody|section|article|header|footer|nav|aside)[^>]*>)\s*/gi, '\n$1')
    .replace(/\s*(<\/(p|h[1-6]|ul|ol|li|blockquote|div|figure|table|tr|td|th|thead|tbody|section|article|header|footer|nav|aside)>)\s*/gi, '$1\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/^\s+|\s+$/g, '');
}

function _toggleInlineHtmlSource() {
  if (!_inlineEditingElement) return;
  const editor = _inlineEditingElement;
  const btn = _inlineToolbar && _inlineToolbar.querySelector('button[data-action="html"]');

  if (_inlineSourceTextarea) {
    // Switch back from HTML source → contenteditable
    const html = _inlineSourceTextarea.value;
    editor.innerHTML = html;
    if (_inlineEditingDataRef && _inlineEditingFieldName) {
      _inlineEditingDataRef[_inlineEditingFieldName] = html;
    }
    _inlineSourceTextarea.remove();
    window._inlineSourceTextarea = null;
    _inlineSourceTextarea = null;
    editor.style.display = '';
    if (btn) btn.classList.remove('active');
    editor.focus();
    return;
  }

  // Switch to HTML source view
  const ta = document.createElement('textarea');
  ta.className = 'inline-html-source';
  ta.spellcheck = false;
  ta.value = _prettifyHtmlSource(editor.innerHTML);
  editor.parentNode.insertBefore(ta, editor.nextSibling);
  editor.style.display = 'none';
  ta.addEventListener('input', () => {
    const v = ta.value;
    editor.innerHTML = v;
    if (_inlineEditingDataRef && _inlineEditingFieldName) {
      _inlineEditingDataRef[_inlineEditingFieldName] = v;
    }
    markBuilderDirty();
  });
  ta.addEventListener('blur', _handleInlineBlur);
  window._inlineSourceTextarea = ta;
  _inlineSourceTextarea = ta;
  if (btn) btn.classList.add('active');
  ta.focus();
}

function _createInlineToolbar() {
  if (_inlineToolbar) return _inlineToolbar;
  const bar = document.createElement('div');
  bar.className = 'inline-toolbar';
  bar.innerHTML = `
    <select class="inline-toolbar-select" data-action="formatBlock" title="Style">
      <option value="p">Paragraphe</option>
      <option value="h1">Titre 1</option>
      <option value="h2">Titre 2</option>
      <option value="h3">Titre 3</option>
      <option value="h4">Titre 4</option>
      <option value="h5">Titre 5</option>
      <option value="h6">Mention</option>
    </select>
    <span class="inline-toolbar-sep"></span>
    <button type="button" data-cmd="bold" title="Gras (Ctrl+B)"><b>B</b></button>
    <button type="button" data-cmd="italic" title="Italique (Ctrl+I)"><i>I</i></button>
    <button type="button" data-cmd="strikeThrough" title="Barré"><s>S</s></button>
    <span class="inline-toolbar-sep"></span>
    <button type="button" data-cmd="insertUnorderedList" title="Liste à puces"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="2" fill="currentColor"/><circle cx="4" cy="12" r="2" fill="currentColor"/><circle cx="4" cy="18" r="2" fill="currentColor"/></svg></button>
    <button type="button" data-cmd="insertOrderedList" title="Liste numérotée"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="1" y="7" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">1</text><text x="1" y="13" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">2</text><text x="1" y="19" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">3</text></svg></button>
    <span class="inline-toolbar-sep"></span>
    <button type="button" data-cmd="formatBlock" data-value="blockquote" title="Citation"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg></button>
    <span class="inline-toolbar-sep"></span>
    <button type="button" data-cmd="justifyLeft" title="Aligner à gauche"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg></button>
    <button type="button" data-cmd="justifyCenter" title="Centrer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg></button>
    <button type="button" data-cmd="justifyRight" title="Aligner à droite"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg></button>
    <span class="inline-toolbar-sep"></span>
    <button type="button" data-cmd="createLink" title="Lien"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>
    <span class="inline-toolbar-sep"></span>
    <button type="button" data-cmd="indent" data-value="outdent" title="Diminuer le retrait"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="4" x2="21" y2="4"/><line x1="11" y1="9" x2="21" y2="9"/><line x1="11" y1="14" x2="21" y2="14"/><line x1="3" y1="19" x2="21" y2="19"/><polyline points="7 14 3 11.5 7 9"/></svg></button>
    <button type="button" data-cmd="indent" data-value="indent" title="Augmenter le retrait"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="4" x2="21" y2="4"/><line x1="11" y1="9" x2="21" y2="9"/><line x1="11" y1="14" x2="21" y2="14"/><line x1="3" y1="19" x2="21" y2="19"/><polyline points="3 9 7 11.5 3 14"/></svg></button>
    <span class="inline-toolbar-sep"></span>
    <button type="button" data-cmd="removeFormat" title="Supprimer le formatage"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16"/><path d="M10 4v3"/><path d="M8 21l4-14"/><path d="M3 21h6"/><line x1="18" y1="5" x2="22" y2="9"/><line x1="22" y1="5" x2="18" y2="9"/></svg></button>
    <span class="inline-toolbar-sep"></span>
    <button type="button" data-action="html" title="Voir le HTML"><span class="inline-toolbar-html-icon">&lt;/&gt;</span></button>
  `;
  bar.style.display = 'none';
  document.body.appendChild(bar);

  // Handle button clicks
  bar.addEventListener('mousedown', (e) => {
    // Let the <select> dropdown work normally (don't preventDefault)
    if (e.target.closest('select')) return;
    e.preventDefault(); // Prevent blur on the contenteditable
    // HTML source toggle (separate from execCommand buttons)
    const htmlBtn = e.target.closest('button[data-action="html"]');
    if (htmlBtn) {
      _toggleInlineHtmlSource();
      return;
    }
    const btn = e.target.closest('button[data-cmd]');
    if (btn) {
      const cmd = btn.dataset.cmd;
      if (cmd === 'createLink') {
        _showInlineLinkDialog();
        return; // don't _updateToolbarState yet — dialog handles it
      } else if (cmd === 'formatBlock') {
        document.execCommand('formatBlock', false, btn.dataset.value);
      } else if (cmd === 'indent') {
        document.execCommand(btn.dataset.value === 'outdent' ? 'outdent' : 'indent', false, null);
      } else {
        document.execCommand(cmd, false, null);
      }
      _updateToolbarState();
      if (_inlineEditingElement) _syncInlineContentToBlockData(_inlineEditingElement);
    }
  });

  // Handle heading select
  bar.querySelector('.inline-toolbar-select').addEventListener('change', (e) => {
    const tag = e.target.value;
    document.execCommand('formatBlock', false, tag);
    _updateToolbarState();
    if (_inlineEditingElement) _syncInlineContentToBlockData(_inlineEditingElement);
    if (_inlineEditingElement) _inlineEditingElement.focus();
  });

  window._inlineToolbar = bar;
  _inlineToolbar = bar;
  return bar;
}

let _inlineLinkDialog = null;
let _savedSelection = null;

function _saveSelection() {
  const sel = window.getSelection();
  if (sel.rangeCount > 0) {
    window._savedSelection = sel.getRangeAt(0).cloneRange();
    _savedSelection = window._savedSelection;
  }
}

function _restoreSelection() {
  if (_savedSelection) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(_savedSelection);
    window._savedSelection = null;
    _savedSelection = null;
  }
}

function _showInlineLinkDialog() {
  _saveSelection();
  // Check if selection is inside an existing link
  const sel = window.getSelection();
  let existingUrl = '';
  let existingLink = null;
  if (sel.rangeCount > 0) {
    let node = sel.anchorNode;
    while (node && node !== _inlineEditingElement) {
      if (node.nodeType === 1 && node.tagName === 'A') {
        existingLink = node;
        existingUrl = node.getAttribute('href') || '';
        break;
      }
      node = node.parentNode;
    }
  }

  _closeInlineLinkDialog();
  const dialog = document.createElement('div');
  dialog.className = 'inline-link-dialog';
  dialog.innerHTML = `
    <input type="text" class="link-url-input" placeholder="https://..." value="${existingUrl.replace(/"/g, '&quot;')}">
    <button type="button" class="link-save-btn">OK</button>
    ${existingLink ? '<button type="button" class="link-remove-btn">Supprimer</button>' : ''}
    <button type="button" class="link-cancel-btn">Annuler</button>
  `;
  document.body.appendChild(dialog);
  window._inlineLinkDialog = dialog;
  _inlineLinkDialog = dialog;

  // Position below toolbar
  if (_inlineToolbar) {
    const tbRect = _inlineToolbar.getBoundingClientRect();
    dialog.style.left = tbRect.left + 'px';
    dialog.style.top = (tbRect.bottom + 4) + 'px';
    requestAnimationFrame(() => {
      const dRect = dialog.getBoundingClientRect();
      if (dRect.right > window.innerWidth - 4) {
        dialog.style.left = (window.innerWidth - dRect.width - 4) + 'px';
      }
      if (dRect.left < 4) dialog.style.left = '4px';
    });
  }

  const input = dialog.querySelector('.link-url-input');
  input.focus();
  input.select();

  const applyLink = () => {
    const url = input.value.trim();
    _restoreSelection();
    if (url) {
      document.execCommand('createLink', false, url);
    }
    _closeInlineLinkDialog();
    _updateToolbarState();
    if (_inlineEditingElement) {
      _syncInlineContentToBlockData(_inlineEditingElement);
      _inlineEditingElement.focus();
    }
  };

  dialog.querySelector('.link-save-btn').addEventListener('mousedown', (e) => {
    e.preventDefault();
    applyLink();
  });

  if (existingLink) {
    dialog.querySelector('.link-remove-btn').addEventListener('mousedown', (e) => {
      e.preventDefault();
      _restoreSelection();
      document.execCommand('unlink', false, null);
      _closeInlineLinkDialog();
      _updateToolbarState();
      if (_inlineEditingElement) {
        _syncInlineContentToBlockData(_inlineEditingElement);
        _inlineEditingElement.focus();
      }
    });
  }

  dialog.querySelector('.link-cancel-btn').addEventListener('mousedown', (e) => {
    e.preventDefault();
    _closeInlineLinkDialog();
    _restoreSelection();
    if (_inlineEditingElement) _inlineEditingElement.focus();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
    if (e.key === 'Escape') {
      e.preventDefault();
      _closeInlineLinkDialog();
      _restoreSelection();
      if (_inlineEditingElement) _inlineEditingElement.focus();
    }
  });
}

function _closeInlineLinkDialog() {
  if (_inlineLinkDialog) {
    _inlineLinkDialog.remove();
    window._inlineLinkDialog = null;
    _inlineLinkDialog = null;
  }
}

function _showInlineToolbar(card, txtEditor) {
  const bar = _createInlineToolbar();
  if (!txtEditor) txtEditor = card.querySelector('.builder-block-render .txt.editor');
  if (!txtEditor) return;
  // Position the toolbar above the text editor
  const rect = txtEditor.getBoundingClientRect();
  bar.style.display = 'flex';
  bar.style.position = 'fixed';
  bar.style.left = rect.left + 'px';
  bar.style.top = (rect.top - bar.offsetHeight - 8) + 'px';
  // Clamp to viewport
  requestAnimationFrame(() => {
    const barRect = bar.getBoundingClientRect();
    if (barRect.top < 4) {
      bar.style.top = (rect.bottom + 8) + 'px';
    }
    if (barRect.right > window.innerWidth - 4) {
      bar.style.left = (window.innerWidth - barRect.width - 4) + 'px';
    }
    if (barRect.left < 4) {
      bar.style.left = '4px';
    }
  });
}

function _hideInlineToolbar() {
  if (_inlineToolbar) _inlineToolbar.style.display = 'none';
}

function _updateToolbarState() {
  if (!_inlineToolbar) return;
  _inlineToolbar.querySelectorAll('button[data-cmd]').forEach(btn => {
    const cmd = btn.dataset.cmd;
    if (['bold', 'italic', 'underline', 'strikeThrough', 'insertOrderedList', 'insertUnorderedList'].includes(cmd)) {
      btn.classList.toggle('active', document.queryCommandState(cmd));
    }
  });
  // Update alignment active state
  ['justifyLeft', 'justifyCenter', 'justifyRight'].forEach(cmd => {
    const btn = _inlineToolbar.querySelector(`button[data-cmd="${cmd}"]`);
    if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
  });
  // Update heading select
  const select = _inlineToolbar.querySelector('.inline-toolbar-select');
  if (select) {
    const blockTag = document.queryCommandValue('formatBlock').toLowerCase().replace(/[<>]/g, '');
    select.value = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(blockTag) ? blockTag : 'p';
  }
}

/**
 * Enable inline editing on a .txt.editor element.
 * @param {string} blockId - the top-level block id (or parent ColumnsTab block id)
 * @param {HTMLElement} [targetTxtEditor] - optional: the specific .txt.editor element (for sub-modules in columns)
 * @param {object} [dataRef] - optional: direct reference to the sub-module data object
 */
function enableInlineEditing(blockId, targetTxtEditor, dataRef, fieldName) {
  const block = pageBuilderState.blocks.find(b => b.id === blockId);
  if (!block) return;

  const card = document.querySelector(`.builder-block-card[data-block-id="${blockId}"]`);
  if (!card) return;

  // If no specific target provided, check that this is a TextSimple block
  if (!targetTxtEditor) {
    const def = BLOCK_TYPES[block.type] || {};
    const moduleName = def.moduleName || block.type;
    if (moduleName !== 'TextSimple') return;
    targetTxtEditor = card.querySelector('.builder-block-render .txt.editor');
    dataRef = block.data;
  }

  if (!targetTxtEditor) return;

  // Already inline-editing this exact element
  if (_inlineEditingElement === targetTxtEditor) return;

  // Disable any previous inline editing
  disableInlineEditing();

  window._inlineEditingBlockId = blockId;
  window._inlineEditingFieldName = fieldName || 'text';
  window._inlineEditingDataRef = dataRef || block.data;
  window._inlineEditingElement = targetTxtEditor;

  targetTxtEditor.setAttribute('contenteditable', 'true');
  card.classList.add('is-inline-editing');
  card.setAttribute('draggable', 'false');
  targetTxtEditor.focus();

  // Show the formatting toolbar
  _showInlineToolbar(card, targetTxtEditor);

  targetTxtEditor.addEventListener('input', _handleInlineInput);
  targetTxtEditor.addEventListener('blur', _handleInlineBlur);
  targetTxtEditor.addEventListener('keydown', _handleInlineKeydown);
  targetTxtEditor.addEventListener('paste', _handleInlinePaste);
  document.addEventListener('selectionchange', _updateToolbarState);
}

function disableInlineEditing() {
  if (!_inlineEditingBlockId) return;
  _closeInlineLinkDialog();

  // If in HTML source mode, sync textarea content back into the contenteditable first
  if (_inlineSourceTextarea && _inlineEditingElement) {
    _inlineEditingElement.innerHTML = _inlineSourceTextarea.value;
    _inlineEditingElement.style.display = '';
    _inlineSourceTextarea.remove();
    window._inlineSourceTextarea = null;
    _inlineSourceTextarea = null;
    const htmlBtn = _inlineToolbar && _inlineToolbar.querySelector('button[data-action="html"]');
    if (htmlBtn) htmlBtn.classList.remove('active');
  }

  if (_inlineEditingElement) {
    _syncInlineContentToBlockData(_inlineEditingElement);
    _inlineEditingElement.removeAttribute('contenteditable');
    _inlineEditingElement.removeEventListener('input', _handleInlineInput);
    _inlineEditingElement.removeEventListener('blur', _handleInlineBlur);
    _inlineEditingElement.removeEventListener('keydown', _handleInlineKeydown);
    _inlineEditingElement.removeEventListener('paste', _handleInlinePaste);
  }

  const card = document.querySelector(`.builder-block-card[data-block-id="${_inlineEditingBlockId}"]`);
  if (card) {
    card.classList.remove('is-inline-editing');
    card.setAttribute('draggable', 'true');
  }

  // Hide toolbar
  _hideInlineToolbar();
  document.removeEventListener('selectionchange', _updateToolbarState);

  // Sync final content to settings panel Quill (if open)
  _syncInlineToSettingsPanelQuill();

  const prevBlockId = _inlineEditingBlockId;
  window._inlineEditingBlockId = null;
  window._inlineEditingFieldName = null;
  window._inlineEditingDataRef = null;
  window._inlineEditingElement = null;

  // Now that inline editing is off, do a full preview re-render
  if (prevBlockId) updateBlockCardPreview(prevBlockId);
}

function _handleInlineInput(e) {
  markBuilderDirty();
  _syncInlineContentToBlockData(e.target);
  // Don't sync to Quill on every keystroke — it triggers text-change → liveUpdate
  // which overwrites block.data.text with stale Quill content.
  // Quill is synced only when inline editing ends (disableInlineEditing).
}

function _handleInlineBlur() {
  // Delay to allow clicking inside the toolbar or the same card
  setTimeout(() => {
    if (!_inlineEditingBlockId) return;
    const active = document.activeElement;
    // If focus moved to the toolbar, don't disable — user is formatting
    if (_inlineToolbar && _inlineToolbar.contains(active)) return;
    // If focus is still inside the editing element, don't disable
    if (_inlineEditingElement && (_inlineEditingElement === active || _inlineEditingElement.contains(active))) return;
    // If focus moved to the HTML source textarea, don't disable
    if (_inlineSourceTextarea && _inlineSourceTextarea === active) return;
    // If focus moved to the link dialog, don't disable
    if (_inlineLinkDialog && _inlineLinkDialog.contains(active)) return;
    // Focus left the editing zone — disable inline editing
    disableInlineEditing();
  }, 150);
}

function _handleInlineKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    disableInlineEditing();
  }
}

function _handleInlinePaste(e) {
  e.preventDefault();
  const html = e.clipboardData.getData('text/html');
  const text = e.clipboardData.getData('text/plain');
  let clean = '';
  if (html) {
    // Parse pasted HTML, keep only structure (headings, paragraphs, lists, line breaks)
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    clean = _cleanPastedHTML(tmp);
  } else {
    // Plain text: convert line breaks to paragraphs
    clean = text.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  }
  document.execCommand('insertHTML', false, clean);
}

function _cleanPastedHTML(el) {
  const allowedBlocks = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BR', 'BLOCKQUOTE'];
  const allowedInline = ['A', 'BR'];
  let result = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = node.textContent;
      if (txt.trim()) result += txt;
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = node.tagName;
    if (allowedBlocks.includes(tag)) {
      const inner = _cleanPastedInline(node);
      if (tag === 'UL' || tag === 'OL') {
        const items = Array.from(node.querySelectorAll('li')).map(li => `<li>${_cleanPastedInline(li)}</li>`).join('');
        result += `<${tag.toLowerCase()}>${items}</${tag.toLowerCase()}>`;
      } else {
        result += `<${tag.toLowerCase()}>${inner}</${tag.toLowerCase()}>`;
      }
    } else if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'SPAN' || tag === 'FONT' || tag === 'B' || tag === 'I' || tag === 'U' || tag === 'STRONG' || tag === 'EM') {
      // Unwrap container/inline elements, recurse into children
      const inner = _cleanPastedHTML(node);
      if (inner.trim()) {
        // If the result doesn't start with a block tag, wrap in <p>
        if (!/^<(p|h[1-6]|ul|ol|blockquote)/i.test(inner.trim())) {
          result += `<p>${inner}</p>`;
        } else {
          result += inner;
        }
      }
    } else {
      // Unknown tag — extract text content as paragraph
      const txt = node.textContent.trim();
      if (txt) result += `<p>${txt}</p>`;
    }
  }
  return result;
}

function _cleanPastedInline(el) {
  let result = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName === 'BR') {
        result += '<br>';
      } else if (node.tagName === 'A' && node.href) {
        result += `<a href="${node.getAttribute('href')}">${_cleanPastedInline(node)}</a>`;
      } else {
        // Strip inline formatting (bold, italic, spans, etc.) — keep text only
        result += _cleanPastedInline(node);
      }
    }
  }
  return result;
}

function _syncInlineContentToBlockData(txtEditorEl) {
  if (!_inlineEditingBlockId || !_inlineEditingFieldName) return;
  const dataObj = _inlineEditingDataRef;
  if (!dataObj || typeof dataObj !== 'object') return;
  dataObj[_inlineEditingFieldName] = txtEditorEl.innerHTML;
}

function _findSubModuleQuillId(block, dataRef, fieldName) {
  const columnsList = block.data?.columns_list;
  if (!Array.isArray(columnsList)) return null;
  for (let ci = 0; ci < columnsList.length; ci++) {
    const subModules = columnsList[ci]?.columns_module;
    if (!Array.isArray(subModules)) continue;
    for (let si = 0; si < subModules.length; si++) {
      if (subModules[si] === dataRef) {
        const compoundName = `columns_list::${ci}::columns_module::${si}::${fieldName}`;
        return `wysiwyg-${block.id}-${compoundName}`.replace(/[^a-zA-Z0-9_-]/g, '-');
      }
    }
  }
  return null;
}

function _syncInlineToSettingsPanelQuill() {
  if (!_inlineEditingBlockId || !_inlineEditingFieldName) return;
  const block = pageBuilderState.blocks.find(b => b.id === _inlineEditingBlockId);
  if (!block) return;

  let editorId = `wysiwyg-${block.id}-${_inlineEditingFieldName}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  let quill = _quillInstances.get(editorId);
  // Sub-module inside columns → Quill ID uses compound name
  if (!quill && _inlineEditingDataRef && _inlineEditingDataRef !== block.data) {
    const subId = _findSubModuleQuillId(block, _inlineEditingDataRef, _inlineEditingFieldName);
    if (subId) {
      editorId = subId;
      quill = _quillInstances.get(subId);
    }
  }
  const dataRef = _inlineEditingDataRef || block.data;
  const html = dataRef[_inlineEditingFieldName] || '';

  if (!quill) {
    // Quill not initialized yet (lazy init) — update DOM directly so
    // Quill picks up the correct content when it initializes later.
    const el = document.getElementById(editorId);
    if (el) el.innerHTML = html;
    const textarea = el?.parentElement?.querySelector('.wysiwyg-source');
    if (textarea) textarea.value = html;
    return;
  }

  // Prevent circular update
  quill._syncingFromInline = true;
  // Set innerHTML directly — dangerouslyPasteHTML goes through clipboard
  // matchers that strip bold/italic/color, causing formatting loss.
  quill.root.innerHTML = html || '<p><br></p>';
  quill.update('silent');

  // Also update the hidden textarea
  const el = document.getElementById(editorId);
  const textarea = el?.parentElement?.querySelector('.wysiwyg-source');
  if (textarea) textarea.value = html;

  quill._syncingFromInline = false;
}

// ── Expose on window ────────────────────────────────────────────────────────
Object.assign(window, {
  _prettifyHtmlSource,
  _toggleInlineHtmlSource,
  _createInlineToolbar,
  _saveSelection,
  _restoreSelection,
  _showInlineLinkDialog,
  _closeInlineLinkDialog,
  _showInlineToolbar,
  _hideInlineToolbar,
  _updateToolbarState,
  enableInlineEditing,
  disableInlineEditing,
  _handleInlineInput,
  _handleInlineBlur,
  _handleInlineKeydown,
  _handleInlinePaste,
  _cleanPastedHTML,
  _cleanPastedInline,
  _syncInlineContentToBlockData,
  _findSubModuleQuillId,
  _syncInlineToSettingsPanelQuill,
});
