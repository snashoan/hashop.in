(function (root, factory) {
  const core = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = core;
  }
  root.HashopCommerceCore = core;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ORDER_STATUS_PATTERN = /^(created|payment_pending|accepted|ready|paid|completed|cancelled)$/;

  function normalizePricing(pricing) {
    if (!pricing || typeof pricing !== "object") return null;
    return {
      prefix: String(pricing.prefix || "").trim(),
      suffix: String(pricing.suffix || "").trim(),
      decimals: Number.isFinite(Number(pricing.decimals)) ? Math.max(0, Number(pricing.decimals)) : null
    };
  }

  function formatPrice(value, pricing) {
    const text = String(value == null ? "" : value).trim();
    if (!text) return "";
    if (pricing && /^[-+]?[0-9]+(?:\.[0-9]+)?$/.test(text)) {
      return String(pricing.prefix || "") + text + String(pricing.suffix || "");
    }
    return text;
  }

  function formatTotalAmount(value, pricing) {
    const number = Number(value || 0);
    if (!isFinite(number) || number <= 0) return "";
    const decimals = pricing && pricing.decimals != null
      ? pricing.decimals
      : (Math.abs(number - Math.round(number)) < 0.0001 ? 0 : 2);
    const text = decimals === 0
      ? String(Math.round(number))
      : number.toFixed(decimals).replace(/\.?0+$/, "");
    return String(pricing && pricing.prefix || "") + text + String(pricing && pricing.suffix || "");
  }

  function pricingCurrencyCode(pricing) {
    const prefix = String(pricing && pricing.prefix || "").trim().toLowerCase();
    const suffix = String(pricing && pricing.suffix || "").trim().toLowerCase();
    const combined = (prefix + " " + suffix).trim();
    if (!combined) return "";
    if (combined.indexOf("\u20b9") !== -1 || combined.indexOf("rs") !== -1 || combined.indexOf("inr") !== -1) return "INR";
    if (combined.indexOf("$") !== -1 || combined.indexOf("usd") !== -1) return "USD";
    if (combined.indexOf("\u20ac") !== -1 || combined.indexOf("eur") !== -1) return "EUR";
    if (combined.indexOf("btc") !== -1) return "BTC";
    if (combined.indexOf("eth") !== -1) return "ETH";
    return "";
  }

  function priceNumber(value) {
    const text = String(value == null ? "" : value).trim();
    if (!text) return 0;
    const cleaned = text.replace(/[^0-9.]/g, "");
    const number = Number(cleaned);
    return isFinite(number) ? number : 0;
  }

  function cartCount(cart) {
    const source = cart && typeof cart === "object" ? cart : {};
    return Object.keys(source).reduce(function (sum, key) {
      return sum + Math.max(0, Number(source[key] || 0));
    }, 0);
  }

  function cartItems(detail, cart) {
    const items = Array.isArray(detail && detail.items) ? detail.items : [];
    const source = cart && typeof cart === "object" ? cart : {};
    return items.reduce(function (result, item) {
      const quantity = Math.max(0, Number(source[item.id] || 0));
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
    const mode = String(order && (order.paymentMode || order.payment_mode) || "").trim().toLowerCase();
    return mode === "before_delivery" ? "before_delivery" : "on_receive";
  }

  function stableOrderStatus(value) {
    const status = String(value || "").trim().toLowerCase();
    return ORDER_STATUS_PATTERN.test(status) ? status : "";
  }

  function normalizedOrderStatus(order) {
    const status = String(order && order.status || "").trim().toLowerCase();
    const mode = orderPaymentMode(order);
    const stableStatus = stableOrderStatus(status);
    if (stableStatus) return stableStatus;
    if (order && order.orderReceived) return "completed";
    if (order && (order.paymentPaid || order.paymentReceived)) return "paid";
    if (order && order.orderSent) return "ready";
    if (!status || status === "new") {
      return mode === "before_delivery" ? "payment_pending" : "created";
    }
    if (status === "pending") {
      return mode === "before_delivery" ? "payment_pending" : "created";
    }
    return mode === "before_delivery" ? "payment_pending" : "created";
  }

  function orderStatusFlags(order, status) {
    const current = order && typeof order === "object" ? order : {};
    const stableStatus = stableOrderStatus(status) || normalizedOrderStatus(current);
    const onReceive = orderPaymentMode(current) !== "before_delivery";
    const paymentDone = !!(current.paymentPaid || current.paymentReceived || stableStatus === "paid" || stableStatus === "completed");
    const sent = !!(current.orderSent || stableStatus === "ready" || stableStatus === "completed" || (onReceive && stableStatus === "paid"));
    const received = !!(current.orderReceived || stableStatus === "completed");
    return {
      paymentPaid: paymentDone,
      paymentReceived: paymentDone,
      orderSent: sent,
      orderReceived: received
    };
  }

  return {
    normalizePricing: normalizePricing,
    formatPrice: formatPrice,
    formatTotalAmount: formatTotalAmount,
    pricingCurrencyCode: pricingCurrencyCode,
    priceNumber: priceNumber,
    cartCount: cartCount,
    cartItems: cartItems,
    orderPaymentMode: orderPaymentMode,
    stableOrderStatus: stableOrderStatus,
    normalizedOrderStatus: normalizedOrderStatus,
    orderStatusFlags: orderStatusFlags
  };
});
