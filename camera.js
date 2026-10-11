// Camera zoom, player follow, and map-edge clamping.
(function () {
  "use strict";

  const viewport = document.querySelector(".scene");
  const world = document.querySelector(".world");
  const zoomInput = document.getElementById("camera-zoom");
  const zoomOutput = document.getElementById("camera-zoom-value");
  if (!viewport || !world || !zoomInput || !zoomOutput) return;

  const mapWidth = 1536;
  const mapHeight = 1024;
  const desktopDefaultZoom = 1.4;
  const isTouchDevice = Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  const isNarrowDevice = window.screen ? window.screen.width <= 700 : window.innerWidth <= 700;
  const isPhoneDevice = isTouchDevice || isNarrowDevice;
  const zoomStorageKey = isPhoneDevice ? "farmcities-camera-zoom-mobile-landscape" : "farmcities-camera-zoom";
  const defaultZoom = desktopDefaultZoom;
  const orientationGate = document.getElementById("orientation-gate");
  const portraitQuery = window.matchMedia ? window.matchMedia("(orientation: portrait)") : null;

  function updateOrientationGate() {
    const blocked = isPhoneDevice && Boolean(portraitQuery && portraitQuery.matches);
    document.documentElement.classList.toggle("is-phone-portrait", blocked);
    window.farmOrientationBlocked = blocked;
    if (orientationGate) orientationGate.hidden = !blocked;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function readSavedZoom() {
    try {
      const saved = localStorage.getItem(zoomStorageKey);
      if (saved === null) return defaultZoom;
      const value = Number(saved);
      return Number.isFinite(value) ? value : defaultZoom;
    } catch (error) {
      return defaultZoom;
    }
  }

  let zoom = clamp(readSavedZoom(), Number(zoomInput.min), Number(zoomInput.max));
  let playerX = mapWidth * 0.5;
  let playerY = mapHeight * 0.34;
  let playerMapWidth = mapWidth;
  let playerMapHeight = mapHeight;

  function update(x, y, currentMapWidth, currentMapHeight) {
    playerX = x;
    playerY = y;
    playerMapWidth = currentMapWidth || mapWidth;
    playerMapHeight = currentMapHeight || mapHeight;

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    const baseScale = Math.min(viewportWidth / mapWidth, viewportHeight / mapHeight);
    const worldWidth = mapWidth * baseScale;
    const worldHeight = mapHeight * baseScale;
    const scaledWidth = worldWidth * zoom;
    const scaledHeight = worldHeight * zoom;

    world.style.width = worldWidth + "px";
    world.style.height = worldHeight + "px";
    world.style.setProperty("--camera-ui-scale", String(1 / zoom));
    // Landscape lets the phone use the same map-relative sprite sizes as desktop.
    world.style.setProperty("--mobile-entity-scale", "1");
    world.style.setProperty("--mobile-fish-size", "20px");
    world.style.setProperty("--mobile-marker-size", "18px");

    const playerScreenX = playerX / playerMapWidth * scaledWidth;
    const playerScreenY = playerY / playerMapHeight * scaledHeight;
    const left = scaledWidth <= viewportWidth
      ? (viewportWidth - scaledWidth) / 2
      : clamp(viewportWidth / 2 - playerScreenX, viewportWidth - scaledWidth, 0);
    const top = scaledHeight <= viewportHeight
      ? (viewportHeight - scaledHeight) / 2
      : clamp(viewportHeight / 2 - playerScreenY, viewportHeight - scaledHeight, 0);

    world.style.transform = "translate3d(" + left + "px, " + top + "px, 0) scale(" + zoom + ")";
  }

  function setZoom(value, save) {
    const parsed = Number(value);
    zoom = clamp(Number.isFinite(parsed) ? parsed : defaultZoom, Number(zoomInput.min), Number(zoomInput.max));
    zoomInput.value = String(zoom);
    zoomOutput.value = zoom.toFixed(1) + "×";
    zoomOutput.textContent = zoom.toFixed(1) + "×";
    if (save !== false) {
      try {
        localStorage.setItem(zoomStorageKey, String(zoom));
      } catch (error) {
        // Keep the camera functional when browser storage is unavailable.
      }
    }
    update(playerX, playerY, playerMapWidth, playerMapHeight);
  }

  zoomInput.addEventListener("input", function () {
    setZoom(zoomInput.value);
  });
  window.addEventListener("resize", function () {
    updateOrientationGate();
    update(playerX, playerY, playerMapWidth, playerMapHeight);
  });
  window.addEventListener("orientationchange", updateOrientationGate);
  if (portraitQuery) {
    if (portraitQuery.addEventListener) portraitQuery.addEventListener("change", updateOrientationGate);
    else if (portraitQuery.addListener) portraitQuery.addListener(updateOrientationGate);
  }

  updateOrientationGate();
  window.farmCamera = Object.freeze({ update: update, setZoom: setZoom });
  if (window.farmGame && typeof window.farmGame.getPlayerPosition === "function") {
    const position = window.farmGame.getPlayerPosition();
    update(position.x, position.y, mapWidth, mapHeight);
  } else {
    update(playerX, playerY, mapWidth, mapHeight);
  }
  setZoom(zoom, false);
})();
