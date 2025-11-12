(function() {
  'use strict';

  const ARABIC_SCRIPT_REGEX = /[\u0600-\u06FF]/;
  const RTL_THRESHOLD = 0.2;
  const DEBOUNCE_MS = 100;

  const processedElements = new WeakSet();
  const debounceTimers = new WeakMap();

  function isMostlyRTL(str) {
    const trimmed = str.trim();
    if (trimmed.length === 0) {
      return false;
    }

    const nonWhitespace = trimmed.replace(/\s/g, '');
    if (nonWhitespace.length === 0) {
      return false;
    }

    let rtlCount = 0;
    for (let i = 0; i < nonWhitespace.length; i++) {
      if (ARABIC_SCRIPT_REGEX.test(nonWhitespace[i])) {
        rtlCount++;
      }
    }

    return rtlCount / nonWhitespace.length >= RTL_THRESHOLD;
  }

  function getElementText(el) {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      return el.value || '';
    }
    if (el.isContentEditable) {
      return el.innerText || el.textContent || '';
    }
    return '';
  }

  function applyDirection(el) {
    const text = getElementText(el);
    const isRTL = isMostlyRTL(text);

    if (isRTL) {
      el.dir = 'rtl';
      el.classList.remove('auto-ltr');
      el.classList.add('auto-rtl');
    } else {
      el.dir = 'ltr';
      el.classList.remove('auto-rtl');
      el.classList.add('auto-ltr');
    }
  }

  function shouldProcessElement(el) {
    if (!el || processedElements.has(el)) {
      return false;
    }

    if (el.tagName === 'INPUT') {
      const type = (el.type || '').toLowerCase();
      const excludedTypes = ['password', 'email', 'number', 'tel', 'url', 'search'];
      if (excludedTypes.includes(type)) {
        return false;
      }
    }

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      return true;
    }

    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === '') {
      return true;
    }

    return false;
  }

  function attachListeners(el) {
    if (processedElements.has(el)) {
      return;
    }

    const handler = () => {
      const existingTimer = debounceTimers.get(el);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        applyDirection(el);
        debounceTimers.delete(el);
      }, DEBOUNCE_MS);

      debounceTimers.set(el, timer);
    };

    el.addEventListener('input', handler, { passive: true });
    el.addEventListener('keyup', handler, { passive: true });
    processedElements.add(el);
  }

  function initAutoDir(root) {
    const selector = 'input:not([type="password"]):not([type="email"]):not([type="number"]):not([type="tel"]):not([type="url"]):not([type="search"]), textarea, [contenteditable="true"], [contenteditable=""]';

    try {
      const elements = root.querySelectorAll ? root.querySelectorAll(selector) : [];
      
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (shouldProcessElement(el)) {
          applyDirection(el);
          attachListeners(el);
        }
      }
    } catch (e) {
      // Silently ignore querySelector errors
    }
  }

  function handleMutation(mutations) {
    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];
      if (mutation.addedNodes) {
        for (let j = 0; j < mutation.addedNodes.length; j++) {
          const node = mutation.addedNodes[j];
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (shouldProcessElement(node)) {
              applyDirection(node);
              attachListeners(node);
            }
            initAutoDir(node);
          }
        }
      }
    }
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        initAutoDir(document);
      });
    } else {
      initAutoDir(document);
    }

    const observer = new MutationObserver(handleMutation);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  init();
})();

