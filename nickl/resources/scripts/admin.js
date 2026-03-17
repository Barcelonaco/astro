(function () {
  "use strict";
  const ADD_SELECTOR = '[data-name="add-layout"], .acf-fc-add, .acf-button-add';

  let lastClicked = {
    time: 0,
    btn: null,
    depth: 0,
    flex: null
  };

  function countAncestorMatches(el, selector) {
    let count = 0;
    let p = el;
    while (p && p !== document) {
      if (p.matches && p.matches(selector)) count++;
      p = p.parentElement;
    }
    return count;
  }

  document.addEventListener("click", function (e) {
    const btn = e.target.closest(ADD_SELECTOR);
    if (!btn) return;

    lastClicked.time = Date.now();
    lastClicked.btn = btn;
    lastClicked.depth = countAncestorMatches(btn, ".acf-field-flexible-content");
    lastClicked.flex = btn.closest(".acf-field-flexible-content") || null;
  }, true);

  function organizeTooltipParent(tooltip) {
    if (!tooltip) return;
    if (tooltip.querySelector(".custom-columns")) return; // Déjà traité
    const ul = tooltip.querySelector("ul");
    if (!ul) return;
    const items = [...ul.querySelectorAll("li")];
    console.log(items);
    if (items.length === 0) return;

    let groups;
    if (window.nicklConfig && window.nicklConfig.NICKL_PDV !== "NICKL") {
      groups = [
        items.slice(0, 9),
        items.slice(9, 18),
        items.slice(18, 26),
        items.slice(26, 35),
        items.slice(35)
      ];
    } else if (window.nicklConfig && window.nicklConfig.is_woocommerce) {
      groups = [
        items.slice(0, 9),
        items.slice(9, 18),
        items.slice(18, 27),
        items.slice(27)
      ];
    } else {
      groups = [
        items.slice(0, 9),
        items.slice(9, 18),
        items.slice(18, 26),
        items.slice(26)
      ];
    }
    let titles;
    if (window.nicklConfig && window.nicklConfig.NICKL_PDV === "PDV") {
      titles = ["Les classiques", "Contenus", "Médias", "Spéciaux", "Place du village"];
    } else if (window.nicklConfig && window.nicklConfig.NICKL_PDV === "INDUS") {
      titles = ["Les classiques", "Contenus", "Médias", "Spéciaux", "Truc"];
    }

    const icons = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM248 320C234.7 320 224 330.7 224 344C224 357.3 234.7 368 248 368L392 368C405.3 368 416 357.3 416 344C416 330.7 405.3 320 392 320L248 320zM248 416C234.7 416 224 426.7 224 440C224 453.3 234.7 464 248 464L392 464C405.3 464 416 453.3 416 440C416 426.7 405.3 416 392 416L248 416z"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M128 160C128 124.7 156.7 96 192 96L512 96C547.3 96 576 124.7 576 160L576 416C576 451.3 547.3 480 512 480L192 480C156.7 480 128 451.3 128 416L128 160zM56 192C69.3 192 80 202.7 80 216L80 512C80 520.8 87.2 528 96 528L456 528C469.3 528 480 538.7 480 552C480 565.3 469.3 576 456 576L96 576C60.7 576 32 547.3 32 512L32 216C32 202.7 42.7 192 56 192zM224 224C241.7 224 256 209.7 256 192C256 174.3 241.7 160 224 160C206.3 160 192 174.3 192 192C192 209.7 206.3 224 224 224zM420.5 235.5C416.1 228.4 408.4 224 400 224C391.6 224 383.9 228.4 379.5 235.5L323.2 327.6L298.7 297C294.1 291.3 287.3 288 280 288C272.7 288 265.8 291.3 261.3 297L197.3 377C191.5 384.2 190.4 394.1 194.4 402.4C198.4 410.7 206.8 416 216 416L488 416C496.7 416 504.7 411.3 508.9 403.7C513.1 396.1 513 386.9 508.4 379.4L420.4 235.4z"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M305 151.1L320 171.8L335 151.1C360 116.5 400.2 96 442.9 96C516.4 96 576 155.6 576 229.1L576 231.7C576 343.9 436.1 474.2 363.1 529.9C350.7 539.3 335.5 544 320 544C304.5 544 289.2 539.4 276.9 529.9C203.9 474.2 64 343.9 64 231.7L64 229.1C64 155.6 123.6 96 197.1 96C239.8 96 280 116.5 305 151.1z"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M341.5 45.1C337.4 37.1 329.1 32 320.1 32C311.1 32 302.8 37.1 298.7 45.1L225.1 189.3L65.2 214.7C56.3 216.1 48.9 222.4 46.1 231C43.3 239.6 45.6 249 51.9 255.4L166.3 369.9L141.1 529.8C139.7 538.7 143.4 547.7 150.7 553C158 558.3 167.6 559.1 175.7 555L320.1 481.6L464.4 555C472.4 559.1 482.1 558.3 489.4 553C496.7 547.7 500.4 538.8 499 529.8L473.7 369.9L588.1 255.4C594.5 249 596.7 239.6 593.9 231C591.1 222.4 583.8 216.1 574.8 214.7L415 189.3L341.5 45.1z"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.0.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M341.8 72.6C329.5 61.2 310.5 61.2 298.3 72.6L74.3 280.6C64.7 289.6 61.5 303.5 66.3 315.7C71.1 327.9 82.8 336 96 336L112 336L112 512C112 547.3 140.7 576 176 576L464 576C499.3 576 528 547.3 528 512L528 336L544 336C557.2 336 569 327.9 573.8 315.7C578.6 303.5 575.4 289.5 565.8 280.6L341.8 72.6zM304 384L336 384C362.5 384 384 405.5 384 432L384 528L256 528L256 432C256 405.5 277.5 384 304 384z"/></svg>'
    ];

    const container = document.createElement("div");
    container.classList.add("custom-columns");
    container.classList.add(`columns-${groups.length}`);

    groups.forEach((group, i) => {
      if (group.length === 0) return;
      const col = document.createElement("div");
      col.classList.add("list-column");
      const h3 = document.createElement("h3");
      h3.innerHTML = (icons[i] || "") + " " + (titles[i] || "");
      col.appendChild(h3);
      const newUl = document.createElement("ul");
      group.forEach(li => newUl.appendChild(li));
      col.appendChild(newUl);
      container.appendChild(col);
    });

    ul.replaceWith(container);
  }

  function organizeTooltipChild(tooltip) {
    if (!tooltip) return;
    if (tooltip.querySelector(".custom-columns")) return; // Déjà traité
    const ul = tooltip.querySelector("ul");
    if (!ul) return;
    const items = [...ul.querySelectorAll("li")];
    if (items.length === 0) return;

    let groups;
    if (window.nicklConfig && window.nicklConfig.NICKL_PDV !== "NICKL") {
      groups = [
        items.slice(0, 5),
        items.slice(5, 13),
        items.slice(13, 19),
        items.slice(19, 26),
        items.slice(26)
      ];
    } else {
      groups = [
        items.slice(0, 5),
        items.slice(5, 13),
        items.slice(13, 19),
        items.slice(19)
      ];
    }
    let titles;
    if (window.nicklConfig && window.nicklConfig.NICKL_PDV === "PDV") {
      titles = ["Les classiques", "Contenus", "Médias", "Spéciaux", "Place du village"];
    } else if (window.nicklConfig && window.nicklConfig.NICKL_PDV === "INDUS") {
      titles = ["Les classiques", "Contenus", "Médias", "Spéciaux", "Truc"];
    }
    const icons = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M305 151.1L320 171.8L335 151.1C360 116.5 400.2 96 442.9 96C516.4 96 576 155.6 576 229.1L576 231.7C576 343.9 436.1 474.2 363.1 529.9C350.7 539.3 335.5 544 320 544C304.5 544 289.2 539.4 276.9 529.9C203.9 474.2 64 343.9 64 231.7L64 229.1C64 155.6 123.6 96 197.1 96C239.8 96 280 116.5 305 151.1z"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM248 320C234.7 320 224 330.7 224 344C224 357.3 234.7 368 248 368L392 368C405.3 368 416 357.3 416 344C416 330.7 405.3 320 392 320L248 320zM248 416C234.7 416 224 426.7 224 440C224 453.3 234.7 464 248 464L392 464C405.3 464 416 453.3 416 440C416 426.7 405.3 416 392 416L248 416z"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M128 160C128 124.7 156.7 96 192 96L512 96C547.3 96 576 124.7 576 160L576 416C576 451.3 547.3 480 512 480L192 480C156.7 480 128 451.3 128 416L128 160zM56 192C69.3 192 80 202.7 80 216L80 512C80 520.8 87.2 528 96 528L456 528C469.3 528 480 538.7 480 552C480 565.3 469.3 576 456 576L96 576C60.7 576 32 547.3 32 512L32 216C32 202.7 42.7 192 56 192zM224 224C241.7 224 256 209.7 256 192C256 174.3 241.7 160 224 160C206.3 160 192 174.3 192 192C192 209.7 206.3 224 224 224zM420.5 235.5C416.1 228.4 408.4 224 400 224C391.6 224 383.9 228.4 379.5 235.5L323.2 327.6L298.7 297C294.1 291.3 287.3 288 280 288C272.7 288 265.8 291.3 261.3 297L197.3 377C191.5 384.2 190.4 394.1 194.4 402.4C198.4 410.7 206.8 416 216 416L488 416C496.7 416 504.7 411.3 508.9 403.7C513.1 396.1 513 386.9 508.4 379.4L420.4 235.4z"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M341.5 45.1C337.4 37.1 329.1 32 320.1 32C311.1 32 302.8 37.1 298.7 45.1L225.1 189.3L65.2 214.7C56.3 216.1 48.9 222.4 46.1 231C43.3 239.6 45.6 249 51.9 255.4L166.3 369.9L141.1 529.8C139.7 538.7 143.4 547.7 150.7 553C158 558.3 167.6 559.1 175.7 555L320.1 481.6L464.4 555C472.4 559.1 482.1 558.3 489.4 553C496.7 547.7 500.4 538.8 499 529.8L473.7 369.9L588.1 255.4C594.5 249 596.7 239.6 593.9 231C591.1 222.4 583.8 216.1 574.8 214.7L415 189.3L341.5 45.1z"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.0.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M341.8 72.6C329.5 61.2 310.5 61.2 298.3 72.6L74.3 280.6C64.7 289.6 61.5 303.5 66.3 315.7C71.1 327.9 82.8 336 96 336L112 336L112 512C112 547.3 140.7 576 176 576L464 576C499.3 576 528 547.3 528 512L528 336L544 336C557.2 336 569 327.9 573.8 315.7C578.6 303.5 575.4 289.5 565.8 280.6L341.8 72.6zM304 384L336 384C362.5 384 384 405.5 384 432L384 528L256 528L256 432C256 405.5 277.5 384 304 384z"/></svg>'
    ];

    const container = document.createElement("div");
    container.classList.add("custom-columns");
    container.classList.add(`columns-${groups.length}`);

    groups.forEach((group, i) => {
      if (group.length === 0) return;
      const col = document.createElement("div");
      col.classList.add("list-column");
      const h3 = document.createElement("h3");
      h3.innerHTML = (icons[i] || "") + " " + (titles[i] || "");
      col.appendChild(h3);
      const newUl = document.createElement("ul");
      group.forEach(li => newUl.appendChild(li));
      col.appendChild(newUl);
      container.appendChild(col);
    });

    ul.replaceWith(container);
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (!node.matches(".acf-tooltip")) return;
        if (node.classList.contains("acf-more-layout-actions")) return;
        if (!node.querySelector("ul")) return;

        const now = Date.now();
        const linked = lastClicked.time && (now - lastClicked.time) < 1500;
        const depth = lastClicked.depth || 0;

        if (linked && depth >= 2) {
          organizeTooltipChild(node);
        } else {
          organizeTooltipParent(node);
        }

        lastClicked = { time: 0, btn: null, depth: 0, flex: null };
      });
    });
  });

  document.addEventListener("click", function (e) {
    const trigger = e.target.closest(".ia-command-trigger");
    if (!trigger) return;

    const command = trigger.getAttribute("data-command");
    if (!command) return;

    const textarea = document.querySelector(".ia-prompt-input textarea");
    if (!textarea) return;

    if (textarea.value.trim() === "") {
      textarea.value = command + " ";
    } else {
      textarea.value += "\n" + command + " ";
    }
    textarea.focus();

    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  });

  observer.observe(document.body, { childList: true, subtree: true });

})();

(function ($) {
  if (typeof acf === 'undefined') return;

  function refreshColumnDisplay() {
    $('.acf-field[data-name="columns_list"]').each(function () {
      const $repeater = $(this);
      const $layout = $repeater.closest('.acf-fields');
      const $displayField = $layout.find('.acf-field[data-name="columns_display"]');
      const count = $repeater.find('> .acf-input > .acf-repeater > table > tbody > .acf-row:not(.acf-clone)').length;

      if (count === 2) {
        $displayField.removeClass('hidden-by-js').show().css('display', 'block');
      } else {
        $displayField.addClass('hidden-by-js').hide().css('display', 'none');
      }
    });
  }

  acf.addAction('ready', refreshColumnDisplay);
  acf.addAction('append', refreshColumnDisplay);
  acf.addAction('remove', refreshColumnDisplay);

  // On ajoute un écouteur sur le tri (drag & drop) au cas où
  acf.addAction('sortstop', refreshColumnDisplay);
})(jQuery);
