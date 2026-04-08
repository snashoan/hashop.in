const authButtons = Array.from(document.querySelectorAll("[data-auth-mode]"));
const authPanels = Array.from(document.querySelectorAll("[data-auth-panel]"));
const registerShell = document.querySelector('[data-auth-panel="register"]');
const loginShell = document.querySelector('[data-auth-panel="login"]');
const stepButtons = Array.from(document.querySelectorAll("[data-step-jump]"));
const pages = Array.from(document.querySelectorAll(".page[data-step]"));
const stageTrack = document.getElementById("stageTrack");
const progressFill = document.getElementById("progressFill");
const prevStepButton = document.getElementById("prevStep");
const nextStepButton = document.getElementById("nextStep");
const shopNameInput = document.getElementById("shopNameInput");
const shopNamePreview = document.getElementById("shopNamePreview");
const vendorIdInput = document.getElementById("vendorIdInput");
const idPreview = document.getElementById("idPreview");
const loginIdPreview = document.getElementById("loginIdPreview");
const urlPreviewBox = document.getElementById("urlPreviewBox");
const passwordInput = document.getElementById("passwordInput");
const planButtons = Array.from(document.querySelectorAll("[data-plan]"));
const unlockMethods = document.getElementById("unlockMethods");
const unlockReferenceInput = document.getElementById("unlockReferenceInput");
const unlockHeading = document.getElementById("unlockHeading");
const unlockLead = document.getElementById("unlockLead");
const unlockStatusLine = document.getElementById("unlockStatusLine");
const unlockShell = document.getElementById("unlockShell");
const unlockFields = document.getElementById("unlockFields");
const unlockAddressCard = document.getElementById("unlockAddressCard");
const unlockAddressLabel = document.getElementById("unlockAddressLabel");
const unlockAddressValue = document.getElementById("unlockAddressValue");
const unlockAddressNote = document.getElementById("unlockAddressNote");

const summaryShopName = document.getElementById("summaryShopName");
const summaryVendorId = document.getElementById("summaryVendorId");
const summaryPlan = document.getElementById("summaryPlan");
const summaryUnlock = document.getElementById("summaryUnlock");
const summaryCloudUrl = document.getElementById("summaryCloudUrl");
const summaryCloudRow = document.getElementById("summaryCloudRow");
const finalLaunchBtn = document.getElementById("finalLaunchBtn");
const launchStatus = document.getElementById("launchStatus");

const loginShopIdInput = document.getElementById("loginShopIdInput");
const loginPasswordInput = document.getElementById("loginPasswordInput");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const loginStatus = document.getElementById("loginStatus");

const PLAN_META = {
  free: "Shop link only",
  map: "Map placement",
};

const PLACEHOLDER_NAME = "Your Shop";
const DEFAULT_PAYMENT_OPTIONS = {
  available: false,
  methods: [],
};

const state = {
  authMode: loadAuthMode(),
  step: loadInitialStep(),
  plan: "free",
  shopName: loadShopName(),
  vendorId: loadVendorId(),
  password: "",
  unlockMethod: "",
  unlockReference: "",
  vendorIdTouched: hasSavedVendorId(),
  cloudBase: window.location.host || "hashop.in",
  isSubmitting: false,
  isLoggingIn: false,
  isLoadingPaymentOptions: false,
  paymentOptionsReady: false,
  paymentOptions: DEFAULT_PAYMENT_OPTIONS,
  launchTone: "",
  launchMessage: "",
  loginTone: "",
  loginMessage: "",
};

if (!state.vendorId && state.shopName) {
  state.vendorId = slugify(state.shopName);
}

function revealCloudPage() {
  if (typeof window.__revealCloudPage === "function") {
    window.__revealCloudPage();
    return;
  }
  document.documentElement.classList.remove("cloud-pending");
  document.documentElement.classList.add("cloud-ready");
}

function loadAuthMode() {
  try {
    const raw = new URLSearchParams(window.location.search).get("mode");
    return raw === "login" ? "login" : "register";
  } catch (error) {
    return "register";
  }
}

function loadInitialStep() {
  try {
    const raw = new URLSearchParams(window.location.search).get("step");
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, 6) : 0;
  } catch (error) {
    return 0;
  }
}

function loadShopName() {
  try {
    return window.localStorage.getItem("hashop_shop_name") || "";
  } catch (error) {
    return "";
  }
}

function loadVendorId() {
  try {
    return window.localStorage.getItem("hashop_vendor_id") || "";
  } catch (error) {
    return "";
  }
}

function hasSavedVendorId() {
  try {
    return !!window.localStorage.getItem("hashop_vendor_id");
  } catch (error) {
    return false;
  }
}

function saveShopName(value) {
  try {
    window.localStorage.setItem("hashop_shop_name", value);
  } catch (error) {}
}

function saveVendorId(value) {
  try {
    window.localStorage.setItem("hashop_vendor_id", value);
  } catch (error) {}
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function displayShopName() {
  return state.shopName.trim() || PLACEHOLDER_NAME;
}

function normalizedVendorId() {
  return slugify(state.vendorId || state.shopName || "") || "your-shop";
}

function passwordReady() {
  return String(state.password || "").length >= 6;
}

function paymentMethods() {
  return Array.isArray(state.paymentOptions && state.paymentOptions.methods)
    ? state.paymentOptions.methods
    : [];
}

function selectedUnlockMethod() {
  const methods = paymentMethods();
  return methods.find((method) => method.key === state.unlockMethod) || null;
}

function ensureValidUnlockMethod() {
  if (!state.unlockMethod) return;
  if (!selectedUnlockMethod()) {
    state.unlockMethod = "";
  }
}

function unlockRequestReady() {
  if (state.plan !== "map") return true;
  return !!selectedUnlockMethod();
}

function unlockSummaryLabel() {
  if (state.plan !== "map") return "Not required";
  const method = selectedUnlockMethod();
  if (!state.paymentOptionsReady || state.isLoadingPaymentOptions) {
    return "Loading payment paths";
  }
  if (!paymentMethods().length) {
    return "Unavailable";
  }
  if (!method) {
    return "Select payment path";
  }
  if (state.unlockReference.trim()) {
    return method.label + " pending review";
  }
  return method.label + " selected";
}

function stepIsUnlocked(step) {
  if (step <= 1) return true;
  if (step === 2) return !!state.shopName.trim();
  if (step === 3) return !!normalizedVendorId();
  if (step === 4) return !!normalizedVendorId() && passwordReady();
  if (step === 5) return !!normalizedVendorId() && passwordReady();
  if (step >= 6) return !!normalizedVendorId() && passwordReady() && unlockRequestReady();
  return true;
}

function nextStepEnabled() {
  if (state.step === 1) return !!state.shopName.trim();
  if (state.step === 2) return !!normalizedVendorId();
  if (state.step === 3) return passwordReady();
  if (state.step === 5) return unlockRequestReady();
  return true;
}

function highestUnlockedStep() {
  let highest = 0;
  for (let step = 1; step < pages.length; step += 1) {
    if (!stepIsUnlocked(step)) break;
    highest = step;
  }
  return highest;
}

function setStep(nextStep) {
  const bounded = Math.max(0, Math.min(pages.length - 1, nextStep));
  state.step = Math.min(bounded, highestUnlockedStep());
  render();
}

function setLaunchMessage(message, tone) {
  state.launchMessage = message;
  state.launchTone = tone || "";
}

function setLoginMessage(message, tone) {
  state.loginMessage = message;
  state.loginTone = tone || "";
}

function setAuthMode(mode) {
  state.authMode = mode === "login" ? "login" : "register";
  render();
}

function maskedAddress(value) {
  const raw = String(value || "").trim();
  if (raw.length <= 18) return raw;
  return raw.slice(0, 8) + "..." + raw.slice(-6);
}

function renderUnlockMethods() {
  if (!unlockMethods) return;
  const methods = paymentMethods();
  if (state.plan !== "map") {
    unlockMethods.innerHTML = "";
    return;
  }
  if (state.isLoadingPaymentOptions && !state.paymentOptionsReady) {
    unlockMethods.innerHTML = '<div class="unlock-empty">Loading payment paths...</div>';
    return;
  }
  if (!methods.length) {
    unlockMethods.innerHTML = '<div class="unlock-empty">Discovery payment paths are not configured yet.</div>';
    return;
  }
  unlockMethods.innerHTML = methods.map((method) => {
    var subline = String(method.feeDisplay || "").trim();
    if (!subline) {
      subline = maskedAddress(method.address);
    }
    const selected = method.key === state.unlockMethod;
    return '' +
      '<button class="unlock-method' + (selected ? ' is-selected' : '') + '" type="button" data-unlock-method="' + escapeHtml(method.key) + '">' +
        '<strong>' + escapeHtml(method.label) + '</strong>' +
        '<span>' + escapeHtml(subline) + '</span>' +
      '</button>';
  }).join("");
}

function render() {
  ensureValidUnlockMethod();
  state.step = Math.min(state.step, highestUnlockedStep());

  if (stageTrack) {
    stageTrack.style.transform = `translateX(-${state.step * 100}%)`;
  }

  if (progressFill) {
    progressFill.style.width = `${((state.step + 1) / Math.max(1, pages.length)) * 100}%`;
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", state.authMode);
    if (state.authMode === "register") {
      url.searchParams.set("step", String(state.step));
    } else {
      url.searchParams.delete("step");
    }
    window.history.replaceState({}, "", url);
  } catch (error) {}

  authButtons.forEach((button) => {
    button.classList.toggle("is-active", button.getAttribute("data-auth-mode") === state.authMode);
  });
  authPanels.forEach((panel) => {
    const active = panel.getAttribute("data-auth-panel") === state.authMode;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });

  stepButtons.forEach((button, index) => {
    button.classList.toggle("is-active", index === state.step);
    button.disabled = state.authMode !== "register" || !stepIsUnlocked(index);
  });

  if (registerShell) registerShell.hidden = state.authMode !== "register";
  if (loginShell) loginShell.hidden = state.authMode !== "login";

  if (prevStepButton) prevStepButton.disabled = state.step === 0;
  if (nextStepButton) {
    nextStepButton.style.display = state.step === pages.length - 1 ? "none" : "flex";
    nextStepButton.disabled = !nextStepEnabled();
  }

  const shopName = displayShopName();
  const vendorId = normalizedVendorId();
  const cloudUrl = `${state.cloudBase}/shop/${vendorId}/`;
  const isLongLink = cloudUrl.length > 26;
  const methods = paymentMethods();
  const selectedMethod = selectedUnlockMethod();
  const paymentUnavailable = state.plan === "map" && state.paymentOptionsReady && !methods.length;

  if (shopNameInput && shopNameInput.value !== state.shopName) {
    shopNameInput.value = state.shopName;
  }
  if (vendorIdInput && vendorIdInput.value !== state.vendorId) {
    vendorIdInput.value = state.vendorId;
  }
  if (passwordInput && passwordInput.value !== state.password) {
    passwordInput.value = state.password;
  }
  if (unlockReferenceInput && unlockReferenceInput.value !== state.unlockReference) {
    unlockReferenceInput.value = state.unlockReference;
  }

  if (shopNamePreview) shopNamePreview.textContent = shopName;
  if (idPreview) idPreview.textContent = vendorId;
  if (loginIdPreview) loginIdPreview.textContent = vendorId;
  if (urlPreviewBox) urlPreviewBox.classList.toggle("is-long", isLongLink);

  planButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.plan === state.plan);
  });

  if (summaryShopName) summaryShopName.textContent = shopName;
  if (summaryVendorId) summaryVendorId.textContent = vendorId;
  if (summaryPlan) summaryPlan.textContent = PLAN_META[state.plan];
  if (summaryUnlock) summaryUnlock.textContent = unlockSummaryLabel();
  if (summaryCloudUrl) summaryCloudUrl.textContent = cloudUrl;
  if (summaryCloudRow) summaryCloudRow.classList.toggle("is-long", isLongLink);

  renderUnlockMethods();

  if (unlockShell) unlockShell.classList.toggle("is-passive", state.plan !== "map" || paymentUnavailable);
  if (unlockFields) unlockFields.hidden = state.plan !== "map";
  if (unlockReferenceInput) {
    unlockReferenceInput.disabled = state.plan !== "map" || paymentUnavailable || !selectedMethod;
    unlockReferenceInput.placeholder = selectedMethod
      ? (selectedMethod.referencePlaceholder || "Transaction reference or note")
      : "Transaction reference or note";
  }

  if (unlockHeading) {
    if (state.plan !== "map") {
      unlockHeading.textContent = "No payment is needed.";
    } else if (paymentUnavailable) {
      unlockHeading.textContent = "Payment paths are not ready.";
    } else {
      unlockHeading.textContent = "Pay once for map placement.";
    }
  }

  if (unlockLead) {
    if (state.plan !== "map") {
      unlockLead.textContent = "Shop link only stays free. You can request map placement later from your workspace.";
    } else if (paymentUnavailable) {
      unlockLead.textContent = "Discovery payment destinations have not been configured yet. Keep the shop free for now and turn map placement on later.";
    } else {
      unlockLead.textContent = "Discovery placement is a one-time unlock. UPI is Rs 1000, while BTC and ETH are $10 worth each. Send payment to one of the configured addresses, then paste the transaction reference.";
    }
  }

  if (unlockAddressCard) {
    unlockAddressCard.hidden = state.plan !== "map" || !selectedMethod;
  }
  if (unlockAddressLabel) {
    unlockAddressLabel.textContent = selectedMethod
      ? (selectedMethod.label + " destination" + (selectedMethod.feeDisplay ? " - " + selectedMethod.feeDisplay : ""))
      : "Discovery payment destination";
  }
  if (unlockAddressValue) {
    unlockAddressValue.textContent = selectedMethod ? String(selectedMethod.address || "") : "-";
  }
  if (unlockAddressNote) {
    unlockAddressNote.textContent = selectedMethod
      ? String(selectedMethod.instruction || "")
      : "Pick a payment path to see where to send the discovery fee.";
  }

  if (unlockStatusLine) {
    if (state.plan !== "map") {
      unlockStatusLine.textContent = "No payment step is required for the free shop link.";
    } else if (paymentUnavailable) {
      unlockStatusLine.textContent = "Discovery spot payments are not configured right now.";
    } else if (!selectedMethod) {
      unlockStatusLine.textContent = "Choose a payment path to continue with map placement.";
    } else if (state.unlockReference.trim()) {
      unlockStatusLine.textContent = "The transaction reference is ready. Creating the shop will save a pending review request.";
    } else {
      unlockStatusLine.textContent = "After payment, add the transaction reference or note so the discovery spot can move into review.";
    }
  }

  if (finalLaunchBtn) {
    finalLaunchBtn.disabled = state.isSubmitting || !stepIsUnlocked(5);
    finalLaunchBtn.textContent = state.isSubmitting ? "Creating Shop..." : "Create Shop";
  }
  if (launchStatus) {
    launchStatus.textContent = state.launchMessage;
    launchStatus.dataset.tone = state.launchTone;
  }

  if (loginSubmitBtn) {
    loginSubmitBtn.disabled = state.isLoggingIn;
    loginSubmitBtn.textContent = state.isLoggingIn ? "Logging In..." : "Log In";
  }
  if (loginStatus) {
    loginStatus.textContent = state.loginMessage;
    loginStatus.dataset.tone = state.loginTone;
  }
}

async function loadPaymentOptions() {
  state.isLoadingPaymentOptions = true;
  render();
  try {
    const response = await fetch("/api/payment-options", { cache: "no-store" });
    const payload = await response.json().catch(() => DEFAULT_PAYMENT_OPTIONS);
    if (!response.ok || !payload || typeof payload !== "object") {
      throw new Error("payment_options_failed");
    }
    state.paymentOptions = {
      available: !!payload.available,
      methods: Array.isArray(payload.methods) ? payload.methods : [],
    };
  } catch (error) {
    state.paymentOptions = DEFAULT_PAYMENT_OPTIONS;
  } finally {
    state.paymentOptionsReady = true;
    state.isLoadingPaymentOptions = false;
    ensureValidUnlockMethod();
    render();
  }
}

authButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setAuthMode(button.getAttribute("data-auth-mode") || "register");
  });
});

stepButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.disabled) return;
    setStep(Number(button.dataset.stepJump || 0));
  });
});

planButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.plan = button.dataset.plan;
    if (state.plan !== "map") {
      state.unlockMethod = "";
      state.unlockReference = "";
    }
    render();
  });
});

if (unlockMethods) {
  unlockMethods.addEventListener("click", (event) => {
    const button = event.target.closest("[data-unlock-method]");
    if (!button || state.plan !== "map") return;
    state.unlockMethod = button.dataset.unlockMethod || "";
    render();
  });
}

if (shopNameInput) {
  shopNameInput.addEventListener("input", (event) => {
    const previousDerived = normalizedVendorId();
    state.shopName = event.target.value;
    saveShopName(state.shopName);
    if (!state.vendorIdTouched || slugify(state.vendorId) === previousDerived) {
      state.vendorId = slugify(state.shopName);
      saveVendorId(state.vendorId);
      state.vendorIdTouched = false;
    }
    render();
  });
}

if (vendorIdInput) {
  vendorIdInput.addEventListener("input", (event) => {
    state.vendorId = event.target.value;
    state.vendorIdTouched = true;
    saveVendorId(state.vendorId);
    render();
  });
}

if (passwordInput) {
  passwordInput.addEventListener("input", (event) => {
    state.password = event.target.value;
    render();
  });
}

if (unlockReferenceInput) {
  unlockReferenceInput.addEventListener("input", (event) => {
    state.unlockReference = event.target.value;
    render();
  });
}

if (prevStepButton) {
  prevStepButton.addEventListener("click", () => setStep(state.step - 1));
}

if (nextStepButton) {
  nextStepButton.addEventListener("click", () => {
    if (!nextStepEnabled()) return;
    setStep(state.step + 1);
  });
}

if (finalLaunchBtn) {
  finalLaunchBtn.addEventListener("click", async () => {
    if (state.isSubmitting) return;

    const shopName = state.shopName.trim();
    const vendorId = normalizedVendorId();
    const password = String(state.password || "");
    if (!shopName) {
      setStep(1);
      setLaunchMessage("Enter the shop name first.", "error");
      render();
      return;
    }
    if (!vendorId) {
      setStep(2);
      setLaunchMessage("Choose a public ID first.", "error");
      render();
      return;
    }
    if (password.length < 6) {
      setStep(3);
      setLaunchMessage("Use a password with at least 6 characters.", "error");
      render();
      return;
    }
    if (state.plan === "map" && !selectedUnlockMethod()) {
      setStep(5);
      setLaunchMessage("Choose a discovery payment path first.", "error");
      render();
      return;
    }

    state.isSubmitting = true;
    setLaunchMessage("Creating your shop...", "pending");
    render();

    try {
      const response = await fetch("/api/shops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vendor_id: vendorId,
          display_name: shopName,
          reach_plan: state.plan,
          password: password,
          map_unlock: {
            method: state.plan === "map" ? String(state.unlockMethod || "") : "",
            reference: state.plan === "map" ? String(state.unlockReference || "") : "",
          },
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "create_failed");
      }

      const shopId = payload && payload.shop && payload.shop.shop_id ? String(payload.shop.shop_id) : vendorId;
      state.vendorId = shopId;
      state.vendorIdTouched = true;
      saveVendorId(shopId);
      setLaunchMessage(
        state.plan === "map"
          ? "Unlock request saved. Opening workspace..."
          : (payload.created ? "Shop created. Opening workspace..." : "Shop updated. Opening workspace..."),
        "success"
      );
      render();
      window.setTimeout(() => {
        window.location.href = payload.launch_url || `/hashop?shop=${encodeURIComponent(shopId)}`;
      }, 250);
    } catch (error) {
      state.isSubmitting = false;
      setLaunchMessage("Could not create the shop right now. Try again.", "error");
      render();
    }
  });
}

if (loginShopIdInput) {
  loginShopIdInput.addEventListener("input", () => {
    setLoginMessage("", "");
  });
}

if (loginPasswordInput) {
  loginPasswordInput.addEventListener("input", () => {
    setLoginMessage("", "");
  });
}

if (loginSubmitBtn) {
  loginSubmitBtn.addEventListener("click", async () => {
    if (state.isLoggingIn) return;
    const shopId = slugify(loginShopIdInput ? loginShopIdInput.value : "");
    const password = String(loginPasswordInput ? loginPasswordInput.value : "");
    if (!shopId) {
      setLoginMessage("Enter your shop ID first.", "error");
      render();
      return;
    }
    if (!password) {
      setLoginMessage("Enter your password.", "error");
      render();
      return;
    }

    state.isLoggingIn = true;
    setLoginMessage("Checking your login...", "pending");
    render();

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shop_id: shopId,
          password: password,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "login_failed");
      }
      setLoginMessage("Login accepted. Opening workspace...", "success");
      render();
      window.setTimeout(() => {
        window.location.href = payload.launch_url || `/hashop?shop=${encodeURIComponent(shopId)}`;
      }, 180);
    } catch (error) {
      state.isLoggingIn = false;
      setLoginMessage("Login failed. Check your shop ID and password.", "error");
      render();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (state.authMode !== "register") return;
  if (event.key === "ArrowRight" && nextStepEnabled()) setStep(state.step + 1);
  if (event.key === "ArrowLeft") setStep(state.step - 1);
});

render();
loadPaymentOptions();
window.requestAnimationFrame(revealCloudPage);
