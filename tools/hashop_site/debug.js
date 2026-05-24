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
  let panelTools = null;
  let panelList = null;
  let panelToggle = null;
  let panelView = null;
  let panelDrag = null;
  let panelPrompt = null;
  let panelPromptCopy = null;
  let panelContext = null;
  let codexFab = null;
  let codexDrawer = null;
  let codexStatusPill = null;
  let codexTaskInput = null;
  let codexStateNode = null;
  let codexOutput = null;
  let codexCopyButton = null;
  let codexStateButton = null;
  let codexProcessButton = null;
  let codexPasteButton = null;
  let codexSelectButton = null;
  let codexRefreshButton = null;
  let observer = null;
  let renderQueued = false;
  let rendering = false;
  let collapsed = true;
  let codexOpen = false;
  let activeId = "";
  let activePulseTimeout = null;
  let promptStatusTimeout = null;
  let contextStatusTimeout = null;
  let codexStatusTimeout = null;
  let matchesById = new Map();
  let dragState = null;
  let motionFrames = 0;

  const syncKeyboardDockOffset = () => {
    let offset = 0;
    if (window.visualViewport) {
      offset = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
    }
    document.documentElement.style.setProperty("--hashop-debug-keyboard-offset", Math.round(offset) + "px");
  };

  const isDebugUi = (node) => {
    if (!(node instanceof Element)) {
      return false;
    }
    return Boolean(node.closest(".hashop-debug-overlay, .hashop-debug-panel, .hashop-codex-fab, .hashop-codex-drawer"));
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

  const firstText = (selectors) => {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (!(node instanceof Element) || isDebugUi(node)) {
        continue;
      }
      const text = String(node.textContent || "").trim().replace(/\s+/g, " ");
      if (text) {
        return text;
      }
    }
    return "";
  };

  const firstInputValue = (selectors) => {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLInputElement) && !(node instanceof HTMLTextAreaElement)) {
        continue;
      }
      const value = String(node.value || "").trim();
      if (value) {
        return value;
      }
    }
    return "";
  };

  const metaContent = (name) => {
    const node = document.querySelector('meta[name="' + name + '"]');
    return node instanceof HTMLMetaElement ? String(node.content || "").trim() : "";
  };

  const mapContext = () => {
    const frame = document.querySelector(".map-screen, .discovery-map-wrap, .cloud-map-frame, .location-map-card");
    const map = document.querySelector(".discovery-map, .cloud-map, .location-map");
    if (!(frame instanceof Element) && !(map instanceof Element)) {
      return null;
    }
    const label =
      (frame instanceof Element && String(frame.getAttribute("data-map-label") || "").trim()) ||
      firstText([".map-status", ".map-frame-state", ".map-label"]);
    return {
      label: label || "",
      engine: window.google && window.google.maps ? "google-maps" : "fallback-map",
      visible: Boolean(map instanceof Element && isVisible(map))
    };
  };

  const buildCodexContext = () => {
    const currentMatches = matchesById.size
      ? Array.from(matchesById.values())
      : collectMatches();
    const visible = currentMatches
      .map((match) => (KIND_LABELS[match.kind] || match.kind) + ":" + match.label)
      .slice(0, 80);
    return {
      app: "Hashop",
      debugVersion: "debug-20260506a",
      page: PAGE || "page",
      state: PAGE === "home" ? homePaneState() : (PAGE || "page"),
      route: window.location.pathname + window.location.search + window.location.hash,
      normalRoute: getViewHref(),
      build: String(window.__HASHOP_BUILD__ || metaContent("hashop-build") || "").trim(),
      buildLabel: String(window.__HASHOP_BUILD_LABEL__ || metaContent("hashop-build-label") || "").trim(),
      viewport: window.innerWidth + "x" + window.innerHeight,
      search: firstInputValue([
        ".shop-search-input",
        ".shop-list-search input",
        "input[type='search']"
      ]),
      headline: firstText([".home-headline", "h1", ".shop-pane-hero h2"]),
      activeShop: firstText([".shop-pane-hero h2", ".shop-card-title-block strong"]),
      map: mapContext(),
      visible
    };
  };

  const formatCodexContext = (context) => {
    const lines = [
      "Hashop debug context",
      "Page: " + context.page,
      "State: " + context.state,
      "Route: " + context.route,
      "Normal route: " + context.normalRoute,
      context.build ? "Build: " + context.build : "",
      context.buildLabel ? "Build label: " + context.buildLabel : "",
      "Viewport: " + context.viewport,
      context.search ? "Search: " + context.search : "",
      context.headline ? "Headline: " + context.headline : "",
      context.activeShop ? "Active shop: " + context.activeShop : "",
      context.map ? "Map: " + [context.map.engine, context.map.visible ? "visible" : "not visible", context.map.label].filter(Boolean).join(" · ") : "",
      "Visible UI: " + (context.visible.length ? context.visible.join(", ") : "none")
    ];
    return lines.filter(Boolean).join("\n");
  };

  const typedPrompt = () => String(
    (codexTaskInput && codexTaskInput.value)
    || (panelPrompt && panelPrompt.value)
    || ""
  ).trim();

  const syncPromptInputs = (value, source) => {
    const text = String(value || "");
    if (source !== panelPrompt && panelPrompt && panelPrompt.value !== text) {
      panelPrompt.value = text;
    }
    if (source !== codexTaskInput && codexTaskInput && codexTaskInput.value !== text) {
      codexTaskInput.value = text;
    }
  };

  const formatCodexPrompt = () => {
    const note = typedPrompt();
    return [
      "Hashop debug task",
      "",
      "User request:",
      note || "No typed task.",
      "",
      "Instruction:",
      "Use the state context below to edit or process the Hashop UI. Keep normal user routes clean; debug tools must stay inside debug routes only.",
      "",
      formatCodexContext(buildCodexContext())
    ].join("\n");
  };

  const codexBridgeBases = () => {
    const bases = [];
    try {
      const saved = String(window.localStorage && window.localStorage.getItem("hashopDebugCodexBridgeUrl") || "").trim();
      if (saved) {
        bases.push(saved.replace(/\/+$/, ""));
      }
    } catch (_error) {
      // Ignore storage failures.
    }
    bases.push("http://127.0.0.1:8791");
    bases.push("http://localhost:8791");
    bases.push("");
    return Array.from(new Set(bases));
  };

  const bridgeEndpoint = (base, path) => {
    if (!base) {
      return path;
    }
    return base.replace(/\/+$/, "") + path;
  };

  const setCodexBridgeStatus = (message, tone = "") => {
    if (!codexStatusPill) {
      return;
    }
    codexStatusPill.textContent = message;
    codexStatusPill.dataset.tone = tone;
  };

  const checkCodexBridgeStatus = () => {
    setCodexBridgeStatus("Checking bridge", "pending");
    const tryNextStatus = (bases) => {
      const base = bases.shift();
      if (base === undefined) {
        setCodexBridgeStatus("Copy mode", "error");
        return Promise.resolve(false);
      }
      return fetch(bridgeEndpoint(base, "/api/debug/codex/status"), { method: "GET" })
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload.ok || !payload.enabled) {
            throw new Error(String(payload.error || payload.mode || "bridge unavailable"));
          }
          const mode = String(payload.mode || "").trim();
          setCodexBridgeStatus(mode === "local-codex" ? "Local Codex ready" : "Bridge ready", "success");
          return true;
        })
        .catch(() => tryNextStatus(bases));
    };
    return tryNextStatus(codexBridgeBases());
  };

  const writeClipboard = (text) => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      return navigator.clipboard.writeText(text);
    }

    return new Promise((resolve, reject) => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        textarea.remove();
      }
    });
  };

  const readClipboard = () => {
    if (navigator.clipboard && typeof navigator.clipboard.readText === "function") {
      return navigator.clipboard.readText();
    }
    return Promise.reject(new Error("clipboard_read_unavailable"));
  };

  const setContextButtonState = (label, failed = false) => {
    if (!panelContext) {
      return;
    }
    panelContext.textContent = label;
    panelContext.classList.toggle("is-error", failed);
    window.clearTimeout(contextStatusTimeout);
    contextStatusTimeout = window.setTimeout(() => {
      if (panelContext) {
        panelContext.textContent = "Copy Codex context";
        panelContext.classList.remove("is-error");
      }
    }, 1600);
  };

  const setPromptButtonState = (label, failed = false) => {
    if (!panelPromptCopy) {
      return;
    }
    panelPromptCopy.textContent = label;
    panelPromptCopy.classList.toggle("is-error", failed);
    window.clearTimeout(promptStatusTimeout);
    promptStatusTimeout = window.setTimeout(() => {
      if (panelPromptCopy) {
        panelPromptCopy.textContent = "Copy prompt";
        panelPromptCopy.classList.remove("is-error");
      }
    }, 1600);
  };

  const setCodexStatus = (message, tone = "") => {
    if (!codexOutput) {
      return;
    }
    if (codexOutput instanceof HTMLTextAreaElement) {
      codexOutput.value = message;
    } else {
      codexOutput.textContent = message;
    }
    codexOutput.dataset.tone = tone;
    window.clearTimeout(codexStatusTimeout);
    if (tone === "success" && /copied|pasted/i.test(String(message || ""))) {
      codexStatusTimeout = window.setTimeout(() => {
        if (codexOutput) {
          if (codexOutput instanceof HTMLTextAreaElement) {
            codexOutput.value = "Ready.";
          } else {
            codexOutput.textContent = "Ready.";
          }
          codexOutput.dataset.tone = "";
        }
      }, 2200);
    }
  };

  const appendCodexStatus = (message, tone = "") => {
    const nextLine = String(message || "").trim();
    if (!nextLine) {
      return;
    }
    const existing = codexOutputText();
    setCodexStatus((existing ? (existing + "\n") : "") + nextLine, tone);
    if (codexOutput) {
      codexOutput.scrollTop = codexOutput.scrollHeight;
    }
  };

  const codexOutputText = () => String(
    codexOutput instanceof HTMLTextAreaElement
      ? codexOutput.value
      : codexOutput && codexOutput.textContent || ""
  ).trim();

  const copyCodexContext = () => {
    const text = formatCodexContext(buildCodexContext());
    return writeClipboard(text)
      .then(() => {
        setContextButtonState("Copied");
        return text;
      })
      .catch((error) => {
        console.warn("Hashop debug context copy failed", error);
        setContextButtonState("Copy failed", true);
        return text;
      });
  };

  const copyCodexPrompt = () => {
    const text = formatCodexPrompt();
    return writeClipboard(text)
      .then(() => {
        setPromptButtonState("Copied");
        return text;
      })
      .catch((error) => {
        console.warn("Hashop debug prompt copy failed", error);
        setPromptButtonState("Copy failed", true);
        return text;
      });
  };

  const contextRows = (context) => {
    const rows = [
      ["Page", context.page],
      ["State", context.state],
      ["Route", context.route],
      ["Build", context.build || context.buildLabel || "-"]
    ];
    if (context.search) {
      rows.push(["Search", context.search]);
    }
    if (context.activeShop) {
      rows.push(["Shop", context.activeShop]);
    }
    if (context.map) {
      rows.push([
        "Map",
        [context.map.engine, context.map.visible ? "visible" : "not visible", context.map.label].filter(Boolean).join(" · ")
      ]);
    }
    rows.push(["Visible", String(context.visible.length)]);
    return rows;
  };

  const renderCodexState = () => {
    if (!codexStateNode) {
      return;
    }
    const context = buildCodexContext();
    codexStateNode.replaceChildren();
    contextRows(context).forEach(([labelText, valueText]) => {
      const row = document.createElement("div");
      row.className = "hashop-codex-state-row";

      const label = document.createElement("span");
      label.textContent = labelText;

      const value = document.createElement("strong");
      value.textContent = String(valueText || "-");

      row.appendChild(label);
      row.appendChild(value);
      codexStateNode.appendChild(row);
    });
  };

  const openCodexDrawer = (open = true) => {
    codexOpen = !!open;
    if (codexDrawer) {
      codexDrawer.classList.toggle("is-open", codexOpen);
      codexDrawer.setAttribute("aria-hidden", String(!codexOpen));
    }
    if (codexFab) {
      codexFab.setAttribute("aria-expanded", String(codexOpen));
    }
    if (codexOpen) {
      renderCodexState();
      checkCodexBridgeStatus();
      window.setTimeout(() => {
        if (codexTaskInput) {
          codexTaskInput.focus();
        }
      }, 0);
    }
  };

  const copyCodexState = () => {
    const text = formatCodexContext(buildCodexContext());
    return writeClipboard(text)
      .then(() => {
        setCodexStatus("State copied.", "success");
        return text;
      })
      .catch((error) => {
        console.warn("Hashop Codex state copy failed", error);
        setCodexStatus("Could not copy state.", "error");
        return text;
      });
  };

  const copyCodexTaskFromDrawer = () => {
    const text = formatCodexPrompt();
    return writeClipboard(text)
      .then(() => {
        setCodexStatus("Prompt copied.", "success");
        return text;
      })
      .catch((error) => {
        console.warn("Hashop Codex prompt copy failed", error);
        setCodexStatus("Copy blocked. Use Select prompt below:\n\n" + text, "error");
        window.setTimeout(selectCodexOutput, 0);
        return text;
      });
  };

  const pasteCodexTask = () => {
    return readClipboard()
      .then((text) => {
        const value = String(text || "");
        if (!value.trim()) {
          setCodexStatus("Clipboard is empty.", "error");
          return "";
        }
        syncPromptInputs(value, null);
        if (codexTaskInput) {
          codexTaskInput.focus();
        }
        setCodexStatus("Pasted.", "success");
        return value;
      })
      .catch((error) => {
        console.warn("Hashop Codex paste failed", error);
        setCodexStatus("Paste blocked. Tap the task box and use long-press Paste.", "error");
        if (codexTaskInput) {
          codexTaskInput.focus();
        }
        return "";
      });
  };

  const setSelectButtonState = (label) => {
    if (!codexSelectButton) {
      return;
    }
    codexSelectButton.textContent = label;
    window.setTimeout(() => {
      if (codexSelectButton) {
        codexSelectButton.textContent = "Select result";
      }
    }, 1500);
  };

  const selectCodexOutput = () => {
    if (!codexOutput || !codexOutputText()) {
      setCodexStatus("No output to select.", "error");
      return;
    }
    try {
      if (codexOutput instanceof HTMLTextAreaElement) {
        codexOutput.focus();
        codexOutput.select();
        codexOutput.setSelectionRange(0, codexOutput.value.length);
      } else {
        const range = document.createRange();
        range.selectNodeContents(codexOutput);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
        codexOutput.focus();
      }
      setSelectButtonState("Selected");
    } catch (error) {
      console.warn("Hashop Codex select failed", error);
      setSelectButtonState("Select failed");
    }
  };

  const refreshDebugView = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("_hashop_debug_refresh", String(Date.now()));
    window.location.replace(url.pathname + url.search + url.hash);
  };

  const watchCodexRun = (base, runId, headers) => {
    const startedAt = Date.now();
    const pollMs = 1400;
    const timeoutMs = 20 * 60 * 1000;
    let seenLines = 0;

    const poll = () => fetch(bridgeEndpoint(base, "/api/debug/codex/progress/" + encodeURIComponent(String(runId))), {
      method: "GET",
      headers
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok || !payload.run) {
          throw new Error(String(payload.message || payload.error || "run progress unavailable"));
        }
        const run = payload.run;
        const lines = Array.isArray(run.lines) ? run.lines : [];
        lines.slice(seenLines).forEach((entry) => {
          const stream = String(entry && entry.stream || "log").trim();
          const line = String(entry && entry.line || "").trim();
          if (line) {
            appendCodexStatus("#" + runId + " " + stream + ": " + line.slice(0, 260), "pending");
          }
        });
        seenLines = lines.length;

        if (run.status === "running") {
          if (Date.now() - startedAt > timeoutMs) {
            throw new Error("run watcher timed out");
          }
          return new Promise((resolve) => {
            window.setTimeout(resolve, pollMs);
          }).then(poll);
        }

        if (run.status === "ok") {
          return String(run.final_message || run.result || "Processed.");
        }
        throw new Error(String(run.error || run.final_message || "Codex failed"));
      });

    return poll();
  };

  const processCodexTaskWithBase = (base, requestBody, headers) => {
    return fetch(bridgeEndpoint(base, "/api/debug/codex/start"), {
      method: "POST",
      headers,
      body: requestBody
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok || !payload.run_id) {
          const message = String(payload.message || payload.error || "async bridge unavailable");
          const error = new Error(message);
          error.hashopCanUseProcessFallback = response.status === 404 || /not_found|unavailable|unsupported/i.test(message);
          throw error;
        }
        const runId = payload.run_id;
        setCodexStatus("Run #" + runId + " started.", "pending");
        return watchCodexRun(base, runId, headers);
      })
      .catch((error) => {
        if (!error || !error.hashopCanUseProcessFallback) {
          throw error;
        }
        return fetch(bridgeEndpoint(base, "/api/debug/codex/process"), {
          method: "POST",
          headers,
          body: requestBody
        })
          .then(async (response) => {
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.ok) {
              const message = String(payload.message || payload.error || "Processor is not connected.");
              throw new Error((base || "server") + ": " + message);
            }
            return String(payload.result || payload.message || "Processed.");
          });
      });
  };

  const processCodexTask = () => {
    const task = typedPrompt();
    if (!task) {
      setCodexStatus("Type the task first.", "error");
      if (codexTaskInput) {
        codexTaskInput.focus();
      }
      return Promise.resolve("");
    }

    const context = buildCodexContext();
    const token = String(window.localStorage && window.localStorage.getItem("hashopDebugCodexToken") || "").trim();
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["X-Hashop-Debug-Token"] = token;
    }

    setCodexBridgeStatus("Running", "pending");
    setCodexStatus("Running Codex on this Hashop canvas.", "pending");
    if (codexProcessButton) {
      codexProcessButton.disabled = true;
      codexProcessButton.textContent = "Running...";
    }

    const requestBody = JSON.stringify({ task, context, prompt: formatCodexPrompt() });
    const errors = [];
    const tryNextBridge = (bases) => {
      const base = bases.shift();
      if (base === undefined) {
        const fallbackPrompt = formatCodexPrompt();
        setCodexStatus(
          "Processor not connected. Prepared prompt below:\n\n" +
            fallbackPrompt +
            (errors.length ? ("\n\nBridge errors:\n" + errors.slice(-3).join("\n")) : ""),
          "error"
        );
        return writeClipboard(fallbackPrompt)
          .then(() => fallbackPrompt)
          .catch(() => {
            window.setTimeout(selectCodexOutput, 0);
            return fallbackPrompt;
          });
      }
      return processCodexTaskWithBase(base, requestBody, headers)
        .then((result) => {
          setCodexStatus(result, "success");
          setCodexBridgeStatus("Local Codex ready", "success");
          appendCodexStatus("Refresh view after the deploy finishes.", "success");
          return result;
        })
        .catch((error) => {
          errors.push(String(error && error.message || error || "bridge failed"));
          return tryNextBridge(bases);
        });
    };

    return tryNextBridge(codexBridgeBases())
      .finally(() => {
        if (codexProcessButton) {
          codexProcessButton.disabled = false;
          codexProcessButton.textContent = "Run";
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
    title.textContent = "Hashop debug";
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

    panelTools = document.createElement("div");
    panelTools.className = "hashop-debug-tools";

    const compose = document.createElement("div");
    compose.className = "hashop-debug-compose";

    const composeLabel = document.createElement("label");
    composeLabel.className = "hashop-debug-compose-label";
    composeLabel.textContent = "What should Codex fix?";

    panelPrompt = document.createElement("textarea");
    panelPrompt.className = "hashop-debug-input";
    panelPrompt.rows = 4;
    panelPrompt.placeholder = "Example: map is too dark, search hides cards, account buttons are confusing";
    panelPrompt.addEventListener("input", () => {
      syncPromptInputs(panelPrompt.value, panelPrompt);
    });
    panelPrompt.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });

    panelPromptCopy = document.createElement("button");
    panelPromptCopy.className = "hashop-debug-prompt-copy";
    panelPromptCopy.type = "button";
    panelPromptCopy.textContent = "Copy prompt";
    panelPromptCopy.addEventListener("click", () => {
      copyCodexPrompt();
    });
    panelPromptCopy.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });

    compose.appendChild(composeLabel);
    compose.appendChild(panelPrompt);
    compose.appendChild(panelPromptCopy);
    panelTools.appendChild(compose);

    panelContext = document.createElement("button");
    panelContext.className = "hashop-debug-context";
    panelContext.type = "button";
    panelContext.textContent = "Copy Codex context";
    panelContext.addEventListener("click", () => {
      copyCodexContext();
    });
    panelContext.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    panelTools.appendChild(panelContext);

    panelRoot.appendChild(head);
    panelRoot.appendChild(panelTools);
    panelRoot.appendChild(panelList);
    document.body.appendChild(panelRoot);

    codexFab = document.createElement("button");
    codexFab.className = "hashop-codex-fab";
    codexFab.type = "button";
    codexFab.textContent = "Codex";
    codexFab.setAttribute("aria-expanded", "false");
    codexFab.addEventListener("click", () => {
      openCodexDrawer(!codexOpen);
    });
    document.body.appendChild(codexFab);

    codexDrawer = document.createElement("aside");
    codexDrawer.className = "hashop-codex-drawer";
    codexDrawer.setAttribute("aria-hidden", "true");

    const codexHead = document.createElement("div");
    codexHead.className = "hashop-codex-head";

    const codexTitle = document.createElement("div");
    codexTitle.className = "hashop-codex-title";
    const codexStrong = document.createElement("strong");
    codexStrong.textContent = "Codex Debug";
    const codexSmall = document.createElement("span");
    codexSmall.textContent = "Hashop is the canvas";
    codexTitle.appendChild(codexStrong);
    codexTitle.appendChild(codexSmall);

    codexStatusPill = document.createElement("span");
    codexStatusPill.className = "hashop-codex-status";
    codexStatusPill.textContent = "Checking bridge";
    codexStatusPill.dataset.tone = "pending";

    const codexClose = document.createElement("button");
    codexClose.className = "hashop-codex-close";
    codexClose.type = "button";
    codexClose.textContent = "close";
    codexClose.addEventListener("click", () => {
      openCodexDrawer(false);
    });

    codexHead.appendChild(codexTitle);
    codexHead.appendChild(codexStatusPill);
    codexHead.appendChild(codexClose);

    codexStateNode = document.createElement("div");
    codexStateNode.className = "hashop-codex-state";

    const codexTask = document.createElement("form");
    codexTask.className = "hashop-codex-task";
    codexTask.addEventListener("submit", (event) => {
      event.preventDefault();
      processCodexTask();
    });
    const codexTaskLabel = document.createElement("span");
    codexTaskLabel.textContent = "Hashop";
    codexTaskInput = document.createElement("input");
    codexTaskInput.type = "text";
    codexTaskInput.placeholder = "Tell Codex what to change on this screen";
    codexTaskInput.autocomplete = "off";
    codexTaskInput.autocapitalize = "off";
    codexTaskInput.spellcheck = false;
    codexTaskInput.addEventListener("input", () => {
      syncPromptInputs(codexTaskInput.value, codexTaskInput);
    });
    codexTask.appendChild(codexTaskLabel);
    codexTask.appendChild(codexTaskInput);

    codexPasteButton = document.createElement("button");
    codexPasteButton.type = "button";
    codexPasteButton.className = "hashop-codex-paste";
    codexPasteButton.textContent = "Paste text";
    codexPasteButton.addEventListener("click", () => {
      pasteCodexTask();
    });
    codexTask.appendChild(codexPasteButton);

    const codexActions = document.createElement("div");
    codexActions.className = "hashop-codex-actions";

    codexProcessButton = document.createElement("button");
    codexProcessButton.type = "submit";
    codexProcessButton.className = "hashop-codex-action is-primary";
    codexProcessButton.textContent = "Run";

    codexCopyButton = document.createElement("button");
    codexCopyButton.type = "button";
    codexCopyButton.className = "hashop-codex-action";
    codexCopyButton.textContent = "Copy task";
    codexCopyButton.addEventListener("click", () => {
      copyCodexTaskFromDrawer();
    });

    codexStateButton = document.createElement("button");
    codexStateButton.type = "button";
    codexStateButton.className = "hashop-codex-action";
    codexStateButton.textContent = "Copy state";
    codexStateButton.addEventListener("click", () => {
      copyCodexState();
    });

    codexSelectButton = document.createElement("button");
    codexSelectButton.type = "button";
    codexSelectButton.className = "hashop-codex-action";
    codexSelectButton.textContent = "Select result";
    codexSelectButton.addEventListener("click", () => {
      selectCodexOutput();
    });

    codexRefreshButton = document.createElement("button");
    codexRefreshButton.type = "button";
    codexRefreshButton.className = "hashop-codex-action";
    codexRefreshButton.textContent = "Refresh view";
    codexRefreshButton.addEventListener("click", () => {
      refreshDebugView();
    });

    codexTask.appendChild(codexProcessButton);
    codexActions.appendChild(codexCopyButton);
    codexActions.appendChild(codexStateButton);
    codexActions.appendChild(codexSelectButton);
    codexActions.appendChild(codexRefreshButton);

    codexOutput = document.createElement("textarea");
    codexOutput.className = "hashop-codex-output";
    codexOutput.readOnly = true;
    codexOutput.rows = 7;
    codexOutput.tabIndex = 0;
    codexOutput.value = "Ready.";

    codexDrawer.appendChild(codexHead);
    codexDrawer.appendChild(codexTask);
    codexDrawer.appendChild(codexActions);
    codexDrawer.appendChild(codexOutput);
    codexDrawer.appendChild(codexStateNode);
    document.body.appendChild(codexDrawer);

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
    if (codexOpen) {
      renderCodexState();
    }

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
    syncKeyboardDockOffset();
    openCodexDrawer(true);
    observeBody();
    scheduleRender();
    window.addEventListener("resize", scheduleRender, { passive: true });
    window.addEventListener("resize", syncKeyboardDockOffset, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", syncKeyboardDockOffset, { passive: true });
      window.visualViewport.addEventListener("scroll", syncKeyboardDockOffset, { passive: true });
    }
    window.addEventListener("scroll", scheduleRender, { passive: true, capture: true });
    window.addEventListener("transitionrun", () => scheduleMotionFrames(), { passive: true, capture: true });
    window.addEventListener("transitionstart", () => scheduleMotionFrames(), { passive: true, capture: true });
    window.addEventListener("transitionend", scheduleRender, { passive: true, capture: true });
    window.addEventListener("animationstart", () => scheduleMotionFrames(), { passive: true, capture: true });
    window.addEventListener("animationend", scheduleRender, { passive: true, capture: true });
    window.addEventListener("pointerup", () => scheduleMotionFrames(10), { passive: true, capture: true });
    window.addEventListener("load", scheduleRender, { once: true });
  };

  window.__HASHOP_CODEX_BRIDGE__ = {
    page: PAGE,
    open: () => openCodexDrawer(true),
    close: () => openCodexDrawer(false),
    getContext: buildCodexContext,
    getText: () => formatCodexContext(buildCodexContext()),
    getPrompt: formatCodexPrompt,
    copyContext: copyCodexContext,
    copyPrompt: copyCodexPrompt,
    paste: pasteCodexTask,
    selectOutput: selectCodexOutput,
    refreshView: refreshDebugView,
    process: processCodexTask
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
