(function (root, factory) {
  const core = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = core;
  }
  if (root) {
    root.HashopHomePolishCore = core;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_TEXT_REPLACEMENTS = Object.freeze([
    Object.freeze(["Find shop fast", "Nearby shops"]),
    Object.freeze(["Find shop", "Shops"]),
    Object.freeze(["Call shop", "Call Shop"]),
    Object.freeze(["No callable shops found.", "No shops to call found."]),
    Object.freeze(["No matching items yet.", "No items found."]),
    Object.freeze(["No matching shops found.", "No shops found."]),
    Object.freeze(["No shops nearby yet.", "No shops yet."]),
    Object.freeze(["Open or create your shop here", "Add your shop"]),
    Object.freeze(["Create or open your shop", "Add your shop"]),
    Object.freeze(["Shop Command", "Add shop"]),
    Object.freeze(["Debug", "Add shop"]),
    Object.freeze(["Commerce Grid", "Shops near you"]),
    Object.freeze(["Mapped local supply", "Shops near you"]),
    Object.freeze(["Live territory", "Nearby"]),
    Object.freeze(["Network intelligence", "Nearby shops"]),
    Object.freeze(["Call or message the shop before you go.", "Call or message the shop."]),
    Object.freeze(["See items below. Call the shop if you want to confirm stock first.", "See items below."]),
    Object.freeze(["Optional. Saved on this device for faster repeat orders.", "Saved on this phone."]),
    Object.freeze(["Payment methods stay hidden until you continue to pay.", "Choose payment to continue."]),
    Object.freeze(["Live status refresh runs automatically while this screen is open.", "Status updates here."]),
    Object.freeze(["Order first. Pay the shop when you get it.", "Pay when you receive."]),
    Object.freeze(["Only if you trust the shop and want to prepay.", "Pay before delivery."]),
    Object.freeze(["Add or open shop", "Open shop tools"]),
    Object.freeze(["Register", "Add"])
  ]);

  const DEFAULT_ATTRIBUTE_NAMES = Object.freeze(["aria-label", "title", "placeholder", "value"]);

  function cleanText(value, replacements) {
    if (!value || typeof value !== "string") return value;
    const source = Array.isArray(replacements) ? replacements : DEFAULT_TEXT_REPLACEMENTS;
    return source.reduce(function (next, pair) {
      if (!Array.isArray(pair) || pair.length < 2) return next;
      const from = String(pair[0] || "");
      if (!from) return next;
      return next.split(from).join(String(pair[1] || ""));
    }, value);
  }

  function stateMotionSignature(settings) {
    const source = settings && typeof settings === "object" ? settings : {};
    return [
      String(source.screen || ""),
      String(source.pane || ""),
      String(source.view || ""),
      String(Number.isFinite(Number(source.childCount)) ? Number(source.childCount) : 0),
      String(source.text || "").trim().slice(0, 80).trim()
    ].join("|");
  }

  return {
    DEFAULT_TEXT_REPLACEMENTS: DEFAULT_TEXT_REPLACEMENTS,
    DEFAULT_ATTRIBUTE_NAMES: DEFAULT_ATTRIBUTE_NAMES,
    cleanText: cleanText,
    stateMotionSignature: stateMotionSignature
  };
});
