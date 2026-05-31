(function () {
  const BUILD_VERSION = String(window.__HASHOP_BUILD__ || "hashop-home-i103").trim();
  const BUILD_LABEL = String(window.__HASHOP_BUILD_LABEL__ || "Hashop Home - Iteration 103 - Account Reset and Interactive Map").trim();
  const DEBUG_PAGE = String(window.__HASHOP_DEBUG_PAGE__ || "").trim();
  const DEBUG_ENABLED = hashopDebugEnabled();
  const INITIAL_ROUTE = parseInitialRoute();
  const CONCEPT_NAME = String(INITIAL_ROUTE.concept || "").trim();
  const CONCEPT_MODE = !!CONCEPT_NAME;
  const COMMERCE_CORE = window.HashopCommerceCore || {};
  const DEFAULT_DISCOVERY_CENTER = [12.9716, 77.5946];
  const DEFAULT_DISCOVERY_ZOOM = 14;
  const LOCATE_REVEAL_DELAY_MS = 900;
  const HASHOP_DEFAULT_SHOP_COLOR = "#f4f7f8";
  const HASHOP_ACCOUNT_ACTION_COLOR = "#f4f7f8";
  const HASHOP_USER_MARKER_FILL = "#f4f7f8";
  const HASHOP_USER_MARKER_STROKE = "#070909";
  const HASHOP_USER_ACCURACY_STROKE = "rgba(248, 242, 223, 0.5)";
  const HASHOP_USER_ACCURACY_FILL = "rgba(248, 242, 223, 0.12)";
  const ACCOUNT_ADDRESS_STORAGE_KEY = "hashop_account_addresses";
  const ACCOUNT_PAYMENT_STORAGE_KEY = "hashop_account_payments";
  const ACCOUNT_HELP_STORAGE_KEY = "hashop_account_help_requests";
  const SETUP_CONTACT_VERIFICATION_STORAGE_KEY = "hashop_setup_contact_verification";
  const LISTING_VIEW_STORAGE_KEY = "hashop_listing_view_v2";
  const HASHOP_THEME_STORAGE_KEY = "hashop_theme";
  const HASHOP_GOOGLE_LIGHT_MAP_STYLES = [
    { elementType: "geometry", stylers: [{ color: "#d5d5d5" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#454545" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f2f2f2" }, { weight: 2 }] },
    { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#9a9a9a" }] },
    { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#d8d8d8" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
    { featureType: "poi.business", stylers: [{ visibility: "on" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#cfcfcf" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#f4f4f4" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#bdbdbd" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#505050" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e1e1e1" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#9f9f9f" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#a9b7bd" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#53646a" }] }
  ];
  const HASHOP_GOOGLE_DARK_MAP_STYLES = [
    { elementType: "geometry", stylers: [{ color: "#101010" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#d3d3d3" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#070707" }, { weight: 2 }] },
    { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#565656" }] },
    { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#141414" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1c1c1c" }] },
    { featureType: "poi.business", stylers: [{ visibility: "on" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1f1f1f" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#262626" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0c0c0c" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#c6c6c6" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3b3b3b" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#181818" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#071923" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#89a4a9" }] }
  ];

  function normalizeHashopTheme(value) {
    return String(value || "").trim().toLowerCase() === "dark" ? "dark" : "light";
  }

  function detectMapTheme() {
    try {
      const storedTheme = normalizeHashopTheme(window.localStorage.getItem(HASHOP_THEME_STORAGE_KEY));
      if (storedTheme) return storedTheme;
    } catch (error) {}
    return "light";
  }

  function googleMapStylesForTheme(theme) {
    return theme === "dark" ? HASHOP_GOOGLE_DARK_MAP_STYLES : HASHOP_GOOGLE_LIGHT_MAP_STYLES;
  }

  function applyHashopTheme(state, value) {
    const theme = normalizeHashopTheme(value);
    if (state) state.mapTheme = theme;
    try {
      window.localStorage.setItem(HASHOP_THEME_STORAGE_KEY, theme);
    } catch (error) {}
    const themeColor = theme === "dark" ? "#050505" : "#ffffff";
    try {
      document.documentElement.setAttribute("data-hashop-theme", theme);
      document.body.setAttribute("data-hashop-theme", theme);
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute("content", themeColor);
    } catch (error) {}
    syncMapUiState(state);
    if (state && state.mapProvider === "google" && state.map && typeof state.map.setOptions === "function") {
      state.map.setOptions({
        backgroundColor: theme === "dark" ? "#11100b" : "#d7d0bf",
        styles: googleMapStylesForTheme(theme)
      });
    }
    return theme;
  }

  function hashopDebugEnabled() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      if (params.get("debug") === "0" || params.get("hashop_debug") === "0") {
        window.localStorage.removeItem("hashop_debug");
        return false;
      }
      if (params.get("debug") === "1" || params.get("hashop_debug") === "1") {
        window.localStorage.setItem("hashop_debug", "1");
        return true;
      }
      return window.localStorage.getItem("hashop_debug") === "1";
    } catch (error) {
      return false;
    }
  }

  function exposeHashopDebug(state, bootstrap) {
    if (!DEBUG_ENABLED || !state) return;
    window.__HASHOP_DEBUG__ = {
      version: BUILD_LABEL,
      build: BUILD_VERSION,
      screen: currentScreenMode(state),
      online: isNetworkOnline(),
      route: INITIAL_ROUTE,
      bootstrap: bootstrap,
      state: state,
      mode: function () {
        return syncScreenMode(state);
      },
      dispatch: function (event) {
        return dispatchHashopEvent(state, event);
      },
      refresh: function () {
        renderShopList(state);
        syncActionButton(state);
        syncBackButton(state);
        stabilizeMapViewport(state, 0);
        return state;
      }
    };
    document.documentElement.setAttribute("data-hashop-debug", BUILD_LABEL);
    if (window.console && typeof window.console.info === "function") {
      window.console.info("[Hashop debug]", BUILD_LABEL, window.__HASHOP_DEBUG__);
    }
  }

  function normalizeListingViewMode(value) {
    const mode = String(value || "").trim().toLowerCase();
    return mode === "feed" || mode === "tile" ? "feed" : "list";
  }

  function loadListingViewMode() {
    try {
      return normalizeListingViewMode(window.localStorage.getItem(LISTING_VIEW_STORAGE_KEY) || "feed");
    } catch (error) {
      return "feed";
    }
  }

  function normalizeAccountPaneMode(value) {
    const mode = slugify(String(value || "").trim()).slice(0, 40);
    if (mode === "orders" || mode === "buyer-orders" || mode === "history") return "buyer-orders";
    if (mode === "buyer-login" || mode === "sign-in" || mode === "signin" || mode === "login") return "buyer-login";
    if (mode === "profile" || mode === "addresses" || mode === "payments" || mode === "shops" || mode === "help" || mode === "settings") {
      return mode;
    }
    return "";
  }

  function accountPanePathSegment(value) {
    const mode = normalizeAccountPaneMode(value);
    if (mode === "buyer-orders") return "orders";
    if (mode === "buyer-login") return "sign-in";
    return mode;
  }

  function saveListingViewMode(state, value) {
    const mode = normalizeListingViewMode(value);
    if (state) state.listingViewMode = mode;
    try {
      window.localStorage.setItem(LISTING_VIEW_STORAGE_KEY, mode);
    } catch (error) {}
    syncListingViewAttribute(state);
    return mode;
  }

  function syncListingViewAttribute(state) {
    if (!state || !state.listNode) return;
    const mode = normalizeListingViewMode(state.listingViewMode);
    state.listNode.setAttribute("data-list-view", mode);
    if (state.panelNode) state.panelNode.setAttribute("data-list-view", mode);
  }

  function setStateAttribute(node, name, value) {
    if (!node) return;
    const text = String(value || "").trim();
    if (!text) {
      node.removeAttribute(name);
      return;
    }
    node.setAttribute(name, text);
  }

  function currentOwnerScreenMode(state) {
    if (!state || !isOwnerViewingShop(state)) return "";
    const panel = state.ownerPanel || {};
    if (panel.tab === "settings") return "owner-manage";
    if (panel.tab === "history") {
      return "owner-" + normalizeOwnerHistorySection(panel.section || "orders");
    }
    if (panel.addMenuOpen) return "owner-add";
    return "owner-shop";
  }

  function currentScreenMode(state) {
    if (!state) return "home";
    if (state.debugPaneView === "concept-account-shop") return "concept-account-shop";
    if (state.debugPaneView === "concept-shop-workspace") return "concept-shop-workspace";
    if (state.debugPaneView === "setup") return "setup";
    if (state.debugPaneView === "login") return "login";
    if (state.debugPaneView === "account") return "account";
    if (state.debugPaneView === "recent-orders") return "cart";
    if (state.activeShopId) {
      if (isOwnerViewingShop(state)) return currentOwnerScreenMode(state) || "owner-shop";
      if (state.activeShopView === "cart") return "cart";
      if (state.activeShopView === "confirmation") return "confirmation";
      return "shop";
    }
    const rootMode = normalizeRootMode(state.rootMode);
    if (rootMode === "items") return "search";
    if (rootMode === "contact") return "contact";
    return "home";
  }

  function screenModeLabel(mode) {
    if (mode === "search") return "Items";
    if (mode === "contact") return "Call";
    if (mode === "history") return "History";
    if (mode === "account") return "Account";
    if (mode === "setup") return "Setup";
    if (mode === "login") return "Login";
    if (mode === "concept-account-shop") return "Shop plan";
    if (mode === "concept-shop-workspace") return "Shop work";
    if (mode === "shop") return "Shop";
    if (mode === "cart") return "Cart";
    if (mode === "confirmation") return "Order";
    if (mode === "owner-shop") return "Shop";
    if (mode === "owner-add") return "Add";
    if (mode === "owner-manage") return "Edit shop";
    if (mode === "owner-orders") return "Orders";
    if (mode === "owner-items") return "Inventory";
    return "Home";
  }

  function mapStateDetails(state) {
    if (!state) return { mode: "loading", label: "Map" };
    if (state.locateLoading) return { mode: "locating", label: "Locating" };
    if (state.orderMapCue && state.orderMapCue.label) {
      return { mode: String(state.orderMapCue.mode || "order"), label: String(state.orderMapCue.label || "Order") };
    }
    if (state.activeShopId) {
      const activeShop = state.shopById && state.shopById[state.activeShopId];
      const shopLabel = String(activeShop && (activeShop.display_name || activeShop.shop_id) || "Shop").trim();
      return { mode: "shop", label: shopLabel || "Shop" };
    }
    if (state.userPoint) {
      if (state.userPointSource === "map") return { mode: "focused", label: "Map point" };
      if (state.userPointSource === "address") return { mode: "located", label: "Saved place" };
      return { mode: "located", label: "Near you" };
    }
    const count = Array.isArray(state.shopPoints) ? state.shopPoints.length : 0;
    if (count > 0) return { mode: "ready", label: count === 1 ? "1 shop" : (count + " shops") };
    return { mode: "ready", label: "Map" };
  }

  function syncMapUiState(state) {
    if (!state) return;
    const details = mapStateDetails(state);
    const provider = String(state.mapProvider || "loading").trim() || "loading";
    const theme = String(state.mapTheme || detectMapTheme()).trim() || "light";
    try {
      document.documentElement.setAttribute("data-hashop-theme", theme);
      document.body.setAttribute("data-hashop-theme", theme);
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute("content", theme === "dark" ? "#050505" : "#ffffff");
    } catch (error) {}
    if (state.mapFrameNode) {
      setStateAttribute(state.mapFrameNode, "data-map-state", details.mode);
      setStateAttribute(state.mapFrameNode, "data-map-provider", provider);
      setStateAttribute(state.mapFrameNode, "data-map-label", details.label);
      setStateAttribute(state.mapFrameNode, "data-map-theme", theme);
    }
    if (state.mapNode) {
      setStateAttribute(state.mapNode, "data-map-state", details.mode);
      setStateAttribute(state.mapNode, "data-map-provider", provider);
      setStateAttribute(state.mapNode, "data-map-theme", theme);
    }
    if (state.shellNode) {
      setStateAttribute(state.shellNode, "data-hashop-map-theme", theme);
    }
  }

  function setupAddressPickerActive(state) {
    return !!(state && state.debugPaneView === "setup" && state.setupAddressPickActive);
  }

  function accountProfileAddressPickerActive(state) {
    return !!(state && state.accountPaneMode === "profile" && state.accountProfileAddressPickActive);
  }

  function mapAddressPickerActive(state) {
    return setupAddressPickerActive(state) || accountProfileAddressPickerActive(state);
  }

  function syncSetupAddressPickerUi(state) {
    if (!state) return;
    const mode = mapAddressPickerActive(state) ? "active" : "";
    setStateAttribute(state.shellNode, "data-setup-address-picker", mode);
    setStateAttribute(state.mapFrameNode, "data-setup-address-picker", mode);
    setStateAttribute(state.mapNode, "data-setup-address-picker", mode);
  }

  function isRootScreenMode(mode) {
    return mode === "home" || mode === "search" || mode === "contact";
  }

  function isShopScreenMode(mode) {
    return mode === "shop"
      || mode === "cart"
      || mode === "confirmation"
      || mode.indexOf("owner-") === 0;
  }

  function isRootUtilityState(state, mode) {
    return isRootScreenMode(mode)
      || (!!state && state.debugPaneView === "recent-orders" && !state.activeShopId);
  }

  function accountDisplayState(state) {
    if (!state || state.debugPaneView !== "account") return "";
    const session = state.accountSession || loadAccountSession();
    return accountBuyerAccount(session) || accountOwnerShops(session).length ? "signed-in" : "signed-out";
  }

  function syncScreenMode(state) {
    if (!state) return "home";
    const mode = currentScreenMode(state);
    const rootPanelView = isRootUtilityState(state, mode);
    const shopPanelView = !!state.activeShopId && isShopScreenMode(mode);
    const expandedMode = state.isExpanded ? (state.expandMode || "normal") : "collapsed";
    const label = screenModeLabel(mode);
    const accountState = accountDisplayState(state);
    let accountRole = "";
    if (mode === "account") {
      accountRole = isOwnerAccountMode(state)
        ? "owner"
        : accountBuyerAccount(state.accountSession || loadAccountSession())
        ? "buyer"
        : "guest";
    }
    state.screenMode = mode;
    state.screenLabel = label;
    setStateAttribute(state.shellNode, "data-hashop-screen", mode);
    setStateAttribute(state.shellNode, "data-hashop-pane", expandedMode);
    setStateAttribute(state.shellNode, "data-hashop-state-label", label);
    setStateAttribute(state.shellNode, "data-hashop-account-state", accountState);
    setStateAttribute(state.shellNode, "data-hashop-account-role", accountRole);
    setStateAttribute(state.shellNode, "data-hashop-concept", state.conceptName || (state.conceptMode ? "map-focus" : ""));
    setStateAttribute(state.panelNode, "data-pane-mode", mode);
    setStateAttribute(state.panelNode, "data-pane-expanded", expandedMode);
    setStateAttribute(state.panelNode, "data-account-state", accountState);
    setStateAttribute(state.panelNode, "data-account-role", accountRole);
    if (state.headerStateNode) {
      state.headerStateNode.textContent = label;
    }
    syncMapUiState(state);
    syncSetupAddressPickerUi(state);
    syncUserMarkerAdjustable(state);
    if (state.shellNode) {
      state.shellNode.classList.toggle("is-owner-screen", mode.indexOf("owner-") === 0);
    }
    if (state.panelNode) {
      state.panelNode.classList.toggle("is-root-view", rootPanelView);
      state.panelNode.classList.toggle("is-content-view", !rootPanelView);
      state.panelNode.classList.toggle("is-shop-view", shopPanelView);
      state.panelNode.classList.toggle("is-login-view", mode === "login" || mode === "setup");
    }
    if (DEBUG_ENABLED && window.__HASHOP_DEBUG__) {
      window.__HASHOP_DEBUG__.screen = mode;
      window.__HASHOP_DEBUG__.pane = expandedMode;
      window.__HASHOP_DEBUG__.label = label;
    }
    return mode;
  }

  function loadBootstrap() {
    try {
      const node = document.getElementById("bootstrapData");
      if (!node) return {};
      return JSON.parse(node.textContent || "{}");
    } catch (error) {
      return {};
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clampText(value, maxLength) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    const limit = Number(maxLength || 0);
    if (!text || !Number.isFinite(limit) || limit < 1 || text.length <= limit) {
      return text;
    }
    return text.slice(0, Math.max(1, limit - 1)).trimEnd() + "…";
  }

  function loadLastLocation() {
    try {
      const raw = window.localStorage.getItem("hashop_last_location");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const lat = Number(parsed && parsed.lat);
      const lng = Number(parsed && parsed.lng);
      const accuracy = Math.max(0, Number(parsed && parsed.accuracy) || 0);
      if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
      return {
        lat: lat,
        lng: lng,
        accuracy: accuracy,
        source: String(parsed && parsed.source || "location").trim() || "location",
        updatedAt: Number(parsed && parsed.updatedAt) || 0
      };
    } catch (error) {
      return null;
    }
  }

  function padTimePart(value) {
    return String(Math.max(0, Number(value) || 0)).padStart(2, "0");
  }

  function parseHoursToken(hoursValue, minutesValue, meridiemValue) {
    let hours = Number(hoursValue);
    const minutes = Number(minutesValue || 0);
    if (!isFinite(hours) || !isFinite(minutes) || minutes < 0 || minutes > 59) {
      return "";
    }
    const meridiem = String(meridiemValue || "").trim().toLowerCase();
    if (meridiem) {
      if (hours < 1 || hours > 12) return "";
      if (meridiem === "pm" && hours !== 12) hours += 12;
      if (meridiem === "am" && hours === 12) hours = 0;
    } else if (hours < 0 || hours > 23) {
      return "";
    }
    return padTimePart(hours) + ":" + padTimePart(minutes);
  }

  function parseHoursRange(value) {
    const text = String(value || "").trim();
    if (!text) {
      return { open: "", close: "" };
    }
    const matches = [];
    const pattern = /(\d{1,2})(?::(\d{2}))?\s*([ap]m)?/ig;
    let match;
    while ((match = pattern.exec(text)) && matches.length < 2) {
      const timeValue = parseHoursToken(match[1], match[2], match[3]);
      if (timeValue) matches.push(timeValue);
    }
    return {
      open: matches[0] || "",
      close: matches[1] || ""
    };
  }

  function serializeHoursRange(openValue, closeValue) {
    const open = String(openValue || "").trim();
    const close = String(closeValue || "").trim();
    if (open && close) return open + " - " + close;
    return open || close;
  }

  function ownerHoursFieldMarkup(value) {
    const rawValue = String(value || "").trim();
    const parsed = parseHoursRange(rawValue);
    const parsedAny = !!(parsed.open || parsed.close);
    return '' +
      '<div class="shop-owner-field shop-owner-field-wide">' +
        '<span>Hours</span>' +
        '<div class="shop-owner-time-grid">' +
          '<label class="shop-owner-time-field">' +
            '<span>Open</span>' +
            '<input class="shop-owner-input" type="time" name="hoursOpen" value="' + escapeHtml(parsed.open) + '">' +
          '</label>' +
          '<label class="shop-owner-time-field">' +
            '<span>Close</span>' +
            '<input class="shop-owner-input" type="time" name="hoursClose" value="' + escapeHtml(parsed.close) + '">' +
          '</label>' +
        '</div>' +
        '<input type="hidden" name="hoursLegacy" value="' + escapeHtml(rawValue) + '" data-hours-parsed="' + (parsedAny ? "true" : "false") + '">' +
        '<span class="shop-owner-field-note">' + escapeHtml(
          rawValue && !parsedAny
            ? ("Current saved text stays unchanged until you set times: " + rawValue)
            : "Use opening and closing time."
        ) + '</span>' +
      '</div>';
  }

  function shopUrl(shop) {
    const shopId = String(shop && shop.shop_id || "").trim();
    const publicUrl = String(shop && shop.public_url || "").trim();
    if (publicUrl) {
      if (/\/shop\/[^/]+\/?$/i.test(publicUrl) && shopId) {
        return discoveryShopPath(shopId);
      }
      return publicUrl;
    }
    return discoveryShopPath(shopId);
  }

  function shopColor(shop) {
    const color = String(shop && shop.map_color || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : HASHOP_DEFAULT_SHOP_COLOR;
  }

  function normalizeRootMode(mode) {
    const value = String(mode || "").trim().toLowerCase();
    if (value === "items" || value === "contact") return value;
    return "shops";
  }

  function shopContactPhone(contactValue) {
    const contact = String(contactValue || "").trim();
    if (!contact) return "";
    const normalized = contact.replace(/[^+\d]/g, "");
    const digits = normalized.replace(/\D/g, "");
    if (digits.length < 6) return "";
    return normalized;
  }

  function shopCallHref(contactValue) {
    const phone = shopContactPhone(contactValue);
    return phone ? ("tel:" + phone) : "";
  }

  function shopWhatsAppHref(contactValue, shopName) {
    const digits = String(contactValue || "").replace(/\D/g, "");
    if (digits.length < 8) return "";
    const message = "Hi, I want to ask about " + String(shopName || "your shop").trim() + ".";
    return "https://wa.me/" + digits + "?text=" + encodeURIComponent(message);
  }

  function shopDirectionsHref(shop, detail) {
    if (shop && shop.has_location && isFinite(shop.lat) && isFinite(shop.lng)) {
      return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(String(shop.lat) + "," + String(shop.lng));
    }
    const location = String(detail && detail.location || shop && shop.location_label || "").trim();
    return location ? ("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(location)) : "";
  }

  function shopItemPreview(detail, limit) {
    const maxItems = Math.max(0, Number(limit || 0) || 0);
    if (!detail || !Array.isArray(detail.items) || !maxItems) return [];
    return detail.items.map(function (item) {
      return String(item && item.title || "").trim();
    }).filter(Boolean).slice(0, maxItems);
  }

  function shopSearchTokens(shop, detail) {
    const itemText = Array.isArray(detail && detail.items)
      ? detail.items.map(function (item) {
          return [item && item.title, item && item.description, item && item.price].join(" ");
        }).join(" ")
      : "";
    return [
      shop && shop.display_name,
      shop && shop.shop_id,
      shop && shop.location_label,
      detail && detail.type,
      detail && detail.note,
      detail && detail.contact,
      detail && detail.location,
      detail && detail.hours,
      itemText
    ];
  }

  function rootModeEmptyMessage(mode, hasQuery) {
    if (mode === "items") {
      return hasQuery ? "No items found." : "No items listed yet.";
    }
    if (mode === "contact") {
      return hasQuery ? "No shops to call found." : "No shop phone numbers yet.";
    }
    return hasQuery ? "No shops found." : "No shops yet.";
  }

  function isNetworkOnline() {
    return !("onLine" in window.navigator) || window.navigator.onLine;
  }

  function setConnectionStatus(state, isOnline) {
    if (!state) return;
    state.isOnline = !!isOnline;
    setStateAttribute(state.shellNode, "data-hashop-online", state.isOnline ? "yes" : "no");
    if (state.liveStatusNode) {
      state.liveStatusNode.hidden = state.isOnline;
      state.liveStatusNode.textContent = state.isOnline ? "" : "Offline";
    }
    if (DEBUG_ENABLED && window.__HASHOP_DEBUG__) {
      window.__HASHOP_DEBUG__.online = state.isOnline;
    }
  }

  function stateActionMarkup(label, attribute, tone) {
    const safeAttribute = String(attribute || "").trim();
    if (!safeAttribute) return "";
    return '<button class="shop-state-action' + (tone ? (' is-' + escapeHtml(tone)) : '') + '" type="button" ' + safeAttribute + '>' + escapeHtml(label || "Continue") + '</button>';
  }

  function stateSubstateMarkup(actions, options) {
    const items = Array.isArray(actions) ? actions : [];
    const settings = options && typeof options === "object" ? options : {};
    const body = items.map(function (action) {
      return stateActionMarkup(action && action.label, action && action.attribute, action && action.tone);
    }).join('');
    if (!body) return "";
    const label = String(settings.label || "").trim();
    return '' +
      '<div class="shop-state-substate" data-state-substate="actions">' +
        (label ? '<span class="shop-state-substate-label">' + escapeHtml(label) + '</span>' : '') +
        '<div class="shop-state-substate-actions">' + body + '</div>' +
      '</div>';
  }

  function stateMascotCode(options) {
    const settings = options && typeof options === "object" ? options : {};
    const code = String(settings.code || "").trim();
    if (code) return code;
    const title = String(settings.title || "").trim().toLowerCase();
    const tone = String(settings.tone || "").trim().toLowerCase();
    if (tone === "loading" || /loading/.test(title)) return "fetch...";
    if (tone === "offline" || /offline/.test(title)) return "net: 0";
    if (/cart/.test(title)) return "cart: []";
    if (/order/.test(title)) return "orders: []";
    if (/item|stock|library/.test(title)) return "items: []";
    if (/shop/.test(title)) return "shops: []";
    if (/found|missing/.test(title)) return "404";
    return "state: idle";
  }

  function stateCardMarkup(options) {
    const settings = options && typeof options === "object" ? options : {};
    const tone = String(settings.tone || "").trim();
    const actions = Array.isArray(settings.actions) ? settings.actions : [];
    return '' +
      '<div class="shop-state-card' + (tone ? (' is-' + escapeHtml(tone)) : '') + '" role="status">' +
        '<div class="shop-state-mascot shop-state-mark" aria-hidden="true">' +
          '<span class="shop-state-code">' + escapeHtml(stateMascotCode(settings)) + '</span>' +
        '</div>' +
        '<strong>' + escapeHtml(settings.title || "Nothing here yet") + '</strong>' +
        (settings.message ? '<p>' + escapeHtml(settings.message) + '</p>' : '') +
        (settings.loading ? '<span class="shop-state-skeleton"></span>' : '') +
        stateSubstateMarkup(actions, { label: settings.actionLabel || "" }) +
      '</div>';
  }

  function emptyCartStateMarkup(options) {
    const settings = options && typeof options === "object" ? options : {};
    const scope = String(settings.scope || "").trim() === "shop" ? "shop" : "root";
    const title = settings.title || "Cart is empty";
    const message = settings.message || (scope === "shop"
      ? "Add an item from this shop to start."
      : "Add an item from a shop to start.");
    const actionLabel = settings.actionLabel || (scope === "shop" ? "Items" : "Browse shops");
    const actionAttribute = settings.actionAttribute || (scope === "shop" ? 'data-confirm-items="true"' : 'data-go-home="true"');
    return '' +
      '<div class="shop-empty-cart-card" role="status">' +
        '<div class="shop-empty-cart-visual" aria-hidden="true">' +
          '<span class="shop-empty-cart-buddy">' +
            '<span class="shop-empty-cart-buddy-eye"></span>' +
            '<span class="shop-empty-cart-buddy-eye"></span>' +
            '<span class="shop-empty-cart-buddy-smile"></span>' +
          '</span>' +
          '<span class="shop-empty-cart-basket">' +
            '<span class="shop-empty-cart-basket-rib"></span>' +
            '<span class="shop-empty-cart-basket-rib"></span>' +
            '<span class="shop-empty-cart-basket-rib"></span>' +
          '</span>' +
        '</div>' +
        '<div class="shop-empty-cart-copy">' +
          '<strong>' + escapeHtml(title) + '</strong>' +
          '<p>' + escapeHtml(message) + '</p>' +
        '</div>' +
        stateSubstateMarkup([{ label: actionLabel, attribute: actionAttribute }]) +
      '</div>';
  }

  function emptyItemsStateMarkup(options) {
    const settings = options && typeof options === "object" ? options : {};
    const scope = String(settings.scope || "").trim() === "shop" ? "shop" : "root";
    const query = !!settings.query;
    const title = settings.title || (query
      ? "No item found"
      : scope === "shop"
      ? "No items yet"
      : "No items listed yet");
    const message = settings.message || (query
      ? "Try a different item name or clear the search."
      : scope === "shop"
      ? "This shop has not filled the shelf yet."
      : "When shops add items, they will show here.");
    const actions = Array.isArray(settings.actions) ? settings.actions : [];
    const actionsMarkup = stateSubstateMarkup(actions);
    return '' +
      '<div class="shop-empty-items-card" role="status">' +
        '<div class="shop-empty-items-visual" aria-hidden="true">' +
          '<span class="shop-empty-items-code">items: empty</span>' +
          '<span class="shop-empty-items-line"></span>' +
        '</div>' +
        '<div class="shop-empty-items-copy">' +
          '<strong>' + escapeHtml(title) + '</strong>' +
          '<p>' + escapeHtml(message) + '</p>' +
        '</div>' +
        actionsMarkup +
      '</div>';
  }

  function loadingStateMarkup(title, message) {
    return stateCardMarkup({
      tone: "loading",
      title: title || "Loading",
      message: message || "",
      loading: true
    });
  }

  function rootEmptyStateMarkup(state, mode, hasQuery) {
    if (state && state.isOnline === false) {
      return stateCardMarkup({
        tone: "offline",
        title: "Offline"
      });
    }
    if (mode === "items") {
      return emptyItemsStateMarkup({
        scope: "root",
        query: !!hasQuery,
        actions: [
          hasQuery
            ? { label: "Clear search", attribute: 'data-clear-search="true"', tone: "primary" }
            : { label: "Shops", attribute: 'data-go-home="true"', tone: "primary" },
          hasQuery
            ? { label: "Shops", attribute: 'data-go-home="true"' }
            : { label: "Add shop", attribute: 'data-open-account-entry="true"' }
        ]
      });
    }
    if (hasQuery) {
      return stateCardMarkup({
        title: rootModeEmptyMessage(mode, true),
        actions: [{ label: "Clear search", attribute: 'data-clear-search="true"' }]
      });
    }
    if (mode === "contact") {
      return stateCardMarkup({
        title: "No shop contacts yet",
        actions: [{ label: "Add shop", attribute: 'data-open-account-entry="true"' }]
      });
    }
    return stateCardMarkup({
      title: "No shops listed yet",
      actions: [{ label: "Add shop", attribute: 'data-open-account-entry="true"', tone: "primary" }]
    });
  }

  function shopOpenStatus(detail) {
    const hours = String(detail && detail.hours || "").trim();
    if (/closed/i.test(hours)) return "Closed";
    const match = hours.match(/(\d{1,2}):(\d{2})\D+(\d{1,2}):(\d{2})/);
    if (!match) return "Open now";
    const openMinutes = (Number(match[1]) * 60) + Number(match[2]);
    const closeMinutes = (Number(match[3]) * 60) + Number(match[4]);
    if (!isFinite(openMinutes) || !isFinite(closeMinutes)) return "Open now";
    const now = new Date();
    const currentMinutes = (now.getHours() * 60) + now.getMinutes();
    const isOpen = closeMinutes >= openMinutes
      ? currentMinutes >= openMinutes && currentMinutes <= closeMinutes
      : currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
    return isOpen ? "Open now" : "Closed";
  }

  function formatDistance(distanceMeters) {
    if (distanceMeters == null || !isFinite(distanceMeters)) return "Location pending";
    if (distanceMeters < 1000) {
      return Math.max(1, Math.round(distanceMeters)) + " m away";
    }
    if (distanceMeters < 10000) {
      return (distanceMeters / 1000).toFixed(1) + " km away";
    }
    return Math.round(distanceMeters / 1000) + " km away";
  }

  function haversineMeters(fromLat, fromLng, toLat, toLng) {
    const rad = Math.PI / 180;
    const earthRadius = 6371000;
    const latDelta = (toLat - fromLat) * rad;
    const lngDelta = (toLng - fromLng) * rad;
    const a =
      Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
      Math.cos(fromLat * rad) * Math.cos(toLat * rad) *
      Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2);
    return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function shopDistanceMeters(shop, userPoint) {
    if (!userPoint || !shop || !shop.has_location || !isFinite(shop.lat) || !isFinite(shop.lng)) {
      return null;
    }
    return haversineMeters(userPoint[0], userPoint[1], shop.lat, shop.lng);
  }

  function statusLabel(shop, userPoint) {
    const distance = shopDistanceMeters(shop, userPoint);
    if (distance != null) return formatDistance(distance);
    return shop && shop.has_location ? "On map" : "Location pending";
  }

  function orderedShops(shops, userPoint) {
    return shops.slice().sort(function (left, right) {
      const leftDistance = shopDistanceMeters(left, userPoint);
      const rightDistance = shopDistanceMeters(right, userPoint);
      const leftLocated = leftDistance != null;
      const rightLocated = rightDistance != null;
      if (leftLocated && rightLocated && leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }
      if (leftLocated !== rightLocated) {
        return leftLocated ? -1 : 1;
      }
      if (!!left.has_location !== !!right.has_location) {
        return left.has_location ? -1 : 1;
      }
      return String(left.display_name || left.shop_id || "").localeCompare(String(right.display_name || right.shop_id || ""));
    });
  }

  function buildPopup(shop, userPoint) {
    return '' +
      '<a class="map-popup" data-shop-id="' + escapeHtml(shop.shop_id || "") + '" style="--shop-color:' + escapeHtml(shopColor(shop)) + ';" href="' + escapeHtml(shopUrl(shop)) + '">' +
        '<strong>' + escapeHtml(shop.display_name || shop.shop_id) + '</strong>' +
        '<span>@' + escapeHtml(shop.shop_id || "") + ' · ' + escapeHtml(statusLabel(shop, userPoint)) + '</span>' +
      '</a>';
  }

  function normalizePricing(pricing) {
    return COMMERCE_CORE.normalizePricing(pricing);
  }

  function formatPrice(value, pricing) {
    return COMMERCE_CORE.formatPrice(value, pricing);
  }

  function formatTotalAmount(value, pricing) {
    return COMMERCE_CORE.formatTotalAmount(value, pricing);
  }

  function pricingCurrencyCode(pricing) {
    return COMMERCE_CORE.pricingCurrencyCode(pricing);
  }

  function priceNumber(value) {
    return COMMERCE_CORE.priceNumber(value);
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function parseLegacyPaneRoute(url) {
    const pane = String(url && url.searchParams && url.searchParams.get("pane") || "").trim().toLowerCase();
    if (pane === "home" || pane === "shops") return { kind: "root", rootMode: "shops" };
    if (pane === "items" || pane === "search") return { kind: "root", rootMode: "items" };
    if (pane === "contact" || pane === "call") return { kind: "root", rootMode: "contact" };
    if (pane === "setup") return { kind: "setup" };
    if (pane === "login") return { kind: "login" };
    if (pane === "account") return { kind: "account" };
    if (pane === "orders" || pane === "cart") return { kind: "orders" };
    return { kind: "home" };
  }

  function parseInitialRoute() {
    try {
      const url = new URL(window.location.href);
      let segments = url.pathname
        .split("/")
        .filter(function (part) {
          return !!String(part || "").trim();
        })
        .map(function (part) {
          try {
            return decodeURIComponent(part);
          } catch (error) {
            return String(part || "");
          }
        });
      let conceptMode = false;
      let conceptName = "";
      function finish(route) {
        const safeRoute = route && typeof route === "object" ? route : { kind: "home" };
        if (conceptMode) {
          safeRoute.concept = safeRoute.concept || conceptName || "map-focus";
        }
        return safeRoute;
      }
      if (!segments.length) return parseLegacyPaneRoute(url);
      let first = slugify(segments[0]).slice(0, 63);
      if (first === "concept") {
        conceptMode = true;
        segments = segments.slice(1);
        first = slugify(segments[0] || "").slice(0, 63);
        if (first === "account-shop" || first === "shop-workspace") {
          conceptName = first;
          return finish({ kind: "concept", concept: first });
        }
        if (first === "map-focus") {
          conceptName = "map-focus";
          segments = segments.slice(1);
          first = slugify(segments[0] || "").slice(0, 63);
        } else {
          conceptName = "map-focus";
        }
        if (!first) return finish({ kind: "root", rootMode: "shops" });
      }
      if (first === "setup") return finish({ kind: "setup" });
      if (first === "login") return finish({ kind: "login" });
      if (first === "manage") return finish({ kind: "manage" });
      if (first === "account") {
        return finish({
          kind: "account",
          accountPaneMode: normalizeAccountPaneMode(segments[1] || "")
        });
      }
      if (first === "orders" || first === "cart") return finish({ kind: "orders" });
      if (first === "home" || first === "shops") return finish({ kind: "root", rootMode: "shops" });
      if (first === "items" || first === "search") return finish({ kind: "root", rootMode: "items" });
      if (first === "contact" || first === "call") return finish({ kind: "root", rootMode: "contact" });
      if (!first) return finish(parseLegacyPaneRoute(url));
      const second = String(segments[1] || "").trim().toLowerCase();
      if (!second) {
        return finish({ kind: "shop", shopId: first });
      }
      if (second === "cart") {
        return finish({ kind: "shop", shopId: first, shopView: "cart" });
      }
      if (second === "settings") {
        return finish({
          kind: "shop",
          shopId: first,
          ownerTab: "settings",
          ownerSection: normalizeOwnerSettingsSection(segments[2] || "profile")
        });
      }
      if (second === "history") {
        return finish({
          kind: "shop",
          shopId: first,
          ownerTab: "history",
          ownerSection: normalizeOwnerHistorySection(segments[2] || "orders")
        });
      }
      return finish(parseLegacyPaneRoute(url));
    } catch (error) {
      return { kind: "home" };
    }
  }

  function encodePathSegment(value) {
    return encodeURIComponent(String(value || "").trim());
  }

  function discoveryShopPath(shopId) {
    const safeShopId = slugify(shopId).slice(0, 63);
    return safeShopId ? ("/" + encodePathSegment(safeShopId)) : "/";
  }

  function appPath(state, path) {
    const safePath = String(path || "/").trim() || "/";
    if (!state || !state.conceptMode) return safePath;
    if (state.conceptName === "account-shop" || state.conceptName === "shop-workspace") {
      return "/concept/" + state.conceptName;
    }
    return safePath === "/" ? "/concept" : ("/concept" + safePath);
  }

  function panePath(state) {
    if (!state) return "/";
    if (state.debugPaneView === "concept-account-shop") return "/concept/account-shop";
    if (state.debugPaneView === "concept-shop-workspace") return "/concept/shop-workspace";
    if (state.debugPaneView === "setup") return appPath(state, "/setup");
    if (state.debugPaneView === "login") return appPath(state, "/login");
    if (state.debugPaneView === "account") {
      const accountSegment = accountPanePathSegment(state.accountPaneMode);
      if (accountSegment === "shops") return appPath(state, "/manage");
      return appPath(state, accountSegment ? ("/account/" + encodePathSegment(accountSegment)) : "/account");
    }
    if (state.debugPaneView === "recent-orders") return appPath(state, "/cart");
    if (!state.activeShopId) {
      const rootMode = normalizeRootMode(state.rootMode);
      if (rootMode === "items") return appPath(state, "/items");
      if (rootMode === "contact") return appPath(state, "/contact");
      return appPath(state, "/");
    }
    const shopPath = discoveryShopPath(state.activeShopId);
    if (isOwnerViewingShop(state)) {
      if (state.ownerPanel.tab === "settings") {
        return appPath(state, state.ownerPanel.section === "payments"
          ? (shopPath + "/settings/payments")
          : (shopPath + "/settings"));
      }
      if (state.ownerPanel.tab === "history") {
        return appPath(state, state.ownerPanel.section === "items"
          ? (shopPath + "/history/items")
          : state.ownerPanel.section === "sales"
          ? (shopPath + "/history/sales")
          : (shopPath + "/history"));
      }
    }
    if (state.activeShopView === "cart") {
      return appPath(state, shopPath + "/cart");
    }
    return appPath(state, shopPath);
  }

  function syncPaneUrl(state, options) {
    if (!window.history || typeof window.history.replaceState !== "function") return;
    try {
      const settings = options && typeof options === "object" ? options : {};
      const next = panePath(state);
      const current = window.location.pathname;
      if (next !== current || window.location.search) {
        const method = settings.push && typeof window.history.pushState === "function" ? "pushState" : "replaceState";
        window.history[method]({ hashopPath: next }, "", next + window.location.hash);
      }
    } catch (error) {}
  }

  function pushPaneUrl(state) {
    syncPaneUrl(state, { push: true });
  }

  function parseJson(response) {
    return response.json().catch(function () {
      return {};
    });
  }

  function normalizeOwnerShops(value) {
    if (!Array.isArray(value)) return [];
    const seen = {};
    return value.reduce(function (result, item) {
      if (!item || typeof item !== "object") return result;
      const shopId = slugify(String(item.shopId || item.id || item.shop_id || "").trim()).slice(0, 64);
      const shopName = String(item.shopName || item.name || item.display_name || shopId).trim().slice(0, 160);
      if (!shopId || seen[shopId]) return result;
      seen[shopId] = true;
      result.push({
        shopId: shopId,
        shopName: shopName || shopId
      });
      return result;
    }, []);
  }

  function normalizeBuyerAccount(value) {
    if (!value || typeof value !== "object") return null;
    const accountId = String(value.accountId || value.account_id || value.id || "").trim().slice(0, 64);
    const accountToken = String(value.accountToken || value.account_token || value.token || "").trim().slice(0, 255);
    const displayName = String(value.displayName || value.display_name || value.name || "").trim().slice(0, 160);
    const contact = String(value.contact || value.phone || value.email || "").trim().slice(0, 255);
    const buyerKey = String(value.buyerKey || value.buyer_key || "").trim().slice(0, 160);
    if (!accountId || !accountToken) return null;
    return {
      accountId: accountId,
      accountToken: accountToken,
      displayName: displayName,
      contact: contact,
      buyerKey: buyerKey,
      ownerShops: normalizeOwnerShops(value.ownerShops || value.owner_shops || value.shops),
      roles: normalizeAccountRoles(value.roles || [], normalizeOwnerShops(value.ownerShops || value.owner_shops || value.shops))
    };
  }

  function normalizeAccountRoles(value, ownerShops) {
    const seen = {};
    const roles = [];
    if (Array.isArray(value)) {
      value.forEach(function (item) {
        const role = String(item || "").trim().toLowerCase();
        if ((role === "buyer" || role === "owner") && !seen[role]) {
          seen[role] = true;
          roles.push(role);
        }
      });
    }
    if (ownerShops.length && !seen.owner) {
      roles.push("owner");
    }
    return roles;
  }

  function normalizeAccountActiveRole(value, roles, ownerShops) {
    const role = String(value || "").trim().toLowerCase();
    const hasOwner = Array.isArray(ownerShops) && ownerShops.length > 0;
    const hasBuyer = Array.isArray(roles) && roles.indexOf("buyer") !== -1;
    if (role === "owner" && hasOwner) return "owner";
    if (role === "buyer" && hasBuyer) return "buyer";
    if (hasBuyer) return "buyer";
    if (role === "buyer" || !hasOwner) return "buyer";
    if (hasOwner) return "owner";
    return "buyer";
  }

  function normalizeAccountSession(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const buyerAccount = normalizeBuyerAccount(source.buyerAccount || source.buyer || source.account);
    const rawOwnerShops = Array.isArray(source.ownerShops)
      ? source.ownerShops
      : (Array.isArray(source.shops) ? source.shops : []);
    const rawBuyerOwnerShops = buyerAccount && Array.isArray(buyerAccount.ownerShops)
      ? buyerAccount.ownerShops
      : [];
    const ownerShops = normalizeOwnerShops(rawOwnerShops.concat(rawBuyerOwnerShops));
    const roles = normalizeAccountRoles(source.roles, ownerShops);
    if (buyerAccount && roles.indexOf("buyer") === -1) {
      roles.push("buyer");
    }
    let displayName = String(source.displayName || source.name || "").trim().slice(0, 160);
    if (!displayName && buyerAccount) {
      displayName = String(buyerAccount.displayName || buyerAccount.contact || "").trim().slice(0, 160);
    }
    let preferredOwnerShopId = slugify(String(source.preferredOwnerShopId || source.ownerShopId || "").trim()).slice(0, 64);
    if (preferredOwnerShopId && !ownerShops.some(function (shop) {
      return shop.shopId === preferredOwnerShopId;
    })) {
      preferredOwnerShopId = "";
    }
    if (!displayName && ownerShops.length === 1) {
      displayName = String(ownerShops[0].shopName || ownerShops[0].shopId).trim().slice(0, 160);
    }
    if (!roles.length && !ownerShops.length && !displayName && !buyerAccount) {
      return null;
    }
    return {
      displayName: displayName,
      roles: roles,
      activeRole: normalizeAccountActiveRole(source.activeRole || source.currentRole || source.mode, roles, ownerShops),
      ownerShops: ownerShops,
      preferredOwnerShopId: preferredOwnerShopId,
      buyerAccount: buyerAccount
    };
  }

  function accountBuyerAccount(session) {
    return session && session.buyerAccount ? normalizeBuyerAccount(session.buyerAccount) : null;
  }

  function accountOwnerShops(session) {
    return session && Array.isArray(session.ownerShops) ? session.ownerShops.slice() : [];
  }

  function ownerAccountShops(state) {
    return accountOwnerShops(state && state.accountSession ? state.accountSession : loadAccountSession());
  }

  function accountActiveRole(state) {
    const session = state && state.accountSession ? state.accountSession : loadAccountSession();
    const ownerShops = accountOwnerShops(session);
    const roles = session && Array.isArray(session.roles) ? session.roles : [];
    return normalizeAccountActiveRole(session && session.activeRole, roles, ownerShops);
  }

  function isOwnerAccountMode(state) {
    return accountActiveRole(state) === "owner" && ownerAccountShops(state).length > 0;
  }

  function ownerShopIdSet(state) {
    const result = {};
    ownerAccountShops(state).forEach(function (shop) {
      const shopId = String(shop && shop.shopId || "").trim();
      if (shopId) result[shopId] = true;
    });
    return result;
  }

  function accountHasRole(session, role) {
    const safeRole = String(role || "").trim().toLowerCase();
    if (!safeRole || !session || !Array.isArray(session.roles)) return false;
    return session.roles.indexOf(safeRole) !== -1;
  }

  function preferredOwnerShop(session, fallbackShopId) {
    const ownerShops = accountOwnerShops(session);
    if (!ownerShops.length) return null;
    const preferredShopId = slugify(String(fallbackShopId || session.preferredOwnerShopId || "").trim()).slice(0, 64);
    if (preferredShopId) {
      const matched = ownerShops.find(function (shop) {
        return shop.shopId === preferredShopId;
      }) || null;
      if (matched) return matched;
    }
    return ownerShops[0];
  }

  function preferredOwnerShopId(session, fallbackShopId) {
    const shop = preferredOwnerShop(session, fallbackShopId);
    return shop ? String(shop.shopId || "").trim() : "";
  }

  function preferredOwnerShopName(session, fallbackShopId) {
    const shop = preferredOwnerShop(session, fallbackShopId);
    return shop ? String(shop.shopName || shop.shopId || "").trim() : "";
  }

  function syncLegacyOwnerIdentity(session) {
    try {
      const shop = preferredOwnerShop(session);
      if (shop) {
        window.localStorage.setItem("hashop_shop_name", String(shop.shopName || shop.shopId || "").trim());
        window.localStorage.setItem("hashop_vendor_id", String(shop.shopId || "").trim());
      } else {
        window.localStorage.removeItem("hashop_shop_name");
        window.localStorage.removeItem("hashop_vendor_id");
      }
    } catch (error) {}
  }

  function loadAccountSession() {
    let parsed = null;
    try {
      const raw = window.localStorage.getItem("hashop_account_session") || "";
      if (raw) parsed = JSON.parse(raw);
    } catch (error) {}
    const normalized = normalizeAccountSession(parsed);
    if (normalized) return normalized;
    let legacyShopId = "";
    let legacyShopName = "";
    try {
      legacyShopId = slugify(String(window.localStorage.getItem("hashop_vendor_id") || "").trim()).slice(0, 64);
      legacyShopName = String(window.localStorage.getItem("hashop_shop_name") || "").trim().slice(0, 160);
    } catch (error) {}
    if (!legacyShopId) return null;
    return normalizeAccountSession({
      displayName: legacyShopName,
      roles: ["owner"],
      preferredOwnerShopId: legacyShopId,
      ownerShops: [{
        shopId: legacyShopId,
        shopName: legacyShopName || legacyShopId
      }]
    });
  }

  function saveAccountSession(session) {
    const normalized = normalizeAccountSession(session);
    try {
      if (normalized) {
        window.localStorage.setItem("hashop_account_session", JSON.stringify(normalized));
      } else {
        window.localStorage.removeItem("hashop_account_session");
      }
    } catch (error) {}
    syncLegacyOwnerIdentity(normalized);
    return normalized;
  }

  function setAccountSession(state, session) {
    const normalized = saveAccountSession(session || null);
    if (state) {
      state.accountSession = normalized;
      state.ownerShopId = preferredOwnerShopId(normalized, state.ownerShopId);
    }
    return normalized;
  }

  function saveShopIdentity(shopName, shopId) {
    const safeShopId = slugify(String(shopId || "").trim()).slice(0, 64);
    if (!safeShopId) return loadAccountSession();
    const current = loadAccountSession() || {};
    const ownerShops = normalizeOwnerShops([{
      shopId: safeShopId,
      shopName: String(shopName || safeShopId).trim()
    }].concat(current.ownerShops || []));
    const roles = current.buyerAccount
      ? normalizeAccountRoles((current.roles || []).concat(["buyer", "owner"]), ownerShops)
      : normalizeAccountRoles((current.roles || []).concat(["owner"]), ownerShops);
    return saveAccountSession({
      displayName: String(current.displayName || shopName || safeShopId).trim(),
      roles: roles,
      activeRole: "owner",
      ownerShops: ownerShops,
      preferredOwnerShopId: safeShopId,
      buyerAccount: current.buyerAccount || null
    });
  }

  function clearShopIdentity() {
    const current = loadAccountSession();
    const buyerAccount = accountBuyerAccount(current);
    saveAccountSession(buyerAccount ? {
      displayName: current && current.displayName || "",
      roles: ["buyer"],
      activeRole: "buyer",
      ownerShops: [],
      preferredOwnerShopId: "",
      buyerAccount: buyerAccount
    } : null);
  }

  function loadSavedOwnerId() {
    return preferredOwnerShopId(loadAccountSession());
  }

  function loadSavedShopName() {
    return preferredOwnerShopName(loadAccountSession());
  }

  function generateBuyerKey() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return "buyer-" + window.crypto.randomUUID();
    }
    return "buyer-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function loadBuyerKey() {
    try {
      return window.localStorage.getItem("hashop_buyer_key") || "";
    } catch (error) {
      return "";
    }
  }

  function ensureBuyerKey() {
    let key = String(loadBuyerKey() || "").trim();
    if (key) return key;
    key = generateBuyerKey();
    try {
      window.localStorage.setItem("hashop_buyer_key", key);
    } catch (error) {}
    return key;
  }

  function normalizeBuyerRecentRefs(value) {
    if (!Array.isArray(value)) return [];
    const seen = {};
    return value.reduce(function (result, item) {
      if (!item || typeof item !== "object") return result;
      const orderId = String(item.orderId || item.id || "").trim().slice(0, 64);
      const shopId = String(item.shopId || "").trim().slice(0, 64);
      const timestamp = Number(item.timestamp || 0);
      if (!orderId || !shopId) return result;
      const key = shopId + ":" + orderId;
      if (seen[key]) return result;
      seen[key] = true;
      result.push({
        orderId: orderId,
        shopId: shopId,
        timestamp: isFinite(timestamp) ? Math.max(0, Math.round(timestamp)) : 0
      });
      return result;
    }, []).sort(function (left, right) {
      return Number(right.timestamp || 0) - Number(left.timestamp || 0);
    }).slice(0, 24);
  }

  function normalizeBuyerProfile(raw, buyerKey) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      buyerKey: String(buyerKey || source.buyerKey || "").trim().slice(0, 160),
      name: String(source.name || "").trim().slice(0, 160),
      nickname: String(source.nickname || source.nick || "").trim().slice(0, 80),
      contact: String(source.contact || "").trim().slice(0, 255),
      address: String(source.address || source.buyerAddress || "").trim().slice(0, 240),
      avatarUrl: String(source.avatarUrl || source.avatar || "").trim().slice(0, 512),
      recentOrderRefs: normalizeBuyerRecentRefs(source.recentOrderRefs)
    };
  }

  function loadBuyerProfile() {
    let parsed = {};
    try {
      const raw = window.localStorage.getItem("hashop_buyer_profile") || "";
      if (raw) parsed = JSON.parse(raw);
    } catch (error) {}
    return normalizeBuyerProfile(parsed, ensureBuyerKey());
  }

  function saveBuyerProfile(profile) {
    const normalized = normalizeBuyerProfile(profile, ensureBuyerKey());
    try {
      window.localStorage.setItem("hashop_buyer_profile", JSON.stringify(normalized));
    } catch (error) {}
    return normalized;
  }

  function clearBuyerLocalIdentity() {
    try {
      window.localStorage.removeItem("hashop_buyer_profile");
      window.localStorage.removeItem("hashop_buyer_key");
    } catch (error) {}
    return loadBuyerProfile();
  }

  function clearAccountScopedLocalData(state, options) {
    const settings = options && typeof options === "object" ? options : {};
    const preserveCartShopId = String(settings.preserveCartShopId || "").trim();
    const preservedCart = state && preserveCartShopId && state.cartByShop && state.cartByShop[preserveCartShopId]
      ? Object.assign({}, state.cartByShop[preserveCartShopId])
      : null;
    try {
      [
        "hashop_account_session",
        "hashop_shop_name",
        "hashop_vendor_id",
        "hashop_buyer_profile",
        "hashop_buyer_key",
        "hashop_last_location",
        ACCOUNT_ADDRESS_STORAGE_KEY,
        ACCOUNT_PAYMENT_STORAGE_KEY,
        ACCOUNT_HELP_STORAGE_KEY,
        SETUP_CONTACT_VERIFICATION_STORAGE_KEY
      ].forEach(function (key) {
        window.localStorage.removeItem(key);
      });
    } catch (error) {}
    if (!state) return;
    state.accountSessionSerial = Math.max(0, Number(state.accountSessionSerial || 0) || 0) + 1;
    state.accountSessionRefreshing = false;
    state.accountSessionRefreshPromise = null;
    if (state.userMarker) {
      if (state.mapProvider === "google" && typeof state.userMarker.setMap === "function") {
        state.userMarker.setMap(null);
      } else if (state.map && typeof state.map.removeLayer === "function") {
        state.map.removeLayer(state.userMarker);
      }
    }
    if (state.userAccuracy) {
      if (state.mapProvider === "google" && typeof state.userAccuracy.setMap === "function") {
        state.userAccuracy.setMap(null);
      } else if (state.map && typeof state.map.removeLayer === "function") {
        state.map.removeLayer(state.userAccuracy);
      }
    }
    state.accountSession = null;
    state.ownerShopId = "";
    state.buyerProfile = normalizeBuyerProfile({}, "");
    state.buyerOrders = [];
    state.buyerOrdersLoading = false;
    state.buyerOrdersError = "";
    state.accountAddresses = [];
    state.accountPayments = [];
    state.savedUserLocation = null;
    state.userPoint = null;
    state.userPointSource = "";
    state.userMarker = null;
    state.userAccuracy = null;
    state.cartByShop = preservedCart ? Object.assign({}, { [preserveCartShopId]: preservedCart }) : {};
    state.selectedPaymentByShop = {};
    state.paymentPickerOpenByShop = {};
    state.paymentModeByShop = {};
    state.fulfillmentModeByShop = {};
    state.checkoutNoticeByShop = {};
    state.orderConfirmationByShop = {};
    state.pendingCheckoutShopId = preservedCart ? preserveCartShopId : "";
    state.ownerOrderDraftByShop = {};
    state.ownerPanel.tab = "";
    state.ownerPanel.section = "";
    state.ownerPanel.itemId = "";
    state.ownerPanel.message = "";
    state.ownerPanel.tone = "";
    state.ownerPanel.addMenuOpen = false;
    state.ownerPanel.orderDraftOpen = false;
    syncLegacyOwnerIdentity(null);
    syncMapUiState(state);
  }

  function setBuyerProfile(state, profile) {
    if (!state) return null;
    state.buyerProfile = saveBuyerProfile(profile || {});
    return state.buyerProfile;
  }

  function saveBuyerAccountSession(state, account, options) {
    const buyerAccount = normalizeBuyerAccount(account);
    if (!state || !buyerAccount) return null;
    const settings = options && typeof options === "object" ? options : {};
    if (buyerAccount.buyerKey) {
      try {
        window.localStorage.setItem("hashop_buyer_key", buyerAccount.buyerKey);
      } catch (error) {}
    }
    const current = state.accountSession || loadAccountSession() || {};
    const accountOwnerShops = normalizeOwnerShops(buyerAccount.ownerShops || []);
    const ownerShops = settings.replaceOwnerShops
      ? accountOwnerShops
      : normalizeOwnerShops(accountOwnerShops.concat(current.ownerShops || []));
    const roles = normalizeAccountRoles((current.roles || []).concat(buyerAccount.roles || []).concat(["buyer"]), ownerShops);
    const activeRole = settings.preserveActiveRole
      ? normalizeAccountActiveRole(current.activeRole, roles, ownerShops)
      : "buyer";
    const nextSession = setAccountSession(state, {
      displayName: String(current.displayName || buyerAccount.displayName || buyerAccount.contact || "").trim(),
      roles: roles,
      activeRole: activeRole,
      ownerShops: ownerShops,
      preferredOwnerShopId: current.preferredOwnerShopId || preferredOwnerShopId({ ownerShops: ownerShops }) || "",
      buyerAccount: buyerAccount
    });
    const currentProfile = state.buyerProfile && typeof state.buyerProfile === "object"
      ? state.buyerProfile
      : loadBuyerProfile();
    const savedAddress = buyerCheckoutAddress(state, currentProfile);
    setBuyerProfile(state, {
      buyerKey: buyerAccount.buyerKey || ensureBuyerKey(),
      name: buyerAccount.displayName || currentProfile.name || "",
      nickname: currentProfile.nickname || "",
      contact: buyerAccount.contact || currentProfile.contact || "",
      address: currentProfile.address || savedAddress || "",
      avatarUrl: currentProfile.avatarUrl || "",
      recentOrderRefs: currentProfile.recentOrderRefs || []
    });
    return nextSession;
  }

  function replaceSignedInBuyerAccount(state, account, options) {
    if (!state) return Promise.resolve(null);
    const buyerAccount = normalizeBuyerAccount(account);
    if (!buyerAccount) return Promise.resolve(null);
    const settings = options && typeof options === "object" ? options : {};
    clearBuyerOrdersPoll(state);
    clearAccountScopedLocalData(state, {
      preserveCartShopId: settings.preserveCartShopId
    });
    const saved = saveBuyerAccountSession(state, buyerAccount, {
      replaceOwnerShops: true
    });
    return refreshBuyerAccountSession(state, {
      force: true,
      silent: true
    }).then(function (refreshed) {
      return refreshed || saved;
    }).catch(function () {
      return saved;
    });
  }

  function refreshBuyerAccountSession(state, options) {
    if (!state) return Promise.resolve(null);
    const settings = options && typeof options === "object" ? options : {};
    const session = state.accountSession || loadAccountSession();
    const buyerAccount = accountBuyerAccount(session);
    if (!buyerAccount) return Promise.resolve(session || null);
    const refreshSerial = Math.max(0, Number(state.accountSessionSerial || 0) || 0);
    const refreshAccountId = String(buyerAccount.accountId || "").trim();
    const refreshAccountToken = String(buyerAccount.accountToken || "").trim();
    if (state.accountSessionRefreshing && !settings.force) {
      return state.accountSessionRefreshPromise || Promise.resolve(state.accountSession || session || null);
    }
    state.accountSessionRefreshing = true;
    const refreshPromise = refreshBuyerAccountSessionRequest(buyerAccount).then(function (result) {
      if (!result || !result.ok) {
        const error = String(result && result.payload && result.payload.error || "").trim();
        if (!settings.silent && state.debugPaneView === "account") {
          setAccountDraftMessage(state, error === "invalid_buyer_account" ? "Sign in again." : "Could not refresh account.", "error");
          renderShopList(state);
        }
        return state.accountSession || session || null;
      }
      const payload = result.payload || {};
      const accountPayload = payload.account;
      const account = accountPayload && typeof accountPayload === "object"
        ? Object.assign({}, accountPayload, {
          ownerShops: accountPayload.ownerShops || payload.owner_shops || payload.ownerShops || []
        })
        : accountPayload;
      const currentAccount = accountBuyerAccount(state.accountSession || loadAccountSession());
      if (
        Math.max(0, Number(state.accountSessionSerial || 0) || 0) !== refreshSerial
        || !currentAccount
        || String(currentAccount.accountId || "").trim() !== refreshAccountId
        || String(currentAccount.accountToken || "").trim() !== refreshAccountToken
      ) {
        return state.accountSession || loadAccountSession() || null;
      }
      const refreshed = saveBuyerAccountSession(state, account, {
        preserveActiveRole: true,
        replaceOwnerShops: Array.isArray(payload.owner_shops) || Array.isArray(payload.ownerShops)
      });
      updateSearchField(state);
      syncActionButton(state);
      syncBackButton(state);
      if (state.debugPaneView === "account" || isOwnerAccountMode(state)) {
        renderShopList(state);
      }
      refreshOwnerOrdersNavData(state, { force: true });
      return refreshed;
    }).catch(function () {
      if (!settings.silent && state.debugPaneView === "account") {
        setAccountDraftMessage(state, "Could not refresh account.", "error");
        renderShopList(state);
      }
      return state.accountSession || session || null;
    }).finally(function () {
      if (state.accountSessionRefreshPromise === refreshPromise) {
        state.accountSessionRefreshing = false;
        state.accountSessionRefreshPromise = null;
      }
    });
    state.accountSessionRefreshPromise = refreshPromise;
    return state.accountSessionRefreshPromise;
  }

  function mergeBuyerProfile(state, patch) {
    if (!state) return null;
    const current = state.buyerProfile && typeof state.buyerProfile === "object"
      ? state.buyerProfile
      : loadBuyerProfile();
    return setBuyerProfile(state, Object.assign({}, current, patch || {}));
  }

  function generateAccountLocalId(prefix) {
    const safePrefix = String(prefix || "account").trim() || "account";
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return safePrefix + "-" + window.crypto.randomUUID();
    }
    return safePrefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function formatAccountCoordinates(lat, lng) {
    if (!isFinite(lat) || !isFinite(lng)) return "";
    return Number(lat).toFixed(5) + ", " + Number(lng).toFixed(5);
  }

  function isValidMapPoint(lat, lng) {
    return isFinite(lat) && isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  function normalizeAccountAddress(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    let id = String(source.id || source.addressId || "").trim().slice(0, 80);
    let label = String(source.label || source.name || "").trim().slice(0, 80);
    let text = String(source.text || source.address || source.value || "").trim().slice(0, 240);
    const lat = Number(source.lat);
    const lng = Number(source.lng);
    const hasPoint = isFinite(lat) && isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    if (!label && !text && !hasPoint) return null;
    if (!id) id = generateAccountLocalId("addr").slice(0, 80);
    if (!label) label = "Saved place";
    if (!text && hasPoint) text = formatAccountCoordinates(lat, lng);
    return {
      id: id,
      label: label,
      text: text,
      lat: hasPoint ? lat : null,
      lng: hasPoint ? lng : null,
      isDefault: !!source.isDefault,
      updatedAt: Math.max(0, Number(source.updatedAt || Date.now()) || Date.now())
    };
  }

  function normalizeAccountAddresses(value) {
    if (!Array.isArray(value)) return [];
    const seen = {};
    let defaultSeen = false;
    const result = value.reduce(function (items, item) {
      const normalized = normalizeAccountAddress(item);
      if (!normalized || seen[normalized.id]) return items;
      seen[normalized.id] = true;
      if (normalized.isDefault && !defaultSeen) {
        defaultSeen = true;
      } else {
        normalized.isDefault = false;
      }
      items.push(normalized);
      return items;
    }, []).sort(function (left, right) {
      return Number(right.updatedAt || 0) - Number(left.updatedAt || 0);
    }).slice(0, 12);
    if (result.length && !result.some(function (item) { return item.isDefault; })) {
      result[0].isDefault = true;
    }
    return result;
  }

  function loadAccountAddresses() {
    let parsed = [];
    try {
      const raw = window.localStorage.getItem(ACCOUNT_ADDRESS_STORAGE_KEY) || "";
      if (raw) parsed = JSON.parse(raw);
    } catch (error) {}
    return normalizeAccountAddresses(parsed);
  }

  function saveAccountAddresses(addresses) {
    const normalized = normalizeAccountAddresses(addresses || []);
    try {
      window.localStorage.setItem(ACCOUNT_ADDRESS_STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {}
    return normalized;
  }

  function defaultAccountAddress(state) {
    const addresses = state && Array.isArray(state.accountAddresses) ? state.accountAddresses : loadAccountAddresses();
    return addresses.find(function (item) { return item && item.isDefault; }) || addresses[0] || null;
  }

  function applyAccountAddressLocation(state, address, options) {
    const source = address && typeof address === "object" ? address : null;
    if (!state || !source || !isValidMapPoint(source.lat, source.lng)) return false;
    const settings = options && typeof options === "object" ? options : {};
    const lat = Number(source.lat);
    const lng = Number(source.lng);
    state.userPoint = [lat, lng];
    state.userPointSource = "address";
    state.savedUserLocation = {
      lat: lat,
      lng: lng,
      accuracy: 0,
      source: "address",
      label: String(source.label || "Saved address").trim(),
      updatedAt: Date.now()
    };
    try {
      window.localStorage.setItem("hashop_last_location", JSON.stringify(state.savedUserLocation));
    } catch (error) {}
    upsertUserMarker(state, lat, lng, 0, {
      source: "address",
      title: String(source.label || "Saved address").trim()
    });
    syncMapUiState(state);
    updateMapView(state);
    syncActionButton(state);
    if (state.mapLocateButton && settings.feedback !== false) {
      state.mapLocateButton.classList.add("is-active");
      state.mapLocateButton.setAttribute("aria-label", "Using saved address");
      state.mapLocateButton.setAttribute("title", "Using saved address");
      window.clearTimeout(state.locateRevealTimer);
      state.locateRevealTimer = window.setTimeout(function () {
        if (!state.mapLocateButton) return;
        state.mapLocateButton.classList.remove("is-active");
        state.mapLocateButton.setAttribute("aria-label", "Locate me");
        state.mapLocateButton.setAttribute("title", "Locate me");
      }, LOCATE_REVEAL_DELAY_MS);
    }
    return true;
  }

  function useDefaultAccountAddressLocation(state) {
    return applyAccountAddressLocation(state, defaultAccountAddress(state));
  }

  function buyerHasSignedIn(state) {
    return !!accountBuyerAccount(state && state.accountSession || loadAccountSession());
  }

  function buyerCheckoutAddress(state, profile) {
    const buyerProfile = profile && typeof profile === "object" ? profile : (state && state.buyerProfile || loadBuyerProfile());
    const explicitAddress = String(buyerProfile && buyerProfile.address || "").trim();
    if (explicitAddress) return explicitAddress;
    const address = defaultAccountAddress(state);
    if (!address) return "";
    return String(address.text || address.label || "").trim();
  }

  function buyerCheckoutProfile(state) {
    const profile = state && state.buyerProfile && typeof state.buyerProfile === "object"
      ? state.buyerProfile
      : loadBuyerProfile();
    const session = state && state.accountSession ? state.accountSession : loadAccountSession();
    const buyerAccount = accountBuyerAccount(session);
    const accountName = String(buyerAccount && buyerAccount.displayName || session && session.displayName || "").trim();
    const accountContact = String(buyerAccount && buyerAccount.contact || "").trim();
    return Object.assign({}, profile, {
      buyerKey: String(buyerAccount && buyerAccount.buyerKey || profile.buyerKey || ensureBuyerKey()).trim(),
      name: accountName || String(profile.name || "").trim(),
      contact: accountContact || String(profile.contact || "").trim(),
      address: buyerCheckoutAddress(state, profile)
    });
  }

  function missingBuyerCheckoutFields(state, fulfillmentMode) {
    const profile = buyerCheckoutProfile(state);
    const mode = normalizeFulfillmentMode(fulfillmentMode || "delivery");
    const missing = [];
    if (!String(profile.name || "").trim()) missing.push("name");
    if (!String(profile.contact || "").trim()) missing.push("contact");
    if (mode === "delivery" && !String(profile.address || "").trim()) missing.push("address");
    return missing;
  }

  function checkoutMissingMessage(missing) {
    const fields = Array.isArray(missing) ? missing : [];
    if (!fields.length) return "";
    if (fields.length === 1) return "Add " + fields[0] + ".";
    if (fields.length === 2) return "Add " + fields[0] + " and " + fields[1] + ".";
    return "Add name, contact, and address.";
  }

  function normalizeAccountPayment(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    let id = String(source.id || source.paymentId || "").trim().slice(0, 80);
    let label = String(source.label || source.name || "").trim().slice(0, 80);
    const detail = String(source.detail || source.value || source.upi || "").trim().slice(0, 160);
    if (!label && !detail) return null;
    if (!id) id = generateAccountLocalId("pay").slice(0, 80);
    if (!label) label = "Payment";
    return {
      id: id,
      label: label,
      detail: detail,
      isDefault: !!source.isDefault,
      updatedAt: Math.max(0, Number(source.updatedAt || Date.now()) || Date.now())
    };
  }

  function normalizeAccountPayments(value) {
    if (!Array.isArray(value)) return [];
    const seen = {};
    let defaultSeen = false;
    return value.reduce(function (items, item) {
      const normalized = normalizeAccountPayment(item);
      if (!normalized || seen[normalized.id]) return items;
      seen[normalized.id] = true;
      if (normalized.isDefault && !defaultSeen) {
        defaultSeen = true;
      } else {
        normalized.isDefault = false;
      }
      items.push(normalized);
      return items;
    }, []).sort(function (left, right) {
      return Number(right.updatedAt || 0) - Number(left.updatedAt || 0);
    }).slice(0, 12);
  }

  function loadAccountPayments() {
    let parsed = [];
    try {
      const raw = window.localStorage.getItem(ACCOUNT_PAYMENT_STORAGE_KEY) || "";
      if (raw) parsed = JSON.parse(raw);
    } catch (error) {}
    return normalizeAccountPayments(parsed);
  }

  function saveAccountPayments(payments) {
    const normalized = normalizeAccountPayments(payments || []);
    try {
      window.localStorage.setItem(ACCOUNT_PAYMENT_STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {}
    return normalized;
  }

  function defaultAccountPayment(state) {
    const payments = state && Array.isArray(state.accountPayments) ? state.accountPayments : loadAccountPayments();
    return payments.find(function (item) { return item && item.isDefault; }) || null;
  }

  function normalizeAccountContactKey(value) {
    const text = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!text) return "";
    if (text.indexOf("@") !== -1) {
      const emailValue = text.replace(/\s+/g, "").slice(0, 255);
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailValue) ? ("email:" + emailValue) : "";
    }
    let digits = text.replace(/\D+/g, "");
    if (digits.length === 11 && digits.indexOf("0") === 0) {
      digits = digits.slice(-10);
    } else if (digits.length === 12 && digits.indexOf("91") === 0) {
      digits = digits.slice(-10);
    }
    if (digits.length >= 10 && digits.length <= 15) {
      if (/^(\d)\1+$/.test(digits)) return "";
      if (digits === "0123456789" || digits === "1234567890" || digits === "9876543210") return "";
      return "phone:" + digits;
    }
    return "";
  }

  function accountContactErrorMessage(value) {
    if (!String(value || "").trim()) return "Enter phone or email.";
    return normalizeAccountContactKey(value) ? "" : "Use a real email or phone number.";
  }

  function loadSetupContactVerification() {
    let parsed = null;
    try {
      const raw = window.localStorage.getItem(SETUP_CONTACT_VERIFICATION_STORAGE_KEY) || "";
      if (raw) parsed = JSON.parse(raw);
    } catch (error) {}
    if (!parsed || typeof parsed !== "object") return null;
    const contact = String(parsed.contact || "").trim().slice(0, 255);
    const contactKey = String(parsed.contactKey || parsed.contact_key || "").trim() || normalizeAccountContactKey(contact);
    const verifiedAt = Math.max(0, Number(parsed.verifiedAt || parsed.verified_at || 0) || 0);
    if (!contactKey || !verifiedAt) return null;
    return {
      contact: contact,
      contactKey: contactKey,
      verifiedAt: verifiedAt
    };
  }

  function saveSetupContactVerification(contact, verifiedAt) {
    const safeContact = String(contact || "").trim().slice(0, 255);
    const contactKey = normalizeAccountContactKey(safeContact);
    const safeVerifiedAt = Math.max(0, Number(verifiedAt || Math.floor(Date.now() / 1000)) || Math.floor(Date.now() / 1000));
    if (!contactKey) return null;
    const record = {
      contact: safeContact,
      contactKey: contactKey,
      verifiedAt: safeVerifiedAt
    };
    try {
      window.localStorage.setItem(SETUP_CONTACT_VERIFICATION_STORAGE_KEY, JSON.stringify(record));
    } catch (error) {}
    return record;
  }

  function setupContactVerificationTimestamp(state, contact) {
    const contactKey = normalizeAccountContactKey(contact);
    if (!contactKey) return 0;
    const stored = loadSetupContactVerification();
    if (stored && stored.contactKey === contactKey) {
      return Math.max(0, Number(stored.verifiedAt || 0) || 0);
    }
    const account = accountBuyerAccount(state && state.accountSession || loadAccountSession());
    if (account && normalizeAccountContactKey(account.contact) === contactKey) {
      return Math.floor(Date.now() / 1000);
    }
    return 0;
  }

  function setupContactIsVerified(state, contact) {
    return setupContactVerificationTimestamp(state, contact) > 0;
  }

  function accountProfileSummary(state) {
    const profile = state && state.buyerProfile && typeof state.buyerProfile === "object"
      ? state.buyerProfile
      : loadBuyerProfile();
    const address = buyerCheckoutAddress(state, profile);
    return {
      name: String(profile && profile.name || "").trim(),
      contact: String(profile && profile.contact || "").trim(),
      address: String(address || "").trim(),
      avatarUrl: String(profile && profile.avatarUrl || "").trim()
    };
  }

  function hasLocalAccountProfile(state) {
    const summary = accountProfileSummary(state);
    return !!(summary.name || summary.contact || summary.address);
  }

  function normalizeAccountHelpRequest(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    let id = String(source.id || source.helpId || source.help_id || "").trim().slice(0, 80);
    const message = String(source.message || source.text || "").trim().slice(0, 1200);
    if (!message) return null;
    if (!id) id = generateAccountLocalId("help").slice(0, 80);
    return {
      id: id,
      message: message,
      name: String(source.name || "").trim().slice(0, 160),
      contact: String(source.contact || "").trim().slice(0, 255),
      buyerKey: String(source.buyerKey || source.buyer_key || "").trim().slice(0, 160),
      serverId: String(source.serverId || source.server_id || "").trim().slice(0, 80),
      createdAt: Math.max(0, Number(source.createdAt || source.created_at || Date.now()) || Date.now()),
      syncedAt: Math.max(0, Number(source.syncedAt || source.synced_at || 0) || 0)
    };
  }

  function loadAccountHelpRequests() {
    let parsed = [];
    try {
      const raw = window.localStorage.getItem(ACCOUNT_HELP_STORAGE_KEY) || "";
      if (raw) parsed = JSON.parse(raw);
    } catch (error) {}
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeAccountHelpRequest).filter(Boolean).sort(function (left, right) {
      return Number(right.createdAt || 0) - Number(left.createdAt || 0);
    }).slice(0, 30);
  }

  function saveAccountHelpRequests(requests) {
    const normalized = Array.isArray(requests)
      ? requests.map(normalizeAccountHelpRequest).filter(Boolean).sort(function (left, right) {
          return Number(right.createdAt || 0) - Number(left.createdAt || 0);
        }).slice(0, 30)
      : [];
    try {
      window.localStorage.setItem(ACCOUNT_HELP_STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {}
    return normalized;
  }

  function accountHelpPayload(state, request) {
    const summary = accountProfileSummary(state);
    const account = accountBuyerAccount(state && state.accountSession || loadAccountSession());
    return {
      help_id: String(request && request.id || "").trim(),
      message: String(request && request.message || "").trim(),
      name: String(summary.name || request && request.name || "").trim(),
      contact: String(summary.contact || request && request.contact || "").trim(),
      buyer_key: ensureBuyerKey(),
      buyer_account_id: String(account && account.accountId || "").trim(),
      buyer_account_token: String(account && account.accountToken || "").trim(),
      screen: String(state && state.debugPaneView || "").trim(),
      route: String(window.location && window.location.pathname || "").trim(),
      build: BUILD_VERSION
    };
  }

  function postAccountHelpRequest(state, request) {
    return fetch("/api/account/help", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify(accountHelpPayload(state, request))
    }).then(function (response) {
      return parseJson(response).then(function (payload) {
        return {
          ok: response.ok,
          payload: payload || {}
        };
      });
    });
  }

  function recentBuyerOrderCount(state) {
    if (!state) return 0;
    if (Array.isArray(state.buyerOrders) && state.buyerOrders.length) {
      return state.buyerOrders.length;
    }
    const refs = state.buyerProfile && Array.isArray(state.buyerProfile.recentOrderRefs)
      ? state.buyerProfile.recentOrderRefs
      : [];
    return refs.length;
  }

  function buyerHistorySummaryLabel(cartCount, orderCount) {
    const safeCartCount = Math.max(0, Number(cartCount || 0) || 0);
    const safeOrderCount = Math.max(0, Number(orderCount || 0) || 0);
    if (safeCartCount && safeOrderCount) {
      return safeCartCount + " cart" + (safeCartCount === 1 ? "" : "s") + " • " + safeOrderCount + " order" + (safeOrderCount === 1 ? "" : "s");
    }
    if (safeCartCount) {
      return safeCartCount + " saved cart" + (safeCartCount === 1 ? "" : "s");
    }
    if (safeOrderCount) {
      return safeOrderCount + " recent order" + (safeOrderCount === 1 ? "" : "s");
    }
    return "No history yet";
  }

  function buyerHistoryTitle(cartCount, orderCount, loading) {
    if (loading) return "Checking orders";
    const safeCartCount = Math.max(0, Number(cartCount || 0) || 0);
    const safeOrderCount = Math.max(0, Number(orderCount || 0) || 0);
    if (safeCartCount && safeOrderCount) {
      return safeCartCount + " open cart" + (safeCartCount === 1 ? "" : "s") + ", " + safeOrderCount + " recent order" + (safeOrderCount === 1 ? "" : "s");
    }
    if (safeCartCount) {
      return safeCartCount + " open cart" + (safeCartCount === 1 ? "" : "s");
    }
    if (safeOrderCount) {
      return safeOrderCount + " recent order" + (safeOrderCount === 1 ? "" : "s");
    }
    return "No recent orders";
  }

  function ownerOrdersNavShopId(state) {
    if (!state) return "";
    if (isOwnerViewingShop(state)) {
      return String(state.activeShopId || "").trim();
    }
    return String(preferredOwnerShopId(state.accountSession, state.ownerShopId) || "").trim();
  }

  function ownerPendingOrdersNavCount(state) {
    if (!state) return 0;
    const shopId = ownerOrdersNavShopId(state);
    if (!shopId) return 0;
    const consoleData = state.shopConsoles && state.shopConsoles[shopId];
    const orders = Array.isArray(consoleData && consoleData.orders) ? consoleData.orders : [];
    return pendingOwnerOrdersCount(orders);
  }

  function ownerOrdersNavActive(state) {
    return !!(
      state
      && isOwnerViewingShop(state)
      && state.ownerPanel
      && state.ownerPanel.tab === "history"
      && state.ownerPanel.section === "orders"
    );
  }

  function normalizeOwnerSettingsSection(value) {
    const section = String(value || "").trim().toLowerCase();
    return section === "payments" ? "payments" : "profile";
  }

  function normalizeOwnerHistorySection(value) {
    const section = String(value || "").trim().toLowerCase();
    if (section === "items") return section;
    if (section === "sales" || section === "accounting") return "sales";
    return "orders";
  }

  function shouldUseOwnerOrdersNav(state) {
    if (!state) return false;
    if (!isOwnerAccountMode(state) && !isOwnerViewingShop(state)) return false;
    const shopId = ownerOrdersNavShopId(state);
    if (!shopId) return false;
    if (isOwnerViewingShop(state)) return true;
    return !state.activeShopId && state.debugPaneView !== "login" && state.debugPaneView !== "recent-orders";
  }

  function orderedOwnerOrders(orders) {
    if (!Array.isArray(orders)) return [];
    function priority(order) {
      const status = normalizedOrderStatus(order);
      if (status === "created" || status === "payment_pending") return 0;
      if (status === "accepted" || status === "ready" || status === "paid") return 1;
      if (status === "completed" || status === "cancelled") return 2;
      return 1;
    }
    return orders.slice().sort(function (left, right) {
      const priorityDelta = priority(left) - priority(right);
      if (priorityDelta) return priorityDelta;
      const timestampDelta = Number(right && right.timestamp || 0) - Number(left && left.timestamp || 0);
      if (timestampDelta) return timestampDelta;
      return String(right && right.id || "").localeCompare(String(left && left.id || ""));
    });
  }

  function rememberBuyerOrder(state, order, shopId) {
    if (!state || !order) return null;
    const current = state.buyerProfile && typeof state.buyerProfile === "object"
      ? state.buyerProfile
      : loadBuyerProfile();
    const nextRefs = normalizeBuyerRecentRefs([{
      orderId: String(order.id || "").trim(),
      shopId: String(shopId || order.shopId || "").trim(),
      timestamp: Number(order.timestamp || Date.now())
    }].concat(current.recentOrderRefs || []));
    return setBuyerProfile(state, {
      buyerKey: ensureBuyerKey(),
      name: String(order.buyerName || current.name || "").trim(),
      nickname: String(current.nickname || "").trim(),
      contact: String(order.buyerContact || current.contact || "").trim(),
      address: String(order.address || current.address || "").trim(),
      avatarUrl: current.avatarUrl || "",
      recentOrderRefs: nextRefs
    });
  }

  function orderAmountValue(order) {
    if (!order || typeof order !== "object") return 0;
    const total = priceNumber(order.total);
    if (total > 0) return total;
    const price = priceNumber(order.price);
    const quantity = Math.max(0, Number(order.quantity || 0));
    if (price > 0 && quantity > 0) return price * quantity;
    const items = Array.isArray(order.items) ? order.items : [];
    return items.reduce(function (sum, item) {
      return sum + (priceNumber(item && item.price) * Math.max(0, Number(item && item.quantity || 0)));
    }, 0);
  }

  function ownerSalesStats(orders) {
    const list = Array.isArray(orders) ? orders : [];
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    return list.reduce(function (stats, order) {
      const status = normalizedOrderStatus(order);
      const timestamp = Number(order && order.timestamp || 0);
      const amount = orderAmountValue(order);
      stats.totalOrders += 1;
      if (status === "created" || status === "payment_pending") stats.pendingOrders += 1;
      if (status === "accepted") stats.acceptedOrders += 1;
      if (status === "ready") stats.readyOrders += 1;
      if (status === "cancelled") {
        stats.cancelledOrders += 1;
        stats.cancelledValue += amount;
      } else {
        stats.grossValue += amount;
      }
      if (status === "paid" || status === "completed") {
        stats.settledOrders += 1;
        stats.revenue += amount;
      } else if (status !== "cancelled") {
        stats.openValue += amount;
      }
      if (timestamp >= dayStart.getTime()) {
        stats.todayOrders += 1;
        if (status !== "cancelled") stats.todayValue += amount;
        if (status === "paid" || status === "completed") stats.todayRevenue += amount;
      }
      return stats;
    }, {
      totalOrders: 0,
      pendingOrders: 0,
      acceptedOrders: 0,
      readyOrders: 0,
      settledOrders: 0,
      todayOrders: 0,
      cancelledOrders: 0,
      revenue: 0,
      grossValue: 0,
      openValue: 0,
      cancelledValue: 0,
      todayValue: 0,
      todayRevenue: 0
    });
  }

  function ownerAccountingAmount(value, detail) {
    const amount = Number(value || 0);
    return formatTotalAmount(amount, detail && detail.pricing) || String(amount || 0);
  }

  function ownerPaymentLabel(order) {
    const explicit = String(order && (order.paymentLabel || order.payment_label) || "").trim();
    if (explicit) return explicit;
    const mode = orderPaymentMode(order);
    if (mode === "before_delivery") return "Prepaid";
    if (mode === "on_receive") return "On receive";
    return "Payment";
  }

  function ownerSalesBreakdown(orders) {
    const rows = {};
    (Array.isArray(orders) ? orders : []).forEach(function (order) {
      const status = normalizedOrderStatus(order);
      if (status === "cancelled") return;
      const label = ownerPaymentLabel(order);
      const key = label.toLowerCase();
      if (!rows[key]) {
        rows[key] = {
          label: label,
          orders: 0,
          amount: 0
        };
      }
      rows[key].orders += 1;
      rows[key].amount += orderAmountValue(order);
    });
    return Object.keys(rows).map(function (key) {
      return rows[key];
    }).sort(function (left, right) {
      return right.amount - left.amount || right.orders - left.orders || left.label.localeCompare(right.label);
    });
  }

  function ownerItemSalesRows(orders) {
    const rows = {};
    (Array.isArray(orders) ? orders : []).forEach(function (order) {
      const status = normalizedOrderStatus(order);
      if (status === "cancelled") return;
      const orderItems = Array.isArray(order && order.items) && order.items.length ? order.items : [{
        title: String(order && order.title || "Order").trim(),
        quantity: Math.max(0, Number(order && order.quantity || 0)),
        price: String(order && (order.price || order.total) || "").trim()
      }];
      orderItems.forEach(function (item) {
        const title = String(item && item.title || "Item").trim() || "Item";
        const key = title.toLowerCase();
        const quantity = Math.max(0, Number(item && item.quantity || 0));
        const amount = priceNumber(item && item.total) || (priceNumber(item && item.price) * quantity);
        if (!rows[key]) {
          rows[key] = {
            title: title,
            quantity: 0,
            amount: 0
          };
        }
        rows[key].quantity += quantity;
        rows[key].amount += amount;
      });
    });
    return Object.keys(rows).map(function (key) {
      return rows[key];
    }).sort(function (left, right) {
      return right.amount - left.amount || right.quantity - left.quantity || left.title.localeCompare(right.title);
    });
  }

  function ownerOrderDraft(state, shopId) {
    if (!state || !shopId) {
      return {
        buyerName: "",
        buyerContact: "",
        notes: "",
        paymentMode: "on_receive",
        items: {}
      };
    }
    if (!state.ownerOrderDraftByShop) {
      state.ownerOrderDraftByShop = {};
    }
    if (!state.ownerOrderDraftByShop[shopId]) {
      state.ownerOrderDraftByShop[shopId] = {
        buyerName: "",
        buyerContact: "",
        notes: "",
        paymentMode: "on_receive",
        items: {}
      };
    }
    return state.ownerOrderDraftByShop[shopId];
  }

  function setOwnerOrderDraftField(state, shopId, field, value) {
    if (!state || !shopId || !field) return;
    const draft = ownerOrderDraft(state, shopId);
    if (field === "paymentMode") {
      draft.paymentMode = String(value || "").trim().toLowerCase() === "before_delivery"
        ? "before_delivery"
        : "on_receive";
      return;
    }
    draft[field] = String(value || "");
  }

  function stepOwnerOrderDraftItem(state, shopId, itemId, delta) {
    if (!state || !shopId || !itemId || !delta) return;
    const draft = ownerOrderDraft(state, shopId);
    const nextCount = Math.max(0, Number(draft.items && draft.items[itemId] || 0) + Number(delta || 0));
    if (!draft.items) draft.items = {};
    if (nextCount > 0) {
      draft.items[itemId] = nextCount;
    } else {
      delete draft.items[itemId];
    }
  }

  function clearOwnerOrderDraft(state, shopId) {
    if (!state || !shopId || !state.ownerOrderDraftByShop) return;
    delete state.ownerOrderDraftByShop[shopId];
  }

  function ownerDraftItems(detail, draft) {
    if (!detail || !draft) return [];
    return cartItems(detail, draft.items || {});
  }

  function shouldRenderItemLibraryState(state) {
    if (!state) return false;
    if (isOwnerViewingShop(state) && state.ownerPanel.tab === "history" && state.ownerPanel.section === "items") {
      return true;
    }
    return !state.activeShopId && !state.debugPaneView && normalizeRootMode(state.rootMode) === "items";
  }

  function refreshItemLibrary(state, options) {
    if (!state) return Promise.resolve([]);
    const force = !!(options && options.force);
    const silent = !!(options && options.silent);
    if (state.itemLibraryLoading && !force) {
      return Promise.resolve(Array.isArray(state.itemLibrary) ? state.itemLibrary : []);
    }
    if (!force && state.itemLibraryLoaded && Array.isArray(state.itemLibrary)) {
      return Promise.resolve(state.itemLibrary);
    }
    state.itemLibraryRequested = true;
    if (!silent) {
      state.itemLibraryLoading = true;
      state.itemLibraryError = "";
      if (shouldRenderItemLibraryState(state)) {
        renderShopList(state);
      }
    }
    return fetchItemLibrary(240).then(function (result) {
      if (!result || !result.ok) {
        throw new Error(String(result && result.payload && result.payload.error || "item_library_failed"));
      }
      state.itemLibrary = Array.isArray(result.payload && result.payload.items) ? result.payload.items : [];
      state.itemLibraryLoading = false;
      state.itemLibraryLoaded = true;
      state.itemLibraryError = "";
      if (shouldRenderItemLibraryState(state)) {
        renderShopList(state);
      }
      return state.itemLibrary;
    }).catch(function () {
      state.itemLibraryLoading = false;
      state.itemLibraryLoaded = false;
      if (!silent) {
        state.itemLibraryError = "Could not load items.";
        if (shouldRenderItemLibraryState(state)) {
          renderShopList(state);
        }
      }
      return Array.isArray(state.itemLibrary) ? state.itemLibrary : [];
    });
  }

  function createClientNonce() {
    return "cli-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function accountSessionAction(state) {
    const session = state && state.accountSession ? state.accountSession : loadAccountSession();
    const ownerShops = accountOwnerShops(session);
    const ownerCount = ownerShops.length;
    const buyerAccount = accountBuyerAccount(session);
    if (!session || (!ownerCount && !buyerAccount)) {
      return {
        kind: "account",
        label: "Account",
        description: "Sign in",
        detail: "Add shops later",
        tone: HASHOP_ACCOUNT_ACTION_COLOR,
        shopId: ""
      };
    }
    return {
      kind: "account",
      label: "Account",
      description: session.displayName || (buyerAccount && (buyerAccount.displayName || buyerAccount.contact)) || "My account",
      detail: ownerCount ? (ownerCount === 1 ? "1 shop" : (ownerCount + " shops")) : "Buyer account",
      tone: "#7bd389",
      shopId: ""
    };
  }

  function hasSavedOwnerSession(state) {
    return !!preferredOwnerShopId(state && state.accountSession, state && state.ownerShopId);
  }

  function setPreferredOwnerShop(state, shopId) {
    const safeShopId = slugify(String(shopId || "").trim()).slice(0, 64);
    if (!state) return safeShopId;
    state.ownerShopId = safeShopId;
    if (state.accountSession && safeShopId) {
      state.accountSession = saveAccountSession(Object.assign({}, state.accountSession, {
        preferredOwnerShopId: safeShopId
      }));
    }
    return safeShopId;
  }

  function setAccountActiveRole(state, role) {
    if (!state) return "";
    const session = state.accountSession || loadAccountSession();
    if (!session) return "";
    const ownerShops = accountOwnerShops(session);
    const roles = session && Array.isArray(session.roles) ? session.roles : [];
    const activeRole = normalizeAccountActiveRole(role, roles, ownerShops);
    state.accountSession = saveAccountSession(Object.assign({}, session, {
      activeRole: activeRole
    }));
    return activeRole;
  }

  function openRootAccountAction(state) {
    if (!state) return;
    openAccountPane(state);
  }

  function shopExists(shopId) {
    return window.fetch("/api/shops/" + encodeURIComponent(shopId), {
      cache: "no-store"
    }).then(function (response) {
      return response.ok;
    }).catch(function () {
      return false;
    });
  }

  function attemptLogin(shopId, password) {
    return window.fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        shop_id: shopId,
        password: password
      })
    }).then(function (response) {
      return parseJson(response).then(function (payload) {
        return {
          ok: response.ok,
          status: response.status,
          payload: payload
        };
      });
    });
  }

  function resetShopPassword(shopId, resetCode, password) {
    return window.fetch("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        shop_id: shopId,
        reset_code: resetCode,
        password: password
      })
    }).then(function (response) {
      return parseJson(response).then(function (payload) {
        return {
          ok: response.ok,
          status: response.status,
          payload: payload
        };
      });
    });
  }

  function requestShopPasswordReset(shopId, contact) {
    return window.fetch("/api/auth/request-password-reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        shop_id: shopId,
        contact: contact
      })
    }).then(function (response) {
      return parseJson(response).then(function (payload) {
        return {
          ok: response.ok,
          status: response.status,
          payload: payload
        };
      });
    });
  }

  function createShopAccount(shopId, displayName, password, options) {
    const settings = options && typeof options === "object" ? options : {};
    return window.fetch("/api/shops", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        shop_id: shopId,
        display_name: displayName,
        password: password,
        owner_contact: String(settings.contact || "").trim(),
        verification_code: String(settings.verificationCode || "").trim(),
        location: String(settings.address || "").trim()
      })
    }).then(function (response) {
      return parseJson(response).then(function (payload) {
        return {
          ok: response.ok,
          status: response.status,
          payload: payload
        };
      });
    });
  }

  function submitBuyerAccountRequest(mode, payload) {
    const endpoint = mode === "login" ? "/api/buyer/login" : "/api/buyer/signup";
    return window.fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload || {})
    }).then(function (response) {
      return parseJson(response).then(function (body) {
        return {
          ok: response.ok,
          status: response.status,
          payload: body
        };
      });
    });
  }

  function refreshBuyerAccountSessionRequest(account) {
    const buyerAccount = normalizeBuyerAccount(account);
    if (!buyerAccount) {
      return Promise.resolve({ ok: false, status: 0, payload: { error: "missing_buyer_account" } });
    }
    return window.fetch("/api/buyer/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({
        account_id: buyerAccount.accountId,
        account_token: buyerAccount.accountToken,
        buyer_key: buyerAccount.buyerKey || ensureBuyerKey()
      })
    }).then(function (response) {
      return parseJson(response).then(function (body) {
        return {
          ok: response.ok,
          status: response.status,
          payload: body
        };
      });
    });
  }

  function requestBuyerPasswordReset(contact) {
    return window.fetch("/api/buyer/request-password-reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contact: contact
      })
    }).then(function (response) {
      return parseJson(response).then(function (body) {
        return {
          ok: response.ok,
          status: response.status,
          payload: body
        };
      });
    });
  }

  function requestBuyerContactVerification(contact, purpose) {
    return window.fetch("/api/buyer/request-contact-verification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contact: contact,
        purpose: String(purpose || "").trim()
      })
    }).then(function (response) {
      return parseJson(response).then(function (body) {
        return {
          ok: response.ok,
          status: response.status,
          payload: body
        };
      });
    });
  }

  function verifyBuyerContact(contact, verificationCode) {
    return window.fetch("/api/buyer/verify-contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contact: contact,
        verification_code: verificationCode
      })
    }).then(function (response) {
      return parseJson(response).then(function (body) {
        return {
          ok: response.ok,
          status: response.status,
          payload: body
        };
      });
    });
  }

  function resetBuyerPassword(contact, resetCode, password, buyerKey) {
    return window.fetch("/api/buyer/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contact: contact,
        reset_code: resetCode,
        password: password,
        buyer_key: String(buyerKey || "").trim() || ensureBuyerKey()
      })
    }).then(function (response) {
      return parseJson(response).then(function (body) {
        return {
          ok: response.ok,
          status: response.status,
          payload: body
        };
      });
    });
  }

  function createShopOrder(shopId, payload) {
    return window.fetch("/api/shops/" + encodeURIComponent(shopId) + "/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload || {})
    }).then(function (response) {
      return parseJson(response).then(function (body) {
        return {
          ok: response.ok,
          status: response.status,
          payload: body
        };
      });
    });
  }

  function cancelBuyerOrder(shopId, orderId, buyerKey) {
    const session = loadAccountSession();
    const buyerAccount = accountBuyerAccount(session);
    const body = {
      buyer_key: String(buyerKey || "").trim()
    };
    if (buyerAccount) {
      body.buyer_account_id = buyerAccount.accountId;
      body.buyer_account_token = buyerAccount.accountToken;
    }
    return window.fetch("/api/shops/" + encodeURIComponent(shopId) + "/orders/" + encodeURIComponent(orderId) + "/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }).then(function (response) {
      return parseJson(response).then(function (payload) {
        return {
          ok: response.ok,
          status: response.status,
          payload: payload
        };
      });
    });
  }

  function fetchBuyerOrders(buyerKey, limit, buyerAccount) {
    const params = new URLSearchParams();
    const safeBuyerKey = String(buyerKey || "").trim();
    const account = normalizeBuyerAccount(buyerAccount || accountBuyerAccount(loadAccountSession()));
    if (safeBuyerKey) {
      params.set("buyer_key", safeBuyerKey);
    }
    if (account) {
      params.set("buyer_account_id", account.accountId);
      params.set("buyer_account_token", account.accountToken);
    }
    if (limit != null) {
      params.set("limit", String(limit));
    }
    return window.fetch("/api/orders?" + params.toString(), {
      cache: "no-store"
    }).then(function (response) {
      return parseJson(response).then(function (payload) {
        return {
          ok: response.ok,
          status: response.status,
          payload: payload
        };
      });
    });
  }

  function fetchItemLibrary(limit) {
    const params = new URLSearchParams();
    if (limit != null) {
      params.set("limit", String(limit));
    }
    return window.fetch("/api/items/library" + (params.toString() ? ("?" + params.toString()) : ""), {
      cache: "no-store"
    }).then(function (response) {
      return parseJson(response).then(function (payload) {
        return {
          ok: response.ok,
          status: response.status,
          payload: payload
        };
      });
    });
  }

  function uploadShopLogo(shopId, file) {
    const formData = new FormData();
    formData.append("file", file);
    return window.fetch("/api/shops/" + encodeURIComponent(shopId) + "/logo", {
      method: "POST",
      body: formData
    }).then(function (response) {
      return parseJson(response).then(function (payload) {
        return {
          ok: response.ok,
          status: response.status,
          payload: payload
        };
      });
    });
  }

  function uploadOwnerItemImage(shopId, itemId, file) {
    const formData = new FormData();
    formData.append("file", file);
    return window.fetch("/api/shops/" + encodeURIComponent(shopId) + "/items/" + encodeURIComponent(itemId) + "/image", {
      method: "POST",
      body: formData
    }).then(function (response) {
      return parseJson(response).then(function (payload) {
        return {
          ok: response.ok,
          status: response.status,
          payload: payload
        };
      });
    });
  }

  function uploadOwnerPaymentQr(shopId, file) {
    const formData = new FormData();
    formData.append("file", file);
    return window.fetch("/api/shops/" + encodeURIComponent(shopId) + "/payment-qr", {
      method: "POST",
      body: formData
    }).then(function (response) {
      return parseJson(response).then(function (payload) {
        return {
          ok: response.ok,
          status: response.status,
          payload: payload
        };
      });
    });
  }

  function hashopImageDataUrl(file, maxSize) {
    return new Promise(function (resolve, reject) {
      if (!file || !String(file.type || "").match(/^image\//)) {
        reject(new Error("image_required"));
        return;
      }
      if (Number(file.size || 0) > 5 * 1024 * 1024) {
        reject(new Error("image_too_large"));
        return;
      }
      const sizeLimit = Math.max(128, Math.min(768, Number(maxSize || 512) || 512));
      const objectUrl = window.URL && window.URL.createObjectURL ? window.URL.createObjectURL(file) : "";
      const image = new Image();
      image.onload = function () {
        const width = Math.max(1, Number(image.naturalWidth || image.width || 1));
        const height = Math.max(1, Number(image.naturalHeight || image.height || 1));
        const canvasSize = Math.min(sizeLimit, Math.max(128, Math.min(width, height)));
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        if (!context) {
          if (objectUrl) window.URL.revokeObjectURL(objectUrl);
          reject(new Error("canvas_unavailable"));
          return;
        }
        const scale = Math.max(canvasSize / width, canvasSize / height);
        const drawWidth = width * scale;
        const drawHeight = height * scale;
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvasSize, canvasSize);
        context.drawImage(image, (canvasSize - drawWidth) / 2, (canvasSize - drawHeight) / 2, drawWidth, drawHeight);
        if (objectUrl) window.URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      image.onerror = function () {
        if (objectUrl) window.URL.revokeObjectURL(objectUrl);
        reject(new Error("image_load_failed"));
      };
      if (objectUrl) {
        image.src = objectUrl;
        return;
      }
      const reader = new FileReader();
      reader.onload = function () {
        image.src = String(reader.result || "");
      };
      reader.onerror = function () {
        reject(new Error("image_read_failed"));
      };
      reader.readAsDataURL(file);
    });
  }

  function shopLogoUrl(shopId) {
    const safeShopId = String(shopId || "").trim();
    if (!safeShopId) return "";
    return "/api/shops/" + encodeURIComponent(safeShopId) + "/logo";
  }

  function assetFileUrl(fileName) {
    const safeName = String(fileName || "").trim();
    if (!safeName) return "";
    return "/api/assets/" + encodeURIComponent(safeName);
  }

  function paymentQrFile(payment) {
    if (!payment || typeof payment !== "object") return "";
    return String(payment.qrFile || payment.paymentQrFile || payment.qr || "").trim();
  }

  function paymentQrFileFromPayments(payments) {
    if (!Array.isArray(payments)) return "";
    for (const payment of payments) {
      const qrFile = paymentQrFile(payment);
      if (qrFile) return qrFile;
    }
    return "";
  }

  function paymentQrImageMarkup(qrFile, label, className) {
    const safeQrFile = String(qrFile || "").trim();
    if (!safeQrFile) return "";
    const safeClassName = String(className || "").trim();
    return '' +
      '<span class="shop-payment-qr-image' + (safeClassName ? (' ' + escapeHtml(safeClassName)) : '') + '">' +
        '<img src="' + escapeHtml(assetFileUrl(safeQrFile)) + '" alt="' + escapeHtml((label || "Payment") + " QR code") + '">' +
      '</span>';
  }

  function ownerPaymentQrFieldMarkup(qrFile) {
    const safeQrFile = String(qrFile || "").trim();
    return '' +
      '<div class="shop-owner-field shop-owner-field-wide shop-owner-payment-qr-field">' +
        '<span>Payment QR</span>' +
        '<div class="shop-owner-payment-qr-row">' +
          (safeQrFile
            ? paymentQrImageMarkup(safeQrFile, "Payment", "is-owner-preview")
            : '<span class="shop-payment-qr-image is-empty" aria-hidden="true"></span>') +
          '<div class="shop-owner-logo-copy shop-owner-payment-qr-copy">' +
            '<strong>' + escapeHtml(safeQrFile ? "QR uploaded" : "No QR yet") + '</strong>' +
            '<span>Shown to buyers when they choose Pay before.</span>' +
          '</div>' +
          '<label class="shop-owner-upload-button">' +
            '<input class="shop-owner-file-input" type="file" accept="image/*" data-owner-payment-qr-input="true">' +
            '<span>' + escapeHtml(safeQrFile ? "Replace QR" : "Upload QR") + '</span>' +
          '</label>' +
        '</div>' +
      '</div>';
  }

  function mergeShopRecord(state, record, fallbackName) {
    if (!state || !record || typeof record !== "object") return null;
    const shopId = String(record.shop_id || "").trim();
    if (!shopId) return null;
    const existing = state.shopById[shopId] || {};
    const merged = Object.assign({}, existing, record);
    merged.shop_id = shopId;
    merged.display_name = String(merged.display_name || fallbackName || shopId).trim() || shopId;
    merged.public_url = shopUrl({
      shop_id: shopId,
      public_url: String(merged.public_url || existing.public_url || "").trim()
    });
    merged.map_color = String(merged.map_color || existing.map_color || HASHOP_DEFAULT_SHOP_COLOR).trim();
    merged.lat = Number.isFinite(Number(merged.lat)) ? Number(merged.lat) : null;
    merged.lng = Number.isFinite(Number(merged.lng)) ? Number(merged.lng) : null;
    merged.has_location = !!(merged.has_location || (merged.lat != null && merged.lng != null));
    merged.location_label = String(
      merged.location_label
      || existing.location_label
      || (merged.has_location ? "On map" : "Location pending")
    ).trim();
    state.shopById[shopId] = merged;

    const index = state.shops.findIndex(function (shop) {
      return String(shop && shop.shop_id || "").trim() === shopId;
    });
    if (index >= 0) {
      state.shops[index] = merged;
    } else {
      state.shops.unshift(merged);
    }
    return merged;
  }

  function getShopCart(state, shopId) {
    if (!state || !shopId) return {};
    if (!state.cartByShop[shopId]) {
      state.cartByShop[shopId] = {};
    }
    return state.cartByShop[shopId];
  }

  function selectedPaymentIndex(state, shopId, paymentEntries) {
    if (!state || !shopId || !Array.isArray(paymentEntries) || !paymentEntries.length) return -1;
    const value = Number(state.selectedPaymentByShop && state.selectedPaymentByShop[shopId]);
    if (!Number.isInteger(value) || value < 0 || value >= paymentEntries.length) return -1;
    return value;
  }

  function setSelectedPaymentIndex(state, shopId, index) {
    if (!state || !shopId) return;
    if (!state.selectedPaymentByShop) {
      state.selectedPaymentByShop = {};
    }
    if (!Number.isInteger(index) || index < 0) {
      delete state.selectedPaymentByShop[shopId];
      return;
    }
    state.selectedPaymentByShop[shopId] = index;
    setCheckoutNotice(state, shopId, null);
  }

  function isPaymentPickerOpen(state, shopId) {
    return !!(state && shopId && state.paymentPickerOpenByShop && state.paymentPickerOpenByShop[shopId]);
  }

  function setPaymentPickerOpen(state, shopId, open) {
    if (!state || !shopId) return;
    if (!state.paymentPickerOpenByShop) {
      state.paymentPickerOpenByShop = {};
    }
    if (open) {
      state.paymentPickerOpenByShop[shopId] = true;
      return;
    }
    delete state.paymentPickerOpenByShop[shopId];
  }

  function selectedPaymentMode(state, shopId) {
    if (!state || !shopId) return "on_receive";
    const raw = String(state.paymentModeByShop && state.paymentModeByShop[shopId] || "").trim().toLowerCase();
    return raw === "before_delivery" ? "before_delivery" : "on_receive";
  }

  function setSelectedPaymentMode(state, shopId, mode) {
    if (!state || !shopId) return;
    if (!state.paymentModeByShop) {
      state.paymentModeByShop = {};
    }
    const nextMode = String(mode || "").trim().toLowerCase() === "before_delivery"
      ? "before_delivery"
      : "on_receive";
    state.paymentModeByShop[shopId] = nextMode;
    setPaymentPickerOpen(state, shopId, false);
    if (state.selectedPaymentByShop) {
      delete state.selectedPaymentByShop[shopId];
    }
    setCheckoutNotice(state, shopId, null);
  }

  function checkoutNotice(state, shopId) {
    if (!state || !shopId) return null;
    return state.checkoutNoticeByShop && state.checkoutNoticeByShop[shopId] || null;
  }

  function setCheckoutNotice(state, shopId, notice) {
    if (!state || !shopId) return;
    if (!state.checkoutNoticeByShop) {
      state.checkoutNoticeByShop = {};
    }
    if (!notice) {
      delete state.checkoutNoticeByShop[shopId];
      return;
    }
    state.checkoutNoticeByShop[shopId] = notice;
  }

  function orderConfirmation(state, shopId) {
    if (!state || !shopId) return null;
    return state.orderConfirmationByShop && state.orderConfirmationByShop[shopId] || null;
  }

  function setOrderConfirmation(state, shopId, confirmation) {
    if (!state || !shopId) return;
    if (!state.orderConfirmationByShop) {
      state.orderConfirmationByShop = {};
    }
    if (!confirmation) {
      delete state.orderConfirmationByShop[shopId];
      return;
    }
    state.orderConfirmationByShop[shopId] = confirmation;
  }

  function shouldPollBuyerOrders(state) {
    return !!(
      state
      && ensureBuyerKey()
      && (
        state.debugPaneView === "recent-orders"
        || (state.activeShopId && state.activeShopView === "confirmation")
      )
    );
  }

  function clearBuyerOrdersPoll(state) {
    if (!state || !state.buyerOrdersPollTimer) return;
    window.clearTimeout(state.buyerOrdersPollTimer);
    state.buyerOrdersPollTimer = 0;
  }

  function syncActiveConfirmationFromBuyerOrders(state) {
    if (!state || !state.activeShopId) return;
    const confirmation = orderConfirmation(state, state.activeShopId);
    if (!confirmation || !confirmation.order) return;
    const orderId = String(confirmation.order.id || "").trim();
    if (!orderId) return;
    const orders = Array.isArray(state.buyerOrders) ? state.buyerOrders : [];
    const matched = orders.find(function (order) {
      return String(order && order.id || "").trim() === orderId
        && String(order && order.shopId || "").trim() === String(state.activeShopId || "").trim();
    }) || orders.find(function (order) {
      return String(order && order.id || "").trim() === orderId;
    }) || null;
    if (!matched) return;
    setOrderConfirmation(state, state.activeShopId, Object.assign({}, confirmation, {
      order: matched,
      paymentMode: orderPaymentMode(matched),
      paymentLabel: String(matched.paymentLabel || confirmation.paymentLabel || "").trim(),
      paymentQrFile: String(matched.paymentQrFile || matched.payment_qr_file || confirmation.paymentQrFile || "").trim()
    }));
  }

  function syncBuyerOrdersPolling(state, delay) {
    clearBuyerOrdersPoll(state);
    if (!shouldPollBuyerOrders(state)) return;
    state.buyerOrdersPollTimer = window.setTimeout(function () {
      refreshBuyerOrders(state, {
        force: true,
        silent: true
      }).finally(function () {
        syncBuyerOrdersPolling(state, 5000);
      });
    }, Math.max(1200, Number(delay || 5000)));
  }

  function cartCount(state, shopId) {
    return COMMERCE_CORE.cartCount(getShopCart(state, shopId));
  }

  function cartItems(detail, cart) {
    return COMMERCE_CORE.cartItems(detail, cart);
  }

  function orderPaymentMode(order) {
    return COMMERCE_CORE.orderPaymentMode(order);
  }

  function stableOrderStatus(value) {
    return COMMERCE_CORE.stableOrderStatus(value);
  }

  function normalizedOrderStatus(order) {
    return COMMERCE_CORE.normalizedOrderStatus(order);
  }

  function orderStatusFlags(order, status) {
    return COMMERCE_CORE.orderStatusFlags(order, status);
  }

  function orderPaymentModeLabel(order) {
    return orderPaymentMode(order) === "before_delivery" ? "Pay before" : "Pay on receive";
  }

  function normalizeFulfillmentMode(value) {
    const mode = String(value || "").trim().toLowerCase();
    return mode === "pickup" ? "pickup" : "delivery";
  }

  function selectedFulfillmentMode(state, shopId) {
    if (!state || !shopId) return "delivery";
    return normalizeFulfillmentMode(state.fulfillmentModeByShop && state.fulfillmentModeByShop[shopId]);
  }

  function setSelectedFulfillmentMode(state, shopId, mode) {
    if (!state || !shopId) return;
    if (!state.fulfillmentModeByShop) {
      state.fulfillmentModeByShop = {};
    }
    state.fulfillmentModeByShop[shopId] = normalizeFulfillmentMode(mode);
    setCheckoutNotice(state, shopId, null);
  }

  function orderIsWalkIn(order) {
    const address = String(order && (order.address || order.pickupAddress || order.pickup_address) || "").trim().toLowerCase();
    const buyerKey = String(order && (order.buyerKey || order.buyer_key) || "").trim().toLowerCase();
    const paymentLabel = String(order && (order.paymentLabel || order.payment_label) || "").trim().toLowerCase();
    return address === "walk-in" || address === "walk in" || buyerKey.indexOf("walkin-") === 0 || paymentLabel === "walk-in" || paymentLabel === "walkin";
  }

  function orderFulfillmentMode(order) {
    const explicitMode = String(order && (order.fulfillmentMode || order.fulfillment_mode || order.deliveryMode || order.delivery_mode) || "").trim().toLowerCase();
    if (explicitMode === "pickup" || explicitMode === "delivery") return explicitMode;
    return orderIsWalkIn(order) ? "pickup" : "delivery";
  }

  function orderFulfillmentLabel(order) {
    return orderFulfillmentMode(order) === "pickup" ? "Pickup" : "Delivery";
  }

  function shopPickupLabel(detail) {
    const location = String(detail && (detail.location || detail.address) || "").trim();
    if (location) return location;
    const gps = parseGpsValue(detail && detail.gps);
    if (gps) return formatAccountCoordinates(gps[0], gps[1]);
    return "Shop pickup point";
  }

  function orderFulfillmentLine(order) {
    const mode = orderFulfillmentMode(order);
    if (mode === "pickup") {
      return "Pickup: " + (String(order && (order.pickupAddress || order.pickup_address || order.address) || "").trim() || "Shop pickup point");
    }
    return "Deliver to: " + (String(order && (order.deliveryAddress || order.delivery_address || order.address) || "").trim() || "Delivery address");
  }

  function orderStatusText(order) {
    const status = normalizedOrderStatus(order);
    if (status === "created") return "Pending";
    if (status === "payment_pending") return "Waiting for payment";
    if (status === "accepted") return "Accepted";
    if (status === "ready") return "Ready";
    if (status === "paid") return "Paid";
    if (status === "completed") return "Completed";
    if (status === "cancelled") return "Cancelled";
    return "New";
  }

  function buyerOrderStatusText(order) {
    const status = normalizedOrderStatus(order);
    if (status === "created") return "Waiting for shop";
    if (status === "payment_pending") return "Waiting for payment";
    if (status === "accepted") return "Confirmed by shop";
    if (status === "ready") return "Ready";
    if (status === "paid") return "Paid";
    if (status === "completed") return "Completed";
    if (status === "cancelled") return "Cancelled";
    return "Waiting";
  }

  function buyerConfirmationTitle(order) {
    const status = normalizedOrderStatus(order);
    if (status === "accepted") return "Shop confirmed your order.";
    if (status === "ready") return "Order is ready.";
    if (status === "paid") return "Payment confirmed.";
    if (status === "completed") return "Order completed.";
    if (status === "cancelled") return "Order cancelled.";
    if (status === "payment_pending") return "Waiting for payment confirmation.";
    return "Waiting for shop confirmation.";
  }

  function buyerConfirmationMessage(order) {
    const status = normalizedOrderStatus(order);
    if (status === "accepted") return "The shop accepted your order. This screen keeps updating as they move it forward.";
    if (status === "ready") return "The shop marked your order ready. Open Recent history anytime to check later.";
    if (status === "paid") return "The shop confirmed payment. The next status update will appear here automatically.";
    if (status === "completed") return "This order is finished. You can still reopen it from Recent history.";
    if (status === "cancelled") return "The shop cancelled this order.";
    if (status === "payment_pending") return "Your order is saved. Once payment is confirmed, this screen will update automatically.";
    return "Your order is saved. This screen waits for the shop confirmation callback and updates automatically.";
  }

  function formatOrderTimestamp(value) {
    const timestamp = Number(value || 0);
    if (!isFinite(timestamp) || timestamp <= 0) return "Just now";
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(timestamp));
    } catch (error) {
      return new Date(timestamp).toLocaleString();
    }
  }

  function buyerOrderSummary(order) {
    const items = Array.isArray(order && order.items) ? order.items : [];
    const itemSummary = items.map(function (item) {
      const title = String(item && item.title || "").trim();
      const quantity = Math.max(0, Number(item && item.quantity || 0));
      if (!title) return "";
      return title + (quantity > 0 ? (" x" + quantity) : "");
    }).filter(Boolean);
    if (itemSummary.length) {
      return itemSummary.slice(0, 3).join(", ");
    }
    const notes = String(order && order.notes || "").trim();
    if (notes) return notes;
    const address = String(order && order.address || "").trim();
    if (address) return address;
    return "Order created from this device.";
  }

  function pendingOwnerOrdersCount(orders) {
    if (!Array.isArray(orders)) return 0;
    return orders.reduce(function (sum, order) {
      const status = normalizedOrderStatus(order);
      return sum + (status === "created" || status === "payment_pending" ? 1 : 0);
    }, 0);
  }

  function canBuyerCancelOrder(order) {
    const status = normalizedOrderStatus(order);
    return status === "created" || status === "payment_pending" || status === "accepted";
  }

  function shouldShowRecentOrderShopAction(order) {
    const status = normalizedOrderStatus(order);
    return status !== "cancelled" && status !== "completed";
  }

  function recentOrderShopLine(order) {
    const shopName = String(order && order.shopName || "").trim();
    const shopId = String(order && order.shopId || "").trim();
    let shownShop = shopName || shopId || "Shop";
    const timestamp = formatOrderTimestamp(order && order.timestamp);
    if (shopId && shopName && shopId.toLowerCase() !== shopName.toLowerCase()) {
      shownShop += " @" + shopId;
    }
    return shownShop + " · " + timestamp;
  }

  function recentOrderPaymentLine(order) {
    const parts = [
      orderFulfillmentLabel(order),
      orderPaymentModeLabel(order),
      String(order && order.paymentLabel || "Order").trim(),
      String(order && (order.total || order.price) || "").trim()
    ].filter(Boolean);
    return parts.join(" · ");
  }

  function ownerOrderBuyerLine(order) {
    const name = String(order && order.buyerName || "").trim();
    const contact = String(order && order.buyerContact || "").trim();
    if (name && contact && name !== contact) return name + " · " + contact;
    if (name) return name;
    if (contact) return contact;
    if (orderIsWalkIn(order)) return "Walk-in";
    return "Buyer";
  }

  function ownerOrderPaymentLine(order) {
    const status = normalizedOrderStatus(order);
    const paid = !!(order && (order.paymentPaid || order.paymentReceived)) || status === "paid" || status === "completed";
    const mode = orderPaymentMode(order);
    const label = String(order && order.paymentLabel || "").trim();
    if (paid) return "Paid" + (label ? (" · " + label) : "");
    if (mode === "before_delivery") return "Payment due" + (label ? (" · " + label) : "");
    return "Pay on receive";
  }

  function ownerOrderAddressLine(order) {
    return orderFulfillmentLine(order);
  }

  function ownerOrderShortId(order) {
    const id = String(order && order.id || "").trim();
    if (!id) return "Order";
    return "#" + id.replace(/^ord-/, "").slice(-6).toUpperCase();
  }

  function ownerOrderCardMarkup(order, detail, options) {
    const settings = options && typeof options === "object" ? options : {};
    const nextAction = nextOwnerOrderAction(order);
    const status = normalizedOrderStatus(order);
    const statusText = orderStatusText(order);
    const total = String(order && (order.total || order.price) || "").trim();
    const when = formatOrderTimestamp(order && order.timestamp);
    const paymentLine = ownerOrderPaymentLine(order);
    const fulfillmentLine = ownerOrderAddressLine(order);
    const deliveryCueReady = !!settings.includeMapCue
      && orderFulfillmentMode(order) === "delivery"
      && isValidMapPoint(Number(order && (order.deliveryLat || order.delivery_lat)), Number(order && (order.deliveryLng || order.delivery_lng)));
    return '' +
      '<article class="shop-owner-order-card is-status-' + escapeHtml(status || "created") + '">' +
        '<div class="shop-owner-order-head shop-owner-order-headline">' +
          '<div class="shop-owner-order-title">' +
            '<span>' + escapeHtml(ownerOrderShortId(order) + (when ? (" · " + when) : "")) + '</span>' +
            '<strong>' + escapeHtml(ownerOrderBuyerLine(order)) + '</strong>' +
          '</div>' +
          '<span class="shop-owner-order-status">' + escapeHtml(statusText) + '</span>' +
        '</div>' +
        orderItemsMarkup(order, detail || null, { compact: true, limit: Math.max(1, Number(settings.limit || 3) || 3) }) +
        '<div class="shop-owner-order-facts">' +
          '<div class="shop-owner-order-fact">' +
            '<span>Payment</span>' +
            '<strong>' + escapeHtml(paymentLine) + '</strong>' +
          '</div>' +
          '<div class="shop-owner-order-fact">' +
            '<span>Total</span>' +
            '<strong>' + escapeHtml(total || "0") + '</strong>' +
          '</div>' +
          '<div class="shop-owner-order-fact is-wide">' +
            '<span>' + escapeHtml(orderFulfillmentLabel(order)) + '</span>' +
            '<strong>' + escapeHtml(fulfillmentLine) + '</strong>' +
          '</div>' +
        '</div>' +
        (nextAction ? (
          '<div class="shop-owner-order-actions">' +
            (deliveryCueReady ? '<button class="shop-owner-chip-button" type="button" data-owner-order-map-cue="' + escapeHtml(order && order.id || "") + '">Map cue</button>' : '') +
            '<button class="shop-owner-save" type="button" data-owner-order-action="' + escapeHtml(order && order.id || "") + '" data-next-status="' + escapeHtml(nextAction.nextStatus) + '">' + escapeHtml(nextAction.label) + '</button>' +
            (canOwnerCancelOrder(order) ? '<button class="shop-owner-chip-button is-danger" type="button" data-owner-order-action="' + escapeHtml(order && order.id || "") + '" data-next-status="cancelled">Cancel</button>' : '') +
          '</div>'
        ) : '') +
      '</article>';
  }

  function canOwnerCancelOrder(order) {
    const status = normalizedOrderStatus(order);
    return status !== "completed" && status !== "cancelled";
  }

  function nextOwnerOrderAction(order) {
    const status = normalizedOrderStatus(order);
    const mode = orderPaymentMode(order);
    if (mode === "before_delivery") {
      if (status === "payment_pending" || status === "created") {
        return { nextStatus: "paid", label: "Confirm payment" };
      }
      if (status === "paid") {
        return { nextStatus: "ready", label: "Ready" };
      }
      if (status === "ready") {
        return { nextStatus: "completed", label: "Complete" };
      }
      return null;
    }
    if (status === "created") {
      return { nextStatus: "accepted", label: "Accept" };
    }
    if (status === "accepted") {
      return { nextStatus: "ready", label: "Ready" };
    }
    if (status === "ready") {
      return { nextStatus: "paid", label: "Paid" };
    }
    if (status === "paid") {
      return { nextStatus: "completed", label: "Complete" };
    }
    return null;
  }

  function isOwnerViewingShop(state) {
    return !!(state && state.activeShopId && state.ownerShopId && state.activeShopId === state.ownerShopId);
  }

  function parseGpsValue(value) {
    const text = String(value || "").trim();
    if (!text || text.indexOf(",") === -1) return null;
    const parts = text.split(",", 2);
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return [lat, lng];
  }

  function formatGpsValue(lat, lng) {
    if (!isFinite(lat) || !isFinite(lng)) return "";
    return Number(lat).toFixed(6) + "," + Number(lng).toFixed(6);
  }

  function createConsoleFromDetail(shop, detail) {
    const items = Array.isArray(detail && detail.items) ? detail.items : [];
    const paymentEntries = Array.isArray(detail && detail.paymentEntries) ? detail.paymentEntries : [];
    const gps = shop && shop.has_location && isFinite(shop.lat) && isFinite(shop.lng)
      ? formatGpsValue(shop.lat, shop.lng)
      : "";
    return {
      profile: {
        name: String(detail && detail.name || shop && (shop.display_name || shop.shop_id) || "").trim(),
        type: String(detail && detail.type || "Store").trim(),
        contact: String(detail && detail.contact || "").trim(),
        location: String(detail && detail.location || shop && shop.location_label || "").trim(),
        gps: gps,
        hours: String(detail && detail.hours || "").trim(),
        notes: String(detail && detail.note || "").trim(),
        logoFile: String(detail && detail.logoFile || "").trim()
      },
      listings: items.map(function (item, index) {
        return {
          id: String(item.id || ("item-" + index)).trim(),
          title: String(item.title || "").trim(),
          description: String(item.description || "").trim(),
          price: String(item.price || "").trim(),
          quantity: Math.max(0, Number(item.quantity || 0)),
          imageFiles: Array.isArray(item.imageFiles) ? item.imageFiles.slice(0, 8).map(function (fileName) {
            return String(fileName || "").trim();
          }).filter(Boolean) : [],
          createdAt: Math.max(0, Number(item.createdAt || 0))
        };
      }),
      payments: paymentEntries.map(function (item, index) {
        const label = String(item.label || "").trim().toUpperCase();
        return {
          id: "payment-" + index,
          label: label,
          details: String(item.note || "").trim(),
          upiId: label === "UPI" ? String(item.value || "").trim() : "",
          btcAddress: label === "BTC" ? String(item.value || "").trim() : "",
          ethAddress: label === "ETH" ? String(item.value || "").trim() : "",
          qrFile: paymentQrFile(item),
          createdAt: 0
        };
      }),
      orders: [],
      share: {
        mode: "cloud",
        domain: "",
        hubBaseUrl: "",
        publicUrl: String(shop && shop.public_url || "").trim()
      },
      billing: {
        mapUnlock: {
          requestedPlan: "free",
          status: "not_required",
          method: "",
          reference: "",
          note: "",
          updatedAt: 0
        }
      }
    };
  }

  function cloneConsoleData(consoleData) {
    try {
      return JSON.parse(JSON.stringify(consoleData || {}));
    } catch (error) {
      return {};
    }
  }

  function ensureShopConsole(state, shopId) {
    if (!state || !shopId) return null;
    if (state.shopConsoles[shopId]) {
      return cloneConsoleData(state.shopConsoles[shopId]);
    }
    const shop = state.shopById[shopId];
    const detail = state.shopDetails[shopId] || shopDetailFromPreview(shop);
    return createConsoleFromDetail(shop, detail || {});
  }

  function applyConsoleRecord(state, shopId, record) {
    if (!state || !shopId || !record || typeof record !== "object") return;
    const shop = mergeShopRecord(state, record, record.display_name || shopId) || state.shopById[shopId];
    if (!shop) return;
    if (record.console && typeof record.console === "object") {
      state.shopConsoles[shopId] = cloneConsoleData(record.console);
      state.shopDetails[shopId] = shopDetailFromRecord(shop, record);
      if (record.console.profile && typeof record.console.profile === "object") {
        const profile = record.console.profile;
        shop.display_name = String(profile.name || shop.display_name || shop.shop_id).trim() || shop.shop_id;
        if (String(profile.location || "").trim()) {
          shop.location_label = String(profile.location || "").trim();
        }
        const gps = parseGpsValue(profile.gps);
        shop.lat = gps ? gps[0] : null;
        shop.lng = gps ? gps[1] : null;
        shop.has_location = !!gps;
      }
    }
  }

  function refreshShopConsole(state, shopId, options) {
    if (!state || !shopId) return Promise.resolve(null);
    const preserveScroll = !!(options && options.preserveScroll);
    const focusMap = !!(options && options.focusMap);
    return window.fetch("/api/shops/" + encodeURIComponent(shopId) + "/console", {
      credentials: "same-origin",
      cache: "no-store"
    }).then(function (response) {
      if (!response.ok) throw new Error("shop_fetch_failed");
      return response.json();
    }).then(function (record) {
      applyConsoleRecord(state, shopId, record);
      if (state.activeShopId === shopId) {
        updateSearchField(state);
        syncActionButton(state);
        syncBackButton(state);
        renderShopList(state);
        if (!preserveScroll) {
          resetPaneScroll(state);
        }
        if (focusMap) {
          focusShopOnMap(state, state.shopById[shopId]);
        }
      }
      return record;
    });
  }

  function refreshOwnerOrdersNavData(state, options) {
    if (!state) return Promise.resolve(null);
    const shopId = ownerOrdersNavShopId(state);
    const force = !!(options && options.force);
    if (!shopId) {
      state.ownerOrdersNavLoading = false;
      syncActionButton(state);
      return Promise.resolve(null);
    }
    if (!force && state.shopConsoles && state.shopConsoles[shopId]) {
      state.ownerOrdersNavLoading = false;
      syncActionButton(state);
      return Promise.resolve(state.shopConsoles[shopId]);
    }
    state.ownerOrdersNavLoading = true;
    syncActionButton(state);
    return refreshShopConsole(state, shopId, { preserveScroll: true })
      .catch(function () {
        return null;
      })
      .then(function (record) {
        state.ownerOrdersNavLoading = false;
        syncActionButton(state);
        return record;
      });
  }

  function ownerStatusMarkup(state) {
    const tone = String(state.ownerPanel.tone || "").trim();
    return '<p class="shop-owner-status' + (tone ? (' is-' + escapeHtml(tone)) : '') + '">' + escapeHtml(state.ownerPanel.message || "") + '</p>';
  }

  function ownerPanelMarkup(state, detail, consoleData) {
    const tab = String(state.ownerPanel.tab || "").trim();
    if (tab !== "manage") return "";
    const profile = consoleData && consoleData.profile && typeof consoleData.profile === "object"
      ? consoleData.profile
      : createConsoleFromDetail(null, detail).profile;
    const listings = Array.isArray(consoleData && consoleData.listings) ? consoleData.listings : [];
    const orders = Array.isArray(consoleData && consoleData.orders) ? consoleData.orders : [];
    const pendingOrders = pendingOwnerOrdersCount(orders);
    const selectedItemId = String(state && state.ownerPanel && state.ownerPanel.itemId || "").trim();
    const selectedItem = listings.find(function (item) {
      return String(item && item.id || "").trim() === selectedItemId;
    }) || listings[0] || null;
    if (selectedItem && state && state.ownerPanel) {
      state.ownerPanel.itemId = String(selectedItem.id || "").trim();
    }
    const payments = Array.isArray(consoleData && consoleData.payments) ? consoleData.payments : [];
    let paymentDetails = "";
    let upiId = "";
    let btcAddress = "";
    let ethAddress = "";
    payments.forEach(function (payment) {
      if (!paymentDetails && payment && payment.details) paymentDetails = String(payment.details).trim();
      if (!upiId && payment && payment.upiId) upiId = String(payment.upiId).trim();
      if (!btcAddress && payment && payment.btcAddress) btcAddress = String(payment.btcAddress).trim();
      if (!ethAddress && payment && payment.ethAddress) ethAddress = String(payment.ethAddress).trim();
    });
    const paymentQrFile = paymentQrFileFromPayments(payments);
    const pickupGps = parseGpsValue(profile.gps || (detail && detail.gps));
    const pickupSummary = pickupGps
      ? (pickupGps[0].toFixed(5) + ", " + pickupGps[1].toFixed(5))
      : "No pickup point set";
    const itemPickerMarkup = listings.length ? (
      '<div class="shop-owner-item-picker">' +
        listings.map(function (item) {
          const itemId = String(item.id || "").trim();
          return '' +
            '<button class="shop-owner-item-select' + (selectedItem && itemId === String(selectedItem.id || "").trim() ? ' is-selected' : '') + '" type="button" data-owner-item-select="' + escapeHtml(itemId) + '">' +
              '<strong>' + escapeHtml(item.title || "Item") + '</strong>' +
              '<span>' + escapeHtml((item.price ? item.price + ' • ' : '') + 'Qty ' + Math.max(0, Number(item.quantity || 0))) + '</span>' +
            '</button>';
        }).join('') +
      '</div>'
    ) : '<div class="shop-list-empty">No items yet. Add your first one above.</div>';
    const selectedItemMarkup = selectedItem ? (
      '<section class="shop-owner-item-card" data-owner-item-id="' + escapeHtml(selectedItem.id || "") + '">' +
        '<div class="shop-owner-item-card-head">' +
          '<strong>' + escapeHtml(selectedItem.title || "Item") + '</strong>' +
          '<span>' + escapeHtml(String(selectedItem.id || "").trim()) + '</span>' +
        '</div>' +
        '<div class="shop-owner-grid">' +
          '<label class="shop-owner-field"><span>Item name</span><input class="shop-owner-input" data-owner-item-field="title" value="' + escapeHtml(selectedItem.title || "") + '" /></label>' +
          '<label class="shop-owner-field"><span>Price</span><input class="shop-owner-input" data-owner-item-field="price" type="number" min="0" step="0.01" inputmode="decimal" value="' + escapeHtml(selectedItem.price || "") + '" /></label>' +
          '<label class="shop-owner-field"><span>Qty</span><input class="shop-owner-input" data-owner-item-field="quantity" type="number" min="0" step="1" value="' + escapeHtml(selectedItem.quantity || 0) + '" /></label>' +
          '<label class="shop-owner-field shop-owner-field-wide shop-owner-description-field"><span>Description</span><textarea class="shop-owner-textarea" data-owner-item-field="description" rows="3">' + escapeHtml(selectedItem.description || "") + '</textarea></label>' +
        '</div>' +
        '<div class="shop-owner-item-actions">' +
          '<button class="shop-owner-save" type="button" data-owner-item-save="' + escapeHtml(selectedItem.id || "") + '">Save item</button>' +
          '<button class="shop-owner-chip-button is-danger" type="button" data-owner-item-remove="' + escapeHtml(selectedItem.id || "") + '">Remove</button>' +
        '</div>' +
      '</section>'
    ) : '';
    const selectedItemEditorMarkup = selectedItemMarkup ? (
      '<div class="shop-owner-item-editor">' +
        '<span class="shop-owner-inline-label">Edit selected item</span>' +
        selectedItemMarkup +
      '</div>'
    ) : '';
    const ordersMarkup = orders.length ? (
      '<div class="shop-owner-order-list">' +
        orderedOwnerOrders(orders).map(function (item) {
          return ownerOrderCardMarkup(item, detail, { limit: 3 });
        }).join('') +
      '</div>'
    ) : '<div class="shop-list-empty">No orders yet.</div>';

    return '' +
      '<section class="shop-owner-stack">' +
        ownerStatusMarkup(state) +
        '<form class="shop-owner-form" data-owner-form="profile">' +
          '<div class="shop-owner-form-head">' +
            '<strong>Shop</strong>' +
            '<span>How buyers see your place</span>' +
          '</div>' +
          '<div class="shop-owner-grid">' +
            '<label class="shop-owner-field"><span>Name</span><input class="shop-owner-input" name="name" value="' + escapeHtml(profile.name || detail.name || "") + '" /></label>' +
            '<label class="shop-owner-field"><span>Type</span><input class="shop-owner-input" name="type" value="' + escapeHtml(profile.type || detail.type || "") + '" /></label>' +
            '<label class="shop-owner-field"><span>Location</span><input class="shop-owner-input" name="location" value="' + escapeHtml(profile.location || detail.location || "") + '" /></label>' +
            '<label class="shop-owner-field"><span>Contact</span><input class="shop-owner-input" type="tel" inputmode="tel" autocomplete="tel" name="contact" value="' + escapeHtml(profile.contact || detail.contact || "") + '" /></label>' +
            ownerHoursFieldMarkup(profile.hours || detail.hours || "") +
            '<label class="shop-owner-field"><span>Currency prefix</span><input class="shop-owner-input" name="currencyPrefix" value="' + escapeHtml(profile.currencyPrefix || (detail.pricing && detail.pricing.prefix) || "") + '" placeholder="Rs" /></label>' +
            '<input type="hidden" name="gps" value="' + escapeHtml(profile.gps || "") + '">' +
            '<div class="shop-owner-field shop-owner-field-wide shop-owner-pickup">' +
              '<span>Pickup location</span>' +
              '<div class="shop-owner-pickup-map" id="ownerPickupMap"></div>' +
              '<div class="shop-owner-pickup-bar">' +
                '<button class="shop-owner-chip-button" type="button" data-pickup-use-map="true">Use current map</button>' +
                '<button class="shop-owner-chip-button" type="button" data-pickup-use-me="true">Use my location</button>' +
                '<span class="shop-owner-pickup-text" id="ownerPickupSummary">' + escapeHtml(pickupSummary) + '</span>' +
              '</div>' +
            '</div>' +
            '<label class="shop-owner-field shop-owner-field-wide"><span>Notes</span><textarea class="shop-owner-textarea" name="notes" rows="3">' + escapeHtml(profile.notes || detail.note || "") + '</textarea></label>' +
          '</div>' +
          '<button class="shop-owner-save" type="button" data-owner-save="profile">Save shop</button>' +
        '</form>' +
        '<form class="shop-owner-form" data-owner-form="item">' +
          '<div class="shop-owner-form-head">' +
            '<strong>Inventory</strong>' +
            '<span>Add new ones and select an item to edit</span>' +
          '</div>' +
          '<div class="shop-owner-grid">' +
            '<label class="shop-owner-field"><span>Item name</span><input class="shop-owner-input" name="title" placeholder="Kitkat" /></label>' +
            '<label class="shop-owner-field"><span>Price</span><input class="shop-owner-input" name="price" type="number" min="0" step="0.01" inputmode="decimal" placeholder="20" /></label>' +
            '<label class="shop-owner-field"><span>Qty</span><input class="shop-owner-input" name="quantity" type="number" min="0" step="1" placeholder="12" /></label>' +
            '<label class="shop-owner-field shop-owner-field-wide shop-owner-description-field"><span>Description</span><textarea class="shop-owner-textarea" name="description" rows="3" placeholder="Quick note for buyers"></textarea></label>' +
          '</div>' +
          '<button class="shop-owner-save" type="button" data-owner-save="item">Add item</button>' +
          '<div class="shop-owner-item-list">' +
            itemPickerMarkup +
            selectedItemEditorMarkup +
          '</div>' +
        '</form>' +
        '<form class="shop-owner-form" data-owner-form="payments">' +
          '<div class="shop-owner-form-head">' +
            '<strong>Payments</strong>' +
            '<span>What buyers can use here</span>' +
          '</div>' +
          '<div class="shop-owner-grid">' +
            '<label class="shop-owner-field"><span>UPI</span><input class="shop-owner-input" name="upiId" value="' + escapeHtml(upiId) + '" placeholder="shop@upi" autocapitalize="off" autocomplete="off" spellcheck="false" /></label>' +
            '<label class="shop-owner-field"><span>BTC</span><input class="shop-owner-input" name="btcAddress" value="' + escapeHtml(btcAddress) + '" placeholder="bc1..." autocapitalize="off" autocomplete="off" spellcheck="false" /></label>' +
            '<label class="shop-owner-field"><span>ETH</span><input class="shop-owner-input" name="ethAddress" value="' + escapeHtml(ethAddress) + '" placeholder="0x..." autocapitalize="off" autocomplete="off" spellcheck="false" /></label>' +
            ownerPaymentQrFieldMarkup(paymentQrFile) +
            '<label class="shop-owner-field shop-owner-field-wide"><span>Payment note</span><textarea class="shop-owner-textarea" name="details" rows="3" placeholder="Shown to buyers">' + escapeHtml(paymentDetails) + '</textarea></label>' +
          '</div>' +
          '<button class="shop-owner-save" type="button" data-owner-save="payments">Save payments</button>' +
        '</form>' +
        '<section class="shop-owner-form" data-owner-form="orders">' +
          '<div class="shop-owner-form-head">' +
            '<strong>Orders</strong>' +
            '<span>Orders created through this shop appear here</span>' +
          '</div>' +
          ordersMarkup +
        '</form>' +
      '</section>';
  }

  function ownerManageMarkup(state, detail, consoleData) {
    const tab = String(state.ownerPanel.tab || "").trim();
    if (tab !== "manage") return "";
    const openSection = String(state && state.ownerPanel && state.ownerPanel.section || "").trim();
    const profile = consoleData && consoleData.profile && typeof consoleData.profile === "object"
      ? consoleData.profile
      : createConsoleFromDetail(null, detail).profile;
    const listings = Array.isArray(consoleData && consoleData.listings) ? consoleData.listings : [];
    const orders = Array.isArray(consoleData && consoleData.orders) ? consoleData.orders : [];
    const pendingOrders = pendingOwnerOrdersCount(orders);
    const selectedItemId = String(state && state.ownerPanel && state.ownerPanel.itemId || "").trim();
    const selectedItem = listings.find(function (item) {
      return String(item && item.id || "").trim() === selectedItemId;
    }) || listings[0] || null;
    if (selectedItem && state && state.ownerPanel) {
      state.ownerPanel.itemId = String(selectedItem.id || "").trim();
    }
    const payments = Array.isArray(consoleData && consoleData.payments) ? consoleData.payments : [];
    let paymentDetails = "";
    let upiId = "";
    let btcAddress = "";
    let ethAddress = "";
    payments.forEach(function (payment) {
      if (!paymentDetails && payment && payment.details) paymentDetails = String(payment.details).trim();
      if (!upiId && payment && payment.upiId) upiId = String(payment.upiId).trim();
      if (!btcAddress && payment && payment.btcAddress) btcAddress = String(payment.btcAddress).trim();
      if (!ethAddress && payment && payment.ethAddress) ethAddress = String(payment.ethAddress).trim();
    });
    const paymentQrFile = paymentQrFileFromPayments(payments);
    const pickupGps = parseGpsValue(profile.gps || (detail && detail.gps));
    const pickupSummary = pickupGps
      ? (pickupGps[0].toFixed(5) + ", " + pickupGps[1].toFixed(5))
      : "No pickup point set";
    const itemPickerMarkup = listings.length ? (
      '<div class="shop-owner-item-picker">' +
        listings.map(function (item) {
          const itemId = String(item.id || "").trim();
          return '' +
            '<button class="shop-owner-item-select' + (selectedItem && itemId === String(selectedItem.id || "").trim() ? ' is-selected' : '') + '" type="button" data-owner-item-select="' + escapeHtml(itemId) + '">' +
              '<strong>' + escapeHtml(item.title || "Item") + '</strong>' +
              '<span>' + escapeHtml((item.price ? item.price + ' • ' : '') + 'Qty ' + Math.max(0, Number(item.quantity || 0))) + '</span>' +
            '</button>';
        }).join('') +
      '</div>'
    ) : '<div class="shop-list-empty">No items yet. Add your first one above.</div>';
    const selectedItemMarkup = selectedItem ? (
      '<section class="shop-owner-item-card" data-owner-item-id="' + escapeHtml(selectedItem.id || "") + '">' +
        '<div class="shop-owner-item-card-head">' +
          '<strong>' + escapeHtml(selectedItem.title || "Item") + '</strong>' +
          '<span>' + escapeHtml(String(selectedItem.id || "").trim()) + '</span>' +
        '</div>' +
        '<div class="shop-owner-grid">' +
          '<label class="shop-owner-field"><span>Item name</span><input class="shop-owner-input" data-owner-item-field="title" value="' + escapeHtml(selectedItem.title || "") + '" /></label>' +
          '<label class="shop-owner-field"><span>Price</span><input class="shop-owner-input" data-owner-item-field="price" type="number" min="0" step="0.01" inputmode="decimal" value="' + escapeHtml(selectedItem.price || "") + '" /></label>' +
          '<label class="shop-owner-field"><span>Qty</span><input class="shop-owner-input" data-owner-item-field="quantity" type="number" min="0" step="1" value="' + escapeHtml(selectedItem.quantity || 0) + '" /></label>' +
          '<label class="shop-owner-field shop-owner-field-wide shop-owner-description-field"><span>Description</span><textarea class="shop-owner-textarea" data-owner-item-field="description" rows="3">' + escapeHtml(selectedItem.description || "") + '</textarea></label>' +
        '</div>' +
        '<div class="shop-owner-item-actions">' +
          '<button class="shop-owner-save" type="button" data-owner-item-save="' + escapeHtml(selectedItem.id || "") + '">Save item</button>' +
          '<button class="shop-owner-chip-button is-danger" type="button" data-owner-item-remove="' + escapeHtml(selectedItem.id || "") + '">Remove</button>' +
        '</div>' +
      '</section>'
    ) : '';
    const selectedItemEditorMarkup = selectedItemMarkup ? (
      '<div class="shop-owner-item-editor">' +
        '<span class="shop-owner-inline-label">Edit selected item</span>' +
        selectedItemMarkup +
      '</div>'
    ) : '';
    const ordersMarkup = orders.length ? (
      '<div class="shop-owner-order-list">' +
        orderedOwnerOrders(orders).map(function (item) {
          return ownerOrderCardMarkup(item, detail, { limit: 3 });
        }).join('') +
      '</div>'
    ) : '<div class="shop-list-empty">No orders yet.</div>';
    function sectionMarkup(key, title, copy, body) {
      const isOpen = openSection === key;
      const bodyId = "ownerSection-" + key;
      return '' +
        '<section class="shop-owner-section' + (isOpen ? ' is-open' : '') + '" data-owner-section-root="' + escapeHtml(key) + '">' +
          '<button class="shop-owner-section-toggle" type="button" data-owner-section-toggle="' + escapeHtml(key) + '" aria-expanded="' + (isOpen ? 'true' : 'false') + '" aria-controls="' + escapeHtml(bodyId) + '">' +
            '<span class="shop-owner-section-copy">' +
              '<strong>' + escapeHtml(title) + '</strong>' +
              '<span>' + escapeHtml(copy) + '</span>' +
            '</span>' +
            '<span class="shop-owner-section-chevron" aria-hidden="true"></span>' +
          '</button>' +
          '<div class="shop-owner-section-body" id="' + escapeHtml(bodyId) + '" aria-hidden="' + (isOpen ? 'false' : 'true') + '">' + body + '</div>' +
        '</section>';
    }

    return '' +
      '<section class="shop-owner-stack">' +
        ownerStatusMarkup(state) +
        sectionMarkup(
          'profile',
          'Shop',
          'How buyers see your place',
          '<form class="shop-owner-form" data-owner-form="profile">' +
            '<div class="shop-owner-grid">' +
              '<label class="shop-owner-field"><span>Name</span><input class="shop-owner-input" name="name" value="' + escapeHtml(profile.name || detail.name || "") + '" /></label>' +
              '<label class="shop-owner-field"><span>Type</span><input class="shop-owner-input" name="type" value="' + escapeHtml(profile.type || detail.type || "") + '" /></label>' +
              '<label class="shop-owner-field"><span>Location</span><input class="shop-owner-input" name="location" value="' + escapeHtml(profile.location || detail.location || "") + '" /></label>' +
              '<label class="shop-owner-field"><span>Contact</span><input class="shop-owner-input" type="tel" inputmode="tel" autocomplete="tel" name="contact" value="' + escapeHtml(profile.contact || detail.contact || "") + '" /></label>' +
              ownerHoursFieldMarkup(profile.hours || detail.hours || "") +
              '<label class="shop-owner-field"><span>Currency prefix</span><input class="shop-owner-input" name="currencyPrefix" value="' + escapeHtml(profile.currencyPrefix || (detail.pricing && detail.pricing.prefix) || "") + '" placeholder="Rs" /></label>' +
              '<input type="hidden" name="gps" value="' + escapeHtml(profile.gps || "") + '">' +
              '<div class="shop-owner-field shop-owner-field-wide shop-owner-pickup">' +
                '<span>Pickup location</span>' +
                '<div class="shop-owner-pickup-map" id="ownerPickupMap"></div>' +
                '<div class="shop-owner-pickup-bar">' +
                  '<button class="shop-owner-chip-button" type="button" data-pickup-use-map="true">Use current map</button>' +
                  '<button class="shop-owner-chip-button" type="button" data-pickup-use-me="true">Use my location</button>' +
                  '<span class="shop-owner-pickup-text" id="ownerPickupSummary">' + escapeHtml(pickupSummary) + '</span>' +
                '</div>' +
              '</div>' +
              '<label class="shop-owner-field shop-owner-field-wide"><span>Notes</span><textarea class="shop-owner-textarea" name="notes" rows="3">' + escapeHtml(profile.notes || detail.note || "") + '</textarea></label>' +
            '</div>' +
            '<button class="shop-owner-save" type="button" data-owner-save="profile">Save shop</button>' +
          '</form>'
        ) +
        sectionMarkup(
          'item',
          'Inventory',
          'Add new ones and select an item to edit',
          '<form class="shop-owner-form" data-owner-form="item">' +
            '<div class="shop-owner-grid">' +
              '<label class="shop-owner-field"><span>Item name</span><input class="shop-owner-input" name="title" placeholder="Kitkat" /></label>' +
              '<label class="shop-owner-field"><span>Price</span><input class="shop-owner-input" name="price" type="number" min="0" step="0.01" inputmode="decimal" placeholder="20" /></label>' +
              '<label class="shop-owner-field"><span>Qty</span><input class="shop-owner-input" name="quantity" type="number" min="0" step="1" placeholder="12" /></label>' +
              '<label class="shop-owner-field shop-owner-field-wide shop-owner-description-field"><span>Description</span><textarea class="shop-owner-textarea" name="description" rows="3" placeholder="Quick note for buyers"></textarea></label>' +
            '</div>' +
            '<button class="shop-owner-save" type="button" data-owner-save="item">Add item</button>' +
            '<div class="shop-owner-item-list">' +
              itemPickerMarkup +
              selectedItemEditorMarkup +
            '</div>' +
          '</form>'
        ) +
        sectionMarkup(
          'payments',
          'Payments',
          'What buyers can use here',
          '<form class="shop-owner-form" data-owner-form="payments">' +
            '<div class="shop-owner-grid">' +
              '<label class="shop-owner-field"><span>UPI</span><input class="shop-owner-input" name="upiId" value="' + escapeHtml(upiId) + '" placeholder="shop@upi" autocapitalize="off" autocomplete="off" spellcheck="false" /></label>' +
              '<label class="shop-owner-field"><span>BTC</span><input class="shop-owner-input" name="btcAddress" value="' + escapeHtml(btcAddress) + '" placeholder="bc1..." autocapitalize="off" autocomplete="off" spellcheck="false" /></label>' +
              '<label class="shop-owner-field"><span>ETH</span><input class="shop-owner-input" name="ethAddress" value="' + escapeHtml(ethAddress) + '" placeholder="0x..." autocapitalize="off" autocomplete="off" spellcheck="false" /></label>' +
              ownerPaymentQrFieldMarkup(paymentQrFile) +
              '<label class="shop-owner-field shop-owner-field-wide"><span>Payment note</span><textarea class="shop-owner-textarea" name="details" rows="3" placeholder="Shown to buyers">' + escapeHtml(paymentDetails) + '</textarea></label>' +
            '</div>' +
            '<button class="shop-owner-save" type="button" data-owner-save="payments">Save payments</button>' +
          '</form>'
        ) +
        sectionMarkup(
          'orders',
          pendingOrders ? ("Orders (" + pendingOrders + " pending)") : 'Orders',
          pendingOrders
            ? (pendingOrders === 1 ? '1 pending order needs attention' : (pendingOrders + ' pending orders need attention'))
            : 'Orders created through this shop appear here',
          '<section class="shop-owner-form" data-owner-form="orders">' + ordersMarkup + '</section>'
        ) +
      '</section>';
  }

  function ownerItemPreviewMarkup(item, className) {
    const safeClassName = String(className || "").trim();
    const imageFiles = Array.isArray(item && item.imageFiles) ? item.imageFiles : [];
    const firstImage = imageFiles.length ? assetFileUrl(imageFiles[0]) : "";
    if (firstImage) {
      return '' +
        '<span class="shop-owner-item-preview is-image' + (safeClassName ? (" " + safeClassName) : "") + '">' +
          '<img class="shop-owner-item-preview-image" src="' + escapeHtml(firstImage) + '" alt="' + escapeHtml(String(item && item.title || "Item")) + '">' +
        '</span>';
    }
    return '<span class="shop-owner-item-preview' + (safeClassName ? (" " + safeClassName) : "") + '" aria-hidden="true"></span>';
  }

  function ownerSelectedItemEditorMarkup(selectedItem) {
    if (!selectedItem) return "";
    const imageFiles = Array.isArray(selectedItem.imageFiles) ? selectedItem.imageFiles : [];
    const galleryMarkup = imageFiles.length ? (
      '<div class="shop-owner-item-gallery">' +
        imageFiles.map(function (fileName, index) {
          return '' +
            '<span class="shop-owner-item-gallery-thumb' + (index === 0 ? ' is-primary' : '') + '">' +
              '<img src="' + escapeHtml(assetFileUrl(fileName)) + '" alt="' + escapeHtml((selectedItem.title || "Item") + " image " + (index + 1)) + '">' +
            '</span>';
        }).join('') +
      '</div>'
    ) : '<p class="shop-owner-media-note">No item images yet.</p>';
    return '' +
      '<div class="shop-owner-item-editor">' +
        '<span class="shop-owner-inline-label">Editing now</span>' +
        '<section class="shop-owner-item-card" data-owner-item-id="' + escapeHtml(selectedItem.id || "") + '">' +
          '<div class="shop-owner-item-card-head">' +
            '<div class="shop-owner-item-card-title">' +
              ownerItemPreviewMarkup(selectedItem, "is-card") +
              '<div class="shop-owner-item-card-copy">' +
                '<strong>' + escapeHtml(selectedItem.title || "Item") + '</strong>' +
                '<span>Change details below</span>' +
              '</div>' +
            '</div>' +
            '<span class="shop-owner-edit-pill">Selected item</span>' +
          '</div>' +
          '<div class="shop-owner-grid">' +
            '<label class="shop-owner-field"><span>Item name</span><input class="shop-owner-input" data-owner-item-field="title" value="' + escapeHtml(selectedItem.title || "") + '" /></label>' +
            '<label class="shop-owner-field"><span>Price</span><input class="shop-owner-input" data-owner-item-field="price" type="number" min="0" step="0.01" inputmode="decimal" value="' + escapeHtml(selectedItem.price || "") + '" /></label>' +
            '<label class="shop-owner-field"><span>Qty</span><input class="shop-owner-input" data-owner-item-field="quantity" type="number" min="0" step="1" value="' + escapeHtml(selectedItem.quantity || 0) + '" /></label>' +
            '<label class="shop-owner-field shop-owner-field-wide shop-owner-description-field"><span>Description</span><textarea class="shop-owner-textarea" data-owner-item-field="description" rows="3">' + escapeHtml(selectedItem.description || "") + '</textarea></label>' +
            '<div class="shop-owner-field shop-owner-field-wide">' +
              '<span>Images</span>' +
              galleryMarkup +
              '<label class="shop-owner-upload-button">' +
                '<input class="shop-owner-file-input" type="file" accept="image/*" data-owner-item-image-input="' + escapeHtml(selectedItem.id || "") + '">' +
                '<span>' + escapeHtml(imageFiles.length ? "Add another image" : "Upload image") + '</span>' +
              '</label>' +
            '</div>' +
          '</div>' +
          '<div class="shop-owner-item-actions">' +
            '<button class="shop-owner-save" type="button" data-owner-item-save="' + escapeHtml(selectedItem.id || "") + '">Save changes</button>' +
            '<button class="shop-owner-chip-button is-danger" type="button" data-owner-item-remove="' + escapeHtml(selectedItem.id || "") + '">Delete item</button>' +
          '</div>' +
        '</section>' +
      '</div>';
  }

  function ownerManageSummaryMarkup(state, detail, consoleData, activeLabel) {
    const profile = consoleData && consoleData.profile && typeof consoleData.profile === "object"
      ? consoleData.profile
      : {};
    const listings = Array.isArray(consoleData && consoleData.listings) ? consoleData.listings : [];
    const orders = Array.isArray(consoleData && consoleData.orders) ? consoleData.orders : [];
    const payments = Array.isArray(consoleData && consoleData.payments) ? consoleData.payments : [];
    const shopId = String(state && state.activeShopId || "").trim();
    const shopName = String(profile.name || detail && detail.name || shopId || "My shop").trim();
    const location = String(profile.location || detail && detail.location || "").trim();
    const hours = String(profile.hours || detail && detail.hours || "").trim();
    const contact = String(profile.contact || detail && detail.contact || "").trim();
    const shopType = String(profile.type || detail && detail.type || "Shop").trim();
    const logoFile = String(profile.logoFile || detail && detail.logoFile || "").trim();
    const itemCount = listings.length || (Array.isArray(detail && detail.items) ? detail.items.length : 0);
    const pendingCount = pendingOwnerOrdersCount(orders);
    const activeText = String(activeLabel || "Manage").trim();
    const metaParts = [shopType];
    if (location) metaParts.push(location);
    if (hours) metaParts.push(hours);
    if (!hours && contact) metaParts.push(contact);
    const logoMarkup = logoFile && shopId
      ? '<span class="shop-owner-summary-mark is-logo"><img src="' + escapeHtml(shopLogoUrl(shopId)) + '" alt="' + escapeHtml(shopName + " logo") + '"></span>'
      : '<span class="shop-owner-summary-mark" aria-hidden="true">' + escapeHtml((shopName.charAt(0) || "#").toUpperCase()) + '</span>';
    return '' +
      '<section class="shop-owner-summary-card" aria-label="Current shop">' +
        '<div class="shop-owner-summary-main">' +
          logoMarkup +
          '<div class="shop-owner-summary-copy">' +
            '<span class="shop-owner-summary-kicker">' + escapeHtml(activeText) + '</span>' +
            '<strong>' + escapeHtml(shopName) + '</strong>' +
            '<span>' + escapeHtml(metaParts.filter(Boolean).join(" • ") || "Shop details") + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="shop-owner-summary-chips">' +
          '<span>' + escapeHtml(itemCount + " item" + (itemCount === 1 ? "" : "s")) + '</span>' +
          '<span>' + escapeHtml(pendingCount ? (pendingCount + " pending") : "No pending") + '</span>' +
          '<span>' + escapeHtml(payments.length ? "Payments set" : "No payments") + '</span>' +
        '</div>' +
      '</section>';
  }

  function ownerSettingsMarkup(state, detail, consoleData) {
    if (String(state && state.ownerPanel && state.ownerPanel.tab || "").trim() !== "settings") return "";
    const section = normalizeOwnerSettingsSection(state && state.ownerPanel && state.ownerPanel.section);
    const profile = consoleData && consoleData.profile && typeof consoleData.profile === "object"
      ? consoleData.profile
      : createConsoleFromDetail(null, detail).profile;
    const payments = Array.isArray(consoleData && consoleData.payments) ? consoleData.payments : [];
    let paymentDetails = "";
    let upiId = "";
    let btcAddress = "";
    let ethAddress = "";
    payments.forEach(function (payment) {
      if (!paymentDetails && payment && payment.details) paymentDetails = String(payment.details).trim();
      if (!upiId && payment && payment.upiId) upiId = String(payment.upiId).trim();
      if (!btcAddress && payment && payment.btcAddress) btcAddress = String(payment.btcAddress).trim();
      if (!ethAddress && payment && payment.ethAddress) ethAddress = String(payment.ethAddress).trim();
    });
    const paymentQrFile = paymentQrFileFromPayments(payments);
    const pickupGps = parseGpsValue(profile.gps || (detail && detail.gps));
    const pickupSummary = pickupGps
      ? (pickupGps[0].toFixed(5) + ", " + pickupGps[1].toFixed(5))
      : "No pickup point set";
    const logoMarkup = profile.logoFile ? (
      '<span class="shop-owner-logo-preview is-logo">' +
        '<img class="shop-owner-logo-image" src="' + escapeHtml(shopLogoUrl(state.activeShopId)) + '" alt="' + escapeHtml((detail && detail.name) || "Shop logo") + '">' +
      '</span>'
    ) : '<span class="shop-owner-logo-preview" aria-hidden="true"></span>';
    const settingsTabsMarkup = '' +
      '<div class="shop-owner-tab-row">' +
        '<button class="shop-owner-tab' + (section === "profile" ? ' is-active' : '') + '" type="button" data-owner-settings-section="profile">Shop</button>' +
        '<button class="shop-owner-tab' + (section === "payments" ? ' is-active' : '') + '" type="button" data-owner-settings-section="payments">Payments</button>' +
      '</div>';
    const bodyMarkup = section === "payments"
      ? (
        '<form class="shop-owner-form" data-owner-form="payments">' +
          '<div class="shop-owner-form-head">' +
            '<strong>Payments</strong>' +
            '<span>What buyers can use here.</span>' +
          '</div>' +
          '<div class="shop-owner-grid">' +
            '<label class="shop-owner-field"><span>UPI</span><input class="shop-owner-input" name="upiId" value="' + escapeHtml(upiId) + '" placeholder="shop@upi" autocapitalize="off" autocomplete="off" spellcheck="false" /></label>' +
            '<label class="shop-owner-field"><span>BTC</span><input class="shop-owner-input" name="btcAddress" value="' + escapeHtml(btcAddress) + '" placeholder="bc1..." autocapitalize="off" autocomplete="off" spellcheck="false" /></label>' +
            '<label class="shop-owner-field"><span>ETH</span><input class="shop-owner-input" name="ethAddress" value="' + escapeHtml(ethAddress) + '" placeholder="0x..." autocapitalize="off" autocomplete="off" spellcheck="false" /></label>' +
            ownerPaymentQrFieldMarkup(paymentQrFile) +
            '<label class="shop-owner-field shop-owner-field-wide"><span>Payment note</span><textarea class="shop-owner-textarea" name="details" rows="3" placeholder="Shown to buyers">' + escapeHtml(paymentDetails) + '</textarea></label>' +
          '</div>' +
          '<div class="shop-owner-action-row">' +
            '<button class="shop-owner-save" type="button" data-owner-save="payments">Save payments</button>' +
          '</div>' +
        '</form>'
      )
      : (
        '<form class="shop-owner-form" data-owner-form="profile">' +
          '<div class="shop-owner-form-head">' +
            '<strong>Shop settings</strong>' +
            '<span>Production shop details and pickup point.</span>' +
          '</div>' +
          '<div class="shop-owner-grid">' +
            '<div class="shop-owner-field shop-owner-field-wide">' +
              '<span>Logo</span>' +
              '<div class="shop-owner-logo-row">' +
                logoMarkup +
                '<div class="shop-owner-logo-copy">' +
                  '<strong>' + escapeHtml(profile.logoFile ? "Logo uploaded" : "No logo yet") + '</strong>' +
                  '<span>Square images work best. This shows without an outline in the shop header.</span>' +
                '</div>' +
                '<label class="shop-owner-upload-button">' +
                  '<input class="shop-owner-file-input" type="file" accept="image/*" data-owner-logo-input="true">' +
                  '<span>' + escapeHtml(profile.logoFile ? "Replace logo" : "Upload logo") + '</span>' +
                '</label>' +
              '</div>' +
            '</div>' +
            '<label class="shop-owner-field"><span>Name</span><input class="shop-owner-input" name="name" value="' + escapeHtml(profile.name || detail.name || "") + '" /></label>' +
            '<label class="shop-owner-field"><span>Type</span><input class="shop-owner-input" name="type" value="' + escapeHtml(profile.type || detail.type || "") + '" /></label>' +
            '<label class="shop-owner-field"><span>Location</span><input class="shop-owner-input" name="location" value="' + escapeHtml(profile.location || detail.location || "") + '" autocomplete="street-address" /></label>' +
            '<label class="shop-owner-field"><span>Contact</span><input class="shop-owner-input" type="tel" inputmode="tel" autocomplete="tel" name="contact" value="' + escapeHtml(profile.contact || detail.contact || "") + '" /></label>' +
            ownerHoursFieldMarkup(profile.hours || detail.hours || "") +
            '<label class="shop-owner-field"><span>Currency prefix</span><input class="shop-owner-input" name="currencyPrefix" value="' + escapeHtml(profile.currencyPrefix || (detail.pricing && detail.pricing.prefix) || "") + '" placeholder="Rs" /></label>' +
            '<input type="hidden" name="gps" value="' + escapeHtml(profile.gps || "") + '">' +
            '<div class="shop-owner-field shop-owner-field-wide shop-owner-pickup">' +
              '<span>Pickup location</span>' +
              '<div class="shop-owner-pickup-map" id="ownerPickupMap"></div>' +
              '<div class="shop-owner-pickup-bar">' +
                '<button class="shop-owner-chip-button" type="button" data-pickup-use-map="true">Use current map</button>' +
                '<button class="shop-owner-chip-button" type="button" data-pickup-use-me="true">Use my location</button>' +
                '<span class="shop-owner-pickup-text" id="ownerPickupSummary">' + escapeHtml(pickupSummary) + '</span>' +
              '</div>' +
            '</div>' +
            '<label class="shop-owner-field shop-owner-field-wide"><span>Notes</span><textarea class="shop-owner-textarea" name="notes" rows="3">' + escapeHtml(profile.notes || detail.note || "") + '</textarea></label>' +
          '</div>' +
          '<div class="shop-owner-action-row">' +
            '<button class="shop-owner-save" type="button" data-owner-save="profile">Save shop</button>' +
            '<button class="shop-owner-chip-button is-danger" type="button" data-owner-logout="true">Logout</button>' +
          '</div>' +
        '</form>'
      );
    return '' +
      '<section class="shop-owner-stack">' +
        ownerStatusMarkup(state) +
        ownerManageSummaryMarkup(state, detail, consoleData, section === "payments" ? "Payments" : "Manage") +
        settingsTabsMarkup +
        bodyMarkup +
      '</section>';
  }

  function ownerHistoryMarkup(state, detail, consoleData) {
    if (String(state && state.ownerPanel && state.ownerPanel.tab || "").trim() !== "history") return "";
    const section = normalizeOwnerHistorySection(state && state.ownerPanel && state.ownerPanel.section);
    const query = normalizeSearch(state && state.searchQuery || "");
    const listings = Array.isArray(consoleData && consoleData.listings) ? consoleData.listings : [];
    const orders = Array.isArray(consoleData && consoleData.orders) ? consoleData.orders : [];
    const selectedItemId = String(state && state.ownerPanel && state.ownerPanel.itemId || "").trim();
    const selectedItem = listings.find(function (item) {
      return String(item && item.id || "").trim() === selectedItemId;
    }) || listings[0] || null;
    if (selectedItem && state && state.ownerPanel) {
      state.ownerPanel.itemId = String(selectedItem.id || "").trim();
    }
    let bodyMarkup = "";
    const sectionLabel = section === "items" ? "Inventory" : section === "sales" ? "Sales" : "Orders";
    const historyTabsMarkup = '' +
      '<div class="shop-owner-tab-row shop-owner-history-tabs">' +
        '<button class="shop-owner-tab' + (section === "orders" ? ' is-active' : '') + '" type="button" data-owner-history-section="orders">Orders</button>' +
        '<button class="shop-owner-tab' + (section === "items" ? ' is-active' : '') + '" type="button" data-owner-history-section="items">Items</button>' +
        '<button class="shop-owner-tab' + (section === "sales" ? ' is-active' : '') + '" type="button" data-owner-history-section="sales">Sales</button>' +
      '</div>';

    if (section === "orders") {
      const draft = ownerOrderDraft(state, state.activeShopId);
      const draftItems = ownerDraftItems(detail, draft);
      const draftTotal = draftItems.reduce(function (sum, item) {
        return sum + Number(item.total || 0);
      }, 0);
      const filteredOrders = orderedOwnerOrders(orders).filter(function (order) {
        return matchesSearch([
          order.title,
          order.id,
          order.status,
          order.paymentLabel,
          order.total,
          order.notes,
          order.address,
          order.buyerName,
          order.buyerContact
        ], query);
      });
      const draftOpen = !!(state && state.ownerPanel && state.ownerPanel.orderDraftOpen);
      const draftSectionMarkup = draftOpen ? (
        '<section class="shop-owner-form">' +
            '<div class="shop-owner-form-head">' +
              '<strong>Start order</strong>' +
              '<button class="shop-owner-chip-button" type="button" data-owner-walkin-toggle="true">Close</button>' +
            '</div>' +
            '<div class="shop-owner-grid">' +
              '<label class="shop-owner-field"><span>Buyer name</span><input class="shop-owner-input" data-owner-order-draft-field="buyerName" value="' + escapeHtml(draft.buyerName || "") + '" placeholder="Optional" /></label>' +
              '<label class="shop-owner-field"><span>Buyer contact</span><input class="shop-owner-input" type="tel" inputmode="tel" autocomplete="tel" data-owner-order-draft-field="buyerContact" value="' + escapeHtml(draft.buyerContact || "") + '" placeholder="Optional" /></label>' +
              '<label class="shop-owner-field shop-owner-field-wide"><span>Notes</span><textarea class="shop-owner-textarea" data-owner-order-draft-field="notes" rows="2" placeholder="Cash, takeaway, table no...">' + escapeHtml(draft.notes || "") + '</textarea></label>' +
            '</div>' +
            '<div class="shop-owner-mode-row">' +
              '<button class="shop-owner-tab' + (draft.paymentMode === "on_receive" ? ' is-active' : '') + '" type="button" data-owner-order-payment="on_receive">Pay on receive</button>' +
              '<button class="shop-owner-tab' + (draft.paymentMode === "before_delivery" ? ' is-active' : '') + '" type="button" data-owner-order-payment="before_delivery">Pay before</button>' +
            '</div>' +
            (listings.length ? (
              '<div class="shop-owner-draft-list">' +
                listings.map(function (item) {
                  const quantity = Math.max(0, Number(draft.items && draft.items[item.id] || 0));
                  return '' +
                    '<article class="shop-owner-draft-card">' +
                      '<div class="shop-owner-draft-head">' +
                        '<div class="shop-owner-draft-title">' +
                          ownerItemPreviewMarkup(item, "is-draft") +
                          '<div class="shop-owner-draft-copy">' +
                            '<strong>' + escapeHtml(item.title || "Item") + '</strong>' +
                            '<span>' + escapeHtml(formatPrice(item.price, detail && detail.pricing) || (item.quantity > 0 ? ("Qty " + item.quantity) : "Available")) + '</span>' +
                          '</div>' +
                        '</div>' +
                        '<div class="shop-item-stepper">' +
                          '<button class="shop-owner-step" type="button" data-owner-draft-step="-1" data-item-id="' + escapeHtml(item.id || "") + '"' + (quantity ? '' : ' disabled') + '>-</button>' +
                          '<span class="shop-item-qty">' + escapeHtml(quantity) + '</span>' +
                          '<button class="shop-owner-step" type="button" data-owner-draft-step="1" data-item-id="' + escapeHtml(item.id || "") + '">+</button>' +
                        '</div>' +
                      '</div>' +
                    '</article>';
                }).join('') +
              '</div>'
            ) : '<div class="shop-list-empty">Add stock first.</div>') +
            '<div class="shop-owner-summary-bar">' +
              '<span>' + escapeHtml(draftItems.length ? (draftItems.reduce(function (sum, item) { return sum + item.quantity; }, 0) + " selected") : "No items selected") + '</span>' +
              '<strong>' + escapeHtml(draftTotal > 0 ? formatTotalAmount(draftTotal, detail && detail.pricing) : "0") + '</strong>' +
            '</div>' +
            '<div class="shop-owner-action-row">' +
              '<button class="shop-owner-save" type="button" data-owner-walkin-submit="true"' + (draftItems.length ? '' : ' disabled') + '>Save order</button>' +
            '</div>' +
          '</section>'
      ) : (
        '<section class="shop-owner-form shop-owner-compact-task">' +
          '<div class="shop-owner-form-head">' +
            '<strong>Orders</strong>' +
            '<button class="shop-owner-save" type="button" data-owner-walkin-toggle="true">Start order</button>' +
          '</div>' +
        '</section>'
      );
      bodyMarkup = draftSectionMarkup +
        '<section class="shop-owner-form">' +
          '<div class="shop-owner-form-head">' +
            '<strong>Order history</strong>' +
            '<span>' + escapeHtml(filteredOrders.length ? (filteredOrders.length + " visible") : "No matching orders") + '</span>' +
          '</div>' +
	          (filteredOrders.length ? (
		            '<div class="shop-owner-order-list">' +
		              filteredOrders.map(function (item) {
		                return ownerOrderCardMarkup(item, detail, { includeMapCue: true, limit: 3 });
	              }).join('') +
	            '</div>'
          ) : '<div class="shop-list-empty">' + escapeHtml(query ? "No orders match this search." : "No orders yet.") + '</div>') +
        '</section>';
    } else if (section === "sales") {
      const accountingOrders = orderedOwnerOrders(orders).filter(function (order) {
        return matchesSearch([
          order.title,
          order.id,
          order.status,
          order.paymentLabel,
          order.total,
          order.notes,
          order.address,
          order.buyerName,
          order.buyerContact
        ], query);
      });
      const stats = ownerSalesStats(accountingOrders);
      const paymentRows = ownerSalesBreakdown(accountingOrders);
      const itemRows = ownerItemSalesRows(accountingOrders).slice(0, 8);
      const settledOrders = accountingOrders.filter(function (order) {
        const status = normalizedOrderStatus(order);
        return status === "paid" || status === "completed";
      }).slice(0, 8);
      bodyMarkup = '' +
        '<section class="shop-owner-form shop-owner-accounting">' +
          '<div class="shop-owner-form-head">' +
            '<strong>Sales accounting</strong>' +
            '<span>' + escapeHtml(accountingOrders.length ? (accountingOrders.length + " orders counted") : "No orders counted") + '</span>' +
          '</div>' +
          '<div class="shop-owner-accounting-grid">' +
            '<article class="shop-owner-accounting-card is-wide">' +
              '<span>Collected</span>' +
              '<strong>' + escapeHtml(ownerAccountingAmount(stats.revenue, detail)) + '</strong>' +
            '</article>' +
            '<article class="shop-owner-accounting-card">' +
              '<span>Open</span>' +
              '<strong>' + escapeHtml(ownerAccountingAmount(stats.openValue, detail)) + '</strong>' +
            '</article>' +
            '<article class="shop-owner-accounting-card">' +
              '<span>Today</span>' +
              '<strong>' + escapeHtml(ownerAccountingAmount(stats.todayValue, detail)) + '</strong>' +
            '</article>' +
            '<article class="shop-owner-accounting-card">' +
              '<span>Settled</span>' +
              '<strong>' + escapeHtml(String(stats.settledOrders)) + '</strong>' +
            '</article>' +
            '<article class="shop-owner-accounting-card">' +
              '<span>Pending</span>' +
              '<strong>' + escapeHtml(String(stats.pendingOrders + stats.acceptedOrders + stats.readyOrders)) + '</strong>' +
            '</article>' +
          '</div>' +
        '</section>' +
        '<section class="shop-owner-form shop-owner-accounting">' +
          '<div class="shop-owner-form-head">' +
            '<strong>Payment split</strong>' +
            '<span>' + escapeHtml(paymentRows.length ? "By collection method" : "No payments yet") + '</span>' +
          '</div>' +
          (paymentRows.length ? (
            '<div class="shop-owner-accounting-list">' +
              paymentRows.map(function (row) {
                return '' +
                  '<div class="shop-owner-accounting-row">' +
                    '<span>' + escapeHtml(row.label) + '</span>' +
                    '<strong>' + escapeHtml(ownerAccountingAmount(row.amount, detail)) + '</strong>' +
                    '<em>' + escapeHtml(row.orders + " order" + (row.orders === 1 ? "" : "s")) + '</em>' +
                  '</div>';
              }).join('') +
            '</div>'
          ) : '<div class="shop-list-empty">Payments will show here after orders are saved.</div>') +
        '</section>' +
        '<section class="shop-owner-form shop-owner-accounting">' +
          '<div class="shop-owner-form-head">' +
            '<strong>Item movement</strong>' +
            '<span>' + escapeHtml(itemRows.length ? "Top sold items" : "No items sold yet") + '</span>' +
          '</div>' +
          (itemRows.length ? (
            '<div class="shop-owner-accounting-list">' +
              itemRows.map(function (row) {
                return '' +
                  '<div class="shop-owner-accounting-row">' +
                    '<span>' + escapeHtml(row.title) + '</span>' +
                    '<strong>' + escapeHtml(ownerAccountingAmount(row.amount, detail)) + '</strong>' +
                    '<em>' + escapeHtml("x" + row.quantity) + '</em>' +
                  '</div>';
              }).join('') +
            '</div>'
          ) : '<div class="shop-list-empty">Sold item totals will appear here.</div>') +
        '</section>' +
        '<section class="shop-owner-form shop-owner-accounting">' +
          '<div class="shop-owner-form-head">' +
            '<strong>Settled orders</strong>' +
            '<span>' + escapeHtml(settledOrders.length ? (settledOrders.length + " recent") : "None settled yet") + '</span>' +
          '</div>' +
          (settledOrders.length ? (
            '<div class="shop-owner-accounting-list">' +
              settledOrders.map(function (order) {
                return '' +
                  '<button class="shop-owner-accounting-row is-button" type="button" data-owner-history-section="orders">' +
                    '<span>' + escapeHtml(String(order.title || order.id || "Order")) + '</span>' +
                    '<strong>' + escapeHtml(ownerAccountingAmount(orderAmountValue(order), detail)) + '</strong>' +
                    '<em>' + escapeHtml(formatOrderTimestamp(order.timestamp || 0)) + '</em>' +
                  '</button>';
              }).join('') +
            '</div>'
          ) : '<div class="shop-list-empty">Complete or mark orders paid to settle them.</div>') +
        '</section>';
    } else if (section === "items") {
      const visibleItems = listings.filter(function (item) {
        return matchesSearch([item.title, item.description, item.price, item.id], query);
      });
      const libraryItems = (Array.isArray(state.itemLibrary) ? state.itemLibrary : []).filter(function (item) {
        return String(item && item.shopId || "").trim() !== String(state.activeShopId || "").trim()
          && matchesSearch([item.title, item.description, item.shopName, item.shopId, item.price], query);
      }).slice(0, 40);
      bodyMarkup = '' +
        '<section class="shop-owner-form" data-owner-form="item">' +
          '<div class="shop-owner-form-head">' +
            '<strong>Add item</strong>' +
            '<span>Create a new listing for this shop.</span>' +
          '</div>' +
          '<div class="shop-owner-grid">' +
            '<label class="shop-owner-field"><span>Item name</span><input class="shop-owner-input" name="title" placeholder="Kitkat" /></label>' +
            '<label class="shop-owner-field"><span>Price</span><input class="shop-owner-input" name="price" type="number" min="0" step="0.01" inputmode="decimal" placeholder="20" /></label>' +
            '<label class="shop-owner-field"><span>Qty</span><input class="shop-owner-input" name="quantity" type="number" min="0" step="1" placeholder="12" /></label>' +
            '<label class="shop-owner-field shop-owner-field-wide shop-owner-description-field"><span>Description</span><textarea class="shop-owner-textarea" name="description" rows="3" placeholder="Quick note for buyers"></textarea></label>' +
          '</div>' +
          '<div class="shop-owner-action-row">' +
            '<button class="shop-owner-save" type="button" data-owner-save="item">Add item</button>' +
          '</div>' +
        '</section>' +
        '<section class="shop-owner-form">' +
          '<div class="shop-owner-form-head">' +
            '<strong>Your inventory</strong>' +
            '<span>' + escapeHtml(listings.length ? "Tap an item to edit it below" : "No items saved yet") + '</span>' +
          '</div>' +
          '<div class="shop-owner-item-list">' +
            (visibleItems.length ? (
              '<div class="shop-owner-item-picker">' +
                visibleItems.map(function (item) {
                  const itemId = String(item.id || "").trim();
                  const isSelected = !!(selectedItem && itemId === String(selectedItem.id || "").trim());
                  return '' +
                    '<button class="shop-owner-item-select' + (isSelected ? ' is-selected' : '') + '" type="button" data-owner-item-select="' + escapeHtml(itemId) + '">' +
                      '<span class="shop-owner-item-select-row">' +
                        ownerItemPreviewMarkup(item, "is-mini") +
                        '<span class="shop-owner-item-select-copy">' +
                          '<strong>' + escapeHtml(item.title || "Item") + '</strong>' +
                          '<span>' + escapeHtml((item.price ? formatPrice(item.price, detail && detail.pricing) + ' • ' : '') + 'Qty ' + Math.max(0, Number(item.quantity || 0))) + '</span>' +
                        '</span>' +
                        '<span class="shop-owner-item-select-action">' + escapeHtml(isSelected ? "Editing" : "Tap to edit") + '</span>' +
                      '</span>' +
                    '</button>';
                }).join('') +
              '</div>'
            ) : '<div class="shop-list-empty">' + escapeHtml(query ? "No items match this search." : "No items yet.") + '</div>') +
            ownerSelectedItemEditorMarkup(selectedItem) +
          '</div>' +
        '</section>' +
        '<section class="shop-owner-form">' +
          '<div class="shop-owner-form-head">' +
            '<strong>Local item library</strong>' +
            '<span>Reuse listings already saved in the local server DB.</span>' +
          '</div>' +
          (state.itemLibraryLoading
            ? '<div class="shop-list-empty">Loading saved items...</div>'
            : state.itemLibraryError
            ? '<div class="shop-pane-notice is-error">' + escapeHtml(state.itemLibraryError) + '</div>'
            : libraryItems.length
            ? (
              '<div class="shop-owner-library-grid">' +
                libraryItems.map(function (item) {
                  return '' +
                    '<article class="shop-owner-library-card">' +
                      '<div class="shop-owner-library-head">' +
                        ownerItemPreviewMarkup(item, "is-library") +
                        '<div class="shop-owner-library-copy">' +
                          '<strong>' + escapeHtml(item.title || "Item") + '</strong>' +
                          '<span>' + escapeHtml((item.shopName || item.shopId || "Shop") + ' • @' + (item.shopId || "")) + '</span>' +
                        '</div>' +
                      '</div>' +
                      '<p>' + escapeHtml(item.description || "Ready to import into this shop.") + '</p>' +
                      '<div class="shop-owner-library-meta">' +
                        '<span>' + escapeHtml(formatPrice(item.price, detail && detail.pricing) || "Not set") + '</span>' +
                        '<span>' + escapeHtml("Qty " + Math.max(0, Number(item.quantity || 0))) + '</span>' +
                      '</div>' +
                      '<button class="shop-owner-save" type="button" data-owner-library-import="' + escapeHtml(item.libraryId || "") + '">Import item</button>' +
                    '</article>';
                }).join('') +
              '</div>'
            )
            : '<div class="shop-list-empty">' + escapeHtml(query ? "No library items match this search." : "No reusable items found in the local DB yet.") + '</div>') +
        '</section>';
    }

    return '' +
      '<section class="shop-owner-stack">' +
        ownerStatusMarkup(state) +
        ownerManageSummaryMarkup(state, detail, consoleData, sectionLabel) +
        historyTabsMarkup +
        bodyMarkup +
      '</section>';
  }

  function saveOwnerConsole(state, shopId, consoleData, successMessage) {
    if (!state || !shopId || !consoleData) return Promise.resolve();
    state.ownerPanel.saving = true;
    state.ownerPanel.message = "Saving...";
    state.ownerPanel.tone = "";
    syncActionButton(state);
    renderShopList(state);
    return window.fetch("/api/shops/" + encodeURIComponent(shopId) + "/console", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ console: consoleData })
    }).then(function (response) {
      return parseJson(response).then(function (payload) {
        if (!response.ok) {
          throw new Error(String(payload && payload.error || "save_failed"));
        }
        applyConsoleRecord(state, shopId, payload);
        state.ownerPanel.saving = false;
        state.ownerPanel.message = successMessage;
        state.ownerPanel.tone = "success";
        refreshItemLibrary(state, { force: true, silent: true });
        syncActionButton(state);
        renderShopList(state);
        if (state.activeShopId === shopId) {
          focusShopOnMap(state, state.shopById[shopId]);
        } else {
          updateMapView(state);
        }
      });
    }).catch(function () {
      state.ownerPanel.saving = false;
      state.ownerPanel.message = "Could not save.";
      state.ownerPanel.tone = "error";
      syncActionButton(state);
      renderShopList(state);
    });
  }

  function submitOwnerProfile(state, form) {
    if (!(form instanceof HTMLFormElement) || !state.activeShopId) return;
    const consoleData = ensureShopConsole(state, state.activeShopId);
    const profile = consoleData.profile || {};
    const hoursLegacyField = form.elements.hoursLegacy;
    const hoursOpen = String((form.elements.hoursOpen && form.elements.hoursOpen.value) || "").trim();
    const hoursClose = String((form.elements.hoursClose && form.elements.hoursClose.value) || "").trim();
    const hoursValue = serializeHoursRange(hoursOpen, hoursClose);
    const hoursLegacy = String((hoursLegacyField && hoursLegacyField.value) || "").trim();
    const hoursParsed = !!(hoursLegacyField && String(hoursLegacyField.getAttribute("data-hours-parsed") || "").trim() === "true");
    profile.name = String((form.elements.name && form.elements.name.value) || "").trim();
    profile.type = String((form.elements.type && form.elements.type.value) || "").trim();
    profile.location = String((form.elements.location && form.elements.location.value) || "").trim();
    profile.contact = String((form.elements.contact && form.elements.contact.value) || "").trim();
    profile.hours = hoursValue || (hoursParsed ? "" : hoursLegacy);
    profile.notes = String((form.elements.notes && form.elements.notes.value) || "").trim();
    profile.currencyPrefix = String((form.elements.currencyPrefix && form.elements.currencyPrefix.value) || "").trim();
    profile.gps = String((form.elements.gps && form.elements.gps.value) || "").trim();
    consoleData.profile = profile;
    saveOwnerConsole(state, state.activeShopId, consoleData, "Shop updated.");
  }

  function ownerFieldValue(container, name) {
    if (!(container instanceof Element) || !name) return "";
    const field = container.querySelector('[name="' + String(name) + '"]');
    return String(field && "value" in field ? field.value : "").trim();
  }

  function submitOwnerItem(state, form) {
    if (!(form instanceof Element) || !state.activeShopId) return;
    const title = ownerFieldValue(form, "title");
    if (!title) {
      state.ownerPanel.message = "Enter an item name.";
      state.ownerPanel.tone = "error";
      renderShopList(state);
      return;
    }
    const consoleData = ensureShopConsole(state, state.activeShopId);
    const listings = Array.isArray(consoleData.listings) ? consoleData.listings.slice() : [];
    const newItemId = slugify(title) + "-" + Date.now().toString(36);
    listings.unshift({
      id: newItemId,
      title: title,
      description: ownerFieldValue(form, "description"),
      price: ownerFieldValue(form, "price"),
      quantity: Math.max(0, Number(ownerFieldValue(form, "quantity") || 0)),
      imageFiles: [],
      createdAt: Date.now()
    });
    state.ownerPanel.itemId = newItemId;
    consoleData.listings = listings;
    saveOwnerConsole(state, state.activeShopId, consoleData, "Item added.");
  }

  function submitOwnerItemUpdate(state, itemId, container) {
    if (!state || !state.activeShopId || !itemId || !(container instanceof Element)) return;
    const consoleData = ensureShopConsole(state, state.activeShopId);
    const listings = Array.isArray(consoleData.listings) ? consoleData.listings.slice() : [];
    const index = listings.findIndex(function (item) {
      return String(item && item.id || "").trim() === itemId;
    });
    if (index < 0) return;
    const titleNode = container.querySelector('[data-owner-item-field="title"]');
    const priceNode = container.querySelector('[data-owner-item-field="price"]');
    const quantityNode = container.querySelector('[data-owner-item-field="quantity"]');
    const descriptionNode = container.querySelector('[data-owner-item-field="description"]');
    const title = String(titleNode && titleNode.value || "").trim();
    if (!title) {
      state.ownerPanel.message = "Enter an item name.";
      state.ownerPanel.tone = "error";
      renderShopList(state);
      return;
    }
    listings[index] = Object.assign({}, listings[index], {
      title: title,
      price: String(priceNode && priceNode.value || "").trim(),
      quantity: Math.max(0, Number(quantityNode && quantityNode.value || 0)),
      description: String(descriptionNode && descriptionNode.value || "").trim()
    });
    consoleData.listings = listings;
    saveOwnerConsole(state, state.activeShopId, consoleData, "Item updated.");
  }

  function submitOwnerItemRemove(state, itemId) {
    if (!state || !state.activeShopId || !itemId) return;
    const consoleData = ensureShopConsole(state, state.activeShopId);
    const listings = Array.isArray(consoleData.listings) ? consoleData.listings.slice() : [];
    const nextListings = listings.filter(function (item) {
      return String(item && item.id || "").trim() !== itemId;
    });
    state.ownerPanel.itemId = nextListings.length ? String(nextListings[0].id || "").trim() : "";
    consoleData.listings = nextListings;
    saveOwnerConsole(state, state.activeShopId, consoleData, "Item removed.");
  }

  function submitOwnerPayments(state, form) {
    if (!(form instanceof HTMLFormElement) || !state.activeShopId) return;
    const details = String((form.elements.details && form.elements.details.value) || "").trim();
    const consoleData = ensureShopConsole(state, state.activeShopId);
    const existingPayments = Array.isArray(consoleData && consoleData.payments) ? consoleData.payments : [];
    const qrFile = paymentQrFileFromPayments(existingPayments);
    const payments = [];
    const upiId = String((form.elements.upiId && form.elements.upiId.value) || "").trim();
    const btcAddress = String((form.elements.btcAddress && form.elements.btcAddress.value) || "").trim();
    const ethAddress = String((form.elements.ethAddress && form.elements.ethAddress.value) || "").trim();
    if (upiId || qrFile) payments.push({ id: "upi-" + Date.now().toString(36), label: "UPI", details: details, upiId: upiId, btcAddress: "", ethAddress: "", qrFile: qrFile, createdAt: Date.now() });
    if (btcAddress) payments.push({ id: "btc-" + Date.now().toString(36), label: "BTC", details: details, upiId: "", btcAddress: btcAddress, ethAddress: "", createdAt: Date.now() });
    if (ethAddress) payments.push({ id: "eth-" + Date.now().toString(36), label: "ETH", details: details, upiId: "", btcAddress: "", ethAddress: ethAddress, createdAt: Date.now() });
    consoleData.payments = payments;
    saveOwnerConsole(state, state.activeShopId, consoleData, "Payments updated.");
  }

  function importOwnerLibraryItem(state, libraryId) {
    if (!state || !state.activeShopId || !libraryId) return;
    const libraryItems = Array.isArray(state.itemLibrary) ? state.itemLibrary : [];
    const sourceItem = libraryItems.find(function (item) {
      return String(item && item.libraryId || "").trim() === String(libraryId || "").trim();
    }) || null;
    if (!sourceItem) {
      state.ownerPanel.message = "Item library entry not found.";
      state.ownerPanel.tone = "error";
      renderShopList(state);
      return;
    }
    const consoleData = ensureShopConsole(state, state.activeShopId);
    const listings = Array.isArray(consoleData.listings) ? consoleData.listings.slice() : [];
    const newItemId = slugify(sourceItem.title || "item") + "-" + Date.now().toString(36);
    listings.unshift({
      id: newItemId,
      title: String(sourceItem.title || "").trim(),
      description: String(sourceItem.description || "").trim(),
      price: String(sourceItem.price || "").trim(),
      quantity: Math.max(0, Number(sourceItem.quantity || 0)),
      imageFiles: Array.isArray(sourceItem.imageFiles) ? sourceItem.imageFiles.slice(0, 8) : [],
      createdAt: Date.now()
    });
    state.ownerPanel.itemId = newItemId;
    consoleData.listings = listings;
    saveOwnerConsole(state, state.activeShopId, consoleData, "Item imported.");
  }

  function submitOwnerWalkInOrder(state) {
    if (!state || !state.activeShopId) return;
    const detail = state.shopDetails[state.activeShopId] || shopDetailFromPreview(state.shopById[state.activeShopId]);
    if (!detail) return;
    const draft = ownerOrderDraft(state, state.activeShopId);
    const items = ownerDraftItems(detail, draft);
    if (!items.length) {
      state.ownerPanel.message = "Select at least one item.";
      state.ownerPanel.tone = "error";
      renderShopList(state);
      return;
    }
    const totalAmount = items.reduce(function (sum, item) {
      return sum + Number(item.total || 0);
    }, 0);
    const paymentEntries = payablePaymentEntries(detail, totalAmount);
    const paymentMode = String(draft.paymentMode || "").trim().toLowerCase() === "before_delivery"
      ? "before_delivery"
      : "on_receive";
    const chosenPayment = paymentMode === "before_delivery" ? (paymentEntries[0] || null) : null;
    const firstItem = items[0] || null;
    let title = firstItem ? String(firstItem.title || "").trim() : "Walk-in order";
    if (firstItem && items.length > 1) {
      title += " +" + (items.length - 1);
    }
    const payload = {
      buyer_key: "walkin-" + createClientNonce(),
      buyer_name: String(draft.buyerName || "").trim(),
      buyer_contact: String(draft.buyerContact || "").trim(),
      payment_label: chosenPayment ? String(chosenPayment.label || "").trim() : "Walk-in",
      payment_value: chosenPayment ? String(chosenPayment.value || "").trim() : "",
      payment_mode: paymentMode,
      notes: String(draft.notes || "").trim() || "Walk-in order",
      address: "Walk-in",
      item_id: String(firstItem && firstItem.id || "").trim(),
      title: title || "Walk-in order",
      total: formatTotalAmount(totalAmount, detail.pricing) || String(totalAmount || ""),
      price: String(firstItem && firstItem.price || "").trim(),
      quantity: items.reduce(function (sum, item) {
        return sum + Math.max(0, Number(item.quantity || 0));
      }, 0),
      client_nonce: createClientNonce(),
      items: items.map(function (item) {
        const display = cartDisplayItem(detail, item);
        return {
          id: display.id,
          title: display.title,
          description: display.description,
          quantity: Math.max(0, Number(item.quantity || 0)),
          price: formatPrice(item.price, detail && detail.pricing),
          image: display.image
        };
      })
    };
    state.ownerPanel.saving = true;
    state.ownerPanel.message = "Starting order...";
    state.ownerPanel.tone = "";
    renderShopList(state);
    createShopOrder(state.activeShopId, payload)
      .then(function (result) {
        if (!result || !result.ok) {
          throw new Error(String(result && result.payload && result.payload.error || "owner_order_create_failed"));
        }
        clearOwnerOrderDraft(state, state.activeShopId);
        state.ownerPanel.saving = false;
        state.ownerPanel.message = "Order started.";
        state.ownerPanel.tone = "success";
        state.ownerPanel.orderDraftOpen = false;
        return refreshShopConsole(state, state.activeShopId, { preserveScroll: true });
      })
      .then(function () {
        renderShopList(state);
      })
      .catch(function () {
        state.ownerPanel.saving = false;
        state.ownerPanel.message = "Could not start the order.";
        state.ownerPanel.tone = "error";
        renderShopList(state);
      });
  }

  function submitOwnerOrderAction(state, orderId, nextStatus) {
    if (!state || !state.activeShopId || !orderId || !nextStatus) return;
    const stableNextStatus = stableOrderStatus(nextStatus);
    if (!stableNextStatus) return;
    const consoleData = ensureShopConsole(state, state.activeShopId);
    const orders = Array.isArray(consoleData.orders) ? consoleData.orders.slice() : [];
    const index = orders.findIndex(function (item) {
      return String(item && item.id || "").trim() === orderId;
    });
    if (index < 0) return;
    if (stableNextStatus === "cancelled" && !canOwnerCancelOrder(orders[index])) return;
    const flags = orderStatusFlags(orders[index], stableNextStatus);
    orders[index] = Object.assign({}, orders[index], {
      status: stableNextStatus,
      statusUpdatedAt: Date.now(),
      cancelledAt: stableNextStatus === "cancelled" ? Date.now() : orders[index].cancelledAt,
      paymentPaid: flags.paymentPaid,
      paymentReceived: flags.paymentReceived,
      orderSent: flags.orderSent,
      orderReceived: flags.orderReceived
    });
    consoleData.orders = orders;
    saveOwnerConsole(state, state.activeShopId, consoleData, "Order updated.");
  }

  function mergeBuyerOrderUpdate(state, updatedOrder) {
    if (!state || !updatedOrder) return;
    const orderId = String(updatedOrder.id || "").trim();
    const shopId = String(updatedOrder.shopId || "").trim();
    if (!orderId) return;
    let orders = Array.isArray(state.buyerOrders) ? state.buyerOrders.slice() : [];
    let matched = false;
    orders = orders.map(function (order) {
      const sameOrder = String(order && order.id || "").trim() === orderId;
      const sameShop = !shopId || String(order && order.shopId || "").trim() === shopId;
      if (!sameOrder || !sameShop) return order;
      matched = true;
      return Object.assign({}, order, updatedOrder);
    });
    if (!matched) {
      orders.unshift(updatedOrder);
    }
    state.buyerOrders = orders;
    if (state.activeShopId) {
      const confirmation = orderConfirmation(state, state.activeShopId);
      if (confirmation && confirmation.order && String(confirmation.order.id || "").trim() === orderId) {
        setOrderConfirmation(state, state.activeShopId, Object.assign({}, confirmation, {
          order: Object.assign({}, confirmation.order, updatedOrder)
        }));
      }
    }
  }

  function submitBuyerOrderCancel(state, shopId, orderId) {
    if (!state || !shopId || !orderId) return;
    if (!window.confirm("Cancel this order?")) return;
    state.buyerOrdersError = "";
    cancelBuyerOrder(shopId, orderId, ensureBuyerKey())
      .then(function (result) {
        if (!result || !result.ok) {
          const error = String(result && result.payload && result.payload.error || "").trim();
          let message = "Could not cancel this order.";
          if (error === "order_cannot_cancel") {
            message = "This order cannot be cancelled now.";
          } else if (error === "order_not_found") {
            message = "Order not found.";
          }
          throw new Error(message);
        }
        mergeBuyerOrderUpdate(state, result.payload && result.payload.order);
        renderShopList(state);
        refreshBuyerOrders(state, { force: true });
      })
      .catch(function (error) {
        state.buyerOrdersError = String(error && error.message || "Could not cancel this order.");
        renderShopList(state);
      });
  }

  function normalizePaymentEntries(payments) {
    if (!Array.isArray(payments)) return [];
    return payments.map(function (item) {
      if (item && typeof item === "object") {
        let label = String(item.label || item.method || "").trim();
        const value = String(item.value || item.address || item.upiId || item.btcAddress || item.ethAddress || "").trim();
        const note = String(item.note || item.details || "").trim();
        if (!label && value) label = "Payment";
        return { label: label, value: value, note: note };
      }
      const labelText = String(item || "").trim();
      return { label: labelText, value: "", note: "" };
    }).filter(function (item) {
      return item.label || item.value;
    });
  }

  function normalizeSearch(text) {
    return String(text || "").trim().toLowerCase();
  }

  function resolveAddress(lat, lng) {
    return window.fetch("/api/geocode/reverse?lat=" + encodeURIComponent(String(lat)) + "&lng=" + encodeURIComponent(String(lng)), {
      cache: "no-store",
      credentials: "same-origin"
    }).then(function (response) {
      return parseJson(response).then(function (payload) {
        if (!response.ok) return "";
        return String(payload && payload.address || "").trim();
      });
    }).catch(function () {
      return "";
    });
  }

  function destroyOwnerPickupMap(state) {
    if (!state) return;
    if (state.ownerPickupMap) {
      state.ownerPickupMap.remove();
    }
    state.ownerPickupMap = null;
    state.ownerPickupMarker = null;
    state.ownerPickupNode = null;
    state.ownerPickupForm = null;
  }

  function updateOwnerPickupSummary(form, text) {
    if (!(form instanceof HTMLFormElement)) return;
    const node = form.querySelector("#ownerPickupSummary");
    if (node) {
      node.textContent = String(text || "").trim() || "No pickup point set";
    }
  }

  function setOwnerPickupPoint(state, form, lat, lng, options) {
    if (!state || !(form instanceof HTMLFormElement) || !isFinite(lat) || !isFinite(lng)) return;
    const gpsInput = form.elements.gps;
    if (!(gpsInput instanceof HTMLInputElement)) return;
    const point = [Number(lat), Number(lng)];
    gpsInput.value = formatGpsValue(point[0], point[1]);
    if (state.ownerPickupMarker) {
      state.ownerPickupMarker.setLatLng(point);
    }
    if (state.ownerPickupMap) {
      state.ownerPickupMap.setView(point, Math.max(state.ownerPickupMap.getZoom(), 17), { animate: false });
    }
    updateOwnerPickupSummary(form, point[0].toFixed(5) + ", " + point[1].toFixed(5));
    const preserveLocation = options && options.preserveLocation;
    if (preserveLocation) return;
    resolveAddress(point[0], point[1]).then(function (address) {
      if (!form.isConnected) return;
      if (address && form.elements.location) {
        form.elements.location.value = address;
      }
      updateOwnerPickupSummary(form, address || (point[0].toFixed(5) + ", " + point[1].toFixed(5)));
    });
  }

  function ensureOwnerPickupMap(state) {
    if (!state || !window.L) return;
    const form = state.listNode && state.listNode.querySelector('form[data-owner-form="profile"]');
    const mapNode = state.listNode && state.listNode.querySelector("#ownerPickupMap");
    if (!(form instanceof HTMLFormElement) || !(mapNode instanceof HTMLElement)) {
      destroyOwnerPickupMap(state);
      return;
    }
    if (state.ownerPickupNode === mapNode && state.ownerPickupMap) {
      window.setTimeout(function () {
        if (state.ownerPickupMap) state.ownerPickupMap.invalidateSize();
      }, 40);
      return;
    }
    destroyOwnerPickupMap(state);
    state.ownerPickupNode = mapNode;
    state.ownerPickupForm = form;
    const gps = parseGpsValue(form.elements.gps && form.elements.gps.value);
    const shop = state.activeShopId ? state.shopById[state.activeShopId] : null;
    const startPoint = gps
      || (shop && shop.has_location && isFinite(shop.lat) && isFinite(shop.lng) ? [shop.lat, shop.lng] : null)
      || (state.userPoint ? state.userPoint.slice() : null)
      || (state.map ? [state.map.getCenter().lat, state.map.getCenter().lng] : [22.9734, 78.6569]);
    const miniMap = window.L.map(mapNode, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: true,
      boxZoom: false,
      keyboard: false,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false
    });
    installReliableBaseLayer(miniMap);
    miniMap.setView(startPoint, gps ? 17 : 15);
    const marker = window.L.marker(startPoint, {
      draggable: true,
      icon: window.L.divIcon({
        className: "",
        html: '<div class="map-shop-marker map-shop-marker-owner" style="--shop-color:' + escapeHtml(shopColor(shop || {})) + ';"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      })
    }).addTo(miniMap);
    state.ownerPickupMap = miniMap;
    state.ownerPickupMarker = marker;
    setOwnerPickupPoint(state, form, startPoint[0], startPoint[1], { preserveLocation: !!(form.elements.location && form.elements.location.value) });
    miniMap.on("click", function (event) {
      if (!event || !event.latlng) return;
      setOwnerPickupPoint(state, form, event.latlng.lat, event.latlng.lng);
    });
    marker.on("dragend", function () {
      const latlng = marker.getLatLng();
      setOwnerPickupPoint(state, form, latlng.lat, latlng.lng);
    });
    window.setTimeout(function () {
      if (!state.ownerPickupMap) return;
      state.ownerPickupMap.invalidateSize();
      state.ownerPickupMap.setView(startPoint, gps ? 17 : 15, { animate: false });
    }, 40);
  }

  function matchesSearch(parts, query) {
    const needle = normalizeSearch(query);
    if (!needle) return true;
    return parts.some(function (part) {
      return normalizeSearch(part).indexOf(needle) !== -1;
    });
  }

  function shopDetailFromPreview(shop) {
    const preview = shop && shop.preview;
    if (!preview || typeof preview !== "object") return null;
    return {
      name: String(shop.display_name || shop.shop_id || "").trim(),
      type: String(preview.type || "Store").trim(),
      note: String(preview.note || "").trim(),
      contact: String(preview.contact || "").trim(),
      location: String(shop.location_label || "").trim(),
      hours: String(preview.hours || "").trim(),
      logoFile: String(preview.logoFile || preview.logo_file || "").trim(),
      pricing: normalizePricing(preview.pricing),
      paymentEntries: normalizePaymentEntries(preview.payments),
      payments: normalizePaymentEntries(preview.payments).map(function (item) { return item.label; }).filter(Boolean),
      items: Array.isArray(preview.items) ? preview.items.map(function (item) {
        return {
          id: String(item.id || "").trim(),
          title: String(item.title || "").trim(),
          description: String(item.description || "").trim(),
          price: String(item.price || "").trim(),
          quantity: Number(item.quantity || 0)
        };
      }).filter(function (item) {
        return item.title;
      }) : []
    };
  }

  function shopDetailFromRecord(shop, record) {
    const consoleData = record && record.console && typeof record.console === "object" ? record.console : {};
    const profile = consoleData.profile && typeof consoleData.profile === "object" ? consoleData.profile : {};
    const listings = Array.isArray(consoleData.listings) ? consoleData.listings : [];
    const payments = Array.isArray(consoleData.payments) ? consoleData.payments : [];
    const paymentEntries = [];

    payments.forEach(function (payment) {
      const label = String(payment.label || "").trim();
      const details = String(payment.details || "").trim();
      const upiId = String(payment.upiId || "").trim();
      const btcAddress = String(payment.btcAddress || "").trim();
      const ethAddress = String(payment.ethAddress || "").trim();
      const qrFile = paymentQrFile(payment);
      if (upiId || qrFile) paymentEntries.push({ label: "UPI", value: upiId, note: details || label || "Pay on UPI", qrFile: qrFile });
      if (btcAddress) paymentEntries.push({ label: "BTC", value: btcAddress, note: details || label || "Bitcoin address" });
      if (ethAddress) paymentEntries.push({ label: "ETH", value: ethAddress, note: details || label || "Ethereum address" });
      if (!upiId && !btcAddress && !ethAddress && !qrFile && (label || details)) {
        paymentEntries.push({ label: label || "Payment", value: details, note: "" });
      }
    });

    return {
      name: String(profile.name || shop.display_name || shop.shop_id || "").trim(),
      type: String(profile.type || "Store").trim(),
      note: String(profile.notes || "").trim(),
      contact: String(profile.contact || "").trim(),
      location: String(profile.location || shop.location_label || "").trim(),
      hours: String(profile.hours || "").trim(),
      logoFile: String(profile.logoFile || "").trim(),
      pricing: normalizePricing({
        prefix: profile.currencyPrefix,
        suffix: profile.currencySuffix,
        decimals: profile.currencyDecimals
      }),
      paymentEntries: paymentEntries,
      payments: paymentEntries.map(function (item) { return item.label; }).filter(Boolean),
      items: listings.map(function (item) {
        return {
          id: String(item.id || "").trim(),
          title: String(item.title || "").trim(),
          description: String(item.description || "").trim(),
          price: String(item.price || "").trim(),
          quantity: Number(item.quantity || 0),
          imageFiles: Array.isArray(item.imageFiles) ? item.imageFiles.slice(0, 8).map(function (fileName) {
            return String(fileName || "").trim();
          }).filter(Boolean) : [],
          createdAt: Math.max(0, Number(item.createdAt || 0))
        };
      }).filter(function (item) {
        return item.title;
      })
    };
  }

  function buildPaymentHref(payment, detail, amountNumber) {
    if (!payment || typeof payment !== "object") return "";
    const label = String(payment.label || "").trim().toUpperCase();
    const value = String(payment.value || "").trim();
    if (!value) return "";
    const amount = Number(amountNumber || 0);
    const currencyCode = pricingCurrencyCode(detail && detail.pricing);
    const shopName = String(detail && detail.name || "").trim();
    if (label === "UPI") {
      const upi = new URLSearchParams();
      upi.set("pa", value);
      if (shopName) upi.set("pn", shopName);
      if (isFinite(amount) && amount > 0) {
        upi.set("am", amount.toFixed(2).replace(/\.?0+$/, ""));
        upi.set("cu", "INR");
      }
      return "upi://pay?" + upi.toString();
    }
    if (label === "BTC") {
      let btc = "bitcoin:" + value;
      if (amount > 0 && currencyCode === "BTC") {
        btc += "?amount=" + encodeURIComponent(String(amount));
      }
      return btc;
    }
    if (label === "ETH") {
      return "ethereum:" + value;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
      return value;
    }
    if (/^https?:\/\//i.test(value)) {
      return value;
    }
    return "";
  }

  function canUsePaymentEntry(payment, detail, amountNumber) {
    return !!paymentQrFile(payment) || !!buildPaymentHref(payment, detail, amountNumber || 1);
  }

  function payablePaymentEntries(detail, amountNumber) {
    const entries = Array.isArray(detail && detail.paymentEntries) ? detail.paymentEntries : [];
    return entries.filter(function (payment) {
      return canUsePaymentEntry(payment, detail, amountNumber || 1);
    });
  }

  function effectivePaymentMode(state, shopId, paymentEntries) {
    if (!Array.isArray(paymentEntries) || !paymentEntries.length) return "on_receive";
    return selectedPaymentMode(state, shopId) === "before_delivery" ? "before_delivery" : "on_receive";
  }

  function detailItemForCartItem(detail, item) {
    const itemId = String(item && item.id || "").trim();
    const items = Array.isArray(detail && detail.items) ? detail.items : [];
    if (!itemId || !items.length) return null;
    return items.find(function (candidate) {
      return String(candidate && candidate.id || "").trim() === itemId;
    }) || null;
  }

  function cartDisplayItem(detail, item) {
    const source = detailItemForCartItem(detail, item) || {};
    const imageFiles = Array.isArray(source.imageFiles)
      ? source.imageFiles
      : (Array.isArray(item && item.imageFiles) ? item.imageFiles : []);
    const firstImage = String(imageFiles[0] || item && item.image || "").trim();
    const quantity = Math.max(0, Number(item && item.quantity || 0));
    const price = String(item && item.price || source.price || "").trim();
    const formattedPrice = formatPrice(price, detail && detail.pricing);
    const sourceQuantity = Math.max(0, Number(source.quantity || 0));
    return {
      id: String(item && item.id || source.id || "").trim(),
      title: String(item && item.title || source.title || "Item").trim(),
      description: String(source.description || item && item.description || "Available now.").trim(),
      quantity: quantity,
      stockQuantity: sourceQuantity,
      rawPrice: price,
      price: formattedPrice || price || "Not set",
      lineTotal: item && item.total != null ? formatTotalAmount(item.total, detail && detail.pricing) : "",
      stock: sourceQuantity > 0 ? ("Qty " + sourceQuantity) : "Available",
      imageFiles: firstImage ? [firstImage] : []
    };
  }

  function cartDisplayRowMarkup(state, detail, item, options) {
    const settings = options && typeof options === "object" ? options : {};
    const display = cartDisplayItem(detail, item);
    const quantityLabel = display.quantity > 0 ? ("x" + display.quantity) : "";
    const totalLabel = display.lineTotal || display.price || "";
    const showLineTotal = !!(display.lineTotal && display.lineTotal !== display.price);
    const metaParts = [display.price, quantityLabel, showLineTotal ? totalLabel : "", display.stock].filter(Boolean);
    const shopId = String(settings.shopId || state && state.activeShopId || "").trim();
    const shop = settings.shop || state && state.shopById && state.shopById[shopId] || {};
    const cartCardItem = {
      id: display.id,
      title: display.title,
      description: display.description,
      price: display.rawPrice || display.price,
      quantity: display.stockQuantity,
      imageFiles: display.imageFiles
    };
    return shopItemCardMarkup(state, detail, cartCardItem, shop, {
      shopId: shopId,
      itemId: display.id,
      shopName: String(settings.shopName || detail && detail.name || shop && (shop.display_name || shop.shop_id) || shopId || "Shop").trim(),
      openShop: false,
      disableTouchAdd: true,
      cardClass: "shop-cart-list-card",
      thumbClass: "shop-cart-thumb",
      cardAttrs: ' data-cart-item-id="' + escapeHtml(display.id) + '"',
      selectedQty: display.quantity,
      priceLabel: display.price,
      stockLabel: display.stock,
      subtitle: metaParts.join(" · "),
      metaItems: [display.price, showLineTotal ? display.lineTotal : "", display.stock, display.description],
      actionMarkup: settings.controls === false ? '<span class="shop-card-open">' + escapeHtml(totalLabel) + '</span>' : "",
      color: settings.color
    });
  }

  function orderItemsMarkup(order, detail, options) {
    const settings = options && typeof options === "object" ? options : {};
    const rawItems = Array.isArray(order && order.items) ? order.items : [];
    const itemLimit = Math.max(1, Number(settings.limit || rawItems.length || 1) || 1);
    const items = rawItems.length ? rawItems.slice(0, itemLimit) : [{
      id: String(order && (order.itemId || order.item_id) || "").trim(),
      title: String(order && order.title || "Order").trim(),
      quantity: Math.max(0, Number(order && order.quantity || 0)),
      price: String(order && (order.price || order.total) || "").trim()
    }];
    const className = settings.compact ? "shop-order-compact-items" : "shop-pane-confirm-items";
    return '' +
      '<div class="' + className + '">' +
        items.map(function (item) {
          return cartDisplayRowMarkup(null, detail, item, { controls: false, compact: settings.compact });
        }).join('') +
      '</div>';
  }

  function buildOrderPayload(state, detail, payment, chosenItems, totalAmount, paymentModeOverride, fulfillmentModeOverride) {
    const items = Array.isArray(chosenItems) ? chosenItems : [];
    const firstItem = items[0] || null;
    const totalQuantity = items.reduce(function (sum, item) {
      return sum + Math.max(0, Number(item && item.quantity || 0));
    }, 0);
    const paymentMode = String(paymentModeOverride || "").trim().toLowerCase() === "before_delivery"
      ? "before_delivery"
      : "on_receive";
    const fulfillmentMode = normalizeFulfillmentMode(fulfillmentModeOverride || selectedFulfillmentMode(state, state && state.activeShopId));
    let title = firstItem ? String(firstItem.title || "").trim() : "Order";
    if (firstItem && items.length > 1) {
      title = title + " +" + (items.length - 1);
    }
    const buyerProfile = buyerCheckoutProfile(state);
    const buyerAccount = accountBuyerAccount(state && state.accountSession);
    const deliveryAddress = fulfillmentMode === "delivery" ? String(buyerProfile.address || "").trim() : "";
    const pickupAddress = fulfillmentMode === "pickup" ? shopPickupLabel(detail) : "";
    const deliveryPoint = defaultAccountAddress(state);
    const deliveryLat = fulfillmentMode === "delivery" && deliveryPoint && isValidMapPoint(deliveryPoint.lat, deliveryPoint.lng)
      ? Number(deliveryPoint.lat)
      : null;
    const deliveryLng = fulfillmentMode === "delivery" && deliveryPoint && isValidMapPoint(deliveryPoint.lat, deliveryPoint.lng)
      ? Number(deliveryPoint.lng)
      : null;
    const pickupGps = fulfillmentMode === "pickup" ? parseGpsValue(detail && detail.gps) : null;
    const notes = items.map(function (item) {
      return String(item.title || "").trim() + " x" + Math.max(0, Number(item.quantity || 0));
    }).filter(Boolean).join(", ");
    return {
      buyer_key: ensureBuyerKey(),
      buyer_account_id: buyerAccount ? buyerAccount.accountId : "",
      buyer_account_token: buyerAccount ? buyerAccount.accountToken : "",
      buyer_name: String(buyerProfile.name || "").trim(),
      buyer_contact: String(buyerProfile.contact || "").trim(),
      address: fulfillmentMode === "pickup" ? pickupAddress : deliveryAddress,
      fulfillment_mode: fulfillmentMode,
      fulfillment_label: fulfillmentMode === "pickup" ? "Pickup" : "Delivery",
      delivery_address: deliveryAddress,
      pickup_address: pickupAddress,
      delivery_lat: deliveryLat,
      delivery_lng: deliveryLng,
      pickup_lat: pickupGps ? pickupGps[0] : "",
      pickup_lng: pickupGps ? pickupGps[1] : "",
      client_nonce: createClientNonce(),
      item_id: items.length === 1 && firstItem ? String(firstItem.id || "").trim() : "",
      title: title || "Order",
      quantity: totalQuantity,
      price: items.length === 1 && firstItem ? formatPrice(firstItem.price, detail && detail.pricing) : "",
      total: formatTotalAmount(totalAmount, detail && detail.pricing),
      payment_label: paymentMode === "before_delivery" ? String(payment && payment.label || "").trim() : "",
      payment_value: paymentMode === "before_delivery" ? String(payment && payment.value || "").trim() : "",
      payment_qr_file: paymentMode === "before_delivery" ? paymentQrFile(payment) : "",
      payment_mode: paymentMode,
      notes: notes,
      items: items.map(function (item) {
        const display = cartDisplayItem(detail, item);
        return {
          id: display.id,
          title: display.title,
          quantity: Math.max(0, Number(item.quantity || 0)),
          price: formatPrice(item.price, detail && detail.pricing),
          description: display.description,
          image: display.image
        };
      })
    };
  }

  function triggerSelectedPayment(state, detail, paymentEntries, totalAmount) {
    if (!state || !state.activeShopId) return;
    const index = selectedPaymentIndex(state, state.activeShopId, paymentEntries);
    if (index < 0 || !paymentEntries[index]) return;
    const href = buildPaymentHref(paymentEntries[index], detail, totalAmount);
    if (!href) return;
    window.location.href = href;
  }

  function triggerPaymentHref(href) {
    const target = String(href || "").trim();
    if (!target) return;
    window.location.href = target;
  }

  function renderShopDetail(state) {
    if (!state.listNode || !state.activeShopId) return;
    const shop = state.shopById[state.activeShopId];
    if (!shop) {
      state.listNode.innerHTML = stateCardMarkup({
        title: "Shop not found",
        message: "This shop is not listed here.",
        actions: [{ label: "Back home", attribute: 'data-go-home="true"' }]
      });
      return;
    }

    if (state.detailLoading) {
      state.listNode.innerHTML = '<div class="shop-pane-detail">' + loadingStateMarkup("Loading shop", "Opening shop details now.") + '</div>';
      return;
    }

    const detail = state.shopDetails[state.activeShopId] || shopDetailFromPreview(shop);
    const ownerMode = isOwnerViewingShop(state);
    const ownerConsole = ownerMode ? ensureShopConsole(state, state.activeShopId) : null;
    const ownerSettings = ownerMode && state.ownerPanel.tab === "settings";
    const ownerHistory = ownerMode && state.ownerPanel.tab === "history";
    const ownerOverlayOpen = ownerSettings || ownerHistory;
    const ownerPreviewMode = ownerMode && !ownerOverlayOpen;
    const ownerEditorMarkup = ownerSettings
      ? ownerSettingsMarkup(state, detail, ownerConsole)
      : ownerHistory
      ? ownerHistoryMarkup(state, detail, ownerConsole)
      : "";
    const cart = getShopCart(state, state.activeShopId);
    if (!detail) {
      state.listNode.innerHTML = '<div class="shop-pane-detail">' + stateCardMarkup({
        title: "Nothing listed yet",
        message: "Check again later."
      }) + '</div>';
      return;
    }

    const chosenItems = ownerMode ? [] : cartItems(detail, cart);
    const totalItems = chosenItems.reduce(function (sum, item) {
      return sum + item.quantity;
    }, 0);
    const totalAmount = chosenItems.reduce(function (sum, item) {
      return sum + item.total;
    }, 0);
    const totalAmountLabel = formatTotalAmount(totalAmount, detail.pricing);
    const cartView = state.activeShopView === "cart";
    const confirmationView = state.activeShopView === "confirmation";
    const query = normalizeSearch(state.searchQuery);
    const locationText = String(detail.location || "").trim();
    const shopName = String(detail.name || shop.display_name || shop.shop_id || "Shop").trim();
    const distanceLabel = statusLabel(shop, state.userPoint);
    const heroOverlineMarkup = '' +
      '<div class="shop-pane-overline">' +
        '<div class="shop-pane-chip">Shop</div>' +
        '<span class="shop-pane-distance">' + escapeHtml(distanceLabel) + '</span>' +
      '</div>';
    const statsParts = [];
    if (locationText && !(ownerPreviewMode && locationText === "Location pending")) {
      statsParts.push('<span>' + escapeHtml(locationText) + '</span>');
    }
    if (detail.hours) {
      statsParts.push('<span>' + escapeHtml(detail.hours) + '</span>');
    }
    const statsMarkup = statsParts.length ? (
      '<div class="shop-pane-stats">' + statsParts.join('') + '</div>'
    ) : '';
    const contactActionParts = [];
    const bottomContactMarkup = !ownerMode && contactActionParts.length ? (
      '<div class="shop-pane-quick-actions shop-pane-bottom-contact">' +
        contactActionParts.join('') +
      '</div>'
    ) : '';
    const ownerOrders = Array.isArray(ownerConsole && ownerConsole.orders) ? ownerConsole.orders : [];
    const ownerPendingCount = pendingOwnerOrdersCount(ownerOrders);
    const ownerAddOpen = !!(state.ownerPanel && state.ownerPanel.addMenuOpen);
    const ownerQuickBarMarkup = ownerMode && !ownerOverlayOpen ? (
      '<div class="shop-owner-bar">' +
        '<div class="shop-owner-actions">' +
          '<button class="shop-owner-save shop-owner-add-toggle" type="button" data-owner-add-toggle="true" aria-expanded="' + (ownerAddOpen ? 'true' : 'false') + '"><span aria-hidden="true">+</span> Add</button>' +
          '<button class="shop-owner-tab shop-owner-manage-toggle" type="button" data-owner-main-manage="true" aria-pressed="' + (ownerSettings ? 'true' : 'false') + '">Manage</button>' +
          '<button class="shop-owner-tab" type="button" data-owner-main-open-history="items">Inventory</button>' +
          '<button class="shop-owner-tab" type="button" data-owner-main-open-history="orders">' +
            escapeHtml(ownerPendingCount ? (ownerPendingCount + " pending") : "Orders") +
          '</button>' +
          '<button class="shop-owner-tab" type="button" data-owner-main-open-history="sales">Sales</button>' +
        '</div>' +
        (ownerAddOpen ? (
          '<div class="shop-owner-add-sheet" data-owner-add-sheet="true">' +
            '<button class="shop-owner-add-option" type="button" data-owner-add-action="item">' +
              '<strong>Add item</strong>' +
              '<span>List stock for buyers</span>' +
            '</button>' +
            '<button class="shop-owner-add-option" type="button" data-owner-add-action="order">' +
              '<strong>Start order</strong>' +
              '<span>For a walk-in customer</span>' +
            '</button>' +
            '<button class="shop-owner-add-option" type="button" data-owner-add-action="photo">' +
              '<strong>Add photo</strong>' +
              '<span>Update shop image</span>' +
            '</button>' +
          '</div>'
        ) : '') +
      '</div>'
    ) : '';
    const paymentEntries = payablePaymentEntries(detail, totalAmount);
    const paymentMode = effectivePaymentMode(state, state.activeShopId, paymentEntries);
    const chosenPaymentIndex = selectedPaymentIndex(state, state.activeShopId, paymentEntries);
    const chosenPayment = chosenPaymentIndex >= 0 ? paymentEntries[chosenPaymentIndex] : null;
    const chosenPaymentHref = chosenPayment ? buildPaymentHref(chosenPayment, detail, totalAmount) : "";
    const paymentPickerOpen = paymentMode === "before_delivery" && isPaymentPickerOpen(state, state.activeShopId);
    const fulfillmentMode = selectedFulfillmentMode(state, state.activeShopId);
    const pickupLocationLabel = shopPickupLabel(detail);
    const deliveryAddressRecord = defaultAccountAddress(state);
    const deliveryLocationLabel = String(
      deliveryAddressRecord && (deliveryAddressRecord.text || deliveryAddressRecord.label)
      || buyerCheckoutProfile(state).address
      || "Use saved address"
    ).trim();
    const canSubmitCart = totalAmount > 0 && (
      paymentMode !== "before_delivery"
      || !paymentPickerOpen
      || (!!chosenPayment && canUsePaymentEntry(chosenPayment, detail, totalAmount))
    );
    const buyerProfile = buyerCheckoutProfile(state);
    const buyerSignedIn = buyerHasSignedIn(state);
    const missingBuyerFields = missingBuyerCheckoutFields(state, fulfillmentMode);
    const missingBuyerFieldMap = missingBuyerFields.reduce(function (map, key) {
      map[key] = true;
      return map;
    }, {});
    const orderNotice = checkoutNotice(state, state.activeShopId);
    const orderNoticeMarkup = orderNotice ? (
      '<div class="shop-pane-notice' + (orderNotice.tone ? (' is-' + escapeHtml(orderNotice.tone)) : '') + '">' + escapeHtml(orderNotice.message || "") + '</div>'
    ) : '';
    const confirmation = orderConfirmation(state, state.activeShopId);
    const buyerFieldParts = [];
    function appendBuyerDetailField(key, label, type, attrs, placeholder, value) {
      if (ownerMode || (buyerSignedIn && !missingBuyerFieldMap[key])) return;
      buyerFieldParts.push(
        '<label class="shop-login-field">' +
          '<span>' + escapeHtml(label) + '</span>' +
          '<input class="shop-login-input" type="' + escapeHtml(type || "text") + '"' + (attrs || '') + ' data-buyer-field="' + escapeHtml(key) + '" value="' + escapeHtml(value || "") + '" placeholder="' + escapeHtml(placeholder || "") + '" spellcheck="false">' +
        '</label>'
      );
    }
    appendBuyerDetailField("name", "Name", "text", ' autocomplete="name"', "Your name", buyerProfile.name);
    appendBuyerDetailField("contact", "Contact", "tel", ' inputmode="tel" autocomplete="tel"', "Phone or handle", buyerProfile.contact);
    if (fulfillmentMode === "delivery") {
      appendBuyerDetailField("address", "Address", "text", ' autocomplete="street-address"', "House, road, or delivery note", buyerProfile.address);
    }
    const buyerDetailsMarkup = !ownerMode && buyerFieldParts.length ? (
      '<div class="shop-login-form shop-buyer-form">' +
        '<div class="shop-owner-form-head">' +
          '<strong>' + escapeHtml(buyerSignedIn ? "Finish details" : "Your details") + '</strong>' +
        '</div>' +
        buyerFieldParts.join('') +
      '</div>'
    ) : '';
    const fulfillmentModeMarkup = !ownerMode ? (
      '<div class="shop-pane-cart-mode shop-pane-fulfillment-mode">' +
        '<span class="shop-pane-cart-label">Receive order</span>' +
        '<div class="shop-pane-mode-grid">' +
          '<button class="shop-pane-mode-card' + (fulfillmentMode === "pickup" ? ' is-selected' : '') + '" type="button" data-fulfillment-mode="pickup">' +
            '<strong>Pickup</strong>' +
            '<span>' + escapeHtml(pickupLocationLabel) + '</span>' +
          '</button>' +
          '<button class="shop-pane-mode-card' + (fulfillmentMode === "delivery" ? ' is-selected' : '') + '" type="button" data-fulfillment-mode="delivery">' +
            '<strong>Delivery</strong>' +
            '<span>' + escapeHtml(deliveryLocationLabel) + '</span>' +
          '</button>' +
        '</div>' +
      '</div>'
    ) : '';
    const paymentModeMarkup = paymentEntries.length ? (
      '<div class="shop-pane-cart-mode">' +
        '<span class="shop-pane-cart-label">When do you want to pay?</span>' +
        '<div class="shop-pane-mode-grid">' +
          '<button class="shop-pane-mode-card' + (paymentMode === "on_receive" ? ' is-selected' : '') + '" type="button" data-payment-mode="on_receive">' +
            '<strong>Pay on receive</strong>' +
            '<span>Pay when it arrives.</span>' +
          '</button>' +
          '<button class="shop-pane-mode-card' + (paymentMode === "before_delivery" ? ' is-selected' : '') + '" type="button" data-payment-mode="before_delivery">' +
            '<strong>Pay before</strong>' +
            '<span>Prepay now.</span>' +
          '</button>' +
        '</div>' +
      '</div>'
    ) : '';
    const paymentMarkup = paymentMode === "before_delivery"
      ? (
        paymentPickerOpen
          ? (
            paymentEntries.length ? (
              '<div class="shop-pane-cart-payments">' +
                '<span class="shop-pane-cart-label">' + escapeHtml(chosenPayment ? ("Selected: " + (chosenPayment.label || "Payment")) : "Select a payment method") + '</span>' +
                '<div class="shop-pane-pay-grid">' +
	                  paymentEntries.map(function (payment, index) {
	                    const qrMarkup = paymentQrImageMarkup(paymentQrFile(payment), payment.label || "Payment", "is-pay-card");
	                    return '' +
	                      '<div class="shop-pay-card' + (index === chosenPaymentIndex ? ' is-selected' : '') + '" data-pay-select="' + index + '">' +
	                        '<div class="shop-pay-card-head">' +
	                          '<strong>' + escapeHtml(payment.label || "Payment") + '</strong>' +
	                          (payment.value ? '<button class="shop-pay-copy" type="button" data-pay-copy="' + escapeHtml(payment.value) + '" data-copy-index="' + index + '">Copy</button>' : '') +
	                        '</div>' +
	                        qrMarkup +
	                        (payment.note ? '<span class="shop-pay-note">' + escapeHtml(payment.note) + '</span>' : '') +
	                        (payment.value ? '<code class="shop-pay-value">' + escapeHtml(payment.value) + '</code>' : '') +
	                      '</div>';
                  }).join('') +
                '</div>' +
              '</div>'
            ) : stateCardMarkup({
              title: "Payments not ready",
              message: "Use pay on receive or ask the shop directly."
            })
          )
          : '<div class="shop-pane-notice">Payment methods stay hidden until you continue to pay.</div>'
      )
      : '';
    const filteredItems = Array.isArray(detail.items) ? detail.items.filter(function (item) {
      return matchesSearch([item.title, item.description, item.price], query);
    }) : [];
    const shopItemRows = sortItemLibraryRows(state, filteredItems.map(function (item) {
      return Object.assign({}, item, {
        shopId: state.activeShopId,
        shopName: shopName
      });
    }));
    const itemsMarkup = shopItemRows.length ? (
      listingViewControlsMarkup(state, shopItemRows.length, "Items") +
      '<div class="shop-pane-items shop-pane-shop-feed" data-list-view="' + escapeHtml(normalizeListingViewMode(state.listingViewMode)) + '">' +
        shopItemRows.map(function (item) {
          return shopItemCardMarkup(state, detail, item, shop, {
            shopId: state.activeShopId,
            itemId: String(item && item.id || "").trim(),
            shopName: shopName,
            showShopName: false,
            openShop: false,
            ownerMode: ownerMode,
            color: shopColor(shop)
          });
        }).join('') +
      '</div>'
    ) : emptyItemsStateMarkup(query ? {
      scope: "shop",
      query: true,
      actions: [{ label: "Clear search", attribute: 'data-clear-search="true"', tone: "primary" }]
    } : {
      scope: "shop"
    });
    const filteredCartItems = chosenItems.filter(function (item) {
      return matchesSearch([item.title, item.price], query);
    });
    const cartMarkup = filteredCartItems.length ? (
      '<div class="shop-pane-items shop-pane-shop-feed shop-pane-cart-feed" data-list-view="list">' +
        filteredCartItems.map(function (item) {
          return cartDisplayRowMarkup(state, detail, item, {
            shopId: state.activeShopId,
            shopName: shopName,
            shop: shop,
            color: shopColor(shop)
          });
        }).join('') +
      '</div>' +
      '<div class="shop-pane-cart-foot">' +
        '<span>Total</span>' +
        '<strong>' + escapeHtml(totalAmountLabel) + '</strong>' +
      '</div>'
    ) : (query ? stateCardMarkup({
      title: "No cart item",
      actions: [{ label: "Clear search", attribute: 'data-clear-search="true"' }]
    }) : emptyCartStateMarkup({
      scope: "shop",
      actionLabel: "Items",
      actionAttribute: 'data-confirm-items="true"'
    }));

    const shopHeroMarkMarkup = detail.logoFile
      ? (
        '<span class="shop-pane-copy-mark is-logo">' +
          '<img class="shop-pane-logo-image" src="' + escapeHtml(shopLogoUrl(state.activeShopId)) + '" alt="' + escapeHtml((detail.name || shop.display_name || shop.shop_id || "Shop") + " logo") + '">' +
        '</span>'
      )
      : '<span class="shop-pane-copy-mark" aria-hidden="true"></span>';

    const shopHeroMarkup = (
      '<div class="shop-pane-hero">' +
        heroOverlineMarkup +
        '<div class="shop-pane-copy-row">' +
          shopHeroMarkMarkup +
          '<div class="shop-pane-copy">' +
            '<h2>' + escapeHtml(shopName) + '</h2>' +
            (detail.note ? '<p>' + escapeHtml(detail.note) + '</p>' : '') +
          '</div>' +
        '</div>' +
        statsMarkup +
      '</div>'
    );

    const canCancelConfirmation = confirmation && canBuyerCancelOrder(confirmation.order || {});
    const confirmationPaymentQr = confirmation
      ? String(confirmation.paymentQrFile || confirmation.order && (confirmation.order.paymentQrFile || confirmation.order.payment_qr_file) || "").trim()
      : "";
    const confirmationMarkup = confirmation ? (
      '<div class="shop-pane-cart-screen shop-pane-confirm-screen">' +
        '<div class="shop-pane-cart-kicker">' +
          '<span class="shop-pane-chip">Confirmed</span>' +
          '<span class="shop-pane-distance">' + escapeHtml(buyerOrderStatusText(confirmation.order || {})) + '</span>' +
        '</div>' +
        '<div class="shop-pane-cart-title">' +
          '<h2>' + escapeHtml(buyerConfirmationTitle(confirmation.order || {})) + '</h2>' +
          '<p>' + escapeHtml(buyerConfirmationMessage(confirmation.order || {})) + '</p>' +
        '</div>' +
        '<div class="shop-pane-cart shop-pane-confirm-card">' +
          '<div class="shop-pane-cart-head">' +
            '<strong>' + escapeHtml(confirmation.order && confirmation.order.title || "Order") + '</strong>' +
            '<span>' + escapeHtml(confirmation.order && (confirmation.order.id || "").trim() || "Saved") + '</span>' +
          '</div>' +
          '<div class="shop-pane-cart-items">' +
            '<div class="shop-cart-row">' +
              '<div class="shop-cart-copy">' +
                '<strong>Status</strong>' +
                '<span>' + escapeHtml(buyerOrderStatusText(confirmation.order || {})) + '</span>' +
              '</div>' +
              '<div class="shop-cart-copy">' +
                '<strong>Total</strong>' +
                '<span>' + escapeHtml(confirmation.order && (confirmation.order.total || confirmation.order.price) || "0") + '</span>' +
              '</div>' +
            '</div>' +
	            '<div class="shop-cart-row">' +
	              '<div class="shop-cart-copy">' +
	                '<strong>Payment</strong>' +
	                '<span>' + escapeHtml(orderPaymentModeLabel(confirmation.order || {}) + (confirmation.paymentLabel ? (" • " + confirmation.paymentLabel) : "")) + '</span>' +
              '</div>' +
              '<div class="shop-cart-copy">' +
                '<strong>Placed</strong>' +
                '<span>' + escapeHtml(formatOrderTimestamp(confirmation.order && confirmation.order.timestamp || 0)) + '</span>' +
	              '</div>' +
	            '</div>' +
	            (confirmationPaymentQr ? '<div class="shop-confirm-payment-qr">' + paymentQrImageMarkup(confirmationPaymentQr, confirmation.paymentLabel || "Payment", "is-confirm-card") + '<span>Payment QR</span></div>' : '') +
	            '<div class="shop-cart-row shop-cart-fulfillment-row">' +
              '<div class="shop-cart-copy">' +
                '<strong>' + escapeHtml(orderFulfillmentLabel(confirmation.order || {})) + '</strong>' +
                '<span>' + escapeHtml(orderFulfillmentLine(confirmation.order || {})) + '</span>' +
              '</div>' +
              '<div class="shop-cart-copy">' +
                '<strong>Map</strong>' +
                '<span>' + escapeHtml(orderFulfillmentMode(confirmation.order || {}) === "pickup" ? "Pickup point shown above" : "Delivery address saved") + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          orderItemsMarkup(confirmation.order || {}, detail) +
          '<p class="shop-pane-confirm-copy">' + escapeHtml(buyerOrderSummary(confirmation.order || {})) + '</p>' +
        '</div>' +
        '<div class="shop-pane-confirm-actions">' +
          '<button class="shop-cart-pay" type="button" data-confirm-items="true">Back to items</button>' +
          (canCancelConfirmation ? '<button class="shop-cart-pay shop-cart-pay-secondary is-danger" type="button" data-cancel-buyer-order="' + escapeHtml(confirmation.order && confirmation.order.id || "") + '" data-cancel-shop-id="' + escapeHtml(state.activeShopId) + '">Cancel order</button>' : '') +
          (confirmation.paymentMode === "before_delivery" && confirmation.paymentHref && !confirmation.order.paymentPaid
            ? '<button class="shop-cart-pay" type="button" data-confirm-pay-now="true">' + escapeHtml("Pay now" + (confirmation.order && confirmation.order.total ? (" " + confirmation.order.total) : "")) + '</button>'
            : '') +
        '</div>' +
      '</div>'
    ) : '';

    state.listNode.innerHTML = '' +
      '<section class="shop-pane-detail" style="--shop-color:' + escapeHtml(shopColor(shop)) + ';">' +
        (confirmationView
          ? confirmationMarkup
          : cartView
          ? '<div class="shop-pane-cart-screen">' +
              '<div class="shop-pane-cart-title">' +
                '<h2>' + escapeHtml(detail.name || shop.display_name || shop.shop_id) + '</h2>' +
              '</div>' +
              orderNoticeMarkup +
              '<div class="shop-pane-cart" id="shopPaneCart">' +
                cartMarkup +
              '</div>' +
              fulfillmentModeMarkup +
              buyerDetailsMarkup +
              paymentModeMarkup +
              paymentMarkup +
              '<button class="shop-cart-pay" type="button"' + (canSubmitCart ? '' : ' disabled') + '>' + escapeHtml(
                totalAmount > 0
                  ? (
                    paymentMode === "before_delivery"
                      ? (paymentPickerOpen
                          ? (chosenPayment ? ("Pay before " + totalAmountLabel) : "Select payment method")
                          : "Continue to payment")
                      : "Place order"
                  )
                  : (
                    paymentMode === "before_delivery"
                      ? (paymentPickerOpen ? "Select payment method" : "Continue to payment")
                      : "Place order"
                  )
              ) + '</button>' +
            '</div>'
          : shopHeroMarkup +
            orderNoticeMarkup +
            ownerQuickBarMarkup +
            ownerEditorMarkup +
            (ownerOverlayOpen ? '' : '<div class="shop-pane-items">' + itemsMarkup + '</div>') +
            (!ownerMode && totalAmount > 0 ? '<button class="shop-cart-pay shop-cart-pay-inline" type="button" data-open-cart="true">' + escapeHtml(paymentMode === "before_delivery" ? ("Pay before " + totalAmountLabel) : "Place order") + '</button>' : '') +
            bottomContactMarkup) +
      '</section>';
    if (ownerSettings && state.ownerPanel.section === "profile") {
      ensureOwnerPickupMap(state);
    } else {
      destroyOwnerPickupMap(state);
    }
  }

  function renderLoginPane(state, options) {
    if (!state.listNode) return;
    destroyOwnerPickupMap(state);
    const settings = options && typeof options === "object" ? options : {};
    const isSetup = String(settings.mode || "").trim() === "setup" || state.debugPaneView === "setup";
    const draft = state.loginDraft || {};
    const statusTone = String(draft.tone || "").trim();
    const existingAccount = state.accountSession || loadAccountSession();
    const ownerShops = accountOwnerShops(existingAccount);
    const ownerShopCount = ownerShops.length;
    const savedOwnerShop = preferredOwnerShop(existingAccount, state.ownerShopId);
    const savedOwnerShopId = String(savedOwnerShop && savedOwnerShop.shopId || "").trim();
    const savedOwnerShopName = String(savedOwnerShop && (savedOwnerShop.shopName || savedOwnerShop.shopId) || "").trim();
    const addShopMode = !isSetup && String(draft.flow || "").trim() === "add-shop";
    const shopSetupStep = addShopMode && String(draft.shopSetupStep || "").trim() === "verify" ? "verify" : "details";
    const loginTitle = addShopMode
      ? (shopSetupStep === "verify" ? "Verify shop email" : "Add shop")
      : (isSetup ? "Set up shop" : (ownerShopCount ? "Open shop" : "Add shop"));
    const loginSubmitLabel = addShopMode ? (shopSetupStep === "verify" ? "Create shop" : "Send code") : (isSetup ? "Create shop" : "Open shop");
    const resetMode = !addShopMode && !!draft.resetMode;
    const resetStep = resetMode && String(draft.resetStep || "").trim() === "code" ? "code" : "address";
    const savedOwnerMarkup = !isSetup && !addShopMode && !resetMode && savedOwnerShopId ? (
      '<div class="shop-login-form shop-login-saved-form">' +
        '<div class="shop-state-card is-success" role="status">' +
          '<span class="shop-state-mark" aria-hidden="true"></span>' +
          '<strong>' + escapeHtml(savedOwnerShopName || savedOwnerShopId) + '</strong>' +
          '<span>' + escapeHtml(ownerShopCount > 1 ? (ownerShopCount + " shops saved") : "Shop session saved") + '</span>' +
        '</div>' +
        '<button class="shop-login-submit" type="button" data-account-open-shop="' + escapeHtml(savedOwnerShopId) + '">Continue</button>' +
        '<div class="shop-account-auth-links">' +
          '<button type="button" data-owner-logout="true">Use another shop</button>' +
        '</div>' +
        '<p class="shop-login-status' + (statusTone ? (' is-' + escapeHtml(statusTone)) : '') + '">' + escapeHtml(draft.status || "") + '</p>' +
      '</div>'
    ) : "";
    const formMarkup = addShopMode ? (shopSetupStep === "verify" ? (
      '<div class="shop-login-form shop-add-form">' +
        '<div class="shop-state-card is-success" role="status">' +
          '<span class="shop-state-mark" aria-hidden="true"></span>' +
          '<strong>Code sent</strong>' +
          '<span>' + escapeHtml(draft.contact || "Shop contact") + '</span>' +
        '</div>' +
        '<label class="shop-login-field">' +
          '<span>Code</span>' +
          '<input class="shop-login-input" type="text" inputmode="numeric" data-login-field="verificationCode" value="' + escapeHtml(draft.verificationCode || "") + '" autocomplete="one-time-code" spellcheck="false">' +
        '</label>' +
        '<button class="shop-login-submit" type="button" data-login-submit="true"' + (draft.submitting ? ' disabled' : '') + '>' + escapeHtml(loginSubmitLabel) + '</button>' +
        '<div class="shop-account-auth-links">' +
          '<button type="button" data-shop-setup-resend="true"' + (draft.submitting ? ' disabled' : '') + '>Send again</button>' +
          '<button type="button" data-shop-setup-edit="true"' + (draft.submitting ? ' disabled' : '') + '>Edit details</button>' +
        '</div>' +
        '<p class="shop-login-status' + (statusTone ? (' is-' + escapeHtml(statusTone)) : '') + '">' + escapeHtml(draft.status || "") + '</p>' +
      '</div>'
    ) : (
      '<div class="shop-login-form shop-add-form">' +
        '<label class="shop-login-field">' +
          '<span>Shop name</span>' +
          '<input class="shop-login-input" type="text" data-login-field="username" value="' + escapeHtml(draft.username || "") + '" autocomplete="organization" spellcheck="false">' +
        '</label>' +
        '<label class="shop-login-field">' +
          '<span>Owner email</span>' +
          '<input class="shop-login-input" type="text" inputmode="email" data-login-field="contact" value="' + escapeHtml(draft.contact || "") + '" autocomplete="email" spellcheck="false">' +
        '</label>' +
        '<label class="shop-login-field">' +
          '<span>Shop address</span>' +
          '<input class="shop-login-input" type="text" data-login-field="address" value="' + escapeHtml(draft.address || "") + '" autocomplete="street-address" spellcheck="false">' +
        '</label>' +
        '<label class="shop-login-field">' +
          '<span>Owner password</span>' +
          '<input class="shop-login-input" type="password" data-login-field="password" value="' + escapeHtml(draft.password || "") + '" autocomplete="new-password">' +
        '</label>' +
        '<button class="shop-login-submit" type="button" data-login-submit="true"' + (draft.submitting ? ' disabled' : '') + '>' + escapeHtml(loginSubmitLabel) + '</button>' +
        '<div class="shop-account-auth-links">' +
          '<button type="button" data-shop-setup-back-account="true">Back to account</button>' +
        '</div>' +
        '<p class="shop-login-status' + (statusTone ? (' is-' + escapeHtml(statusTone)) : '') + '">' + escapeHtml(draft.status || "") + '</p>' +
      '</div>'
    )) : resetMode ? (resetStep === "code" ? (
      '<div class="shop-login-form">' +
        '<label class="shop-login-field">' +
          '<span>Reset code</span>' +
          '<input class="shop-login-input" type="text" inputmode="numeric" data-login-reset-field="resetCode" value="' + escapeHtml(draft.resetCode || "") + '" autocomplete="one-time-code" spellcheck="false">' +
        '</label>' +
        '<label class="shop-login-field">' +
          '<span>New password</span>' +
          '<input class="shop-login-input" type="password" data-login-reset-field="resetPassword" value="' + escapeHtml(draft.resetPassword || "") + '" autocomplete="new-password">' +
        '</label>' +
        '<button class="shop-login-submit" type="button" data-login-reset-submit="true"' + (draft.submitting ? ' disabled' : '') + '>Set password</button>' +
        '<div class="shop-account-auth-links">' +
          '<button type="button" data-login-reset-request="true"' + (draft.submitting ? ' disabled' : '') + '>Get code</button>' +
          '<button type="button" data-login-reset-toggle="false">Back</button>' +
        '</div>' +
        '<p class="shop-login-status' + (statusTone ? (' is-' + escapeHtml(statusTone)) : '') + '">' + escapeHtml(draft.status || "") + '</p>' +
      '</div>'
    ) : (
      '<div class="shop-login-form">' +
        '<label class="shop-login-field">' +
          '<span>Shop name</span>' +
          '<input class="shop-login-input" type="text" data-login-field="username" value="' + escapeHtml(draft.username || "") + '" autocomplete="username" spellcheck="false">' +
        '</label>' +
        '<label class="shop-login-field">' +
          '<span>Email or number</span>' +
          '<input class="shop-login-input" type="text" data-login-reset-field="resetContact" value="' + escapeHtml(draft.resetContact || "") + '" autocomplete="username" spellcheck="false">' +
        '</label>' +
        '<button class="shop-login-submit" type="button" data-login-reset-request="true"' + (draft.submitting ? ' disabled' : '') + '>Continue</button>' +
        '<div class="shop-account-auth-links">' +
          '<button type="button" data-login-reset-toggle="false">Back</button>' +
        '</div>' +
        '<p class="shop-login-status' + (statusTone ? (' is-' + escapeHtml(statusTone)) : '') + '">' + escapeHtml(draft.status || "") + '</p>' +
      '</div>'
    )) : (savedOwnerMarkup || (
      '<div class="shop-login-form">' +
        '<label class="shop-login-field">' +
          '<span>Shop name</span>' +
          '<input class="shop-login-input" type="text" data-login-field="username" value="' + escapeHtml(draft.username || "") + '" autocomplete="username" spellcheck="false">' +
        '</label>' +
        '<label class="shop-login-field">' +
          '<span>Password</span>' +
          '<input class="shop-login-input" type="password" data-login-field="password" value="' + escapeHtml(draft.password || "") + '" autocomplete="current-password">' +
        '</label>' +
        '<button class="shop-login-submit" type="button" data-login-submit="true"' + (draft.submitting ? ' disabled' : '') + '>' + escapeHtml(loginSubmitLabel) + '</button>' +
        '<div class="shop-account-auth-links">' +
          '<button type="button" data-login-reset-toggle="true">Forgot password?</button>' +
        '</div>' +
        '<p class="shop-login-status' + (statusTone ? (' is-' + escapeHtml(statusTone)) : '') + '">' + escapeHtml(draft.status || "") + '</p>' +
      '</div>'
    ));
    state.listNode.innerHTML = '' +
      '<section class="shop-pane-detail shop-login-pane' + (isSetup ? ' shop-setup-pane' : '') + '">' +
        '<div class="shop-pane-hero shop-login-hero">' +
          '<div class="shop-pane-overline">' +
          '<div class="shop-pane-chip">' + escapeHtml(addShopMode ? "Shop setup" : isSetup ? "Setup" : "Shop") + '</div>' +
          '</div>' +
          '<h2>' + escapeHtml(resetMode ? (resetStep === "code" ? "Set password" : "Find shop") : loginTitle) + '</h2>' +
        '</div>' +
        formMarkup +
      '</section>';
  }

  function renderVendorSetupPane(state) {
    if (!state || !state.listNode) return;
    destroyOwnerPickupMap(state);
    const draft = ensureSetupDraft(state);
    const statusTone = String(draft.tone || "").trim();
    const step = String(draft.step || "details").trim();
    let formMarkup = "";
    if (step === "verify") {
      formMarkup = '' +
        '<label class="shop-login-field">' +
          '<span>Code</span>' +
          '<input class="shop-login-input" type="text" inputmode="numeric" data-setup-field="verificationCode" value="' + escapeHtml(draft.verificationCode || "") + '" autocomplete="one-time-code" spellcheck="false">' +
        '</label>' +
        '<button class="shop-login-submit" type="button" data-setup-contact-verify="true"' + (draft.submitting ? ' disabled' : '') + '>Verify</button>' +
        '<div class="shop-account-auth-links">' +
          '<button type="button" data-setup-contact-resend="true"' + (draft.submitting ? ' disabled' : '') + '>Send again</button>' +
          '<button type="button" data-setup-back-details="true"' + (draft.submitting ? ' disabled' : '') + '>Change contact</button>' +
        '</div>';
    } else if (step === "done") {
      formMarkup = '' +
        '<div class="shop-state-card is-success" role="status">' +
          '<span class="shop-state-mark" aria-hidden="true"></span>' +
          '<strong>Contact verified</strong>' +
        '</div>' +
        '<button class="shop-login-submit" type="button" data-setup-finish="true">Continue</button>';
    } else {
      formMarkup = '' +
        '<label class="shop-login-field">' +
          '<span>Name</span>' +
          '<input class="shop-login-input" type="text" data-setup-field="name" value="' + escapeHtml(draft.name || "") + '" autocomplete="name" spellcheck="false">' +
        '</label>' +
        '<label class="shop-login-field">' +
          '<span>Contact</span>' +
          '<input class="shop-login-input" type="text" inputmode="email" data-setup-field="contact" value="' + escapeHtml(draft.contact || "") + '" autocomplete="username" spellcheck="false">' +
        '</label>' +
        '<div class="shop-login-field shop-setup-address-field">' +
          '<span>Address</span>' +
          '<div class="shop-setup-address-control">' +
            '<input class="shop-login-input" type="text" data-setup-field="address" value="' + escapeHtml(draft.address || "") + '" autocomplete="street-address" spellcheck="false">' +
            '<button class="shop-setup-map-button" type="button" data-setup-use-map="true" aria-label="Select address pin" title="Select address pin"><span class="shop-setup-map-icon" aria-hidden="true"></span></button>' +
          '</div>' +
        '</div>' +
        '<button class="shop-login-submit" type="button" data-setup-save="true"' + (draft.submitting ? ' disabled' : '') + '>Continue</button>';
    }
    state.listNode.innerHTML = '' +
      '<section class="shop-pane-detail shop-login-pane shop-setup-pane">' +
        '<div class="shop-pane-hero shop-login-hero">' +
          '<h2>' + escapeHtml(step === "verify" ? "Verify contact" : step === "done" ? "Ready" : "Your details") + '</h2>' +
        '</div>' +
        '<div class="shop-login-form">' +
          formMarkup +
          '<p class="shop-login-status' + (statusTone ? (' is-' + escapeHtml(statusTone)) : '') + '">' + escapeHtml(draft.message || "") + '</p>' +
        '</div>' +
      '</section>';
  }

  function accountEntryMarkup(state) {
    const action = accountSessionAction(state);
    return '' +
      '<button class="shop-card shop-card-action" type="button" data-open-account-entry="true" style="--shop-color:' + escapeHtml(action.tone || HASHOP_ACCOUNT_ACTION_COLOR) + ';">' +
        '<div class="shop-card-head">' +
          '<span class="shop-card-mark" aria-hidden="true"></span>' +
          '<strong>' + escapeHtml(action.label || "Login") + '</strong>' +
          '<span class="shop-card-open">Open</span>' +
        '</div>' +
        '<div class="shop-card-meta">' +
          '<span>' + escapeHtml(action.description || "") + '</span>' +
          '<span>' + escapeHtml(action.detail || "") + '</span>' +
        '</div>' +
      '</button>';
  }

  function buyerAccountSignInMarkup(state, options) {
    const settings = options && typeof options === "object" ? options : {};
    const draft = state && state.buyerAuthDraft ? state.buyerAuthDraft : {};
    const statusTone = String(draft.tone || "").trim();
    const resetMode = !!draft.resetMode;
    const resetStep = resetMode && String(draft.resetStep || "").trim() === "code" ? "code" : "address";
    const createMode = !resetMode && !!draft.createMode;
    const rawCreateStep = String(draft.createStep || "").trim();
    const createStep = createMode && rawCreateStep === "verify" ? "verify" : (createMode && rawCreateStep === "password" ? "password" : "contact");
    const pendingCheckout = !!String(state && state.pendingCheckoutShopId || "").trim();
    const authFieldsMarkup = resetMode ? (resetStep === "code" ? (
      '<label class="shop-login-field">' +
        '<span>Reset code</span>' +
        '<input class="shop-login-input" type="text" inputmode="numeric" data-buyer-auth-field="resetCode" value="' + escapeHtml(draft.resetCode || "") + '" autocomplete="one-time-code" spellcheck="false">' +
      '</label>' +
      '<label class="shop-login-field">' +
        '<span>New password</span>' +
        '<input class="shop-login-input" type="password" data-buyer-auth-field="resetPassword" value="' + escapeHtml(draft.resetPassword || "") + '" autocomplete="new-password">' +
      '</label>' +
      '<div class="shop-account-actions shop-account-auth-actions">' +
        '<button class="shop-login-submit" type="button" data-buyer-password-reset-submit="true"' + (draft.submitting ? ' disabled' : '') + '>Set password</button>' +
      '</div>' +
      '<div class="shop-account-auth-links">' +
        '<button type="button" data-buyer-password-reset-request="true"' + (draft.submitting ? ' disabled' : '') + '>Get code</button>' +
        '<button type="button" data-buyer-password-reset-toggle="close">Back</button>' +
      '</div>'
    ) : (
      '<label class="shop-login-field">' +
        '<span>Email or number</span>' +
        '<input class="shop-login-input" type="text" data-buyer-auth-field="contact" value="' + escapeHtml(draft.contact || "") + '" autocomplete="username" spellcheck="false">' +
      '</label>' +
      '<div class="shop-account-actions shop-account-auth-actions">' +
        '<button class="shop-login-submit" type="button" data-buyer-password-reset-request="true"' + (draft.submitting ? ' disabled' : '') + '>Continue</button>' +
      '</div>' +
      '<div class="shop-account-auth-links">' +
        '<button type="button" data-buyer-password-reset-toggle="close">Back</button>' +
      '</div>'
    )) : createMode ? (createStep === "verify" ? (
      '<label class="shop-login-field">' +
        '<span>Phone or email</span>' +
        '<input class="shop-login-input" type="text" data-buyer-auth-field="contact" value="' + escapeHtml(draft.contact || "") + '" autocomplete="username" spellcheck="false" readonly aria-readonly="true">' +
      '</label>' +
      '<label class="shop-login-field">' +
        '<span>Code</span>' +
        '<input class="shop-login-input" type="text" inputmode="numeric" data-buyer-auth-field="verificationCode" value="' + escapeHtml(draft.verificationCode || "") + '" autocomplete="one-time-code" spellcheck="false">' +
      '</label>' +
      '<div class="shop-account-actions shop-account-auth-actions">' +
        '<button class="shop-login-submit" type="button" data-buyer-create-verify="true"' + (draft.submitting ? ' disabled' : '') + '>Continue</button>' +
      '</div>' +
      '<div class="shop-account-auth-links">' +
        '<button type="button" data-buyer-create-resend="true"' + (draft.submitting ? ' disabled' : '') + '>Send again</button>' +
        '<button type="button" data-buyer-create-step="contact">Change contact</button>' +
        '<button type="button" data-buyer-create-toggle="close">Sign in</button>' +
      '</div>'
    ) : createStep === "password" ? (
      '<label class="shop-login-field">' +
        '<span>Phone or email</span>' +
        '<input class="shop-login-input" type="text" data-buyer-auth-field="contact" value="' + escapeHtml(draft.contact || "") + '" autocomplete="username" spellcheck="false" readonly aria-readonly="true">' +
      '</label>' +
      '<label class="shop-login-field">' +
        '<span>Password</span>' +
        '<input class="shop-login-input" type="password" data-buyer-auth-field="password" value="' + escapeHtml(draft.password || "") + '" autocomplete="new-password">' +
      '</label>' +
      '<div class="shop-account-actions shop-account-auth-actions">' +
        '<button class="shop-login-submit" type="button" data-buyer-account-submit="signup" aria-label="Create account" title="Create account"' + (draft.submitting ? ' disabled' : '') + '>Create account</button>' +
      '</div>' +
      '<div class="shop-account-auth-links">' +
        '<button type="button" data-buyer-create-step="contact">Change contact</button>' +
        '<button type="button" data-buyer-create-toggle="close">Sign in</button>' +
      '</div>'
    ) : (
      '<label class="shop-login-field">' +
        '<span>Phone or email</span>' +
        '<input class="shop-login-input" type="text" data-buyer-auth-field="contact" value="' + escapeHtml(draft.contact || "") + '" autocomplete="username" spellcheck="false">' +
      '</label>' +
      '<div class="shop-account-actions shop-account-auth-actions">' +
        '<button class="shop-login-submit" type="button" data-buyer-create-next="true"' + (draft.submitting ? ' disabled' : '') + '>Continue</button>' +
      '</div>' +
      '<div class="shop-account-auth-links">' +
        '<button type="button" data-buyer-create-toggle="close">Sign in</button>' +
      '</div>'
    )) : (
      '<label class="shop-login-field">' +
        '<span>Phone or email</span>' +
        '<input class="shop-login-input" type="text" data-buyer-auth-field="contact" value="' + escapeHtml(draft.contact || "") + '" autocomplete="username" spellcheck="false">' +
      '</label>' +
      '<label class="shop-login-field">' +
        '<span>Password</span>' +
        '<input class="shop-login-input" type="password" data-buyer-auth-field="password" value="' + escapeHtml(draft.password || "") + '" autocomplete="current-password">' +
      '</label>' +
      '<div class="shop-account-actions shop-account-auth-actions">' +
        '<button class="shop-login-submit" type="button" data-buyer-account-submit="login" aria-label="Sign in" title="Sign in"' + (draft.submitting ? ' disabled' : '') + '>Sign in</button>' +
      '</div>' +
      '<div class="shop-account-auth-links">' +
        '<button type="button" data-buyer-create-toggle="open"' + (draft.submitting ? ' disabled' : '') + '>Create account</button>' +
        '<button type="button" data-buyer-password-reset-toggle="open">Forgot password?</button>' +
        (settings.showBack ? (pendingCheckout
          ? '<button type="button" data-checkout-back="true">Back to cart</button>'
          : '<button type="button" data-account-main="true">Back</button>') : '') +
      '</div>'
    );
    const publicLinksMarkup = '' +
      '<div class="shop-account-auth-public-links">' +
        '<a href="/about">About</a>' +
        '<a href="/privacy">Privacy</a>' +
      '</div>';
    return '' +
      '<section class="shop-pane-detail shop-buyer-account-pane" style="--shop-color:' + HASHOP_ACCOUNT_ACTION_COLOR + ';">' +
        '<div class="shop-account-stack">' +
          '<div class="shop-login-form shop-buyer-auth-form">' +
            authFieldsMarkup +
            '<p class="shop-login-status' + (statusTone ? (' is-' + escapeHtml(statusTone)) : '') + '">' + escapeHtml(draft.status || "") + '</p>' +
            publicLinksMarkup +
          '</div>' +
        '</div>' +
      '</section>';
  }

  function accountSavedLocationLabel(state) {
    const defaultAddress = defaultAccountAddress(state);
    if (defaultAddress && defaultAddress.label) return defaultAddress.label;
    if (state && state.userPoint) return "Current location";
    if (state && state.savedUserLocation) return "Current location";
    return "Near you";
  }

  function ensureAccountDraft(state) {
    if (!state.accountDraft || typeof state.accountDraft !== "object") {
      state.accountDraft = {};
    }
    return state.accountDraft;
  }

  function accountDraftValue(state, key, fallback) {
    const draft = ensureAccountDraft(state);
    return Object.prototype.hasOwnProperty.call(draft, key) ? String(draft[key] || "") : String(fallback || "");
  }

  function accountStatusMarkup(state) {
    const draft = ensureAccountDraft(state);
    const message = String(draft.message || "").trim();
    if (!message) return "";
    const tone = String(draft.tone || "").trim();
    return '<p class="shop-account-status' + (tone ? (' is-' + escapeHtml(tone)) : '') + '">' + escapeHtml(message) + '</p>';
  }

  function accountSymbolName(icon, title) {
    const token = String(icon || "").trim().toLowerCase();
    const label = String(title || "").trim().toLowerCase();
    if (token === "back") return "back";
    if (token === "a" || label.indexOf("address") >= 0 || label.indexOf("delivery") >= 0) return "address";
    if (token === "l" || label.indexOf("location") >= 0) return "location";
    if (token === "rs" || label.indexOf("payment") >= 0 || label.indexOf("upi") >= 0) return "payment";
    if (token === "#") return "hash";
    if (token === "s" || label.indexOf("shop") >= 0) return "shop";
    if (token === "o" || label.indexOf("order") >= 0) return "orders";
    if (label.indexOf("privacy") >= 0) return "privacy";
    if (token === "p" || label.indexOf("profile") >= 0) return "profile";
    if (token === "h" || label.indexOf("help") >= 0) return "help";
    if (token === "in" || label.indexOf("sign in") >= 0) return "signin";
    if (token === "d" || label.indexOf("dark") >= 0 || label.indexOf("theme") >= 0) return "theme";
    if (token === "+") return "plus";
    if (token === "!") return "logout";
    return "dot";
  }

  function accountLucideName(symbol) {
    const name = String(symbol || "").trim();
    const names = {
      address: "map-pin",
      back: "chevron-left",
      dot: "circle",
      hash: "hash",
      help: "circle-help",
      location: "locate-fixed",
      logout: "log-out",
      orders: "receipt-text",
      payment: "indian-rupee",
      plus: "plus",
      privacy: "shield-check",
      profile: "user",
      shop: "store",
      signin: "log-in",
      theme: "moon"
    };
    return names[name] || names.dot;
  }

  function accountIconMarkup(icon, title) {
    const symbol = accountSymbolName(icon, title);
    return '<span class="shop-account-menu-icon" aria-hidden="true" data-account-symbol="' + escapeHtml(symbol) + '" data-lucide="' + escapeHtml(accountLucideName(symbol)) + '"></span>';
  }

  function accountMenuRowMarkup(options) {
    const settings = options && typeof options === "object" ? options : {};
    const action = String(settings.action || "").trim();
    const customAttr = String(settings.attr || "");
    const attr = customAttr || (action ? (' data-account-menu="' + escapeHtml(action) + '"') : "");
    const meta = String(settings.meta || "").trim();
    const icon = String(settings.icon || "").trim().slice(0, 3) || "#";
    const className = String(settings.className || "").trim();
    const pressedAttr = settings.toggle ? (' aria-pressed="' + (settings.pressed ? 'true' : 'false') + '"') : '';
    const toggleMarkup = settings.toggle ? (
      '<span class="shop-account-toggle-mark' + (settings.pressed ? ' is-on' : '') + '" aria-hidden="true"><span></span></span>'
    ) : '';
    return '' +
      '<button class="shop-account-menu-row' + (settings.danger ? ' is-danger' : '') + (className ? (' ' + escapeHtml(className)) : '') + '" type="button"' + attr + pressedAttr + '>' +
        accountIconMarkup(icon, settings.title || "") +
        '<span class="shop-account-menu-copy">' +
          '<strong>' + escapeHtml(settings.title || "") + '</strong>' +
          '<span>' + escapeHtml(settings.subtitle || "") + '</span>' +
        '</span>' +
        (toggleMarkup || (meta ? '<span class="shop-account-menu-meta">' + escapeHtml(meta) + '</span>' : '')) +
        '<span class="shop-account-menu-arrow" aria-hidden="true">&rsaquo;</span>' +
      '</button>';
  }

  function accountLinkRowMarkup(options) {
    const settings = options && typeof options === "object" ? options : {};
    const href = String(settings.href || "").trim() || "/";
    const meta = String(settings.meta || "").trim();
    const icon = String(settings.icon || "").trim().slice(0, 3) || "#";
    return '' +
      '<a class="shop-account-menu-row shop-account-link-row" href="' + escapeHtml(href) + '">' +
        accountIconMarkup(icon, settings.title || "") +
        '<span class="shop-account-menu-copy">' +
          '<strong>' + escapeHtml(settings.title || "") + '</strong>' +
          '<span>' + escapeHtml(settings.subtitle || "") + '</span>' +
        '</span>' +
        (meta ? '<span class="shop-account-menu-meta">' + escapeHtml(meta) + '</span>' : '') +
        '<span class="shop-account-menu-arrow" aria-hidden="true">&rsaquo;</span>' +
      '</a>';
  }

  function accountRecordRowMarkup(options) {
    const settings = options && typeof options === "object" ? options : {};
    const actions = Array.isArray(settings.actions) ? settings.actions : [];
    const meta = String(settings.meta || "").trim();
    const icon = String(settings.icon || "").trim().slice(0, 3) || "#";
    return '' +
      '<div class="shop-account-menu-row shop-account-record-row' + (settings.danger ? ' is-danger' : '') + '">' +
        accountIconMarkup(icon, settings.title || "") +
        '<span class="shop-account-menu-copy">' +
          '<strong>' + escapeHtml(settings.title || "") + '</strong>' +
          '<span>' + escapeHtml(settings.subtitle || "") + '</span>' +
        '</span>' +
        (meta ? '<span class="shop-account-menu-meta">' + escapeHtml(meta) + '</span>' : '') +
        (actions.length ? '<span class="shop-account-inline-actions">' + actions.join('') + '</span>' : '') +
      '</div>';
  }

  function accountDraftFieldMarkup(label, key, value, options) {
    const settings = options && typeof options === "object" ? options : {};
    const type = String(settings.type || "text").trim() || "text";
    const autocomplete = String(settings.autocomplete || "").trim();
    const placeholder = String(settings.placeholder || "").trim();
    const inputMode = String(settings.inputMode || "").trim();
    return '' +
      '<label class="shop-login-field shop-account-field">' +
        '<span>' + escapeHtml(label || "") + '</span>' +
        '<input class="shop-login-input" type="' + escapeHtml(type) + '"' +
          (inputMode ? ' inputmode="' + escapeHtml(inputMode) + '"' : '') +
          ' data-account-draft-field="' + escapeHtml(key || "") + '"' +
          ' value="' + escapeHtml(value || "") + '"' +
          (placeholder ? ' placeholder="' + escapeHtml(placeholder) + '"' : '') +
          (autocomplete ? ' autocomplete="' + escapeHtml(autocomplete) + '"' : '') +
          ' spellcheck="false">' +
      '</label>';
  }

  function accountFormCardMarkup(content) {
    return '<div class="shop-account-form-card">' + String(content || "") + '</div>';
  }

  function setupDraftFromProfile(state) {
    const profile = state && state.buyerProfile && typeof state.buyerProfile === "object"
      ? state.buyerProfile
      : loadBuyerProfile();
	    return {
	      name: String(profile && profile.name || "").trim(),
	      contact: String(profile && profile.contact || "").trim(),
	      address: String(profile && profile.address || "").trim(),
	      step: "details",
	      verificationCode: "",
	      verifiedContact: "",
	      verifiedAt: 0,
	      submitting: false,
	      message: "",
	      tone: ""
	    };
	  }

  function ensureSetupDraft(state) {
    if (!state) return setupDraftFromProfile(null);
    if (!state.setupDraft || typeof state.setupDraft !== "object") {
      state.setupDraft = setupDraftFromProfile(state);
    }
    return state.setupDraft;
  }

  function persistSetupProfileDetails(state, name, contact, address, verifiedAt) {
    if (!state) return null;
    const safeName = String(name || "").trim().slice(0, 160);
    const safeContact = String(contact || "").trim().slice(0, 255);
    const safeAddress = String(address || "").trim().slice(0, 240);
    const safeVerifiedAt = Math.max(0, Number(verifiedAt || Math.floor(Date.now() / 1000)) || Math.floor(Date.now() / 1000));
    mergeBuyerProfile(state, {
      name: safeName,
      contact: safeContact,
      address: safeAddress
    });
    const existing = Array.isArray(state.accountAddresses) ? state.accountAddresses : loadAccountAddresses();
    const addressPoint = setupAddressPointFromState(state);
    const addressRecord = normalizeAccountAddress({
      id: "primary-address",
      label: safeName || "Home",
      text: safeAddress,
      lat: addressPoint ? addressPoint.lat : null,
      lng: addressPoint ? addressPoint.lng : null,
      isDefault: true,
      updatedAt: Date.now()
    });
    state.accountAddresses = saveAccountAddresses([addressRecord].concat(existing.filter(function (item) {
      const itemId = String(item && item.id || "");
      return itemId !== "primary-address" && itemId !== "person-primary-address";
    }).map(function (item) {
      return Object.assign({}, item, { isDefault: false });
    })));
    return saveSetupContactVerification(safeContact, safeVerifiedAt);
  }

  function completeVerifiedSetupDetails(state, name, contact, address, verifiedAt, message) {
    const draft = ensureSetupDraft(state);
    const record = persistSetupProfileDetails(state, name, contact, address, verifiedAt);
    draft.step = "done";
    draft.verifiedContact = String(record && record.contact || contact || "").trim();
    draft.verifiedAt = Number(record && record.verifiedAt || verifiedAt || Math.floor(Date.now() / 1000)) || Math.floor(Date.now() / 1000);
    draft.verificationCode = "";
    draft.submitting = false;
    draft.message = String(message || "Verified.");
    draft.tone = "success";
    renderShopList(state);
    resetPaneScroll(state);
  }

  function saveSetupDetails(state) {
    if (!state) return;
    const draft = ensureSetupDraft(state);
    if (draft.submitting) return;
    const name = String(draft.name || "").trim().slice(0, 160);
    const contact = String(draft.contact || "").trim().slice(0, 255);
    const address = String(draft.address || "").trim().slice(0, 240);
    if (!name) {
      draft.message = "Add name.";
      draft.tone = "error";
      renderShopList(state);
      return;
    }
    if (!contact) {
      draft.message = "Add contact.";
      draft.tone = "error";
      renderShopList(state);
      return;
    }
    const contactError = accountContactErrorMessage(contact);
    if (contactError) {
      draft.message = contactError;
      draft.tone = "error";
      renderShopList(state);
      return;
    }
    if (!address) {
      draft.message = "Add address.";
      draft.tone = "error";
      renderShopList(state);
      return;
    }
    draft.name = name;
    draft.contact = contact;
    draft.address = address;
    draft.verificationCode = "";
    draft.verifiedContact = "";
    draft.verifiedAt = 0;
    const existingVerifiedAt = setupContactVerificationTimestamp(state, contact);
    if (existingVerifiedAt) {
      completeVerifiedSetupDetails(state, name, contact, address, existingVerifiedAt, "Saved.");
      return;
    }
    draft.submitting = true;
    draft.message = "Sending code...";
    draft.tone = "";
    renderShopList(state);
    requestBuyerContactVerification(contact)
      .then(function (result) {
        draft.submitting = false;
        if (!result || !result.ok) {
          const error = String(result && result.payload && result.payload.error || "").trim();
          let message = "Could not send code.";
          if (error === "contact_required") {
            message = "Add contact.";
          } else if (error === "verification_rate_limited") {
            message = "Try again in a minute.";
          } else if (error === "auth_rate_limited") {
            message = "Too many tries. Wait a bit.";
          } else if (error === "email_delivery_failed") {
            message = "Email could not be sent.";
          } else if (error === "smtp_not_configured") {
            message = "Email is not configured.";
          } else if (error === "delivery_not_configured") {
            message = "Delivery is not configured.";
          }
          draft.message = message;
          draft.tone = "error";
          renderShopList(state);
          return;
        }
        const code = String(result.payload && (result.payload.verification_code || result.payload.reset_code) || "").trim();
        const delivery = result.payload && result.payload.delivery;
        if (code) draft.verificationCode = code;
        draft.step = "verify";
        draft.message = code ? "Code ready." : (delivery && delivery.sent ? "Check email." : "Enter code.");
        draft.tone = code || delivery && delivery.sent ? "success" : "";
        renderShopList(state);
        resetPaneScroll(state);
      })
      .catch(function () {
        draft.submitting = false;
        draft.message = "Could not send code.";
        draft.tone = "error";
        renderShopList(state);
      });
  }

  function completeSetupContactVerification(state) {
    if (!state) return;
    const draft = ensureSetupDraft(state);
    if (draft.submitting) return;
    const name = String(draft.name || "").trim().slice(0, 160);
    const contact = String(draft.contact || "").trim().slice(0, 255);
    const address = String(draft.address || "").trim().slice(0, 240);
    const verificationCode = String(draft.verificationCode || "").trim();
    if (!verificationCode) {
      draft.message = "Enter code.";
      draft.tone = "error";
      renderShopList(state);
      return;
    }
    draft.submitting = true;
    draft.message = "Checking...";
    draft.tone = "";
    renderShopList(state);
    verifyBuyerContact(contact, verificationCode)
      .then(function (result) {
        draft.submitting = false;
        if (!result || !result.ok) {
          const error = String(result && result.payload && result.payload.error || "").trim();
          draft.message = error === "verification_code_required" ? "Enter code." : "Wrong code.";
          draft.tone = "error";
          renderShopList(state);
          return;
        }
        const verifiedAt = Number(result.payload && result.payload.verified_at) || Math.floor(Date.now() / 1000);
        const verifiedContact = String(result.payload && result.payload.contact || contact).trim();
        completeVerifiedSetupDetails(state, name, verifiedContact || contact, address, verifiedAt, "Verified.");
      })
      .catch(function () {
        draft.submitting = false;
        draft.message = "Could not verify.";
        draft.tone = "error";
        renderShopList(state);
      });
  }

  function finishSetupPane(state) {
    if (!state) return;
    openAccountPane(state);
  }

  function editSetupDetails(state) {
    if (!state) return;
    const draft = ensureSetupDraft(state);
    draft.step = "details";
    draft.verificationCode = "";
    draft.message = "";
    draft.tone = "";
    renderShopList(state);
    resetPaneScroll(state);
  }

  function enableSetupAddressPicker(state, message) {
    if (!state) return;
    state.setupAddressPickActive = true;
    syncSetupAddressPickerUi(state);
    syncUserMarkerAdjustable(state);
    const draft = ensureSetupDraft(state);
    if (message) {
      draft.message = String(message || "");
      draft.tone = "";
      renderShopList(state);
    }
  }

  function setupAddressPointFromState(state) {
    if (!state) return null;
    if (state.setupAddressPickedPoint && isValidMapPoint(state.setupAddressPickedPoint.lat, state.setupAddressPickedPoint.lng)) {
      return {
        lat: Number(state.setupAddressPickedPoint.lat),
        lng: Number(state.setupAddressPickedPoint.lng),
        accuracy: Math.max(0, Number(state.setupAddressPickedPoint.accuracy || 0) || 0)
      };
    }
    if (state.savedUserLocation && isValidMapPoint(state.savedUserLocation.lat, state.savedUserLocation.lng)) {
      return {
        lat: Number(state.savedUserLocation.lat),
        lng: Number(state.savedUserLocation.lng),
        accuracy: Math.max(0, Number(state.savedUserLocation.accuracy || 0) || 0)
      };
    }
    return null;
  }

  function rememberSetupLocation(state, lat, lng, accuracy) {
    if (!state || !isValidMapPoint(lat, lng)) return false;
    state.userPoint = [Number(lat), Number(lng)];
    state.userPointSource = "address";
    state.savedUserLocation = {
      lat: Number(lat),
      lng: Number(lng),
      accuracy: accuracy || 0,
      source: "address",
      updatedAt: Date.now()
    };
    try {
      window.localStorage.setItem("hashop_last_location", JSON.stringify(state.savedUserLocation));
    } catch (error) {}
    if (state.map) {
      upsertUserMarker(state, lat, lng, accuracy, {
        source: "address",
        title: "Address pin"
      });
    } else {
      syncMapUiState(state);
    }
    syncUserMarkerAdjustable(state);
    return true;
  }

  function setSetupAddressFromPoint(state, lat, lng, accuracy, options) {
    if (!state || !rememberSetupLocation(state, lat, lng, accuracy)) return;
    const settings = options && typeof options === "object" ? options : {};
    state.setupAddressPickActive = true;
    state.setupAddressPickedPoint = {
      lat: Number(lat),
      lng: Number(lng),
      accuracy: Math.max(0, Number(accuracy || 0) || 0),
      updatedAt: Date.now()
    };
    state.setupAddressPickRequestId = Math.max(0, Number(state.setupAddressPickRequestId || 0) || 0) + 1;
    const requestId = state.setupAddressPickRequestId;
    const draft = ensureSetupDraft(state);
    draft.message = String(settings.pendingMessage || "Picking address...").trim();
    draft.tone = "";
    syncSetupAddressPickerUi(state);
    renderShopList(state);
    resolveAddress(lat, lng).then(function (addressText) {
      if (requestId !== state.setupAddressPickRequestId) return;
      const nextDraft = ensureSetupDraft(state);
      nextDraft.address = String(addressText || formatAccountCoordinates(lat, lng)).trim();
      nextDraft.message = String(settings.doneMessage || "Address picked. Hold map to adjust.").trim();
      nextDraft.tone = "success";
      renderShopList(state);
    }).catch(function () {
      if (requestId !== state.setupAddressPickRequestId) return;
      const nextDraft = ensureSetupDraft(state);
      nextDraft.address = formatAccountCoordinates(lat, lng);
      nextDraft.message = String(settings.doneMessage || "Address picked. Hold map to adjust.").trim();
      nextDraft.tone = "success";
      renderShopList(state);
    });
  }

  function setAccountProfileAddressFromPoint(state, lat, lng, accuracy, options) {
    if (!state || !rememberSetupLocation(state, lat, lng, accuracy)) return;
    const settings = options && typeof options === "object" ? options : {};
    const draft = ensureAccountDraft(state);
    state.accountProfileAddressPickActive = true;
    state.accountProfileAddressPickedPoint = {
      lat: Number(lat),
      lng: Number(lng),
      accuracy: Math.max(0, Number(accuracy || 0) || 0),
      updatedAt: Date.now()
    };
    state.accountProfileAddressPickRequestId = Math.max(0, Number(state.accountProfileAddressPickRequestId || 0) || 0) + 1;
    const requestId = state.accountProfileAddressPickRequestId;
    draft.profileEditorOpen = true;
    draft.message = String(settings.pendingMessage || "Picking address...").trim();
    draft.tone = "";
    syncSetupAddressPickerUi(state);
    renderShopList(state);
    resolveAddress(lat, lng).then(function (addressText) {
      if (requestId !== state.accountProfileAddressPickRequestId) return;
      const nextDraft = ensureAccountDraft(state);
      nextDraft.profileEditorOpen = true;
      nextDraft.profileAddress = String(addressText || formatAccountCoordinates(lat, lng)).trim();
      nextDraft.message = String(settings.doneMessage || "Address picked. Hold map to adjust.").trim();
      nextDraft.tone = "success";
      renderShopList(state);
    }).catch(function () {
      if (requestId !== state.accountProfileAddressPickRequestId) return;
      const nextDraft = ensureAccountDraft(state);
      nextDraft.profileEditorOpen = true;
      nextDraft.profileAddress = formatAccountCoordinates(lat, lng);
      nextDraft.message = String(settings.doneMessage || "Address picked. Hold map to adjust.").trim();
      nextDraft.tone = "success";
      renderShopList(state);
    });
  }

  function setMapAddressPickerFromPoint(state, lat, lng, accuracy, options) {
    if (accountProfileAddressPickerActive(state)) {
      setAccountProfileAddressFromPoint(state, lat, lng, accuracy, options);
      return;
    }
    setSetupAddressFromPoint(state, lat, lng, accuracy, options);
  }

  function currentMapCenterPoint(state) {
    if (!state || !state.map || typeof state.map.getCenter !== "function") return null;
    const center = state.map.getCenter();
    if (!center) return null;
    const lat = typeof center.lat === "function" ? center.lat() : center.lat;
    const lng = typeof center.lng === "function" ? center.lng() : center.lng;
    return isValidMapPoint(lat, lng) ? [Number(lat), Number(lng)] : null;
  }

  function startAccountProfileAddressPicker(state) {
    if (!state) return;
    const draft = ensureAccountDraft(state);
    state.accountProfileAddressPickActive = true;
    draft.profileEditorOpen = true;
    draft.message = "Hold map to move pin.";
    draft.tone = "";
    syncSetupAddressPickerUi(state);
    syncUserMarkerAdjustable(state);
    setPaneExpanded(state, false, "normal");
    const center = currentMapCenterPoint(state);
    if (center) {
      setAccountProfileAddressFromPoint(state, center[0], center[1], 0, {
        pendingMessage: "Picking map center...",
        doneMessage: "Map address picked. Hold map to adjust."
      });
      return;
    }
    renderShopList(state);
    resetPaneScroll(state);
  }

  function useSetupMapAddress(state) {
    if (!state) return;
    const draft = ensureSetupDraft(state);
    enableSetupAddressPicker(state, "Hold map to move pin.");
    if (state.userPoint && isFinite(state.userPoint[0]) && isFinite(state.userPoint[1])) {
      setSetupAddressFromPoint(state, state.userPoint[0], state.userPoint[1], state.savedUserLocation && state.savedUserLocation.accuracy, {
        doneMessage: "Address picked. Hold map to adjust."
      });
      return;
    }
    if (!navigator.geolocation) {
      draft.message = "Hold map to pick pin.";
      draft.tone = "";
      renderShopList(state);
      return;
    }
    draft.message = "Allow location or hold map.";
    draft.tone = "";
    renderShopList(state);
    navigator.geolocation.getCurrentPosition(function (position) {
      const lat = position && position.coords ? position.coords.latitude : null;
      const lng = position && position.coords ? position.coords.longitude : null;
      const accuracy = position && position.coords ? position.coords.accuracy : 0;
      if (!isFinite(lat) || !isFinite(lng)) {
        const invalidDraft = ensureSetupDraft(state);
        invalidDraft.message = "Location unavailable.";
        invalidDraft.tone = "error";
        renderShopList(state);
        return;
      }
      setSetupAddressFromPoint(state, lat, lng, accuracy, {
        doneMessage: "Address picked. Hold map to adjust."
      });
    }, function () {
      const nextDraft = ensureSetupDraft(state);
      nextDraft.message = "Hold map to pick pin.";
      nextDraft.tone = "";
      renderShopList(state);
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    });
  }

  function setAccountDraftMessage(state, message, tone) {
    const draft = ensureAccountDraft(state);
    draft.message = String(message || "");
    draft.tone = String(tone || "");
  }

  function accountAddressEditorOpen(state) {
    const draft = ensureAccountDraft(state);
    return !!draft.addressEditorOpen
      || !!String(draft.addressLabel || "").trim()
      || !!String(draft.addressText || "").trim();
  }

  function openAccountAddressEditor(state) {
    if (!state) return;
    const draft = ensureAccountDraft(state);
    draft.addressEditorOpen = true;
    setAccountDraftMessage(state, "", "");
    renderShopList(state);
    resetPaneScroll(state);
  }

  function closeAccountAddressEditor(state) {
    if (!state) return;
    const draft = ensureAccountDraft(state);
    draft.addressEditorOpen = false;
    draft.addressLabel = "";
    draft.addressText = "";
    setAccountDraftMessage(state, "", "");
    renderShopList(state);
    resetPaneScroll(state);
  }

  function saveAccountHelpRequest(state) {
    if (!state) return;
    const draft = ensureAccountDraft(state);
    const message = String(draft.helpText || "").trim().slice(0, 1200);
    if (!message) {
      setAccountDraftMessage(state, "Add a note.", "error");
      renderShopList(state);
      return;
    }
    const summary = accountProfileSummary(state);
    const request = normalizeAccountHelpRequest({
      message: message,
      name: summary.name,
      contact: summary.contact,
      buyerKey: ensureBuyerKey(),
      createdAt: Date.now()
    });
    let savedRequests = saveAccountHelpRequests([request].concat(loadAccountHelpRequests()));
    draft.helpText = "";
    setAccountDraftMessage(state, "Saving note...", "");
    renderShopList(state);
    postAccountHelpRequest(state, request)
      .then(function (result) {
        if (result && result.ok) {
          const serverRequest = result.payload && result.payload.request;
          const serverId = String(serverRequest && (serverRequest.help_id || serverRequest.id) || "").trim();
          savedRequests = saveAccountHelpRequests(savedRequests.map(function (item) {
            if (String(item && item.id || "") !== String(request && request.id || "")) return item;
            return Object.assign({}, item, {
              serverId: serverId,
              syncedAt: Date.now()
            });
          }));
          setAccountDraftMessage(state, "Saved.", "success");
          renderShopList(state);
          return;
        }
        setAccountDraftMessage(state, "Saved on this device.", "success");
        renderShopList(state);
      })
      .catch(function () {
        setAccountDraftMessage(state, "Saved on this device.", "success");
        renderShopList(state);
      });
  }

  function saveAccountProfileDetails(state) {
    if (!state) return;
    const draft = ensureAccountDraft(state);
    const name = String(draft.profileName || "").trim().slice(0, 160);
    const contact = String(draft.profileContact || "").trim().slice(0, 255);
    const address = String(draft.profileAddress || "").trim().slice(0, 240);
    if (!name && !contact && !address) {
      setAccountDraftMessage(state, "Add profile detail.", "error");
      renderShopList(state);
      return;
    }
    const session = state.accountSession || loadAccountSession();
    if (session) {
      const buyerAccount = accountBuyerAccount(session);
      const nextBuyerAccount = buyerAccount ? Object.assign({}, buyerAccount, {
        displayName: name || buyerAccount.displayName || "",
        contact: contact || buyerAccount.contact || ""
      }) : session.buyerAccount || null;
      setAccountSession(state, Object.assign({}, session, {
        displayName: name || contact || session.displayName || "",
        buyerAccount: nextBuyerAccount
      }));
    }
    mergeBuyerProfile(state, { name: name, contact: contact, address: address });
    if (address) {
      const existingAddresses = Array.isArray(state.accountAddresses) ? state.accountAddresses : loadAccountAddresses();
      const pickedPoint = state.accountProfileAddressPickedPoint && isValidMapPoint(state.accountProfileAddressPickedPoint.lat, state.accountProfileAddressPickedPoint.lng)
        ? state.accountProfileAddressPickedPoint
        : null;
      const profileAddress = normalizeAccountAddress({
        id: "profile-address",
        label: name || "Profile address",
        text: address,
        lat: pickedPoint ? pickedPoint.lat : null,
        lng: pickedPoint ? pickedPoint.lng : null,
        isDefault: true,
        updatedAt: Date.now()
      });
      state.accountAddresses = saveAccountAddresses([profileAddress].concat(existingAddresses.filter(function (item) {
        return String(item && item.id || "") !== "profile-address";
      }).map(function (item) {
        return Object.assign({}, item, { isDefault: false });
      })));
    }
    draft.profileName = name;
    draft.profileContact = contact;
    draft.profileAddress = address;
    draft.profileEditorOpen = false;
    setAccountDraftMessage(state, "Profile saved.", "success");
    state.accountProfileAddressPickActive = false;
    syncSetupAddressPickerUi(state);
    syncUserMarkerAdjustable(state);
    syncActionButton(state);
    syncBackButton(state);
    renderShopList(state);
  }

  function saveManualAccountAddress(state) {
    if (!state) return;
    const draft = ensureAccountDraft(state);
    const label = String(draft.addressLabel || "").trim().slice(0, 80);
    const text = String(draft.addressText || "").trim().slice(0, 240);
    if (!label && !text) {
      setAccountDraftMessage(state, "Add a label or address.", "error");
      renderShopList(state);
      return;
    }
    const existing = Array.isArray(state.accountAddresses) ? state.accountAddresses : loadAccountAddresses();
    const address = normalizeAccountAddress({
      label: label || "Saved place",
      text: text || label || "Saved address",
      isDefault: !existing.length,
      updatedAt: Date.now()
    });
    state.accountAddresses = saveAccountAddresses([address].concat(existing));
    if (address && address.text) {
      mergeBuyerProfile(state, { address: address.text });
    }
    draft.addressEditorOpen = false;
    draft.addressLabel = "";
    draft.addressText = "";
    setAccountDraftMessage(state, "", "");
    renderShopList(state);
  }

  function saveCurrentLocationAsAccountAddress(state) {
    if (!state) return;
    const draft = ensureAccountDraft(state);
    if (!state.userPoint || !isFinite(state.userPoint[0]) || !isFinite(state.userPoint[1])) {
      setAccountDraftMessage(state, "Allow location first.", "error");
      renderShopList(state);
      locateUser(state, false);
      return;
    }
    const lat = Number(state.userPoint[0]);
    const lng = Number(state.userPoint[1]);
    const existing = Array.isArray(state.accountAddresses) ? state.accountAddresses : loadAccountAddresses();
    const filtered = existing.filter(function (item) {
      return !(item && isFinite(item.lat) && isFinite(item.lng) && Math.abs(Number(item.lat) - lat) < 0.00005 && Math.abs(Number(item.lng) - lng) < 0.00005);
    });
    setAccountDraftMessage(state, "Saving location...", "");
    renderShopList(state);
    resolveAddress(lat, lng).then(function (addressText) {
      const address = normalizeAccountAddress({
        label: String(draft.addressLabel || "Current location").trim() || "Current location",
        text: String(addressText || draft.addressText || formatAccountCoordinates(lat, lng)).trim(),
        lat: lat,
        lng: lng,
        isDefault: true,
        updatedAt: Date.now()
      });
      state.accountAddresses = saveAccountAddresses([address].concat(filtered.map(function (item) {
        return Object.assign({}, item, { isDefault: false });
      })));
      if (address && address.text) {
        mergeBuyerProfile(state, { address: address.text });
      }
      draft.addressEditorOpen = false;
      draft.addressLabel = "";
      draft.addressText = "";
      setAccountDraftMessage(state, "", "");
      renderShopList(state);
    });
  }

  function setDefaultAccountAddress(state, addressId) {
    const safeId = String(addressId || "").trim();
    if (!state || !safeId) return;
    const addresses = Array.isArray(state.accountAddresses) ? state.accountAddresses : loadAccountAddresses();
    state.accountAddresses = saveAccountAddresses(addresses.map(function (address) {
      return Object.assign({}, address, {
        isDefault: String(address && address.id || "") === safeId,
        updatedAt: String(address && address.id || "") === safeId ? Date.now() : address.updatedAt
      });
    }));
    const selectedAddress = state.accountAddresses.find(function (address) {
      return String(address && address.id || "") === safeId;
    });
    if (selectedAddress && selectedAddress.text) {
      mergeBuyerProfile(state, { address: selectedAddress.text });
    }
    applyAccountAddressLocation(state, selectedAddress, { feedback: false });
    setAccountDraftMessage(state, "", "");
    renderShopList(state);
  }

  function removeAccountAddress(state, addressId) {
    const safeId = String(addressId || "").trim();
    if (!state || !safeId) return;
    const addresses = Array.isArray(state.accountAddresses) ? state.accountAddresses : loadAccountAddresses();
    state.accountAddresses = saveAccountAddresses(addresses.filter(function (address) {
      return String(address && address.id || "") !== safeId;
    }));
    const draft = ensureAccountDraft(state);
    draft.addressEditorOpen = false;
    draft.addressLabel = "";
    draft.addressText = "";
    setAccountDraftMessage(state, "", "");
    renderShopList(state);
  }

  function saveManualAccountPayment(state) {
    if (!state) return;
    const draft = ensureAccountDraft(state);
    const label = String(draft.paymentLabel || "").trim().slice(0, 80);
    const detail = String(draft.paymentDetail || "").trim().slice(0, 160);
    if (!label && !detail) {
      setAccountDraftMessage(state, "Add payment detail.", "error");
      renderShopList(state);
      return;
    }
    const existing = Array.isArray(state.accountPayments) ? state.accountPayments : loadAccountPayments();
    const payment = normalizeAccountPayment({
      label: label || "UPI",
      detail: detail || label,
      isDefault: !existing.length,
      updatedAt: Date.now()
    });
    const filtered = existing.filter(function (item) {
      return String(item && item.detail || "").toLowerCase() !== String(payment.detail || "").toLowerCase();
    });
    state.accountPayments = saveAccountPayments([payment].concat(filtered));
    draft.paymentLabel = "";
    draft.paymentDetail = "";
    setAccountDraftMessage(state, "Payment saved.", "success");
    renderShopList(state);
  }

  function setDefaultAccountPayment(state, paymentId) {
    const safeId = String(paymentId || "").trim();
    if (!state || !safeId) return;
    const payments = Array.isArray(state.accountPayments) ? state.accountPayments : loadAccountPayments();
    state.accountPayments = saveAccountPayments(payments.map(function (payment) {
      const selected = safeId !== "receive" && String(payment && payment.id || "") === safeId;
      return Object.assign({}, payment, {
        isDefault: selected,
        updatedAt: selected ? Date.now() : payment.updatedAt
      });
    }));
    setAccountDraftMessage(state, safeId === "receive" ? "Pay on receive selected." : "Payment selected.", "success");
    renderShopList(state);
  }

  function removeAccountPayment(state, paymentId) {
    const safeId = String(paymentId || "").trim();
    if (!state || !safeId) return;
    const payments = Array.isArray(state.accountPayments) ? state.accountPayments : loadAccountPayments();
    state.accountPayments = saveAccountPayments(payments.filter(function (payment) {
      return String(payment && payment.id || "") !== safeId;
    }));
    setAccountDraftMessage(state, "Payment removed.", "success");
    renderShopList(state);
  }

  function clearAccountSavedLocation(state) {
    if (!state) return;
    try {
      window.localStorage.removeItem("hashop_last_location");
    } catch (error) {}
    state.userPoint = null;
    state.userPointSource = "";
    state.savedUserLocation = null;
    if (state.userMarker) {
      if (state.mapProvider === "google" && typeof state.userMarker.setMap === "function") {
        state.userMarker.setMap(null);
      } else if (state.map && typeof state.map.removeLayer === "function") {
        state.map.removeLayer(state.userMarker);
      }
    }
    if (state.userAccuracy) {
      if (state.mapProvider === "google" && typeof state.userAccuracy.setMap === "function") {
        state.userAccuracy.setMap(null);
      } else if (state.map && typeof state.map.removeLayer === "function") {
        state.map.removeLayer(state.userAccuracy);
      }
    }
    state.userMarker = null;
    state.userAccuracy = null;
    setAccountDraftMessage(state, "Location cleared.", "success");
    syncMapUiState(state);
    updateMapView(state);
    syncActionButton(state);
    renderShopList(state);
  }

  function accountSubPanelMarkup(options) {
    const settings = options && typeof options === "object" ? options : {};
    const rows = Array.isArray(settings.rows) ? settings.rows : [];
    const actions = Array.isArray(settings.actions) ? settings.actions : [];
    const body = String(settings.body || "");
    const subtitle = String(settings.subtitle || "").trim();
    return '' +
      '<section class="shop-pane-detail" style="--shop-color:' + HASHOP_ACCOUNT_ACTION_COLOR + ';">' +
        '<div class="shop-account-stack">' +
          '<button class="shop-account-back-row" type="button" data-account-main="true">' +
          accountIconMarkup("back", "Back") +
            '<span class="shop-account-menu-copy">' +
              '<strong>' + escapeHtml(settings.title || "Account") + '</strong>' +
              (subtitle ? '<span>' + escapeHtml(subtitle) + '</span>' : '') +
            '</span>' +
          '</button>' +
          (body ? '<div class="shop-account-state-body">' + body + '</div>' : '') +
          (rows.length ? '<section class="shop-account-menu-card shop-account-state-card">' + rows.join('') + '</section>' : '') +
          (actions.length ? '<div class="shop-account-actions shop-account-state-actions">' + actions.join('') + '</div>' : '') +
        '</div>' +
      '</section>';
  }

  function renderAccountPane(state) {
    if (!state || !state.listNode) return;
    destroyOwnerPickupMap(state);
    const session = state.accountSession || loadAccountSession();
    const ownerShops = accountOwnerShops(session);
    const ownerCount = ownerShops.length;
    const buyerAccount = accountBuyerAccount(session);
    const accountPaneMode = String(state.accountPaneMode || "").trim();
    if (accountPaneMode === "buyer-login") {
      state.listNode.innerHTML = buyerAccountSignInMarkup(state, { showBack: true });
      return;
    }
    const buyerOrders = Array.isArray(state.buyerOrders) ? state.buyerOrders : [];
    const guestOrderCount = recentBuyerOrderCount(state);
    const hasBuyer = !!buyerAccount;
    const signedIn = hasBuyer || ownerCount > 0;
    state.accountAddresses = Array.isArray(state.accountAddresses) ? state.accountAddresses : loadAccountAddresses();
    state.accountPayments = Array.isArray(state.accountPayments) ? state.accountPayments : loadAccountPayments();
    const savedAddresses = normalizeAccountAddresses(state.accountAddresses);
    const savedPayments = normalizeAccountPayments(state.accountPayments);
    state.accountAddresses = savedAddresses;
    state.accountPayments = savedPayments;
    const activeAddress = defaultAccountAddress(state);
    const activePayment = defaultAccountPayment(state);
    const localProfileSummary = accountProfileSummary(state);
    const hasLocalProfile = hasLocalAccountProfile(state);
    const hasOrderHistory = hasBuyer || buyerOrders.length > 0 || guestOrderCount > 0;
    if (!signedIn && !accountPaneMode && !hasOrderHistory && !hasLocalProfile) {
      state.listNode.innerHTML = buyerAccountSignInMarkup(state, { showBack: false });
      return;
    }
    const shouldShowHistory = accountPaneMode === "buyer-orders";
    const shownBuyerOrders = buyerOrders.slice(0, 5);
    const historyRows = [];
    shownBuyerOrders.forEach(function (order) {
      const canCancel = canBuyerCancelOrder(order);
      const canOpenShop = shouldShowRecentOrderShopAction(order);
      const status = normalizedOrderStatus(order);
      historyRows.push(
        '<article class="shop-owner-order-card shop-buyer-order-card is-status-' + escapeHtml(status) + '" style="--shop-color:' + escapeHtml(order.shopMapColor || HASHOP_DEFAULT_SHOP_COLOR) + ';">' +
          '<div class="shop-owner-order-head">' +
            '<strong>' + escapeHtml(order.title || "Order") + '</strong>' +
            '<span class="shop-owner-order-status">' + escapeHtml(buyerOrderStatusText(order)) + '</span>' +
          '</div>' +
          '<div class="shop-owner-order-meta shop-buyer-order-line">' +
            '<span class="shop-buyer-order-shop">' + escapeHtml(recentOrderShopLine(order)) + '</span>' +
          '</div>' +
          '<div class="shop-owner-order-meta shop-buyer-order-line">' +
            '<span>' + escapeHtml(recentOrderPaymentLine(order)) + '</span>' +
          '</div>' +
          orderItemsMarkup(order, null, { compact: true, limit: 2 }) +
          '<p>' + escapeHtml(buyerOrderSummary(order)) + '</p>' +
          ((canOpenShop || canCancel) ? (
            '<div class="shop-owner-order-actions shop-buyer-order-actions">' +
              (canOpenShop ? '<button class="shop-owner-save" type="button" data-open-recent-shop="' + escapeHtml(order.shopId || "") + '">View shop</button>' : '') +
              (canCancel ? '<button class="shop-owner-chip-button is-danger" type="button" data-cancel-buyer-order="' + escapeHtml(order.id || "") + '" data-cancel-shop-id="' + escapeHtml(order.shopId || "") + '">Cancel order</button>' : '') +
            '</div>'
          ) : '') +
        '</article>'
      );
    });
    const historyBodyMarkup = historyRows.length
      ? '<div class="shop-owner-order-list">' + historyRows.join('') + '</div>'
      : '<p class="shop-account-note">' + escapeHtml(state.buyerOrdersLoading ? "Loading history..." : "No orders yet.") + '</p>';
    if (shouldShowHistory) {
      state.listNode.innerHTML = accountSubPanelMarkup({
        title: "Orders",
        subtitle: state.buyerOrdersLoading ? "Checking" : buyerHistorySummaryLabel(0, buyerOrders.length || guestOrderCount),
        body: historyBodyMarkup,
        actions: hasBuyer ? [
          '<button class="shop-owner-chip-button" type="button" data-refresh-account-history="true">Refresh</button>'
        ] : []
      });
      return;
    }
    const buyerAccountLabel = buyerAccount
      ? String(buyerAccount.displayName || buyerAccount.contact || "Account").trim()
      : String(localProfileSummary.name || localProfileSummary.contact || "").trim()
        || (ownerCount ? String(session && session.displayName || "Saved account").trim() : "Guest");
    const buyerContact = buyerAccount
      ? String(buyerAccount.contact || "").trim()
      : String(localProfileSummary.contact || "").trim();
    const accountVerified = hasBuyer || setupContactIsVerified(state, buyerContact);
    const savedLocationLabel = accountSavedLocationLabel(state);
    const accountSubline = accountVerified
      ? "Verified contact"
      : hasLocalProfile ? "Saved on this device" : "Guest checkout";
    const accountAvatarUrl = String(localProfileSummary.avatarUrl || state.buyerProfile && state.buyerProfile.avatarUrl || "").trim();
    const accountInitial = String(buyerAccountLabel || buyerContact || "#").trim().charAt(0).toUpperCase() || "#";
    function accountAvatarMarkup(className) {
      const safeClassName = String(className || "").trim();
      return '' +
        '<span class="shop-account-avatar' + (safeClassName ? (' ' + escapeHtml(safeClassName)) : '') + '" aria-hidden="true">' +
          (accountAvatarUrl ? '<img src="' + escapeHtml(accountAvatarUrl) + '" alt="">' : escapeHtml(accountInitial)) +
        '</span>';
    }
    const ownerShopRows = ownerShops.map(function (shop) {
      const shopId = String(shop && shop.shopId || "").trim();
      const isPreferred = shopId && shopId === preferredOwnerShopId(session, state.ownerShopId);
      return '' +
        '<button class="shop-account-menu-row" type="button" data-account-open-shop="' + escapeHtml(shopId) + '">' +
          accountIconMarkup("S", "Shop") +
          '<span class="shop-account-menu-copy">' +
            '<strong>' + escapeHtml(shop.shopName || shopId || "My shop") + '</strong>' +
            '<span>' + escapeHtml(isPreferred ? "Active shop workspace" : "Open shop workspace") + '</span>' +
          '</span>' +
          '<span class="shop-account-menu-arrow" aria-hidden="true">&rsaquo;</span>' +
        '</button>';
    });
    const accountDraft = ensureAccountDraft(state);
    if (!Object.prototype.hasOwnProperty.call(accountDraft, "profileName")) {
      accountDraft.profileName = buyerAccountLabel || "";
    }
    if (!Object.prototype.hasOwnProperty.call(accountDraft, "profileContact")) {
      accountDraft.profileContact = buyerContact || "";
    }
    if (!Object.prototype.hasOwnProperty.call(accountDraft, "profileAddress")) {
      accountDraft.profileAddress = buyerCheckoutAddress(state, state.buyerProfile || {});
    }
    const profileNameValue = accountDraftValue(state, "profileName", buyerAccountLabel);
    const profileContactValue = accountDraftValue(state, "profileContact", buyerContact);
    const profileAddressValue = accountDraftValue(state, "profileAddress", buyerCheckoutAddress(state, state.buyerProfile || {}));
    const profileEditorOpen = !!accountDraft.profileEditorOpen;
    const currentLocationText = state.userPoint
      ? formatAccountCoordinates(state.userPoint[0], state.userPoint[1])
      : (state.savedUserLocation ? formatAccountCoordinates(state.savedUserLocation.lat, state.savedUserLocation.lng) : "Not set");
    const addressRows = savedAddresses.map(function (address) {
      const addressId = String(address && address.id || "").trim();
      return accountRecordRowMarkup({
        icon: "A",
        title: address.label || "Saved place",
        subtitle: address.text || "Saved location",
        meta: address.isDefault ? "Default" : "",
        actions: [
          address.isDefault ? '' : '<button class="shop-account-mini-button" type="button" data-account-set-address-default="' + escapeHtml(addressId) + '">Use</button>',
          '<button class="shop-account-mini-button is-danger" type="button" data-account-remove-address="' + escapeHtml(addressId) + '">Remove</button>'
        ].filter(Boolean)
      });
    });
    const paymentRows = savedPayments.map(function (payment) {
      const paymentId = String(payment && payment.id || "").trim();
      return accountRecordRowMarkup({
        icon: "Rs",
        title: payment.label || "Payment",
        subtitle: payment.detail || "Saved payment",
        meta: payment.isDefault ? "Default" : "",
        actions: [
          payment.isDefault ? '' : '<button class="shop-account-mini-button" type="button" data-account-set-payment-default="' + escapeHtml(paymentId) + '">Use</button>',
          '<button class="shop-account-mini-button is-danger" type="button" data-account-remove-payment="' + escapeHtml(paymentId) + '">Remove</button>'
        ].filter(Boolean)
      });
    });
    if (accountPaneMode === "profile") {
      const profileSubtitle = accountVerified ? "Verified details" : hasLocalProfile ? "Saved details" : "Guest details";
      const profileAddressPoint = state.accountProfileAddressPickedPoint && isValidMapPoint(state.accountProfileAddressPickedPoint.lat, state.accountProfileAddressPickedPoint.lng)
        ? formatAccountCoordinates(state.accountProfileAddressPickedPoint.lat, state.accountProfileAddressPickedPoint.lng)
        : currentLocationText;
      if (!profileEditorOpen) {
        state.listNode.innerHTML = accountSubPanelMarkup({
          title: "Profile",
          subtitle: profileSubtitle,
          body: '' +
            '<section class="shop-account-profile-view">' +
              '<div class="shop-account-profile-hero">' +
                accountAvatarMarkup("is-large") +
                '<span class="shop-account-profile-copy">' +
                  '<strong>' + escapeHtml(profileNameValue || buyerAccountLabel || "Guest buyer") + '</strong>' +
                  '<span>' + escapeHtml(buyerContact || accountSubline) + '</span>' +
                '</span>' +
              '</div>' +
              '<section class="shop-account-menu-card shop-account-profile-details">' +
                accountRecordRowMarkup({ icon: "P", title: "Name", subtitle: profileNameValue || "Not set", meta: profileNameValue ? "Saved" : "" }) +
                accountRecordRowMarkup({ icon: "In", title: "Contact", subtitle: profileContactValue || "Not set", meta: accountVerified ? "Verified" : "" }) +
                accountRecordRowMarkup({
                  icon: "A",
                  title: "Address",
                  subtitle: profileAddressValue || "Not set",
                  meta: state.accountProfileAddressPickedPoint ? "Map" : "",
                  actions: [
                    '<button class="shop-account-mini-button" type="button" data-account-profile-map-address="true">Map</button>'
                  ]
                }) +
                accountRecordRowMarkup({ icon: "L", title: "Map pin", subtitle: profileAddressPoint || "Not set", meta: state.accountProfileAddressPickActive ? "Active" : "" }) +
              '</section>' +
              accountStatusMarkup(state) +
            '</section>',
          actions: [
            '<button class="shop-owner-save" type="button" data-account-edit-profile="true">Edit profile</button>',
            hasBuyer ? '<button class="shop-owner-chip-button" type="button" data-account-menu="password">Password reset</button>' : '<button class="shop-owner-chip-button" type="button" data-account-open-buyer-login="true">Sign in</button>'
          ]
        });
        return;
      }
      state.listNode.innerHTML = accountSubPanelMarkup({
        title: "Edit profile",
        subtitle: profileSubtitle,
        body: accountFormCardMarkup(
          '<div class="shop-account-media-field">' +
            accountAvatarMarkup("is-edit") +
            '<span class="shop-account-media-copy">' +
              '<strong>Profile image</strong>' +
              '<span>Used on this device.</span>' +
            '</span>' +
            '<label class="shop-owner-upload-button shop-account-upload-button">' +
              '<input class="shop-owner-file-input" type="file" accept="image/*" data-account-avatar-input="true">' +
              '<span>' + escapeHtml(accountAvatarUrl ? "Replace" : "Add image") + '</span>' +
            '</label>' +
          '</div>' +
          accountDraftFieldMarkup("Name", "profileName", profileNameValue, { autocomplete: "name", placeholder: "Your name" }) +
          accountDraftFieldMarkup("Phone or email", "profileContact", profileContactValue, { autocomplete: "username", placeholder: "Phone or email" }) +
          accountDraftFieldMarkup("Address", "profileAddress", profileAddressValue, { autocomplete: "street-address", placeholder: "House, road, or pickup note" }) +
          '<div class="shop-account-map-row">' +
            '<button class="shop-account-mini-button" type="button" data-account-profile-map-address="true">Pick on map</button>' +
            '<span>' + escapeHtml(state.accountProfileAddressPickActive ? "Hold map to adjust pin." : "Use the map frame for accuracy.") + '</span>' +
          '</div>' +
          accountStatusMarkup(state) +
          '<div class="shop-account-actions shop-account-form-actions">' +
            '<button class="shop-owner-save" type="button" data-account-save-profile="true">Save profile</button>' +
            '<button class="shop-owner-chip-button" type="button" data-account-cancel-profile-edit="true">Cancel</button>' +
          '</div>'
        )
      });
      return;
    }
    if (accountPaneMode === "addresses") {
      const showAddressForm = accountAddressEditorOpen(state);
      state.listNode.innerHTML = accountSubPanelMarkup({
        title: "Saved Addresses",
        subtitle: "Past delivery places",
        body: '' +
          '<div class="shop-account-menu-card">' +
            accountRecordRowMarkup({
              icon: "L",
              title: "Current location",
              subtitle: currentLocationText || savedLocationLabel,
              meta: state.userPoint ? "Ready" : "Set",
              actions: [
                '<button class="shop-account-mini-button" type="button" data-account-use-current-address="true">' + (state.userPoint ? "Save" : "Locate") + '</button>'
              ]
            }) +
            (addressRows.length ? addressRows.join('') : accountRecordRowMarkup({
              icon: "A",
              title: "No saved address",
              subtitle: "Add one when delivery needs it",
              meta: "",
              actions: [
                '<button class="shop-account-mini-button" type="button" data-account-add-address="true">Add</button>'
              ]
            })) +
            (addressRows.length ? accountRecordRowMarkup({
              icon: "+",
              title: "Add address",
              subtitle: "Save another delivery place",
              meta: "",
              actions: [
                '<button class="shop-account-mini-button" type="button" data-account-add-address="true">Add</button>'
              ]
            }) : '') +
          '</div>' +
          (showAddressForm ? accountFormCardMarkup(
            accountDraftFieldMarkup("Label", "addressLabel", accountDraftValue(state, "addressLabel", ""), { placeholder: "Home, shop, school" }) +
            accountDraftFieldMarkup("Address", "addressText", accountDraftValue(state, "addressText", ""), { placeholder: "Street or local area" }) +
            accountStatusMarkup(state) +
            '<div class="shop-account-actions shop-account-form-actions">' +
              '<button class="shop-owner-save" type="button" data-account-save-address="true">Save address</button>' +
              '<button class="shop-owner-chip-button" type="button" data-account-cancel-address="true">Cancel</button>' +
              '<button class="shop-owner-chip-button" type="button" data-account-use-current-address="true">Use current location</button>' +
            '</div>'
          ) : '')
      });
      return;
    }
    if (accountPaneMode === "payments") {
      state.listNode.innerHTML = accountSubPanelMarkup({
        title: "Payment Methods",
        subtitle: "How you pay",
        body: '' +
          '<div class="shop-account-menu-card">' +
            accountRecordRowMarkup({
              icon: "Rs",
              title: "Pay on receive",
              subtitle: "Cash / direct",
              meta: activePayment ? "" : "Default",
              actions: activePayment ? [
                '<button class="shop-account-mini-button" type="button" data-account-set-payment-default="receive">Use</button>'
              ] : []
            }) +
            (paymentRows.length ? paymentRows.join('') : accountRecordRowMarkup({
              icon: "Rs",
              title: "No saved UPI",
              subtitle: "Add UPI below",
              meta: ""
            })) +
          '</div>' +
          accountFormCardMarkup(
            accountDraftFieldMarkup("Label", "paymentLabel", accountDraftValue(state, "paymentLabel", ""), { placeholder: "UPI, wallet, card note" }) +
            accountDraftFieldMarkup("UPI ID / wallet", "paymentDetail", accountDraftValue(state, "paymentDetail", ""), { placeholder: "example@upi" }) +
            accountStatusMarkup(state) +
            '<div class="shop-account-actions shop-account-form-actions">' +
              '<button class="shop-owner-save" type="button" data-account-save-payment="true">Save payment</button>' +
            '</div>'
          )
      });
      return;
    }
    if (accountPaneMode === "shops") {
      state.listNode.innerHTML = accountSubPanelMarkup({
        title: ownerCount ? "Manage Shops" : "Add Shop",
        subtitle: ownerCount ? "Shops, items, sales" : "Verify email and enter shop details",
        rows: ownerShopRows.length ? ownerShopRows : [
          accountRecordRowMarkup({
            icon: "S",
            title: "No shop yet",
            subtitle: "Add shop details first",
            meta: ""
          })
        ],
        actions: [
          '<button class="shop-owner-save" type="button" data-account-open-login="true">Add shop</button>'
        ]
      });
      return;
    }
    if (accountPaneMode === "help") {
      const helpRequests = loadAccountHelpRequests().slice(0, 3);
      const helpTextValue = accountDraftValue(state, "helpText", "");
      const helpRows = helpRequests.map(function (request) {
        const note = String(request && request.message || "").trim();
        return accountRecordRowMarkup({
          icon: "H",
          title: "Saved note",
          subtitle: note.length > 120 ? (note.slice(0, 117) + "...") : note,
          meta: request.syncedAt ? "Sent" : "Local"
        });
      });
      state.listNode.innerHTML = accountSubPanelMarkup({
        title: "Help & Support",
        subtitle: "Questions and feedback",
        body: accountFormCardMarkup(
          '<label class="shop-login-field shop-account-field">' +
            '<span>What happened</span>' +
            '<textarea class="shop-login-input shop-account-textarea" data-account-draft-field="helpText" placeholder="Order, shop, setup, or account issue" spellcheck="true">' + escapeHtml(helpTextValue) + '</textarea>' +
          '</label>' +
          accountStatusMarkup(state) +
          '<div class="shop-account-actions shop-account-form-actions">' +
            '<button class="shop-owner-save" type="button" data-account-save-help="true">Save note</button>' +
          '</div>'
        ) +
        (helpRows.length ? '<section class="shop-account-menu-card shop-account-help-log">' + helpRows.join('') + '</section>' : ''),
        rows: [
          accountMenuRowMarkup({ icon: "O", title: "Orders", subtitle: "Check or cancel orders", action: "orders" }),
          accountMenuRowMarkup({ icon: "S", title: "Shops", subtitle: "Manage your shops", action: "shops" }),
          accountMenuRowMarkup({ icon: "P", title: "Profile", subtitle: "Edit your details", action: "profile" })
        ]
      });
      return;
    }
    if (accountPaneMode === "settings") {
      state.listNode.innerHTML = accountSubPanelMarkup({
        title: "Settings",
        subtitle: "Account controls",
        rows: [
          signedIn ? accountMenuRowMarkup({ icon: "P", title: "Profile", subtitle: buyerContact || buyerAccountLabel || "Account", action: "profile" }) : accountMenuRowMarkup({ icon: "P", title: "Sign in", subtitle: "Open buyer account", attr: ' data-account-open-buyer-login="true"' }),
          accountMenuRowMarkup({ icon: "A", title: "Saved Addresses", subtitle: activeAddress ? (activeAddress.text || activeAddress.label) : "None", action: "addresses", meta: savedAddresses.length ? String(savedAddresses.length) : "" }),
          accountMenuRowMarkup({ icon: "Rs", title: "Payment Methods", subtitle: activePayment ? activePayment.label : "Pay on receive", action: "payments", meta: savedPayments.length ? String(savedPayments.length) : "" }),
          accountMenuRowMarkup({ icon: "S", title: "Shops", subtitle: ownerCount ? (ownerCount === 1 ? "1 shop" : (ownerCount + " shops")) : "None", action: "shops" }),
          state.userPoint || state.savedUserLocation ? accountRecordRowMarkup({
            icon: "L",
            title: "Saved map location",
            subtitle: currentLocationText || "Current location",
            actions: [
              '<button class="shop-account-mini-button is-danger" type="button" data-account-clear-location="true">Clear</button>'
            ]
          }) : '',
          signedIn ? accountMenuRowMarkup({
            icon: "!",
            title: "Sign out",
            subtitle: "Leave account",
            attr: ' data-account-signout="true"',
            danger: true
          }) : ''
        ].filter(Boolean)
      });
      return;
    }
    const profileHeroMarkup = '' +
      '<button class="shop-account-profile-card shop-account-hero-card" type="button" data-account-menu="profile">' +
        accountAvatarMarkup("") +
        '<span class="shop-account-profile-copy">' +
          '<strong>' + escapeHtml(buyerAccountLabel || "Account") + '</strong>' +
          '<span>' + escapeHtml(accountSubline) + '</span>' +
          '<em class="' + (accountVerified ? 'is-signed-in' : 'is-guest') + '">' + escapeHtml(accountVerified ? "Verified" : hasLocalProfile ? "Local" : "Guest") + '</em>' +
        '</span>' +
        '<span class="shop-account-menu-arrow" aria-hidden="true">&rsaquo;</span>' +
      '</button>';
    const deliveryLabel = String(
      activeAddress && (activeAddress.text || activeAddress.label)
      || localProfileSummary.address
      || savedLocationLabel
      || "Set address"
    ).trim();
    const locationMarkup = '' +
      '<button class="shop-account-location-card" type="button" data-account-menu="addresses">' +
        accountIconMarkup("A", "Delivery address") +
        '<span class="shop-account-menu-copy">' +
          '<span>Delivery address</span>' +
          '<strong>' + escapeHtml(deliveryLabel) + '</strong>' +
        '</span>' +
        '<span class="shop-account-menu-meta">' + escapeHtml(activeAddress || localProfileSummary.address ? "Edit" : "Set") + '</span>' +
        '<span class="shop-account-menu-arrow" aria-hidden="true">&rsaquo;</span>' +
      '</button>';
    const authRows = hasBuyer ? [] : [
      accountMenuRowMarkup({ icon: "In", title: "Sign in", subtitle: "Use an existing account", attr: ' data-account-open-buyer-login="true"' }),
      accountMenuRowMarkup({ icon: "+", title: "Create account", subtitle: "Save across devices", attr: ' data-account-open-buyer-create="true"' })
    ];
    const buyingRows = [
      accountMenuRowMarkup({ icon: "P", title: "Profile", subtitle: buyerContact || "Name and contact", action: "profile" }),
      accountMenuRowMarkup({ icon: "O", title: "Orders", subtitle: hasOrderHistory ? "Past and ongoing" : "No orders yet", action: "orders", meta: hasOrderHistory ? buyerHistorySummaryLabel(0, buyerOrders.length || guestOrderCount) : "" }),
      accountMenuRowMarkup({ icon: "A", title: "Addresses", subtitle: activeAddress ? "Delivery saved" : "No address saved", action: "addresses", meta: savedAddresses.length ? String(savedAddresses.length) : "" }),
      accountMenuRowMarkup({ icon: "Rs", title: "Payment", subtitle: activePayment ? activePayment.label : "Pay on receive / direct", action: "payments", meta: savedPayments.length ? String(savedPayments.length) : "" })
    ];
    const shopRows = [];
    if (ownerCount) {
      const ownerShop = ownerCount === 1 ? ownerShops[0] : null;
      const ownerShopId = String(ownerShop && ownerShop.shopId || "").trim();
      const ownerModeOn = isOwnerAccountMode(state);
      shopRows.push(accountMenuRowMarkup({
        icon: "S",
        title: "Manage",
        subtitle: ownerCount === 1 ? (String(ownerShop && ownerShop.shopName || ownerShopId || "Shop").trim() + " owner mode") : "Switch to shop owner mode",
        action: ownerShopId ? "" : "shops",
        attr: ' data-account-owner-toggle="true"' + (ownerShopId ? (' data-account-open-shop="' + escapeHtml(ownerShopId) + '"') : ''),
        meta: ownerCount === 1 ? "" : String(ownerCount),
        className: "shop-account-manage-toggle" + (ownerModeOn ? " is-on" : ""),
        pressed: ownerModeOn,
        toggle: true
      }));
    }
    shopRows.push(accountMenuRowMarkup({
      icon: "S",
      title: "Add shop",
      subtitle: "Verify email and enter shop details",
      attr: ' data-account-open-login="true"'
    }));
    const supportRows = [
      accountMenuRowMarkup({ icon: "H", title: "Help & Support", subtitle: "Questions and feedback", action: "help" }),
      accountLinkRowMarkup({ icon: "#", title: "About Hashop", subtitle: "Objective and project shape", href: "/about" }),
      accountLinkRowMarkup({ icon: "P", title: "Privacy & Policies", subtitle: "Minimal rules and data use", href: "/privacy" }),
      accountMenuRowMarkup({
        icon: "D",
        title: "Dark mode",
        subtitle: state.mapTheme === "dark" ? "Night interface" : "Day interface",
        attr: ' data-account-theme-toggle="true"',
        pressed: state.mapTheme === "dark",
        toggle: true
      })
    ];
    if (signedIn) {
      supportRows.push(accountMenuRowMarkup({ icon: "!", title: "Sign out", subtitle: "Leave this device", attr: ' data-account-signout="true"', danger: true }));
    }
    const menuSectionMarkup = '' +
      '<div class="shop-account-menu-label">Buying</div>' +
      '<section class="shop-account-menu-card">' + buyingRows.join('') + '</section>' +
      (authRows.length ? '<div class="shop-account-menu-label">Access</div><section class="shop-account-menu-card">' + authRows.join('') + '</section>' : '') +
      '<div class="shop-account-menu-label">Shop</div>' +
      '<section class="shop-account-menu-card">' + shopRows.join('') + '</section>' +
      '<div class="shop-account-menu-label">Support</div>' +
      '<section class="shop-account-menu-card">' + supportRows.join('') + '</section>';
    state.listNode.innerHTML = '' +
      '<section class="shop-pane-detail" style="--shop-color:' + HASHOP_ACCOUNT_ACTION_COLOR + ';">' +
        '<div class="shop-account-stack">' +
          menuSectionMarkup +
        '</div>' +
      '</section>';
  }

  function buyerCartEntries(state) {
    if (!state || !state.cartByShop) return [];
    return Object.keys(state.cartByShop).map(function (shopId) {
      const safeShopId = String(shopId || "").trim();
      if (!safeShopId) return null;
      const rawCart = state.cartByShop[safeShopId];
      const itemCount = Object.keys(rawCart || {}).reduce(function (sum, key) {
        return sum + Math.max(0, Number(rawCart[key] || 0));
      }, 0);
      if (!itemCount) return null;
      const shop = state.shopById[safeShopId] || null;
      if (!shop) return null;
      const detail = state.shopDetails[safeShopId] || shopDetailFromPreview(shop);
      const items = detail ? cartItems(detail, rawCart) : [];
      const totalAmount = items.reduce(function (sum, item) {
        return sum + Number(item.total || 0);
      }, 0);
      return {
        shopId: safeShopId,
        shopName: String((detail && detail.name) || (shop && (shop.display_name || shop.shop_id)) || safeShopId).trim(),
        itemCount: itemCount,
        totalLabel: detail ? formatTotalAmount(totalAmount, detail.pricing) : "",
        itemSummary: items.map(function (item) {
          return String(item && item.title || "").trim();
        }).filter(Boolean).slice(0, 3).join(", "),
      };
    }).filter(Boolean).sort(function (left, right) {
      const countDelta = Number(right.itemCount || 0) - Number(left.itemCount || 0);
      if (countDelta) return countDelta;
      return String(left.shopName || left.shopId).localeCompare(String(right.shopName || right.shopId));
    });
  }

  function renderRecentOrdersPane(state) {
    if (!state || !state.listNode) return;
    destroyOwnerPickupMap(state);
    const query = normalizeSearch(state.searchQuery);
    const cartEntries = buyerCartEntries(state);
    const filteredCartEntries = cartEntries.filter(function (entry) {
      return matchesSearch([
        entry.shopName,
        entry.shopId,
        entry.totalLabel,
        entry.itemSummary,
        entry.itemCount ? (entry.itemCount + " items") : ""
      ], query);
    });
    const cartMarkup = filteredCartEntries.length ? (
      '<section class="shop-account-section shop-history-cart-section">' +
        '<div class="shop-account-section-head">' +
          '<strong>Open carts</strong>' +
          '<span>' + escapeHtml(filteredCartEntries.length === 1 ? "1 shop" : (filteredCartEntries.length + " shops")) + '</span>' +
        '</div>' +
        '<div class="shop-account-shop-list">' +
          filteredCartEntries.map(function (entry) {
            return '' +
              '<button class="shop-account-shop" type="button" data-open-cart-shop="' + escapeHtml(entry.shopId) + '">' +
                '<strong>' + escapeHtml(entry.shopName) + '</strong>' +
                '<span>@' + escapeHtml(entry.shopId) + '</span>' +
                '<span>' + escapeHtml(entry.itemCount + " item" + (entry.itemCount === 1 ? "" : "s") + (entry.totalLabel ? (" • " + entry.totalLabel) : "")) + '</span>' +
                (entry.itemSummary ? '<span>' + escapeHtml(entry.itemSummary) + '</span>' : '') +
              '</button>';
          }).join('') +
        '</div>' +
      '</section>'
    ) : (
      cartEntries.length && query
        ? stateCardMarkup({
          title: "No carts",
          actions: [{ label: "Clear search", attribute: 'data-clear-search="true"' }]
        })
        : ''
    );
    const hasBuyerOrderRows = Array.isArray(state.buyerOrders) && state.buyerOrders.length > 0;
    const statusMarkup = state.buyerOrdersError && (cartMarkup || hasBuyerOrderRows)
      ? '<div class="shop-pane-notice is-error">' + escapeHtml(state.buyerOrdersError) + '</div>'
      : '';
    const cartFallbackMarkup = cartMarkup ? '' : (query ? stateCardMarkup({
      title: "No carts",
      actions: [{ label: "Clear search", attribute: 'data-clear-search="true"' }]
    }) : emptyCartStateMarkup({
      scope: "root",
      actionLabel: "Browse shops",
      actionAttribute: 'data-go-home="true"'
    }));
    state.listNode.innerHTML = '' +
      '<section class="shop-pane-detail" style="--shop-color:' + HASHOP_DEFAULT_SHOP_COLOR + ';">' +
        statusMarkup +
        cartMarkup +
        cartFallbackMarkup +
      '</section>';
  }

  function isConceptPane(state) {
    return !!state && (
      state.debugPaneView === "concept-account-shop"
      || state.debugPaneView === "concept-shop-workspace"
    );
  }

  function normalizeConceptName(value) {
    return String(value || "").trim() === "shop-workspace" ? "shop-workspace" : "account-shop";
  }

  function normalizeConceptAccountStep(value) {
    const safeValue = String(value || "").trim();
    return ["account", "setup", "manage"].indexOf(safeValue) >= 0 ? safeValue : "account";
  }

  function normalizeConceptWorkspaceTab(value) {
    const safeValue = String(value || "").trim();
    return ["orders", "items", "settings"].indexOf(safeValue) >= 0 ? safeValue : "orders";
  }

  function conceptDelay(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, Math.max(0, Number(ms || 0) || 0));
    });
  }

  function ensureConceptShopDraft(state) {
    if (!state.conceptShopDraft || typeof state.conceptShopDraft !== "object") {
      state.conceptShopDraft = {};
    }
    const draft = state.conceptShopDraft;
    if (!Object.prototype.hasOwnProperty.call(draft, "name")) {
      draft.name = preferredOwnerShopName(state.accountSession || loadAccountSession(), state.ownerShopId) || "";
    }
    if (!Object.prototype.hasOwnProperty.call(draft, "location")) {
      draft.location = state.userPoint
        ? formatAccountCoordinates(state.userPoint[0], state.userPoint[1])
        : (state.savedUserLocation ? formatAccountCoordinates(state.savedUserLocation.lat, state.savedUserLocation.lng) : "");
    }
    if (!Object.prototype.hasOwnProperty.call(draft, "firstItem")) {
      draft.firstItem = "";
    }
    return draft;
  }

  function conceptShopDraftValue(state, key) {
    const draft = ensureConceptShopDraft(state);
    return String(draft[key] || "").trim();
  }

  function updateConceptShopDraftField(state, key, value) {
    if (!state) return;
    const safeKey = String(key || "").trim();
    if (["name", "location", "firstItem"].indexOf(safeKey) < 0) return;
    const draft = ensureConceptShopDraft(state);
    draft[safeKey] = String(value || "");
    if (state.conceptShopProcedureState === "error") {
      state.conceptShopProcedureState = "";
      state.conceptShopProcedureMessage = "";
    }
  }

  function ensureConceptItemDraft(state) {
    if (!state.conceptItemDraft || typeof state.conceptItemDraft !== "object") {
      state.conceptItemDraft = {};
    }
    const draft = state.conceptItemDraft;
    if (!Object.prototype.hasOwnProperty.call(draft, "name")) draft.name = "";
    if (!Object.prototype.hasOwnProperty.call(draft, "price")) draft.price = "";
    if (!Object.prototype.hasOwnProperty.call(draft, "stock")) draft.stock = "";
    return draft;
  }

  function conceptItemDraftValue(state, key) {
    const draft = ensureConceptItemDraft(state);
    return String(draft[key] || "").trim();
  }

  function updateConceptItemDraftField(state, key, value) {
    if (!state) return;
    const safeKey = String(key || "").trim();
    if (["name", "price", "stock"].indexOf(safeKey) < 0) return;
    const draft = ensureConceptItemDraft(state);
    draft[safeKey] = String(value || "");
    if (state.conceptItemProcedureState === "error") {
      state.conceptItemProcedureState = "";
      state.conceptItemProcedureMessage = "";
    }
  }

  function conceptListings(state) {
    if (!state) return [];
    if (!Array.isArray(state.conceptListings)) {
      state.conceptListings = [];
    }
    return state.conceptListings;
  }

  function appendConceptListing(state, listing) {
    const source = listing && typeof listing === "object" ? listing : {};
    const name = String(source.name || "").trim().slice(0, 120);
    if (!name) return null;
    const item = {
      id: String(source.id || generateAccountLocalId("item")).trim(),
      name: name,
      price: String(source.price || "").trim().slice(0, 80),
      stock: String(source.stock || "").trim().slice(0, 80),
      createdAt: Math.max(0, Number(source.createdAt || Math.floor(Date.now() / 1000)) || Math.floor(Date.now() / 1000))
    };
    conceptListings(state).unshift(item);
    return item;
  }

  function conceptListingCount(state) {
    return conceptListings(state).length;
  }

  function conceptStockUnits(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    const matched = text.match(/-?\d+(?:\.\d+)?/);
    if (!matched) return null;
    const amount = Number(matched[0]);
    if (!isFinite(amount) || amount < 0) return null;
    return Math.floor(amount);
  }

  function conceptInventorySummary(state) {
    const rows = conceptListings(state);
    return rows.reduce(function (summary, item) {
      const units = conceptStockUnits(item && item.stock);
      summary.listings += 1;
      if (units === null) {
        summary.unknownStock += 1;
        return summary;
      }
      summary.knownStock += units;
      return summary;
    }, {
      listings: 0,
      knownStock: 0,
      unknownStock: 0
    });
  }

  function conceptInventoryLabel(summary) {
    const data = summary && typeof summary === "object" ? summary : { knownStock: 0, unknownStock: 0 };
    if (Number(data.knownStock || 0) > 0) return String(Number(data.knownStock || 0));
    if (Number(data.unknownStock || 0) > 0) return "Set";
    return "0";
  }

  function conceptInventorySubline(summary) {
    const data = summary && typeof summary === "object" ? summary : { listings: 0, knownStock: 0, unknownStock: 0 };
    const listings = Number(data.listings || 0);
    const knownStock = Number(data.knownStock || 0);
    const unknownStock = Number(data.unknownStock || 0);
    if (!listings) return "No listings";
    if (knownStock > 0 && unknownStock > 0) return knownStock + " counted, " + unknownStock + " unset";
    if (knownStock > 0) return knownStock + " counted";
    return unknownStock + " unset";
  }

  function seedConceptListingFromSetup(state, firstItem) {
    const name = String(firstItem || "").trim();
    if (!state || !name || conceptListingCount(state)) return;
    appendConceptListing(state, {
      name: name,
      price: "Price later",
      stock: "Draft"
    });
  }

  function conceptShopFormStatusMarkup(state) {
    const status = String(state && state.conceptShopProcedureState || "").trim();
    const message = String(state && state.conceptShopProcedureMessage || "").trim();
    if (!status && !message) return "";
    return '<div class="shop-concept-form-status is-' + escapeHtml(status || "info") + '">' + escapeHtml(message || "Working") + '</div>';
  }

  function conceptItemFormStatusMarkup(state) {
    const status = String(state && state.conceptItemProcedureState || "").trim();
    const message = String(state && state.conceptItemProcedureMessage || "").trim();
    if (!status && !message) return "";
    return '<div class="shop-concept-form-status is-' + escapeHtml(status || "info") + '">' + escapeHtml(message || "Working") + '</div>';
  }

  function conceptShopSetupFieldMarkup(key, label, value, placeholder) {
    return '' +
      '<label class="shop-concept-field">' +
        '<span>' + escapeHtml(label) + '</span>' +
        '<input class="shop-concept-input" type="text" data-concept-shop-field="' + escapeHtml(key) + '" value="' + escapeHtml(value) + '" placeholder="' + escapeHtml(placeholder || "") + '" autocomplete="off" spellcheck="false">' +
      '</label>';
  }

  function conceptItemFieldMarkup(key, label, value, placeholder) {
    return '' +
      '<label class="shop-concept-field">' +
        '<span>' + escapeHtml(label) + '</span>' +
        '<input class="shop-concept-input" type="text" data-concept-item-field="' + escapeHtml(key) + '" value="' + escapeHtml(value) + '" placeholder="' + escapeHtml(placeholder || "") + '" autocomplete="off" spellcheck="false">' +
      '</label>';
  }

  function conceptFormValueMarkup(label, value, fallback, meta) {
    const safeValue = String(value || "").trim();
    return '' +
      '<div class="shop-concept-field shop-concept-read-field">' +
        '<span>' + escapeHtml(label) + '</span>' +
        '<strong>' + escapeHtml(safeValue || fallback || "Not set") + '</strong>' +
        (meta ? '<small>' + escapeHtml(meta) + '</small>' : '') +
      '</div>';
  }

  function conceptBuyerSnapshot(state) {
    const session = state && state.accountSession ? state.accountSession : loadAccountSession();
    const profile = buyerCheckoutProfile(state);
    const buyerAccount = accountBuyerAccount(session);
    const contact = String(buyerAccount && buyerAccount.contact || profile.contact || "").trim();
    const name = String(buyerAccount && buyerAccount.displayName || profile.name || session && session.displayName || "").trim();
    const address = String(profile.address || "").trim();
    return {
      name: name,
      contact: contact,
      address: address,
      verified: !!buyerAccount || setupContactIsVerified(state, contact),
      signedIn: !!buyerAccount
    };
  }

  function conceptAccountFormMarkup(state) {
    const snapshot = conceptBuyerSnapshot(state);
    return '' +
      '<div class="shop-concept-form shop-concept-saved-form">' +
        conceptFormValueMarkup("Name", snapshot.name, "Guest", snapshot.signedIn ? "Saved account" : "Device profile") +
        conceptFormValueMarkup("Contact", snapshot.contact, "Not verified", snapshot.verified ? "Verified" : "Verify from setup") +
        conceptFormValueMarkup("Address", snapshot.address, "Pickup first", snapshot.address ? "Saved delivery place" : "Delivery can be added later") +
        '<button class="shop-concept-primary" type="button" data-concept-account-step="setup">Continue</button>' +
      '</div>';
  }

  function conceptShopIdentity(state) {
    const preview = state && state.conceptShopPreview && typeof state.conceptShopPreview === "object"
      ? state.conceptShopPreview
      : null;
    const session = state && state.accountSession ? state.accountSession : loadAccountSession();
    const savedName = preferredOwnerShopName(session, state && state.ownerShopId);
    const savedId = preferredOwnerShopId(session, state && state.ownerShopId);
    const draft = state ? ensureConceptShopDraft(state) : {};
    const name = String(preview && preview.name || savedName || draft.name || "").trim();
    const location = String(preview && preview.location || draft.location || "").trim();
    const firstItem = String(preview && preview.firstItem || draft.firstItem || "").trim();
    return {
      hasShop: !!(preview || savedId),
      name: name,
      location: location,
      firstItem: firstItem,
      savedId: savedId
    };
  }

  function conceptShopMissingMarkup(title, subtitle) {
    return '' +
      '<section class="shop-concept-panel shop-concept-empty-panel">' +
        '<div class="shop-concept-panel-head">' +
          '<strong>' + escapeHtml(title || "Shop setup") + '</strong>' +
          '<span>' + escapeHtml(subtitle || "Create the shop surface first.") + '</span>' +
        '</div>' +
        '<button class="shop-concept-primary" type="button" data-concept-account-step="setup">Open setup</button>' +
      '</section>';
  }

  function conceptShopSetupFormMarkup(state) {
    const saving = String(state && state.conceptShopProcedureState || "").trim() === "saving";
    return '' +
      '<form class="shop-concept-form" data-concept-shop-form="setup">' +
        conceptShopSetupFieldMarkup("name", "Shop name", conceptShopDraftValue(state, "name"), "Known shop name") +
        '<label class="shop-concept-field">' +
          '<span>Shop location</span>' +
          '<span class="shop-concept-location-line">' +
            '<input class="shop-concept-input" type="text" data-concept-shop-field="location" value="' + escapeHtml(conceptShopDraftValue(state, "location")) + '" placeholder="Pickup point or delivery base" autocomplete="off" spellcheck="false">' +
            '<button class="shop-concept-map-button" type="button" data-concept-shop-field-fill="location">Map</button>' +
          '</span>' +
        '</label>' +
        conceptShopSetupFieldMarkup("firstItem", "First item", conceptShopDraftValue(state, "firstItem"), "Optional first item") +
        conceptShopFormStatusMarkup(state) +
        '<button class="shop-concept-primary' + (saving ? ' is-loading' : '') + '" type="submit" data-concept-form-submit="shop-setup"' + (saving ? ' disabled' : '') + '>' + escapeHtml(saving ? "Saving..." : "Continue") + '</button>' +
      '</form>';
  }

  function conceptItemFormMarkup(state) {
    const saving = String(state && state.conceptItemProcedureState || "").trim() === "saving";
    return '' +
      '<form class="shop-concept-form shop-concept-item-form" data-concept-item-form="add">' +
        conceptItemFieldMarkup("name", "Item name", conceptItemDraftValue(state, "name"), "Rice 5kg, tea, service slot") +
        '<div class="shop-concept-form-pair">' +
          conceptItemFieldMarkup("price", "Price", conceptItemDraftValue(state, "price"), "Rs 120") +
          conceptItemFieldMarkup("stock", "Stock", conceptItemDraftValue(state, "stock"), "12 left") +
        '</div>' +
        conceptItemFormStatusMarkup(state) +
        '<button class="shop-concept-primary' + (saving ? ' is-loading' : '') + '" type="submit" data-concept-form-submit="item-add"' + (saving ? ' disabled' : '') + '>' + escapeHtml(saving ? "Adding..." : "Add listing") + '</button>' +
      '</form>';
  }

  function conceptListingRowsMarkup(state) {
    const rows = conceptListings(state);
    if (!rows.length) {
      return conceptRowMarkup("+", "No items yet", "Add the first listing above", "Ready");
    }
    return rows.map(function (item) {
      const price = String(item && item.price || "").trim() || "Price later";
      const stock = String(item && item.stock || "").trim() || "Available";
      return conceptRowMarkup("I", String(item && item.name || "Item").trim(), price, stock);
    }).join('');
  }

  function conceptInventoryStatusMarkup(state) {
    const summary = conceptInventorySummary(state);
    return '' +
      '<div class="shop-concept-inventory-line">' +
        '<span>' + escapeHtml(String(summary.listings || 0)) + ' listings</span>' +
        '<strong>' + escapeHtml(conceptInventorySubline(summary)) + '</strong>' +
      '</div>';
  }

  function runConceptShopSetupProcedure(state, event) {
    const draft = ensureConceptShopDraft(state);
    const name = String(draft.name || "").trim();
    const location = String(draft.location || "").trim();
    const firstItem = String(draft.firstItem || "").trim();
    if (!name || !location) {
      state.conceptShopProcedureState = "error";
      state.conceptShopProcedureMessage = !name ? "Add a shop name." : "Add the shop location.";
      return { resetScroll: false };
    }
    const requestId = Number(event && event.eventId || 0) || Date.now();
    state.conceptShopProcedureId = requestId;
    state.conceptShopProcedureState = "saving";
    state.conceptShopProcedureMessage = "Saving shop setup...";
    conceptAsyncEffects(state, { resetScroll: false, expand: false });
    return conceptDelay(340).then(function () {
      if (state.conceptShopProcedureId !== requestId) {
        return { resetScroll: false };
      }
      state.conceptShopProcedureState = "success";
      state.conceptShopProcedureMessage = "Shop setup is ready.";
      state.conceptShopPreview = {
        name: name,
        location: location,
        firstItem: firstItem || "First item later"
      };
      seedConceptListingFromSetup(state, firstItem);
      state.conceptAccountStep = "manage";
      return { resetScroll: true };
    });
  }

  function runConceptItemProcedure(state, event) {
    const identity = conceptShopIdentity(state);
    const draft = ensureConceptItemDraft(state);
    const name = String(draft.name || "").trim();
    const price = String(draft.price || "").trim();
    const stock = String(draft.stock || "").trim();
    if (!identity.hasShop || !name) {
      state.conceptItemProcedureState = "error";
      state.conceptItemProcedureMessage = !identity.hasShop ? "Create the shop first." : "Add an item name.";
      return { resetScroll: false };
    }
    const requestId = Number(event && event.eventId || 0) || Date.now();
    state.conceptItemProcedureId = requestId;
    state.conceptItemProcedureState = "saving";
    state.conceptItemProcedureMessage = "Adding listing...";
    conceptAsyncEffects(state, { resetScroll: false, expand: false });
    return conceptDelay(280).then(function () {
      if (state.conceptItemProcedureId !== requestId) {
        return { resetScroll: false };
      }
      appendConceptListing(state, {
        name: name,
        price: price || "Price later",
        stock: stock || "Available"
      });
      state.conceptItemDraft = { name: "", price: "", stock: "" };
      state.conceptItemProcedureState = "success";
      state.conceptItemProcedureMessage = "Listing added.";
      state.conceptWorkspaceTab = "items";
      return { resetScroll: false };
    });
  }

  function applyConceptPaneState(state, concept) {
    if (!state) return;
    const safeConcept = normalizeConceptName(concept);
    state.conceptName = safeConcept;
    state.conceptMode = true;
    state.debugPaneView = safeConcept === "shop-workspace" ? "concept-shop-workspace" : "concept-account-shop";
    state.activeShopId = "";
    state.activeShopView = "items";
    state.detailLoading = false;
    state.searchQuery = "";
    state.panelNode.classList.remove("is-shop-view");
    state.panelNode.classList.remove("is-login-view");
  }

  function conceptAsyncEffects(state, options) {
    const settings = options && typeof options === "object" ? options : {};
    if (settings.expand !== false) {
      setPaneExpanded(state, true, "normal");
    }
    syncPaneUrl(state);
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    renderShopList(state);
    if (settings.resetScroll !== false) {
      resetPaneScroll(state);
    }
  }

  function reduceHashopEvent(state, event) {
    if (!state || !event || typeof event !== "object") return null;
    const type = String(event.type || "").trim();
    if (type === "CONCEPT_ROUTE_SELECTED") {
      applyConceptPaneState(state, event.concept);
      return { resetScroll: true };
    }
    if (type === "CONCEPT_ACCOUNT_STEP_SELECTED") {
      state.conceptAccountStep = normalizeConceptAccountStep(event.step);
      return { resetScroll: true };
    }
    if (type === "CONCEPT_WORKSPACE_TAB_SELECTED") {
      state.conceptWorkspaceTab = normalizeConceptWorkspaceTab(event.tab);
      return { resetScroll: true };
    }
    if (type === "CONCEPT_WORKSPACE_TAB_OPENED") {
      applyConceptPaneState(state, "shop-workspace");
      state.conceptWorkspaceTab = normalizeConceptWorkspaceTab(event.tab);
      return { resetScroll: true };
    }
    if (type === "CONCEPT_LANGUAGE_CYCLED") {
      const options = ["EN", "HI", "KN"];
      const currentIndex = options.indexOf(conceptLanguageLabel(state));
      state.conceptLanguage = options[(currentIndex + 1 + options.length) % options.length];
      return { resetScroll: false };
    }
    if (type === "CONCEPT_SHOP_SETUP_SUBMITTED") {
      return runConceptShopSetupProcedure(state, event);
    }
    if (type === "CONCEPT_ITEM_SUBMITTED") {
      return runConceptItemProcedure(state, event);
    }
    return null;
  }

  function dispatchHashopEvent(state, event) {
    if (!state || !event) return Promise.resolve(false);
    const eventType = String(event.type || "").trim();
    state.asyncEventSerial = Number(state.asyncEventSerial || 0) + 1;
    const eventId = state.asyncEventSerial;
    event.eventId = eventId;
    state.asyncLastEvent = eventType;
    const previousTask = state.asyncQueue && typeof state.asyncQueue.then === "function"
      ? state.asyncQueue.catch(function () {})
      : Promise.resolve();
    const nextTask = previousTask.then(function () {
      return Promise.resolve().then(function () {
        return Promise.resolve(reduceHashopEvent(state, event)).then(function (effects) {
          if (!effects) return false;
          state.asyncActiveEvent = eventType;
          conceptAsyncEffects(state, effects);
          state.asyncSettledEvent = eventType;
          state.asyncSettledEventId = eventId;
          state.asyncActiveEvent = "";
          return true;
        });
      });
    }).catch(function (error) {
      state.asyncActiveEvent = "";
      state.asyncError = error && error.message ? error.message : "Async event failed.";
      if (window.console && typeof window.console.error === "function") {
        window.console.error("[Hashop async event]", eventType, error);
      }
      return false;
    });
    state.asyncQueue = nextTask;
    return nextTask;
  }

  function conceptLanguageLabel(state) {
    const value = String(state && state.conceptLanguage || "EN").trim().toUpperCase();
    return value === "HI" || value === "KN" ? value : "EN";
  }

  function conceptLanguageButtonMarkup(state) {
    return '<button class="shop-concept-lang" type="button" data-concept-language="cycle" aria-label="Change language">' + escapeHtml(conceptLanguageLabel(state)) + '</button>';
  }

  function conceptRouteButtonMarkup(route, label, active) {
    return '<button class="shop-concept-switch' + (active ? ' is-active' : '') + '" type="button" data-concept-route="' + escapeHtml(route) + '">' + escapeHtml(label) + '</button>';
  }

  function conceptStageButtonMarkup(kind, value, label, active) {
    return '<button class="shop-concept-tab' + (active ? ' is-active' : '') + '" type="button" data-' + escapeHtml(kind) + '="' + escapeHtml(value) + '">' + escapeHtml(label) + '</button>';
  }

  function conceptMetricMarkup(label, value) {
    return '' +
      '<span class="shop-concept-metric">' +
        '<strong>' + escapeHtml(value) + '</strong>' +
        '<span>' + escapeHtml(label) + '</span>' +
      '</span>';
  }

  function conceptRowMarkup(icon, title, subtitle, meta) {
    return '' +
      '<div class="shop-concept-row">' +
        '<span class="shop-concept-row-icon" aria-hidden="true">' + escapeHtml(icon) + '</span>' +
        '<span class="shop-concept-row-copy">' +
          '<strong>' + escapeHtml(title) + '</strong>' +
          '<span>' + escapeHtml(subtitle) + '</span>' +
        '</span>' +
        (meta ? '<span class="shop-concept-row-meta">' + escapeHtml(meta) + '</span>' : '') +
      '</div>';
  }

  function renderConceptAccountShopPane(state) {
    if (!state || !state.listNode) return;
    destroyOwnerPickupMap(state);
    const step = normalizeConceptAccountStep(state.conceptAccountStep);
    const draft = ensureConceptShopDraft(state);
    const identity = conceptShopIdentity(state);
    const inventory = conceptInventorySummary(state);
    const body = step === "setup"
      ? '' +
        '<section class="shop-concept-panel">' +
          '<div class="shop-concept-panel-head">' +
            '<strong>Open shop</strong>' +
            '<span>Fill only what creates the shop surface.</span>' +
          '</div>' +
          conceptShopSetupFormMarkup(state) +
        '</section>'
      : step === "manage"
      ? identity.hasShop ? '' +
        '<section class="shop-concept-panel">' +
          '<div class="shop-concept-panel-head">' +
            '<strong>' + escapeHtml(identity.name || "My shop") + '</strong>' +
            '<span>Still inside Account, but now ready to manage.</span>' +
          '</div>' +
          '<div class="shop-concept-metrics">' +
            conceptMetricMarkup("orders", "2") +
            conceptMetricMarkup("listings", String(inventory.listings || 0)) +
            conceptMetricMarkup("stock", conceptInventoryLabel(inventory)) +
          '</div>' +
          conceptFormValueMarkup("Shop name", identity.name, "My shop", "Ready") +
          conceptFormValueMarkup("Shop location", identity.location, "Pinned on map", "Set") +
          conceptFormValueMarkup("First item", identity.firstItem, "First item later", "Draft") +
          '<div class="shop-concept-action-grid">' +
            '<button class="shop-concept-secondary" type="button" data-concept-open-workspace="orders">Orders</button>' +
            '<button class="shop-concept-secondary" type="button" data-concept-open-workspace="items">Items</button>' +
            '<button class="shop-concept-secondary" type="button" data-concept-open-workspace="settings">Settings</button>' +
          '</div>' +
        '</section>'
        : conceptShopMissingMarkup("No shop surface yet", "Setup creates the shop before manage appears.")
      : '' +
        '<section class="shop-concept-panel">' +
          '<div class="shop-concept-panel-head">' +
            '<strong>Account</strong>' +
            '<span>Buying profile stays first.</span>' +
          '</div>' +
          conceptAccountFormMarkup(state) +
        '</section>';
    state.listNode.innerHTML = '' +
      '<section class="shop-pane-detail shop-concept-detail" style="--shop-color:' + HASHOP_ACCOUNT_ACTION_COLOR + ';">' +
        '<div class="shop-concept-stack">' +
          '<div class="shop-concept-topline">' +
            '<span>Concept A</span>' +
            conceptLanguageButtonMarkup(state) +
          '</div>' +
          '<div class="shop-concept-hero">' +
            '<div>' +
              '<h2>Account owns the shop</h2>' +
              '<p>People buy first. Opening a shop is just adding one more saved part.</p>' +
            '</div>' +
            '<div class="shop-concept-switcher">' +
              conceptRouteButtonMarkup("account-shop", "Account state", true) +
              conceptRouteButtonMarkup("shop-workspace", "Workspace", false) +
            '</div>' +
          '</div>' +
          '<div class="shop-concept-tabs">' +
            conceptStageButtonMarkup("concept-account-step", "account", "Account", step === "account") +
            conceptStageButtonMarkup("concept-account-step", "setup", "Setup", step === "setup") +
            conceptStageButtonMarkup("concept-account-step", "manage", "Manage", step === "manage") +
          '</div>' +
          body +
        '</div>' +
      '</section>';
  }

  function renderConceptShopWorkspacePane(state) {
    if (!state || !state.listNode) return;
    destroyOwnerPickupMap(state);
    const tab = normalizeConceptWorkspaceTab(state.conceptWorkspaceTab);
    const identity = conceptShopIdentity(state);
    const body = !identity.hasShop
      ? conceptShopMissingMarkup("Shop workspace is not ready", "Finish setup from Account first.")
      : tab === "items"
      ? '' +
        '<section class="shop-concept-panel">' +
          '<div class="shop-concept-panel-head">' +
            '<strong>Items</strong>' +
            '<span>List what buyers can see now.</span>' +
          '</div>' +
          conceptInventoryStatusMarkup(state) +
          conceptItemFormMarkup(state) +
          '<div class="shop-concept-listing-list">' +
            conceptListingRowsMarkup(state) +
          '</div>' +
        '</section>'
      : tab === "settings"
      ? '' +
        '<section class="shop-concept-panel">' +
          '<div class="shop-concept-panel-head">' +
            '<strong>Shop settings</strong>' +
            '<span>Only details that affect this shop.</span>' +
          '</div>' +
          conceptFormValueMarkup("Shop name", identity.name, "My shop", "Edit") +
          conceptFormValueMarkup("Shop location", identity.location, "Pinned on map", "Change") +
          conceptRowMarkup("P", "Payment", "Pay on receive", "Default") +
        '</section>'
      : '' +
        '<section class="shop-concept-panel">' +
          '<div class="shop-concept-panel-head">' +
            '<strong>Orders</strong>' +
            '<span>Daily shop work opens here first.</span>' +
          '</div>' +
          conceptRowMarkup("1", "Asha", "2 items, pay on receive", "New") +
          conceptRowMarkup("2", "Ravi", "1 item, pickup", "Ready") +
          conceptRowMarkup("+", "Start order", "For walk-in customers", "New") +
        '</section>';
    state.listNode.innerHTML = '' +
      '<section class="shop-pane-detail shop-concept-detail" style="--shop-color:' + HASHOP_DEFAULT_SHOP_COLOR + ';">' +
        '<div class="shop-concept-stack">' +
          '<div class="shop-concept-topline">' +
            '<span>Concept B</span>' +
            conceptLanguageButtonMarkup(state) +
          '</div>' +
          '<div class="shop-concept-hero">' +
            '<div>' +
              '<h2>My shop workspace</h2>' +
              '<p>Account creates the shop. Shop work then gets its own clean place.</p>' +
            '</div>' +
            '<div class="shop-concept-switcher">' +
              conceptRouteButtonMarkup("account-shop", "Account state", false) +
          conceptRouteButtonMarkup("shop-workspace", "Workspace", true) +
            '</div>' +
          '</div>' +
          '<div class="shop-concept-breadcrumb">' +
            '<span>Account</span>' +
            '<span>My shop</span>' +
            '<strong>' + escapeHtml(identity.name || "Setup") + '</strong>' +
          '</div>' +
          '<div class="shop-concept-tabs">' +
            conceptStageButtonMarkup("concept-workspace-tab", "orders", "Orders", tab === "orders") +
            conceptStageButtonMarkup("concept-workspace-tab", "items", "Items", tab === "items") +
            conceptStageButtonMarkup("concept-workspace-tab", "settings", "Settings", tab === "settings") +
          '</div>' +
          body +
        '</div>' +
      '</section>';
  }

  function shopItemLibraryPreview(state, shopId, limit) {
    const safeShopId = String(shopId || "").trim();
    const maxItems = Math.max(0, Number(limit || 0) || 0);
    if (!state || !safeShopId || !maxItems || !Array.isArray(state.itemLibrary)) return [];
    return state.itemLibrary.filter(function (item) {
      return String(item && item.shopId || "").trim() === safeShopId;
    }).map(function (item) {
      return String(item && item.title || "").trim();
    }).filter(Boolean).slice(0, maxItems);
  }

  function libraryItemCartId(item) {
    return String(item && (item.id || item.libraryId) || "").trim();
  }

  function findLibraryItem(state, shopId, itemId) {
    const safeShopId = String(shopId || "").trim();
    const safeItemId = String(itemId || "").trim();
    if (!state || !safeShopId || !safeItemId || !Array.isArray(state.itemLibrary)) return null;
    return state.itemLibrary.find(function (item) {
      if (String(item && item.shopId || "").trim() !== safeShopId) return false;
      return libraryItemCartId(item) === safeItemId;
    }) || null;
  }

  function ensureShopDetailItemFromLibrary(state, item) {
    if (!state || !item) return "";
    const shopId = String(item.shopId || "").trim();
    const itemId = libraryItemCartId(item);
    if (!shopId || !itemId) return "";
    const shop = state.shopById[shopId] || {};
    const detail = state.shopDetails[shopId] || shopDetailFromPreview(shop) || {
      name: String(item.shopName || shop.display_name || shop.shop_id || shopId || "Shop").trim(),
      type: "Store",
      note: "",
      contact: "",
      location: String(shop.location_label || "").trim(),
      hours: "",
      pricing: "",
      paymentEntries: [],
      payments: [],
      items: []
    };
    if (!Array.isArray(detail.items)) {
      detail.items = [];
    }
    const nextItem = {
      id: itemId,
      title: String(item.title || "Item").trim(),
      description: String(item.description || "").trim(),
      price: String(item.price || "").trim(),
      quantity: Math.max(0, Number(item.quantity || 0)),
      imageFiles: Array.isArray(item.imageFiles) ? item.imageFiles.slice(0, 8) : []
    };
    const existingIndex = detail.items.findIndex(function (detailItem) {
      return String(detailItem && detailItem.id || "").trim() === itemId;
    });
    if (existingIndex >= 0) {
      detail.items[existingIndex] = Object.assign({}, detail.items[existingIndex], nextItem);
    } else {
      detail.items.push(nextItem);
    }
    state.shopDetails[shopId] = detail;
    return itemId;
  }

  function normalizeItemSortMode(value) {
    const mode = String(value || "").trim().toLowerCase();
    if (mode === "price" || mode === "stock" || mode === "name") return mode;
    return "nearby";
  }

  function itemPriceNumber(item) {
    const value = priceNumber(item && item.price);
    return isFinite(value) && value > 0 ? value : Number.POSITIVE_INFINITY;
  }

  function itemStockNumber(item) {
    const value = Math.max(0, Number(item && item.quantity || 0));
    return isFinite(value) ? value : 0;
  }

  function itemDistanceNumber(state, item) {
    const shopId = String(item && item.shopId || "").trim();
    const shop = state && state.shopById ? state.shopById[shopId] : null;
    const distance = shopDistanceMeters(shop, state && state.userPoint);
    return distance == null ? Number.POSITIVE_INFINITY : distance;
  }

  function itemTitleText(item) {
    return String(item && item.title || item && item.shopName || item && item.shopId || "").trim().toLowerCase();
  }

  function sortItemLibraryRows(state, rows) {
    const mode = normalizeItemSortMode(state && state.itemSortMode);
    return (Array.isArray(rows) ? rows : []).slice().sort(function (left, right) {
      if (mode === "price") {
        const priceDelta = itemPriceNumber(left) - itemPriceNumber(right);
        if (priceDelta) return priceDelta;
      } else if (mode === "stock") {
        const stockDelta = itemStockNumber(right) - itemStockNumber(left);
        if (stockDelta) return stockDelta;
      } else if (mode === "name") {
        const nameDelta = itemTitleText(left).localeCompare(itemTitleText(right));
        if (nameDelta) return nameDelta;
      } else {
        const distanceDelta = itemDistanceNumber(state, left) - itemDistanceNumber(state, right);
        if (distanceDelta && isFinite(distanceDelta)) return distanceDelta;
      }
      const shopDelta = String(left && left.shopName || left && left.shopId || "").localeCompare(String(right && right.shopName || right && right.shopId || ""));
      if (shopDelta) return shopDelta;
      return itemTitleText(left).localeCompare(itemTitleText(right));
    });
  }

  function itemSelectionControlMarkup(settings) {
    const options = settings && typeof settings === "object" ? settings : {};
    const shopId = String(options.shopId || "").trim();
    const itemId = String(options.itemId || "").trim();
    const quantity = Math.max(0, Number(options.quantity || 0));
    const title = String(options.title || "item").trim() || "item";
    if (!shopId || !itemId) return '<span class="shop-card-open">Open</span>';
    if (!quantity) {
      return '<button class="shop-card-add shop-item-add" type="button" data-cart-shop-id="' + escapeHtml(shopId) + '" data-item-id="' + escapeHtml(itemId) + '" data-cart-step="1" aria-label="Add ' + escapeHtml(title) + '">Add</button>';
    }
    return '' +
      '<div class="shop-item-selection" role="group" aria-label="' + escapeHtml(title + " quantity") + '">' +
        '<button class="shop-item-step" type="button" data-cart-shop-id="' + escapeHtml(shopId) + '" data-item-id="' + escapeHtml(itemId) + '" data-cart-step="-1" aria-label="Remove one ' + escapeHtml(title) + '">-</button>' +
        '<span class="shop-item-qty" aria-label="' + escapeHtml(String(quantity) + " selected") + '">' + escapeHtml(quantity) + '</span>' +
        '<button class="shop-item-step" type="button" data-cart-shop-id="' + escapeHtml(shopId) + '" data-item-id="' + escapeHtml(itemId) + '" data-cart-step="1" aria-label="Add one more ' + escapeHtml(title) + '">+</button>' +
      '</div>';
  }

  function shopItemCardMarkup(state, detail, item, shop, options) {
    const settings = options && typeof options === "object" ? options : {};
    const shopId = String(settings.shopId || item && item.shopId || shop && shop.shop_id || state && state.activeShopId || "").trim();
    const itemId = String(settings.itemId || item && (item.id || item.libraryId) || "").trim();
    const shopName = String(settings.shopName || item && item.shopName || detail && detail.name || shop && (shop.display_name || shop.shop_id) || shopId || "Shop").trim();
    const title = String(item && item.title || "Item").trim();
    const quantity = Math.max(0, Number(item && item.quantity || 0));
    const selectedQty = settings.ownerMode
      ? 0
      : settings.selectedQty != null
      ? Math.max(0, Number(settings.selectedQty || 0))
      : Math.max(0, Number(getShopCart(state, shopId)[itemId] || 0));
    const priceLabel = String(settings.priceLabel || "").trim() || formatPrice(item && item.price, detail && detail.pricing) || "Open";
    const stockLabel = String(settings.stockLabel || "").trim() || (quantity > 0 ? (quantity + " left") : "Available");
    const description = String(item && item.description || "").trim();
    const imageFiles = Array.isArray(item && item.imageFiles) ? item.imageFiles : [];
    const imageMarkup = imageFiles.length
      ? '<img src="' + escapeHtml(assetFileUrl(imageFiles[0])) + '" alt="' + escapeHtml(title) + '">'
      : '<span>' + escapeHtml((title.charAt(0) || "#").toUpperCase()) + '</span>';
    const safeColor = /^#[0-9a-fA-F]{6}$/.test(String(settings.color || "")) ? String(settings.color) : shopColor(shop || {});
    const actionMarkup = typeof settings.actionMarkup === "string" && settings.actionMarkup
      ? settings.actionMarkup
      : settings.ownerMode
      ? '<span class="shop-card-open">' + escapeHtml(stockLabel) + '</span>'
      : itemSelectionControlMarkup({
          shopId: shopId,
          itemId: itemId,
          quantity: selectedQty,
          title: title
        });
    const subtitleLabel = String(settings.subtitle || "").trim() || (settings.showShopName === false ? stockLabel : shopName);
    const metaItems = Array.isArray(settings.metaItems)
      ? settings.metaItems
      : [priceLabel, stockLabel, description];
    const cardClass = String(settings.cardClass || "").trim();
    const thumbClass = String(settings.thumbClass || "").trim();
    const cardAttrs = String(settings.cardAttrs || "").trim();
    const openAttr = settings.openShop === false ? '' : ' data-open-shop-card="' + escapeHtml(shopId) + '"';
    const canTouchAdd = !settings.disableTouchAdd && !settings.ownerMode && settings.openShop === false && itemId;
    const addAttr = canTouchAdd
      ? ' role="button" tabindex="0" data-pane-add-item="' + escapeHtml(itemId) + '" aria-label="Add ' + escapeHtml(title) + ' to cart"'
      : '';
    return '' +
      '<article class="shop-card shop-discovery-card shop-item-discovery-card' + (canTouchAdd ? ' is-touch-add' : '') + (cardClass ? (' ' + escapeHtml(cardClass)) : '') + '"' + (cardAttrs ? (' ' + cardAttrs) : '') + openAttr + addAttr + ' style="--shop-color:' + escapeHtml(safeColor) + ';">' +
        '<div class="shop-card-thumb' + (thumbClass ? (' ' + escapeHtml(thumbClass)) : '') + '">' + imageMarkup + '</div>' +
        '<div class="shop-card-main">' +
          '<div class="shop-card-topline">' +
            '<div class="shop-card-title-block">' +
              '<strong>' + escapeHtml(title) + '</strong>' +
              '<span class="shop-card-subtitle">' + escapeHtml(subtitleLabel) + '</span>' +
            '</div>' +
            actionMarkup +
          '</div>' +
          '<div class="shop-card-items">' +
            metaItems.map(function (value, index) {
              const text = String(value || "").trim();
              if (!text) return "";
              return '<span class="shop-card-item' + (index === 0 ? ' is-primary' : '') + '">' + escapeHtml(index > 1 ? clampText(text, 34) : text) + '</span>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function itemSortControlsMarkup(state, count, ownerMode) {
    const activeMode = normalizeItemSortMode(state && state.itemSortMode);
    const viewMode = normalizeListingViewMode(state && state.listingViewMode);
    const options = [
      { key: "nearby", label: ownerMode ? "Shop" : "Near" },
      { key: "price", label: "Price" },
      { key: "stock", label: "Qty" },
      { key: "name", label: "A-Z" }
    ];
    return '' +
      '<div class="shop-list-sortbar" role="toolbar" aria-label="Sort items">' +
        '<span class="shop-list-sort-count">' + escapeHtml(String(Math.max(0, Number(count || 0) || 0)) + " items") + '</span>' +
        '<div class="shop-list-sort-actions">' +
          options.map(function (option) {
            const active = option.key === activeMode;
            return '<button class="shop-list-sort-button' + (active ? ' is-active' : '') + '" type="button" data-item-sort="' + escapeHtml(option.key) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' + escapeHtml(option.label) + '</button>';
          }).join('') +
        '</div>' +
        '<div class="shop-list-view-actions" role="group" aria-label="Listing view">' +
          '<button class="shop-list-view-button' + (viewMode === "list" ? ' is-active' : '') + '" type="button" data-list-view="list" aria-pressed="' + (viewMode === "list" ? 'true' : 'false') + '">List</button>' +
          '<button class="shop-list-view-button' + (viewMode === "feed" ? ' is-active' : '') + '" type="button" data-list-view="feed" aria-pressed="' + (viewMode === "feed" ? 'true' : 'false') + '">Feed</button>' +
        '</div>' +
      '</div>';
  }

  function listingViewControlsMarkup(state, count, label) {
    const viewMode = normalizeListingViewMode(state && state.listingViewMode);
    const safeLabel = String(label || "Listings").trim() || "Listings";
    return '' +
      '<div class="shop-list-sortbar shop-list-viewbar" role="toolbar" aria-label="' + escapeHtml(safeLabel + " view") + '">' +
        '<span class="shop-list-sort-count">' + escapeHtml(String(Math.max(0, Number(count || 0) || 0)) + " " + safeLabel.toLowerCase()) + '</span>' +
        '<div class="shop-list-view-actions" role="group" aria-label="Listing view">' +
          '<button class="shop-list-view-button' + (viewMode === "list" ? ' is-active' : '') + '" type="button" data-list-view="list" aria-pressed="' + (viewMode === "list" ? 'true' : 'false') + '">List</button>' +
          '<button class="shop-list-view-button' + (viewMode === "feed" ? ' is-active' : '') + '" type="button" data-list-view="feed" aria-pressed="' + (viewMode === "feed" ? 'true' : 'false') + '">Feed</button>' +
        '</div>' +
      '</div>';
  }

  function renderRootItemsList(state, query) {
    if (!state || !state.listNode) return;
    const itemLibrary = Array.isArray(state.itemLibrary) ? state.itemLibrary : [];
    if (!state.itemLibraryRequested && !state.itemLibraryLoading && !state.itemLibraryLoaded) {
      refreshItemLibrary(state, { force: false });
      state.listNode.innerHTML = loadingStateMarkup("Loading items");
      return;
    }
    if (state.itemLibraryLoading && !itemLibrary.length) {
      state.listNode.innerHTML = loadingStateMarkup("Loading items");
      return;
    }
    if (state.itemLibraryError && !itemLibrary.length) {
      state.listNode.innerHTML = stateCardMarkup({
        tone: "offline",
        title: "Could not load items",
        message: "Try again or view nearby shops.",
        actions: [
          { label: "Try again", attribute: 'data-refresh-items="true"', tone: "primary" },
          { label: "Find shops", attribute: 'data-go-home="true"' }
        ]
      });
      return;
    }

    const visibleItems = sortItemLibraryRows(state, itemLibrary.filter(function (item) {
      return matchesSearch([
        item && item.title,
        item && item.description,
        item && item.price,
        item && item.shopName,
        item && item.shopId
      ], query);
    })).slice(0, 120);

    if (!visibleItems.length) {
      state.listNode.innerHTML = rootEmptyStateMarkup(state, "items", !!query);
      return;
    }

    state.listNode.innerHTML = itemSortControlsMarkup(state, visibleItems.length, false) + visibleItems.map(function (item) {
      const shopId = String(item && item.shopId || "").trim();
      const shop = state.shopById[shopId] || null;
      const detail = state.shopDetails[shopId] || shopDetailFromPreview(shop);
      const shopName = String(item && item.shopName || shop && (shop.display_name || shop.shop_id) || shopId || "Shop").trim();
      const color = String(item && item.shopMapColor || shopColor(shop || {})).trim();
      const safeColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : HASHOP_DEFAULT_SHOP_COLOR;
      const cartItemId = libraryItemCartId(item);
      const locationLabel = clampText(
        (detail && detail.location)
          || (shop && shop.location_label)
          || statusLabel(shop, state.userPoint),
        34
      );
      return shopItemCardMarkup(state, detail, Object.assign({}, item, {
        id: cartItemId || libraryItemCartId(item)
      }), shop, {
        shopId: shopId,
        itemId: cartItemId,
        shopName: shopName + (locationLabel ? (" · " + locationLabel) : ""),
        color: safeColor
      });
    }).join("");
  }

  function renderOwnerShopList(state, query) {
    if (!state || !state.listNode) return;
    const ownerShops = ownerAccountShops(state);
    const visibleOwnerShops = ownerShops.filter(function (ownerShop) {
      const shopId = String(ownerShop && ownerShop.shopId || "").trim();
      const previewShop = state.shopById[shopId] || {};
      const previewDetail = state.shopDetails[shopId] || shopDetailFromPreview(previewShop);
      return matchesSearch([
        ownerShop && ownerShop.shopName,
        shopId,
        previewShop.display_name,
        previewShop.location_label,
        previewDetail && previewDetail.location
      ], query);
    });
    if (!visibleOwnerShops.length) {
      state.listNode.innerHTML = stateCardMarkup({
        title: query ? "No shops" : "No registered shops",
        actions: [
          query
            ? { label: "Clear search", attribute: 'data-clear-search="true"' }
            : { label: "Add shop", attribute: 'data-account-open-login="true"', tone: "primary" }
        ]
      });
      return;
    }
    state.listNode.innerHTML = listingViewControlsMarkup(state, visibleOwnerShops.length, "Shops") + visibleOwnerShops.map(function (ownerShop) {
      const shopId = String(ownerShop && ownerShop.shopId || "").trim();
      const previewShop = state.shopById[shopId] || {};
      const previewDetail = state.shopDetails[shopId] || shopDetailFromPreview(previewShop);
      const shopName = String(ownerShop && ownerShop.shopName || previewShop.display_name || shopId || "Shop").trim();
      let itemNames = shopItemPreview(previewDetail, 4);
      if (!itemNames.length) {
        itemNames = shopItemLibraryPreview(state, shopId, 4);
      }
      const imageMarkup = previewDetail && previewDetail.logoFile
        ? '<img src="' + escapeHtml(shopLogoUrl(shopId)) + '" alt="' + escapeHtml(shopName + " shop") + '">'
        : '<span>' + escapeHtml((shopName.charAt(0) || "#").toUpperCase()) + '</span>';
      return '' +
        '<article class="shop-card shop-discovery-card" data-account-open-shop="' + escapeHtml(shopId) + '" style="--shop-color:' + escapeHtml(shopColor(previewShop)) + ';">' +
          '<div class="shop-card-thumb">' + imageMarkup + '</div>' +
          '<div class="shop-card-main">' +
            '<div class="shop-card-topline">' +
              '<div class="shop-card-title-block">' +
                '<strong>' + escapeHtml(shopName) + '</strong>' +
                '<span class="shop-card-subtitle">' + escapeHtml(shopId || "Registered shop") + '</span>' +
              '</div>' +
              '<span class="shop-card-open">Manage</span>' +
            '</div>' +
            '<div class="shop-card-items">' +
              (itemNames.length
                ? itemNames.map(function (itemName) {
                    return '<span class="shop-card-item">' + escapeHtml(itemName) + '</span>';
                  }).join('')
                : '<span class="shop-card-item">Items</span>') +
            '</div>' +
          '</div>' +
        '</article>';
    }).join("");
  }

  function renderOwnerItemList(state, query) {
    if (!state || !state.listNode) return;
    const ownerIds = ownerShopIdSet(state);
    const itemLibrary = Array.isArray(state.itemLibrary) ? state.itemLibrary : [];
    if (!state.itemLibraryRequested && !state.itemLibraryLoading && !state.itemLibraryLoaded) {
      refreshItemLibrary(state, { force: false });
      state.listNode.innerHTML = loadingStateMarkup("Loading items");
      return;
    }
    if (state.itemLibraryLoading && !itemLibrary.length) {
      state.listNode.innerHTML = loadingStateMarkup("Loading items");
      return;
    }
    const ownerItems = sortItemLibraryRows(state, itemLibrary.filter(function (item) {
      return !!ownerIds[String(item && item.shopId || "").trim()];
    }).filter(function (item) {
      return matchesSearch([
        item && item.title,
        item && item.description,
        item && item.shopName,
        item && item.shopId
      ], query);
    }));
    if (!ownerItems.length) {
      state.listNode.innerHTML = stateCardMarkup({
        title: query ? "No items" : "No items listed",
        actions: [
          query
            ? { label: "Clear search", attribute: 'data-clear-search="true"' }
            : { label: "Shops", attribute: 'data-go-home="true"', tone: "primary" }
        ]
      });
      return;
    }
    state.listNode.innerHTML = itemSortControlsMarkup(state, ownerItems.length, true) + ownerItems.map(function (item) {
      const shopId = String(item && item.shopId || "").trim();
      const ownerShop = ownerAccountShops(state).find(function (shop) {
        return String(shop && shop.shopId || "").trim() === shopId;
      }) || {};
      const title = String(item && item.title || "Item").trim();
      const shopName = String(item && item.shopName || ownerShop.shopName || shopId || "Shop").trim();
      const imageFiles = Array.isArray(item && item.imageFiles) ? item.imageFiles : [];
      const imageMarkup = imageFiles.length
        ? '<img src="' + escapeHtml(assetFileUrl(imageFiles[0])) + '" alt="' + escapeHtml(title) + '">'
        : '<span>' + escapeHtml((title.charAt(0) || "#").toUpperCase()) + '</span>';
      const quantity = Math.max(0, Number(item && item.quantity || 0));
      return '' +
        '<article class="shop-card shop-discovery-card shop-item-discovery-card" data-account-open-shop="' + escapeHtml(shopId) + '" style="--shop-color:' + escapeHtml(item && item.shopMapColor || HASHOP_DEFAULT_SHOP_COLOR) + ';">' +
          '<div class="shop-card-thumb">' + imageMarkup + '</div>' +
          '<div class="shop-card-main">' +
            '<div class="shop-card-topline">' +
              '<div class="shop-card-title-block">' +
                '<strong>' + escapeHtml(title) + '</strong>' +
                '<span class="shop-card-subtitle">' + escapeHtml(shopName) + '</span>' +
              '</div>' +
              '<span class="shop-card-open">' + escapeHtml(quantity > 0 ? (quantity + " left") : "Qty") + '</span>' +
            '</div>' +
            '<div class="shop-card-items">' +
              '<span class="shop-card-item">Edit</span>' +
              (item && item.price ? '<span class="shop-card-item">' + escapeHtml(String(item.price)) + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</article>';
    }).join("");
  }

  function renderShopList(state) {
    if (!state.listNode) return;
    syncListingViewAttribute(state);
    syncScreenMode(state);
    syncBuyerOrdersPolling(state);
    if (state.debugPaneView === "concept-account-shop") {
      renderConceptAccountShopPane(state);
      return;
    }
    if (state.debugPaneView === "concept-shop-workspace") {
      renderConceptShopWorkspacePane(state);
      return;
    }
    if (state.debugPaneView === "setup") {
      renderVendorSetupPane(state);
      return;
    }
    if (state.debugPaneView === "login") {
      renderLoginPane(state);
      return;
    }
    if (state.debugPaneView === "account") {
      renderAccountPane(state);
      return;
    }
    if (state.debugPaneView === "recent-orders") {
      renderRecentOrdersPane(state);
      return;
    }
    if (state.activeShopId) {
      renderShopDetail(state);
      return;
    }
    destroyOwnerPickupMap(state);
    const query = normalizeSearch(state.searchQuery);
    const rootMode = normalizeRootMode(state.rootMode);
    if (isOwnerAccountMode(state)) {
      if (rootMode === "items") {
        renderOwnerItemList(state, query);
        return;
      }
      renderOwnerShopList(state, query);
      return;
    }
    if (rootMode === "items") {
      renderRootItemsList(state, query);
      return;
    }
    if (!state.shops.length) {
      state.listNode.innerHTML = rootEmptyStateMarkup(state, rootMode, false);
      return;
    }
    const visibleShops = orderedShops(state.shops, state.userPoint).filter(function (shop) {
      const previewDetail = state.shopDetails[String(shop.shop_id || "").trim()] || shopDetailFromPreview(shop);
      const hasItems = shopItemPreview(previewDetail, 1).length > 0;
      const hasContact = !!(shopCallHref(previewDetail && previewDetail.contact) || shopWhatsAppHref(previewDetail && previewDetail.contact, shop && shop.display_name));
      if (rootMode === "items" && !hasItems && !query) return false;
      if (rootMode === "contact" && !hasContact) return false;
      return matchesSearch(shopSearchTokens(shop, previewDetail), query);
    });
    if (!visibleShops.length) {
      state.listNode.innerHTML = rootEmptyStateMarkup(state, rootMode, !!query);
      return;
    }
    state.listNode.innerHTML = listingViewControlsMarkup(state, visibleShops.length, "Shops") + visibleShops.map(function (shop) {
      const previewDetail = state.shopDetails[String(shop.shop_id || "").trim()] || shopDetailFromPreview(shop);
      const shopId = String(shop.shop_id || "").trim();
      const shopName = String(shop.display_name || shopId || "Shop").trim();
      let itemNames = shopItemPreview(previewDetail, 5);
      if (!itemNames.length) {
        itemNames = shopItemLibraryPreview(state, shopId, 5);
      }
      const status = shopOpenStatus(previewDetail);
      const statusText = status === "Open now" ? "Open" : status;
      const locationLabel = clampText(
        (previewDetail && previewDetail.location)
          || shop.location_label
          || statusLabel(shop, state.userPoint),
        34
      );
      const imageMarkup = previewDetail && previewDetail.logoFile
        ? '<img src="' + escapeHtml(shopLogoUrl(shopId)) + '" alt="' + escapeHtml(shopName + " shop") + '">'
        : '<span>' + escapeHtml((shopName.charAt(0) || "#").toUpperCase()) + '</span>';
      return '' +
        '<article class="shop-card shop-discovery-card" data-open-shop-card="' + escapeHtml(shopId) + '" style="--shop-color:' + escapeHtml(shopColor(shop)) + ';">' +
          '<div class="shop-card-thumb">' + imageMarkup + '</div>' +
          '<div class="shop-card-main">' +
            '<div class="shop-card-topline">' +
              '<div class="shop-card-title-block">' +
                '<strong>' + escapeHtml(shopName) + '</strong>' +
                '<span class="shop-card-subtitle">' + escapeHtml(locationLabel) + '</span>' +
              '</div>' +
              '<span class="shop-card-open' + (status === "Closed" ? " is-closed" : "") + '">' + escapeHtml(statusText) + '</span>' +
            '</div>' +
            '<div class="shop-card-items">' +
              (itemNames.length
                ? itemNames.map(function (itemName) {
                    return '<span class="shop-card-item">' + escapeHtml(itemName) + '</span>';
                  }).join('')
                : '<span class="shop-card-item">Items listed soon</span>') +
            '</div>' +
          '</div>' +
        '</article>';
    }).join("");
  }

  function syncHomeUtilityUi(state) {
    if (!state) return;
    const screenMode = syncScreenMode(state);
    const rootView = isRootUtilityState(state, screenMode);
    const browseNavActive = isRootScreenMode(screenMode) && !state.debugPaneView && !state.activeShopId;
    const ownerMode = isOwnerAccountMode(state);
    const navLabels = ownerMode
      ? { shops: "Shops", items: "Inventory", cart: "Orders", account: "Account" }
      : { shops: "Shops", items: "Items", cart: "Cart", account: "Account" };
    if (state.primaryActionsNode) {
      state.primaryActionsNode.hidden = !rootView;
    }
    (state.homeModeButtons || []).forEach(function (button) {
      if (!(button instanceof HTMLElement)) return;
      const mode = normalizeRootMode(button.getAttribute("data-home-mode"));
      button.classList.toggle("is-active", browseNavActive && mode === normalizeRootMode(state.rootMode));
    });
    (state.homeNavButtons || []).forEach(function (button) {
      if (!(button instanceof HTMLElement)) return;
      const nav = String(button.getAttribute("data-home-nav") || "").trim();
      const labelNode = button.querySelector("span:last-child");
      const navLabel = navLabels[nav] || "";
      if (labelNode && navLabel) {
        labelNode.textContent = navLabel;
      }
      if (navLabel) {
        button.setAttribute("aria-label", navLabel);
        button.setAttribute("title", navLabel);
      }
      const iconNode = button.querySelector(".home-bottom-link-icon");
      if (iconNode && nav === "cart") {
        iconNode.classList.toggle("is-cart", !ownerMode);
        iconNode.classList.toggle("is-orders", ownerMode);
      }
      let active = false;
      if (nav === "cart") {
        active = ownerMode ? (screenMode === "owner-orders") : state.debugPaneView === "recent-orders";
      } else if (nav === "orders") {
        active = state.debugPaneView === "recent-orders";
      } else if (nav === "account") {
        active = state.debugPaneView === "account" || state.debugPaneView === "login" || state.debugPaneView === "setup";
      } else if (nav === "items") {
        active = ownerMode ? (screenMode === "owner-items") : (browseNavActive && normalizeRootMode(state.rootMode) === "items");
      } else {
        active = ownerMode
          ? (screenMode === "owner-shop" || screenMode === "owner-manage" || screenMode === "owner-add" || (browseNavActive && normalizeRootMode(state.rootMode) !== "items"))
          : (browseNavActive && normalizeRootMode(state.rootMode) !== "items");
      }
      button.classList.toggle("is-active", active);
    });
  }

  function renderLucideIcons(root) {
    if (!window.lucide || typeof window.lucide.createIcons !== "function") return;
    const target = root || document;
    window.lucide.createIcons({
      attrs: {
        "aria-hidden": "true",
        "focusable": "false",
        "stroke-width": 2.2
      },
      root: target
    });
    Array.prototype.forEach.call(target.querySelectorAll("svg.lucide[data-lucide]"), function (icon) {
      icon.removeAttribute("data-lucide");
    });
  }

  function scheduleIconRender(state) {
    if (!state || state.iconRenderFrame) return;
    state.iconRenderFrame = window.requestAnimationFrame(function () {
      state.iconRenderFrame = 0;
      renderLucideIcons(state.shellNode || document);
    });
  }

  function installIconRenderer(state) {
    if (!state || !state.shellNode || state.iconRendererInstalled) return;
    state.iconRendererInstalled = true;
    if (window.MutationObserver) {
      state.iconObserver = new window.MutationObserver(function () {
        scheduleIconRender(state);
      });
      state.iconObserver.observe(state.shellNode, { childList: true, subtree: true });
    }
    scheduleIconRender(state);
  }

  function openRootBrowseMode(state, mode, options) {
    if (!state) return;
    closeOwnerAddMenu(state);
    const settings = options && typeof options === "object" ? options : {};
    state.rootMode = normalizeRootMode(mode);
    if (state.activeShopId) {
      closeShopInPane(state);
    } else if (state.debugPaneView === "setup") {
      closeSetupPane(state);
    } else if (state.debugPaneView === "login") {
      closeDebugLoginPane(state);
    } else if (state.debugPaneView === "account") {
      closeAccountPane(state);
    } else if (state.debugPaneView === "recent-orders") {
      closeBuyerOrdersPane(state);
    } else if (isConceptPane(state)) {
      state.debugPaneView = "";
      state.conceptName = "";
      state.conceptMode = false;
    }
    setPaneExpanded(state, true, "normal");
    state.panelNode.classList.remove("is-shop-view");
    state.panelNode.classList.remove("is-login-view");
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    renderShopList(state);
    resetPaneScroll(state);
    if (settings.focusSearch && state.searchInput) {
      window.requestAnimationFrame(function () {
        state.searchInput.focus();
        state.searchInput.select();
      });
    }
  }

  function updateSearchField(state) {
    if (!state || !state.searchInput) return;
    const searchHead = state.searchInput.closest(".shop-list-head");
    const hidden = state.debugPaneView === "setup"
      || state.debugPaneView === "login"
      || state.debugPaneView === "account"
      || (!!state.activeShopId && state.activeShopView === "cart")
      || (state.activeShopView === "confirmation")
      || (isOwnerViewingShop(state) && state.ownerPanel.tab === "settings");
    if (searchHead) {
      searchHead.hidden = hidden;
    }
    state.searchInput.disabled = hidden;
    syncHomeUtilityUi(state);
    if (hidden) {
      return;
    }
    let placeholder = "Search shops";
    if (state.debugPaneView === "recent-orders") {
      placeholder = "Search history";
    } else if (state.activeShopId) {
      if (isOwnerViewingShop(state) && state.ownerPanel.tab === "history") {
        placeholder = state.ownerPanel.section === "items"
          ? "Search items"
          : state.ownerPanel.section === "sales"
          ? "Search sales"
          : "Search orders";
      } else {
        placeholder = state.activeShopView === "cart" ? "Search cart" : "Search items";
      }
    } else if (normalizeRootMode(state.rootMode) === "items") {
      placeholder = isOwnerAccountMode(state) ? "Search stock" : "Search items or shops";
    } else if (normalizeRootMode(state.rootMode) === "contact") {
      placeholder = "Search shops you can call";
    } else if (isOwnerAccountMode(state)) {
      placeholder = "Search my shops";
    }
    state.searchInput.placeholder = placeholder;
    state.searchInput.setAttribute("aria-label", placeholder);
    if (state.searchInput.value !== String(state.searchQuery || "")) {
      state.searchInput.value = String(state.searchQuery || "");
    }
  }

  function setLocateButtonState(button, mode, label, options) {
    if (!button) return;
    const settings = options && typeof options === "object" ? options : {};
    const symbol = String(settings.symbol || "").trim();
    button.classList.remove("is-loading", "is-active", "is-error", "is-danger", "is-symbol");
    if (mode) button.classList.add(mode);
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    if (symbol) {
      button.classList.add("is-symbol");
      button.innerHTML = '<span class="shop-list-action-symbol" aria-hidden="true">' + escapeHtml(symbol) + '</span><span class="shop-visually-hidden">' + escapeHtml(label) + '</span>';
      return;
    }
    button.textContent = label;
  }

  function normalizeCompassHeading(value) {
    const number = Number(value);
    if (!isFinite(number)) return null;
    return ((number % 360) + 360) % 360;
  }

  function setCompassHeading(state, heading) {
    if (!state || !state.mapCompassButton) return;
    const normalized = normalizeCompassHeading(heading);
    state.compassHeading = normalized;
    state.mapCompassButton.classList.toggle("has-heading", normalized !== null);
    if (normalized === null) {
      state.mapCompassButton.style.removeProperty("--map-heading");
      state.mapCompassButton.setAttribute("aria-label", "Rotate map");
      state.mapCompassButton.setAttribute("title", "Rotate map");
      return;
    }
    const rounded = Math.round(normalized);
    state.mapCompassButton.style.setProperty("--map-heading", rounded + "deg");
    state.mapCompassButton.setAttribute("aria-label", "Map direction " + rounded + " degrees. Tap to rotate, long press to reset");
    state.mapCompassButton.setAttribute("title", "Map direction " + rounded + " degrees");
  }

  function applyMapVisualBearing(state, heading) {
    if (!state || !state.mapNode) return;
    const normalized = normalizeCompassHeading(heading) || 0;
    state.mapNode.style.setProperty("--map-visual-bearing", normalized + "deg");
    state.mapNode.classList.toggle("has-visual-bearing", normalized !== 0);
  }

  function applyMapBearing(state, heading) {
    if (!state || !state.map) return;
    const normalized = normalizeCompassHeading(heading) || 0;
    let nativeConfirmed = false;
    if (typeof state.map.setHeading === "function") {
      try {
        state.map.setHeading(normalized);
        if (typeof state.map.setTilt === "function") {
          state.map.setTilt(normalized ? 45 : 0);
        }
        if (typeof state.map.getHeading === "function") {
          const currentHeading = normalizeCompassHeading(state.map.getHeading()) || 0;
          nativeConfirmed = Math.abs(currentHeading - normalized) < 1;
        }
      } catch (error) {}
    }
    if (typeof state.map.setBearing === "function") {
      try {
        state.map.setBearing(normalized);
        if (typeof state.map.getBearing === "function") {
          const currentBearing = normalizeCompassHeading(state.map.getBearing()) || 0;
          nativeConfirmed = nativeConfirmed || Math.abs(currentBearing - normalized) < 1;
        } else if (state.mapProvider === "leaflet") {
          nativeConfirmed = true;
        }
      } catch (error) {}
    }
    applyMapVisualBearing(state, nativeConfirmed ? 0 : normalized);
    setCompassHeading(state, normalized);
  }

  function resetMapNorthAndView(state) {
    if (!state || !state.map) return;
    applyMapBearing(state, 0);
    updateMapView(state);
    stabilizeMapViewport(state, 0);
  }

  function rotateMapDirection(state, delta) {
    if (!state || !state.map) return;
    const current = normalizeCompassHeading(state.compassHeading) || 0;
    applyMapBearing(state, current + (Number(delta) || 0));
    stabilizeMapViewport(state, 0);
  }

  function installCompassControl(state) {
    if (!state || !state.mapCompassButton || state.compassInstalled) return;
    state.compassInstalled = true;
    setCompassHeading(state, 0);
    let pressTimer = 0;
    let longPressed = false;
    state.mapCompassButton.addEventListener("pointerdown", function () {
      longPressed = false;
      if (pressTimer) window.clearTimeout(pressTimer);
      pressTimer = window.setTimeout(function () {
        longPressed = true;
        resetMapNorthAndView(state);
      }, 520);
    });
    state.mapCompassButton.addEventListener("pointerup", function () {
      if (pressTimer) window.clearTimeout(pressTimer);
      pressTimer = 0;
    });
    state.mapCompassButton.addEventListener("pointercancel", function () {
      if (pressTimer) window.clearTimeout(pressTimer);
      pressTimer = 0;
    });
    state.mapCompassButton.addEventListener("click", function () {
      if (longPressed) {
        longPressed = false;
        return;
      }
      if (state.compassHeading && Math.abs(state.compassHeading) >= 315) {
        resetMapNorthAndView(state);
        return;
      }
      rotateMapDirection(state, 45);
    });
  }

  function googleProjectionOverlay(state) {
    if (!state || state.mapProvider !== "google" || !window.google || !window.google.maps || !state.map) return null;
    if (!state.googleProjectionOverlay) {
      const overlay = new window.google.maps.OverlayView();
      overlay.onAdd = function () {};
      overlay.draw = function () {};
      overlay.onRemove = function () {};
      overlay.setMap(state.map);
      state.googleProjectionOverlay = overlay;
    }
    return state.googleProjectionOverlay;
  }

  function mapLatLngFromClientPoint(state, clientX, clientY) {
    if (!state || !state.map || !state.mapNode) return null;
    if (!isFinite(clientX) || !isFinite(clientY)) return null;
    const rect = state.mapNode.getBoundingClientRect();
    const x = Number(clientX) - rect.left;
    const y = Number(clientY) - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    if (state.mapProvider === "leaflet" && window.L && typeof state.map.containerPointToLatLng === "function") {
      const leafletLatLng = state.map.containerPointToLatLng(window.L.point(x, y));
      return leafletLatLng && isValidMapPoint(leafletLatLng.lat, leafletLatLng.lng)
        ? [Number(leafletLatLng.lat), Number(leafletLatLng.lng)]
        : null;
    }
    if (state.mapProvider === "google" && window.google && window.google.maps) {
      const overlay = googleProjectionOverlay(state);
      const projection = overlay && typeof overlay.getProjection === "function" ? overlay.getProjection() : null;
      if (!projection || typeof projection.fromContainerPixelToLatLng !== "function") return null;
      const googleLatLng = projection.fromContainerPixelToLatLng(new window.google.maps.Point(x, y));
      if (!googleLatLng) return null;
      const lat = typeof googleLatLng.lat === "function" ? googleLatLng.lat() : googleLatLng.lat;
      const lng = typeof googleLatLng.lng === "function" ? googleLatLng.lng() : googleLatLng.lng;
      return isValidMapPoint(lat, lng) ? [Number(lat), Number(lng)] : null;
    }
    return null;
  }

  function installSetupAddressPicker(state) {
    if (!state || !state.mapNode || state.setupAddressPickerInstalled) return;
    state.setupAddressPickerInstalled = true;
    let pressTimer = 0;
    let startX = 0;
    let startY = 0;
    let pointerId = null;

    function clearPress() {
      if (pressTimer) window.clearTimeout(pressTimer);
      pressTimer = 0;
      pointerId = null;
    }

    state.mapNode.addEventListener("pointerdown", function (event) {
      if (!mapAddressPickerActive(state)) return;
      if (event.button && event.button !== 0) return;
      const target = event.target;
      if (target instanceof Element && target.closest(".map-popup, .leaflet-control, .gm-style-iw")) return;
      clearPress();
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      pressTimer = window.setTimeout(function () {
        pressTimer = 0;
        const point = mapLatLngFromClientPoint(state, startX, startY);
        if (!point) return;
        setMapAddressPickerFromPoint(state, point[0], point[1], 0, {
          pendingMessage: "Moving pin...",
          doneMessage: "Pin moved. Hold map to adjust."
        });
      }, 560);
    });

    state.mapNode.addEventListener("pointermove", function (event) {
      if (!pressTimer || pointerId !== event.pointerId) return;
      const dx = Math.abs(Number(event.clientX) - startX);
      const dy = Math.abs(Number(event.clientY) - startY);
      if (dx > 10 || dy > 10) clearPress();
    });
    state.mapNode.addEventListener("pointerup", clearPress);
    state.mapNode.addEventListener("pointercancel", clearPress);
    state.mapNode.addEventListener("contextmenu", function (event) {
      if (!mapAddressPickerActive(state)) return;
      event.preventDefault();
      const point = mapLatLngFromClientPoint(state, event.clientX, event.clientY);
      if (!point) return;
      setMapAddressPickerFromPoint(state, point[0], point[1], 0, {
        pendingMessage: "Moving pin...",
        doneMessage: "Pin moved. Hold map to adjust."
      });
    });
  }

  function mapTapIsUiChrome(target) {
    return target instanceof Element && !!target.closest(
      ".map-popup, .leaflet-control, .leaflet-marker-icon, .leaflet-popup, .gm-style-iw, .gm-bundled-control, .gmnoprint, button, a"
    );
  }

  function setMapBrowsePoint(state, lat, lng, options) {
    if (!state || !isValidMapPoint(lat, lng) || mapAddressPickerActive(state)) return false;
    const settings = options && typeof options === "object" ? options : {};
    state.orderMapCue = null;
    upsertUserMarker(state, Number(lat), Number(lng), 0, {
      persist: false,
      source: "map",
      title: "Map point"
    });
    if (!settings.keepPaneState && !state.activeShopId && !state.debugPaneView) {
      setPaneExpanded(state, true, "normal");
    }
    renderShopList(state);
    updateSearchField(state);
    syncActionButton(state);
    syncMapUiState(state);
    return true;
  }

  function installInteractiveMapBrowse(state) {
    if (!state || !state.map || state.interactiveMapBrowseInstalled) return;
    state.interactiveMapBrowseInstalled = true;
    if (state.mapProvider === "google" && window.google && window.google.maps && typeof state.map.addListener === "function") {
      state.map.addListener("click", function (event) {
        if (mapAddressPickerActive(state)) return;
        if (event && mapTapIsUiChrome(event.domEvent && event.domEvent.target)) return;
        const latLng = event && event.latLng;
        if (!latLng) return;
        const lat = typeof latLng.lat === "function" ? latLng.lat() : latLng.lat;
        const lng = typeof latLng.lng === "function" ? latLng.lng() : latLng.lng;
        setMapBrowsePoint(state, lat, lng);
      });
      return;
    }
    if (state.mapProvider === "leaflet" && typeof state.map.on === "function") {
      state.map.on("click", function (event) {
        if (mapAddressPickerActive(state)) return;
        if (event && event.originalEvent && mapTapIsUiChrome(event.originalEvent.target)) return;
        const latlng = event && event.latlng;
        if (!latlng) return;
        setMapBrowsePoint(state, latlng.lat, latlng.lng);
      });
    }
  }

  function setPaneNavButtonState(button, options) {
    if (!button) return;
    const settings = options && typeof options === "object" ? options : {};
    const label = String(settings.label || "").trim();
    const count = Math.max(0, Number(settings.count || 0) || 0);
    button.classList.toggle("is-hidden", !!settings.hidden);
    button.classList.toggle("is-active", !!settings.active);
    button.classList.toggle("is-loading", !!settings.loading);
    button.classList.toggle("has-count", count > 0);
    if (count > 0) {
      button.setAttribute("data-count", String(Math.min(count, 99)));
    } else {
      button.removeAttribute("data-count");
    }
    if (label) {
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
    }
  }

  function syncMapLocateButton(state) {
    if (!state || !state.mapLocateButton) return;
    const label = state.locateLoading ? "Locating" : "Locate me";
    state.mapLocateButton.classList.toggle("is-loading", !!state.locateLoading);
    state.mapLocateButton.classList.toggle("is-active", !state.locateLoading && !!state.userPoint);
    state.mapLocateButton.setAttribute("aria-label", label);
    state.mapLocateButton.setAttribute("title", label);
    const textNode = state.mapLocateButton.querySelector(".map-locate-button-text");
    if (textNode) {
      textNode.textContent = label;
    }
  }

  function resetPaneScroll(state) {
    if (!state || !state.listNode) return;
    state.listNode.scrollTop = 0;
  }

  function scrollOwnerSectionIntoView(state, sectionName) {
    if (!state || !state.listNode || !sectionName) return;
    window.requestAnimationFrame(function () {
      const node = state.listNode.querySelector('[data-owner-section-root="' + sectionName + '"]');
      if (!(node instanceof Element)) return;
      node.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest"
      });
    });
  }

  function syncOwnerSectionUi(state) {
    if (!state || !state.listNode) return;
    const openSection = String(state.ownerPanel.section || "").trim();
    const sections = Array.from(state.listNode.querySelectorAll("[data-owner-section-root]"));
    sections.forEach(function (section) {
      if (!(section instanceof HTMLElement)) return;
      const key = String(section.getAttribute("data-owner-section-root") || "").trim();
      const isOpen = !!openSection && key === openSection;
      section.classList.toggle("is-open", isOpen);
      const button = section.querySelector("[data-owner-section-toggle]");
      if (button instanceof HTMLButtonElement) {
        button.setAttribute("aria-expanded", String(isOpen));
      }
      const body = section.querySelector(".shop-owner-section-body");
      if (body instanceof HTMLElement) {
        body.setAttribute("aria-hidden", String(!isOpen));
      }
    });
    if (openSection === "profile") {
      ensureOwnerPickupMap(state);
    }
  }

  function closeOwnerAddMenu(state) {
    if (state && state.ownerPanel) {
      state.ownerPanel.addMenuOpen = false;
    }
  }

  function toggleOwnerAddMenu(state) {
    if (!state || !state.ownerPanel) return;
    state.ownerPanel.addMenuOpen = !state.ownerPanel.addMenuOpen;
    renderShopList(state);
  }

  function syncActionButton(state) {
    if (!state) return;
    syncHomeUtilityUi(state);
    const shopAuthPaneOpen = state.debugPaneView === "login" || state.debugPaneView === "setup";
    const conceptPaneOpen = isConceptPane(state);
    const ownerOrdersMode = shouldUseOwnerOrdersNav(state);
    const ownerPendingCount = ownerPendingOrdersNavCount(state);
    const ownerOrdersActive = ownerOrdersNavActive(state);
    setPaneNavButtonState(state.ordersButton, {
      hidden: shopAuthPaneOpen || conceptPaneOpen || !ownerOrdersMode,
      active: ownerOrdersMode && ownerOrdersActive,
      loading: ownerOrdersMode && !!state.ownerOrdersNavLoading,
      count: ownerOrdersMode ? ownerPendingCount : 0,
      label: ownerOrdersMode
        ? (
          ownerOrdersActive
            ? (state.ownerOrdersNavLoading ? "Refreshing shop orders" : "Shop orders")
            : (
              ownerPendingCount
                ? (ownerPendingCount === 1 ? "1 pending shop order" : (ownerPendingCount + " pending shop orders"))
                : "Open shop orders"
            )
        )
        : "History is in Account"
    });
    setPaneNavButtonState(state.navLocateButton, {
      hidden: shopAuthPaneOpen || conceptPaneOpen,
      active: !state.locateLoading && !!state.userPoint,
      loading: !!state.locateLoading,
      label: state.locateLoading ? "Locating..." : (state.userPoint ? "Locate me again" : "Locate me")
    });
    syncMapLocateButton(state);
    if (!state.locateButton) return;
    state.locateButton.classList.toggle(
      "is-hidden",
      !state.activeShopId || shopAuthPaneOpen || conceptPaneOpen || state.debugPaneView === "account" || state.debugPaneView === "recent-orders"
    );
    if (shopAuthPaneOpen || conceptPaneOpen || state.debugPaneView === "account" || state.debugPaneView === "recent-orders" || !state.activeShopId) {
      setLocateButtonState(state.locateButton, "", "Cart");
      return;
    }
    if (state.activeShopId) {
      if (isOwnerViewingShop(state)) {
        setLocateButtonState(
          state.locateButton,
          state.ownerPanel.tab === "settings" ? "is-active" : "",
          state.ownerPanel.tab === "settings" ? "Close edit shop" : "Edit shop",
          { symbol: "⚙" }
        );
        return;
      }
      if (state.activeShopView === "confirmation") {
        setLocateButtonState(state.locateButton, "", "Items");
        return;
      }
      if (state.activeShopView === "cart") {
        setLocateButtonState(state.locateButton, "", "Items");
        return;
      }
      const count = cartCount(state, state.activeShopId);
      setLocateButtonState(state.locateButton, count ? "is-active" : "", count ? ("Cart (" + count + ")") : "Cart");
      return;
    }
  }

  function pulseUserMarker(state) {
    if (!state || !state.userMarker || typeof state.userMarker.getElement !== "function") return;
    const markerNode = state.userMarker.getElement();
    if (!(markerNode instanceof HTMLElement)) return;
    const target = markerNode.querySelector(".map-user-marker");
    if (!(target instanceof HTMLElement)) return;
    target.classList.remove("is-revealed");
    window.requestAnimationFrame(function () {
      target.classList.add("is-revealed");
      window.setTimeout(function () {
        target.classList.remove("is-revealed");
      }, 960);
    });
  }

  function syncUserMarkerAdjustable(state) {
    if (!state || !state.userMarker) return;
    const active = mapAddressPickerActive(state);
    if (state.mapProvider === "google" && typeof state.userMarker.setDraggable === "function") {
      state.userMarker.setDraggable(active);
      if (active && state.setupAddressDragMarker !== state.userMarker && typeof state.userMarker.addListener === "function") {
        if (state.setupAddressDragListener && typeof state.setupAddressDragListener.remove === "function") {
          state.setupAddressDragListener.remove();
        }
        state.setupAddressDragMarker = state.userMarker;
        state.setupAddressDragListener = state.userMarker.addListener("dragend", function (event) {
          if (!mapAddressPickerActive(state)) return;
          let latLng = event && event.latLng;
          if (!latLng && typeof state.userMarker.getPosition === "function") {
            latLng = state.userMarker.getPosition();
          }
          if (!latLng) return;
          const lat = typeof latLng.lat === "function" ? latLng.lat() : latLng.lat;
          const lng = typeof latLng.lng === "function" ? latLng.lng() : latLng.lng;
          setMapAddressPickerFromPoint(state, lat, lng, 0, {
            doneMessage: "Pin moved. Hold map to adjust."
          });
        });
      }
      return;
    }
    if (state.userMarker.dragging) {
      if (active && typeof state.userMarker.dragging.enable === "function") {
        state.userMarker.dragging.enable();
      } else if (!active && typeof state.userMarker.dragging.disable === "function") {
        state.userMarker.dragging.disable();
      }
    }
    if (state.setupAddressDragMarker !== state.userMarker && typeof state.userMarker.on === "function") {
      if (state.setupAddressDragMarker && state.setupAddressDragHandler && typeof state.setupAddressDragMarker.off === "function") {
        state.setupAddressDragMarker.off("dragend", state.setupAddressDragHandler);
      }
      state.setupAddressDragMarker = state.userMarker;
      state.setupAddressDragHandler = function () {
        if (!mapAddressPickerActive(state) || !state.userMarker || typeof state.userMarker.getLatLng !== "function") return;
        const latlng = state.userMarker.getLatLng();
        setMapAddressPickerFromPoint(state, latlng.lat, latlng.lng, 0, {
          doneMessage: "Pin moved. Hold map to adjust."
        });
      };
      state.userMarker.on("dragend", state.setupAddressDragHandler);
    }
    if (typeof state.userMarker.getElement === "function") {
      const markerNode = state.userMarker.getElement();
      const target = markerNode instanceof HTMLElement ? markerNode.querySelector(".map-user-marker") : null;
      if (target instanceof HTMLElement) {
        target.classList.toggle("is-adjustable", active);
      }
    }
  }

  function logoutOwnerSession(state) {
    clearShopIdentity();
    state.accountSession = loadAccountSession();
    state.ownerShopId = "";
    state.ownerOrdersNavLoading = false;
    state.ownerPanel.tab = "";
    state.ownerPanel.section = "";
    state.ownerPanel.itemId = "";
    state.ownerPanel.message = "";
    state.ownerPanel.tone = "";
    state.ownerPanel.addMenuOpen = false;
    state.ownerPanel.orderDraftOpen = false;
    state.debugPaneView = "";
    state.activeShopView = "items";
    state.searchQuery = "";
    state.panelNode.classList.remove("is-login-view");
    syncPaneUrl(state);
    if (state.loginDraft) {
      state.loginDraft.username = "";
      state.loginDraft.password = "";
      state.loginDraft.resetMode = false;
      state.loginDraft.resetStep = "address";
      state.loginDraft.resetContact = "";
      state.loginDraft.resetCode = "";
      state.loginDraft.resetPassword = "";
      state.loginDraft.status = "";
      state.loginDraft.tone = "";
      state.loginDraft.submitting = false;
    }
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function signOutAccountSession(state) {
    if (!state) return;
    clearBuyerOrdersPoll(state);
    clearAccountScopedLocalData(state);
    state.setupDraft = setupDraftFromProfile(state);
    state.ownerOrdersNavLoading = false;
    state.accountPaneMode = "";
    state.activeShopId = "";
    state.activeShopView = "items";
    state.searchQuery = "";
    state.panelNode.classList.remove("is-shop-view");
    state.panelNode.classList.remove("is-login-view");
    if (state.loginDraft) {
      state.loginDraft.username = "";
      state.loginDraft.password = "";
      state.loginDraft.resetMode = false;
      state.loginDraft.resetStep = "address";
      state.loginDraft.resetContact = "";
      state.loginDraft.resetCode = "";
      state.loginDraft.resetPassword = "";
      state.loginDraft.status = "";
      state.loginDraft.tone = "";
      state.loginDraft.submitting = false;
    }
    if (state.buyerAuthDraft) {
      state.buyerAuthDraft.password = "";
      state.buyerAuthDraft.createMode = false;
      state.buyerAuthDraft.createStep = "contact";
      state.buyerAuthDraft.resetMode = false;
      state.buyerAuthDraft.resetStep = "address";
      state.buyerAuthDraft.resetCode = "";
      state.buyerAuthDraft.resetPassword = "";
      state.buyerAuthDraft.verificationCode = "";
      state.buyerAuthDraft.name = "";
      state.buyerAuthDraft.contact = "";
      state.buyerAuthDraft.status = "Signed out.";
      state.buyerAuthDraft.tone = "";
      state.buyerAuthDraft.submitting = false;
    }
    state.accountDraft = {
      message: "",
      tone: ""
    };
    syncPaneUrl(state);
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function syncBackButton(state) {
    if (!state || !state.backButton) return;
    const hideChromeBack = state.debugPaneView === "account";
    if (hideChromeBack) {
      state.backButton.classList.remove("is-visible");
      state.backButton.setAttribute("aria-hidden", "true");
      state.backButton.tabIndex = -1;
      state.backButton.textContent = "";
      state.backButton.setAttribute("aria-label", "Account");
      state.backButton.classList.remove("is-login");
      return;
    }
    const backMode = !!state.activeShopId || !!state.debugPaneView;
    const action = accountSessionAction(state);
    state.backButton.classList.add("is-visible");
    state.backButton.setAttribute("aria-hidden", "false");
    state.backButton.tabIndex = 0;
    if (backMode) {
      state.backButton.textContent = "< Back";
    } else {
      state.backButton.textContent = action.label;
    }
    state.backButton.setAttribute("aria-label", backMode ? "Back to shops" : ("Open " + action.label));
    state.backButton.classList.toggle("is-login", !backMode && action.kind === "login");
  }

  function refreshBuyerOrders(state, options) {
    if (!state) return Promise.resolve([]);
    const force = !!(options && options.force);
    const silent = !!(options && options.silent);
    if (state.buyerOrdersLoading && !force) {
      return Promise.resolve(Array.isArray(state.buyerOrders) ? state.buyerOrders : []);
    }
    let buyerKey = ensureBuyerKey();
    const buyerAccount = accountBuyerAccount(state.accountSession || loadAccountSession());
    if (!silent) {
      state.buyerOrdersLoading = true;
      state.buyerOrdersError = "";
      syncActionButton(state);
    }
    if (!silent && (state.debugPaneView === "recent-orders" || state.debugPaneView === "account" || state.activeShopView === "confirmation")) {
      renderShopList(state);
    }
    return fetchBuyerOrders(buyerKey, 40, buyerAccount)
      .then(function (result) {
        if (!result || !result.ok) {
          throw new Error(String(result && result.payload && result.payload.error || "buyer_orders_failed"));
        }
        const responseBuyerKey = String(result.payload && result.payload.buyer_key || "").trim().slice(0, 160);
        if (responseBuyerKey && responseBuyerKey !== buyerKey) {
          buyerKey = responseBuyerKey;
          try {
            window.localStorage.setItem("hashop_buyer_key", buyerKey);
          } catch (error) {}
        }
        const orders = Array.isArray(result.payload && result.payload.orders) ? result.payload.orders : [];
        state.buyerOrders = orders;
        state.buyerOrdersLoading = false;
        state.buyerOrdersError = "";
        const existingRefs = state.buyerProfile && Array.isArray(state.buyerProfile.recentOrderRefs)
          ? state.buyerProfile.recentOrderRefs
          : [];
        const orderRefs = orders.map(function (order) {
          return {
            orderId: String(order && order.id || "").trim(),
            shopId: String(order && order.shopId || "").trim(),
            timestamp: Number(order && order.timestamp || 0)
          };
        });
        const firstNamedOrder = orders.find(function (order) {
          return !!String(order && (order.buyerName || order.buyerContact) || "").trim();
        }) || null;
        syncActiveConfirmationFromBuyerOrders(state);
        setBuyerProfile(state, {
          buyerKey: buyerKey,
          name: String(firstNamedOrder && firstNamedOrder.buyerName || state.buyerProfile.name || "").trim(),
          nickname: String(state.buyerProfile.nickname || "").trim(),
          contact: String(firstNamedOrder && firstNamedOrder.buyerContact || state.buyerProfile.contact || "").trim(),
          address: String(firstNamedOrder && firstNamedOrder.address || state.buyerProfile.address || "").trim(),
          avatarUrl: state.buyerProfile.avatarUrl || "",
          recentOrderRefs: normalizeBuyerRecentRefs(orderRefs.concat(existingRefs))
        });
        syncActionButton(state);
        if (state.debugPaneView === "recent-orders" || state.debugPaneView === "account" || state.activeShopView === "confirmation") {
          renderShopList(state);
        }
        return orders;
      })
      .catch(function () {
        if (!silent) {
          state.buyerOrdersLoading = false;
          state.buyerOrdersError = "Could not load recent history.";
          syncActionButton(state);
        }
        if (!silent && (state.debugPaneView === "recent-orders" || state.debugPaneView === "account" || state.activeShopView === "confirmation")) {
          renderShopList(state);
        }
        return [];
      });
  }

  function panelBottomPadding(state) {
    if (!state || !state.panelNode || !state.mapNode) return 24;
    const mapRect = state.mapNode.getBoundingClientRect();
    const panelRect = state.panelNode.getBoundingClientRect();
    const overlap = Math.max(0, Math.min(mapRect.bottom, panelRect.bottom) - Math.max(mapRect.top, panelRect.top));
    if (!overlap) return 24;
    const maxPadding = Math.max(24, Math.round(mapRect.height * 0.42));
    return Math.max(24, Math.min(Math.round(overlap + 24), maxPadding));
  }

  function mapShouldUseCenteredPadding(state) {
    if (!state) return false;
    const mode = currentScreenMode(state);
    if (state.activeShopId && (mode === "shop" || mode === "cart" || mode === "confirmation" || mode.indexOf("owner-") === 0)) return true;
    return mode === "account" || mode === "login" || mode === "setup";
  }

  function mapBottomPadding(state) {
    return mapShouldUseCenteredPadding(state) ? 24 : panelBottomPadding(state);
  }

  function googleMapPadding(state) {
    const bottomPadding = mapBottomPadding(state);
    return mapShouldUseCenteredPadding(state)
      ? { top: 24, right: 24, bottom: 24, left: 24 }
      : { top: 24, right: 24, bottom: bottomPadding, left: 24 };
  }

  function fitArea(map, points, bottomPadding) {
    if (!map || !points || !points.length) return;
    const verticalPadding = bottomPadding == null ? 24 : bottomPadding;
    if (points.length === 1) {
      map.fitBounds(window.L.latLng(points[0]).toBounds(900), {
        paddingTopLeft: [24, 24],
        paddingBottomRight: [24, verticalPadding],
        maxZoom: 17
      });
      return;
    }
    map.fitBounds(window.L.latLngBounds(points), {
      paddingTopLeft: [24, 24],
      paddingBottomRight: [24, verticalPadding],
      maxZoom: 16
    });
  }

  function localDiscoveryPoints(points) {
    const source = Array.isArray(points) ? points.filter(function (point) {
      return Array.isArray(point) && isFinite(point[0]) && isFinite(point[1]);
    }) : [];
    if (source.length <= 2) return source;
    const maxDistanceMeters = 150000;
    let bestCluster = [];
    source.forEach(function (basePoint) {
      const cluster = source.filter(function (point) {
        return haversineMeters(basePoint[0], basePoint[1], point[0], point[1]) <= maxDistanceMeters;
      });
      if (cluster.length > bestCluster.length) {
        bestCluster = cluster;
      }
    });
    return bestCluster.length >= 2 ? bestCluster : source;
  }

  function focusShopOnMap(state, shop) {
    if (!state || !state.map || !shop || !shop.has_location || !isFinite(shop.lat) || !isFinite(shop.lng)) return;
    state.orderMapCue = null;
    if (state.mapProvider === "google") {
      fitGoogleArea(state, [[shop.lat, shop.lng]], 17);
      syncMapUiState(state);
      return;
    }
    const point = [shop.lat, shop.lng];
    const bottomPadding = mapBottomPadding(state);
    state.map.fitBounds(window.L.latLng(point).toBounds(210), {
      paddingTopLeft: [24, 24],
      paddingBottomRight: [24, bottomPadding],
      maxZoom: 18
    });
    syncMapUiState(state);
  }

  function focusOrderCueOnMap(state, order, detail, audience) {
    if (!state || !state.map || !order) return false;
    const mode = orderFulfillmentMode(order);
    let point = null;
    let label = "";
    if (mode === "pickup") {
      const pickupLat = Number(order.pickupLat || order.pickup_lat);
      const pickupLng = Number(order.pickupLng || order.pickup_lng);
      const gps = isValidMapPoint(pickupLat, pickupLng)
        ? [pickupLat, pickupLng]
        : parseGpsValue(detail && detail.gps);
      if (gps) {
        point = gps;
      } else if (state.activeShopId && state.shopById[state.activeShopId] && state.shopById[state.activeShopId].has_location) {
        point = [Number(state.shopById[state.activeShopId].lat), Number(state.shopById[state.activeShopId].lng)];
      }
      label = "Pickup point";
    } else {
      const deliveryLat = Number(order.deliveryLat || order.delivery_lat);
      const deliveryLng = Number(order.deliveryLng || order.delivery_lng);
      if (isValidMapPoint(deliveryLat, deliveryLng)) {
        point = [deliveryLat, deliveryLng];
      }
      label = String(audience || "").trim() === "seller" ? "Delivery address" : "Delivery";
    }
    if (!point || !isValidMapPoint(point[0], point[1])) return false;
    state.orderMapCue = { mode: mode, label: label };
    if (mode === "delivery") {
      upsertUserMarker(state, Number(point[0]), Number(point[1]), 0);
    }
    if (state.mapProvider === "google") {
      fitGoogleArea(state, [[Number(point[0]), Number(point[1])]], 17);
      syncMapUiState(state);
      return true;
    }
    const bottomPadding = mapBottomPadding(state);
    state.map.fitBounds(window.L.latLng(point).toBounds(210), {
      paddingTopLeft: [24, 24],
      paddingBottomRight: [24, bottomPadding],
      maxZoom: 18
    });
    syncMapUiState(state);
    return true;
  }

  function updateMapView(state) {
    if (!state || !state.map) return;
    if (state.mapProvider === "google") {
      updateGoogleMapView(state);
      syncMapUiState(state);
      return;
    }
    const bottomPadding = mapBottomPadding(state);
    const activeShop = state.activeShopId ? state.shopById[state.activeShopId] : null;
    if (activeShop && activeShop.has_location && isFinite(activeShop.lat) && isFinite(activeShop.lng)) {
      state.map.fitBounds(window.L.latLng([activeShop.lat, activeShop.lng]).toBounds(210), {
        paddingTopLeft: [24, 24],
        paddingBottomRight: [24, bottomPadding],
        maxZoom: 18
      });
      syncMapUiState(state);
      return;
    }
    if (state.userPoint) {
      state.map.fitBounds(window.L.latLng(state.userPoint).toBounds(700), {
        paddingTopLeft: [24, 24],
        paddingBottomRight: [24, bottomPadding],
        maxZoom: 18
      });
      syncMapUiState(state);
      return;
    }
    const discoveryPoints = localDiscoveryPoints(state.shopPoints);
    if (discoveryPoints.length) {
      fitArea(state.map, discoveryPoints, bottomPadding);
      syncMapUiState(state);
      return;
    }
    state.map.setView(DEFAULT_DISCOVERY_CENTER, DEFAULT_DISCOVERY_ZOOM, { animate: false });
    syncMapUiState(state);
  }

  function scheduleMapRelayout(state) {
    if (!state || !state.map || state.mapRelayoutFrame) return;
    state.mapRelayoutFrame = window.requestAnimationFrame(function () {
      state.mapRelayoutFrame = 0;
      if (!state.map) return;
      if (state.mapProvider === "google") {
        updateMapView(state);
        return;
      }
      state.map.invalidateSize(false);
      updateMapView(state);
    });
  }

  function stabilizeMapViewport(state, delay) {
    if (!state || !state.map) return;
    const wait = Number(delay || 0);
    window.setTimeout(function () {
      if (!state.map) return;
      if (state.mapProvider === "google") {
        updateMapView(state);
        return;
      }
      state.map.invalidateSize(false);
      updateMapView(state);
      window.requestAnimationFrame(function () {
        if (!state.map) return;
        state.map.invalidateSize(false);
        updateMapView(state);
      });
    }, Math.max(0, wait));
  }

  function syncPaneFocus(state) {
    const isFocused = !!(state && state.isExpanded && state.expandMode === "full" && state.activeShopId);
    if (state && state.shellNode) {
      state.shellNode.classList.toggle("is-pane-focused", isFocused);
    }
    syncScreenMode(state);
  }

  function setPaneExpanded(state, expanded, mode) {
    if (!state || !state.panelNode || !state.toggleButton) return;
    state.isExpanded = !!expanded;
    state.expandMode = state.isExpanded ? (mode || state.expandMode || "normal") : "normal";
    state.panelNode.classList.toggle("is-expanded", state.isExpanded);
    state.panelNode.classList.toggle("is-full", state.isExpanded && state.expandMode === "full");
    syncPaneFocus(state);
    if (state.loginNode) {
      state.loginNode.classList.toggle("is-hidden", state.isExpanded && state.expandMode === "full");
    }
    state.toggleButton.setAttribute("aria-expanded", state.isExpanded ? "true" : "false");
    state.toggleButton.setAttribute("aria-label", state.isExpanded ? "Shrink shop list" : "Expand shop list");
    scheduleMapRelayout(state);
    stabilizeMapViewport(state, 120);
    stabilizeMapViewport(state, 260);
  }

  function expandSignInPortal(state) {
    setPaneExpanded(state, true, "full");
  }

  function togglePane(state) {
    if (!state) return;
    if (state.isExpanded) {
      setPaneExpanded(state, false, "normal");
      return;
    }
    setPaneExpanded(state, true, "full");
  }

  function closeOwnerOverlayToItems(state) {
    if (!state || !state.activeShopId || !isOwnerViewingShop(state)) return;
    state.activeShopView = "items";
    state.ownerPanel.tab = "";
    state.ownerPanel.section = "";
    state.ownerPanel.addMenuOpen = false;
    state.ownerPanel.orderDraftOpen = false;
    state.searchQuery = "";
    syncPaneUrl(state);
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function openOwnerSettingsPane(state, options) {
    if (!state || !state.activeShopId || !isOwnerViewingShop(state)) return;
    closeOwnerAddMenu(state);
    state.debugPaneView = "";
    state.activeShopView = "items";
    state.detailLoading = false;
    state.searchQuery = "";
    state.ownerPanel.tab = "settings";
    state.ownerPanel.section = normalizeOwnerSettingsSection(options && options.section || state.ownerPanel.section || "profile");
    state.ownerPanel.itemId = "";
    state.ownerPanel.message = "";
    state.ownerPanel.tone = "";
    state.ownerPanel.addMenuOpen = false;
    state.ownerPanel.orderDraftOpen = false;
    state.panelNode.classList.add("is-shop-view");
    state.panelNode.classList.remove("is-login-view");
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    setPaneExpanded(state, true, "full");
    syncPaneUrl(state);
    renderShopList(state);
    resetPaneScroll(state);
    refreshShopConsole(state, state.activeShopId, { preserveScroll: true }).catch(function () {});
  }

  function openOwnerHistoryPane(state, options) {
    if (!state) return;
    closeOwnerAddMenu(state);
    const shopId = String(options && options.shopId || ownerOrdersNavShopId(state) || "").trim();
    if (!shopId) {
      if (state.accountSession) {
        openAccountPane(state);
      } else {
        openAccountPane(state);
      }
      return;
    }
    const section = normalizeOwnerHistorySection(options && options.section || "orders");
    const openDraft = section === "orders" && !!(options && options.openDraft);
    if (state.activeShopId === shopId && isOwnerViewingShop(state)) {
      const previousTab = String(state.ownerPanel.tab || "").trim();
      const previousSection = String(state.ownerPanel.section || "").trim();
      const wasInSameOrdersState = state.ownerPanel.tab === "history" && state.ownerPanel.section === "orders";
      state.debugPaneView = "";
      state.activeShopView = "items";
      state.detailLoading = false;
      state.searchQuery = "";
      state.ownerPanel.tab = "history";
      state.ownerPanel.section = section;
      state.ownerPanel.message = "";
      state.ownerPanel.tone = "";
      state.ownerPanel.addMenuOpen = false;
      if (previousTab !== "history" || previousSection !== section || section !== "items") {
        state.ownerPanel.itemId = "";
      }
      state.ownerPanel.orderDraftOpen = section === "orders" && (openDraft || (wasInSameOrdersState && !!state.ownerPanel.orderDraftOpen));
      state.panelNode.classList.add("is-shop-view");
      state.panelNode.classList.remove("is-login-view");
      updateSearchField(state);
      syncActionButton(state);
      syncBackButton(state);
      setPaneExpanded(state, true, "full");
      syncPaneUrl(state);
      renderShopList(state);
      resetPaneScroll(state);
      if (section === "items") {
        refreshItemLibrary(state, { force: !!(options && options.force) });
      }
      refreshOwnerOrdersNavData(state, { force: !!(options && options.force) });
      return;
    }
    openSavedOwnerShop(state, {
      shopId: shopId,
      ownerTab: "history",
      ownerSection: section,
      ownerOrderDraftOpen: openDraft
    });
  }

  function openBuyerOrdersPane(state, options) {
    if (!state) return;
    closeOwnerAddMenu(state);
    state.debugPaneView = "recent-orders";
    state.activeShopId = "";
    state.activeShopView = "items";
    state.detailLoading = false;
    state.searchQuery = "";
    state.panelNode.classList.remove("is-shop-view");
    state.panelNode.classList.remove("is-login-view");
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    setPaneExpanded(state, true, "normal");
    syncPaneUrl(state);
    renderShopList(state);
    resetPaneScroll(state);
    refreshBuyerOrders(state, { force: !!(options && options.force) });
  }

  function openOwnerOrdersPane(state, options) {
    openOwnerHistoryPane(state, Object.assign({}, options || {}, { section: "orders" }));
  }

  function openAccountPane(state, options) {
    if (!state) return;
    const settings = options && typeof options === "object" ? options : {};
    closeOwnerAddMenu(state);
    state.debugPaneView = "account";
    state.accountPaneMode = normalizeAccountPaneMode(settings.accountPaneMode);
    if (state.accountPaneMode !== "profile") {
      state.accountProfileAddressPickActive = false;
      syncSetupAddressPickerUi(state);
      syncUserMarkerAdjustable(state);
    }
    state.activeShopId = "";
    state.activeShopView = "items";
    state.detailLoading = false;
    state.searchQuery = "";
    state.panelNode.classList.remove("is-shop-view");
    state.panelNode.classList.remove("is-login-view");
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    expandSignInPortal(state);
    syncPaneUrl(state);
    renderShopList(state);
    resetPaneScroll(state);
    refreshBuyerOrders(state, { force: false });
    refreshBuyerAccountSession(state, { silent: true });
  }

  function openConceptPane(state, concept) {
    if (!state) return;
    closeOwnerAddMenu(state);
    applyConceptPaneState(state, concept);
    conceptAsyncEffects(state, { resetScroll: true });
  }

  function closeConceptPane(state) {
    if (!isConceptPane(state)) return;
    state.debugPaneView = "";
    state.conceptName = "";
    state.conceptMode = false;
    state.searchQuery = "";
    setPaneExpanded(state, true, "normal");
    syncPaneUrl(state);
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    renderShopList(state);
    resetPaneScroll(state);
    refreshBuyerAccountSession(state, { silent: true });
  }

  function openCheckoutSignIn(state, shopId) {
    const safeShopId = String(shopId || "").trim();
    if (!state || !safeShopId) return;
    closeOwnerAddMenu(state);
    state.pendingCheckoutShopId = safeShopId;
    state.debugPaneView = "account";
    state.accountPaneMode = "buyer-login";
    state.activeShopId = "";
    state.activeShopView = "items";
    state.detailLoading = false;
    state.searchQuery = "";
    state.buyerAuthDraft.createMode = false;
    state.buyerAuthDraft.createStep = "contact";
    state.buyerAuthDraft.resetMode = false;
    state.buyerAuthDraft.resetStep = "address";
    state.buyerAuthDraft.verificationCode = "";
    state.buyerAuthDraft.status = "Sign in to place order.";
    state.buyerAuthDraft.tone = "";
    state.buyerAuthDraft.contact = String(state.buyerAuthDraft.contact || state.buyerProfile && state.buyerProfile.contact || "");
    state.panelNode.classList.remove("is-shop-view");
    state.panelNode.classList.remove("is-login-view");
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    expandSignInPortal(state);
    syncPaneUrl(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function returnToPendingCheckout(state) {
    const shopId = String(state && state.pendingCheckoutShopId || "").trim();
    if (!state || !shopId) return false;
    state.pendingCheckoutShopId = "";
    if (!state.shopById[shopId] && !state.shopDetails[shopId]) return false;
    setCheckoutNotice(state, shopId, {
      tone: "success",
      message: "Signed in."
    });
    openShopInPane(state, shopId, { shopView: "cart" });
    return true;
  }

  function closeAccountPane(state) {
    if (!state || state.debugPaneView !== "account") return;
    if (returnToPendingCheckout(state)) return;
    state.debugPaneView = "";
    state.accountPaneMode = "";
    state.searchQuery = "";
    const keepExpanded = !!state.userPoint;
    setPaneExpanded(state, keepExpanded, "normal");
    syncPaneUrl(state);
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function openAccountSubPane(state, mode, options) {
    if (!state) return;
    const settings = options && typeof options === "object" ? options : {};
    state.debugPaneView = "account";
    state.accountPaneMode = normalizeAccountPaneMode(mode);
    state.activeShopId = "";
    state.activeShopView = "items";
    state.detailLoading = false;
    state.searchQuery = "";
    state.panelNode.classList.remove("is-shop-view");
    state.panelNode.classList.remove("is-login-view");
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    expandSignInPortal(state);
    if (settings.push !== false) {
      pushPaneUrl(state);
    } else {
      syncPaneUrl(state);
    }
    renderShopList(state);
    resetPaneScroll(state);
  }

  function applyRouteState(state, route, options) {
    if (!state || !route) return;
    const settings = options && typeof options === "object" ? options : {};
    const kind = String(route.kind || "").trim();
    if (kind === "concept") {
      openConceptPane(state, route.concept);
    } else if (kind === "setup") {
      openSetupPane(state);
    } else if (kind === "login") {
      openDebugLoginPane(state);
    } else if (kind === "account") {
      openAccountPane(state, { accountPaneMode: route.accountPaneMode });
    } else if (kind === "manage") {
      openAccountPane(state, { accountPaneMode: "shops" });
    } else if (kind === "orders") {
      if (shouldUseOwnerOrdersNav(state)) {
        openOwnerOrdersPane(state);
      } else {
        openBuyerOrdersPane(state);
      }
    } else if (kind === "root") {
      openRootBrowseMode(state, route.rootMode || "shops");
    } else if (kind === "shop" && route.shopId) {
      openShopInPane(state, route.shopId, {
        shopView: route.shopView,
        ownerTab: route.ownerTab,
        ownerSection: route.ownerSection
      });
    } else {
      openRootBrowseMode(state, "shops");
    }
    if (settings.replace !== false) {
      syncPaneUrl(state);
    }
  }

  function closeBuyerOrdersPane(state) {
    if (!state || state.debugPaneView !== "recent-orders") return;
    state.debugPaneView = "";
    state.searchQuery = "";
    const keepExpanded = !!state.userPoint;
    setPaneExpanded(state, keepExpanded, "normal");
    syncPaneUrl(state);
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function openSetupPane(state) {
    if (!state) return;
    closeOwnerAddMenu(state);
    state.debugPaneView = "setup";
    state.accountPaneMode = "";
    state.activeShopId = "";
    state.activeShopView = "items";
    state.detailLoading = false;
    state.searchQuery = "";
    state.setupDraft = setupDraftFromProfile(state);
    state.setupAddressPickActive = false;
    state.setupAddressPickedPoint = null;
    state.panelNode.classList.remove("is-shop-view");
    state.panelNode.classList.add("is-login-view");
    if (!state.loginDraft.username) {
      state.loginDraft.username = loadSavedShopName();
    }
    state.loginDraft.flow = "";
    state.loginDraft.shopSetupStep = "details";
    state.loginDraft.contact = "";
    state.loginDraft.address = "";
    state.loginDraft.verificationCode = "";
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    expandSignInPortal(state);
    syncPaneUrl(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function closeSetupPane(state) {
    if (!state || state.debugPaneView !== "setup") return;
    state.debugPaneView = "";
    state.searchQuery = "";
    state.loginDraft.flow = "";
    state.loginDraft.shopSetupStep = "details";
    state.loginDraft.contact = "";
    state.loginDraft.address = "";
    state.loginDraft.verificationCode = "";
    state.loginDraft.password = "";
    state.loginDraft.resetMode = false;
    state.loginDraft.resetStep = "address";
    state.loginDraft.resetContact = "";
    state.loginDraft.resetCode = "";
    state.loginDraft.resetPassword = "";
    state.loginDraft.status = "";
    state.loginDraft.tone = "";
    state.loginDraft.submitting = false;
    state.setupAddressPickActive = false;
    state.setupAddressPickedPoint = null;
    syncSetupAddressPickerUi(state);
    syncUserMarkerAdjustable(state);
    state.panelNode.classList.remove("is-login-view");
    const keepExpanded = !!state.userPoint;
    setPaneExpanded(state, keepExpanded, "normal");
    syncPaneUrl(state);
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function openDebugLoginPane(state) {
    if (!state) return;
    closeOwnerAddMenu(state);
    state.debugPaneView = "login";
    state.activeShopId = "";
    state.activeShopView = "items";
    state.detailLoading = false;
    state.searchQuery = "";
    state.panelNode.classList.remove("is-shop-view");
    state.panelNode.classList.add("is-login-view");
    if (!state.loginDraft.username) {
      state.loginDraft.username = loadSavedShopName();
    }
    state.loginDraft.flow = "";
    state.loginDraft.shopSetupStep = "details";
    state.loginDraft.contact = "";
    state.loginDraft.address = "";
    state.loginDraft.verificationCode = "";
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    expandSignInPortal(state);
    syncPaneUrl(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function closeDebugLoginPane(state) {
    if (!state || state.debugPaneView !== "login") return;
    state.debugPaneView = "";
    state.searchQuery = "";
    state.loginDraft.flow = "";
    state.loginDraft.shopSetupStep = "details";
    state.loginDraft.contact = "";
    state.loginDraft.address = "";
    state.loginDraft.verificationCode = "";
    state.loginDraft.password = "";
    state.loginDraft.resetMode = false;
    state.loginDraft.resetStep = "address";
    state.loginDraft.resetContact = "";
    state.loginDraft.resetCode = "";
    state.loginDraft.resetPassword = "";
    state.loginDraft.status = "";
    state.loginDraft.tone = "";
    state.loginDraft.submitting = false;
    state.panelNode.classList.remove("is-login-view");
    const keepExpanded = !!state.userPoint;
    setPaneExpanded(state, keepExpanded, "normal");
    syncPaneUrl(state);
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function isShopSetupDraft(state) {
    return !!state && !!state.loginDraft && String(state.loginDraft.flow || "").trim() === "add-shop";
  }

  function openAddShopPane(state) {
    if (!state) return;
    const session = state.accountSession || loadAccountSession();
    const buyer = accountBuyerAccount(session);
    const profile = accountProfileSummary(state);
    const fallbackProfile = state.buyerProfile || loadBuyerProfile();
    closeOwnerAddMenu(state);
    state.debugPaneView = "login";
    state.accountPaneMode = "";
    state.activeShopId = "";
    state.activeShopView = "items";
    state.detailLoading = false;
    state.searchQuery = "";
    state.loginDraft.flow = "add-shop";
    state.loginDraft.shopSetupStep = "details";
    state.loginDraft.username = "";
    state.loginDraft.password = "";
    state.loginDraft.contact = String(
      profile.contact
      || buyer && buyer.contact
      || fallbackProfile && fallbackProfile.contact
      || ""
    ).trim();
    state.loginDraft.address = String(
      profile.address
      || buyerCheckoutAddress(state, fallbackProfile)
      || fallbackProfile && fallbackProfile.address
      || ""
    ).trim();
    state.loginDraft.verificationCode = "";
    state.loginDraft.resetMode = false;
    state.loginDraft.resetStep = "address";
    state.loginDraft.resetContact = "";
    state.loginDraft.resetCode = "";
    state.loginDraft.resetPassword = "";
    state.loginDraft.status = "";
    state.loginDraft.tone = "";
    state.loginDraft.submitting = false;
    state.panelNode.classList.remove("is-shop-view");
    state.panelNode.classList.add("is-login-view");
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    expandSignInPortal(state);
    syncPaneUrl(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function shopSetupErrorMessage(error, fallback) {
    const code = String(error || "").trim();
    if (code === "shop_id_required") return "Enter shop name.";
    if (code === "password_too_short") return "Use at least 6 characters.";
    if (code === "contact_required") return "Enter owner email.";
    if (code === "invalid_contact") return "Use a real email or phone number.";
    if (code === "verification_code_required") return "Enter code.";
    if (code === "invalid_verification_code") return "Wrong code.";
    if (code === "verification_rate_limited") return "Try again in a minute.";
    if (code === "auth_rate_limited") return "Too many tries. Wait a bit.";
    if (code === "registration_restricted") return "Shop creation is unavailable right now.";
    if (code === "email_delivery_failed") return "Email could not be sent.";
    if (code === "smtp_not_configured") return "Email is not configured.";
    if (code === "delivery_not_configured") return "Delivery is not configured.";
    if (code === "shop_exists") return "Shop already exists.";
    return String(fallback || "Could not add shop.");
  }

  function sendShopSetupVerification(state) {
    if (!state || !isShopSetupDraft(state) || state.loginDraft.submitting) return;
    const draft = state.loginDraft;
    const username = String(draft.username || "").trim().slice(0, 80);
    const shopId = slugify(username);
    const contact = String(draft.contact || "").trim().slice(0, 255);
    const address = String(draft.address || "").trim().slice(0, 240);
    const password = String(draft.password || "");
    if (!username || !shopId) {
      draft.tone = "error";
      draft.status = "Enter shop name.";
      renderShopList(state);
      return;
    }
    if (!contact) {
      draft.tone = "error";
      draft.status = "Enter owner email.";
      renderShopList(state);
      return;
    }
    const contactError = accountContactErrorMessage(contact);
    if (contactError) {
      draft.tone = "error";
      draft.status = contactError;
      renderShopList(state);
      return;
    }
    if (!address) {
      draft.tone = "error";
      draft.status = "Enter shop address.";
      renderShopList(state);
      return;
    }
    if (!password) {
      draft.tone = "error";
      draft.status = "Enter owner password.";
      renderShopList(state);
      return;
    }
    if (password.length < 6) {
      draft.tone = "error";
      draft.status = "Use at least 6 characters.";
      renderShopList(state);
      return;
    }
    draft.username = username;
    draft.contact = contact;
    draft.address = address;
    draft.verificationCode = "";
    draft.submitting = true;
    draft.tone = "";
    draft.status = "Checking shop...";
    renderShopList(state);
    shopExists(shopId)
      .then(function (exists) {
        if (exists) {
          return {
            ok: false,
            payload: { error: "shop_exists" }
          };
        }
        draft.status = "Sending code...";
        renderShopList(state);
        return requestBuyerContactVerification(contact);
      })
      .then(function (result) {
        draft.submitting = false;
        if (!result || !result.ok) {
          const error = String(result && result.payload && result.payload.error || "").trim();
          draft.tone = "error";
          draft.status = shopSetupErrorMessage(error, "Could not send code.");
          renderShopList(state);
          return;
        }
        const code = String(result.payload && (result.payload.verification_code || result.payload.reset_code) || "").trim();
        const delivery = result.payload && result.payload.delivery;
        if (code) draft.verificationCode = code;
        draft.shopSetupStep = "verify";
        draft.tone = code || delivery && delivery.sent ? "success" : "";
        draft.status = code ? "Code ready." : (delivery && delivery.sent ? "Check email." : "Enter code.");
        renderShopList(state);
        resetPaneScroll(state);
      })
      .catch(function () {
        draft.submitting = false;
        draft.tone = "error";
        draft.status = "Could not send code.";
        renderShopList(state);
      });
  }

  function completeShopSetupCreate(state) {
    if (!state || !isShopSetupDraft(state) || state.loginDraft.submitting) return;
    const draft = state.loginDraft;
    const username = String(draft.username || "").trim().slice(0, 80);
    const shopId = slugify(username);
    const contact = String(draft.contact || "").trim().slice(0, 255);
    const address = String(draft.address || "").trim().slice(0, 240);
    const password = String(draft.password || "");
    const verificationCode = String(draft.verificationCode || "").trim();
    if (!username || !shopId) {
      draft.tone = "error";
      draft.status = "Enter shop name.";
      renderShopList(state);
      return;
    }
    if (!contact) {
      draft.tone = "error";
      draft.status = "Enter owner email.";
      renderShopList(state);
      return;
    }
    if (!address) {
      draft.tone = "error";
      draft.status = "Enter shop address.";
      renderShopList(state);
      return;
    }
    if (!verificationCode) {
      draft.tone = "error";
      draft.status = "Enter code.";
      renderShopList(state);
      return;
    }
    if (!password || password.length < 6) {
      draft.tone = "error";
      draft.status = password ? "Use at least 6 characters." : "Enter owner password.";
      renderShopList(state);
      return;
    }
    draft.submitting = true;
    draft.tone = "";
    draft.status = "Creating shop...";
    renderShopList(state);
    createShopAccount(shopId, username, password, {
      contact: contact,
      verificationCode: verificationCode,
      address: address
    })
      .then(function (result) {
        if (!result || !result.ok) {
          const error = String(result && result.payload && result.payload.error || "").trim();
          draft.submitting = false;
          draft.tone = "error";
          draft.status = shopSetupErrorMessage(error, "Could not add shop.");
          renderShopList(state);
          return;
        }
        const shopRecord = result.payload && result.payload.shop;
        const mergedShop = mergeShopRecord(state, shopRecord || { shop_id: shopId, display_name: username }, username);
        state.accountSession = saveShopIdentity(String(mergedShop && mergedShop.display_name || username).trim(), shopId);
        setPreferredOwnerShop(state, shopId);
        refreshBuyerAccountSession(state, { force: true, silent: true }).catch(function () {});
        state.ownerPanel.tab = "";
        state.ownerPanel.section = "";
        state.ownerPanel.itemId = "";
        state.ownerPanel.message = "";
        state.ownerPanel.tone = "";
        state.ownerPanel.orderDraftOpen = false;
        state.debugPaneView = "";
        draft.submitting = false;
        draft.flow = "";
        draft.shopSetupStep = "details";
        draft.password = "";
        draft.verificationCode = "";
        draft.tone = "success";
        draft.status = "Shop added.";
        state.panelNode.classList.remove("is-login-view");
        openShopInPane(state, shopId);
      })
      .catch(function () {
        draft.submitting = false;
        draft.tone = "error";
        draft.status = "Could not add shop.";
        renderShopList(state);
      });
  }

  function editShopSetupDetails(state) {
    if (!state || !isShopSetupDraft(state)) return;
    state.loginDraft.shopSetupStep = "details";
    state.loginDraft.verificationCode = "";
    state.loginDraft.status = "";
    state.loginDraft.tone = "";
    renderShopList(state);
    resetPaneScroll(state);
  }

  function openSavedOwnerShop(state, options) {
    if (!state) return;
    closeOwnerAddMenu(state);
    const shopId = String(options && options.shopId || state.ownerShopId || preferredOwnerShopId(state.accountSession, state.ownerShopId) || "").trim();
    if (!shopId) {
      if (state.accountSession) {
        openAccountPane(state);
      } else {
        openDebugLoginPane(state);
      }
      return;
    }
    setPreferredOwnerShop(state, shopId);
    const savedName = String(preferredOwnerShopName(state.accountSession, shopId) || loadSavedShopName() || "").trim();
    if (state.shopById[shopId]) {
      openShopInPane(state, shopId, options);
      return;
    }
    if (state.loginDraft) {
      state.loginDraft.status = "Opening saved shop...";
      state.loginDraft.tone = "";
    }
    renderShopList(state);
    window.fetch("/api/shops/" + encodeURIComponent(shopId), {
      cache: "no-store"
    })
      .then(function (response) {
        if (!response.ok) throw new Error("saved_shop_missing");
        return response.json();
      })
      .then(function (record) {
        mergeShopRecord(state, record || {
          shop_id: shopId,
          display_name: savedName || shopId
        }, savedName || shopId);
        openShopInPane(state, shopId, options);
      })
      .catch(function () {
        state.ownerShopId = "";
        state.loginDraft.username = "";
        state.loginDraft.password = "";
        state.loginDraft.resetMode = false;
        state.loginDraft.resetStep = "address";
        state.loginDraft.resetContact = "";
        state.loginDraft.resetCode = "";
        state.loginDraft.resetPassword = "";
        state.loginDraft.status = "Could not open saved shop. Try again.";
        state.loginDraft.tone = "error";
        syncBackButton(state);
        openAccountPane(state, { accountPaneMode: "shops" });
      });
  }

  function isShopAuthPane(state) {
    return !!state && (state.debugPaneView === "login" || state.debugPaneView === "setup");
  }

  function submitDebugLoginPane(state) {
    if (!isShopAuthPane(state)) return;
    if (state.loginDraft.submitting) return;
    if (isShopSetupDraft(state)) {
      if (String(state.loginDraft.shopSetupStep || "").trim() === "verify") {
        completeShopSetupCreate(state);
      } else {
        sendShopSetupVerification(state);
      }
      return;
    }

    const username = String(state.loginDraft.username || "").trim();
    const password = String(state.loginDraft.password || "");
    const shopId = slugify(username);
    if (!username || !shopId) {
      state.loginDraft.tone = "error";
      state.loginDraft.status = "Enter shop name.";
      renderShopList(state);
      return;
    }
    if (!password) {
      state.loginDraft.tone = "error";
      state.loginDraft.status = "Enter a password.";
      renderShopList(state);
      return;
    }
    if (password.length < 6) {
      state.loginDraft.tone = "error";
      state.loginDraft.status = "Use at least 6 characters.";
      renderShopList(state);
      return;
    }

    state.loginDraft.submitting = true;
    state.loginDraft.tone = "";
    state.loginDraft.status = "Checking...";
    renderShopList(state);

    attemptLogin(shopId, password)
      .then(function (loginResult) {
        if (loginResult.ok) {
          return {
            ok: true,
            payload: loginResult.payload
          };
        }
        if (loginResult.status === 401) {
          return shopExists(shopId).then(function (exists) {
            if (exists) {
              return {
                ok: false,
                message: "Wrong password."
              };
            }
            state.loginDraft.status = "Creating shop...";
            state.loginDraft.tone = "";
            renderShopList(state);
            return createShopAccount(shopId, username, password).then(function (createResult) {
              if (createResult.ok) {
                return {
                  ok: true,
                  created: true,
                  payload: createResult.payload
                };
              }
              const createError = String(createResult && createResult.payload && createResult.payload.error || "").trim();
              let createMessage = "Could not create this shop.";
              if (createError === "password_too_short") {
                createMessage = "Use at least 6 characters.";
              } else if (createError === "registration_restricted") {
                createMessage = "Shop creation is unavailable right now.";
              } else if (createError === "auth_rate_limited") {
                createMessage = "Too many tries. Wait a bit.";
              } else if (createError === "contact_required" || createError === "verification_code_required" || createError === "invalid_verification_code") {
                createMessage = "Use Add shop from Account.";
              }
              return {
                ok: false,
                message: createMessage
              };
            });
          });
        }
        if (loginResult.status === 429) {
          return {
            ok: false,
            message: "Too many tries. Wait a bit."
          };
        }
        return {
          ok: false,
          message: "Could not open this shop."
        };
      })
      .then(function (result) {
        if (!result || !result.ok) {
          state.loginDraft.submitting = false;
          state.loginDraft.tone = "error";
          state.loginDraft.status = String(result && result.message || "Could not open this shop.");
          renderShopList(state);
          return;
        }

        const shopRecord = result.payload && result.payload.shop;
        const mergedShop = mergeShopRecord(state, shopRecord || { shop_id: shopId, display_name: username }, username);
        state.accountSession = saveShopIdentity(String(mergedShop && mergedShop.display_name || username).trim(), shopId);
        setPreferredOwnerShop(state, shopId);
        state.ownerPanel.tab = "";
        state.ownerPanel.section = "";
        state.ownerPanel.itemId = "";
        state.ownerPanel.message = "";
        state.ownerPanel.tone = "";
        state.ownerPanel.orderDraftOpen = false;
        state.debugPaneView = "";
        state.loginDraft.submitting = false;
        state.loginDraft.password = "";
        state.loginDraft.resetMode = false;
        state.loginDraft.resetStep = "address";
        state.loginDraft.resetContact = "";
        state.loginDraft.resetCode = "";
        state.loginDraft.resetPassword = "";
        state.loginDraft.tone = "success";
        state.loginDraft.status = result.created ? "Created." : "Opened.";
        state.panelNode.classList.remove("is-login-view");
        openShopInPane(state, shopId);
      })
      .catch(function () {
        state.loginDraft.submitting = false;
        state.loginDraft.tone = "error";
        state.loginDraft.status = "Could not open this shop.";
        renderShopList(state);
      });
  }

  function submitResetShopPassword(state) {
    if (!isShopAuthPane(state)) return;
    if (state.loginDraft.submitting) return;

    const username = String(state.loginDraft.username || "").trim();
    const shopId = slugify(username);
    const resetCode = String(state.loginDraft.resetCode || "").trim();
    const password = String(state.loginDraft.resetPassword || "");
    if (!username || !shopId) {
      state.loginDraft.tone = "error";
      state.loginDraft.status = "Enter shop name.";
      renderShopList(state);
      return;
    }
    if (!resetCode) {
      state.loginDraft.tone = "error";
      state.loginDraft.status = "Enter reset code.";
      renderShopList(state);
      return;
    }
    if (!password) {
      state.loginDraft.tone = "error";
      state.loginDraft.status = "Enter new password.";
      renderShopList(state);
      return;
    }
    if (password.length < 6) {
      state.loginDraft.tone = "error";
      state.loginDraft.status = "Use at least 6 characters.";
      renderShopList(state);
      return;
    }

    state.loginDraft.submitting = true;
    state.loginDraft.tone = "";
    state.loginDraft.status = "Setting password...";
    renderShopList(state);

    resetShopPassword(shopId, resetCode, password)
      .then(function (result) {
        state.loginDraft.submitting = false;
        if (!result || !result.ok) {
          const error = String(result && result.payload && result.payload.error || "").trim();
          let message = "Could not reset password.";
          if (error === "invalid_reset_code") {
            message = "Wrong reset code.";
          } else if (error === "reset_not_configured") {
            message = "Reset is not ready yet.";
          } else if (error === "shop_not_found") {
            message = "Shop not found.";
          } else if (error === "password_too_short") {
            message = "Use at least 6 characters.";
          }
          state.loginDraft.tone = "error";
          state.loginDraft.status = message;
          renderShopList(state);
          return;
        }
        state.loginDraft.resetMode = false;
        state.loginDraft.resetStep = "address";
        state.loginDraft.resetContact = "";
        state.loginDraft.resetCode = "";
        state.loginDraft.resetPassword = "";
        state.loginDraft.password = "";
        state.loginDraft.tone = "success";
        state.loginDraft.status = "Password changed. Sign in now.";
        renderShopList(state);
      })
      .catch(function () {
        state.loginDraft.submitting = false;
        state.loginDraft.tone = "error";
        state.loginDraft.status = "Could not reset password.";
        renderShopList(state);
      });
  }

  function submitRequestShopPasswordReset(state) {
    if (!isShopAuthPane(state)) return;
    if (state.loginDraft.submitting) return;

    const username = String(state.loginDraft.username || "").trim();
    const shopId = slugify(username);
    const contact = String(state.loginDraft.resetContact || "").trim();
    if (!username || !shopId) {
      state.loginDraft.tone = "error";
      state.loginDraft.status = "Enter shop name.";
      renderShopList(state);
      return;
    }
    if (!contact) {
      state.loginDraft.tone = "error";
      state.loginDraft.status = "Enter shop contact.";
      renderShopList(state);
      return;
    }

    state.loginDraft.submitting = true;
    state.loginDraft.tone = "";
    state.loginDraft.status = "Checking...";
    renderShopList(state);

    requestShopPasswordReset(shopId, contact)
      .then(function (result) {
        state.loginDraft.submitting = false;
        if (!result || !result.ok) {
          const error = String(result && result.payload && result.payload.error || "").trim();
          let message = "Could not get code.";
          if (error === "invalid_contact") {
            message = "Email or number not linked.";
          } else if (error === "reset_contact_missing") {
            message = "No recovery contact linked.";
          } else if (error === "reset_rate_limited") {
            message = "Try again in a minute.";
          } else if (error === "auth_rate_limited") {
            message = "Too many tries. Wait a bit.";
          } else if (error === "shop_not_found") {
            message = "Shop not found.";
          } else if (error === "email_delivery_failed") {
            message = "Email could not be sent.";
          } else if (error === "smtp_not_configured") {
            message = "Email is not configured.";
          } else if (error === "delivery_not_configured") {
            message = "Delivery is not configured.";
          }
          state.loginDraft.tone = "error";
          state.loginDraft.status = message;
          renderShopList(state);
          return;
        }
        const code = String(result.payload && result.payload.reset_code || "").trim();
        const delivery = result.payload && result.payload.delivery;
        if (code) state.loginDraft.resetCode = code;
        state.loginDraft.resetMode = true;
        state.loginDraft.resetStep = "code";
        state.loginDraft.tone = "success";
        state.loginDraft.status = code ? "Code ready." : (delivery && delivery.sent ? "Check email." : "Enter code.");
        renderShopList(state);
      })
      .catch(function () {
        state.loginDraft.submitting = false;
        state.loginDraft.tone = "error";
        state.loginDraft.status = "Could not get code.";
        renderShopList(state);
      });
  }

  function continueBuyerCreateAccount(state) {
    if (!state || state.debugPaneView !== "account") return;
    const draft = state.buyerAuthDraft || {};
    if (draft.submitting) return;
    const contact = String(draft.contact || "").trim();
    const contactError = accountContactErrorMessage(contact);
    if (contactError) {
      draft.tone = "error";
      draft.status = contactError;
      renderShopList(state);
      return;
    }
    draft.submitting = true;
    draft.createMode = true;
    draft.createStep = "contact";
    draft.password = "";
    draft.verificationCode = "";
    draft.tone = "";
    draft.status = "Sending code...";
    expandSignInPortal(state);
    renderShopList(state);
    requestBuyerContactVerification(contact, "buyer_signup")
      .then(function (result) {
        draft.submitting = false;
        if (!result || !result.ok) {
          const error = String(result && result.payload && result.payload.error || "").trim();
          let message = "Could not send code.";
          if (error === "account_exists") {
            message = "Account exists. Use Sign in.";
          } else if (error === "invalid_contact") {
            message = "Use a real email or phone number.";
          } else if (error === "verification_rate_limited") {
            message = "Try again in a minute.";
          } else if (error === "auth_rate_limited") {
            message = "Too many tries. Wait a bit.";
          } else if (error === "email_delivery_failed") {
            message = "Email could not be sent.";
          } else if (error === "smtp_not_configured") {
            message = "Email is not configured.";
          } else if (error === "delivery_not_configured") {
            message = "Delivery is not configured.";
          }
          draft.tone = "error";
          draft.status = message;
          renderShopList(state);
          return;
        }
        const code = String(result.payload && (result.payload.verification_code || result.payload.reset_code) || "").trim();
        const delivery = result.payload && result.payload.delivery;
        if (code) draft.verificationCode = code;
        draft.createStep = "verify";
        draft.tone = code || delivery && delivery.sent ? "success" : "";
        draft.status = code ? "Code ready." : (delivery && delivery.sent ? "Check email." : "Enter code.");
        renderShopList(state);
        resetPaneScroll(state);
      })
      .catch(function () {
        draft.submitting = false;
        draft.tone = "error";
        draft.status = "Could not send code.";
        renderShopList(state);
      });
  }

  function continueBuyerCreatePassword(state) {
    if (!state || state.debugPaneView !== "account") return;
    const draft = state.buyerAuthDraft || {};
    if (draft.submitting) return;
    const contact = String(draft.contact || "").trim();
    const contactError = accountContactErrorMessage(contact);
    if (contactError) {
      draft.tone = "error";
      draft.status = contactError;
      renderShopList(state);
      return;
    }
    const verificationCode = String(draft.verificationCode || "").trim();
    if (!verificationCode) {
      draft.tone = "error";
      draft.status = "Enter code.";
      renderShopList(state);
      return;
    }
    draft.createMode = true;
    draft.createStep = "password";
    draft.password = "";
    draft.tone = "";
    draft.status = "";
    expandSignInPortal(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function submitBuyerAccount(state, mode) {
    if (!state || state.debugPaneView !== "account") return;
    const draft = state.buyerAuthDraft || {};
    if (draft.submitting) return;
    const actionMode = mode === "login" ? "login" : "signup";
    const contact = String(draft.contact || "").trim();
    const name = actionMode === "signup" ? contact : String(draft.name || "").trim();
    const password = String(draft.password || "");
    const contactError = accountContactErrorMessage(contact);
    if (contactError) {
      draft.tone = "error";
      draft.status = contactError;
      renderShopList(state);
      return;
    }
    if (actionMode === "signup") {
      const createStep = String(draft.createStep || "").trim();
      if (createStep === "verify") {
        continueBuyerCreatePassword(state);
        return;
      }
      if (createStep !== "password") {
        continueBuyerCreateAccount(state);
        return;
      }
    }
    const verificationCode = actionMode === "signup" ? String(draft.verificationCode || "").trim() : "";
    if (actionMode === "signup" && !verificationCode) {
      draft.tone = "error";
      draft.status = "Enter code.";
      renderShopList(state);
      return;
    }
    if (!password) {
      draft.tone = "error";
      draft.status = "Enter password.";
      renderShopList(state);
      return;
    }
    if (password.length < 6) {
      draft.tone = "error";
      draft.status = "Use at least 6 characters.";
      renderShopList(state);
      return;
    }
    const freshBuyerKey = generateBuyerKey();
    draft.submitting = true;
    draft.tone = "";
    draft.status = actionMode === "login" ? "Opening account..." : "Saving account...";
    renderShopList(state);
    submitBuyerAccountRequest(actionMode, {
      display_name: name,
      contact: contact,
      password: password,
      verification_code: verificationCode,
      buyer_key: freshBuyerKey
    }).then(function (result) {
      if (!result || !result.ok) {
        const error = String(result && result.payload && result.payload.error || "").trim();
        let message = actionMode === "login" ? "Could not open account." : "Could not save account.";
        if (error === "account_exists") {
          message = "Account exists. Use Sign in.";
        } else if (error === "invalid_login") {
          message = "Wrong contact or password.";
        } else if (error === "invalid_contact") {
          message = "Use a real email or phone number.";
        } else if (error === "verification_code_required") {
          message = "Enter code.";
        } else if (error === "invalid_verification_code") {
          message = "Wrong code.";
        } else if (error === "password_too_short") {
          message = "Use at least 6 characters.";
        } else if (error === "contact_required") {
          message = "Enter contact.";
        } else if (error === "auth_rate_limited") {
          message = "Too many tries. Wait a bit.";
        }
        throw new Error(message);
      }
      const accountPayload = result.payload && result.payload.account;
      const account = accountPayload && typeof accountPayload === "object"
        ? Object.assign({}, accountPayload, {
          ownerShops: accountPayload.ownerShops || result.payload.owner_shops || result.payload.ownerShops || []
        })
        : accountPayload;
      const checkoutShopId = String(state.pendingCheckoutShopId || "").trim();
      return replaceSignedInBuyerAccount(state, account, {
        preserveCartShopId: checkoutShopId
      }).then(function (session) {
        const refreshedAccount = accountBuyerAccount(session) || normalizeBuyerAccount(account);
        state.accountPaneMode = "";
        state.buyerAuthDraft = {
          name: String(refreshedAccount && refreshedAccount.displayName || name || "").trim(),
          contact: String(refreshedAccount && refreshedAccount.contact || contact || "").trim(),
          password: "",
          createMode: false,
          createStep: "contact",
          resetMode: false,
          resetStep: "address",
          resetCode: "",
          resetPassword: "",
          verificationCode: "",
          status: actionMode === "login" ? "Opened." : "Saved.",
          tone: "success",
          submitting: false
        };
        if (returnToPendingCheckout(state)) {
          syncActionButton(state);
          return;
        }
        renderShopList(state);
        syncActionButton(state);
      });
    }).catch(function (error) {
      draft.submitting = false;
      draft.tone = "error";
      draft.status = String(error && error.message || "Could not save account.");
      renderShopList(state);
    });
  }

  function submitBuyerPasswordResetRequest(state) {
    if (!state || state.debugPaneView !== "account") return;
    const draft = state.buyerAuthDraft || {};
    if (draft.submitting) return;
    const contact = String(draft.contact || "").trim();
    if (!contact) {
      draft.tone = "error";
      draft.status = "Enter email or number.";
      renderShopList(state);
      return;
    }
    const contactError = accountContactErrorMessage(contact);
    if (contactError) {
      draft.tone = "error";
      draft.status = contactError;
      renderShopList(state);
      return;
    }
    draft.submitting = true;
    draft.tone = "";
    draft.status = "Checking...";
    renderShopList(state);
    requestBuyerPasswordReset(contact).then(function (result) {
      draft.submitting = false;
      if (!result || !result.ok) {
        const error = String(result && result.payload && result.payload.error || "").trim();
        let message = "Could not get code.";
        if (error === "account_not_found") {
          message = "No buyer account for this contact.";
        } else if (error === "invalid_contact") {
          message = "Use a real email or phone number.";
        } else if (error === "reset_rate_limited") {
          message = "Try again in a minute.";
        } else if (error === "auth_rate_limited") {
          message = "Too many tries. Wait a bit.";
        } else if (error === "contact_required") {
          message = "Enter email or number.";
        } else if (error === "email_delivery_failed") {
          message = "Email could not be sent.";
        } else if (error === "smtp_not_configured") {
          message = "Email is not configured.";
        } else if (error === "delivery_not_configured") {
          message = "Delivery is not configured.";
        }
        throw new Error(message);
      }
      const code = String(result.payload && result.payload.reset_code || "").trim();
      const delivery = result.payload && result.payload.delivery;
      if (code) draft.resetCode = code;
      draft.resetMode = true;
      draft.resetStep = "code";
      draft.tone = "success";
      draft.status = code ? "Code ready." : (delivery && delivery.sent ? "Check email." : "Enter code.");
      renderShopList(state);
    }).catch(function (error) {
      draft.submitting = false;
      draft.tone = "error";
      draft.status = String(error && error.message || "Could not get code.");
      renderShopList(state);
    });
  }

  function submitBuyerPasswordReset(state) {
    if (!state || state.debugPaneView !== "account") return;
    const draft = state.buyerAuthDraft || {};
    if (draft.submitting) return;
    const contact = String(draft.contact || "").trim();
    const resetCode = String(draft.resetCode || "").trim();
    const password = String(draft.resetPassword || "");
    if (!contact) {
      draft.tone = "error";
      draft.status = "Enter email or number.";
      renderShopList(state);
      return;
    }
    const contactError = accountContactErrorMessage(contact);
    if (contactError) {
      draft.tone = "error";
      draft.status = contactError;
      renderShopList(state);
      return;
    }
    if (!resetCode) {
      draft.tone = "error";
      draft.status = "Enter code.";
      renderShopList(state);
      return;
    }
    if (!password) {
      draft.tone = "error";
      draft.status = "Enter new password.";
      renderShopList(state);
      return;
    }
    if (password.length < 6) {
      draft.tone = "error";
      draft.status = "Use at least 6 characters.";
      renderShopList(state);
      return;
    }
    const freshBuyerKey = generateBuyerKey();
    draft.submitting = true;
    draft.tone = "";
    draft.status = "Changing password...";
    renderShopList(state);
    resetBuyerPassword(contact, resetCode, password, freshBuyerKey).then(function (result) {
      if (!result || !result.ok) {
        const error = String(result && result.payload && result.payload.error || "").trim();
        let message = "Could not change password.";
        if (error === "invalid_reset_code") {
          message = "Wrong code.";
        } else if (error === "invalid_contact") {
          message = "Use a real email or phone number.";
        } else if (error === "password_too_short") {
          message = "Use at least 6 characters.";
        } else if (error === "contact_required") {
          message = "Enter email or number.";
        } else if (error === "auth_rate_limited") {
          message = "Too many tries. Wait a bit.";
        }
        throw new Error(message);
      }
      const account = result.payload && result.payload.account;
      return replaceSignedInBuyerAccount(state, account).then(function (session) {
        const refreshedAccount = accountBuyerAccount(session) || normalizeBuyerAccount(account);
        state.accountPaneMode = "";
        state.buyerAuthDraft = {
          name: String(refreshedAccount && refreshedAccount.displayName || "").trim(),
          contact: String(refreshedAccount && refreshedAccount.contact || contact || "").trim(),
          password: "",
          createMode: false,
          createStep: "contact",
          resetMode: false,
          resetStep: "address",
          resetCode: "",
          resetPassword: "",
          verificationCode: "",
          status: "Password changed.",
          tone: "success",
          submitting: false
        };
        renderShopList(state);
        syncActionButton(state);
      });
    }).catch(function (error) {
      draft.submitting = false;
      draft.tone = "error";
      draft.status = String(error && error.message || "Could not change password.");
      renderShopList(state);
    });
  }

  function setPaneDragOffset(state, offset) {
    if (!state || !state.panelNode) return;
    state.panelNode.style.setProperty("--pane-drag-offset", Math.round(offset || 0) + "px");
    scheduleMapRelayout(state);
  }

  function clearPaneDragOffset(state) {
    if (!state || !state.panelNode) return;
    state.panelNode.style.removeProperty("--pane-drag-offset");
    state.panelNode.classList.remove("is-dragging");
    stabilizeMapViewport(state, 40);
  }

  function installPaneToggleDrag(state) {
    if (!state || !state.toggleButton || !state.panelNode) return;
    let drag = null;

    function stopDrag(event) {
      if (!drag) return;
      const moved = drag.moved;
      const deltaY = drag.lastY - drag.startY;
      const button = drag.button;
      drag = null;
      clearPaneDragOffset(state);
      if (button && event && typeof button.releasePointerCapture === "function") {
        try {
          button.releasePointerCapture(event.pointerId);
        } catch (error) {}
      }
      if (!moved || Math.abs(deltaY) < 28) return;
      state.suppressToggleClickUntil = Date.now() + 320;
      if (deltaY < 0) {
        setPaneExpanded(state, true, "full");
        return;
      }
      setPaneExpanded(state, false, "normal");
    }

    state.toggleButton.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      drag = {
        startY: event.clientY,
        lastY: event.clientY,
        moved: false,
        button: state.toggleButton
      };
      state.panelNode.classList.add("is-dragging");
      setPaneDragOffset(state, 0);
      if (typeof state.toggleButton.setPointerCapture === "function") {
        try {
          state.toggleButton.setPointerCapture(event.pointerId);
        } catch (error) {}
      }
    });

    state.toggleButton.addEventListener("pointermove", function (event) {
      if (!drag) return;
      const deltaY = event.clientY - drag.startY;
      if (Math.abs(deltaY) > 4) {
        drag.moved = true;
      }
      drag.lastY = event.clientY;
      const limit = state.isExpanded ? 84 : 64;
      const offset = Math.max(-limit, Math.min(limit, deltaY));
      setPaneDragOffset(state, offset);
    });

    state.toggleButton.addEventListener("pointerup", stopDrag);
    state.toggleButton.addEventListener("pointercancel", stopDrag);
  }

  function openShopInPane(state, shopId, options) {
    if (!state || !shopId) return;
    shopId = slugify(shopId).slice(0, 63);
    if (!shopId) return;
    if (!state.shopById || !state.shopById[shopId]) {
      if (state.cartByShop && state.cartByShop[shopId]) {
        delete state.cartByShop[shopId];
      }
      state.activeShopId = "";
      state.activeShopView = "items";
      state.detailLoading = false;
      state.panelNode.classList.remove("is-shop-view");
      syncPaneUrl(state);
      updateSearchField(state);
      syncActionButton(state);
      syncBackButton(state);
      renderShopList(state);
      resetPaneScroll(state);
      return;
    }
    const ownerTab = String(options && options.ownerTab || "").trim();
    let ownerSection = String(options && options.ownerSection || "").trim();
    let shopView = String(options && options.shopView || "").trim();
    if (ownerTab === "settings") {
      ownerSection = normalizeOwnerSettingsSection(ownerSection);
    } else if (ownerTab === "history") {
      ownerSection = normalizeOwnerHistorySection(ownerSection);
    } else {
      ownerSection = "";
    }
    if (shopView !== "cart") {
      shopView = "items";
    }
    if (state.accountSession && accountOwnerShops(state.accountSession).some(function (shop) {
      return String(shop && shop.shopId || "").trim() === String(shopId || "").trim();
    })) {
      setPreferredOwnerShop(state, shopId);
    }
    const previewDetail = state.shopDetails[shopId] || shopDetailFromPreview(state.shopById[shopId]);
    state.debugPaneView = "";
    state.activeShopId = shopId;
    state.activeShopView = ownerTab ? "items" : shopView;
    setSelectedPaymentMode(state, shopId, "on_receive");
    state.ownerPanel.tab = ownerTab;
    state.ownerPanel.section = ownerSection;
    state.ownerPanel.itemId = "";
    state.ownerPanel.message = "";
    state.ownerPanel.tone = "";
    state.ownerPanel.orderDraftOpen = ownerTab === "history" && ownerSection === "orders" && !!(options && options.ownerOrderDraftOpen);
    state.searchQuery = "";
    state.detailLoading = !previewDetail;
    setOrderConfirmation(state, shopId, null);
    if (previewDetail && !state.shopDetails[shopId]) {
      state.shopDetails[shopId] = previewDetail;
    }
    setPaneExpanded(state, true, "full");
    state.panelNode.classList.add("is-shop-view");
    state.panelNode.classList.remove("is-login-view");
    syncPaneUrl(state);
    focusShopOnMap(state, state.shopById[shopId]);
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    renderShopList(state);
    resetPaneScroll(state);
    stabilizeMapViewport(state, 0);
    stabilizeMapViewport(state, 180);

    if (previewDetail) {
      state.detailLoading = false;
      renderShopList(state);
      resetPaneScroll(state);
      if (ownerTab === "history" && ownerSection === "items") {
        refreshItemLibrary(state, { force: false });
      }
      window.setTimeout(function () {
        focusShopOnMap(state, state.shopById[shopId]);
        stabilizeMapViewport(state, 0);
      }, 240);
    }

    refreshShopConsole(state, shopId, {
      preserveScroll: !!previewDetail,
      focusMap: !previewDetail
    })
      .catch(function () {
        if (previewDetail) return;
        state.shopDetails[shopId] = {
          name: String(state.shopById[shopId] && (state.shopById[shopId].display_name || state.shopById[shopId].shop_id) || "").trim(),
          type: "Store",
          note: "",
          contact: "",
          location: String(state.shopById[shopId] && state.shopById[shopId].location_label || "").trim(),
          hours: "",
          payments: [],
          items: []
        };
      })
      .finally(function () {
        if (state.activeShopId !== shopId) return;
        state.detailLoading = false;
        if (!previewDetail) {
          focusShopOnMap(state, state.shopById[shopId]);
        }
        updateSearchField(state);
        syncActionButton(state);
        syncBackButton(state);
        renderShopList(state);
        resetPaneScroll(state);
        stabilizeMapViewport(state, 0);
        stabilizeMapViewport(state, 180);
        if (ownerTab === "history" && ownerSection === "items") {
          refreshItemLibrary(state, { force: false });
        }
      });
  }

  function closeShopInPane(state) {
    if (!state) return;
    const closingShopId = state.activeShopId;
    state.activeShopId = "";
    state.activeShopView = "items";
    state.ownerPanel.tab = "";
    state.ownerPanel.section = "";
    state.ownerPanel.itemId = "";
    state.ownerPanel.message = "";
    state.ownerPanel.tone = "";
    state.ownerPanel.addMenuOpen = false;
    state.ownerPanel.orderDraftOpen = false;
    state.searchQuery = "";
    state.detailLoading = false;
    setOrderConfirmation(state, closingShopId, null);
    state.panelNode.classList.remove("is-shop-view");
    const keepExpanded = !!state.userPoint;
    setPaneExpanded(state, keepExpanded, "normal");
    syncPaneUrl(state);
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function addToCart(state, shopId, itemId, delta) {
    if (!state || !shopId || !itemId || !delta) return;
    const cart = getShopCart(state, shopId);
    const next = Math.max(0, Number(cart[itemId] || 0) + delta);
    if (next > 0) {
      cart[itemId] = next;
    } else {
      delete cart[itemId];
    }
    syncActionButton(state);
    renderShopList(state);
  }

  function focusCart(state) {
    if (!state || !state.activeShopId) return;
    setSelectedPaymentMode(state, state.activeShopId, "on_receive");
    state.activeShopView = "cart";
    setOrderConfirmation(state, state.activeShopId, null);
    state.searchQuery = "";
    syncPaneUrl(state);
    updateSearchField(state);
    syncActionButton(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function focusItems(state) {
    if (!state || !state.activeShopId) return;
    setSelectedPaymentMode(state, state.activeShopId, "on_receive");
    state.activeShopView = "items";
    if (isOwnerViewingShop(state)) {
      state.ownerPanel.tab = "";
      state.ownerPanel.section = "";
    }
    setOrderConfirmation(state, state.activeShopId, null);
    state.searchQuery = "";
    syncPaneUrl(state);
    updateSearchField(state);
    syncActionButton(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function installReliableBaseLayer(map, theme) {
    if (!map || !window.L) return null;
    const providers = [
      {
        layers: [
          {
            url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            options: {
              maxZoom: 19,
              attribution: "&copy; OpenStreetMap contributors",
              className: "hashop-map-standard-tile"
            }
          }
        ]
      },
      {
        layers: [
          {
            url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
            options: {
              maxZoom: 20,
              subdomains: "abcd",
              attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
              className: "hashop-map-readable-tile"
            }
          }
        ]
      },
      {
        layers: [
          {
            url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
            options: {
              maxZoom: 20,
              attribution: "&copy; OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team",
              className: "hashop-map-hot-tile"
            }
          }
        ]
      }
    ];

    let activeIndex = -1;
    let activeLayers = [];
    let loadedAnyTile = false;
    let fallbackTimer = null;

    function clearFallbackTimer() {
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    }

    function attach(index) {
      const provider = providers[index];
      if (!provider) return;

      clearFallbackTimer();
      loadedAnyTile = false;

      activeLayers.forEach(function (layer) {
        if (layer && map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      });
      activeLayers = [];
      activeIndex = index;

      provider.layers.forEach(function (config) {
        const layer = window.L.tileLayer(config.url, config.options);
        layer.on("tileload", function () {
          loadedAnyTile = true;
          clearFallbackTimer();
        });
        layer.on("tileerror", function () {
          if (!loadedAnyTile && activeIndex < providers.length - 1) {
            attach(activeIndex + 1);
          }
        });
        layer.addTo(map);
        activeLayers.push(layer);
      });

      fallbackTimer = window.setTimeout(function () {
        if (!loadedAnyTile && activeIndex < providers.length - 1) {
          attach(activeIndex + 1);
        }
      }, 4500);
    }

    attach(0);
    return activeLayers;
  }

  function googlePoint(point) {
    if (!Array.isArray(point) || !isFinite(point[0]) || !isFinite(point[1])) return null;
    return { lat: Number(point[0]), lng: Number(point[1]) };
  }

  function fitGoogleArea(state, points, zoom) {
    if (!state || !state.map || !window.google || !window.google.maps) return;
    const cleanPoints = (Array.isArray(points) ? points : []).map(googlePoint).filter(Boolean);
    if (!cleanPoints.length) return;
    if (cleanPoints.length === 1) {
      state.map.setCenter(cleanPoints[0]);
      state.map.setZoom(Math.max(10, Math.min(18, Number(zoom || 15))));
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    cleanPoints.forEach(function (point) {
      bounds.extend(point);
    });
    state.map.fitBounds(bounds, googleMapPadding(state));
  }

  function updateGoogleMapView(state) {
    if (!state || !state.map || !window.google || !window.google.maps) return;
    const activeShop = state.activeShopId ? state.shopById[state.activeShopId] : null;
    if (activeShop && activeShop.has_location && isFinite(activeShop.lat) && isFinite(activeShop.lng)) {
      fitGoogleArea(state, [[activeShop.lat, activeShop.lng]], 17);
      return;
    }
    if (state.userPoint) {
      fitGoogleArea(state, [state.userPoint], 15);
      return;
    }
    const discoveryPoints = localDiscoveryPoints(state.shopPoints);
    if (discoveryPoints.length) {
      fitGoogleArea(state, discoveryPoints, 14);
      return;
    }
    state.map.setCenter({ lat: DEFAULT_DISCOVERY_CENTER[0], lng: DEFAULT_DISCOVERY_CENTER[1] });
    state.map.setZoom(DEFAULT_DISCOVERY_ZOOM);
  }

  function loadGoogleMapsApi(key) {
    const safeKey = String(key || "").trim();
    if (!safeKey) return Promise.reject(new Error("google_maps_key_missing"));
    if (window.google && window.google.maps) return Promise.resolve(window.google.maps);
    if (window.__HASHOP_GOOGLE_MAPS_PROMISE__) return window.__HASHOP_GOOGLE_MAPS_PROMISE__;
    window.__HASHOP_GOOGLE_MAPS_PROMISE__ = new Promise(function (resolve, reject) {
      const callbackName = "__hashopGoogleMapsReady";
      window[callbackName] = function () {
        resolve(window.google && window.google.maps);
      };
      const script = document.createElement("script");
      script.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(safeKey) + "&callback=" + callbackName;
      script.async = true;
      script.defer = true;
      script.onerror = function () {
        reject(new Error("google_maps_load_failed"));
      };
      document.head.appendChild(script);
    });
    return window.__HASHOP_GOOGLE_MAPS_PROMISE__;
  }

  function renderGoogleMap(state) {
    if (!state || !state.mapNode || !window.google || !window.google.maps) return false;
    state.mapNode.classList.remove("is-map-loading");
    state.mapNode.classList.add("is-google-map");
    state.mapProvider = "google";
    state.map = new window.google.maps.Map(state.mapNode, {
      center: { lat: DEFAULT_DISCOVERY_CENTER[0], lng: DEFAULT_DISCOVERY_CENTER[1] },
      zoom: DEFAULT_DISCOVERY_ZOOM,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: false,
      clickableIcons: true,
      gestureHandling: "greedy",
      heading: 0,
      tilt: 0,
      headingInteractionEnabled: true,
      tiltInteractionEnabled: false,
      backgroundColor: state.mapTheme === "dark" ? "#11100b" : "#d7d0bf",
      styles: googleMapStylesForTheme(state.mapTheme)
    });
    if (state.savedUserLocation) {
      upsertUserMarker(
        state,
        state.savedUserLocation.lat,
        state.savedUserLocation.lng,
        state.savedUserLocation.accuracy
      );
    }
    state.shops.filter(function (shop) {
      return shop.has_location && isFinite(shop.lat) && isFinite(shop.lng);
    }).forEach(function (shop) {
      const point = { lat: Number(shop.lat), lng: Number(shop.lng) };
      state.shopPoints.push([point.lat, point.lng]);
      const marker = new window.google.maps.Marker({
        position: point,
        map: state.map,
        title: String(shop.display_name || shop.shop_id || "Shop"),
        icon: {
          path: "M12 2C8.14 2 5 5.14 5 9c0 5.24 7 13 7 13s7-7.76 7-13c0-3.86-3.14-7-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z",
          scale: 1.35,
          anchor: new window.google.maps.Point(12, 22),
          fillColor: shopColor(shop),
          fillOpacity: 1,
          strokeColor: "#070604",
          strokeWeight: 2
        }
      });
      marker.addListener("click", function () {
        openShopInPane(state, shop.shop_id);
      });
    });
    installInteractiveMapBrowse(state);
    updateMapView(state);
    syncMapUiState(state);
    maybeLocateOnLoad(state);
    stabilizeMapViewport(state, 120);
    return true;
  }

  function upsertUserMarker(state, lat, lng, accuracy, options) {
    if (!state || !state.map) return;
    if (!isValidMapPoint(lat, lng)) return;
    const settings = options && typeof options === "object" ? options : {};
    const persist = settings.persist !== false;
    const source = String(settings.source || (persist ? "location" : "map")).trim() || "location";
    const markerTitle = String(settings.title || (source === "map" ? "Map point" : "Your location")).trim();
    state.userPoint = [lat, lng];
    state.userPointSource = source;
    if (persist) {
      state.savedUserLocation = {
        lat: lat,
        lng: lng,
        accuracy: accuracy || 0,
        source: source,
        updatedAt: Date.now()
      };
      try {
        window.localStorage.setItem("hashop_last_location", JSON.stringify(state.savedUserLocation));
      } catch (error) {}
    } else {
      state.savedUserLocation = null;
    }
    if (state.mapProvider === "google" && window.google && window.google.maps) {
      const point = { lat: Number(lat), lng: Number(lng) };
      if (!state.userMarker) {
        state.userMarker = new window.google.maps.Marker({
          position: point,
          map: state.map,
          title: markerTitle,
          draggable: mapAddressPickerActive(state),
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: HASHOP_USER_MARKER_FILL,
            fillOpacity: 1,
            strokeColor: HASHOP_USER_MARKER_STROKE,
            strokeWeight: 3
          }
        });
      } else {
        state.userMarker.setPosition(point);
        if (typeof state.userMarker.setTitle === "function") {
          state.userMarker.setTitle(markerTitle);
        }
      }
      syncMapUiState(state);
      syncSetupAddressPickerUi(state);
      syncUserMarkerAdjustable(state);
      if (!state.userAccuracy) {
        state.userAccuracy = new window.google.maps.Circle({
          map: state.map,
          center: point,
          radius: Math.max(Number(accuracy) || 0, 40),
          strokeColor: HASHOP_USER_ACCURACY_STROKE,
          strokeOpacity: 0.72,
          strokeWeight: 1,
          fillColor: HASHOP_USER_ACCURACY_FILL,
          fillOpacity: 0.38
        });
      } else {
        state.userAccuracy.setCenter(point);
        state.userAccuracy.setRadius(Math.max(Number(accuracy) || 0, 40));
      }
      return;
    }
    if (!state.userMarker) {
      state.userMarker = window.L.marker([lat, lng], {
        icon: window.L.divIcon({
          className: "",
          html: '<div class="map-user-marker' + (source === "map" ? ' is-map-point' : '') + (mapAddressPickerActive(state) ? ' is-adjustable' : '') + '"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        }),
        draggable: mapAddressPickerActive(state)
      }).addTo(state.map);
    } else {
      state.userMarker.setLatLng([lat, lng]);
      if (typeof state.userMarker.setIcon === "function") {
        state.userMarker.setIcon(window.L.divIcon({
          className: "",
          html: '<div class="map-user-marker' + (source === "map" ? ' is-map-point' : '') + (mapAddressPickerActive(state) ? ' is-adjustable' : '') + '"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        }));
      }
    }
    syncMapUiState(state);
    syncSetupAddressPickerUi(state);
    syncUserMarkerAdjustable(state);

    if (!state.userAccuracy) {
      state.userAccuracy = window.L.circle([lat, lng], {
        radius: Math.max(Number(accuracy) || 0, 40),
        color: HASHOP_USER_ACCURACY_STROKE,
        weight: 1,
        fillColor: HASHOP_USER_ACCURACY_FILL,
        fillOpacity: 0.38
      }).addTo(state.map);
    } else {
      state.userAccuracy.setLatLng([lat, lng]);
      state.userAccuracy.setRadius(Math.max(Number(accuracy) || 0, 40));
    }
    pulseUserMarker(state);
  }

  function locateUser(state, silent) {
    if (!state || !state.map) return;
    if (state.locateRevealTimer) {
      window.clearTimeout(state.locateRevealTimer);
      state.locateRevealTimer = 0;
    }
    state.locateLoading = true;
    syncMapUiState(state);
    syncActionButton(state);
    if (!navigator.geolocation) {
      state.locateLoading = false;
      syncActionButton(state);
      setLocateButtonState(state.locateButton, "is-error", "No GPS");
      return;
    }
    setLocateButtonState(state.locateButton, "is-loading", "Locating...");
    navigator.geolocation.getCurrentPosition(function (position) {
      const lat = position && position.coords ? position.coords.latitude : null;
      const lng = position && position.coords ? position.coords.longitude : null;
      const accuracy = position && position.coords ? position.coords.accuracy : 0;
      if (!isFinite(lat) || !isFinite(lng)) {
        state.locateLoading = false;
        syncActionButton(state);
        setLocateButtonState(state.locateButton, "is-error", "Try again");
        return;
      }
      upsertUserMarker(state, lat, lng, accuracy);
      updateMapView(state);
      state.locateLoading = false;
      renderShopList(state);
      updateSearchField(state);
      syncActionButton(state);
      if (!silent) {
        state.locateRevealTimer = window.setTimeout(function () {
          state.locateRevealTimer = 0;
          window.requestAnimationFrame(function () {
            setPaneExpanded(state, true, "full");
          });
        }, LOCATE_REVEAL_DELAY_MS);
      }
    }, function () {
      state.locateLoading = false;
      syncActionButton(state);
      if (!silent) {
        setLocateButtonState(state.locateButton, "is-error", "Blocked");
      }
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    });
  }

  function maybeLocateOnLoad(state) {
    if (!window.isSecureContext || !navigator.permissions || !navigator.geolocation) return;
    navigator.permissions.query({ name: "geolocation" }).then(function (result) {
      if (result && result.state === "granted") {
        locateUser(state, true);
      }
    }).catch(function () {});
  }

  function initMap(state) {
    if (!state || !state.mapNode) return;
    state.mapNode.classList.add("is-map-loading");
    syncMapUiState(state);
    if (state.googleMapsApiKey) {
      loadGoogleMapsApi(state.googleMapsApiKey).then(function () {
        if (!renderGoogleMap(state)) initLeafletMap(state);
      }).catch(function () {
        initLeafletMap(state);
      });
      return;
    }
    initLeafletMap(state);
  }

  function initLeafletMap(state) {
    if (!state || !state.mapNode || !window.L) return;
    state.mapNode.classList.remove("is-map-loading");
    state.mapNode.classList.add("is-leaflet-map");
    state.mapProvider = "leaflet";
    syncMapUiState(state);
    const map = window.L.map(state.mapNode, {
      zoomControl: false,
      attributionControl: true,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      tap: true,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false
    });
    state.map = map;
    installReliableBaseLayer(map, state.mapTheme);
    if (state.savedUserLocation) {
      upsertUserMarker(
        state,
        state.savedUserLocation.lat,
        state.savedUserLocation.lng,
        state.savedUserLocation.accuracy
      );
    }

    state.shops.filter(function (shop) {
      return shop.has_location && isFinite(shop.lat) && isFinite(shop.lng);
    }).forEach(function (shop) {
      const point = [shop.lat, shop.lng];
      state.shopPoints.push(point);
      const icon = window.L.divIcon({
        className: "",
        html: '<div class="map-shop-marker" style="--shop-color:' + escapeHtml(shopColor(shop)) + ';"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -12]
      });
      window.L.marker(point, { icon: icon })
        .addTo(map)
        .on("click", function (event) {
          if (event && event.originalEvent && window.L && window.L.DomEvent) {
            window.L.DomEvent.stopPropagation(event.originalEvent);
          }
          openShopInPane(state, shop.shop_id);
        })
        .bindPopup(buildPopup(shop, state.userPoint), { closeButton: false, autoPanPadding: [20, 20] });
    });

    installInteractiveMapBrowse(state);
    updateMapView(state);
    syncMapUiState(state);
    maybeLocateOnLoad(state);
    map.whenReady(function () {
      stabilizeMapViewport(state, 0);
      stabilizeMapViewport(state, 120);
    });
  }

  const bootstrap = loadBootstrap();
  const initialAccountSession = loadAccountSession();
  const lastLocation = loadLastLocation();
  const state = {
    shops: Array.isArray(bootstrap.map_shops) ? bootstrap.map_shops : [],
    shopById: {},
    shopDetails: {},
    shopConsoles: {},
    map: null,
    mapProvider: "",
    mapTheme: detectMapTheme(),
    shopPoints: [],
    userPoint: lastLocation ? [lastLocation.lat, lastLocation.lng] : null,
    userPointSource: lastLocation ? String(lastLocation.source || "location").trim() : "",
    userMarker: null,
    userAccuracy: null,
    savedUserLocation: lastLocation,
    isExpanded: false,
    expandMode: "normal",
    activeShopId: "",
    activeShopView: "items",
    debugPaneView: "",
    accountPaneMode: "",
    rootMode: "shops",
    itemSortMode: "nearby",
    listingViewMode: loadListingViewMode(),
    conceptMode: CONCEPT_MODE,
    conceptName: CONCEPT_NAME,
    conceptAccountStep: "account",
    conceptWorkspaceTab: "orders",
    conceptLanguage: "EN",
    conceptShopDraft: {
      name: "",
      location: "",
      firstItem: ""
    },
    conceptShopPreview: null,
    conceptShopProcedureState: "",
    conceptShopProcedureMessage: "",
    conceptShopProcedureId: 0,
    conceptItemDraft: {
      name: "",
      price: "",
      stock: ""
    },
    conceptListings: [],
    conceptItemProcedureState: "",
    conceptItemProcedureMessage: "",
    conceptItemProcedureId: 0,
    asyncQueue: Promise.resolve(),
    asyncEventSerial: 0,
    asyncLastEvent: "",
    asyncActiveEvent: "",
    asyncSettledEvent: "",
    asyncSettledEventId: 0,
    asyncError: "",
    screenMode: "home",
    detailLoading: false,
    suppressToggleClickUntil: 0,
    searchQuery: "",
    isOnline: isNetworkOnline(),
    shellNode: document.querySelector(".shell-home"),
    mapNode: document.getElementById("discoveryMap"),
    mapFrameNode: document.querySelector(".map-screen"),
    panelNode: document.querySelector(".shop-list-panel"),
    headerStateNode: null,
    liveStatusNode: document.getElementById("homeLiveStatus"),
    listNode: document.getElementById("shopList"),
    searchInput: document.getElementById("shopSearchInput"),
    primaryActionsNode: document.getElementById("homePrimaryActions"),
    homeModeButtons: Array.prototype.slice.call(document.querySelectorAll("[data-home-mode]")),
    homeNavButtons: Array.prototype.slice.call(document.querySelectorAll("[data-home-nav]")),
    locateButton: null,
    mapLocateButton: document.getElementById("homeMapLocateAction"),
    mapCompassButton: document.getElementById("homeMapCompassAction"),
    ordersButton: null,
    navLocateButton: null,
    backButton: document.getElementById("shopBackAction"),
    toggleButton: document.getElementById("shopPaneToggle"),
    loginNode: document.querySelector(".home-login-fab"),
    accountSession: initialAccountSession,
    ownerShopId: preferredOwnerShopId(initialAccountSession),
    googleMapsApiKey: String(bootstrap.google_maps_api_key || window.__HASHOP_GOOGLE_MAPS_API_KEY__ || "").trim(),
    ownerPanel: {
      tab: "",
      section: "",
      itemId: "",
      message: "",
      tone: "",
      saving: false,
      addMenuOpen: false,
      orderDraftOpen: false
    },
    cartByShop: {},
    selectedPaymentByShop: {},
    paymentModeByShop: {},
    fulfillmentModeByShop: {},
    checkoutNoticeByShop: {},
    orderConfirmationByShop: {},
    pendingCheckoutShopId: "",
    ownerOrderDraftByShop: {},
    itemLibrary: [],
    itemLibraryLoading: false,
    itemLibraryLoaded: false,
    itemLibraryRequested: false,
    itemLibraryError: "",
    buyerProfile: loadBuyerProfile(),
    buyerOrders: [],
    buyerOrdersLoading: false,
    buyerOrdersError: "",
    buyerOrdersPollTimer: 0,
    accountSessionSerial: 0,
    accountSessionRefreshing: false,
    accountSessionRefreshPromise: null,
    accountAddresses: loadAccountAddresses(),
    accountPayments: loadAccountPayments(),
    accountDraft: {
      message: "",
      tone: ""
    },
    setupDraft: null,
    buyerAuthDraft: {
      name: "",
      contact: "",
      password: "",
      createMode: false,
      createStep: "contact",
      resetMode: false,
      resetStep: "address",
      resetCode: "",
      resetPassword: "",
      verificationCode: "",
      status: "",
      tone: "",
      submitting: false
    },
    ownerOrdersNavLoading: false,
    locateLoading: false,
    locateRevealTimer: 0,
    compassHeading: null,
    compassInstalled: false,
    interactiveMapBrowseInstalled: false,
    setupAddressPickActive: false,
    setupAddressPickedPoint: null,
    setupAddressPickRequestId: 0,
    setupAddressPickerInstalled: false,
    accountProfileAddressPickActive: false,
    accountProfileAddressPickedPoint: null,
    accountProfileAddressPickRequestId: 0,
    setupAddressDragMarker: null,
    setupAddressDragHandler: null,
    setupAddressDragListener: null,
    googleProjectionOverlay: null,
    loginDraft: {
      flow: "",
      shopSetupStep: "details",
      username: preferredOwnerShopName(initialAccountSession),
      password: "",
      contact: "",
      address: "",
      verificationCode: "",
      resetMode: false,
      resetStep: "address",
      resetContact: "",
      resetCode: "",
      resetPassword: "",
      status: "",
      tone: "",
      submitting: false
    }
  };

  state.shops.forEach(function (shop) {
    state.shopById[String(shop.shop_id || "").trim()] = shop;
  });
  state.buildVersion = BUILD_VERSION;
  exposeHashopDebug(state, bootstrap);
  setConnectionStatus(state, state.isOnline);
  setBuyerProfile(state, state.buyerProfile);
  setAccountSession(state, state.accountSession);
  state.buyerAuthDraft.name = String(state.buyerProfile && state.buyerProfile.name || "");
  state.buyerAuthDraft.contact = String(state.buyerProfile && state.buyerProfile.contact || "");

  setPaneExpanded(state, true, "normal");
  renderShopList(state);
  updateSearchField(state);
  syncActionButton(state);
  syncBackButton(state);
  installIconRenderer(state);
  initMap(state);
  installCompassControl(state);
  installSetupAddressPicker(state);
  refreshOwnerOrdersNavData(state);

  applyRouteState(state, INITIAL_ROUTE);
  refreshBuyerAccountSession(state, { silent: true });

  if (state.searchInput) {
    state.searchInput.addEventListener("input", function () {
      state.searchQuery = String(state.searchInput.value || "");
      renderShopList(state);
    });
  }

  window.addEventListener("online", function () {
    setConnectionStatus(state, true);
    renderShopList(state);
    if (state.debugPaneView === "recent-orders" || state.debugPaneView === "account") {
      refreshBuyerOrders(state, { force: true });
      refreshBuyerAccountSession(state, { force: true, silent: true });
    }
    if (state.activeShopId && isOwnerViewingShop(state)) {
      refreshShopConsole(state, state.activeShopId, { preserveScroll: true }).catch(function () {});
    }
  });

	  window.addEventListener("offline", function () {
	    setConnectionStatus(state, false);
	    renderShopList(state);
	  });

	  window.addEventListener("popstate", function () {
	    applyRouteState(state, parseInitialRoute(), { replace: false });
	  });

  (state.homeModeButtons || []).forEach(function (button) {
    button.addEventListener("click", function () {
      const mode = normalizeRootMode(button.getAttribute("data-home-mode"));
      openRootBrowseMode(state, mode, {
        focusSearch: false
      });
    });
  });

  (state.homeNavButtons || []).forEach(function (button) {
    button.addEventListener("click", function () {
      const nav = String(button.getAttribute("data-home-nav") || "").trim();
      const ownerMode = isOwnerAccountMode(state);
      if (nav === "items") {
        if (ownerMode) {
          const shopId = ownerOrdersNavShopId(state);
          if (shopId) {
            setPreferredOwnerShop(state, shopId);
            openOwnerHistoryPane(state, { shopId: shopId, section: "items", force: true });
            return;
          }
          openRootBrowseMode(state, "shops");
          return;
        }
        openRootBrowseMode(state, "items", { focusSearch: false });
        return;
      }
      if (nav === "cart") {
        if (ownerMode) {
          const ownerShops = ownerAccountShops(state);
          if (ownerShops.length === 1) {
            setPreferredOwnerShop(state, ownerShops[0].shopId);
            openOwnerOrdersPane(state, { shopId: ownerShops[0].shopId, force: true });
            return;
          }
          openRootBrowseMode(state, "shops");
          return;
        }
        openBuyerOrdersPane(state);
        return;
      }
      if (nav === "orders") {
        openAccountPane(state);
        return;
      }
      if (nav === "account") {
        openRootAccountAction(state);
        return;
      }
      openRootBrowseMode(state, "shops");
    });
  });

	  if (state.locateButton) {
	    state.locateButton.addEventListener("click", function () {
	      if (state.debugPaneView === "account") {
	        state.accountPaneMode = "";
	        expandSignInPortal(state);
	        renderShopList(state);
	        resetPaneScroll(state);
	        return;
	      }
      if (state.debugPaneView === "recent-orders") {
        refreshBuyerOrders(state, { force: true });
        return;
      }
      if (state.activeShopId) {
        if (isOwnerViewingShop(state)) {
          if (state.ownerPanel.tab === "settings") {
            closeOwnerOverlayToItems(state);
          } else {
            openOwnerSettingsPane(state, { section: "profile" });
          }
          return;
        }
        if (state.activeShopView === "cart" || state.activeShopView === "confirmation") {
          focusItems(state);
        } else {
          focusCart(state);
        }
        return;
      }
      locateUser(state, false);
    });
  }

  if (state.ordersButton) {
    state.ordersButton.addEventListener("click", function () {
      if (state.debugPaneView === "recent-orders") {
        refreshBuyerOrders(state, { force: true });
        return;
      }
      if (shouldUseOwnerOrdersNav(state)) {
        if (ownerOrdersNavActive(state)) {
          refreshOwnerOrdersNavData(state, { force: true });
          return;
        }
        openOwnerOrdersPane(state, { force: true });
        return;
      }
      openAccountPane(state);
    });
  }

  if (state.navLocateButton) {
    state.navLocateButton.addEventListener("click", function () {
      locateUser(state, false);
    });
  }

  if (state.mapLocateButton) {
    state.mapLocateButton.addEventListener("click", function () {
      if (useDefaultAccountAddressLocation(state)) {
        return;
      }
      locateUser(state, true);
    });
  }

  if (state.backButton) {
    state.backButton.addEventListener("click", function () {
      if (state.debugPaneView === "setup") {
        closeSetupPane(state);
        return;
      }
      if (state.debugPaneView === "login") {
        closeDebugLoginPane(state);
        return;
      }
      if (state.debugPaneView === "account") {
        closeAccountPane(state);
        return;
      }
      if (state.debugPaneView === "recent-orders") {
        closeBuyerOrdersPane(state);
        return;
      }
      if (isConceptPane(state)) {
        closeConceptPane(state);
        return;
      }
      if (state.activeShopId) {
        closeShopInPane(state);
        return;
      }
      openRootAccountAction(state);
    });
  }

  if (state.toggleButton) {
    state.toggleButton.addEventListener("click", function () {
      if (Date.now() < Number(state.suppressToggleClickUntil || 0)) return;
      togglePane(state);
    });
  }

  installPaneToggleDrag(state);

  if (state.listNode) {
    state.listNode.addEventListener("input", function (event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const conceptShopField = target.closest("[data-concept-shop-field]");
      if (conceptShopField) {
        updateConceptShopDraftField(
          state,
          String(conceptShopField.getAttribute("data-concept-shop-field") || "").trim(),
          conceptShopField.value
        );
        return;
      }
      const conceptItemField = target.closest("[data-concept-item-field]");
      if (conceptItemField) {
        updateConceptItemDraftField(
          state,
          String(conceptItemField.getAttribute("data-concept-item-field") || "").trim(),
          conceptItemField.value
        );
        return;
      }
      const setupField = target.closest("[data-setup-field]");
      if (setupField) {
        const setupKey = String(setupField.getAttribute("data-setup-field") || "").trim();
        if (!setupKey) return;
        const setupDraft = ensureSetupDraft(state);
        setupDraft[setupKey] = setupField.value;
        if (setupDraft.message) {
          setupDraft.message = "";
          setupDraft.tone = "";
        }
        return;
      }
      const buyerField = target.closest("[data-buyer-field]");
      if (buyerField) {
        const buyerKey = String(buyerField.getAttribute("data-buyer-field") || "").trim();
        if (!buyerKey) return;
        mergeBuyerProfile(state, (function () {
          const patch = {};
          patch[buyerKey] = String(buyerField.value || "");
          return patch;
        }()));
        return;
      }
      const buyerAuthField = target.closest("[data-buyer-auth-field]");
      if (buyerAuthField) {
        const buyerAuthKey = String(buyerAuthField.getAttribute("data-buyer-auth-field") || "").trim();
        if (!buyerAuthKey) return;
        state.buyerAuthDraft[buyerAuthKey] = buyerAuthField.value;
        if (state.buyerAuthDraft.status) {
          state.buyerAuthDraft.status = "";
          state.buyerAuthDraft.tone = "";
        }
        return;
      }
      const accountDraftField = target.closest("[data-account-draft-field]");
      if (accountDraftField) {
        const accountDraftKey = String(accountDraftField.getAttribute("data-account-draft-field") || "").trim();
        if (!accountDraftKey) return;
        const accountDraft = ensureAccountDraft(state);
        accountDraft[accountDraftKey] = accountDraftField.value;
        if (accountDraftKey === "addressLabel" || accountDraftKey === "addressText") {
          accountDraft.addressEditorOpen = true;
        }
        if (accountDraft.message) {
          accountDraft.message = "";
          accountDraft.tone = "";
        }
        return;
      }
      const ownerDraftField = target.closest("[data-owner-order-draft-field]");
      if (ownerDraftField) {
        if (!state.activeShopId) return;
        setOwnerOrderDraftField(
          state,
          state.activeShopId,
          String(ownerDraftField.getAttribute("data-owner-order-draft-field") || "").trim(),
          ownerDraftField.value
        );
        return;
      }
      const field = target.closest("[data-login-field]");
      const resetField = target.closest("[data-login-reset-field]");
      if (!field && !resetField) return;
      if (resetField) {
        const resetKey = String(resetField.getAttribute("data-login-reset-field") || "").trim();
        if (!resetKey) return;
        state.loginDraft[resetKey] = resetField.value;
        if (state.loginDraft.status) {
          state.loginDraft.status = "";
          state.loginDraft.tone = "";
        }
        return;
      }
      const key = String(field.getAttribute("data-login-field") || "").trim();
      if (!key) return;
      state.loginDraft[key] = field.value;
      if (state.loginDraft.status) {
        state.loginDraft.status = "";
        state.loginDraft.tone = "";
      }
    });

    state.listNode.addEventListener("submit", function (event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const conceptShopForm = target.closest("[data-concept-shop-form]");
      if (conceptShopForm) {
        event.preventDefault();
        dispatchHashopEvent(state, { type: "CONCEPT_SHOP_SETUP_SUBMITTED" });
        return;
      }
      const conceptItemForm = target.closest("[data-concept-item-form]");
      if (conceptItemForm) {
        event.preventDefault();
        dispatchHashopEvent(state, { type: "CONCEPT_ITEM_SUBMITTED" });
      }
    });

	    state.listNode.addEventListener("keydown", function (event) {
	      const target = event.target;
	      if (!(target instanceof Element)) return;
      if (target.closest("button, a, input, textarea, select")) return;
      const paneAddKeyboardItem = target.closest("[data-pane-add-item]");
      if (paneAddKeyboardItem) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (!state.activeShopId || isOwnerViewingShop(state)) return;
        addToCart(
          state,
          state.activeShopId,
          String(paneAddKeyboardItem.getAttribute("data-pane-add-item") || "").trim(),
          1
        );
        return;
      }
      if (target.closest("[data-concept-shop-field]")) {
        if (event.key !== "Enter") return;
        event.preventDefault();
        dispatchHashopEvent(state, { type: "CONCEPT_SHOP_SETUP_SUBMITTED" });
        return;
      }
      if (target.closest("[data-concept-item-field]")) {
        if (event.key !== "Enter") return;
        event.preventDefault();
        dispatchHashopEvent(state, { type: "CONCEPT_ITEM_SUBMITTED" });
        return;
      }
		      if (target.closest("[data-setup-field]")) {
		        if (event.key !== "Enter") return;
		        event.preventDefault();
		        const setupDraftForEnter = ensureSetupDraft(state);
		        if (String(setupDraftForEnter.step || "details").trim() === "verify") {
		          completeSetupContactVerification(state);
		        } else {
		          saveSetupDetails(state);
		        }
		        return;
		      }
	      if (target.closest("[data-buyer-auth-field]")) {
	        if (event.key !== "Enter") return;
	        event.preventDefault();
        if (state.buyerAuthDraft && state.buyerAuthDraft.resetMode) {
          if (String(state.buyerAuthDraft.resetStep || "").trim() !== "code") {
            submitBuyerPasswordResetRequest(state);
          } else {
            submitBuyerPasswordReset(state);
          }
        } else if (state.buyerAuthDraft && state.buyerAuthDraft.createMode) {
          const buyerCreateStep = String(state.buyerAuthDraft.createStep || "").trim();
          if (buyerCreateStep === "verify") {
            continueBuyerCreatePassword(state);
          } else if (buyerCreateStep !== "password") {
            continueBuyerCreateAccount(state);
          } else {
            submitBuyerAccount(state, "signup");
          }
        } else {
          submitBuyerAccount(state, "login");
        }
        return;
      }
      if (target.closest("[data-account-draft-field]")) {
        if (event.key !== "Enter") return;
        event.preventDefault();
        if (state.accountPaneMode === "profile") {
          saveAccountProfileDetails(state);
        } else if (state.accountPaneMode === "addresses") {
          saveManualAccountAddress(state);
        } else if (state.accountPaneMode === "payments") {
          saveManualAccountPayment(state);
        }
        return;
      }
      if (target.closest("[data-login-reset-field]")) {
        if (event.key !== "Enter") return;
        event.preventDefault();
        if (String(state.loginDraft.resetStep || "").trim() !== "code") {
          submitRequestShopPasswordReset(state);
        } else {
          submitResetShopPassword(state);
        }
        return;
      }
      if (!target.closest("[data-login-field]")) return;
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (state.loginDraft && state.loginDraft.resetMode) {
        if (String(state.loginDraft.resetStep || "").trim() !== "code") {
          submitRequestShopPasswordReset(state);
        } else {
          submitResetShopPassword(state);
        }
      } else {
        submitDebugLoginPane(state);
      }
    });

    state.listNode.addEventListener("change", function (event) {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      const accountAvatarInput = target.closest("[data-account-avatar-input]");
      if (accountAvatarInput) {
        const avatarFile = target.files && target.files[0];
        if (!avatarFile) return;
        const accountDraft = ensureAccountDraft(state);
        accountDraft.message = "Preparing image...";
        accountDraft.tone = "";
        renderShopList(state);
        hashopImageDataUrl(avatarFile, 384)
          .then(function (dataUrl) {
            mergeBuyerProfile(state, { avatarUrl: dataUrl });
            accountDraft.message = "Profile image updated.";
            accountDraft.tone = "success";
            renderShopList(state);
          })
          .catch(function () {
            accountDraft.message = "Could not use that image.";
            accountDraft.tone = "error";
            renderShopList(state);
          });
        return;
      }
      const logoInput = target.closest("[data-owner-logo-input]");
      if (logoInput) {
        const logoFile = target.files && target.files[0];
        if (!logoFile || !state.activeShopId) return;
        state.ownerPanel.message = "Uploading logo...";
        state.ownerPanel.tone = "";
        renderShopList(state);
        uploadShopLogo(state.activeShopId, logoFile)
          .then(function (result) {
            if (!result || !result.ok) {
              throw new Error(String(result && result.payload && result.payload.error || "logo_upload_failed"));
            }
            applyConsoleRecord(state, state.activeShopId, result.payload);
            state.ownerPanel.message = "Logo updated.";
            state.ownerPanel.tone = "success";
            renderShopList(state);
          })
          .catch(function () {
            state.ownerPanel.message = "Could not upload the logo.";
            state.ownerPanel.tone = "error";
            renderShopList(state);
          });
        return;
      }
      const itemImageInput = target.closest("[data-owner-item-image-input]");
      if (itemImageInput) {
        const itemFile = target.files && target.files[0];
        const imageItemId = String(itemImageInput.getAttribute("data-owner-item-image-input") || "").trim();
        if (!itemFile || !state.activeShopId || !imageItemId) return;
        state.ownerPanel.message = "Uploading image...";
        state.ownerPanel.tone = "";
        renderShopList(state);
        uploadOwnerItemImage(state.activeShopId, imageItemId, itemFile)
          .then(function (result) {
            if (!result || !result.ok) {
              throw new Error(String(result && result.payload && result.payload.error || "item_image_upload_failed"));
            }
            applyConsoleRecord(state, state.activeShopId, result.payload);
            state.ownerPanel.message = "Item image updated.";
            state.ownerPanel.tone = "success";
            renderShopList(state);
          })
          .catch(function () {
            state.ownerPanel.message = "Could not upload the image.";
            state.ownerPanel.tone = "error";
            renderShopList(state);
          });
        return;
      }
    });

	    state.listNode.addEventListener("click", function (event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const clearSearchButton = target.closest("[data-clear-search]");
      if (clearSearchButton) {
        event.preventDefault();
        state.searchQuery = "";
        updateSearchField(state);
        renderShopList(state);
        if (state.searchInput) {
          state.searchInput.focus();
        }
        return;
      }
      const goHomeButton = target.closest("[data-go-home]");
      if (goHomeButton) {
        event.preventDefault();
        openRootBrowseMode(state, "shops");
        return;
      }
      const refreshItemsButton = target.closest("[data-refresh-items]");
      if (refreshItemsButton) {
        event.preventDefault();
        refreshItemLibrary(state, { force: true });
        return;
      }
      const itemSortButton = target.closest("[data-item-sort]");
      if (itemSortButton) {
        event.preventDefault();
        state.itemSortMode = normalizeItemSortMode(itemSortButton.getAttribute("data-item-sort"));
        renderShopList(state);
        resetPaneScroll(state);
        return;
      }
      const listViewButton = target.closest("button[data-list-view]");
      if (listViewButton) {
        event.preventDefault();
        saveListingViewMode(state, listViewButton.getAttribute("data-list-view"));
        renderShopList(state);
        resetPaneScroll(state);
        return;
      }
      const setupMapButton = target.closest("[data-setup-use-map]");
      if (setupMapButton) {
        event.preventDefault();
        useSetupMapAddress(state);
        return;
      }
		      const setupSaveButton = target.closest("[data-setup-save]");
		      if (setupSaveButton) {
		        event.preventDefault();
		        saveSetupDetails(state);
		        return;
		      }
		      const setupContactResendButton = target.closest("[data-setup-contact-resend]");
		      if (setupContactResendButton) {
		        event.preventDefault();
		        saveSetupDetails(state);
		        return;
		      }
	      const setupContactVerifyButton = target.closest("[data-setup-contact-verify]");
	      if (setupContactVerifyButton) {
	        event.preventDefault();
	        completeSetupContactVerification(state);
	        return;
	      }
	      const setupBackDetailsButton = target.closest("[data-setup-back-details]");
	      if (setupBackDetailsButton) {
	        event.preventDefault();
	        editSetupDetails(state);
	        return;
	      }
	      const setupFinishButton = target.closest("[data-setup-finish]");
	      if (setupFinishButton) {
	        event.preventDefault();
	        finishSetupPane(state);
	        return;
	      }
      const shopSetupResendButton = target.closest("[data-shop-setup-resend]");
      if (shopSetupResendButton) {
        event.preventDefault();
        if (isShopSetupDraft(state)) {
          state.loginDraft.shopSetupStep = "details";
          sendShopSetupVerification(state);
        }
        return;
      }
      const shopSetupEditButton = target.closest("[data-shop-setup-edit]");
      if (shopSetupEditButton) {
        event.preventDefault();
        editShopSetupDetails(state);
        return;
      }
      const shopSetupBackAccountButton = target.closest("[data-shop-setup-back-account]");
      if (shopSetupBackAccountButton) {
        event.preventDefault();
        closeDebugLoginPane(state);
        openAccountPane(state, { accountPaneMode: "shops" });
        return;
      }
	      const loginSubmit = target.closest("[data-login-submit]");
	      if (loginSubmit) {
	        event.preventDefault();
        submitDebugLoginPane(state);
        return;
      }
      const loginResetToggle = target.closest("[data-login-reset-toggle]");
      if (loginResetToggle) {
        event.preventDefault();
        state.loginDraft.resetMode = String(loginResetToggle.getAttribute("data-login-reset-toggle") || "").trim() === "true";
        state.loginDraft.resetStep = "address";
        state.loginDraft.password = "";
        state.loginDraft.resetContact = "";
        state.loginDraft.resetCode = "";
        state.loginDraft.resetPassword = "";
        state.loginDraft.status = "";
        state.loginDraft.tone = "";
        renderShopList(state);
        resetPaneScroll(state);
        return;
      }
      const loginResetSubmit = target.closest("[data-login-reset-submit]");
      if (loginResetSubmit) {
        event.preventDefault();
        submitResetShopPassword(state);
        return;
      }
      const loginResetRequest = target.closest("[data-login-reset-request]");
      if (loginResetRequest) {
        event.preventDefault();
        submitRequestShopPasswordReset(state);
        return;
      }
      const recentOrdersButton = target.closest("[data-open-recent-orders]");
      if (recentOrdersButton) {
        event.preventDefault();
        openBuyerOrdersPane(state);
        return;
      }
      const cancelBuyerOrderButton = target.closest("[data-cancel-buyer-order]");
      if (cancelBuyerOrderButton) {
        event.preventDefault();
        submitBuyerOrderCancel(
          state,
          String(cancelBuyerOrderButton.getAttribute("data-cancel-shop-id") || state.activeShopId || "").trim(),
          String(cancelBuyerOrderButton.getAttribute("data-cancel-buyer-order") || "").trim()
        );
        return;
      }
      const accountEntryButton = target.closest("[data-open-account-entry]");
      if (accountEntryButton) {
        event.preventDefault();
        openRootAccountAction(state);
        return;
      }
      const conceptFillButton = target.closest("[data-concept-shop-field-fill]");
      if (conceptFillButton) {
        event.preventDefault();
        const fillKey = String(conceptFillButton.getAttribute("data-concept-shop-field-fill") || "").trim();
        const fillValue = fillKey === "location" ? "Pinned on map" : "";
        if (fillKey && fillValue) {
          updateConceptShopDraftField(state, fillKey, fillValue);
          const field = conceptFillButton.closest(".shop-concept-field");
          const input = field && field.querySelector('[data-concept-shop-field="' + fillKey + '"]');
          if (input instanceof HTMLInputElement) {
            input.value = fillValue;
            input.focus();
          }
        }
        return;
      }
      const conceptRouteButton = target.closest("[data-concept-route]");
      if (conceptRouteButton) {
        event.preventDefault();
        dispatchHashopEvent(state, {
          type: "CONCEPT_ROUTE_SELECTED",
          concept: String(conceptRouteButton.getAttribute("data-concept-route") || "").trim()
        });
        return;
      }
      const conceptOpenWorkspaceButton = target.closest("[data-concept-open-workspace]");
      if (conceptOpenWorkspaceButton) {
        event.preventDefault();
        dispatchHashopEvent(state, {
          type: "CONCEPT_WORKSPACE_TAB_OPENED",
          tab: String(conceptOpenWorkspaceButton.getAttribute("data-concept-open-workspace") || "orders").trim()
        });
        return;
      }
      const conceptAccountStepButton = target.closest("[data-concept-account-step]");
      if (conceptAccountStepButton) {
        event.preventDefault();
        dispatchHashopEvent(state, {
          type: "CONCEPT_ACCOUNT_STEP_SELECTED",
          step: String(conceptAccountStepButton.getAttribute("data-concept-account-step") || "account").trim()
        });
        return;
      }
      const conceptWorkspaceTabButton = target.closest("[data-concept-workspace-tab]");
      if (conceptWorkspaceTabButton) {
        event.preventDefault();
        dispatchHashopEvent(state, {
          type: "CONCEPT_WORKSPACE_TAB_SELECTED",
          tab: String(conceptWorkspaceTabButton.getAttribute("data-concept-workspace-tab") || "orders").trim()
        });
        return;
      }
      const conceptLanguageButton = target.closest("[data-concept-language]");
      if (conceptLanguageButton) {
        event.preventDefault();
        dispatchHashopEvent(state, { type: "CONCEPT_LANGUAGE_CYCLED" });
        return;
      }
	      const accountMenuButton = target.closest("[data-account-menu]");
	      if (accountMenuButton) {
	        event.preventDefault();
	        const accountMenu = String(accountMenuButton.getAttribute("data-account-menu") || "").trim();
	        if (accountMenu === "orders") {
	          const hasBuyerForOrders = !!accountBuyerAccount(state.accountSession || loadAccountSession());
	          if (hasBuyerForOrders) {
	            setAccountActiveRole(state, "buyer");
	          }
	          openAccountSubPane(state, "buyer-orders");
	          if (hasBuyerForOrders) {
	            refreshBuyerOrders(state, { force: true });
	          }
	          return;
	        }
	        if (accountMenu === "password") {
	          state.buyerAuthDraft.createMode = false;
	          state.buyerAuthDraft.createStep = "contact";
	          state.buyerAuthDraft.resetMode = true;
	          state.buyerAuthDraft.resetStep = "address";
	          state.buyerAuthDraft.resetCode = "";
	          state.buyerAuthDraft.resetPassword = "";
	          state.buyerAuthDraft.verificationCode = "";
	          state.buyerAuthDraft.contact = String(state.buyerAuthDraft.contact || state.buyerProfile && state.buyerProfile.contact || "");
	          state.buyerAuthDraft.status = "";
	          state.buyerAuthDraft.tone = "";
	          openAccountSubPane(state, "buyer-login");
	          return;
	        }
	        if (accountMenu === "profile" || accountMenu === "addresses" || accountMenu === "payments" || accountMenu === "shops" || accountMenu === "help" || accountMenu === "settings") {
	          setAccountDraftMessage(state, "", "");
	          if (accountMenu === "profile") {
	            const profileMenuDraft = ensureAccountDraft(state);
	            profileMenuDraft.profileEditorOpen = false;
	            state.accountProfileAddressPickActive = false;
	            syncSetupAddressPickerUi(state);
	            syncUserMarkerAdjustable(state);
	          }
	          if (accountMenu === "addresses") {
	            const addressMenuDraft = ensureAccountDraft(state);
	            addressMenuDraft.addressEditorOpen = false;
	            addressMenuDraft.addressLabel = "";
	            addressMenuDraft.addressText = "";
	          }
	          openAccountSubPane(state, accountMenu);
	          return;
	        }
	      }
      const accountThemeToggleButton = target.closest("[data-account-theme-toggle]");
      if (accountThemeToggleButton) {
        event.preventDefault();
        applyHashopTheme(state, state.mapTheme === "dark" ? "light" : "dark");
        renderShopList(state);
        return;
      }
      const accountOwnerToggleButton = target.closest("[data-account-owner-toggle]");
      if (accountOwnerToggleButton) {
        event.preventDefault();
        const ownerModeOn = isOwnerAccountMode(state);
        if (ownerModeOn) {
          setAccountActiveRole(state, "buyer");
          state.accountPaneMode = "";
          updateSearchField(state);
          syncActionButton(state);
          syncBackButton(state);
          renderShopList(state);
          resetPaneScroll(state);
          return;
        }
        const accountShopId = String(accountOwnerToggleButton.getAttribute("data-account-open-shop") || "").trim();
        setAccountActiveRole(state, "owner");
        state.accountPaneMode = "";
        if (accountShopId) {
          setPreferredOwnerShop(state, accountShopId);
          openSavedOwnerShop(state, { shopId: accountShopId });
          return;
        }
        openAccountSubPane(state, "shops");
        return;
      }
      const accountOpenShopButton = target.closest("[data-account-open-shop]");
      if (accountOpenShopButton) {
        event.preventDefault();
        const accountShopId = String(accountOpenShopButton.getAttribute("data-account-open-shop") || "").trim();
        if (!accountShopId) return;
        setAccountActiveRole(state, "owner");
        state.accountPaneMode = "";
        setPreferredOwnerShop(state, accountShopId);
        openSavedOwnerShop(state, { shopId: accountShopId });
        return;
      }
      const accountSetRoleButton = target.closest("[data-account-set-role]");
      if (accountSetRoleButton) {
        event.preventDefault();
        setAccountActiveRole(state, String(accountSetRoleButton.getAttribute("data-account-set-role") || "").trim());
        state.accountPaneMode = "";
        updateSearchField(state);
        syncActionButton(state);
        renderShopList(state);
        resetPaneScroll(state);
        return;
      }
      const accountOwnerHomeButton = target.closest("[data-account-owner-home]");
      if (accountOwnerHomeButton) {
        event.preventDefault();
        setAccountActiveRole(state, "owner");
        openRootBrowseMode(state, "shops");
        return;
      }
      const accountOpenOrdersButton = target.closest("[data-account-open-orders]");
	      if (accountOpenOrdersButton) {
	        event.preventDefault();
	        const hasBuyerForOpenOrders = !!accountBuyerAccount(state.accountSession || loadAccountSession());
	        if (hasBuyerForOpenOrders) {
	          setAccountActiveRole(state, "buyer");
	        }
	        openAccountSubPane(state, "buyer-orders");
	        if (hasBuyerForOpenOrders) {
	          refreshBuyerOrders(state, { force: true });
	        }
	        return;
	      }
	      const accountOpenBuyerLoginButton = target.closest("[data-account-open-buyer-login]");
	      if (accountOpenBuyerLoginButton) {
	        event.preventDefault();
	        state.buyerAuthDraft.createMode = false;
	        state.buyerAuthDraft.createStep = "contact";
	        state.buyerAuthDraft.resetMode = false;
	        state.buyerAuthDraft.resetStep = "address";
	        state.buyerAuthDraft.verificationCode = "";
	        state.buyerAuthDraft.status = "";
	        state.buyerAuthDraft.tone = "";
	        openAccountSubPane(state, "buyer-login");
	        return;
	      }
	      const accountOpenBuyerCreateButton = target.closest("[data-account-open-buyer-create]");
	      if (accountOpenBuyerCreateButton) {
	        event.preventDefault();
	        state.buyerAuthDraft.createMode = true;
	        state.buyerAuthDraft.createStep = "contact";
	        state.buyerAuthDraft.resetMode = false;
	        state.buyerAuthDraft.resetStep = "address";
	        state.buyerAuthDraft.password = "";
	        state.buyerAuthDraft.verificationCode = "";
	        state.buyerAuthDraft.status = "";
	        state.buyerAuthDraft.tone = "";
	        openAccountSubPane(state, "buyer-login");
	        return;
	      }
	      const accountOpenBuyerResetButton = target.closest("[data-account-open-buyer-reset]");
	      if (accountOpenBuyerResetButton) {
	        event.preventDefault();
	        state.buyerAuthDraft.createMode = false;
	        state.buyerAuthDraft.createStep = "contact";
	        state.buyerAuthDraft.resetMode = true;
	        state.buyerAuthDraft.resetStep = "address";
	        state.buyerAuthDraft.resetCode = "";
	        state.buyerAuthDraft.resetPassword = "";
	        state.buyerAuthDraft.verificationCode = "";
	        state.buyerAuthDraft.contact = String(state.buyerAuthDraft.contact || state.buyerProfile && state.buyerProfile.contact || "");
	        state.buyerAuthDraft.status = "";
	        state.buyerAuthDraft.tone = "";
	        openAccountSubPane(state, "buyer-login");
	        return;
	      }
	      const accountMainButton = target.closest("[data-account-main]");
	      if (accountMainButton) {
	        event.preventDefault();
	        state.accountPaneMode = "";
	        state.accountProfileAddressPickActive = false;
	        setAccountDraftMessage(state, "", "");
	        syncSetupAddressPickerUi(state);
	        syncUserMarkerAdjustable(state);
	        syncPaneUrl(state);
	        renderShopList(state);
	        resetPaneScroll(state);
	        return;
      }
      const checkoutBackButton = target.closest("[data-checkout-back]");
      if (checkoutBackButton) {
        event.preventDefault();
        returnToPendingCheckout(state);
        return;
      }
      const accountRefreshHistoryButton = target.closest("[data-refresh-account-history]");
      if (accountRefreshHistoryButton) {
	        event.preventDefault();
	        if (!accountBuyerAccount(state.accountSession || loadAccountSession())) {
	          openAccountSubPane(state, "buyer-login");
	          return;
	        }
	        openAccountSubPane(state, "buyer-orders");
	        refreshBuyerOrders(state, { force: true });
	        return;
	      }
      const accountOpenLoginButton = target.closest("[data-account-open-login]");
      if (accountOpenLoginButton) {
        event.preventDefault();
        openAddShopPane(state);
        return;
      }
      const accountSaveProfileButton = target.closest("[data-account-save-profile]");
      if (accountSaveProfileButton) {
        event.preventDefault();
        saveAccountProfileDetails(state);
        return;
      }
      const accountEditProfileButton = target.closest("[data-account-edit-profile]");
      if (accountEditProfileButton) {
        event.preventDefault();
        const draft = ensureAccountDraft(state);
        draft.profileEditorOpen = true;
        setAccountDraftMessage(state, "", "");
        renderShopList(state);
        resetPaneScroll(state);
        return;
      }
      const accountCancelProfileEditButton = target.closest("[data-account-cancel-profile-edit]");
      if (accountCancelProfileEditButton) {
        event.preventDefault();
        const draft = ensureAccountDraft(state);
        draft.profileEditorOpen = false;
        state.accountProfileAddressPickActive = false;
        setAccountDraftMessage(state, "", "");
        syncSetupAddressPickerUi(state);
        syncUserMarkerAdjustable(state);
        renderShopList(state);
        resetPaneScroll(state);
        return;
      }
      const accountProfileMapAddressButton = target.closest("[data-account-profile-map-address]");
      if (accountProfileMapAddressButton) {
        event.preventDefault();
        startAccountProfileAddressPicker(state);
        return;
      }
      const accountSaveAddressButton = target.closest("[data-account-save-address]");
      if (accountSaveAddressButton) {
        event.preventDefault();
        saveManualAccountAddress(state);
        return;
      }
      const accountAddAddressButton = target.closest("[data-account-add-address]");
      if (accountAddAddressButton) {
        event.preventDefault();
        openAccountAddressEditor(state);
        return;
      }
      const accountCancelAddressButton = target.closest("[data-account-cancel-address]");
      if (accountCancelAddressButton) {
        event.preventDefault();
        closeAccountAddressEditor(state);
        return;
      }
      const accountUseCurrentAddressButton = target.closest("[data-account-use-current-address]");
      if (accountUseCurrentAddressButton) {
        event.preventDefault();
        saveCurrentLocationAsAccountAddress(state);
        return;
      }
      const accountSetAddressDefaultButton = target.closest("[data-account-set-address-default]");
      if (accountSetAddressDefaultButton) {
        event.preventDefault();
        setDefaultAccountAddress(state, String(accountSetAddressDefaultButton.getAttribute("data-account-set-address-default") || "").trim());
        return;
      }
      const accountRemoveAddressButton = target.closest("[data-account-remove-address]");
      if (accountRemoveAddressButton) {
        event.preventDefault();
        removeAccountAddress(state, String(accountRemoveAddressButton.getAttribute("data-account-remove-address") || "").trim());
        return;
      }
      const accountSavePaymentButton = target.closest("[data-account-save-payment]");
      if (accountSavePaymentButton) {
        event.preventDefault();
        saveManualAccountPayment(state);
        return;
      }
      const accountSaveHelpButton = target.closest("[data-account-save-help]");
      if (accountSaveHelpButton) {
        event.preventDefault();
        saveAccountHelpRequest(state);
        return;
      }
      const accountSetPaymentDefaultButton = target.closest("[data-account-set-payment-default]");
      if (accountSetPaymentDefaultButton) {
        event.preventDefault();
        setDefaultAccountPayment(state, String(accountSetPaymentDefaultButton.getAttribute("data-account-set-payment-default") || "").trim());
        return;
      }
      const accountRemovePaymentButton = target.closest("[data-account-remove-payment]");
      if (accountRemovePaymentButton) {
        event.preventDefault();
        removeAccountPayment(state, String(accountRemovePaymentButton.getAttribute("data-account-remove-payment") || "").trim());
        return;
      }
      const accountClearLocationButton = target.closest("[data-account-clear-location]");
      if (accountClearLocationButton) {
        event.preventDefault();
        clearAccountSavedLocation(state);
        return;
      }
      const buyerPasswordResetToggle = target.closest("[data-buyer-password-reset-toggle]");
      if (buyerPasswordResetToggle) {
        event.preventDefault();
        const resetToggleMode = String(buyerPasswordResetToggle.getAttribute("data-buyer-password-reset-toggle") || "").trim();
        state.buyerAuthDraft.createMode = false;
        state.buyerAuthDraft.createStep = "contact";
        state.buyerAuthDraft.resetMode = resetToggleMode !== "close";
        state.buyerAuthDraft.resetStep = "address";
        state.buyerAuthDraft.resetCode = "";
        state.buyerAuthDraft.resetPassword = "";
        state.buyerAuthDraft.verificationCode = "";
        state.buyerAuthDraft.status = "";
        state.buyerAuthDraft.tone = "";
        expandSignInPortal(state);
        renderShopList(state);
        resetPaneScroll(state);
        return;
      }
      const buyerCreateToggle = target.closest("[data-buyer-create-toggle]");
      if (buyerCreateToggle) {
        event.preventDefault();
        const createToggleMode = String(buyerCreateToggle.getAttribute("data-buyer-create-toggle") || "").trim();
        state.buyerAuthDraft.createMode = createToggleMode !== "close";
        state.buyerAuthDraft.createStep = "contact";
        state.buyerAuthDraft.password = "";
        state.buyerAuthDraft.resetMode = false;
        state.buyerAuthDraft.resetStep = "address";
        state.buyerAuthDraft.resetCode = "";
        state.buyerAuthDraft.resetPassword = "";
        state.buyerAuthDraft.verificationCode = "";
        state.buyerAuthDraft.status = "";
        state.buyerAuthDraft.tone = "";
        expandSignInPortal(state);
        renderShopList(state);
        resetPaneScroll(state);
        return;
      }
      const buyerCreateStepButton = target.closest("[data-buyer-create-step]");
      if (buyerCreateStepButton) {
        event.preventDefault();
        state.buyerAuthDraft.createMode = true;
        state.buyerAuthDraft.createStep = String(buyerCreateStepButton.getAttribute("data-buyer-create-step") || "").trim() === "password" ? "password" : "contact";
        state.buyerAuthDraft.password = "";
        if (state.buyerAuthDraft.createStep === "contact") {
          state.buyerAuthDraft.verificationCode = "";
        }
        state.buyerAuthDraft.status = "";
        state.buyerAuthDraft.tone = "";
        expandSignInPortal(state);
        renderShopList(state);
        resetPaneScroll(state);
        return;
      }
      const buyerCreateNextButton = target.closest("[data-buyer-create-next]");
      if (buyerCreateNextButton) {
        event.preventDefault();
        continueBuyerCreateAccount(state);
        return;
      }
      const buyerCreateVerifyButton = target.closest("[data-buyer-create-verify]");
      if (buyerCreateVerifyButton) {
        event.preventDefault();
        continueBuyerCreatePassword(state);
        return;
      }
      const buyerCreateResendButton = target.closest("[data-buyer-create-resend]");
      if (buyerCreateResendButton) {
        event.preventDefault();
        continueBuyerCreateAccount(state);
        return;
      }
      const buyerPasswordResetRequestButton = target.closest("[data-buyer-password-reset-request]");
      if (buyerPasswordResetRequestButton) {
        event.preventDefault();
        submitBuyerPasswordResetRequest(state);
        return;
      }
      const buyerPasswordResetSubmitButton = target.closest("[data-buyer-password-reset-submit]");
      if (buyerPasswordResetSubmitButton) {
        event.preventDefault();
        submitBuyerPasswordReset(state);
        return;
      }
      const buyerAccountSubmitButton = target.closest("[data-buyer-account-submit]");
      if (buyerAccountSubmitButton) {
        event.preventDefault();
        submitBuyerAccount(state, String(buyerAccountSubmitButton.getAttribute("data-buyer-account-submit") || "").trim());
        return;
      }
      const buyerAccountLogoutButton = target.closest("[data-buyer-account-logout]");
      if (buyerAccountLogoutButton) {
        event.preventDefault();
        signOutAccountSession(state);
        return;
      }
      const accountSignOutButton = target.closest("[data-account-signout]");
      if (accountSignOutButton) {
        event.preventDefault();
        signOutAccountSession(state);
        return;
      }
      const accountLogoutButton = target.closest("[data-account-logout]");
      if (accountLogoutButton) {
        event.preventDefault();
        signOutAccountSession(state);
        return;
      }
      const recentShopButton = target.closest("[data-open-recent-shop]");
      if (recentShopButton) {
        event.preventDefault();
        openShopInPane(state, String(recentShopButton.getAttribute("data-open-recent-shop") || "").trim());
        return;
      }
      const historyCartButton = target.closest("[data-open-cart-shop]");
      if (historyCartButton) {
        event.preventDefault();
        const historyCartShopId = String(historyCartButton.getAttribute("data-open-cart-shop") || "").trim();
        if (!historyCartShopId) return;
        openShopInPane(state, historyCartShopId);
        focusCart(state);
        return;
      }
      const externalActionLink = target.closest('a[href^="tel:"], a[href^="https://wa.me/"], a[href*="google.com/maps"]');
      if (externalActionLink) {
        return;
      }
      const cartStep = target.closest(".shop-cart-step, .shop-item-step, [data-cart-step][data-item-id]");
      if (cartStep) {
        event.preventDefault();
        const stepShopId = String(cartStep.getAttribute("data-cart-shop-id") || state.activeShopId || "").trim();
        let stepItemId = String(cartStep.getAttribute("data-item-id") || "").trim();
        const stepLibraryItem = findLibraryItem(state, stepShopId, stepItemId);
        if (stepLibraryItem) {
          stepItemId = ensureShopDetailItemFromLibrary(state, stepLibraryItem) || stepItemId;
        }
        addToCart(
          state,
          stepShopId,
          stepItemId,
          Number(cartStep.getAttribute("data-cart-step") || 0)
        );
        return;
      }
      const rootAddItemButton = target.closest("[data-root-add-item]");
      if (rootAddItemButton) {
        event.preventDefault();
        const rootAddShopId = String(rootAddItemButton.getAttribute("data-root-add-shop") || "").trim();
        let rootAddItemId = String(rootAddItemButton.getAttribute("data-root-add-item") || "").trim();
        const rootLibraryItem = findLibraryItem(state, rootAddShopId, rootAddItemId);
        if (rootLibraryItem) {
          rootAddItemId = ensureShopDetailItemFromLibrary(state, rootLibraryItem) || rootAddItemId;
        }
        if (!rootAddShopId || !rootAddItemId) return;
        addToCart(state, rootAddShopId, rootAddItemId, 1);
        return;
      }
      const openShopCardButton = target.closest("[data-open-shop-card]");
      if (openShopCardButton) {
        event.preventDefault();
        openShopInPane(state, String(openShopCardButton.getAttribute("data-open-shop-card") || "").trim());
        return;
      }
      const paneAddItem = target.closest("[data-pane-add-item]");
      if (paneAddItem) {
        event.preventDefault();
        if (!state.activeShopId || isOwnerViewingShop(state)) return;
        addToCart(
          state,
          state.activeShopId,
          String(paneAddItem.getAttribute("data-pane-add-item") || "").trim(),
          1
        );
        return;
      }
      const copyButton = target.closest(".shop-pay-copy");
      if (copyButton) {
        event.preventDefault();
        const value = String(copyButton.getAttribute("data-pay-copy") || "").trim();
        if (!value) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(value).then(function () {
            const original = copyButton.textContent;
            copyButton.textContent = "Copied";
            window.setTimeout(function () {
              copyButton.textContent = original;
            }, 900);
          }).catch(function () {});
        }
        return;
      }
      const paySelect = target.closest("[data-pay-select]");
      if (paySelect) {
        event.preventDefault();
        if (!state.activeShopId) return;
        setSelectedPaymentIndex(state, state.activeShopId, Number(paySelect.getAttribute("data-pay-select")));
        renderShopList(state);
        resetPaneScroll(state);
        return;
      }
      const paymentModeSelect = target.closest("[data-payment-mode]");
      if (paymentModeSelect) {
        event.preventDefault();
        if (!state.activeShopId) return;
        setSelectedPaymentMode(state, state.activeShopId, String(paymentModeSelect.getAttribute("data-payment-mode") || "").trim());
        renderShopList(state);
        resetPaneScroll(state);
        return;
      }
      const fulfillmentModeSelect = target.closest("[data-fulfillment-mode]");
      if (fulfillmentModeSelect) {
        event.preventDefault();
        if (!state.activeShopId) return;
        setSelectedFulfillmentMode(state, state.activeShopId, String(fulfillmentModeSelect.getAttribute("data-fulfillment-mode") || "").trim());
        renderShopList(state);
        resetPaneScroll(state);
        return;
      }
      const openCartButton = target.closest("[data-open-cart]");
      if (openCartButton) {
        event.preventDefault();
        if (state.activeShopId && !buyerHasSignedIn(state)) {
          const openCartDetail = state.shopDetails[state.activeShopId] || shopDetailFromPreview(state.shopById[state.activeShopId]);
          if (openCartDetail && cartItems(openCartDetail, getShopCart(state, state.activeShopId)).length) {
            openCheckoutSignIn(state, state.activeShopId);
            return;
          }
        }
        focusCart(state);
        return;
      }
      const confirmItemsButton = target.closest("[data-confirm-items]");
      if (confirmItemsButton) {
        event.preventDefault();
        focusItems(state);
        return;
      }
      const confirmPayNowButton = target.closest("[data-confirm-pay-now]");
      if (confirmPayNowButton) {
        event.preventDefault();
        const confirmationState = orderConfirmation(state, state.activeShopId);
        if (!confirmationState || !confirmationState.paymentHref) return;
        triggerPaymentHref(confirmationState.paymentHref);
        return;
      }
      const payButton = target.closest(".shop-cart-pay");
      if (payButton) {
        event.preventDefault();
        if (!state.activeShopId || state.activeShopView !== "cart") {
          if (state.activeShopId && !buyerHasSignedIn(state)) {
            const checkoutDetail = state.shopDetails[state.activeShopId] || shopDetailFromPreview(state.shopById[state.activeShopId]);
            if (checkoutDetail && cartItems(checkoutDetail, getShopCart(state, state.activeShopId)).length) {
              openCheckoutSignIn(state, state.activeShopId);
              return;
            }
          }
          focusCart(state);
          return;
        }
        const detail = state.shopDetails[state.activeShopId] || shopDetailFromPreview(state.shopById[state.activeShopId]);
        if (!detail) return;
        const cartItemsNow = cartItems(detail, getShopCart(state, state.activeShopId));
        if (!cartItemsNow.length) return;
        const totalAmountNow = cartItemsNow.reduce(function (sum, item) {
          return sum + item.total;
        }, 0);
        if (!buyerHasSignedIn(state)) {
          openCheckoutSignIn(state, state.activeShopId);
          return;
        }
        const chosenFulfillmentMode = selectedFulfillmentMode(state, state.activeShopId);
        const missingCheckoutFields = missingBuyerCheckoutFields(state, chosenFulfillmentMode);
        if (missingCheckoutFields.length) {
          setCheckoutNotice(state, state.activeShopId, {
            tone: "error",
            message: checkoutMissingMessage(missingCheckoutFields)
          });
          renderShopList(state);
          resetPaneScroll(state);
          return;
        }
        const paymentEntries = payablePaymentEntries(detail, totalAmountNow);
        const chosenPaymentMode = effectivePaymentMode(state, state.activeShopId, paymentEntries);
        if (chosenPaymentMode === "before_delivery" && !isPaymentPickerOpen(state, state.activeShopId)) {
          setPaymentPickerOpen(state, state.activeShopId, true);
          setCheckoutNotice(state, state.activeShopId, null);
          renderShopList(state);
          resetPaneScroll(state);
          return;
        }
        const paymentIndex = selectedPaymentIndex(state, state.activeShopId, paymentEntries);
        const chosenPaymentNow = paymentIndex >= 0 ? paymentEntries[paymentIndex] : null;
        if (chosenPaymentMode === "before_delivery" && !chosenPaymentNow) {
          setCheckoutNotice(state, state.activeShopId, {
            tone: "error",
            message: "Select a payment method first."
          });
          setPaymentPickerOpen(state, state.activeShopId, true);
          renderShopList(state);
          resetPaneScroll(state);
          return;
        }
        if (chosenPaymentMode === "before_delivery" && !canUsePaymentEntry(chosenPaymentNow, detail, totalAmountNow)) {
          setCheckoutNotice(state, state.activeShopId, {
            tone: "error",
            message: "This payment method is not ready. Choose another one."
          });
          setPaymentPickerOpen(state, state.activeShopId, true);
          renderShopList(state);
          resetPaneScroll(state);
          return;
        }
        const orderPayload = buildOrderPayload(state, detail, chosenPaymentNow, cartItemsNow, totalAmountNow, chosenPaymentMode, chosenFulfillmentMode);
        payButton.disabled = true;
        createShopOrder(state.activeShopId, orderPayload)
          .then(function (result) {
            if (!result || !result.ok) {
              throw new Error(String(result && result.payload && result.payload.error || "order_create_failed"));
            }
            const createdOrder = result.payload && result.payload.order || orderPayload;
            if (result.payload && result.payload.buyer_key) {
              try {
                window.localStorage.setItem("hashop_buyer_key", String(result.payload.buyer_key || "").trim());
              } catch (error) {}
            }
            rememberBuyerOrder(
              state,
              createdOrder,
              state.activeShopId
            );
            state.cartByShop[state.activeShopId] = {};
            setCheckoutNotice(
              state,
              state.activeShopId,
              {
                tone: "success",
                message: chosenPaymentMode === "before_delivery"
                  ? ("Order started. Finish payment on " + (chosenPaymentNow.label || "the selected method") + ".")
                  : (chosenFulfillmentMode === "pickup"
                    ? "Order placed. Use the map for pickup."
                    : "Order placed. The shop will use your delivery address.")
              }
            );
            setOrderConfirmation(state, state.activeShopId, {
              order: createdOrder,
              paymentMode: chosenPaymentMode,
              fulfillmentMode: chosenFulfillmentMode,
              paymentLabel: String(chosenPaymentNow && chosenPaymentNow.label || "").trim(),
              paymentQrFile: chosenPaymentMode === "before_delivery" ? paymentQrFile(chosenPaymentNow) : "",
              paymentHref: chosenPaymentMode === "before_delivery"
                ? buildPaymentHref(chosenPaymentNow, detail, totalAmountNow)
                : ""
            });
            state.activeShopView = "confirmation";
            syncPaneUrl(state);
            renderShopList(state);
            if (chosenFulfillmentMode === "pickup") {
              window.setTimeout(function () {
                focusOrderCueOnMap(state, createdOrder, detail, "buyer");
              }, 80);
            }
            updateSearchField(state);
            syncActionButton(state);
            syncBackButton(state);
            resetPaneScroll(state);
            refreshBuyerOrders(state, {
              force: true,
              silent: true
            });
          })
          .catch(function () {
            payButton.disabled = false;
            window.alert("Could not start this order.");
          });
        return;
      }
      const ownerSettingsSectionButton = target.closest("[data-owner-settings-section]");
      if (ownerSettingsSectionButton) {
        event.preventDefault();
        openOwnerSettingsPane(state, {
          section: String(ownerSettingsSectionButton.getAttribute("data-owner-settings-section") || "").trim()
        });
        return;
      }
      const ownerHistorySectionButton = target.closest("[data-owner-history-section]");
      if (ownerHistorySectionButton) {
        event.preventDefault();
        openOwnerHistoryPane(state, {
          shopId: state.activeShopId,
          section: String(ownerHistorySectionButton.getAttribute("data-owner-history-section") || "").trim()
        });
        return;
      }
      const ownerAddToggle = target.closest("[data-owner-add-toggle]");
      if (ownerAddToggle) {
        event.preventDefault();
        if (!state.activeShopId || !isOwnerViewingShop(state)) return;
        toggleOwnerAddMenu(state);
        return;
      }
      const ownerAddAction = target.closest("[data-owner-add-action]");
      if (ownerAddAction) {
        event.preventDefault();
        if (!state.activeShopId || !isOwnerViewingShop(state)) return;
        const addAction = String(ownerAddAction.getAttribute("data-owner-add-action") || "").trim();
        closeOwnerAddMenu(state);
        if (addAction === "item") {
          openOwnerHistoryPane(state, {
            shopId: state.activeShopId,
            section: "items",
            force: true
          });
          return;
        }
        if (addAction === "order") {
          openOwnerHistoryPane(state, {
            shopId: state.activeShopId,
            section: "orders",
            force: true,
            openDraft: true
          });
          return;
        }
        if (addAction === "photo") {
          openOwnerSettingsPane(state, {
            section: "profile"
          });
          return;
        }
      }
      const ownerMainStartOrderButton = target.closest("[data-owner-main-start-order]");
      if (ownerMainStartOrderButton) {
        event.preventDefault();
        openOwnerHistoryPane(state, {
          shopId: state.activeShopId,
          section: "orders",
          force: true,
          openDraft: true
        });
        return;
      }
      const ownerMainManageButton = target.closest("[data-owner-main-manage]");
      if (ownerMainManageButton) {
        event.preventDefault();
        if (state.ownerPanel && state.ownerPanel.tab === "settings") {
          closeOwnerOverlayToItems(state);
          return;
        }
        openOwnerSettingsPane(state, {
          section: "profile"
        });
        return;
      }
      const ownerMainHistoryButton = target.closest("[data-owner-main-open-history]");
      if (ownerMainHistoryButton) {
        event.preventDefault();
        openOwnerHistoryPane(state, {
          shopId: state.activeShopId,
          section: String(ownerMainHistoryButton.getAttribute("data-owner-main-open-history") || "").trim() || "orders",
          force: true
        });
        return;
      }
      const ownerWalkinToggle = target.closest("[data-owner-walkin-toggle]");
      if (ownerWalkinToggle) {
        event.preventDefault();
        if (!state.activeShopId || !state.ownerPanel) return;
        state.ownerPanel.orderDraftOpen = !state.ownerPanel.orderDraftOpen;
        state.ownerPanel.tab = "history";
        state.ownerPanel.section = "orders";
        renderShopList(state);
        resetPaneScroll(state);
        return;
      }
      const ownerOrderPaymentButton = target.closest("[data-owner-order-payment]");
      if (ownerOrderPaymentButton) {
        event.preventDefault();
        if (!state.activeShopId) return;
        setOwnerOrderDraftField(
          state,
          state.activeShopId,
          "paymentMode",
          String(ownerOrderPaymentButton.getAttribute("data-owner-order-payment") || "").trim()
        );
        renderShopList(state);
        resetPaneScroll(state);
        return;
      }
      const ownerDraftStepButton = target.closest("[data-owner-draft-step]");
      if (ownerDraftStepButton) {
        event.preventDefault();
        if (!state.activeShopId) return;
        stepOwnerOrderDraftItem(
          state,
          state.activeShopId,
          String(ownerDraftStepButton.getAttribute("data-item-id") || "").trim(),
          Number(ownerDraftStepButton.getAttribute("data-owner-draft-step") || 0)
        );
        renderShopList(state);
        return;
      }
      const ownerWalkinSubmit = target.closest("[data-owner-walkin-submit]");
      if (ownerWalkinSubmit) {
        event.preventDefault();
        submitOwnerWalkInOrder(state);
        return;
      }
      const ownerLibraryImport = target.closest("[data-owner-library-import]");
      if (ownerLibraryImport) {
        event.preventDefault();
        importOwnerLibraryItem(state, String(ownerLibraryImport.getAttribute("data-owner-library-import") || "").trim());
        return;
      }
      const ownerSave = target.closest("[data-owner-save]");
      if (ownerSave) {
        event.preventDefault();
        const mode = String(ownerSave.getAttribute("data-owner-save") || "").trim();
        const form = ownerSave.closest("form");
        if (mode === "profile") {
          submitOwnerProfile(state, form);
          return;
        }
        if (mode === "item") {
          submitOwnerItem(state, ownerSave.closest('[data-owner-form="item"]') || form);
          return;
        }
        if (mode === "payments") {
          submitOwnerPayments(state, form);
          return;
        }
      }
      const ownerItemSave = target.closest("[data-owner-item-save]");
      if (ownerItemSave) {
        event.preventDefault();
        const ownerItemId = String(ownerItemSave.getAttribute("data-owner-item-save") || "").trim();
        const ownerItemCard = ownerItemSave.closest("[data-owner-item-id]");
        submitOwnerItemUpdate(state, ownerItemId, ownerItemCard);
        return;
      }
      const ownerItemSelect = target.closest("[data-owner-item-select]");
      if (ownerItemSelect) {
        event.preventDefault();
        state.ownerPanel.itemId = String(ownerItemSelect.getAttribute("data-owner-item-select") || "").trim();
        state.ownerPanel.tab = "history";
        state.ownerPanel.section = "items";
        renderShopList(state);
        resetPaneScroll(state);
        return;
      }
      const ownerItemRemove = target.closest("[data-owner-item-remove]");
      if (ownerItemRemove) {
        event.preventDefault();
        const removeId = String(ownerItemRemove.getAttribute("data-owner-item-remove") || "").trim();
        submitOwnerItemRemove(state, removeId);
        return;
      }
      const ownerOrderMapCue = target.closest("[data-owner-order-map-cue]");
      if (ownerOrderMapCue) {
        event.preventDefault();
        if (!state.activeShopId) return;
        const cueOrderId = String(ownerOrderMapCue.getAttribute("data-owner-order-map-cue") || "").trim();
        const consoleData = ensureShopConsole(state, state.activeShopId);
        const orders = Array.isArray(consoleData && consoleData.orders) ? consoleData.orders : [];
        const cueOrder = orders.find(function (order) {
          return String(order && order.id || "").trim() === cueOrderId;
        });
        const detail = state.shopDetails[state.activeShopId] || shopDetailFromPreview(state.shopById[state.activeShopId]);
        if (focusOrderCueOnMap(state, cueOrder, detail, "seller")) {
          setCheckoutNotice(state, state.activeShopId, { tone: "success", message: "Delivery cue on map." });
          renderShopList(state);
        }
        return;
      }
      const ownerOrderAction = target.closest("[data-owner-order-action]");
      if (ownerOrderAction) {
        event.preventDefault();
        submitOwnerOrderAction(
          state,
          String(ownerOrderAction.getAttribute("data-owner-order-action") || "").trim(),
          String(ownerOrderAction.getAttribute("data-next-status") || "").trim()
        );
        return;
      }
      const ownerLogout = target.closest("[data-owner-logout]");
      if (ownerLogout) {
        event.preventDefault();
        logoutOwnerSession(state);
        return;
      }
      const pickupMapButton = target.closest("[data-pickup-use-map]");
      if (pickupMapButton) {
        event.preventDefault();
        const profileForm = pickupMapButton.closest('form[data-owner-form="profile"]');
        if (!(profileForm instanceof HTMLFormElement)) return;
        if (state.map) {
          const center = state.map.getCenter();
          setOwnerPickupPoint(state, profileForm, center.lat, center.lng);
        }
        return;
      }
      const pickupMeButton = target.closest("[data-pickup-use-me]");
      if (pickupMeButton) {
        event.preventDefault();
        const ownerForm = pickupMeButton.closest('form[data-owner-form="profile"]');
        if (!(ownerForm instanceof HTMLFormElement)) return;
        if (state.userPoint && isFinite(state.userPoint[0]) && isFinite(state.userPoint[1])) {
          setOwnerPickupPoint(state, ownerForm, state.userPoint[0], state.userPoint[1]);
          return;
        }
        if (!navigator.geolocation) {
          state.ownerPanel.message = "Location is unavailable.";
          state.ownerPanel.tone = "error";
          renderShopList(state);
          return;
        }
        navigator.geolocation.getCurrentPosition(function (position) {
          const lat = position && position.coords ? position.coords.latitude : null;
          const lng = position && position.coords ? position.coords.longitude : null;
          const accuracy = position && position.coords ? position.coords.accuracy : 0;
          if (!isFinite(lat) || !isFinite(lng)) return;
          upsertUserMarker(state, lat, lng, accuracy);
          setOwnerPickupPoint(state, ownerForm, lat, lng);
          renderShopList(state);
        }, function () {
          state.ownerPanel.message = "Allow location to use your spot.";
          state.ownerPanel.tone = "error";
          renderShopList(state);
        }, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
        return;
      }
      const paymentQrInput = target.closest("[data-owner-payment-qr-input]");
      if (paymentQrInput) {
        const qrFile = target.files && target.files[0];
        if (!qrFile || !state.activeShopId) return;
        state.ownerPanel.message = "Uploading payment QR...";
        state.ownerPanel.tone = "";
        renderShopList(state);
        uploadOwnerPaymentQr(state.activeShopId, qrFile)
          .then(function (result) {
            if (!result || !result.ok) {
              throw new Error(String(result && result.payload && result.payload.error || "payment_qr_upload_failed"));
            }
            applyConsoleRecord(state, state.activeShopId, result.payload);
            state.ownerPanel.message = "Payment QR updated.";
            state.ownerPanel.tone = "success";
            renderShopList(state);
          })
          .catch(function () {
            state.ownerPanel.message = "Could not upload the QR.";
            state.ownerPanel.tone = "error";
            renderShopList(state);
          });
        return;
      }
    });
  }

  if (state.mapNode) {
    state.mapNode.addEventListener("click", function (event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const popupLink = target.closest(".map-popup");
      if (!popupLink) return;
      event.preventDefault();
      openShopInPane(state, String(popupLink.getAttribute("data-shop-id") || "").trim());
    });
  }

  window.addEventListener("resize", function () {
    if (!state.map) return;
    stabilizeMapViewport(state, 40);
  });

  window.addEventListener("load", function () {
    stabilizeMapViewport(state, 0);
    stabilizeMapViewport(state, 180);
  });
}());
