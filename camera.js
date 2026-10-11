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
  const DEFAULT_ZOOM = 1.4;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function readSavedZoom() {
    try {
      const saved = localStorage.getItem("farmcities-camera-zoom");
      if (saved === null) return DEFAULT_ZOOM;
      const value = Number(saved);
      return Number.isFinite(value) ? value : DEFAULT_ZOOM;
    } catch (error) {
      return DEFAULT_ZOOM;
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
    // Phone browsers can report a wider CSS viewport (for example, with desktop mode enabled),
    // so include touch input when deciding whether to shrink prominent game sprites.
    const hasCoarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const isPhoneLayout = viewportWidth <= 700 || hasCoarsePointer;
    const mobileEntityScale = isPhoneLayout
      ? clamp(Math.min(viewportWidth, 700) / 800, 0.4, 0.55)
      : 1;
    world.style.setProperty("--mobile-entity-scale", String(mobileEntityScale));
    world.style.setProperty("--mobile-fish-size", (20 * mobileEntityScale) + "px");
    world.style.setProperty("--mobile-marker-size", (18 * mobileEntityScale) + "px");

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
    zoom = clamp(Number.isFinite(parsed) ? parsed : DEFAULT_ZOOM, Number(zoomInput.min), Number(zoomInput.max));
    zoomInput.value = String(zoom);
    zoomOutput.value = zoom.toFixed(1) + "×";
    zoomOutput.textContent = zoom.toFixed(1) + "×";
    if (save !== false) {
      try {
        localStorage.setItem("farmcities-camera-zoom", String(zoom));
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
    update(playerX, playerY, playerMapWidth, playerMapHeight);
  });

  window.farmCamera = Object.freeze({ update: update, setZoom: setZoom });
  if (window.farmGame && typeof window.farmGame.getPlayerPosition === "function") {
    const position = window.farmGame.getPlayerPosition();
    update(position.x, position.y, mapWidth, mapHeight);
  } else {
    update(playerX, playerY, mapWidth, mapHeight);
  }
  setZoom(zoom, false);
})();
