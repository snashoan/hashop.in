(function () {
  var DEBUG_PAGE = String(window.__HASHOP_DEBUG_PAGE__ || "").trim();
  var INITIAL_PANE = (function () {
    try {
      return String(new URLSearchParams(window.location.search).get("pane") || "").trim().toLowerCase();
    } catch (error) {
      return "";
    }
  }());
  var DEFAULT_DISCOVERY_CENTER = [12.9716, 77.5946];
  var DEFAULT_DISCOVERY_ZOOM = 14;
  var LOCATE_REVEAL_DELAY_MS = 900;

  function loadBootstrap() {
    try {
      var node = document.getElementById("bootstrapData");
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
    var text = String(value || "").replace(/\s+/g, " ").trim();
    var limit = Number(maxLength || 0);
    if (!text || !Number.isFinite(limit) || limit < 1 || text.length <= limit) {
      return text;
    }
    return text.slice(0, Math.max(1, limit - 1)).trimEnd() + "…";
  }

  function shopUrl(shop) {
    var publicUrl = String(shop && shop.public_url || "").trim();
    if (publicUrl) return publicUrl;
    var shopId = String(shop && shop.shop_id || "").trim();
    return "/shop/" + encodeURIComponent(shopId) + "/";
  }

  function shopColor(shop) {
    var color = String(shop && shop.map_color || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#29c6ea";
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
    var rad = Math.PI / 180;
    var earthRadius = 6371000;
    var latDelta = (toLat - fromLat) * rad;
    var lngDelta = (toLng - fromLng) * rad;
    var a =
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
    var distance = shopDistanceMeters(shop, userPoint);
    if (distance != null) return formatDistance(distance);
    return shop && shop.has_location ? "On map" : "Location pending";
  }

  function orderedShops(shops, userPoint) {
    return shops.slice().sort(function (left, right) {
      var leftDistance = shopDistanceMeters(left, userPoint);
      var rightDistance = shopDistanceMeters(right, userPoint);
      var leftLocated = leftDistance != null;
      var rightLocated = rightDistance != null;
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
    if (!pricing || typeof pricing !== "object") return null;
    return {
      prefix: String(pricing.prefix || "").trim(),
      suffix: String(pricing.suffix || "").trim(),
      decimals: Number.isFinite(Number(pricing.decimals)) ? Math.max(0, Number(pricing.decimals)) : null
    };
  }

  function formatPrice(value, pricing) {
    var text = String(value == null ? "" : value).trim();
    if (!text) return "";
    if (pricing && /^[-+]?[0-9]+(?:\.[0-9]+)?$/.test(text)) {
      return String(pricing.prefix || "") + text + String(pricing.suffix || "");
    }
    return text;
  }

  function formatTotalAmount(value, pricing) {
    var number = Number(value || 0);
    if (!isFinite(number) || number <= 0) return "";
    var decimals = pricing && pricing.decimals != null
      ? pricing.decimals
      : (Math.abs(number - Math.round(number)) < 0.0001 ? 0 : 2);
    var text = decimals === 0
      ? String(Math.round(number))
      : number.toFixed(decimals).replace(/\.?0+$/, "");
    return String(pricing && pricing.prefix || "") + text + String(pricing && pricing.suffix || "");
  }

  function pricingCurrencyCode(pricing) {
    var prefix = String(pricing && pricing.prefix || "").trim().toLowerCase();
    var suffix = String(pricing && pricing.suffix || "").trim().toLowerCase();
    var combined = (prefix + " " + suffix).trim();
    if (!combined) return "";
    if (combined.indexOf("₹") !== -1 || combined.indexOf("rs") !== -1 || combined.indexOf("inr") !== -1) return "INR";
    if (combined.indexOf("$") !== -1 || combined.indexOf("usd") !== -1) return "USD";
    if (combined.indexOf("€") !== -1 || combined.indexOf("eur") !== -1) return "EUR";
    if (combined.indexOf("btc") !== -1) return "BTC";
    if (combined.indexOf("eth") !== -1) return "ETH";
    return "";
  }

  function priceNumber(value) {
    var text = String(value == null ? "" : value).trim();
    if (!text) return 0;
    var cleaned = text.replace(/[^0-9.]/g, "");
    var number = Number(cleaned);
    return isFinite(number) ? number : 0;
  }

  function syncPaneUrl(state) {
    if (!window.history || typeof window.history.replaceState !== "function") return;
    try {
      var url = new URL(window.location.href);
      if (state && state.debugPaneView === "login") {
        url.searchParams.set("pane", "login");
      } else if (state && state.debugPaneView === "account") {
        url.searchParams.set("pane", "account");
      } else if (state && state.debugPaneView === "recent-orders") {
        url.searchParams.set("pane", "orders");
      } else {
        url.searchParams.delete("pane");
      }
      var next = url.pathname + (url.search ? url.search : "") + url.hash;
      var current = window.location.pathname + window.location.search + window.location.hash;
      if (next !== current) {
        window.history.replaceState({}, "", next);
      }
    } catch (error) {}
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function parseJson(response) {
    return response.json().catch(function () {
      return {};
    });
  }

  function normalizeOwnerShops(value) {
    if (!Array.isArray(value)) return [];
    var seen = {};
    return value.reduce(function (result, item) {
      if (!item || typeof item !== "object") return result;
      var shopId = slugify(String(item.shopId || item.id || item.shop_id || "").trim()).slice(0, 64);
      var shopName = String(item.shopName || item.name || item.display_name || shopId).trim().slice(0, 160);
      if (!shopId || seen[shopId]) return result;
      seen[shopId] = true;
      result.push({
        shopId: shopId,
        shopName: shopName || shopId
      });
      return result;
    }, []);
  }

  function normalizeAccountRoles(value, ownerShops) {
    var seen = {};
    var roles = [];
    if (Array.isArray(value)) {
      value.forEach(function (item) {
        var role = String(item || "").trim().toLowerCase();
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

  function normalizeAccountSession(raw) {
    var source = raw && typeof raw === "object" ? raw : {};
    var ownerShops = normalizeOwnerShops(source.ownerShops || source.shops);
    var roles = normalizeAccountRoles(source.roles, ownerShops);
    var displayName = String(source.displayName || source.name || "").trim().slice(0, 160);
    var preferredOwnerShopId = slugify(String(source.preferredOwnerShopId || source.ownerShopId || "").trim()).slice(0, 64);
    if (preferredOwnerShopId && !ownerShops.some(function (shop) {
      return shop.shopId === preferredOwnerShopId;
    })) {
      preferredOwnerShopId = "";
    }
    if (!displayName && ownerShops.length === 1) {
      displayName = String(ownerShops[0].shopName || ownerShops[0].shopId).trim().slice(0, 160);
    }
    if (!roles.length && !ownerShops.length && !displayName) {
      return null;
    }
    return {
      displayName: displayName,
      roles: roles,
      ownerShops: ownerShops,
      preferredOwnerShopId: preferredOwnerShopId
    };
  }

  function accountOwnerShops(session) {
    return session && Array.isArray(session.ownerShops) ? session.ownerShops.slice() : [];
  }

  function accountHasRole(session, role) {
    var safeRole = String(role || "").trim().toLowerCase();
    if (!safeRole || !session || !Array.isArray(session.roles)) return false;
    return session.roles.indexOf(safeRole) !== -1;
  }

  function preferredOwnerShop(session, fallbackShopId) {
    var ownerShops = accountOwnerShops(session);
    if (!ownerShops.length) return null;
    var preferredShopId = slugify(String(fallbackShopId || session.preferredOwnerShopId || "").trim()).slice(0, 64);
    if (preferredShopId) {
      var matched = ownerShops.find(function (shop) {
        return shop.shopId === preferredShopId;
      }) || null;
      if (matched) return matched;
    }
    return ownerShops[0];
  }

  function preferredOwnerShopId(session, fallbackShopId) {
    var shop = preferredOwnerShop(session, fallbackShopId);
    return shop ? String(shop.shopId || "").trim() : "";
  }

  function preferredOwnerShopName(session, fallbackShopId) {
    var shop = preferredOwnerShop(session, fallbackShopId);
    return shop ? String(shop.shopName || shop.shopId || "").trim() : "";
  }

  function syncLegacyOwnerIdentity(session) {
    try {
      var shop = preferredOwnerShop(session);
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
    var parsed = null;
    try {
      var raw = window.localStorage.getItem("hashop_account_session") || "";
      if (raw) parsed = JSON.parse(raw);
    } catch (error) {}
    var normalized = normalizeAccountSession(parsed);
    if (normalized) return normalized;
    var legacyShopId = "";
    var legacyShopName = "";
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
    var normalized = normalizeAccountSession(session);
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
    var normalized = saveAccountSession(session || null);
    if (state) {
      state.accountSession = normalized;
      state.ownerShopId = preferredOwnerShopId(normalized, state.ownerShopId);
    }
    return normalized;
  }

  function pruneAccountSessionToKnownShops(state) {
    if (!state || !state.accountSession || !state.shopById) return state ? state.accountSession : null;
    var knownShopIds = Object.keys(state.shopById);
    if (!knownShopIds.length) return state.accountSession;
    var session = state.accountSession;
    var ownerShops = accountOwnerShops(session);
    var filteredOwnerShops = ownerShops.filter(function (shop) {
      var shopId = String(shop && shop.shopId || "").trim();
      return !!shopId && knownShopIds.indexOf(shopId) !== -1;
    });
    if (filteredOwnerShops.length === ownerShops.length) {
      return session;
    }
    if (!filteredOwnerShops.length) {
      return setAccountSession(state, null);
    }
    return setAccountSession(state, {
      displayName: session.displayName,
      roles: session.roles,
      ownerShops: filteredOwnerShops,
      preferredOwnerShopId: preferredOwnerShopId({
        ownerShops: filteredOwnerShops,
        preferredOwnerShopId: session.preferredOwnerShopId
      })
    });
  }

  function saveShopIdentity(shopName, shopId) {
    var safeShopId = slugify(String(shopId || "").trim()).slice(0, 64);
    if (!safeShopId) return loadAccountSession();
    var current = loadAccountSession() || {};
    var ownerShops = normalizeOwnerShops([{
      shopId: safeShopId,
      shopName: String(shopName || safeShopId).trim()
    }].concat(current.ownerShops || []));
    return saveAccountSession({
      displayName: String(current.displayName || shopName || safeShopId).trim(),
      roles: normalizeAccountRoles((current.roles || []).concat(["owner"]), ownerShops),
      ownerShops: ownerShops,
      preferredOwnerShopId: safeShopId
    });
  }

  function clearShopIdentity() {
    saveAccountSession(null);
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
    var key = String(loadBuyerKey() || "").trim();
    if (key) return key;
    key = generateBuyerKey();
    try {
      window.localStorage.setItem("hashop_buyer_key", key);
    } catch (error) {}
    return key;
  }

  function normalizeBuyerRecentRefs(value) {
    if (!Array.isArray(value)) return [];
    var seen = {};
    return value.reduce(function (result, item) {
      if (!item || typeof item !== "object") return result;
      var orderId = String(item.orderId || item.id || "").trim().slice(0, 64);
      var shopId = String(item.shopId || "").trim().slice(0, 64);
      var timestamp = Number(item.timestamp || 0);
      if (!orderId || !shopId) return result;
      var key = shopId + ":" + orderId;
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
    var source = raw && typeof raw === "object" ? raw : {};
    return {
      buyerKey: String(buyerKey || source.buyerKey || "").trim().slice(0, 160),
      name: String(source.name || "").trim().slice(0, 160),
      contact: String(source.contact || "").trim().slice(0, 255),
      recentOrderRefs: normalizeBuyerRecentRefs(source.recentOrderRefs)
    };
  }

  function loadBuyerProfile() {
    var parsed = {};
    try {
      var raw = window.localStorage.getItem("hashop_buyer_profile") || "";
      if (raw) parsed = JSON.parse(raw);
    } catch (error) {}
    return normalizeBuyerProfile(parsed, ensureBuyerKey());
  }

  function saveBuyerProfile(profile) {
    var normalized = normalizeBuyerProfile(profile, ensureBuyerKey());
    try {
      window.localStorage.setItem("hashop_buyer_profile", JSON.stringify(normalized));
    } catch (error) {}
    return normalized;
  }

  function setBuyerProfile(state, profile) {
    if (!state) return null;
    state.buyerProfile = saveBuyerProfile(profile || {});
    return state.buyerProfile;
  }

  function mergeBuyerProfile(state, patch) {
    if (!state) return null;
    var current = state.buyerProfile && typeof state.buyerProfile === "object"
      ? state.buyerProfile
      : loadBuyerProfile();
    return setBuyerProfile(state, Object.assign({}, current, patch || {}));
  }

  function recentBuyerOrderCount(state) {
    if (!state) return 0;
    if (Array.isArray(state.buyerOrders) && state.buyerOrders.length) {
      return state.buyerOrders.length;
    }
    var refs = state.buyerProfile && Array.isArray(state.buyerProfile.recentOrderRefs)
      ? state.buyerProfile.recentOrderRefs
      : [];
    return refs.length;
  }

  function buyerHistorySummaryLabel(cartCount, orderCount) {
    var safeCartCount = Math.max(0, Number(cartCount || 0) || 0);
    var safeOrderCount = Math.max(0, Number(orderCount || 0) || 0);
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

  function ownerOrdersNavShopId(state) {
    if (!state) return "";
    if (isOwnerViewingShop(state)) {
      return String(state.activeShopId || "").trim();
    }
    return String(preferredOwnerShopId(state.accountSession, state.ownerShopId) || "").trim();
  }

  function ownerPendingOrdersNavCount(state) {
    if (!state) return 0;
    var shopId = ownerOrdersNavShopId(state);
    if (!shopId) return 0;
    var consoleData = state.shopConsoles && state.shopConsoles[shopId];
    var orders = Array.isArray(consoleData && consoleData.orders) ? consoleData.orders : [];
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
    var section = String(value || "").trim().toLowerCase();
    return section === "payments" ? "payments" : "profile";
  }

  function normalizeOwnerHistorySection(value) {
    var section = String(value || "").trim().toLowerCase();
    if (section === "items" || section === "stats") return section;
    return "orders";
  }

  function shouldUseOwnerOrdersNav(state) {
    if (!state) return false;
    var shopId = ownerOrdersNavShopId(state);
    if (!shopId) return false;
    if (isOwnerViewingShop(state)) return true;
    return !state.activeShopId && state.debugPaneView !== "login" && state.debugPaneView !== "recent-orders";
  }

  function orderedOwnerOrders(orders) {
    if (!Array.isArray(orders)) return [];
    function priority(order) {
      var status = normalizedOrderStatus(order);
      if (status === "created" || status === "payment_pending") return 0;
      if (status === "accepted" || status === "ready" || status === "paid") return 1;
      if (status === "completed" || status === "cancelled") return 2;
      return 1;
    }
    return orders.slice().sort(function (left, right) {
      var priorityDelta = priority(left) - priority(right);
      if (priorityDelta) return priorityDelta;
      var timestampDelta = Number(right && right.timestamp || 0) - Number(left && left.timestamp || 0);
      if (timestampDelta) return timestampDelta;
      return String(right && right.id || "").localeCompare(String(left && left.id || ""));
    });
  }

  function rememberBuyerOrder(state, order, shopId) {
    if (!state || !order) return null;
    var current = state.buyerProfile && typeof state.buyerProfile === "object"
      ? state.buyerProfile
      : loadBuyerProfile();
    var nextRefs = normalizeBuyerRecentRefs([{
      orderId: String(order.id || "").trim(),
      shopId: String(shopId || order.shopId || "").trim(),
      timestamp: Number(order.timestamp || Date.now())
    }].concat(current.recentOrderRefs || []));
    return setBuyerProfile(state, {
      buyerKey: ensureBuyerKey(),
      name: String(order.buyerName || current.name || "").trim(),
      contact: String(order.buyerContact || current.contact || "").trim(),
      recentOrderRefs: nextRefs
    });
  }

  function orderAmountValue(order) {
    if (!order || typeof order !== "object") return 0;
    var total = priceNumber(order.total);
    if (total > 0) return total;
    var price = priceNumber(order.price);
    var quantity = Math.max(0, Number(order.quantity || 0));
    if (price > 0 && quantity > 0) return price * quantity;
    var items = Array.isArray(order.items) ? order.items : [];
    return items.reduce(function (sum, item) {
      return sum + (priceNumber(item && item.price) * Math.max(0, Number(item && item.quantity || 0)));
    }, 0);
  }

  function ownerSalesStats(orders) {
    var list = Array.isArray(orders) ? orders : [];
    var dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    return list.reduce(function (stats, order) {
      var status = normalizedOrderStatus(order);
      var timestamp = Number(order && order.timestamp || 0);
      var amount = orderAmountValue(order);
      stats.totalOrders += 1;
      if (status === "created" || status === "payment_pending") stats.pendingOrders += 1;
      if (status === "accepted") stats.acceptedOrders += 1;
      if (status === "ready") stats.readyOrders += 1;
      if (status === "paid" || status === "completed") {
        stats.settledOrders += 1;
        stats.revenue += amount;
      }
      if (timestamp >= dayStart.getTime()) {
        stats.todayOrders += 1;
      }
      return stats;
    }, {
      totalOrders: 0,
      pendingOrders: 0,
      acceptedOrders: 0,
      readyOrders: 0,
      settledOrders: 0,
      todayOrders: 0,
      revenue: 0
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
    var draft = ownerOrderDraft(state, shopId);
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
    var draft = ownerOrderDraft(state, shopId);
    var nextCount = Math.max(0, Number(draft.items && draft.items[itemId] || 0) + Number(delta || 0));
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

  function refreshItemLibrary(state, options) {
    if (!state) return Promise.resolve([]);
    var force = !!(options && options.force);
    var silent = !!(options && options.silent);
    if (state.itemLibraryLoading && !force) {
      return Promise.resolve(Array.isArray(state.itemLibrary) ? state.itemLibrary : []);
    }
    if (!force && Array.isArray(state.itemLibrary) && state.itemLibrary.length) {
      return Promise.resolve(state.itemLibrary);
    }
    if (!silent) {
      state.itemLibraryLoading = true;
      state.itemLibraryError = "";
      if (isOwnerViewingShop(state) && state.ownerPanel.tab === "history" && state.ownerPanel.section === "items") {
        renderShopList(state);
      }
    }
    return fetchItemLibrary(240).then(function (result) {
      if (!result || !result.ok) {
        throw new Error(String(result && result.payload && result.payload.error || "item_library_failed"));
      }
      state.itemLibrary = Array.isArray(result.payload && result.payload.items) ? result.payload.items : [];
      state.itemLibraryLoading = false;
      state.itemLibraryError = "";
      if (isOwnerViewingShop(state) && state.ownerPanel.tab === "history" && state.ownerPanel.section === "items") {
        renderShopList(state);
      }
      return state.itemLibrary;
    }).catch(function () {
      state.itemLibraryLoading = false;
      if (!silent) {
        state.itemLibraryError = "Could not load saved items.";
        if (isOwnerViewingShop(state) && state.ownerPanel.tab === "history" && state.ownerPanel.section === "items") {
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
    var session = state && state.accountSession ? state.accountSession : loadAccountSession();
    var ownerShops = accountOwnerShops(session);
    var ownerCount = ownerShops.length;
    var hasOwner = ownerCount > 0 || accountHasRole(session, "owner");
    var hasBuyer = accountHasRole(session, "buyer");
    var preferredShop = preferredOwnerShop(session, state && state.ownerShopId);
    if (!session || (!hasOwner && !hasBuyer)) {
      return {
        kind: "login",
        label: "Login",
        description: "Optional account session for owners",
        detail: "Guest buying stays separate on this device.",
        tone: "#ffb14a",
        shopId: ""
      };
    }
    if (hasOwner && hasBuyer) {
      return {
        kind: "account",
        label: "Profile",
        description: session.displayName || "Buyer + owner account",
        detail: ownerCount > 1 ? (ownerCount + " linked shops") : (preferredShop ? ("@" + preferredShop.shopId) : "Buyer and owner roles"),
        tone: "#7bd389",
        shopId: preferredShop ? preferredShop.shopId : ""
      };
    }
    if (hasOwner) {
      if (ownerCount > 1) {
        return {
          kind: "account",
          label: "My shops",
          description: session.displayName || (ownerCount + " linked shops"),
          detail: ownerCount + " shops in this account session",
          tone: "#ffb14a",
          shopId: preferredShop ? preferredShop.shopId : ""
        };
      }
      return {
        kind: "shop",
        label: "My shop",
        description: preferredShop ? preferredShop.shopName : (session.displayName || "Owner account"),
        detail: preferredShop ? ("@" + preferredShop.shopId) : "Owner account",
        tone: "#ffb14a",
        shopId: preferredShop ? preferredShop.shopId : ""
      };
    }
    return {
      kind: "account",
      label: "My profile",
      description: session.displayName || "Buyer account",
      detail: "Buyer account session",
      tone: "#7bd389",
      shopId: ""
    };
  }

  function hasSavedOwnerSession(state) {
    return !!preferredOwnerShopId(state && state.accountSession, state && state.ownerShopId);
  }

  function setPreferredOwnerShop(state, shopId) {
    var safeShopId = slugify(String(shopId || "").trim()).slice(0, 64);
    if (!state) return safeShopId;
    state.ownerShopId = safeShopId;
    if (state.accountSession && safeShopId) {
      state.accountSession = saveAccountSession(Object.assign({}, state.accountSession, {
        preferredOwnerShopId: safeShopId
      }));
    }
    return safeShopId;
  }

  function openRootAccountAction(state) {
    if (!state) return;
    var action = accountSessionAction(state);
    if (action.kind === "shop" && action.shopId) {
      setPreferredOwnerShop(state, action.shopId);
      openSavedOwnerShop(state);
      return;
    }
    if (action.kind === "account") {
      openAccountPane(state);
      return;
    }
    openDebugLoginPane(state);
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

  function fetchBuyerOrders(buyerKey, limit) {
    var params = new URLSearchParams();
    params.set("buyer_key", String(buyerKey || "").trim());
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
    var params = new URLSearchParams();
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
    var formData = new FormData();
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
    var formData = new FormData();
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

  function shopLogoUrl(shopId) {
    var safeShopId = String(shopId || "").trim();
    if (!safeShopId) return "";
    return "/api/shops/" + encodeURIComponent(safeShopId) + "/logo";
  }

  function assetFileUrl(fileName) {
    var safeName = String(fileName || "").trim();
    if (!safeName) return "";
    return "/api/assets/" + encodeURIComponent(safeName);
  }

  function mergeShopRecord(state, record, fallbackName) {
    if (!state || !record || typeof record !== "object") return null;
    var shopId = String(record.shop_id || "").trim();
    if (!shopId) return null;
    var existing = state.shopById[shopId] || {};
    var merged = Object.assign({}, existing, record);
    merged.shop_id = shopId;
    merged.display_name = String(merged.display_name || fallbackName || shopId).trim() || shopId;
    merged.public_url = String(merged.public_url || existing.public_url || ("/shop/" + encodeURIComponent(shopId) + "/")).trim();
    merged.map_color = String(merged.map_color || existing.map_color || "#29c6ea").trim();
    merged.lat = Number.isFinite(Number(merged.lat)) ? Number(merged.lat) : null;
    merged.lng = Number.isFinite(Number(merged.lng)) ? Number(merged.lng) : null;
    merged.has_location = !!(merged.has_location || (merged.lat != null && merged.lng != null));
    merged.location_label = String(
      merged.location_label
      || existing.location_label
      || (merged.has_location ? "On map" : "Location pending")
    ).trim();
    state.shopById[shopId] = merged;

    var index = state.shops.findIndex(function (shop) {
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
    var value = Number(state.selectedPaymentByShop && state.selectedPaymentByShop[shopId]);
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
    var raw = String(state.paymentModeByShop && state.paymentModeByShop[shopId] || "").trim().toLowerCase();
    return raw === "before_delivery" ? "before_delivery" : "on_receive";
  }

  function setSelectedPaymentMode(state, shopId, mode) {
    if (!state || !shopId) return;
    if (!state.paymentModeByShop) {
      state.paymentModeByShop = {};
    }
    var nextMode = String(mode || "").trim().toLowerCase() === "before_delivery"
      ? "before_delivery"
      : "on_receive";
    state.paymentModeByShop[shopId] = nextMode;
    setPaymentPickerOpen(state, shopId, false);
    if (state.selectedPaymentByShop) {
      delete state.selectedPaymentByShop[shopId];
    }
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
    var confirmation = orderConfirmation(state, state.activeShopId);
    if (!confirmation || !confirmation.order) return;
    var orderId = String(confirmation.order.id || "").trim();
    if (!orderId) return;
    var orders = Array.isArray(state.buyerOrders) ? state.buyerOrders : [];
    var matched = orders.find(function (order) {
      return String(order && order.id || "").trim() === orderId
        && String(order && order.shopId || "").trim() === String(state.activeShopId || "").trim();
    }) || orders.find(function (order) {
      return String(order && order.id || "").trim() === orderId;
    }) || null;
    if (!matched) return;
    setOrderConfirmation(state, state.activeShopId, Object.assign({}, confirmation, {
      order: matched,
      paymentMode: orderPaymentMode(matched),
      paymentLabel: String(matched.paymentLabel || confirmation.paymentLabel || "").trim()
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
    var cart = getShopCart(state, shopId);
    return Object.keys(cart).reduce(function (sum, key) {
      return sum + Math.max(0, Number(cart[key] || 0));
    }, 0);
  }

  function cartItems(detail, cart) {
    var items = Array.isArray(detail && detail.items) ? detail.items : [];
    return items.reduce(function (result, item) {
      var quantity = Math.max(0, Number(cart[item.id] || 0));
      if (!quantity) return result;
      result.push({
        id: item.id,
        title: item.title,
        quantity: quantity,
        price: item.price,
        total: priceNumber(item.price) * quantity
      });
      return result;
    }, []);
  }

  function orderPaymentMode(order) {
    var mode = String(order && (order.paymentMode || order.payment_mode) || "").trim().toLowerCase();
    return mode === "before_delivery" ? "before_delivery" : "on_receive";
  }

  function normalizedOrderStatus(order) {
    var status = String(order && order.status || "").trim().toLowerCase();
    var mode = orderPaymentMode(order);
    if (!status || status === "new") {
      return mode === "before_delivery" ? "payment_pending" : "created";
    }
    if (status === "pending") {
      return mode === "before_delivery" ? "payment_pending" : "created";
    }
    return status;
  }

  function orderPaymentModeLabel(order) {
    return orderPaymentMode(order) === "before_delivery" ? "Pay before" : "Pay on receive";
  }

  function orderStatusText(order) {
    var status = normalizedOrderStatus(order);
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
    var status = normalizedOrderStatus(order);
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
    var status = normalizedOrderStatus(order);
    if (status === "accepted") return "Shop confirmed your order.";
    if (status === "ready") return "Order is ready.";
    if (status === "paid") return "Payment confirmed.";
    if (status === "completed") return "Order completed.";
    if (status === "cancelled") return "Order cancelled.";
    if (status === "payment_pending") return "Waiting for payment confirmation.";
    return "Waiting for shop confirmation.";
  }

  function buyerConfirmationMessage(order) {
    var status = normalizedOrderStatus(order);
    if (status === "accepted") return "The shop accepted your order. This screen keeps updating as they move it forward.";
    if (status === "ready") return "The shop marked your order ready. Open Recent history anytime to check later.";
    if (status === "paid") return "The shop confirmed payment. The next status update will appear here automatically.";
    if (status === "completed") return "This order is finished. You can still reopen it from Recent history.";
    if (status === "cancelled") return "The shop cancelled this order.";
    if (status === "payment_pending") return "Your order is saved. Once payment is confirmed, this screen will update automatically.";
    return "Your order is saved. This screen waits for the shop confirmation callback and updates automatically.";
  }

  function formatOrderTimestamp(value) {
    var timestamp = Number(value || 0);
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
    var items = Array.isArray(order && order.items) ? order.items : [];
    var itemSummary = items.map(function (item) {
      var title = String(item && item.title || "").trim();
      var quantity = Math.max(0, Number(item && item.quantity || 0));
      if (!title) return "";
      return title + (quantity > 0 ? (" x" + quantity) : "");
    }).filter(Boolean);
    if (itemSummary.length) {
      return itemSummary.slice(0, 3).join(", ");
    }
    var notes = String(order && order.notes || "").trim();
    if (notes) return notes;
    var address = String(order && order.address || "").trim();
    if (address) return address;
    return "Order created from this device.";
  }

  function pendingOwnerOrdersCount(orders) {
    if (!Array.isArray(orders)) return 0;
    return orders.reduce(function (sum, order) {
      var status = normalizedOrderStatus(order);
      return sum + (status === "created" || status === "payment_pending" ? 1 : 0);
    }, 0);
  }

  function nextOwnerOrderAction(order) {
    var status = normalizedOrderStatus(order);
    var mode = orderPaymentMode(order);
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
    var text = String(value || "").trim();
    if (!text || text.indexOf(",") === -1) return null;
    var parts = text.split(",", 2);
    var lat = Number(parts[0]);
    var lng = Number(parts[1]);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return [lat, lng];
  }

  function formatGpsValue(lat, lng) {
    if (!isFinite(lat) || !isFinite(lng)) return "";
    return Number(lat).toFixed(6) + "," + Number(lng).toFixed(6);
  }

  function createConsoleFromDetail(shop, detail) {
    var items = Array.isArray(detail && detail.items) ? detail.items : [];
    var paymentEntries = Array.isArray(detail && detail.paymentEntries) ? detail.paymentEntries : [];
    var gps = shop && shop.has_location && isFinite(shop.lat) && isFinite(shop.lng)
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
        var label = String(item.label || "").trim().toUpperCase();
        return {
          id: "payment-" + index,
          label: label,
          details: String(item.note || "").trim(),
          upiId: label === "UPI" ? String(item.value || "").trim() : "",
          btcAddress: label === "BTC" ? String(item.value || "").trim() : "",
          ethAddress: label === "ETH" ? String(item.value || "").trim() : "",
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
    var shop = state.shopById[shopId];
    var detail = state.shopDetails[shopId] || shopDetailFromPreview(shop);
    return createConsoleFromDetail(shop, detail || {});
  }

  function applyConsoleRecord(state, shopId, record) {
    if (!state || !shopId || !record || typeof record !== "object") return;
    var shop = mergeShopRecord(state, record, record.display_name || shopId) || state.shopById[shopId];
    if (!shop) return;
    if (record.console && typeof record.console === "object") {
      state.shopConsoles[shopId] = cloneConsoleData(record.console);
      state.shopDetails[shopId] = shopDetailFromRecord(shop, record);
      if (record.console.profile && typeof record.console.profile === "object") {
        var profile = record.console.profile;
        shop.display_name = String(profile.name || shop.display_name || shop.shop_id).trim() || shop.shop_id;
        if (String(profile.location || "").trim()) {
          shop.location_label = String(profile.location || "").trim();
        }
        var gps = parseGpsValue(profile.gps);
        shop.lat = gps ? gps[0] : null;
        shop.lng = gps ? gps[1] : null;
        shop.has_location = !!gps;
      }
    }
  }

  function refreshShopConsole(state, shopId, options) {
    if (!state || !shopId) return Promise.resolve(null);
    var preserveScroll = !!(options && options.preserveScroll);
    var focusMap = !!(options && options.focusMap);
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
    var shopId = ownerOrdersNavShopId(state);
    var force = !!(options && options.force);
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
    var tone = String(state.ownerPanel.tone || "").trim();
    return '<p class="shop-owner-status' + (tone ? (' is-' + escapeHtml(tone)) : '') + '">' + escapeHtml(state.ownerPanel.message || "") + '</p>';
  }

  function ownerPanelMarkup(state, detail, consoleData) {
    var tab = String(state.ownerPanel.tab || "").trim();
    if (tab !== "manage") return "";
    var profile = consoleData && consoleData.profile && typeof consoleData.profile === "object"
      ? consoleData.profile
      : createConsoleFromDetail(null, detail).profile;
    var listings = Array.isArray(consoleData && consoleData.listings) ? consoleData.listings : [];
    var orders = Array.isArray(consoleData && consoleData.orders) ? consoleData.orders : [];
    var pendingOrders = pendingOwnerOrdersCount(orders);
    var selectedItemId = String(state && state.ownerPanel && state.ownerPanel.itemId || "").trim();
    var selectedItem = listings.find(function (item) {
      return String(item && item.id || "").trim() === selectedItemId;
    }) || listings[0] || null;
    if (selectedItem && state && state.ownerPanel) {
      state.ownerPanel.itemId = String(selectedItem.id || "").trim();
    }
    var payments = Array.isArray(consoleData && consoleData.payments) ? consoleData.payments : [];
    var paymentDetails = "";
    var upiId = "";
    var btcAddress = "";
    var ethAddress = "";
    payments.forEach(function (payment) {
      if (!paymentDetails && payment && payment.details) paymentDetails = String(payment.details).trim();
      if (!upiId && payment && payment.upiId) upiId = String(payment.upiId).trim();
      if (!btcAddress && payment && payment.btcAddress) btcAddress = String(payment.btcAddress).trim();
      if (!ethAddress && payment && payment.ethAddress) ethAddress = String(payment.ethAddress).trim();
    });
    var pickupGps = parseGpsValue(profile.gps || (detail && detail.gps));
    var pickupSummary = pickupGps
      ? (pickupGps[0].toFixed(5) + ", " + pickupGps[1].toFixed(5))
      : "No pickup point set";
    var itemPickerMarkup = listings.length ? (
      '<div class="shop-owner-item-picker">' +
        listings.map(function (item) {
          var itemId = String(item.id || "").trim();
          return '' +
            '<button class="shop-owner-item-select' + (selectedItem && itemId === String(selectedItem.id || "").trim() ? ' is-selected' : '') + '" type="button" data-owner-item-select="' + escapeHtml(itemId) + '">' +
              '<strong>' + escapeHtml(item.title || "Item") + '</strong>' +
              '<span>' + escapeHtml((item.price ? item.price + ' • ' : '') + 'Qty ' + Math.max(0, Number(item.quantity || 0))) + '</span>' +
            '</button>';
        }).join('') +
      '</div>'
    ) : '<div class="shop-list-empty">No items yet. Add your first one above.</div>';
    var selectedItemMarkup = selectedItem ? (
      '<section class="shop-owner-item-card" data-owner-item-id="' + escapeHtml(selectedItem.id || "") + '">' +
        '<div class="shop-owner-item-card-head">' +
          '<strong>' + escapeHtml(selectedItem.title || "Item") + '</strong>' +
          '<span>' + escapeHtml(String(selectedItem.id || "").trim()) + '</span>' +
        '</div>' +
        '<div class="shop-owner-grid">' +
          '<label class="shop-owner-field"><span>Item name</span><input class="shop-owner-input" data-owner-item-field="title" value="' + escapeHtml(selectedItem.title || "") + '" /></label>' +
          '<label class="shop-owner-field"><span>Price</span><input class="shop-owner-input" data-owner-item-field="price" value="' + escapeHtml(selectedItem.price || "") + '" /></label>' +
          '<label class="shop-owner-field"><span>Qty</span><input class="shop-owner-input" data-owner-item-field="quantity" type="number" min="0" step="1" value="' + escapeHtml(selectedItem.quantity || 0) + '" /></label>' +
          '<label class="shop-owner-field shop-owner-field-wide"><span>Description</span><textarea class="shop-owner-textarea" data-owner-item-field="description" rows="3">' + escapeHtml(selectedItem.description || "") + '</textarea></label>' +
        '</div>' +
        '<div class="shop-owner-item-actions">' +
          '<button class="shop-owner-save" type="button" data-owner-item-save="' + escapeHtml(selectedItem.id || "") + '">Save item</button>' +
          '<button class="shop-owner-chip-button is-danger" type="button" data-owner-item-remove="' + escapeHtml(selectedItem.id || "") + '">Remove</button>' +
        '</div>' +
      '</section>'
    ) : '';
    var selectedItemEditorMarkup = selectedItemMarkup ? (
      '<div class="shop-owner-item-editor">' +
        '<span class="shop-owner-inline-label">Edit selected item</span>' +
        selectedItemMarkup +
      '</div>'
    ) : '';
    var ordersMarkup = orders.length ? (
      '<div class="shop-owner-order-list">' +
        orderedOwnerOrders(orders).map(function (item) {
          var nextAction = nextOwnerOrderAction(item);
          return '' +
            '<article class="shop-owner-order-card">' +
              '<div class="shop-owner-order-head">' +
                '<strong>' + escapeHtml(item.title || "Order") + '</strong>' +
                '<span>' + escapeHtml(orderStatusText(item)) + '</span>' +
              '</div>' +
              '<div class="shop-owner-order-meta">' +
                '<span>' + escapeHtml(orderPaymentModeLabel(item) + ' • ' + (item.paymentLabel || "Payment")) + '</span>' +
                '<span>' + escapeHtml(item.total || item.price || "-") + '</span>' +
              '</div>' +
              '<p>' + escapeHtml(item.address || item.notes || "No order notes yet.") + '</p>' +
              (nextAction ? (
                '<div class="shop-owner-order-actions">' +
                  '<button class="shop-owner-save" type="button" data-owner-order-action="' + escapeHtml(item.id || "") + '" data-next-status="' + escapeHtml(nextAction.nextStatus) + '">' + escapeHtml(nextAction.label) + '</button>' +
                '</div>'
              ) : '') +
            '</article>';
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
            '<label class="shop-owner-field"><span>Contact</span><input class="shop-owner-input" name="contact" value="' + escapeHtml(profile.contact || detail.contact || "") + '" /></label>' +
            '<label class="shop-owner-field"><span>Hours</span><input class="shop-owner-input" name="hours" value="' + escapeHtml(profile.hours || detail.hours || "") + '" /></label>' +
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
            '<strong>Items</strong>' +
            '<span>Add new ones and select an item to edit</span>' +
          '</div>' +
          '<div class="shop-owner-grid">' +
            '<label class="shop-owner-field"><span>Item name</span><input class="shop-owner-input" name="title" placeholder="Kitkat" /></label>' +
            '<label class="shop-owner-field"><span>Price</span><input class="shop-owner-input" name="price" placeholder="20" /></label>' +
            '<label class="shop-owner-field"><span>Qty</span><input class="shop-owner-input" name="quantity" type="number" min="0" step="1" placeholder="12" /></label>' +
            '<label class="shop-owner-field shop-owner-field-wide"><span>Description</span><textarea class="shop-owner-textarea" name="description" rows="3" placeholder="Quick note for buyers"></textarea></label>' +
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
            '<label class="shop-owner-field"><span>UPI</span><input class="shop-owner-input" name="upiId" value="' + escapeHtml(upiId) + '" placeholder="shop@upi" /></label>' +
            '<label class="shop-owner-field"><span>BTC</span><input class="shop-owner-input" name="btcAddress" value="' + escapeHtml(btcAddress) + '" placeholder="bc1..." /></label>' +
            '<label class="shop-owner-field"><span>ETH</span><input class="shop-owner-input" name="ethAddress" value="' + escapeHtml(ethAddress) + '" placeholder="0x..." /></label>' +
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
    var tab = String(state.ownerPanel.tab || "").trim();
    if (tab !== "manage") return "";
    var openSection = String(state && state.ownerPanel && state.ownerPanel.section || "").trim();
    var profile = consoleData && consoleData.profile && typeof consoleData.profile === "object"
      ? consoleData.profile
      : createConsoleFromDetail(null, detail).profile;
    var listings = Array.isArray(consoleData && consoleData.listings) ? consoleData.listings : [];
    var orders = Array.isArray(consoleData && consoleData.orders) ? consoleData.orders : [];
    var pendingOrders = pendingOwnerOrdersCount(orders);
    var selectedItemId = String(state && state.ownerPanel && state.ownerPanel.itemId || "").trim();
    var selectedItem = listings.find(function (item) {
      return String(item && item.id || "").trim() === selectedItemId;
    }) || listings[0] || null;
    if (selectedItem && state && state.ownerPanel) {
      state.ownerPanel.itemId = String(selectedItem.id || "").trim();
    }
    var payments = Array.isArray(consoleData && consoleData.payments) ? consoleData.payments : [];
    var paymentDetails = "";
    var upiId = "";
    var btcAddress = "";
    var ethAddress = "";
    payments.forEach(function (payment) {
      if (!paymentDetails && payment && payment.details) paymentDetails = String(payment.details).trim();
      if (!upiId && payment && payment.upiId) upiId = String(payment.upiId).trim();
      if (!btcAddress && payment && payment.btcAddress) btcAddress = String(payment.btcAddress).trim();
      if (!ethAddress && payment && payment.ethAddress) ethAddress = String(payment.ethAddress).trim();
    });
    var pickupGps = parseGpsValue(profile.gps || (detail && detail.gps));
    var pickupSummary = pickupGps
      ? (pickupGps[0].toFixed(5) + ", " + pickupGps[1].toFixed(5))
      : "No pickup point set";
    var itemPickerMarkup = listings.length ? (
      '<div class="shop-owner-item-picker">' +
        listings.map(function (item) {
          var itemId = String(item.id || "").trim();
          return '' +
            '<button class="shop-owner-item-select' + (selectedItem && itemId === String(selectedItem.id || "").trim() ? ' is-selected' : '') + '" type="button" data-owner-item-select="' + escapeHtml(itemId) + '">' +
              '<strong>' + escapeHtml(item.title || "Item") + '</strong>' +
              '<span>' + escapeHtml((item.price ? item.price + ' • ' : '') + 'Qty ' + Math.max(0, Number(item.quantity || 0))) + '</span>' +
            '</button>';
        }).join('') +
      '</div>'
    ) : '<div class="shop-list-empty">No items yet. Add your first one above.</div>';
    var selectedItemMarkup = selectedItem ? (
      '<section class="shop-owner-item-card" data-owner-item-id="' + escapeHtml(selectedItem.id || "") + '">' +
        '<div class="shop-owner-item-card-head">' +
          '<strong>' + escapeHtml(selectedItem.title || "Item") + '</strong>' +
          '<span>' + escapeHtml(String(selectedItem.id || "").trim()) + '</span>' +
        '</div>' +
        '<div class="shop-owner-grid">' +
          '<label class="shop-owner-field"><span>Item name</span><input class="shop-owner-input" data-owner-item-field="title" value="' + escapeHtml(selectedItem.title || "") + '" /></label>' +
          '<label class="shop-owner-field"><span>Price</span><input class="shop-owner-input" data-owner-item-field="price" value="' + escapeHtml(selectedItem.price || "") + '" /></label>' +
          '<label class="shop-owner-field"><span>Qty</span><input class="shop-owner-input" data-owner-item-field="quantity" type="number" min="0" step="1" value="' + escapeHtml(selectedItem.quantity || 0) + '" /></label>' +
          '<label class="shop-owner-field shop-owner-field-wide"><span>Description</span><textarea class="shop-owner-textarea" data-owner-item-field="description" rows="3">' + escapeHtml(selectedItem.description || "") + '</textarea></label>' +
        '</div>' +
        '<div class="shop-owner-item-actions">' +
          '<button class="shop-owner-save" type="button" data-owner-item-save="' + escapeHtml(selectedItem.id || "") + '">Save item</button>' +
          '<button class="shop-owner-chip-button is-danger" type="button" data-owner-item-remove="' + escapeHtml(selectedItem.id || "") + '">Remove</button>' +
        '</div>' +
      '</section>'
    ) : '';
    var selectedItemEditorMarkup = selectedItemMarkup ? (
      '<div class="shop-owner-item-editor">' +
        '<span class="shop-owner-inline-label">Edit selected item</span>' +
        selectedItemMarkup +
      '</div>'
    ) : '';
    var ordersMarkup = orders.length ? (
      '<div class="shop-owner-order-list">' +
        orderedOwnerOrders(orders).map(function (item) {
          var nextAction = nextOwnerOrderAction(item);
          return '' +
            '<article class="shop-owner-order-card">' +
              '<div class="shop-owner-order-head">' +
                '<strong>' + escapeHtml(item.title || "Order") + '</strong>' +
                '<span>' + escapeHtml(orderStatusText(item)) + '</span>' +
              '</div>' +
              '<div class="shop-owner-order-meta">' +
                '<span>' + escapeHtml(orderPaymentModeLabel(item) + ' • ' + (item.paymentLabel || "Payment")) + '</span>' +
                '<span>' + escapeHtml(item.total || item.price || "-") + '</span>' +
              '</div>' +
              '<p>' + escapeHtml(item.address || item.notes || "No order notes yet.") + '</p>' +
              (nextAction ? (
                '<div class="shop-owner-order-actions">' +
                  '<button class="shop-owner-save" type="button" data-owner-order-action="' + escapeHtml(item.id || "") + '" data-next-status="' + escapeHtml(nextAction.nextStatus) + '">' + escapeHtml(nextAction.label) + '</button>' +
                '</div>'
              ) : '') +
            '</article>';
        }).join('') +
      '</div>'
    ) : '<div class="shop-list-empty">No orders yet.</div>';
    function sectionMarkup(key, title, copy, body) {
      var isOpen = openSection === key;
      var bodyId = "ownerSection-" + key;
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
              '<label class="shop-owner-field"><span>Contact</span><input class="shop-owner-input" name="contact" value="' + escapeHtml(profile.contact || detail.contact || "") + '" /></label>' +
              '<label class="shop-owner-field"><span>Hours</span><input class="shop-owner-input" name="hours" value="' + escapeHtml(profile.hours || detail.hours || "") + '" /></label>' +
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
          'Items',
          'Add new ones and select an item to edit',
          '<form class="shop-owner-form" data-owner-form="item">' +
            '<div class="shop-owner-grid">' +
              '<label class="shop-owner-field"><span>Item name</span><input class="shop-owner-input" name="title" placeholder="Kitkat" /></label>' +
              '<label class="shop-owner-field"><span>Price</span><input class="shop-owner-input" name="price" placeholder="20" /></label>' +
              '<label class="shop-owner-field"><span>Qty</span><input class="shop-owner-input" name="quantity" type="number" min="0" step="1" placeholder="12" /></label>' +
              '<label class="shop-owner-field shop-owner-field-wide"><span>Description</span><textarea class="shop-owner-textarea" name="description" rows="3" placeholder="Quick note for buyers"></textarea></label>' +
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
              '<label class="shop-owner-field"><span>UPI</span><input class="shop-owner-input" name="upiId" value="' + escapeHtml(upiId) + '" placeholder="shop@upi" /></label>' +
              '<label class="shop-owner-field"><span>BTC</span><input class="shop-owner-input" name="btcAddress" value="' + escapeHtml(btcAddress) + '" placeholder="bc1..." /></label>' +
              '<label class="shop-owner-field"><span>ETH</span><input class="shop-owner-input" name="ethAddress" value="' + escapeHtml(ethAddress) + '" placeholder="0x..." /></label>' +
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
    var safeClassName = String(className || "").trim();
    var imageFiles = Array.isArray(item && item.imageFiles) ? item.imageFiles : [];
    var firstImage = imageFiles.length ? assetFileUrl(imageFiles[0]) : "";
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
    var imageFiles = Array.isArray(selectedItem.imageFiles) ? selectedItem.imageFiles : [];
    var galleryMarkup = imageFiles.length ? (
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
        '<span class="shop-owner-inline-label">Edit selected item</span>' +
        '<section class="shop-owner-item-card" data-owner-item-id="' + escapeHtml(selectedItem.id || "") + '">' +
          '<div class="shop-owner-item-card-head">' +
            '<div class="shop-owner-item-card-title">' +
              ownerItemPreviewMarkup(selectedItem, "is-card") +
              '<div class="shop-owner-item-card-copy">' +
                '<strong>' + escapeHtml(selectedItem.title || "Item") + '</strong>' +
                '<span>' + escapeHtml(String(selectedItem.id || "").trim()) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="shop-owner-grid">' +
            '<label class="shop-owner-field"><span>Item name</span><input class="shop-owner-input" data-owner-item-field="title" value="' + escapeHtml(selectedItem.title || "") + '" /></label>' +
            '<label class="shop-owner-field"><span>Price</span><input class="shop-owner-input" data-owner-item-field="price" value="' + escapeHtml(selectedItem.price || "") + '" /></label>' +
            '<label class="shop-owner-field"><span>Qty</span><input class="shop-owner-input" data-owner-item-field="quantity" type="number" min="0" step="1" value="' + escapeHtml(selectedItem.quantity || 0) + '" /></label>' +
            '<label class="shop-owner-field shop-owner-field-wide"><span>Description</span><textarea class="shop-owner-textarea" data-owner-item-field="description" rows="3">' + escapeHtml(selectedItem.description || "") + '</textarea></label>' +
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
            '<button class="shop-owner-save" type="button" data-owner-item-save="' + escapeHtml(selectedItem.id || "") + '">Save item</button>' +
            '<button class="shop-owner-chip-button is-danger" type="button" data-owner-item-remove="' + escapeHtml(selectedItem.id || "") + '">Remove</button>' +
          '</div>' +
        '</section>' +
      '</div>';
  }

  function ownerSettingsMarkup(state, detail, consoleData) {
    if (String(state && state.ownerPanel && state.ownerPanel.tab || "").trim() !== "settings") return "";
    var section = normalizeOwnerSettingsSection(state && state.ownerPanel && state.ownerPanel.section);
    var profile = consoleData && consoleData.profile && typeof consoleData.profile === "object"
      ? consoleData.profile
      : createConsoleFromDetail(null, detail).profile;
    var payments = Array.isArray(consoleData && consoleData.payments) ? consoleData.payments : [];
    var paymentDetails = "";
    var upiId = "";
    var btcAddress = "";
    var ethAddress = "";
    payments.forEach(function (payment) {
      if (!paymentDetails && payment && payment.details) paymentDetails = String(payment.details).trim();
      if (!upiId && payment && payment.upiId) upiId = String(payment.upiId).trim();
      if (!btcAddress && payment && payment.btcAddress) btcAddress = String(payment.btcAddress).trim();
      if (!ethAddress && payment && payment.ethAddress) ethAddress = String(payment.ethAddress).trim();
    });
    var pickupGps = parseGpsValue(profile.gps || (detail && detail.gps));
    var pickupSummary = pickupGps
      ? (pickupGps[0].toFixed(5) + ", " + pickupGps[1].toFixed(5))
      : "No pickup point set";
    var logoMarkup = profile.logoFile ? (
      '<span class="shop-owner-logo-preview is-logo">' +
        '<img class="shop-owner-logo-image" src="' + escapeHtml(shopLogoUrl(state.activeShopId)) + '" alt="' + escapeHtml((detail && detail.name) || "Shop logo") + '">' +
      '</span>'
    ) : '<span class="shop-owner-logo-preview" aria-hidden="true"></span>';
    var settingsTabsMarkup = '' +
      '<div class="shop-owner-tab-row">' +
        '<button class="shop-owner-tab' + (section === "profile" ? ' is-active' : '') + '" type="button" data-owner-settings-section="profile">Shop</button>' +
        '<button class="shop-owner-tab' + (section === "payments" ? ' is-active' : '') + '" type="button" data-owner-settings-section="payments">Payments</button>' +
      '</div>';
    var bodyMarkup = section === "payments"
      ? (
        '<form class="shop-owner-form" data-owner-form="payments">' +
          '<div class="shop-owner-form-head">' +
            '<strong>Payments</strong>' +
            '<span>What buyers can use here.</span>' +
          '</div>' +
          '<div class="shop-owner-grid">' +
            '<label class="shop-owner-field"><span>UPI</span><input class="shop-owner-input" name="upiId" value="' + escapeHtml(upiId) + '" placeholder="shop@upi" /></label>' +
            '<label class="shop-owner-field"><span>BTC</span><input class="shop-owner-input" name="btcAddress" value="' + escapeHtml(btcAddress) + '" placeholder="bc1..." /></label>' +
            '<label class="shop-owner-field"><span>ETH</span><input class="shop-owner-input" name="ethAddress" value="' + escapeHtml(ethAddress) + '" placeholder="0x..." /></label>' +
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
            '<label class="shop-owner-field"><span>Location</span><input class="shop-owner-input" name="location" value="' + escapeHtml(profile.location || detail.location || "") + '" /></label>' +
            '<label class="shop-owner-field"><span>Contact</span><input class="shop-owner-input" name="contact" value="' + escapeHtml(profile.contact || detail.contact || "") + '" /></label>' +
            '<label class="shop-owner-field"><span>Hours</span><input class="shop-owner-input" name="hours" value="' + escapeHtml(profile.hours || detail.hours || "") + '" /></label>' +
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
        settingsTabsMarkup +
        bodyMarkup +
      '</section>';
  }

  function ownerHistoryMarkup(state, detail, consoleData) {
    if (String(state && state.ownerPanel && state.ownerPanel.tab || "").trim() !== "history") return "";
    var section = normalizeOwnerHistorySection(state && state.ownerPanel && state.ownerPanel.section);
    var query = normalizeSearch(state && state.searchQuery || "");
    var listings = Array.isArray(consoleData && consoleData.listings) ? consoleData.listings : [];
    var orders = Array.isArray(consoleData && consoleData.orders) ? consoleData.orders : [];
    var selectedItemId = String(state && state.ownerPanel && state.ownerPanel.itemId || "").trim();
    var selectedItem = listings.find(function (item) {
      return String(item && item.id || "").trim() === selectedItemId;
    }) || listings[0] || null;
    if (selectedItem && state && state.ownerPanel) {
      state.ownerPanel.itemId = String(selectedItem.id || "").trim();
    }
    var historyTabsMarkup = '' +
      '<div class="shop-owner-tab-row">' +
        '<button class="shop-owner-tab' + (section === "orders" ? ' is-active' : '') + '" type="button" data-owner-history-section="orders">Orders</button>' +
        '<button class="shop-owner-tab' + (section === "items" ? ' is-active' : '') + '" type="button" data-owner-history-section="items">Items</button>' +
        '<button class="shop-owner-tab' + (section === "stats" ? ' is-active' : '') + '" type="button" data-owner-history-section="stats">Stats</button>' +
      '</div>';
    var bodyMarkup = "";

    if (section === "orders") {
      var draft = ownerOrderDraft(state, state.activeShopId);
      var draftItems = ownerDraftItems(detail, draft);
      var draftTotal = draftItems.reduce(function (sum, item) {
        return sum + Number(item.total || 0);
      }, 0);
      var filteredOrders = orderedOwnerOrders(orders).filter(function (order) {
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
      bodyMarkup = '' +
        '<section class="shop-owner-form">' +
          '<div class="shop-owner-form-head">' +
            '<strong>Start order</strong>' +
            '<span>Walk-in customers can be added here directly from the shop.</span>' +
          '</div>' +
          '<div class="shop-owner-grid">' +
            '<label class="shop-owner-field"><span>Buyer name</span><input class="shop-owner-input" data-owner-order-draft-field="buyerName" value="' + escapeHtml(draft.buyerName || "") + '" placeholder="Optional" /></label>' +
            '<label class="shop-owner-field"><span>Buyer contact</span><input class="shop-owner-input" data-owner-order-draft-field="buyerContact" value="' + escapeHtml(draft.buyerContact || "") + '" placeholder="Optional" /></label>' +
            '<label class="shop-owner-field shop-owner-field-wide"><span>Notes</span><textarea class="shop-owner-textarea" data-owner-order-draft-field="notes" rows="2" placeholder="Cash, takeaway, table no...">' + escapeHtml(draft.notes || "") + '</textarea></label>' +
          '</div>' +
          '<div class="shop-owner-mode-row">' +
            '<button class="shop-owner-tab' + (draft.paymentMode === "on_receive" ? ' is-active' : '') + '" type="button" data-owner-order-payment="on_receive">Pay on receive</button>' +
            '<button class="shop-owner-tab' + (draft.paymentMode === "before_delivery" ? ' is-active' : '') + '" type="button" data-owner-order-payment="before_delivery">Pay before</button>' +
          '</div>' +
          (listings.length ? (
            '<div class="shop-owner-draft-list">' +
              listings.map(function (item) {
                var quantity = Math.max(0, Number(draft.items && draft.items[item.id] || 0));
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
                        '<button class="shop-item-step" type="button" data-owner-draft-step="-1" data-item-id="' + escapeHtml(item.id || "") + '"' + (quantity ? '' : ' disabled') + '>-</button>' +
                        '<span class="shop-item-qty">' + escapeHtml(quantity) + '</span>' +
                        '<button class="shop-item-step" type="button" data-owner-draft-step="1" data-item-id="' + escapeHtml(item.id || "") + '">+</button>' +
                      '</div>' +
                    '</div>' +
                  '</article>';
              }).join('') +
            '</div>'
          ) : '<div class="shop-list-empty">Add items first before starting orders from the shop.</div>') +
          '<div class="shop-owner-summary-bar">' +
            '<span>' + escapeHtml(draftItems.length ? (draftItems.reduce(function (sum, item) { return sum + item.quantity; }, 0) + " items selected") : "No items selected") + '</span>' +
            '<strong>' + escapeHtml(draftTotal > 0 ? formatTotalAmount(draftTotal, detail && detail.pricing) : "0") + '</strong>' +
          '</div>' +
          '<div class="shop-owner-action-row">' +
            '<button class="shop-owner-save" type="button" data-owner-walkin-submit="true"' + (draftItems.length ? '' : ' disabled') + '>Start order</button>' +
          '</div>' +
        '</section>' +
        '<section class="shop-owner-form">' +
          '<div class="shop-owner-form-head">' +
            '<strong>Orders</strong>' +
            '<span>' + escapeHtml(filteredOrders.length ? (filteredOrders.length + " visible") : "No matching orders") + '</span>' +
          '</div>' +
          (filteredOrders.length ? (
            '<div class="shop-owner-order-list">' +
              filteredOrders.map(function (item) {
                var nextAction = nextOwnerOrderAction(item);
                return '' +
                  '<article class="shop-owner-order-card">' +
                    '<div class="shop-owner-order-head">' +
                      '<strong>' + escapeHtml(item.title || "Order") + '</strong>' +
                      '<span>' + escapeHtml(orderStatusText(item)) + '</span>' +
                    '</div>' +
                    '<div class="shop-owner-order-meta">' +
                      '<span>' + escapeHtml((item.buyerName || item.buyerContact || "Walk-in / buyer") + ' • ' + orderPaymentModeLabel(item)) + '</span>' +
                      '<span>' + escapeHtml(item.total || item.price || "-") + '</span>' +
                    '</div>' +
                    '<div class="shop-owner-order-meta">' +
                      '<span>' + escapeHtml(formatOrderTimestamp(item.timestamp)) + '</span>' +
                      '<span>' + escapeHtml(item.paymentLabel || "Order") + '</span>' +
                    '</div>' +
                    '<p>' + escapeHtml(item.address || item.notes || "No order notes yet.") + '</p>' +
                    (nextAction ? (
                      '<div class="shop-owner-order-actions">' +
                        '<button class="shop-owner-save" type="button" data-owner-order-action="' + escapeHtml(item.id || "") + '" data-next-status="' + escapeHtml(nextAction.nextStatus) + '">' + escapeHtml(nextAction.label) + '</button>' +
                      '</div>'
                    ) : '') +
                  '</article>';
              }).join('') +
            '</div>'
          ) : '<div class="shop-list-empty">' + escapeHtml(query ? "No orders match this search." : "No orders yet.") + '</div>') +
        '</section>';
    } else if (section === "items") {
      var visibleItems = listings.filter(function (item) {
        return matchesSearch([item.title, item.description, item.price, item.id], query);
      });
      var libraryItems = (Array.isArray(state.itemLibrary) ? state.itemLibrary : []).filter(function (item) {
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
            '<label class="shop-owner-field"><span>Price</span><input class="shop-owner-input" name="price" placeholder="20" /></label>' +
            '<label class="shop-owner-field"><span>Qty</span><input class="shop-owner-input" name="quantity" type="number" min="0" step="1" placeholder="12" /></label>' +
            '<label class="shop-owner-field shop-owner-field-wide"><span>Description</span><textarea class="shop-owner-textarea" name="description" rows="3" placeholder="Quick note for buyers"></textarea></label>' +
          '</div>' +
          '<div class="shop-owner-action-row">' +
            '<button class="shop-owner-save" type="button" data-owner-save="item">Add item</button>' +
          '</div>' +
        '</section>' +
        '<section class="shop-owner-form">' +
          '<div class="shop-owner-form-head">' +
            '<strong>Your items</strong>' +
            '<span>' + escapeHtml(listings.length ? (listings.length + " saved in this shop") : "No items saved yet") + '</span>' +
          '</div>' +
          '<div class="shop-owner-item-list">' +
            (visibleItems.length ? (
              '<div class="shop-owner-item-picker">' +
                visibleItems.map(function (item) {
                  var itemId = String(item.id || "").trim();
                  return '' +
                    '<button class="shop-owner-item-select' + (selectedItem && itemId === String(selectedItem.id || "").trim() ? ' is-selected' : '') + '" type="button" data-owner-item-select="' + escapeHtml(itemId) + '">' +
                      '<span class="shop-owner-item-select-row">' +
                        ownerItemPreviewMarkup(item, "is-mini") +
                        '<span class="shop-owner-item-select-copy">' +
                          '<strong>' + escapeHtml(item.title || "Item") + '</strong>' +
                          '<span>' + escapeHtml((item.price ? formatPrice(item.price, detail && detail.pricing) + ' • ' : '') + 'Qty ' + Math.max(0, Number(item.quantity || 0))) + '</span>' +
                        '</span>' +
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
                        '<span>' + escapeHtml(formatPrice(item.price, detail && detail.pricing) || "-") + '</span>' +
                        '<span>' + escapeHtml("Qty " + Math.max(0, Number(item.quantity || 0))) + '</span>' +
                      '</div>' +
                      '<button class="shop-owner-save" type="button" data-owner-library-import="' + escapeHtml(item.libraryId || "") + '">Import item</button>' +
                    '</article>';
                }).join('') +
              '</div>'
            )
            : '<div class="shop-list-empty">' + escapeHtml(query ? "No library items match this search." : "No reusable items found in the local DB yet.") + '</div>') +
        '</section>';
    } else {
      var stats = ownerSalesStats(orders);
      bodyMarkup = '' +
        '<section class="shop-owner-form">' +
          '<div class="shop-owner-form-head">' +
            '<strong>Sales statistics</strong>' +
            '<span>Current numbers for this shop.</span>' +
          '</div>' +
          '<div class="shop-owner-stats-grid">' +
            '<article class="shop-owner-stat-card"><span>Total orders</span><strong>' + escapeHtml(stats.totalOrders) + '</strong></article>' +
            '<article class="shop-owner-stat-card"><span>Pending</span><strong>' + escapeHtml(stats.pendingOrders) + '</strong></article>' +
            '<article class="shop-owner-stat-card"><span>Accepted</span><strong>' + escapeHtml(stats.acceptedOrders) + '</strong></article>' +
            '<article class="shop-owner-stat-card"><span>Ready</span><strong>' + escapeHtml(stats.readyOrders) + '</strong></article>' +
            '<article class="shop-owner-stat-card"><span>Settled</span><strong>' + escapeHtml(stats.settledOrders) + '</strong></article>' +
            '<article class="shop-owner-stat-card"><span>Today</span><strong>' + escapeHtml(stats.todayOrders) + '</strong></article>' +
            '<article class="shop-owner-stat-card is-wide"><span>Revenue</span><strong>' + escapeHtml(formatTotalAmount(stats.revenue, detail && detail.pricing) || "0") + '</strong></article>' +
          '</div>' +
        '</section>';
    }

    return '' +
      '<section class="shop-owner-stack">' +
        ownerStatusMarkup(state) +
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
    var consoleData = ensureShopConsole(state, state.activeShopId);
    var profile = consoleData.profile || {};
    profile.name = String((form.elements.name && form.elements.name.value) || "").trim();
    profile.type = String((form.elements.type && form.elements.type.value) || "").trim();
    profile.location = String((form.elements.location && form.elements.location.value) || "").trim();
    profile.contact = String((form.elements.contact && form.elements.contact.value) || "").trim();
    profile.hours = String((form.elements.hours && form.elements.hours.value) || "").trim();
    profile.notes = String((form.elements.notes && form.elements.notes.value) || "").trim();
    profile.currencyPrefix = String((form.elements.currencyPrefix && form.elements.currencyPrefix.value) || "").trim();
    profile.gps = String((form.elements.gps && form.elements.gps.value) || "").trim();
    consoleData.profile = profile;
    saveOwnerConsole(state, state.activeShopId, consoleData, "Shop updated.");
  }

  function submitOwnerItem(state, form) {
    if (!(form instanceof HTMLFormElement) || !state.activeShopId) return;
    var title = String((form.elements.title && form.elements.title.value) || "").trim();
    if (!title) {
      state.ownerPanel.message = "Enter an item name.";
      state.ownerPanel.tone = "error";
      renderShopList(state);
      return;
    }
    var consoleData = ensureShopConsole(state, state.activeShopId);
    var listings = Array.isArray(consoleData.listings) ? consoleData.listings.slice() : [];
    var newItemId = slugify(title) + "-" + Date.now().toString(36);
    listings.unshift({
      id: newItemId,
      title: title,
      description: String((form.elements.description && form.elements.description.value) || "").trim(),
      price: String((form.elements.price && form.elements.price.value) || "").trim(),
      quantity: Math.max(0, Number((form.elements.quantity && form.elements.quantity.value) || 0)),
      imageFiles: [],
      createdAt: Date.now()
    });
    state.ownerPanel.itemId = newItemId;
    consoleData.listings = listings;
    saveOwnerConsole(state, state.activeShopId, consoleData, "Item added.");
  }

  function submitOwnerItemUpdate(state, itemId, container) {
    if (!state || !state.activeShopId || !itemId || !(container instanceof Element)) return;
    var consoleData = ensureShopConsole(state, state.activeShopId);
    var listings = Array.isArray(consoleData.listings) ? consoleData.listings.slice() : [];
    var index = listings.findIndex(function (item) {
      return String(item && item.id || "").trim() === itemId;
    });
    if (index < 0) return;
    var titleNode = container.querySelector('[data-owner-item-field="title"]');
    var priceNode = container.querySelector('[data-owner-item-field="price"]');
    var quantityNode = container.querySelector('[data-owner-item-field="quantity"]');
    var descriptionNode = container.querySelector('[data-owner-item-field="description"]');
    var title = String(titleNode && titleNode.value || "").trim();
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
    var consoleData = ensureShopConsole(state, state.activeShopId);
    var listings = Array.isArray(consoleData.listings) ? consoleData.listings.slice() : [];
    var nextListings = listings.filter(function (item) {
      return String(item && item.id || "").trim() !== itemId;
    });
    state.ownerPanel.itemId = nextListings.length ? String(nextListings[0].id || "").trim() : "";
    consoleData.listings = nextListings;
    saveOwnerConsole(state, state.activeShopId, consoleData, "Item removed.");
  }

  function submitOwnerPayments(state, form) {
    if (!(form instanceof HTMLFormElement) || !state.activeShopId) return;
    var details = String((form.elements.details && form.elements.details.value) || "").trim();
    var payments = [];
    var upiId = String((form.elements.upiId && form.elements.upiId.value) || "").trim();
    var btcAddress = String((form.elements.btcAddress && form.elements.btcAddress.value) || "").trim();
    var ethAddress = String((form.elements.ethAddress && form.elements.ethAddress.value) || "").trim();
    if (upiId) payments.push({ id: "upi-" + Date.now().toString(36), label: "UPI", details: details, upiId: upiId, btcAddress: "", ethAddress: "", createdAt: Date.now() });
    if (btcAddress) payments.push({ id: "btc-" + Date.now().toString(36), label: "BTC", details: details, upiId: "", btcAddress: btcAddress, ethAddress: "", createdAt: Date.now() });
    if (ethAddress) payments.push({ id: "eth-" + Date.now().toString(36), label: "ETH", details: details, upiId: "", btcAddress: "", ethAddress: ethAddress, createdAt: Date.now() });
    var consoleData = ensureShopConsole(state, state.activeShopId);
    consoleData.payments = payments;
    saveOwnerConsole(state, state.activeShopId, consoleData, "Payments updated.");
  }

  function importOwnerLibraryItem(state, libraryId) {
    if (!state || !state.activeShopId || !libraryId) return;
    var libraryItems = Array.isArray(state.itemLibrary) ? state.itemLibrary : [];
    var sourceItem = libraryItems.find(function (item) {
      return String(item && item.libraryId || "").trim() === String(libraryId || "").trim();
    }) || null;
    if (!sourceItem) {
      state.ownerPanel.message = "Item library entry not found.";
      state.ownerPanel.tone = "error";
      renderShopList(state);
      return;
    }
    var consoleData = ensureShopConsole(state, state.activeShopId);
    var listings = Array.isArray(consoleData.listings) ? consoleData.listings.slice() : [];
    var newItemId = slugify(sourceItem.title || "item") + "-" + Date.now().toString(36);
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
    var detail = state.shopDetails[state.activeShopId] || shopDetailFromPreview(state.shopById[state.activeShopId]);
    if (!detail) return;
    var draft = ownerOrderDraft(state, state.activeShopId);
    var items = ownerDraftItems(detail, draft);
    if (!items.length) {
      state.ownerPanel.message = "Select at least one item.";
      state.ownerPanel.tone = "error";
      renderShopList(state);
      return;
    }
    var totalAmount = items.reduce(function (sum, item) {
      return sum + Number(item.total || 0);
    }, 0);
    var paymentEntries = payablePaymentEntries(detail, totalAmount);
    var paymentMode = String(draft.paymentMode || "").trim().toLowerCase() === "before_delivery"
      ? "before_delivery"
      : "on_receive";
    var chosenPayment = paymentMode === "before_delivery" ? (paymentEntries[0] || null) : null;
    var firstItem = items[0] || null;
    var title = firstItem ? String(firstItem.title || "").trim() : "Walk-in order";
    if (firstItem && items.length > 1) {
      title += " +" + (items.length - 1);
    }
    var payload = {
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
        return {
          id: String(item.id || "").trim(),
          title: String(item.title || "").trim(),
          quantity: Math.max(0, Number(item.quantity || 0)),
          price: formatPrice(item.price, detail && detail.pricing)
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
    var consoleData = ensureShopConsole(state, state.activeShopId);
    var orders = Array.isArray(consoleData.orders) ? consoleData.orders.slice() : [];
    var index = orders.findIndex(function (item) {
      return String(item && item.id || "").trim() === orderId;
    });
    if (index < 0) return;
    orders[index] = Object.assign({}, orders[index], {
      status: nextStatus,
      paymentPaid: nextStatus === "paid" || !!orders[index].paymentPaid,
      paymentReceived: nextStatus === "paid" || !!orders[index].paymentReceived,
      orderSent: nextStatus === "ready" || nextStatus === "completed" || !!orders[index].orderSent,
      orderReceived: nextStatus === "completed" || !!orders[index].orderReceived
    });
    consoleData.orders = orders;
    saveOwnerConsole(state, state.activeShopId, consoleData, "Order updated.");
  }

  function normalizePaymentEntries(payments) {
    if (!Array.isArray(payments)) return [];
    return payments.map(function (item) {
      if (item && typeof item === "object") {
        var label = String(item.label || item.method || "").trim();
        var value = String(item.value || item.address || item.upiId || item.btcAddress || item.ethAddress || "").trim();
        var note = String(item.note || item.details || "").trim();
        if (!label && value) label = "Payment";
        return { label: label, value: value, note: note };
      }
      var labelText = String(item || "").trim();
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
    var node = form.querySelector("#ownerPickupSummary");
    if (node) {
      node.textContent = String(text || "").trim() || "No pickup point set";
    }
  }

  function setOwnerPickupPoint(state, form, lat, lng, options) {
    if (!state || !(form instanceof HTMLFormElement) || !isFinite(lat) || !isFinite(lng)) return;
    var gpsInput = form.elements.gps;
    if (!(gpsInput instanceof HTMLInputElement)) return;
    var point = [Number(lat), Number(lng)];
    gpsInput.value = formatGpsValue(point[0], point[1]);
    if (state.ownerPickupMarker) {
      state.ownerPickupMarker.setLatLng(point);
    }
    if (state.ownerPickupMap) {
      state.ownerPickupMap.setView(point, Math.max(state.ownerPickupMap.getZoom(), 17), { animate: false });
    }
    updateOwnerPickupSummary(form, point[0].toFixed(5) + ", " + point[1].toFixed(5));
    var preserveLocation = options && options.preserveLocation;
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
    var form = state.listNode && state.listNode.querySelector('form[data-owner-form="profile"]');
    var mapNode = state.listNode && state.listNode.querySelector("#ownerPickupMap");
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
    var gps = parseGpsValue(form.elements.gps && form.elements.gps.value);
    var shop = state.activeShopId ? state.shopById[state.activeShopId] : null;
    var startPoint = gps
      || (shop && shop.has_location && isFinite(shop.lat) && isFinite(shop.lng) ? [shop.lat, shop.lng] : null)
      || (state.userPoint ? state.userPoint.slice() : null)
      || (state.map ? [state.map.getCenter().lat, state.map.getCenter().lng] : [22.9734, 78.6569]);
    var miniMap = window.L.map(mapNode, {
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
    var marker = window.L.marker(startPoint, {
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
      var latlng = marker.getLatLng();
      setOwnerPickupPoint(state, form, latlng.lat, latlng.lng);
    });
    window.setTimeout(function () {
      if (!state.ownerPickupMap) return;
      state.ownerPickupMap.invalidateSize();
      state.ownerPickupMap.setView(startPoint, gps ? 17 : 15, { animate: false });
    }, 40);
  }

  function matchesSearch(parts, query) {
    var needle = normalizeSearch(query);
    if (!needle) return true;
    return parts.some(function (part) {
      return normalizeSearch(part).indexOf(needle) !== -1;
    });
  }

  function shopDetailFromPreview(shop) {
    var preview = shop && shop.preview;
    if (!preview || typeof preview !== "object") return null;
    return {
      name: String(shop.display_name || shop.shop_id || "").trim(),
      type: String(preview.type || "Store").trim(),
      note: String(preview.note || "").trim(),
      contact: String(preview.contact || "").trim(),
      location: String(shop.location_label || "").trim(),
      hours: String(preview.hours || "").trim(),
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
    var consoleData = record && record.console && typeof record.console === "object" ? record.console : {};
    var profile = consoleData.profile && typeof consoleData.profile === "object" ? consoleData.profile : {};
    var listings = Array.isArray(consoleData.listings) ? consoleData.listings : [];
    var payments = Array.isArray(consoleData.payments) ? consoleData.payments : [];
    var paymentEntries = [];

    payments.forEach(function (payment) {
      var label = String(payment.label || "").trim();
      var details = String(payment.details || "").trim();
      var upiId = String(payment.upiId || "").trim();
      var btcAddress = String(payment.btcAddress || "").trim();
      var ethAddress = String(payment.ethAddress || "").trim();
      if (upiId) paymentEntries.push({ label: "UPI", value: upiId, note: details || label || "Pay on UPI" });
      if (btcAddress) paymentEntries.push({ label: "BTC", value: btcAddress, note: details || label || "Bitcoin address" });
      if (ethAddress) paymentEntries.push({ label: "ETH", value: ethAddress, note: details || label || "Ethereum address" });
      if (!upiId && !btcAddress && !ethAddress && (label || details)) {
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
    var label = String(payment.label || "").trim().toUpperCase();
    var value = String(payment.value || "").trim();
    if (!value) return "";
    var amount = Number(amountNumber || 0);
    var currencyCode = pricingCurrencyCode(detail && detail.pricing);
    var shopName = String(detail && detail.name || "").trim();
    if (label === "UPI") {
      var upi = new URLSearchParams();
      upi.set("pa", value);
      if (shopName) upi.set("pn", shopName);
      if (amount > 0 && currencyCode === "INR") {
        upi.set("am", amount.toFixed(2).replace(/\.?0+$/, ""));
        upi.set("cu", "INR");
      }
      return "upi://pay?" + upi.toString();
    }
    if (label === "BTC") {
      var btc = "bitcoin:" + value;
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

  function payablePaymentEntries(detail, amountNumber) {
    var entries = Array.isArray(detail && detail.paymentEntries) ? detail.paymentEntries : [];
    return entries.filter(function (payment) {
      return !!buildPaymentHref(payment, detail, amountNumber || 1);
    });
  }

  function effectivePaymentMode(state, shopId, paymentEntries) {
    if (!Array.isArray(paymentEntries) || !paymentEntries.length) return "on_receive";
    return selectedPaymentMode(state, shopId) === "before_delivery" ? "before_delivery" : "on_receive";
  }

  function buildOrderPayload(state, detail, payment, chosenItems, totalAmount, paymentModeOverride) {
    var items = Array.isArray(chosenItems) ? chosenItems : [];
    var firstItem = items[0] || null;
    var totalQuantity = items.reduce(function (sum, item) {
      return sum + Math.max(0, Number(item && item.quantity || 0));
    }, 0);
    var paymentMode = String(paymentModeOverride || "").trim().toLowerCase() === "before_delivery"
      ? "before_delivery"
      : "on_receive";
    var title = firstItem ? String(firstItem.title || "").trim() : "Order";
    if (firstItem && items.length > 1) {
      title = title + " +" + (items.length - 1);
    }
    var buyerProfile = state && state.buyerProfile && typeof state.buyerProfile === "object"
      ? state.buyerProfile
      : loadBuyerProfile();
    var notes = items.map(function (item) {
      return String(item.title || "").trim() + " x" + Math.max(0, Number(item.quantity || 0));
    }).filter(Boolean).join(", ");
    return {
      buyer_key: ensureBuyerKey(),
      buyer_name: String(buyerProfile.name || "").trim(),
      buyer_contact: String(buyerProfile.contact || "").trim(),
      client_nonce: createClientNonce(),
      item_id: items.length === 1 && firstItem ? String(firstItem.id || "").trim() : "",
      title: title || "Order",
      quantity: totalQuantity,
      price: items.length === 1 && firstItem ? formatPrice(firstItem.price, detail && detail.pricing) : "",
      total: formatTotalAmount(totalAmount, detail && detail.pricing),
      payment_label: paymentMode === "before_delivery" ? String(payment && payment.label || "").trim() : "",
      payment_value: paymentMode === "before_delivery" ? String(payment && payment.value || "").trim() : "",
      payment_mode: paymentMode,
      notes: notes,
      items: items.map(function (item) {
        return {
          id: String(item.id || "").trim(),
          title: String(item.title || "").trim(),
          quantity: Math.max(0, Number(item.quantity || 0)),
          price: formatPrice(item.price, detail && detail.pricing)
        };
      })
    };
  }

  function triggerSelectedPayment(state, detail, paymentEntries, totalAmount) {
    if (!state || !state.activeShopId) return;
    var index = selectedPaymentIndex(state, state.activeShopId, paymentEntries);
    if (index < 0 || !paymentEntries[index]) return;
    var href = buildPaymentHref(paymentEntries[index], detail, totalAmount);
    if (!href) return;
    window.location.href = href;
  }

  function triggerPaymentHref(href) {
    var target = String(href || "").trim();
    if (!target) return;
    window.location.href = target;
  }

  function renderShopDetail(state) {
    if (!state.listNode || !state.activeShopId) return;
    var shop = state.shopById[state.activeShopId];
    if (!shop) {
      state.listNode.innerHTML = '<div class="shop-list-empty">Shop not found.</div>';
      return;
    }

    if (state.detailLoading) {
      state.listNode.innerHTML = '<div class="shop-pane-detail"><div class="shop-list-empty">Loading shop...</div></div>';
      return;
    }

    var detail = state.shopDetails[state.activeShopId] || shopDetailFromPreview(shop);
    var ownerMode = isOwnerViewingShop(state);
    var ownerConsole = ownerMode ? ensureShopConsole(state, state.activeShopId) : null;
    var ownerSettings = ownerMode && state.ownerPanel.tab === "settings";
    var ownerHistory = ownerMode && state.ownerPanel.tab === "history";
    var ownerOverlayOpen = ownerSettings || ownerHistory;
    var ownerPreviewMode = ownerMode && !ownerOverlayOpen;
    var ownerEditorMarkup = ownerSettings
      ? ownerSettingsMarkup(state, detail, ownerConsole)
      : ownerHistory
      ? ownerHistoryMarkup(state, detail, ownerConsole)
      : "";
    var cart = getShopCart(state, state.activeShopId);
    if (!detail) {
      state.listNode.innerHTML = '<div class="shop-pane-detail"><div class="shop-list-empty">Nothing is listed here yet.</div></div>';
      return;
    }

    var chosenItems = ownerMode ? [] : cartItems(detail, cart);
    var totalItems = chosenItems.reduce(function (sum, item) {
      return sum + item.quantity;
    }, 0);
    var totalAmount = chosenItems.reduce(function (sum, item) {
      return sum + item.total;
    }, 0);
    var totalAmountLabel = formatTotalAmount(totalAmount, detail.pricing);
    var cartView = state.activeShopView === "cart";
    var confirmationView = state.activeShopView === "confirmation";
    var query = normalizeSearch(state.searchQuery);
    var statusText = statusLabel(shop, state.userPoint);
    var locationText = String(detail.location || "").trim();
    var heroOverlineMarkup = '';
    var statsParts = [];
    if (locationText && !(ownerPreviewMode && locationText === "Location pending")) {
      statsParts.push('<span>' + escapeHtml(locationText) + '</span>');
    }
    if (detail.hours) {
      statsParts.push('<span>' + escapeHtml(detail.hours) + '</span>');
    }
    if (detail.contact) {
      statsParts.push('<span>' + escapeHtml(detail.contact) + '</span>');
    }
    var statsMarkup = statsParts.length ? (
      '<div class="shop-pane-stats">' + statsParts.join('') + '</div>'
    ) : '';
    var paymentEntries = payablePaymentEntries(detail, totalAmount);
    var paymentMode = effectivePaymentMode(state, state.activeShopId, paymentEntries);
    var chosenPaymentIndex = selectedPaymentIndex(state, state.activeShopId, paymentEntries);
    var chosenPayment = chosenPaymentIndex >= 0 ? paymentEntries[chosenPaymentIndex] : null;
    var chosenPaymentHref = chosenPayment ? buildPaymentHref(chosenPayment, detail, totalAmount) : "";
    var paymentPickerOpen = paymentMode === "before_delivery" && isPaymentPickerOpen(state, state.activeShopId);
    var canSubmitCart = totalAmount > 0 && (
      paymentMode !== "before_delivery"
      || !paymentPickerOpen
      || (!!chosenPayment && !!chosenPaymentHref)
    );
    var buyerProfile = state.buyerProfile && typeof state.buyerProfile === "object"
      ? state.buyerProfile
      : loadBuyerProfile();
    var orderNotice = checkoutNotice(state, state.activeShopId);
    var orderNoticeMarkup = orderNotice ? (
      '<div class="shop-pane-notice' + (orderNotice.tone ? (' is-' + escapeHtml(orderNotice.tone)) : '') + '">' + escapeHtml(orderNotice.message || "") + '</div>'
    ) : '';
    var confirmation = orderConfirmation(state, state.activeShopId);
    var buyerDetailsMarkup = !ownerMode ? (
      '<div class="shop-login-form shop-buyer-form">' +
        '<div class="shop-owner-form-head">' +
          '<strong>Buyer details</strong>' +
          '<span>Optional. Saved on this device for faster repeat orders.</span>' +
        '</div>' +
        '<label class="shop-login-field">' +
          '<span>Name</span>' +
          '<input class="shop-login-input" type="text" data-buyer-field="name" value="' + escapeHtml(buyerProfile.name || "") + '" placeholder="Your name" autocomplete="name" spellcheck="false">' +
        '</label>' +
        '<label class="shop-login-field">' +
          '<span>Contact</span>' +
          '<input class="shop-login-input" type="text" data-buyer-field="contact" value="' + escapeHtml(buyerProfile.contact || "") + '" placeholder="Phone or handle" autocomplete="tel" spellcheck="false">' +
        '</label>' +
      '</div>'
    ) : '';
    var paymentModeMarkup = paymentEntries.length ? (
      '<div class="shop-pane-cart-mode">' +
        '<span class="shop-pane-cart-label">When do you want to pay?</span>' +
        '<div class="shop-pane-mode-grid">' +
          '<button class="shop-pane-mode-card' + (paymentMode === "on_receive" ? ' is-selected' : '') + '" type="button" data-payment-mode="on_receive">' +
            '<strong>Pay on receive</strong>' +
            '<span>Order first. Pay the shop when you get it.</span>' +
          '</button>' +
          '<button class="shop-pane-mode-card' + (paymentMode === "before_delivery" ? ' is-selected' : '') + '" type="button" data-payment-mode="before_delivery">' +
            '<strong>Pay before</strong>' +
            '<span>Only if you trust the shop and want to prepay.</span>' +
          '</button>' +
        '</div>' +
      '</div>'
    ) : '';
    var paymentMarkup = paymentMode === "before_delivery"
      ? (
        paymentPickerOpen
          ? (
            paymentEntries.length ? (
              '<div class="shop-pane-cart-payments">' +
                '<span class="shop-pane-cart-label">' + escapeHtml(chosenPayment ? ("Selected: " + (chosenPayment.label || "Payment")) : "Select a payment method") + '</span>' +
                '<div class="shop-pane-pay-grid">' +
                  paymentEntries.map(function (payment, index) {
                    return '' +
                      '<div class="shop-pay-card' + (index === chosenPaymentIndex ? ' is-selected' : '') + '" data-pay-select="' + index + '">' +
                        '<div class="shop-pay-card-head">' +
                          '<strong>' + escapeHtml(payment.label || "Payment") + '</strong>' +
                          (payment.value ? '<button class="shop-pay-copy" type="button" data-pay-copy="' + escapeHtml(payment.value) + '" data-copy-index="' + index + '">Copy</button>' : '') +
                        '</div>' +
                        (payment.note ? '<span class="shop-pay-note">' + escapeHtml(payment.note) + '</span>' : '') +
                        (payment.value ? '<code class="shop-pay-value">' + escapeHtml(payment.value) + '</code>' : '') +
                      '</div>';
                  }).join('') +
                '</div>' +
              '</div>'
            ) : '<div class="shop-list-empty">Payments are not set up yet.</div>'
          )
          : '<div class="shop-pane-notice">Payment methods stay hidden until you continue to pay.</div>'
      )
      : '';
    var filteredItems = Array.isArray(detail.items) ? detail.items.filter(function (item) {
      return matchesSearch([item.title, item.description, item.price], query);
    }) : [];
    var itemsMarkup = filteredItems.length ? filteredItems.map(function (item) {
      var selectedQty = Math.max(0, Number(cart[item.id] || 0));
      var imageFiles = Array.isArray(item.imageFiles) ? item.imageFiles : [];
      var itemMediaMarkup = imageFiles.length
        ? '<span class="shop-pane-item-mark is-image"><img class="shop-pane-item-image" src="' + escapeHtml(assetFileUrl(imageFiles[0])) + '" alt="' + escapeHtml(item.title || "Item") + '"></span>'
        : '<span class="shop-pane-item-mark" aria-hidden="true"></span>';
      var itemMetaMarkup = ownerMode
        ? '<span>' + escapeHtml(item.quantity > 0 ? ("Qty " + item.quantity) : "Available") + '</span>'
        : '<span>' + escapeHtml(item.quantity > 0 ? ("Qty " + item.quantity) : "Available") + '</span>' +
            '<div class="shop-item-stepper">' +
              '<button class="shop-item-step" type="button" data-cart-step="-1" data-item-id="' + escapeHtml(item.id) + '"' + (selectedQty ? '' : ' disabled') + '>-</button>' +
              '<span class="shop-item-qty">' + escapeHtml(selectedQty) + '</span>' +
              '<button class="shop-item-step" type="button" data-cart-step="1" data-item-id="' + escapeHtml(item.id) + '">+</button>' +
            '</div>';
      return '' +
        '<article class="shop-pane-item">' +
          '<div class="shop-pane-item-row">' +
            itemMediaMarkup +
            '<div class="shop-pane-item-copy">' +
              '<div class="shop-pane-item-head">' +
                '<strong>' + escapeHtml(item.title) + '</strong>' +
                '<span>' + escapeHtml(formatPrice(item.price, detail.pricing) || "-") + '</span>' +
              '</div>' +
              '<p>' + escapeHtml(item.description || "Available now.") + '</p>' +
              '<div class="shop-pane-item-meta">' +
                itemMetaMarkup +
              '</div>' +
            '</div>' +
          '</div>' +
        '</article>';
    }).join('') : '<div class="shop-list-empty">' + escapeHtml(query ? "Nothing matches this search." : "Nothing is listed here yet.") + '</div>';
    var filteredCartItems = chosenItems.filter(function (item) {
      return matchesSearch([item.title, item.price], query);
    });
    var cartMarkup = filteredCartItems.length ? (
      '<div class="shop-pane-cart-items">' +
        filteredCartItems.map(function (item) {
          return '' +
            '<div class="shop-cart-row">' +
              '<div class="shop-cart-copy">' +
                '<strong>' + escapeHtml(item.title) + '</strong>' +
                '<span>' + escapeHtml(formatPrice(item.price, detail.pricing)) + '</span>' +
              '</div>' +
              '<div class="shop-cart-actions">' +
                '<button class="shop-cart-step" type="button" data-cart-step="-1" data-item-id="' + escapeHtml(item.id) + '">-</button>' +
                '<span class="shop-cart-qty">' + escapeHtml(item.quantity) + '</span>' +
                '<button class="shop-cart-step" type="button" data-cart-step="1" data-item-id="' + escapeHtml(item.id) + '">+</button>' +
              '</div>' +
            '</div>';
        }).join('') +
      '</div>' +
      '<div class="shop-pane-cart-foot">' +
        '<span>Total</span>' +
        '<strong>' + escapeHtml(totalAmountLabel) + '</strong>' +
      '</div>'
    ) : '<div class="shop-list-empty">' + escapeHtml(query ? "Nothing in the cart matches this search." : "Add items to build an order here.") + '</div>';

    var shopHeroMarkMarkup = detail.logoFile
      ? (
        '<span class="shop-pane-copy-mark is-logo">' +
          '<img class="shop-pane-logo-image" src="' + escapeHtml(shopLogoUrl(state.activeShopId)) + '" alt="' + escapeHtml((detail.name || shop.display_name || shop.shop_id || "Shop") + " logo") + '">' +
        '</span>'
      )
      : '<span class="shop-pane-copy-mark" aria-hidden="true"></span>';

    var shopHeroMarkup = (
      '<div class="shop-pane-hero">' +
        heroOverlineMarkup +
        '<div class="shop-pane-copy-row">' +
          shopHeroMarkMarkup +
          '<div class="shop-pane-copy">' +
            '<h2>' + escapeHtml(detail.name || shop.display_name || shop.shop_id) + '</h2>' +
            '<p>' + escapeHtml(detail.note || "Open this shop right from the map.") + '</p>' +
          '</div>' +
        '</div>' +
      '</div>'
    );

    var confirmationMarkup = confirmation ? (
      '<div class="shop-pane-cart-screen shop-pane-confirm-screen">' +
        '<div class="shop-pane-cart-kicker">' +
          '<span class="shop-pane-chip">Confirmed</span>' +
          '<span class="shop-pane-distance">' + escapeHtml(buyerOrderStatusText(confirmation.order || {})) + '</span>' +
        '</div>' +
        '<div class="shop-pane-cart-title">' +
          '<h2>' + escapeHtml(buyerConfirmationTitle(confirmation.order || {})) + '</h2>' +
          '<p>' + escapeHtml(buyerConfirmationMessage(confirmation.order || {})) + '</p>' +
        '</div>' +
        '<div class="shop-pane-notice">' + escapeHtml("Live status refresh runs automatically while this screen is open.") + '</div>' +
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
                '<span>' + escapeHtml(confirmation.order && (confirmation.order.total || confirmation.order.price) || "-") + '</span>' +
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
          '</div>' +
          '<p class="shop-pane-confirm-copy">' + escapeHtml(buyerOrderSummary(confirmation.order || {})) + '</p>' +
        '</div>' +
        '<div class="shop-pane-confirm-actions">' +
          '<button class="shop-cart-pay" type="button" data-confirm-items="true">Back to items</button>' +
          '<button class="shop-cart-pay shop-cart-pay-secondary" type="button" data-open-recent-orders="true">Recent history</button>' +
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
              '<div class="shop-pane-cart-kicker">' +
                '<span class="shop-pane-chip">Cart</span>' +
                '<span class="shop-pane-distance">' + escapeHtml(totalItems ? (totalItems + " item" + (totalItems === 1 ? "" : "s")) : "Empty") + '</span>' +
              '</div>' +
              '<div class="shop-pane-cart-title">' +
                '<h2>' + escapeHtml(detail.name || shop.display_name || shop.shop_id) + '</h2>' +
                '<p>' + escapeHtml(paymentMode === "before_delivery" ? "Choose a payment and pay before if you want to prepay." : "Place the order now and pay the shop when you receive it.") + '</p>' +
              '</div>' +
              orderNoticeMarkup +
              '<div class="shop-pane-cart" id="shopPaneCart">' +
                '<div class="shop-pane-cart-head">' +
                  '<strong>Cart</strong>' +
                  '<span>' + escapeHtml(totalItems ? (totalItems + " item" + (totalItems === 1 ? "" : "s")) : "Empty") + '</span>' +
                '</div>' +
                cartMarkup +
              '</div>' +
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
            statsMarkup +
            ownerEditorMarkup +
            (ownerOverlayOpen ? '' : '<div class="shop-pane-items">' + itemsMarkup + '</div>') +
            (!ownerMode && totalAmount > 0 ? '<button class="shop-cart-pay shop-cart-pay-inline" type="button" data-open-cart="true">' + escapeHtml(paymentMode === "before_delivery" ? ("Pay before " + totalAmountLabel) : "Place order") + '</button>' : '')) +
      '</section>';
    if (ownerSettings && state.ownerPanel.section === "profile") {
      ensureOwnerPickupMap(state);
    } else {
      destroyOwnerPickupMap(state);
    }
  }

  function renderLoginPane(state) {
    if (!state.listNode) return;
    destroyOwnerPickupMap(state);
    var draft = state.loginDraft || {};
    var statusTone = String(draft.tone || "").trim();
    var existingAccount = state.accountSession || loadAccountSession();
    var ownerShopCount = accountOwnerShops(existingAccount).length;
    var loginChip = ownerShopCount ? "Open shop" : "Login";
    var loginTitle = ownerShopCount ? "Open another registered shop here." : "Open your registered shop here.";
    var loginCopy = ownerShopCount
      ? "Only production-registered shops can be added to this account session on this device."
      : "Enter the username and password for an already registered production shop.";
    state.listNode.innerHTML = '' +
      '<section class="shop-pane-detail shop-login-pane">' +
        '<div class="shop-pane-hero shop-login-hero">' +
          '<div class="shop-pane-overline">' +
            '<div class="shop-pane-chip">' + escapeHtml(loginChip) + '</div>' +
            '<span class="shop-pane-distance">Debug</span>' +
          '</div>' +
          '<h2>' + escapeHtml(loginTitle) + '</h2>' +
          '<p>' + escapeHtml(loginCopy) + '</p>' +
        '</div>' +
        '<div class="shop-login-form">' +
          '<label class="shop-login-field">' +
            '<span>Username</span>' +
            '<input class="shop-login-input" type="text" data-login-field="username" value="' + escapeHtml(draft.username || "") + '" placeholder="hash" autocomplete="username" spellcheck="false">' +
          '</label>' +
          '<label class="shop-login-field">' +
            '<span>Password</span>' +
            '<input class="shop-login-input" type="password" data-login-field="password" value="' + escapeHtml(draft.password || "") + '" placeholder="Password" autocomplete="current-password">' +
          '</label>' +
          '<button class="shop-login-submit" type="button" data-login-submit="true"' + (draft.submitting ? ' disabled' : '') + '>Continue</button>' +
          '<p class="shop-login-status' + (statusTone ? (' is-' + escapeHtml(statusTone)) : '') + '">' + escapeHtml(draft.status || "") + '</p>' +
        '</div>' +
      '</section>';
  }

  function accountEntryMarkup(state) {
    var action = accountSessionAction(state);
    return '' +
      '<button class="shop-card shop-card-action" type="button" data-open-account-entry="true" style="--shop-color:' + escapeHtml(action.tone || "#ffb14a") + ';">' +
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

  function renderAccountPane(state) {
    if (!state || !state.listNode) return;
    destroyOwnerPickupMap(state);
    var session = state.accountSession || loadAccountSession();
    if (!session) {
      openDebugLoginPane(state);
      return;
    }
    var ownerShops = accountOwnerShops(session);
    var ownerCount = ownerShops.length;
    var hasOwner = ownerCount > 0 || accountHasRole(session, "owner");
    var hasBuyer = accountHasRole(session, "buyer");
    var action = accountSessionAction(state);
    var buyerProfile = state.buyerProfile && typeof state.buyerProfile === "object"
      ? state.buyerProfile
      : loadBuyerProfile();
    var recentCount = recentBuyerOrderCount(state);
    var roleMarkup = [
      hasOwner ? '<span class="shop-pane-pill">Owner</span>' : '',
      hasBuyer ? '<span class="shop-pane-pill">Buyer</span>' : ''
    ].filter(Boolean).join('');
    var sessionCopy = hasOwner && hasBuyer
      ? "Owner access lives in this account session. Guest buyer details on this device stay separate below."
      : hasOwner
      ? "Your owner session stays separate from the guest buyer cache on this device."
      : "This account session stays separate from the guest buyer cache on this device.";
    var ownerSectionMarkup = ownerCount ? (
      '<section class="shop-account-section">' +
        '<div class="shop-account-section-head">' +
          '<strong>' + escapeHtml(ownerCount > 1 ? "Owner shops" : "Owner shop") + '</strong>' +
          '<span>' + escapeHtml(ownerCount > 1 ? (ownerCount + " linked") : "Saved in this session") + '</span>' +
        '</div>' +
        '<div class="shop-account-shop-list">' +
          ownerShops.map(function (shop) {
            var shopId = String(shop && shop.shopId || "").trim();
            var isPreferred = shopId && shopId === preferredOwnerShopId(session, state.ownerShopId);
            return '' +
              '<button class="shop-account-shop' + (isPreferred ? ' is-selected' : '') + '" type="button" data-account-open-shop="' + escapeHtml(shopId) + '">' +
                '<strong>' + escapeHtml(shop.shopName || shopId) + '</strong>' +
                '<span>@' + escapeHtml(shopId) + (isPreferred ? " • active" : "") + '</span>' +
              '</button>';
          }).join('') +
        '</div>' +
      '</section>'
    ) : '';
    var guestBuyerMarkup = '' +
      '<section class="shop-account-section">' +
        '<div class="shop-account-section-head">' +
          '<strong>Guest buyer on this device</strong>' +
          '<span>' + escapeHtml(buyerHistorySummaryLabel(buyerCartEntries(state).length, recentCount)) + '</span>' +
        '</div>' +
        '<p class="shop-account-note">Buying stays available without logging in. This data is local to this device.</p>' +
        '<div class="shop-account-summary">' +
          '<div class="shop-account-summary-row">' +
            '<span>Name</span>' +
            '<strong>' + escapeHtml(buyerProfile.name || "Not set") + '</strong>' +
          '</div>' +
          '<div class="shop-account-summary-row">' +
            '<span>Contact</span>' +
            '<strong>' + escapeHtml(buyerProfile.contact || "Not set") + '</strong>' +
          '</div>' +
        '</div>' +
        '<div class="shop-account-actions">' +
          '<button class="shop-owner-save" type="button" data-account-open-orders="true">Recent history</button>' +
        '</div>' +
      '</section>';
    var accountActionsMarkup = '' +
      '<div class="shop-account-actions">' +
        (hasOwner ? '<button class="shop-owner-chip-button" type="button" data-account-open-login="true">Open shop</button>' : '') +
        '<button class="shop-owner-chip-button is-danger" type="button" data-account-logout="true">Logout</button>' +
      '</div>';
    state.listNode.innerHTML = '' +
      '<section class="shop-pane-detail" style="--shop-color:' + escapeHtml(action.tone || "#ffb14a") + ';">' +
        '<div class="shop-pane-hero">' +
          '<div class="shop-pane-overline">' +
            '<div class="shop-pane-chip">Account</div>' +
            '<span class="shop-pane-distance">' + escapeHtml(action.label || "Profile") + '</span>' +
          '</div>' +
          '<div class="shop-pane-copy-row">' +
            '<span class="shop-pane-copy-mark" aria-hidden="true"></span>' +
            '<div class="shop-pane-copy">' +
              '<h2>' + escapeHtml(action.description || session.displayName || action.label || "Profile") + '</h2>' +
              '<p>' + escapeHtml(sessionCopy) + '</p>' +
            '</div>' +
          '</div>' +
          (roleMarkup ? '<div class="shop-account-role-row">' + roleMarkup + '</div>' : '') +
        '</div>' +
        '<div class="shop-account-stack">' +
          ownerSectionMarkup +
          guestBuyerMarkup +
          accountActionsMarkup +
        '</div>' +
      '</section>';
  }

  function recentOrdersEntryMarkup(state) {
    var recentCount = recentBuyerOrderCount(state);
    var cartCount = buyerCartEntries(state).length;
    var subline = cartCount || recentCount
      ? "Carts and orders together"
      : "Carts and orders show up here";
    return '' +
      '<button class="shop-card shop-card-action" type="button" data-open-recent-orders="true" style="--shop-color:#29c6ea;">' +
        '<div class="shop-card-head">' +
          '<span class="shop-card-mark" aria-hidden="true"></span>' +
          '<strong>Recent history</strong>' +
          '<span class="shop-card-open">Open</span>' +
        '</div>' +
        '<div class="shop-card-meta">' +
          '<span>' + escapeHtml(buyerHistorySummaryLabel(cartCount, recentCount)) + '</span>' +
          '<span>' + escapeHtml(subline) + '</span>' +
        '</div>' +
      '</button>';
  }

  function buyerCartEntries(state) {
    if (!state || !state.cartByShop) return [];
    return Object.keys(state.cartByShop).map(function (shopId) {
      var safeShopId = String(shopId || "").trim();
      if (!safeShopId) return null;
      var rawCart = state.cartByShop[safeShopId];
      var itemCount = Object.keys(rawCart || {}).reduce(function (sum, key) {
        return sum + Math.max(0, Number(rawCart[key] || 0));
      }, 0);
      if (!itemCount) return null;
      var shop = state.shopById[safeShopId] || null;
      var detail = state.shopDetails[safeShopId] || shopDetailFromPreview(shop);
      var items = detail ? cartItems(detail, rawCart) : [];
      var totalAmount = items.reduce(function (sum, item) {
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
      var countDelta = Number(right.itemCount || 0) - Number(left.itemCount || 0);
      if (countDelta) return countDelta;
      return String(left.shopName || left.shopId).localeCompare(String(right.shopName || right.shopId));
    });
  }

  function renderRecentOrdersPane(state) {
    if (!state || !state.listNode) return;
    destroyOwnerPickupMap(state);
    var query = normalizeSearch(state.searchQuery);
    var orders = Array.isArray(state.buyerOrders) ? state.buyerOrders : [];
    var cartEntries = buyerCartEntries(state);
    var filteredCartEntries = cartEntries.filter(function (entry) {
      return matchesSearch([
        entry.shopName,
        entry.shopId,
        entry.totalLabel,
        entry.itemSummary,
        entry.itemCount ? (entry.itemCount + " items") : ""
      ], query);
    });
    var filteredOrders = orders.filter(function (order) {
      return matchesSearch([
        order.title,
        order.shopName,
        order.shopId,
        order.paymentLabel,
        order.paymentMode,
        order.status,
        order.total,
        order.notes,
        order.address,
        buyerOrderSummary(order)
      ], query);
    });
    var buyerProfile = state.buyerProfile && typeof state.buyerProfile === "object"
      ? state.buyerProfile
      : loadBuyerProfile();
    var overlineLabel = state.buyerOrdersLoading
      ? "Syncing"
      : buyerHistorySummaryLabel(cartEntries.length, orders.length);
    var cartMarkup = filteredCartEntries.length ? (
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
        ? '<div class="shop-list-empty">No carts match this search.</div>'
        : ''
    );
    var ordersMarkup = state.buyerOrdersLoading && !orders.length
      ? '<div class="shop-list-empty">Loading recent history...</div>'
      : (filteredOrders.length ? (
          '<div class="shop-owner-order-list">' +
            filteredOrders.map(function (order) {
              return '' +
                '<article class="shop-owner-order-card shop-buyer-order-card" style="--shop-color:' + escapeHtml(order.shopMapColor || "#29c6ea") + ';">' +
                  '<div class="shop-owner-order-head">' +
                    '<strong>' + escapeHtml(order.title || "Order") + '</strong>' +
                    '<span>' + escapeHtml(buyerOrderStatusText(order)) + '</span>' +
                  '</div>' +
                  '<div class="shop-owner-order-meta">' +
                    '<span class="shop-buyer-order-shop">@' + escapeHtml(order.shopId || "") + ' · ' + escapeHtml(order.shopName || order.shopId || "Shop") + '</span>' +
                    '<span>' + escapeHtml(formatOrderTimestamp(order.timestamp)) + '</span>' +
                  '</div>' +
                  '<div class="shop-owner-order-meta">' +
                    '<span>' + escapeHtml(orderPaymentModeLabel(order) + ' • ' + (order.paymentLabel || "Order")) + '</span>' +
                    '<span>' + escapeHtml(order.total || order.price || "-") + '</span>' +
                  '</div>' +
                  '<p>' + escapeHtml(buyerOrderSummary(order)) + '</p>' +
                  '<div class="shop-owner-order-actions">' +
                    '<button class="shop-owner-save" type="button" data-open-recent-shop="' + escapeHtml(order.shopId || "") + '">Open shop</button>' +
                  '</div>' +
                '</article>';
            }).join('') +
          '</div>'
        ) : '<div class="shop-list-empty">' + escapeHtml(query ? "Nothing in recent history matches this search." : "Your recent carts and orders will show up here.") + '</div>');
    var statusMarkup = state.buyerOrdersError
      ? '<div class="shop-pane-notice is-error">' + escapeHtml(state.buyerOrdersError) + '</div>'
      : '';
    state.listNode.innerHTML = '' +
      '<section class="shop-pane-detail" style="--shop-color:#29c6ea;">' +
        '<div class="shop-pane-hero">' +
          '<div class="shop-pane-overline">' +
            '<div class="shop-pane-chip">Recent history</div>' +
            '<span class="shop-pane-distance">' + escapeHtml(overlineLabel) + '</span>' +
          '</div>' +
          '<div class="shop-pane-copy-row">' +
            '<span class="shop-pane-copy-mark" aria-hidden="true"></span>' +
            '<div class="shop-pane-copy">' +
              '<h2>Recent history</h2>' +
              '<p>Your open carts and recent history show up here.</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
        statusMarkup +
        cartMarkup +
        ordersMarkup +
      '</section>';
  }

  function renderShopList(state) {
    if (!state.listNode) return;
    syncBuyerOrdersPolling(state);
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
    if (!state.shops.length) {
      state.listNode.innerHTML = '<div class="shop-list-empty">No shops are on the map yet.</div>';
      return;
    }
    var query = normalizeSearch(state.searchQuery);
    var visibleShops = orderedShops(state.shops, state.userPoint).filter(function (shop) {
      var preview = shop && shop.preview && typeof shop.preview === "object" ? shop.preview : {};
      return matchesSearch([
        shop.display_name,
        shop.shop_id,
        shop.location_label,
        preview.type,
        preview.note,
        preview.contact
      ], query);
    });
    if (!visibleShops.length) {
      state.listNode.innerHTML = '<div class="shop-list-empty">' + escapeHtml(query ? "No shops match this search." : "No shops are on the map yet.") + '</div>';
      return;
    }
    state.listNode.innerHTML = visibleShops.map(function (shop) {
      var preview = shop && shop.preview && typeof shop.preview === "object" ? shop.preview : {};
      var previewDetail = state.shopDetails[String(shop.shop_id || "").trim()] || shopDetailFromPreview(shop);
      var note = clampText((previewDetail && previewDetail.note) || shop.location_label || "", 96);
      var descriptor = clampText((previewDetail && previewDetail.type) || preview.type || (shop.has_location ? "On map" : "Local shop"), 28);
      var distance = clampText(statusLabel(shop, state.userPoint), 24);
      var secondary = clampText(
        (previewDetail && previewDetail.contact)
          || shop.location_label
          || statusLabel(shop, state.userPoint),
        34
      );
      return '' +
        '<a class="shop-card" data-shop-id="' + escapeHtml(shop.shop_id || "") + '" style="--shop-color:' + escapeHtml(shopColor(shop)) + ';" href="' + escapeHtml(shopUrl(shop)) + '">' +
          '<div class="shop-card-head">' +
            '<span class="shop-card-mark" aria-hidden="true"></span>' +
            '<strong>' + escapeHtml(shop.display_name || shop.shop_id) + '</strong>' +
            '<span class="shop-card-open">Open</span>' +
          '</div>' +
          '<div class="shop-card-tags">' +
            '<span class="shop-card-tag">' + escapeHtml(descriptor) + '</span>' +
            '<span class="shop-card-tag shop-card-tag-soft">' + escapeHtml(distance) + '</span>' +
          '</div>' +
          (note ? '<p class="shop-card-note">' + escapeHtml(note) + '</p>' : '') +
          '<div class="shop-card-meta">' +
            '<span>@' + escapeHtml(shop.shop_id || "") + '</span>' +
            '<span>' + escapeHtml(secondary) + '</span>' +
          '</div>' +
        '</a>';
    }).join("");
  }

  function updateSearchField(state) {
    if (!state || !state.searchInput) return;
    var searchHead = state.searchInput.closest(".shop-list-head");
    var hidden = state.debugPaneView === "login"
      || state.debugPaneView === "account"
      || (state.activeShopView === "confirmation")
      || (isOwnerViewingShop(state) && (
        state.ownerPanel.tab === "settings"
        || (state.ownerPanel.tab === "history" && state.ownerPanel.section === "stats")
      ));
    if (searchHead) {
      searchHead.hidden = hidden;
    }
    state.searchInput.disabled = hidden;
    if (hidden) {
      return;
    }
    var placeholder = "Search shops";
    if (state.debugPaneView === "recent-orders") {
      placeholder = "Search history";
    } else if (state.activeShopId) {
      if (isOwnerViewingShop(state) && state.ownerPanel.tab === "history") {
        placeholder = state.ownerPanel.section === "items" ? "Search items" : "Search orders";
      } else {
        placeholder = state.activeShopView === "cart" ? "Search cart" : "Search items";
      }
    }
    state.searchInput.placeholder = placeholder;
    state.searchInput.setAttribute("aria-label", placeholder);
    if (state.searchInput.value !== String(state.searchQuery || "")) {
      state.searchInput.value = String(state.searchQuery || "");
    }
  }

  function setLocateButtonState(button, mode, label) {
    if (!button) return;
    button.classList.remove("is-loading", "is-active", "is-error", "is-danger");
    if (mode) button.classList.add(mode);
    button.textContent = label;
  }

  function setPaneNavButtonState(button, options) {
    if (!button) return;
    var settings = options && typeof options === "object" ? options : {};
    var label = String(settings.label || "").trim();
    var count = Math.max(0, Number(settings.count || 0) || 0);
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

  function resetPaneScroll(state) {
    if (!state || !state.listNode) return;
    state.listNode.scrollTop = 0;
  }

  function scrollOwnerSectionIntoView(state, sectionName) {
    if (!state || !state.listNode || !sectionName) return;
    window.requestAnimationFrame(function () {
      var node = state.listNode.querySelector('[data-owner-section-root="' + sectionName + '"]');
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
    var openSection = String(state.ownerPanel.section || "").trim();
    var sections = Array.from(state.listNode.querySelectorAll("[data-owner-section-root]"));
    sections.forEach(function (section) {
      if (!(section instanceof HTMLElement)) return;
      var key = String(section.getAttribute("data-owner-section-root") || "").trim();
      var isOpen = !!openSection && key === openSection;
      section.classList.toggle("is-open", isOpen);
      var button = section.querySelector("[data-owner-section-toggle]");
      if (button instanceof HTMLButtonElement) {
        button.setAttribute("aria-expanded", String(isOpen));
      }
      var body = section.querySelector(".shop-owner-section-body");
      if (body instanceof HTMLElement) {
        body.setAttribute("aria-hidden", String(!isOpen));
      }
    });
    if (openSection === "profile") {
      ensureOwnerPickupMap(state);
    }
  }

  function syncActionButton(state) {
    if (!state) return;
    var ownerOrdersMode = shouldUseOwnerOrdersNav(state);
    var ownerPendingCount = ownerPendingOrdersNavCount(state);
    var ownerOrdersActive = ownerOrdersNavActive(state);
    setPaneNavButtonState(state.ordersButton, {
      hidden: state.debugPaneView === "login",
      active: ownerOrdersMode ? ownerOrdersActive : state.debugPaneView === "recent-orders",
      loading: ownerOrdersMode ? !!state.ownerOrdersNavLoading : (state.debugPaneView === "recent-orders" && state.buyerOrdersLoading),
      count: ownerOrdersMode ? ownerPendingCount : recentBuyerOrderCount(state),
      label: ownerOrdersMode
        ? (
          ownerOrdersActive
            ? (state.ownerOrdersNavLoading ? "Refreshing shop history" : "Shop history")
            : (
              ownerPendingCount
                ? (ownerPendingCount === 1 ? "1 pending shop order" : (ownerPendingCount + " pending shop orders"))
                : "Open shop history"
            )
        )
        : (
          state.debugPaneView === "recent-orders"
            ? (state.buyerOrdersLoading ? "Refreshing recent history" : "Recent history")
            : "Open recent history"
        )
    });
    setPaneNavButtonState(state.navLocateButton, {
      hidden: state.debugPaneView === "login",
      active: !state.locateLoading && !!state.userPoint,
      loading: !!state.locateLoading,
      label: state.locateLoading ? "Locating..." : (state.userPoint ? "Locate me again" : "Locate me")
    });
    if (!state.locateButton) return;
    state.locateButton.classList.toggle(
      "is-hidden",
      !state.activeShopId || state.debugPaneView === "login" || state.debugPaneView === "account" || state.debugPaneView === "recent-orders"
    );
    if (state.debugPaneView === "login" || state.debugPaneView === "account" || state.debugPaneView === "recent-orders" || !state.activeShopId) {
      setLocateButtonState(state.locateButton, "", "Cart");
      return;
    }
    if (state.activeShopId) {
      if (isOwnerViewingShop(state)) {
        setLocateButtonState(
          state.locateButton,
          "",
          state.ownerPanel.tab ? "Items" : "Settings"
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
      var count = cartCount(state, state.activeShopId);
      setLocateButtonState(state.locateButton, count ? "is-active" : "", count ? ("Cart (" + count + ")") : "Cart");
      return;
    }
  }

  function pulseUserMarker(state) {
    if (!state || !state.userMarker || typeof state.userMarker.getElement !== "function") return;
    var markerNode = state.userMarker.getElement();
    if (!(markerNode instanceof HTMLElement)) return;
    var target = markerNode.querySelector(".map-user-marker");
    if (!(target instanceof HTMLElement)) return;
    target.classList.remove("is-revealed");
    window.requestAnimationFrame(function () {
      target.classList.add("is-revealed");
      window.setTimeout(function () {
        target.classList.remove("is-revealed");
      }, 960);
    });
  }

  function logoutOwnerSession(state) {
    clearShopIdentity();
    state.accountSession = null;
    state.ownerShopId = "";
    state.ownerOrdersNavLoading = false;
    state.ownerPanel.tab = "";
    state.ownerPanel.section = "";
    state.ownerPanel.itemId = "";
    state.ownerPanel.message = "";
    state.ownerPanel.tone = "";
    state.debugPaneView = "";
    state.activeShopView = "items";
    state.searchQuery = "";
    state.panelNode.classList.remove("is-login-view");
    syncPaneUrl(state);
    if (state.loginDraft) {
      state.loginDraft.username = "";
      state.loginDraft.password = "";
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

  function syncBackButton(state) {
    if (!state || !state.backButton) return;
    var backMode = !!state.activeShopId || !!state.debugPaneView;
    var action = accountSessionAction(state);
    state.backButton.classList.add("is-visible");
    state.backButton.setAttribute("aria-hidden", "false");
    state.backButton.tabIndex = 0;
    state.backButton.textContent = backMode ? "Back" : action.label;
    state.backButton.setAttribute("aria-label", backMode ? "Back to shops" : ("Open " + action.label));
    state.backButton.classList.toggle("is-login", !backMode && action.kind === "login");
  }

  function refreshBuyerOrders(state, options) {
    if (!state) return Promise.resolve([]);
    var force = !!(options && options.force);
    var silent = !!(options && options.silent);
    if (state.buyerOrdersLoading && !force) {
      return Promise.resolve(Array.isArray(state.buyerOrders) ? state.buyerOrders : []);
    }
    var buyerKey = ensureBuyerKey();
    if (!silent) {
      state.buyerOrdersLoading = true;
      state.buyerOrdersError = "";
      syncActionButton(state);
    }
    if (!silent && (state.debugPaneView === "recent-orders" || state.activeShopView === "confirmation")) {
      renderShopList(state);
    }
    return fetchBuyerOrders(buyerKey, 40)
      .then(function (result) {
        if (!result || !result.ok) {
          throw new Error(String(result && result.payload && result.payload.error || "buyer_orders_failed"));
        }
        var orders = Array.isArray(result.payload && result.payload.orders) ? result.payload.orders : [];
        state.buyerOrders = orders;
        state.buyerOrdersLoading = false;
        state.buyerOrdersError = "";
        var existingRefs = state.buyerProfile && Array.isArray(state.buyerProfile.recentOrderRefs)
          ? state.buyerProfile.recentOrderRefs
          : [];
        var orderRefs = orders.map(function (order) {
          return {
            orderId: String(order && order.id || "").trim(),
            shopId: String(order && order.shopId || "").trim(),
            timestamp: Number(order && order.timestamp || 0)
          };
        });
        var firstNamedOrder = orders.find(function (order) {
          return !!String(order && (order.buyerName || order.buyerContact) || "").trim();
        }) || null;
        syncActiveConfirmationFromBuyerOrders(state);
        setBuyerProfile(state, {
          buyerKey: buyerKey,
          name: String(firstNamedOrder && firstNamedOrder.buyerName || state.buyerProfile.name || "").trim(),
          contact: String(firstNamedOrder && firstNamedOrder.buyerContact || state.buyerProfile.contact || "").trim(),
          recentOrderRefs: normalizeBuyerRecentRefs(orderRefs.concat(existingRefs))
        });
        syncActionButton(state);
        if (state.debugPaneView === "recent-orders" || state.activeShopView === "confirmation") {
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
        if (!silent && (state.debugPaneView === "recent-orders" || state.activeShopView === "confirmation")) {
          renderShopList(state);
        }
        return [];
      });
  }

  function panelBottomPadding(state) {
    if (!state || !state.panelNode) return 24;
    var panelHeight = state.panelNode.offsetHeight || 0;
    return Math.max(24, Math.min(Math.round(panelHeight + 24), Math.round(window.innerHeight * 0.54)));
  }

  function fitArea(map, points, bottomPadding) {
    if (!map || !points || !points.length) return;
    var verticalPadding = bottomPadding == null ? 24 : bottomPadding;
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

  function focusShopOnMap(state, shop) {
    if (!state || !state.map || !shop || !shop.has_location || !isFinite(shop.lat) || !isFinite(shop.lng)) return;
    var point = [shop.lat, shop.lng];
    var bottomPadding = panelBottomPadding(state);
    state.map.fitBounds(window.L.latLng(point).toBounds(210), {
      paddingTopLeft: [24, 24],
      paddingBottomRight: [24, bottomPadding],
      maxZoom: 18
    });
  }

  function updateMapView(state) {
    if (!state || !state.map) return;
    var bottomPadding = panelBottomPadding(state);
    var activeShop = state.activeShopId ? state.shopById[state.activeShopId] : null;
    if (activeShop && activeShop.has_location && isFinite(activeShop.lat) && isFinite(activeShop.lng)) {
      state.map.fitBounds(window.L.latLng([activeShop.lat, activeShop.lng]).toBounds(210), {
        paddingTopLeft: [24, 24],
        paddingBottomRight: [24, bottomPadding],
        maxZoom: 18
      });
      return;
    }
    if (state.userPoint) {
      state.map.fitBounds(window.L.latLng(state.userPoint).toBounds(700), {
        paddingTopLeft: [24, 24],
        paddingBottomRight: [24, bottomPadding],
        maxZoom: 18
      });
      return;
    }
    state.map.setView(DEFAULT_DISCOVERY_CENTER, DEFAULT_DISCOVERY_ZOOM, { animate: false });
  }

  function stabilizeMapViewport(state, delay) {
    if (!state || !state.map) return;
    var wait = Number(delay || 0);
    window.setTimeout(function () {
      if (!state.map) return;
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
    var isFocused = !!(state && state.isExpanded && state.expandMode === "full");
    if (state && state.shellNode) {
      state.shellNode.classList.toggle("is-pane-focused", isFocused);
    }
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
    stabilizeMapViewport(state, 240);
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
    state.searchQuery = "";
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function openOwnerSettingsPane(state, options) {
    if (!state || !state.activeShopId || !isOwnerViewingShop(state)) return;
    state.debugPaneView = "";
    state.activeShopView = "items";
    state.detailLoading = false;
    state.searchQuery = "";
    state.ownerPanel.tab = "settings";
    state.ownerPanel.section = normalizeOwnerSettingsSection(options && options.section || state.ownerPanel.section || "profile");
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
    var shopId = String(options && options.shopId || ownerOrdersNavShopId(state) || "").trim();
    if (!shopId) {
      if (state.accountSession) {
        openAccountPane(state);
      } else {
        openBuyerOrdersPane(state, options);
      }
      return;
    }
    var section = normalizeOwnerHistorySection(options && options.section || "orders");
    if (state.activeShopId === shopId && isOwnerViewingShop(state)) {
      state.debugPaneView = "";
      state.activeShopView = "items";
      state.detailLoading = false;
      state.searchQuery = "";
      state.ownerPanel.tab = "history";
      state.ownerPanel.section = section;
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
      ownerSection: section
    });
  }

  function openBuyerOrdersPane(state, options) {
    if (!state) return;
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
    setPaneExpanded(state, true, "full");
    syncPaneUrl(state);
    renderShopList(state);
    resetPaneScroll(state);
    refreshBuyerOrders(state, { force: !!(options && options.force) });
  }

  function openOwnerOrdersPane(state, options) {
    openOwnerHistoryPane(state, Object.assign({}, options || {}, { section: "orders" }));
  }

  function openAccountPane(state) {
    if (!state) return;
    if (!state.accountSession) {
      openDebugLoginPane(state);
      return;
    }
    state.debugPaneView = "account";
    state.activeShopId = "";
    state.activeShopView = "items";
    state.detailLoading = false;
    state.searchQuery = "";
    state.panelNode.classList.remove("is-shop-view");
    state.panelNode.classList.remove("is-login-view");
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    setPaneExpanded(state, true, "full");
    syncPaneUrl(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function closeAccountPane(state) {
    if (!state || state.debugPaneView !== "account") return;
    state.debugPaneView = "";
    state.searchQuery = "";
    var keepExpanded = !!state.userPoint;
    setPaneExpanded(state, keepExpanded, keepExpanded ? "full" : "normal");
    syncPaneUrl(state);
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function closeBuyerOrdersPane(state) {
    if (!state || state.debugPaneView !== "recent-orders") return;
    state.debugPaneView = "";
    state.searchQuery = "";
    var keepExpanded = !!state.userPoint;
    setPaneExpanded(state, keepExpanded, keepExpanded ? "full" : "normal");
    syncPaneUrl(state);
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function openDebugLoginPane(state) {
    if (!state) return;
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
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    setPaneExpanded(state, true, "full");
    syncPaneUrl(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function closeDebugLoginPane(state) {
    if (!state || state.debugPaneView !== "login") return;
    state.debugPaneView = "";
    state.searchQuery = "";
    state.loginDraft.password = "";
    state.loginDraft.status = "";
    state.loginDraft.tone = "";
    state.loginDraft.submitting = false;
    state.panelNode.classList.remove("is-login-view");
    var keepExpanded = !!state.userPoint;
    setPaneExpanded(state, keepExpanded, keepExpanded ? "full" : "normal");
    syncPaneUrl(state);
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function openSavedOwnerShop(state, options) {
    if (!state) return;
    var shopId = String(options && options.shopId || state.ownerShopId || preferredOwnerShopId(state.accountSession, state.ownerShopId) || "").trim();
    if (!shopId) {
      if (state.accountSession) {
        openAccountPane(state);
      } else {
        openDebugLoginPane(state);
      }
      return;
    }
    setPreferredOwnerShop(state, shopId);
    var savedName = String(preferredOwnerShopName(state.accountSession, shopId) || loadSavedShopName() || "").trim();
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
        clearShopIdentity();
        state.accountSession = null;
        state.ownerShopId = "";
        state.loginDraft.username = "";
        state.loginDraft.password = "";
        state.loginDraft.status = "Saved shop not found. Log in again.";
        state.loginDraft.tone = "error";
        syncBackButton(state);
        openDebugLoginPane(state);
      });
  }

  function submitDebugLoginPane(state) {
    if (!state || state.debugPaneView !== "login") return;
    if (state.loginDraft.submitting) return;

    var username = String(state.loginDraft.username || "").trim();
    var password = String(state.loginDraft.password || "");
    var shopId = slugify(username);
    if (!username || !shopId) {
      state.loginDraft.tone = "error";
      state.loginDraft.status = "Enter a username.";
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
            return {
              ok: false,
              message: exists
                ? "Wrong password."
                : "This shop is not registered. Production registration is explicit only."
            };
          });
        }
        return {
          ok: false,
          message: "Could not open this production shop."
        };
      })
      .then(function (result) {
        if (!result || !result.ok) {
          state.loginDraft.submitting = false;
          state.loginDraft.tone = "error";
          state.loginDraft.status = String(result && result.message || "Could not open this production shop.");
          renderShopList(state);
          return;
        }

        var shopRecord = result.payload && result.payload.shop;
        var mergedShop = mergeShopRecord(state, shopRecord || { shop_id: shopId, display_name: username }, username);
        state.accountSession = saveShopIdentity(String(mergedShop && mergedShop.display_name || username).trim(), shopId);
        setPreferredOwnerShop(state, shopId);
        state.ownerPanel.tab = "";
        state.ownerPanel.section = "";
        state.ownerPanel.itemId = "";
        state.ownerPanel.message = "";
        state.ownerPanel.tone = "";
        state.debugPaneView = "";
        state.loginDraft.submitting = false;
        state.loginDraft.password = "";
        state.loginDraft.tone = "success";
        state.loginDraft.status = "Opened.";
        state.panelNode.classList.remove("is-login-view");
        openShopInPane(state, shopId);
      })
      .catch(function () {
        state.loginDraft.submitting = false;
        state.loginDraft.tone = "error";
        state.loginDraft.status = "Could not open this production shop.";
        renderShopList(state);
      });
  }

  function setPaneDragOffset(state, offset) {
    if (!state || !state.panelNode) return;
    state.panelNode.style.setProperty("--pane-drag-offset", Math.round(offset || 0) + "px");
  }

  function clearPaneDragOffset(state) {
    if (!state || !state.panelNode) return;
    state.panelNode.style.removeProperty("--pane-drag-offset");
    state.panelNode.classList.remove("is-dragging");
  }

  function installPaneToggleDrag(state) {
    if (!state || !state.toggleButton || !state.panelNode) return;
    var drag = null;

    function stopDrag(event) {
      if (!drag) return;
      var moved = drag.moved;
      var deltaY = drag.lastY - drag.startY;
      var button = drag.button;
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
      var deltaY = event.clientY - drag.startY;
      if (Math.abs(deltaY) > 4) {
        drag.moved = true;
      }
      drag.lastY = event.clientY;
      var limit = state.isExpanded ? 84 : 64;
      var offset = Math.max(-limit, Math.min(limit, deltaY));
      setPaneDragOffset(state, offset);
    });

    state.toggleButton.addEventListener("pointerup", stopDrag);
    state.toggleButton.addEventListener("pointercancel", stopDrag);
  }

  function openShopInPane(state, shopId, options) {
    if (!state || !shopId) return;
    var ownerTab = String(options && options.ownerTab || "").trim();
    var ownerSection = String(options && options.ownerSection || "").trim();
    if (ownerTab === "settings") {
      ownerSection = normalizeOwnerSettingsSection(ownerSection);
    } else if (ownerTab === "history") {
      ownerSection = normalizeOwnerHistorySection(ownerSection);
    } else {
      ownerSection = "";
    }
    if (state.accountSession && accountOwnerShops(state.accountSession).some(function (shop) {
      return String(shop && shop.shopId || "").trim() === String(shopId || "").trim();
    })) {
      setPreferredOwnerShop(state, shopId);
    }
    var previewDetail = state.shopDetails[shopId] || shopDetailFromPreview(state.shopById[shopId]);
    state.debugPaneView = "";
    state.activeShopId = shopId;
    state.activeShopView = "items";
    setSelectedPaymentMode(state, shopId, "on_receive");
    state.ownerPanel.tab = ownerTab;
    state.ownerPanel.section = ownerSection;
    state.ownerPanel.itemId = "";
    state.ownerPanel.message = "";
    state.ownerPanel.tone = "";
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

    if (previewDetail) {
      state.detailLoading = false;
      renderShopList(state);
      resetPaneScroll(state);
      if (ownerTab === "history" && ownerSection === "items") {
        refreshItemLibrary(state, { force: false });
      }
      window.setTimeout(function () {
        focusShopOnMap(state, state.shopById[shopId]);
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
        if (ownerTab === "history" && ownerSection === "items") {
          refreshItemLibrary(state, { force: false });
        }
      });
  }

  function closeShopInPane(state) {
    if (!state) return;
    var closingShopId = state.activeShopId;
    state.activeShopId = "";
    state.activeShopView = "items";
    state.ownerPanel.tab = "";
    state.ownerPanel.section = "";
    state.ownerPanel.itemId = "";
    state.ownerPanel.message = "";
    state.ownerPanel.tone = "";
    state.searchQuery = "";
    state.detailLoading = false;
    setOrderConfirmation(state, closingShopId, null);
    state.panelNode.classList.remove("is-shop-view");
    var keepExpanded = !!state.userPoint;
    setPaneExpanded(state, keepExpanded, keepExpanded ? "full" : "normal");
    syncPaneUrl(state);
    updateSearchField(state);
    syncActionButton(state);
    syncBackButton(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function addToCart(state, shopId, itemId, delta) {
    if (!state || !shopId || !itemId || !delta) return;
    var cart = getShopCart(state, shopId);
    var next = Math.max(0, Number(cart[itemId] || 0) + delta);
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
    updateSearchField(state);
    syncActionButton(state);
    renderShopList(state);
    resetPaneScroll(state);
  }

  function installReliableBaseLayer(map) {
    if (!map || !window.L) return null;

    var providers = [
      {
        layers: [
          {
            url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
            options: {
              maxZoom: 20,
              subdomains: "abcd",
              attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
            }
          }
        ]
      },
      {
        layers: [
          {
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
            options: {
              maxZoom: 16,
              attribution: "Tiles &copy; Esri"
            }
          },
          {
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
            options: {
              maxZoom: 16,
              attribution: "Labels &copy; Esri"
            }
          }
        ]
      }
    ];

    var activeIndex = -1;
    var activeLayers = [];
    var loadedAnyTile = false;
    var fallbackTimer = null;

    function clearFallbackTimer() {
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    }

    function attach(index) {
      var provider = providers[index];
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
        var layer = window.L.tileLayer(config.url, config.options);
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

  function upsertUserMarker(state, lat, lng, accuracy) {
    if (!state || !state.map) return;
    state.userPoint = [lat, lng];
    try {
      window.localStorage.setItem("hashop_last_location", JSON.stringify({
        lat: lat,
        lng: lng,
        accuracy: accuracy || 0
      }));
    } catch (error) {}
    if (!state.userMarker) {
      state.userMarker = window.L.marker([lat, lng], {
        icon: window.L.divIcon({
          className: "",
          html: '<div class="map-user-marker"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        })
      }).addTo(state.map);
    } else {
      state.userMarker.setLatLng([lat, lng]);
    }

    if (!state.userAccuracy) {
      state.userAccuracy = window.L.circle([lat, lng], {
        radius: Math.max(Number(accuracy) || 0, 40),
        color: "rgba(41, 198, 234, 0.5)",
        weight: 1,
        fillColor: "rgba(41, 198, 234, 0.12)",
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
    syncActionButton(state);
    if (!navigator.geolocation) {
      state.locateLoading = false;
      syncActionButton(state);
      setLocateButtonState(state.locateButton, "is-error", "No GPS");
      return;
    }
    setLocateButtonState(state.locateButton, "is-loading", "Locating...");
    navigator.geolocation.getCurrentPosition(function (position) {
      var lat = position && position.coords ? position.coords.latitude : null;
      var lng = position && position.coords ? position.coords.longitude : null;
      var accuracy = position && position.coords ? position.coords.accuracy : 0;
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
    if (!state || !state.mapNode || !window.L) return;
    var map = window.L.map(state.mapNode, {
      zoomControl: false,
      attributionControl: true,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false
    });
    state.map = map;
    installReliableBaseLayer(map);

    state.shops.filter(function (shop) {
      return shop.has_location && isFinite(shop.lat) && isFinite(shop.lng);
    }).forEach(function (shop) {
      var point = [shop.lat, shop.lng];
      state.shopPoints.push(point);
      var icon = window.L.divIcon({
        className: "",
        html: '<div class="map-shop-marker" style="--shop-color:' + escapeHtml(shopColor(shop)) + ';"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -12]
      });
      window.L.marker(point, { icon: icon })
        .addTo(map)
        .bindPopup(buildPopup(shop, state.userPoint), { closeButton: false, autoPanPadding: [20, 20] });
    });

    updateMapView(state);
    maybeLocateOnLoad(state);
    map.whenReady(function () {
      stabilizeMapViewport(state, 0);
      stabilizeMapViewport(state, 120);
    });
  }

  var bootstrap = loadBootstrap();
  var initialAccountSession = loadAccountSession();
  var state = {
    shops: Array.isArray(bootstrap.map_shops) ? bootstrap.map_shops : [],
    shopById: {},
    shopDetails: {},
    shopConsoles: {},
    map: null,
    shopPoints: [],
    userPoint: null,
    userMarker: null,
    userAccuracy: null,
    isExpanded: false,
    expandMode: "normal",
    activeShopId: "",
    activeShopView: "items",
    debugPaneView: "",
    detailLoading: false,
    suppressToggleClickUntil: 0,
    searchQuery: "",
    shellNode: document.querySelector(".shell-home"),
    mapNode: document.getElementById("discoveryMap"),
    panelNode: document.querySelector(".shop-list-panel"),
    listNode: document.getElementById("shopList"),
    searchInput: document.getElementById("shopSearchInput"),
    locateButton: document.getElementById("locateAction"),
    ordersButton: document.getElementById("ordersAction"),
    navLocateButton: document.getElementById("mapLocateAction"),
    backButton: document.getElementById("shopBackAction"),
    toggleButton: document.getElementById("shopPaneToggle"),
    loginNode: document.querySelector(".home-login-fab"),
    accountSession: initialAccountSession,
    ownerShopId: preferredOwnerShopId(initialAccountSession),
    ownerPanel: {
      tab: "",
      section: "",
      itemId: "",
      message: "",
      tone: "",
      saving: false
    },
    cartByShop: {},
    selectedPaymentByShop: {},
    paymentModeByShop: {},
    checkoutNoticeByShop: {},
    orderConfirmationByShop: {},
    ownerOrderDraftByShop: {},
    itemLibrary: [],
    itemLibraryLoading: false,
    itemLibraryError: "",
    buyerProfile: loadBuyerProfile(),
    buyerOrders: [],
    buyerOrdersLoading: false,
    buyerOrdersError: "",
    buyerOrdersPollTimer: 0,
    ownerOrdersNavLoading: false,
    locateLoading: false,
    locateRevealTimer: 0,
    loginDraft: {
      username: preferredOwnerShopName(initialAccountSession),
      password: "",
      status: "",
      tone: "",
      submitting: false
    }
  };

  state.shops.forEach(function (shop) {
    state.shopById[String(shop.shop_id || "").trim()] = shop;
  });
  setBuyerProfile(state, state.buyerProfile);
  setAccountSession(state, state.accountSession);
  pruneAccountSessionToKnownShops(state);

  renderShopList(state);
  updateSearchField(state);
  syncActionButton(state);
  syncBackButton(state);
  initMap(state);
  refreshOwnerOrdersNavData(state);

  if (INITIAL_PANE === "login") {
    openDebugLoginPane(state);
  } else if (INITIAL_PANE === "account") {
    openAccountPane(state);
  } else if (INITIAL_PANE === "orders") {
    if (shouldUseOwnerOrdersNav(state)) {
      openOwnerOrdersPane(state);
    } else {
      openBuyerOrdersPane(state);
    }
  }

  if (state.searchInput) {
    state.searchInput.addEventListener("input", function () {
      state.searchQuery = String(state.searchInput.value || "");
      renderShopList(state);
    });
  }

    if (state.locateButton) {
      state.locateButton.addEventListener("click", function () {
        if (state.debugPaneView === "account") {
          if (state.accountSession) {
            logoutOwnerSession(state);
          } else {
            openDebugLoginPane(state);
          }
          return;
        }
        if (state.debugPaneView === "recent-orders") {
          refreshBuyerOrders(state, { force: true });
          return;
        }
        if (state.activeShopId) {
          if (isOwnerViewingShop(state)) {
            if (state.ownerPanel.tab) {
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
      openBuyerOrdersPane(state);
    });
  }

  if (state.navLocateButton) {
    state.navLocateButton.addEventListener("click", function () {
      locateUser(state, false);
    });
  }

  if (state.backButton) {
    state.backButton.addEventListener("click", function () {
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
      var target = event.target;
      if (!(target instanceof Element)) return;
      var buyerField = target.closest("[data-buyer-field]");
      if (buyerField) {
        var buyerKey = String(buyerField.getAttribute("data-buyer-field") || "").trim();
        if (!buyerKey) return;
        mergeBuyerProfile(state, (function () {
          var patch = {};
          patch[buyerKey] = String(buyerField.value || "");
          return patch;
        }()));
        return;
      }
      var ownerDraftField = target.closest("[data-owner-order-draft-field]");
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
      var field = target.closest("[data-login-field]");
      if (!field) return;
      var key = String(field.getAttribute("data-login-field") || "").trim();
      if (!key) return;
      state.loginDraft[key] = field.value;
      if (state.loginDraft.status) {
        state.loginDraft.status = "";
        state.loginDraft.tone = "";
      }
    });

    state.listNode.addEventListener("keydown", function (event) {
      var target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("[data-login-field]")) return;
      if (event.key !== "Enter") return;
      event.preventDefault();
      submitDebugLoginPane(state);
    });

    state.listNode.addEventListener("change", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      var logoInput = target.closest("[data-owner-logo-input]");
      if (logoInput) {
        var logoFile = target.files && target.files[0];
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
      var itemImageInput = target.closest("[data-owner-item-image-input]");
      if (itemImageInput) {
        var itemFile = target.files && target.files[0];
        var imageItemId = String(itemImageInput.getAttribute("data-owner-item-image-input") || "").trim();
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
      var target = event.target;
      if (!(target instanceof Element)) return;
      var loginSubmit = target.closest("[data-login-submit]");
      if (loginSubmit) {
        event.preventDefault();
        submitDebugLoginPane(state);
        return;
      }
      var recentOrdersButton = target.closest("[data-open-recent-orders]");
      if (recentOrdersButton) {
        event.preventDefault();
        openBuyerOrdersPane(state);
        return;
      }
      var accountEntryButton = target.closest("[data-open-account-entry]");
      if (accountEntryButton) {
        event.preventDefault();
        openRootAccountAction(state);
        return;
      }
      var accountOpenShopButton = target.closest("[data-account-open-shop]");
      if (accountOpenShopButton) {
        event.preventDefault();
        var accountShopId = String(accountOpenShopButton.getAttribute("data-account-open-shop") || "").trim();
        if (!accountShopId) return;
        setPreferredOwnerShop(state, accountShopId);
        openShopInPane(state, accountShopId);
        return;
      }
      var accountOpenOrdersButton = target.closest("[data-account-open-orders]");
      if (accountOpenOrdersButton) {
        event.preventDefault();
        openBuyerOrdersPane(state);
        return;
      }
      var accountOpenLoginButton = target.closest("[data-account-open-login]");
      if (accountOpenLoginButton) {
        event.preventDefault();
        openDebugLoginPane(state);
        return;
      }
      var accountLogoutButton = target.closest("[data-account-logout]");
      if (accountLogoutButton) {
        event.preventDefault();
        logoutOwnerSession(state);
        return;
      }
      var recentShopButton = target.closest("[data-open-recent-shop]");
      if (recentShopButton) {
        event.preventDefault();
        openShopInPane(state, String(recentShopButton.getAttribute("data-open-recent-shop") || "").trim());
        return;
      }
      var historyCartButton = target.closest("[data-open-cart-shop]");
      if (historyCartButton) {
        event.preventDefault();
        var historyCartShopId = String(historyCartButton.getAttribute("data-open-cart-shop") || "").trim();
        if (!historyCartShopId) return;
        openShopInPane(state, historyCartShopId);
        focusCart(state);
        return;
      }
      var shopCard = target.closest(".shop-card");
      if (shopCard) {
        event.preventDefault();
        openShopInPane(state, String(shopCard.getAttribute("data-shop-id") || "").trim());
        return;
      }
      var cartStep = target.closest(".shop-cart-step, .shop-item-step");
      if (cartStep) {
        event.preventDefault();
        addToCart(
          state,
          state.activeShopId,
          String(cartStep.getAttribute("data-item-id") || "").trim(),
          Number(cartStep.getAttribute("data-cart-step") || 0)
        );
        return;
      }
      var copyButton = target.closest(".shop-pay-copy");
      if (copyButton) {
        event.preventDefault();
        var value = String(copyButton.getAttribute("data-pay-copy") || "").trim();
        if (!value) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(value).then(function () {
            var original = copyButton.textContent;
            copyButton.textContent = "Copied";
            window.setTimeout(function () {
              copyButton.textContent = original;
            }, 900);
          }).catch(function () {});
        }
        return;
      }
      var paySelect = target.closest("[data-pay-select]");
      if (paySelect) {
        event.preventDefault();
        if (!state.activeShopId) return;
        setSelectedPaymentIndex(state, state.activeShopId, Number(paySelect.getAttribute("data-pay-select")));
        renderShopList(state);
        resetPaneScroll(state);
        return;
      }
      var paymentModeSelect = target.closest("[data-payment-mode]");
      if (paymentModeSelect) {
        event.preventDefault();
        if (!state.activeShopId) return;
        setSelectedPaymentMode(state, state.activeShopId, String(paymentModeSelect.getAttribute("data-payment-mode") || "").trim());
        renderShopList(state);
        resetPaneScroll(state);
        return;
      }
      var openCartButton = target.closest("[data-open-cart]");
      if (openCartButton) {
        event.preventDefault();
        focusCart(state);
        return;
      }
      var confirmItemsButton = target.closest("[data-confirm-items]");
      if (confirmItemsButton) {
        event.preventDefault();
        focusItems(state);
        return;
      }
      var confirmPayNowButton = target.closest("[data-confirm-pay-now]");
      if (confirmPayNowButton) {
        event.preventDefault();
        var confirmationState = orderConfirmation(state, state.activeShopId);
        if (!confirmationState || !confirmationState.paymentHref) return;
        triggerPaymentHref(confirmationState.paymentHref);
        return;
      }
      var payButton = target.closest(".shop-cart-pay");
      if (payButton) {
        event.preventDefault();
        if (!state.activeShopId || state.activeShopView !== "cart") {
          focusCart(state);
          return;
        }
        var detail = state.shopDetails[state.activeShopId] || shopDetailFromPreview(state.shopById[state.activeShopId]);
        if (!detail) return;
        var cartItemsNow = cartItems(detail, getShopCart(state, state.activeShopId));
        if (!cartItemsNow.length) return;
        var totalAmountNow = cartItemsNow.reduce(function (sum, item) {
          return sum + item.total;
        }, 0);
        var paymentEntries = payablePaymentEntries(detail, totalAmountNow);
        var chosenPaymentMode = effectivePaymentMode(state, state.activeShopId, paymentEntries);
        if (chosenPaymentMode === "before_delivery" && !isPaymentPickerOpen(state, state.activeShopId)) {
          setPaymentPickerOpen(state, state.activeShopId, true);
          renderShopList(state);
          resetPaneScroll(state);
          return;
        }
        var paymentIndex = selectedPaymentIndex(state, state.activeShopId, paymentEntries);
        var chosenPaymentNow = paymentIndex >= 0 ? paymentEntries[paymentIndex] : null;
        if (chosenPaymentMode === "before_delivery" && !chosenPaymentNow) {
          return;
        }
        if (chosenPaymentMode === "before_delivery" && !buildPaymentHref(chosenPaymentNow, detail, totalAmountNow)) {
          return;
        }
        var orderPayload = buildOrderPayload(state, detail, chosenPaymentNow, cartItemsNow, totalAmountNow, chosenPaymentMode);
        payButton.disabled = true;
        createShopOrder(state.activeShopId, orderPayload)
          .then(function (result) {
            if (!result || !result.ok) {
              throw new Error(String(result && result.payload && result.payload.error || "order_create_failed"));
            }
            var createdOrder = result.payload && result.payload.order || orderPayload;
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
                  : "Order placed. The shop will handle payment when you receive it."
              }
            );
            setOrderConfirmation(state, state.activeShopId, {
              order: createdOrder,
              paymentMode: chosenPaymentMode,
              paymentLabel: String(chosenPaymentNow && chosenPaymentNow.label || "").trim(),
              paymentHref: chosenPaymentMode === "before_delivery"
                ? buildPaymentHref(chosenPaymentNow, detail, totalAmountNow)
                : ""
            });
            state.activeShopView = "confirmation";
            renderShopList(state);
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
      var ownerSettingsSectionButton = target.closest("[data-owner-settings-section]");
      if (ownerSettingsSectionButton) {
        event.preventDefault();
        openOwnerSettingsPane(state, {
          section: String(ownerSettingsSectionButton.getAttribute("data-owner-settings-section") || "").trim()
        });
        return;
      }
      var ownerHistorySectionButton = target.closest("[data-owner-history-section]");
      if (ownerHistorySectionButton) {
        event.preventDefault();
        openOwnerHistoryPane(state, {
          shopId: state.activeShopId,
          section: String(ownerHistorySectionButton.getAttribute("data-owner-history-section") || "").trim()
        });
        return;
      }
      var ownerOrderPaymentButton = target.closest("[data-owner-order-payment]");
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
      var ownerDraftStepButton = target.closest("[data-owner-draft-step]");
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
      var ownerWalkinSubmit = target.closest("[data-owner-walkin-submit]");
      if (ownerWalkinSubmit) {
        event.preventDefault();
        submitOwnerWalkInOrder(state);
        return;
      }
      var ownerLibraryImport = target.closest("[data-owner-library-import]");
      if (ownerLibraryImport) {
        event.preventDefault();
        importOwnerLibraryItem(state, String(ownerLibraryImport.getAttribute("data-owner-library-import") || "").trim());
        return;
      }
      var ownerSave = target.closest("[data-owner-save]");
      if (ownerSave) {
        event.preventDefault();
        var mode = String(ownerSave.getAttribute("data-owner-save") || "").trim();
        var form = ownerSave.closest("form");
        if (mode === "profile") {
          submitOwnerProfile(state, form);
          return;
        }
        if (mode === "item") {
          submitOwnerItem(state, form);
          return;
        }
        if (mode === "payments") {
          submitOwnerPayments(state, form);
          return;
        }
      }
      var ownerItemSave = target.closest("[data-owner-item-save]");
      if (ownerItemSave) {
        event.preventDefault();
        var ownerItemId = String(ownerItemSave.getAttribute("data-owner-item-save") || "").trim();
        var ownerItemCard = ownerItemSave.closest("[data-owner-item-id]");
        submitOwnerItemUpdate(state, ownerItemId, ownerItemCard);
        return;
      }
      var ownerItemSelect = target.closest("[data-owner-item-select]");
      if (ownerItemSelect) {
        event.preventDefault();
        state.ownerPanel.itemId = String(ownerItemSelect.getAttribute("data-owner-item-select") || "").trim();
        state.ownerPanel.tab = "history";
        state.ownerPanel.section = "items";
        renderShopList(state);
        resetPaneScroll(state);
        return;
      }
      var ownerItemRemove = target.closest("[data-owner-item-remove]");
      if (ownerItemRemove) {
        event.preventDefault();
        var removeId = String(ownerItemRemove.getAttribute("data-owner-item-remove") || "").trim();
        submitOwnerItemRemove(state, removeId);
        return;
      }
      var ownerOrderAction = target.closest("[data-owner-order-action]");
      if (ownerOrderAction) {
        event.preventDefault();
        submitOwnerOrderAction(
          state,
          String(ownerOrderAction.getAttribute("data-owner-order-action") || "").trim(),
          String(ownerOrderAction.getAttribute("data-next-status") || "").trim()
        );
        return;
      }
      var ownerLogout = target.closest("[data-owner-logout]");
      if (ownerLogout) {
        event.preventDefault();
        logoutOwnerSession(state);
        return;
      }
      var pickupMapButton = target.closest("[data-pickup-use-map]");
      if (pickupMapButton) {
        event.preventDefault();
        var profileForm = pickupMapButton.closest('form[data-owner-form="profile"]');
        if (!(profileForm instanceof HTMLFormElement)) return;
        if (state.map) {
          var center = state.map.getCenter();
          setOwnerPickupPoint(state, profileForm, center.lat, center.lng);
        }
        return;
      }
      var pickupMeButton = target.closest("[data-pickup-use-me]");
      if (pickupMeButton) {
        event.preventDefault();
        var ownerForm = pickupMeButton.closest('form[data-owner-form="profile"]');
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
          var lat = position && position.coords ? position.coords.latitude : null;
          var lng = position && position.coords ? position.coords.longitude : null;
          var accuracy = position && position.coords ? position.coords.accuracy : 0;
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
    });
  }

  if (state.mapNode) {
    state.mapNode.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof Element)) return;
      var popupLink = target.closest(".map-popup");
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
