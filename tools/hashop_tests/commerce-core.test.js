const assert = require("assert");
const core = require("../hashop_site/commerce-core.js");

const rupeePricing = core.normalizePricing({
  prefix: "\u20b9",
  suffix: "",
  decimals: 0
});

assert.deepStrictEqual(rupeePricing, {
  prefix: "\u20b9",
  suffix: "",
  decimals: 0
});

assert.strictEqual(core.formatPrice("25", rupeePricing), "\u20b925");
assert.strictEqual(core.formatPrice("Call for price", rupeePricing), "Call for price");
assert.strictEqual(core.formatTotalAmount(75, rupeePricing), "\u20b975");
assert.strictEqual(core.formatTotalAmount(12.5, { prefix: "$", suffix: "", decimals: 2 }), "$12.5");
assert.strictEqual(core.pricingCurrencyCode(rupeePricing), "INR");
assert.strictEqual(core.pricingCurrencyCode({ prefix: "$" }), "USD");
assert.strictEqual(core.priceNumber("\u20b91,250.50"), 1250.5);

assert.strictEqual(core.cartCount({ a: 2, b: "3", c: -4 }), 5);
assert.deepStrictEqual(
  core.cartItems(
    {
      items: [
        { id: "a", title: "Alpha", price: "10" },
        { id: "b", title: "Beta", price: "\u20b925" },
        { id: "c", title: "Gamma", price: "8" }
      ]
    },
    { a: 2, b: 1, c: 0 }
  ),
  [
    { id: "a", title: "Alpha", quantity: 2, price: "10", total: 20 },
    { id: "b", title: "Beta", quantity: 1, price: "\u20b925", total: 25 }
  ]
);

assert.strictEqual(core.orderPaymentMode({ payment_mode: "before_delivery" }), "before_delivery");
assert.strictEqual(core.orderPaymentMode({ paymentMode: "other" }), "on_receive");
assert.strictEqual(core.stableOrderStatus("READY"), "ready");
assert.strictEqual(core.stableOrderStatus("unknown"), "");
assert.strictEqual(core.normalizedOrderStatus({ status: "new", paymentMode: "before_delivery" }), "payment_pending");
assert.strictEqual(core.normalizedOrderStatus({ status: "pending" }), "created");
assert.strictEqual(core.normalizedOrderStatus({ paymentPaid: true }), "paid");
assert.deepStrictEqual(core.orderStatusFlags({ paymentPaid: true }, ""), {
  paymentPaid: true,
  paymentReceived: true,
  orderSent: true,
  orderReceived: false
});
assert.deepStrictEqual(core.orderStatusFlags({}, "completed"), {
  paymentPaid: true,
  paymentReceived: true,
  orderSent: true,
  orderReceived: true
});

console.log("commerce-core tests passed");
