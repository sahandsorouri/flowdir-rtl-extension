(function() {
  'use strict';

  // Arabic script range: includes Arabic, Persian, Urdu, etc.
  const ARABIC_SCRIPT_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const DEBOUNCE_MS = 50;

  const processedElements = new WeakSet();
  const debounceTimers = new WeakMap();
  let mutationTimer = null;
  const MUTATION_THROTTLE_MS = 500;

  function hasRTL(str) {
    if (!str || typeof str !== 'string') return false;
    
    // Simple check: if we find ANY Arabic/Persian character, return true (RTL)
    // Use search() instead of test() to avoid regex state issues
    return str.search(ARABIC_SCRIPT_REGEX) !== -1;
  }

  function getElementText(el) {
    if (!el) return '';
    
    try {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        return el.value || '';
      }
      if (el.isContentEditable) {
        return el.innerText || el.textContent || '';
      }
    } catch (e) {
      return '';
    }
    return '';
  }

  function applyDirection(el) {
    if (!el || !el.nodeName) return;
    
    try {
      const text = getElementText(el);
      const isRTL = hasRTL(text);

      // Simple logic: if ANY Persian/Arabic character exists → RTL, otherwise → LTR
      if (isRTL) {
        el.dir = 'rtl';
        el.style.direction = 'rtl';
        el.style.textAlign = 'right';
        el.style.unicodeBidi = 'plaintext';
        if (el.classList) {
          el.classList.remove('auto-ltr');
          el.classList.add('auto-rtl');
        }
      } else {
        el.dir = 'ltr';
        el.style.direction = 'ltr';
        el.style.textAlign = 'left';
        el.style.unicodeBidi = 'plaintext';
        if (el.classList) {
          el.classList.remove('auto-rtl');
          el.classList.add('auto-ltr');
        }
      }
    } catch (e) {
      // Silent fail
    }
  }

  function shouldProcessElement(el) {
    if (!el || !el.nodeName) return false;
    if (processedElements.has(el)) return false;

    const tagName = el.tagName;
    
    if (tagName === 'INPUT') {
      const type = (el.type || 'text').toLowerCase();
      const excludedTypes = ['password', 'email', 'number', 'tel', 'url', 'search'];
      if (excludedTypes.includes(type)) {
        return false;
      }
      return true;
    }

    if (tagName === 'TEXTAREA') {
      return true;
    }

    if (el.isContentEditable) {
      return true;
    }

    const contenteditable = el.getAttribute('contenteditable');
    if (contenteditable === 'true' || contenteditable === '') {
      return true;
    }

    return false;
  }

  function attachListeners(el) {
    if (!el || processedElements.has(el)) return;

    const handler = function() {
      const existingTimer = debounceTimers.get(el);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(function() {
        applyDirection(el);
        debounceTimers.delete(el);
      }, DEBOUNCE_MS);

      debounceTimers.set(el, timer);
    };

    // For contenteditable and textarea, also listen to keyup to catch Enter key
    const keyupHandler = function(e) {
      if (e.key === 'Enter' || e.keyCode === 13) {
        // Apply direction immediately after Enter
        setTimeout(function() {
          applyDirection(el);
        }, 10);
      }
    };

    try {
      el.addEventListener('input', handler, { passive: true });
      
      // Add keyup for contenteditable and textarea elements to catch Enter
      if (el.isContentEditable || el.getAttribute('contenteditable') || el.tagName === 'TEXTAREA') {
        el.addEventListener('keyup', keyupHandler, { passive: true });
      }
      
      processedElements.add(el);
      applyDirection(el);
    } catch (e) {
      // Silent fail
    }
  }

  function processElements(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return;

    try {
      // Process inputs
      const inputs = root.querySelectorAll('input');
      for (let i = 0; i < inputs.length; i++) {
        const el = inputs[i];
        if (shouldProcessElement(el)) {
          attachListeners(el);
        }
      }

      // Process textareas
      const textareas = root.querySelectorAll('textarea');
      for (let i = 0; i < textareas.length; i++) {
        const el = textareas[i];
        if (shouldProcessElement(el)) {
          attachListeners(el);
        }
      }

      // Process contenteditable elements
      const contenteditables = root.querySelectorAll('[contenteditable]');
      for (let i = 0; i < contenteditables.length; i++) {
        const el = contenteditables[i];
        if (shouldProcessElement(el)) {
          attachListeners(el);
        }
      }
    } catch (e) {
      // Silent fail
    }
  }

  function handleMutation(mutations) {
    if (mutationTimer) {
      clearTimeout(mutationTimer);
    }

    mutationTimer = setTimeout(function() {
      try {
        const newElements = [];
        
        for (let i = 0; i < mutations.length; i++) {
          const mutation = mutations[i];
          if (mutation.addedNodes) {
            for (let j = 0; j < mutation.addedNodes.length; j++) {
              const node = mutation.addedNodes[j];
              if (node && node.nodeType === 1) {
                // Only process if it's a new input/textarea/contenteditable element
                // Skip text nodes and other non-element nodes
                if (shouldProcessElement(node)) {
                  newElements.push(node);
                }
                // Only search for children if it's a container element
                // Skip if it's already an input/textarea/contenteditable
                if (node.querySelectorAll && !shouldProcessElement(node)) {
                  const children = node.querySelectorAll('input, textarea, [contenteditable]');
                  for (let k = 0; k < children.length; k++) {
                    if (shouldProcessElement(children[k])) {
                      newElements.push(children[k]);
                    }
                  }
                }
              }
            }
          }
        }

        // Process new elements
        for (let i = 0; i < newElements.length; i++) {
          attachListeners(newElements[i]);
        }
      } catch (e) {
        // Silent fail
      }
    }, MUTATION_THROTTLE_MS);
  }

  function init() {
    if (typeof document === 'undefined') return;

    function run() {
      processElements(document);
      
      // Setup MutationObserver with delay to avoid interfering with typing
      setTimeout(function() {
        if (typeof MutationObserver !== 'undefined' && document.documentElement) {
          try {
            const observer = new MutationObserver(handleMutation);
            observer.observe(document.documentElement, {
              childList: true,
              subtree: true
            });
          } catch (e) {
            // Silent fail
          }
        }
      }, 1000);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      setTimeout(run, 100);
    }
  }

  init();
})();
