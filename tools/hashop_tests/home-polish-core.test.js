const assert = require("assert");
const core = require("../hashop_site/home-polish-core.js");

assert.strictEqual(core.cleanText("Find shop fast"), "Nearby shops");
assert.strictEqual(core.cleanText("No matching items yet."), "No items found.");
assert.strictEqual(
  core.cleanText("Order first. Pay the shop when you get it."),
  "Pay when you receive."
);
assert.strictEqual(core.cleanText("Keep this"), "Keep this");
assert.strictEqual(core.cleanText(null), null);

assert.deepStrictEqual(core.DEFAULT_ATTRIBUTE_NAMES, ["aria-label", "title", "placeholder", "value"]);

assert.strictEqual(
  core.stateMotionSignature({
    screen: "items",
    pane: "root",
    view: "feed",
    childCount: 7,
    text: "  Coca-Cola 750 ml with a long body that should be trimmed after the preview text boundary  "
  }),
  "items|root|feed|7|Coca-Cola 750 ml with a long body that should be trimmed after the preview text"
);

console.log("home-polish-core tests passed");
