(function () {
  var shopNameInput = document.getElementById("cloudShopNameInput");
  var passwordInput = document.getElementById("cloudPasswordInput");
  var submitButton = document.getElementById("cloudSubmitBtn");
  var statusNode = document.getElementById("cloudStatus");
  var mapNode = document.getElementById("cloudMap");

  var state = {
    isSubmitting: false,
    map: null,
    userMarker: null,
    userAccuracy: null
  };

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function setStatus(message, tone) {
    if (!statusNode) return;
    statusNode.textContent = message || "";
    statusNode.dataset.tone = tone || "";
  }

  function saveShopIdentity(shopName, shopId) {
    try {
      window.localStorage.setItem("hashop_shop_name", shopName);
      window.localStorage.setItem("hashop_vendor_id", shopId);
    } catch (error) {}
  }

  function loadSavedShopName() {
    try {
      return window.localStorage.getItem("hashop_shop_name") || "";
    } catch (error) {
      return "";
    }
  }

  function saveLastLocation(lat, lng, accuracy) {
    try {
      window.localStorage.setItem("hashop_last_location", JSON.stringify({
        lat: lat,
        lng: lng,
        accuracy: accuracy || 0
      }));
    } catch (error) {}
  }

  function loadLastLocation() {
    try {
      var raw = window.localStorage.getItem("hashop_last_location");
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !isFinite(parsed.lat) || !isFinite(parsed.lng)) return null;
      return {
        lat: Number(parsed.lat),
        lng: Number(parsed.lng),
        accuracy: Number(parsed.accuracy) || 0
      };
    } catch (error) {
      return null;
    }
  }

  async function parseJson(response) {
    try {
      return await response.json();
    } catch (error) {
      return {};
    }
  }

  async function shopExists(shopId) {
    var response = await fetch("/api/shops/" + encodeURIComponent(shopId), {
      cache: "no-store"
    });
    return response.ok;
  }

  async function attemptLogin(shopId, password) {
    var response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        shop_id: shopId,
        password: password
      })
    });
    return {
      ok: response.ok,
      status: response.status,
      payload: await parseJson(response)
    };
  }

  async function attemptCreate(shopId, shopName, password) {
    var response = await fetch("/api/shops", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        vendor_id: shopId,
        display_name: shopName,
        reach_plan: "free",
        password: password,
        map_unlock: {
          method: "",
          reference: ""
        }
      })
    });
    return {
      ok: response.ok,
      status: response.status,
      payload: await parseJson(response)
    };
  }

  async function submit() {
    if (state.isSubmitting) return;

    var rawShopName = String(shopNameInput ? shopNameInput.value : "").trim();
    var password = String(passwordInput ? passwordInput.value : "");
    var shopId = slugify(rawShopName);

    if (!rawShopName) {
      setStatus("Enter your username.", "error");
      return;
    }
    if (!password) {
      setStatus("Enter your password.", "error");
      return;
    }
    if (password.length < 6) {
      setStatus("Use at least 6 characters.", "error");
      return;
    }

    state.isSubmitting = true;
    if (submitButton) submitButton.disabled = true;
    setStatus("Opening your profile...", "pending");

    try {
      var loginResult = await attemptLogin(shopId, password);
      if (loginResult.ok) {
        saveShopIdentity(rawShopName, shopId);
        setStatus("Opening your profile...", "success");
        window.setTimeout(function () {
          window.location.href = loginResult.payload.launch_url || ("/hashop?shop=" + encodeURIComponent(shopId));
        }, 160);
        return;
      }

      if (loginResult.status === 401 && await shopExists(shopId)) {
        throw new Error("wrong_password");
      }

      setStatus("Creating your profile...", "pending");
      var createResult = await attemptCreate(shopId, rawShopName, password);
      if (!createResult.ok) {
        throw new Error((createResult.payload && createResult.payload.error) || "create_failed");
      }

      saveShopIdentity(rawShopName, shopId);
      setStatus("Profile created. Opening...", "success");
      window.setTimeout(function () {
        window.location.href = createResult.payload.launch_url || ("/hashop?shop=" + encodeURIComponent(shopId));
      }, 180);
    } catch (error) {
      state.isSubmitting = false;
      if (submitButton) submitButton.disabled = false;
      if (error && error.message === "wrong_password") {
        setStatus("Password is wrong for this username.", "error");
        return;
      }
      setStatus("Could not open your profile right now.", "error");
    }
  }

  function setMapView(lat, lng, accuracy) {
    if (!state.map || !window.L || !isFinite(lat) || !isFinite(lng)) return;

    if (!state.userMarker) {
      state.userMarker = window.L.circleMarker([lat, lng], {
        radius: 7,
        weight: 2,
        color: "#9befff",
        fillColor: "#29c6ea",
        fillOpacity: 1
      }).addTo(state.map);
    } else {
      state.userMarker.setLatLng([lat, lng]);
    }

    var safeAccuracy = Math.max(Number(accuracy) || 0, 40);
    if (!state.userAccuracy) {
      state.userAccuracy = window.L.circle([lat, lng], {
        radius: safeAccuracy,
        weight: 1,
        color: "rgba(41, 198, 234, 0.44)",
        fillColor: "rgba(41, 198, 234, 0.12)",
        fillOpacity: 0.3
      }).addTo(state.map);
    } else {
      state.userAccuracy.setLatLng([lat, lng]);
      state.userAccuracy.setRadius(safeAccuracy);
    }

    state.map.setView([lat, lng], 14, { animate: false });
    saveLastLocation(lat, lng, accuracy);
  }

  function initMap() {
    if (!mapNode || !window.L) return;

    state.map = window.L.map(mapNode, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      tap: false
    });

    window.L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      subdomains: "abcd",
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
    }).addTo(state.map);

    var savedLocation = loadLastLocation();
    if (savedLocation) {
      setMapView(savedLocation.lat, savedLocation.lng, savedLocation.accuracy);
    } else {
      state.map.setView([22.9734, 78.6569], 4, { animate: false });
    }

    if (navigator.permissions && navigator.geolocation) {
      navigator.permissions.query({ name: "geolocation" }).then(function (result) {
        if (!result || result.state !== "granted") return;
        navigator.geolocation.getCurrentPosition(function (position) {
          if (!position || !position.coords) return;
          setMapView(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
        }, function () {}, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 60000
        });
      }).catch(function () {});
    }
  }

  if (shopNameInput) {
    shopNameInput.value = loadSavedShopName();
    shopNameInput.addEventListener("input", function () {
      setStatus("", "");
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener("input", function () {
      setStatus("", "");
    });
    passwordInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") submit();
    });
  }

  if (shopNameInput) {
    shopNameInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") submit();
    });
  }

  if (submitButton) {
    submitButton.addEventListener("click", submit);
  }

  initMap();
}());
