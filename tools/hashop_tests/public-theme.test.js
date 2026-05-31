const assert = require("assert");
const theme = require("../hashop_site/public-theme.js");

assert.strictEqual(theme.STORAGE_KEY, "hashop_theme");
assert.strictEqual(theme.normalizeTheme("dark"), "dark");
assert.strictEqual(theme.normalizeTheme(" DARK "), "dark");
assert.strictEqual(theme.normalizeTheme("light"), "light");
assert.strictEqual(theme.normalizeTheme("other"), "light");
assert.strictEqual(theme.applyTheme("dark"), "dark");
assert.strictEqual(theme.applyTheme("light"), "light");

console.log("public-theme tests passed");
