(function (root, factory) {
  "use strict";

  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HashopPublicTheme = api;
    api.applyTheme(api.storedTheme());
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const STORAGE_KEY = "hashop_theme";

  function normalizeTheme(value) {
    return String(value || "").trim().toLowerCase() === "dark" ? "dark" : "light";
  }

  function applyTheme(value) {
    const theme = normalizeTheme(value);
    const documentRef = root && root.document;
    if (!documentRef || !documentRef.documentElement) return theme;
    documentRef.documentElement.setAttribute("data-hashop-theme", theme);
    if (documentRef.body) {
      documentRef.body.setAttribute("data-hashop-theme", theme);
    }
    const themeMeta = documentRef.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute("content", theme === "dark" ? "#050505" : "#ffffff");
    }
    return theme;
  }

  function storedTheme() {
    try {
      return root.localStorage && root.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return "";
    }
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    normalizeTheme: normalizeTheme,
    applyTheme: applyTheme,
    storedTheme: storedTheme
  };
});
