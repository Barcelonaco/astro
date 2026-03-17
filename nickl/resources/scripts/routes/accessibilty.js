// accessibility.js
import { setCookie, getCookie, removeCookie } from "./cookie-utils";

const Accessibility = (() => {
  let clicks = 0; // 0..5
  const FONT_CLASSES = ["", "fontSizeMore1", "fontSizeMore2", "fontSizeMore3", "fontSizeMore4", "fontSizeMore5"];

  const inferClicksFromClass = () => {
    const html = document.documentElement;
    for (let i = FONT_CLASSES.length - 1; i >= 1; i--) {
      if (html.classList.contains(FONT_CLASSES[i])) return i;
    }
    return 0;
  };

  const applyFontSize = (level) => {
    const html = document.documentElement;
    for (let i = 1; i < FONT_CLASSES.length; i++) html.classList.remove(FONT_CLASSES[i]);
    if (level >= 1 && level <= 5) {
      html.classList.add(FONT_CLASSES[level]);
      setCookie("accessibilityFontSize", FONT_CLASSES[level], { expires: 182, path: "/" });
    } else {
      removeCookie("accessibilityFontSize", { path: "/" });
    }
    clicks = level;
  };

  const resetFontSize = () => applyFontSize(0);

  const applySavedFontSize = () => {
    const cls = getCookie("accessibilityFontSize");
    if (cls && FONT_CLASSES.includes(cls)) {
      document.documentElement.classList.add(cls);
      clicks = inferClicksFromClass();
    } else {
      clicks = 0;
    }
  };

  const applySavedColor = () => {
    const cls = getCookie("accessibilityColor");
    if (cls && ["negativeColor", "white_on_black", "black_on_white"].includes(cls)) {
      document.documentElement.classList.add(cls);
    }
  };

  const setColor = (target) => {
    const html = document.documentElement;
    html.classList.remove("negativeColor", "white_on_black", "black_on_white");
    if (target) {
      html.classList.add(target);
      setCookie("accessibilityColor", target, { expires: 182, path: "/" });
    } else {
      removeCookie("accessibilityColor", { path: "/" });
    }
  };

  const resetAll = () => {
    setColor(null);
    resetFontSize();
  };

  const bindUI = () => {
    const btnOpen  = document.querySelector(".jsAccessibilityOpen");
    const btnClose = document.querySelector(".jsAccessibilityClose");
    const panel    = document.querySelector(".accessibility");

    if (btnOpen && panel) btnOpen.addEventListener("click", () => panel.classList.add("active"));
    if (btnClose && panel) btnClose.addEventListener("click", () => panel.classList.remove("active"));

    const btnMore  = document.querySelector(".jsFontSizeMore");
    const btnLess  = document.querySelector(".jsFontSizeLess");
    const btnReset = document.querySelector(".jsFontSizeReset");

    if (btnMore)  btnMore.addEventListener("click", () => applyFontSize(Math.min(5, clicks + 1)));
    if (btnLess)  btnLess.addEventListener("click", () => applyFontSize(Math.max(0, clicks - 1)));
    if (btnReset) btnReset.addEventListener("click", resetFontSize);

    const jsColorNegative = document.querySelector(".jsColorNegative");
    const jsColorNB = document.querySelector(".jsColorNB"); // noir sur blanc
    const jsColorBN = document.querySelector(".jsColorBN"); // blanc sur noir

    if (jsColorNegative) jsColorNegative.addEventListener("click", () => setColor("negativeColor"));
    if (jsColorNB)       jsColorNB.addEventListener("click",       () => setColor("black_on_white"));
    if (jsColorBN)       jsColorBN.addEventListener("click",       () => setColor("white_on_black"));

    const jsAccessibilityReset = document.querySelector(".jsAccessibilityReset");
    if (jsAccessibilityReset) jsAccessibilityReset.addEventListener("click", resetAll);
  };

  const init = () => {
    applySavedFontSize();
    applySavedColor();
    bindUI();
  };

  return { init };
})();

export default Accessibility;

// Auto-boot (optionnel). Sinon supprime ce bloc et appelle Accessibility.init() dans ton entry.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => Accessibility.init());
} else {
  Accessibility.init();
}
