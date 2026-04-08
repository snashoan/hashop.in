(() => {
  const PAGE = String(window.__HASHOP_DEBUG_PAGE__ || "").trim();

  const SELECTORS = {
    home: [
      {
        parts: [".home-chrome"],
        label: "top",
        kind: "container"
      },
      { selector: ".map-screen", label: "map", kind: "container" },
      { selector: ".discovery-map", label: "tiles", kind: "item" },
      { selector: ".shop-list-panel", label: "pane", kind: "container" },
      { selector: ".shop-panel-bar", label: "bar", kind: "container" },
      { selector: ".shop-pane-toggle", label: "tgl", kind: "control" },
      { selector: ".shop-back-action", label: "back", kind: "control" },
      { selector: ".shop-list-search", label: "head", kind: "container" },
      { selector: ".shop-list-action", label: "cta", kind: "control" },
      { selector: ".shop-list-grid", label: "list", kind: "container" },
      { selector: ".shop-pane-detail", label: "shop", kind: "container" },
      { selector: ".shop-owner-stack", label: "owner", kind: "container" },
      { selector: ".shop-owner-section-toggle", label: "m-sec", kind: "control" },
      { selector: ".shop-owner-form-head", label: "o-head", kind: "item" },
      { selector: ".shop-owner-chip-button", label: "o-btn", kind: "control" },
      { selector: ".shop-owner-save", label: "save", kind: "control" },
      { selector: ".shop-owner-status", label: "o-status", kind: "item" },
      { selector: ".shop-owner-input", label: "o-input", kind: "control" },
      { selector: ".shop-owner-textarea", label: "o-text", kind: "control" },
      { selector: ".shop-card", label: "card", kind: "item" },
      { selector: ".shop-pane-item", label: "item", kind: "item" },
      { selector: ".shop-cart-pay", label: "pay", kind: "control" },
      { selector: ".shop-list-empty", label: "empty", kind: "item" }
    ],
    cloud: [
      { selector: ".cloud-map-frame", label: "frame", kind: "container" },
      { selector: ".cloud-map", label: "map", kind: "item" },
      { selector: ".cloud-map-overlay", label: "veil", kind: "item" },
      { selector: ".cloud-auth-shell", label: "auth", kind: "container" },
      { selector: ".cloud-auth-stack", label: "stack", kind: "container" },
      { selector: ".cloud-brand", label: "brand", kind: "control" },
      { selector: ".cloud-auth-card", label: "card", kind: "container" },
      { selector: ".cloud-auth-kicker", label: "kick", kind: "item" },
      { selector: ".cloud-auth-title", label: "title", kind: "item" },
      { selector: ".cloud-auth-copy", label: "copy", kind: "item" },
      { selector: ".cloud-auth-fields", label: "fields", kind: "container" },
      { selector: ".cloud-field", label: "field", kind: "container" },
      { selector: ".cloud-input", label: "input", kind: "control" },
      { selector: ".cloud-auth-actions", label: "acts", kind: "container" },
      { selector: ".cloud-submit", label: "go", kind: "control" },
      { selector: ".cloud-status", label: "status", kind: "item" }
    ],
    hashop: [
      { selector: ".shell-console", label: "shell", kind: "container" },
      { selector: ".chrome", label: "top", kind: "container" },
      { selector: ".brand", label: "brand", kind: "control" },
      { selector: ".header-actions", label: "acts", kind: "container" },
      { selector: ".console-logout-btn", label: "logout", kind: "control" },
      { selector: ".step-nav", label: "nav", kind: "container" },
      { selector: ".step-track", label: "track", kind: "container" },
      { selector: ".step-item", label: "tab", kind: "control" },
      { selector: ".console-viewport", label: "view", kind: "container" },
      { selector: ".console-page", label: "page", kind: "container" },
      { selector: ".page-content", label: "body", kind: "container" },
      { selector: ".mystore-hero", label: "hero", kind: "container" },
      { selector: ".mystore-hero-main", label: "hero-main", kind: "container" },
      { selector: ".mystore-hero-actions", label: "hero-acts", kind: "container" },
      { selector: ".profile-stage", label: "stage", kind: "container" },
      { selector: ".profile-stage-track", label: "track", kind: "container" },
      { selector: ".profile-setup-step", label: "step", kind: "container" },
      { selector: ".section-heading-row", label: "sec-head", kind: "container" },
      { selector: ".section-toggle-btn", label: "sec-btn", kind: "control" },
      { selector: ".section-summary-card", label: "sum", kind: "item" },
      { selector: ".console-form", label: "form", kind: "container" },
      { selector: ".location-map-card", label: "loc-card", kind: "container" },
      { selector: ".location-map", label: "loc-map", kind: "item" },
      { selector: ".console-actions", label: "form-acts", kind: "container" },
      { selector: ".console-list", label: "list", kind: "container" },
      { selector: ".btn", label: "btn", kind: "control" },
      { selector: ".main-input", label: "input", kind: "control" },
      { selector: ".console-textarea", label: "text", kind: "control" }
    ],
    shop: [
      { selector: "header, .chrome, .shop-topbar", label: "top", kind: "container" },
      { selector: ".brand, .shop-home-link", label: "brand", kind: "control" },
      { selector: "main, .shop-shell, .shop-page, .shopfront", label: "page", kind: "container" },
      { selector: "button, .btn", label: "btn", kind: "control" },
      { selector: "input, textarea", label: "input", kind: "control" }
    ]
  };

  const KIND_LABELS = {
    container: "ctn",
    control: "ctl",
    item: "itm"
  };

  let overlayRoot = null;
  let panelRoot = null;
  let panelHead = null;
  let panelMeta = null;
  let panelList = null;
  let panelToggle = null;
  let panelView = null;
  let panelDrag = null;
  let observer = null;
  let renderQueued = false;
  let rendering = false;
  let collapsed = true;
  let activeId = "";
  let activePulseTimeout = null;
  let matchesById = new Map();
  let dragState = null;
  let motionFrames = 0;

  const isDebugUi = (node) => {
    if (!(node instanceof Element)) {
      return false;
    }
    return Boolean(node.closest(".hashop-debug-overlay, .hashop-debug-panel"));
  };

  const isVisible = (node) => {
    if (!(node instanceof Element) || isDebugUi(node)) {
      return false;
    }
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    const rect = node.getBoundingClientRect();
    return rect.width >= 6 && rect.height >= 6;
  };

  const VIEW_PATHS = {
    home: "/",
    cloud: "/login",
    hashop: "/hashop",
    shop: window.location.pathname.replace(/^\/shop-debug\//, "/shop/")
  };

  const DEBUG_PATHS = {
    home: "/home-debug",
    cloud: "/login-debug",
    hashop: "/hashop-debug",
    shop: "/shop-debug"
  };

  const getViewHref = () => {
    const basePath = VIEW_PATHS[PAGE] || window.location.pathname.replace(/-debug$/, "") || "/";
    return basePath + window.location.search + window.location.hash;
  };

  const rewriteDebugHref = (href) => {
    try {
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) {
        return "";
      }
      if (url.pathname === "/" || url.pathname === "/index.html") {
        url.pathname = DEBUG_PATHS.home;
        return url.pathname + url.search + url.hash;
      }
      if (url.pathname === "/cloud" || url.pathname === "/login") {
        url.pathname = DEBUG_PATHS.cloud;
        return url.pathname + url.search + url.hash;
      }
      if (url.pathname === "/hashop") {
        url.pathname = DEBUG_PATHS.hashop;
        return url.pathname + url.search + url.hash;
      }
      if (url.pathname.startsWith("/shop/")) {
        url.pathname = url.pathname.replace(/^\/shop\//, "/shop-debug/");
        return url.pathname + url.search + url.hash;
      }
      return "";
    } catch (_error) {
      return "";
    }
  };

  const rewriteDebugLinks = () => {
    document.querySelectorAll("a[href]").forEach((link) => {
      if (!(link instanceof HTMLAnchorElement) || isDebugUi(link) || link.classList.contains("hashop-debug-view")) {
        return;
      }
      const rewritten = rewriteDebugHref(link.getAttribute("href") || link.href);
      if (!rewritten) {
        return;
      }
      if (link.getAttribute("href") !== rewritten) {
        link.setAttribute("href", rewritten);
      }
    });
  };

  const ensureUi = () => {
    if (!overlayRoot) {
      overlayRoot = document.createElement("div");
      overlayRoot.className = "hashop-debug-overlay";
      document.body.appendChild(overlayRoot);
    }

    if (panelRoot) {
      return;
    }

    panelRoot = document.createElement("aside");
    panelRoot.className = "hashop-debug-panel";
    panelRoot.classList.add("is-collapsed");

    const head = document.createElement("div");
    head.className = "hashop-debug-head";
    panelHead = head;

    const titleWrap = document.createElement("div");
    titleWrap.className = "hashop-debug-titlewrap";

    const title = document.createElement("strong");
    title.textContent = "snf dbg";
    titleWrap.appendChild(title);

    panelMeta = document.createElement("div");
    panelMeta.className = "hashop-debug-meta";
    titleWrap.appendChild(panelMeta);

    panelToggle = document.createElement("button");
    panelToggle.className = "hashop-debug-toggle";
    panelToggle.type = "button";
    panelToggle.setAttribute("aria-expanded", "false");
    panelToggle.textContent = "open";
    panelToggle.addEventListener("click", () => {
      collapsed = !collapsed;
      panelRoot.classList.toggle("is-collapsed", collapsed);
      panelToggle.setAttribute("aria-expanded", String(!collapsed));
      panelToggle.textContent = collapsed ? "open" : "fold";
    });

    panelView = document.createElement("a");
    panelView.className = "hashop-debug-view";
    panelView.href = getViewHref();
    panelView.textContent = "view";

    panelDrag = document.createElement("button");
    panelDrag.className = "hashop-debug-drag";
    panelDrag.type = "button";
    panelDrag.textContent = "move";
    panelDrag.setAttribute("aria-label", "Move debug panel");

    panelToggle.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });

    panelView.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });

    head.appendChild(titleWrap);
    head.appendChild(panelDrag);
    head.appendChild(panelView);
    head.appendChild(panelToggle);

    panelList = document.createElement("div");
    panelList.className = "hashop-debug-list";

    panelRoot.appendChild(head);
    panelRoot.appendChild(panelList);
    document.body.appendChild(panelRoot);

    panelDrag.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }

      const rect = panelRoot.getBoundingClientRect();
      dragState = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top
      };

      panelRoot.classList.add("is-dragging");
      panelDrag.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    panelDrag.addEventListener("pointermove", (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      const width = panelRoot.offsetWidth;
      const height = panelRoot.offsetHeight;
      const maxLeft = Math.max(8, window.innerWidth - width - 8);
      const maxTop = Math.max(8, window.innerHeight - height - 8);
      const left = Math.min(Math.max(8, event.clientX - dragState.offsetX), maxLeft);
      const top = Math.min(Math.max(8, event.clientY - dragState.offsetY), maxTop);

      panelRoot.style.left = left + "px";
      panelRoot.style.top = top + "px";
      panelRoot.style.right = "auto";
      panelRoot.style.bottom = "auto";
    });

    const stopDrag = (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      panelRoot.classList.remove("is-dragging");
      try {
        panelDrag.releasePointerCapture(event.pointerId);
      } catch (_error) {
        // Ignore release failures if capture is already gone.
      }
      dragState = null;
    };

    panelDrag.addEventListener("pointerup", stopDrag);
    panelDrag.addEventListener("pointercancel", stopDrag);
  };

  const rectArea = (rect) => rect.width * rect.height;

  const containsRect = (outer, inner) =>
    outer.left <= inner.left + 4 &&
    outer.top <= inner.top + 4 &&
    outer.right >= inner.right - 4 &&
    outer.bottom >= inner.bottom - 4;

  const overlapRatio = (first, second) => {
    const left = Math.max(first.left, second.left);
    const top = Math.max(first.top, second.top);
    const right = Math.min(first.right, second.right);
    const bottom = Math.min(first.bottom, second.bottom);
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    const overlap = width * height;
    if (!overlap) {
      return 0;
    }
    return overlap / Math.min(rectArea(first), rectArea(second));
  };

  const labelAnchor = (rect) => ({
    x: rect.left + 8,
    y: rect.top - 13
  });

  const shouldMergeMatches = (first, second) => {
    const firstAnchor = labelAnchor(first.rect);
    const secondAnchor = labelAnchor(second.rect);
    const anchorNear =
      Math.abs(firstAnchor.x - secondAnchor.x) <= 88 &&
      Math.abs(firstAnchor.y - secondAnchor.y) <= 24;

    if (!anchorNear) {
      return false;
    }

    return (
      containsRect(first.rect, second.rect) ||
      containsRect(second.rect, first.rect) ||
      overlapRatio(first.rect, second.rect) >= 0.55
    );
  };

  const formatMergedLabel = (labels) => {
    if (labels.length <= 2) {
      return labels.join(" + ");
    }
    return labels[0] + " + " + (labels.length - 1) + " more";
  };

  const mergeMatches = (rawMatches) => {
    const groups = [];

    rawMatches.forEach((match) => {
      const group = groups.find((candidate) =>
        candidate.members.some((member) => shouldMergeMatches(member, match))
      );

      if (!group) {
        groups.push({ members: [match] });
        return;
      }

      group.members.push(match);
    });

    return groups.map((group) => {
      const members = group.members.slice().sort((first, second) => rectArea(second.rect) - rectArea(first.rect));
      const primary = members[0];
      const labels = members.map((member) => member.label);
      const kinds = Array.from(new Set(members.map((member) => member.kind)));
      return {
        id: members.map((member) => member.id).sort().join("|"),
        label: formatMergedLabel(labels),
        detail: labels.join(" • "),
        kind: kinds.length === 1 ? kinds[0] : primary.kind,
        mergedCount: members.length,
        element: primary.element,
        rect: primary.rect
      };
    });
  };

  const buildUnionRect = (rects) => ({
    left: Math.min(...rects.map((rect) => rect.left)),
    top: Math.min(...rects.map((rect) => rect.top)),
    right: Math.max(...rects.map((rect) => rect.right)),
    bottom: Math.max(...rects.map((rect) => rect.bottom)),
    width: Math.max(...rects.map((rect) => rect.right)) - Math.min(...rects.map((rect) => rect.left)),
    height: Math.max(...rects.map((rect) => rect.bottom)) - Math.min(...rects.map((rect) => rect.top))
  });

  const lowerText = (node) => String(node && node.textContent || "").trim().toLowerCase();

  const homePaneState = () => {
    const pane = document.querySelector(".shop-list-panel");
    if (!(pane instanceof Element)) {
      return "list";
    }
    if (pane.classList.contains("is-login-view")) {
      return "login";
    }
    if (pane.classList.contains("is-shop-view")) {
      if (document.querySelector(".shop-pane-cart-screen")) return "cart";
      if (document.querySelector(".shop-owner-stack")) return "owner-manage";
      return "shop";
    }
    return "list";
  };

  const resolveHomeLabel = (descriptor, node, index, count) => {
    const base = descriptor.label;
    const paneState = homePaneState();

    if (base === "pane") {
      return "pane-" + paneState;
    }
    if (base === "list") {
      if (paneState === "login") return "login";
      if (paneState === "cart") return "cart";
      if (paneState === "shop") return "items";
      return "list";
    }
    if (base === "shop") {
      if (node && node.classList && node.classList.contains("shop-login-pane")) return "login";
      if (node && node.querySelector && node.querySelector(".shop-pane-cart-screen")) return "cart";
      if (paneState.indexOf("owner-") === 0) return paneState;
      return paneState === "shop" ? "shop" : base;
    }
    if (base === "owner") {
      return paneState === "owner-manage" ? "owner-manage" : "owner";
    }
    if (base === "save") {
      const text = lowerText(node).replace(/\s+/g, "-");
      return text || base;
    }
    if (base === "m-sec") {
      const sectionMode = String(node && node.getAttribute && node.getAttribute("data-owner-section-toggle") || "").trim();
      if (sectionMode === "profile") return "m-shop-tgl";
      if (sectionMode === "item") return "m-items-tgl";
      if (sectionMode === "payments") return "m-pay-tgl";
      if (sectionMode === "orders") return "m-orders-tgl";
      return "m-sec";
    }
    if (base === "o-btn") {
      const text = lowerText(node).replace(/\s+/g, "-");
      return text || "o-btn";
    }
    if (base === "o-head") {
      const text = lowerText(node).split("\n")[0].trim().replace(/\s+/g, "-");
      return text || "owner-head";
    }
    if (base === "o-status") {
      return "owner-status";
    }
    if (base === "o-input" || base === "o-text") {
      const name = String(node && node.getAttribute && node.getAttribute("name") || "").trim();
      return name || base;
    }
    if (base === "head") {
      if (paneState === "cart") return "search-cart";
      if (paneState === "shop") return "search-items";
      if (paneState === "owner-manage") return "search-manage";
      return "search";
    }
    if (base === "cta" || base === "back") {
      const text = lowerText(node);
      return text || base;
    }
    if (base === "empty") {
      return paneState === "login" ? "login-copy" : "empty";
    }
    if (count > 1) {
      return base + "[" + (index + 1) + "]";
    }
    return base;
  };

  const resolveLabel = (descriptor, node, index, count) => {
    if (PAGE === "home") {
      return resolveHomeLabel(descriptor, node, index, count);
    }
    if (count > 1) {
      return descriptor.label + "[" + (index + 1) + "]";
    }
    return descriptor.label;
  };

  const collectMatches = () => {
    const descriptors = SELECTORS[PAGE] || [];
    const matches = [];

    descriptors.forEach((descriptor) => {
      if (descriptor.parts) {
        const nodes = descriptor.parts
          .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
          .filter(isVisible);
        if (!nodes.length) {
          return;
        }
        const rect = buildUnionRect(nodes.map((node) => node.getBoundingClientRect()));
        matches.push({
          id: descriptor.label + ":0",
          label: resolveLabel(descriptor, nodes[0], 0, 1),
          kind: descriptor.kind,
          element: nodes[0],
          rect
        });
        return;
      }

      const nodes = Array.from(document.querySelectorAll(descriptor.selector)).filter(isVisible);
      nodes.forEach((node, index) => {
        let targetNode = node;
        let rectNode = node;
        if (PAGE === "home" && descriptor.label === "m-sec") {
          const sectionRoot = node.closest("[data-owner-section-root]");
          if (sectionRoot instanceof Element && isVisible(sectionRoot)) {
            targetNode = sectionRoot;
            rectNode = sectionRoot;
          }
        }
        const label = resolveLabel(descriptor, node, index, nodes.length);
        matches.push({
          id: descriptor.label + ":" + index,
          label,
          kind: descriptor.kind,
          element: targetNode,
          rect: rectNode.getBoundingClientRect()
        });
      });
    });

    return mergeMatches(matches);
  };

  const activateMatch = (id) => {
    const match = matchesById.get(id);
    if (!match) {
      return;
    }

    activeId = id;
    match.element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest"
    });

    window.clearTimeout(activePulseTimeout);
    activePulseTimeout = window.setTimeout(() => {
      scheduleRender();
    }, 650);

    scheduleRender();
  };

  const appendBox = (match) => {
    const box = document.createElement("div");
    box.className = "hashop-debug-box";
    box.dataset.debugKind = match.kind;
    box.style.left = match.rect.left + "px";
    box.style.top = match.rect.top + "px";
    box.style.width = match.rect.width + "px";
    box.style.height = match.rect.height + "px";
    if (match.id === activeId) {
      box.classList.add("is-active");
    }

    const tag = document.createElement("span");
    tag.className = "hashop-debug-tag";
    tag.textContent = match.label;
    if (match.mergedCount > 1) {
      tag.title = match.detail;
    }
    box.appendChild(tag);

    overlayRoot.appendChild(box);
  };

  const appendLine = (match) => {
    const button = document.createElement("button");
    button.className = "hashop-debug-line";
    button.type = "button";
    if (match.id === activeId) {
      button.classList.add("is-active");
    }

    const chip = document.createElement("span");
    chip.className = "hashop-debug-chip";
    chip.dataset.debugKind = match.kind;
    chip.textContent = KIND_LABELS[match.kind] || match.kind;

    const label = document.createElement("span");
    label.className = "hashop-debug-label";
    label.textContent = match.label;
    if (match.mergedCount > 1) {
      label.title = match.detail;
    }

    button.appendChild(chip);
    button.appendChild(label);
    button.addEventListener("click", () => {
      activateMatch(match.id);
    });
    panelList.appendChild(button);
  };

  const disconnectObserver = () => {
    if (observer) {
      observer.disconnect();
    }
  };

  const scheduleMotionFrames = (count = 18) => {
    motionFrames = Math.max(motionFrames, count);
    scheduleRender();
  };

  const observeBody = () => {
    if (!document.body) {
      return;
    }

    if (!observer) {
      observer = new MutationObserver((records) => {
        if (rendering) {
          return;
        }
        const relevant = records.some((record) => {
          if (isDebugUi(record.target)) {
            return false;
          }
          if (record.type === "childList") {
            const touched = [
              ...Array.from(record.addedNodes),
              ...Array.from(record.removedNodes)
            ];
            return touched.some((node) => !isDebugUi(node));
          }
          return true;
        });
        if (relevant) {
          scheduleRender();
        }
      });
    }

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden"]
    });
  };

  const render = () => {
    renderQueued = false;
    rendering = true;
    document.documentElement.classList.add("hashop-debug-active");
    ensureUi();
    disconnectObserver();

    overlayRoot.replaceChildren();
    panelList.replaceChildren();
    matchesById = new Map();

    const matches = collectMatches();
    rewriteDebugLinks();
    matches.forEach((match) => {
      matchesById.set(match.id, match);
    });

    if (activeId && !matchesById.has(activeId)) {
      activeId = "";
    }

    panelView.href = getViewHref();
    panelMeta.textContent = (PAGE || "page") + " · " + matches.length;

    matches.forEach((match) => {
      appendBox(match);
      appendLine(match);
    });

    rendering = false;
    observeBody();

    if (motionFrames > 0) {
      motionFrames -= 1;
      window.requestAnimationFrame(render);
    }
  };

  const scheduleRender = () => {
    if (renderQueued) {
      return;
    }
    renderQueued = true;
    window.requestAnimationFrame(render);
  };

  const boot = () => {
    ensureUi();
    observeBody();
    scheduleRender();
    window.addEventListener("resize", scheduleRender, { passive: true });
    window.addEventListener("scroll", scheduleRender, { passive: true, capture: true });
    window.addEventListener("transitionrun", () => scheduleMotionFrames(), { passive: true, capture: true });
    window.addEventListener("transitionstart", () => scheduleMotionFrames(), { passive: true, capture: true });
    window.addEventListener("transitionend", scheduleRender, { passive: true, capture: true });
    window.addEventListener("animationstart", () => scheduleMotionFrames(), { passive: true, capture: true });
    window.addEventListener("animationend", scheduleRender, { passive: true, capture: true });
    window.addEventListener("pointerup", () => scheduleMotionFrames(10), { passive: true, capture: true });
    window.addEventListener("load", scheduleRender, { once: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
