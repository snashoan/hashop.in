(function () {
  'use strict';

  const polishCore = window.HashopHomePolishCore || {};
  const attributeNames = polishCore.DEFAULT_ATTRIBUTE_NAMES || ['aria-label', 'title', 'placeholder', 'value'];
  let scheduled = false;
  let lastMotionSignature = '';
  let motionTimer = 0;

  function cleanText(value) {
    if (polishCore.cleanText) return polishCore.cleanText(value);
    return value;
  }

  function cleanNodeText(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/i.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let textNode = walker.nextNode();
    while (textNode) {
      const nextText = cleanText(textNode.nodeValue);
      if (nextText !== textNode.nodeValue) textNode.nodeValue = nextText;
      textNode = walker.nextNode();
    }
  }

  function cleanAttributes(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('*').forEach(function (node) {
      attributeNames.forEach(function (name) {
        if (!node.hasAttribute(name)) return;
        const current = node.getAttribute(name);
        const next = cleanText(current);
        if (next !== current) node.setAttribute(name, next);
      });
    });
  }

  function addShopMedia(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('.shop-card:not(.shop-discovery-card)').forEach(function (card) {
      if (card.querySelector('.shop-card-media')) return;
      const media = document.createElement('div');
      media.className = 'shop-card-media';
      media.setAttribute('aria-hidden', 'true');
      media.innerHTML = '<span></span>';
      card.insertBefore(media, card.firstChild);
    });
  }

  function syncStateMotion() {
    const shell = document.querySelector('.shell-home');
    const panel = shell && shell.querySelector('.shop-list-panel');
    const grid = shell && shell.querySelector('.shop-list-grid');
    if (!shell || !panel || !grid) return;
    const signature = polishCore.stateMotionSignature
      ? polishCore.stateMotionSignature({
        screen: shell.getAttribute('data-hashop-screen') || '',
        pane: panel.getAttribute('data-pane-mode') || '',
        view: grid.getAttribute('data-list-view') || '',
        childCount: grid.children.length,
        text: grid.textContent || ''
      })
      : [
        shell.getAttribute('data-hashop-screen') || '',
        panel.getAttribute('data-pane-mode') || '',
        grid.getAttribute('data-list-view') || '',
        grid.children.length,
        (grid.textContent || '').trim().slice(0, 80)
      ].join('|');
    if (signature === lastMotionSignature) return;
    lastMotionSignature = signature;
    shell.classList.remove('is-state-transitioning');
    window.requestAnimationFrame(function () {
      shell.classList.add('is-state-transitioning');
      window.clearTimeout(motionTimer);
      motionTimer = window.setTimeout(function () {
        shell.classList.remove('is-state-transitioning');
      }, 260);
    });
  }

  function polish() {
    scheduled = false;
    cleanNodeText(document.body);
    cleanAttributes(document.body);
    syncStateMotion();
  }

  function schedulePolish() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(polish);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedulePolish, { once: true });
  } else {
    schedulePolish();
  }

  new MutationObserver(schedulePolish).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: attributeNames
  });
}());
