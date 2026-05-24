(function () {
  'use strict';

  const textReplacements = [
    ['Find shop fast', 'Nearby shops'],
    ['Find shop', 'Shops'],
    ['Call shop', 'Call Shop'],
    ['No callable shops found.', 'No shops to call found.'],
    ['No matching items yet.', 'No items found.'],
    ['No matching shops found.', 'No shops found.'],
    ['No shops nearby yet.', 'No shops yet.'],
    ['Open or create your shop here', 'Add your shop'],
    ['Create or open your shop', 'Add your shop'],
    ['Shop Command', 'Add shop'],
    ['Debug', 'Add shop'],
    ['Commerce Grid', 'Shops near you'],
    ['Mapped local supply', 'Shops near you'],
    ['Live territory', 'Nearby'],
    ['Network intelligence', 'Nearby shops'],
    ['Call or message the shop before you go.', 'Call or message the shop.'],
    ['See items below. Call the shop if you want to confirm stock first.', 'See items below.'],
    ['Optional. Saved on this device for faster repeat orders.', 'Saved on this phone.'],
    ['Payment methods stay hidden until you continue to pay.', 'Choose payment to continue.'],
    ['Live status refresh runs automatically while this screen is open.', 'Status updates here.'],
    ['Order first. Pay the shop when you get it.', 'Pay when you receive.'],
    ['Only if you trust the shop and want to prepay.', 'Pay before delivery.'],
    ['Add or open shop', 'Open shop tools'],
    ['Register', 'Add']
  ];

  const attributeNames = ['aria-label', 'title', 'placeholder', 'value'];
  let scheduled = false;

  function cleanText(value) {
    if (!value || typeof value !== 'string') return value;
    let next = value;
    textReplacements.forEach(function (pair) {
      next = next.split(pair[0]).join(pair[1]);
    });
    return next;
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

  function polish() {
    scheduled = false;
    cleanNodeText(document.body);
    cleanAttributes(document.body);
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
