// Main game entry point: arrow-key movement and the main character's walk cycle.
(function () {
  "use strict";

  const map = document.getElementById("farm-map");
  const pondFishSchool = document.getElementById("pond-fish-school");
  const player = document.getElementById("player-character");
  const moveMarker = document.getElementById("move-marker");
  const farmSign = document.getElementById("farm-lv1-sign");
  const farmExitSign = document.getElementById("farm-exit-sign");
  const farmSelect = document.getElementById("farm-lv1-select");
  const farmMenu = document.getElementById("farm-lv1-menu");
  const farmMenuPrompt = document.getElementById("farm-lv1-menu-prompt");
  const farmConfirm = document.getElementById("farm-lv1-confirm");
  const farmCancel = document.getElementById("farm-lv1-cancel");
  const world = document.querySelector(".world");
  const settingsToggle = document.getElementById("settings-toggle");
  const settingsOverlay = document.getElementById("settings-overlay");
  const settingsClose = document.getElementById("settings-close");
  const fullscreenToggle = document.getElementById("fullscreen-toggle");
  const collision = window.FarmFenceCollision;
  if (!map || !pondFishSchool || !player || !moveMarker || !collision || !farmSign || !farmExitSign || !farmSelect || !farmMenu || !farmMenuPrompt || !farmConfirm || !farmCancel || !world || !settingsToggle || !settingsOverlay || !settingsClose || !fullscreenToggle) return;

  const pondFishColors = [
    "assets/fish-pixel-orange.png",
    "assets/fish-pixel-green.png",
    "assets/fish-pixel-blue.png"
  ];
  pondFishSchool.querySelectorAll(".pond-fish").forEach(function (fish) {
    fish.src = pondFishColors[Math.floor(Math.random() * pondFishColors.length)];
    const isMiddleFish = fish.classList.contains("fish-three");
    const startsFacingRight = isMiddleFish || Math.random() < 0.5;
    const duration = 5.5 + Math.random() * 3.5;
    const swimDistance = isMiddleFish ? 18 + Math.random() * 6 : 7 + Math.random() * 7;
    fish.style.setProperty("--fish-start-scale", startsFacingRight ? "1" : "-1");
    fish.style.setProperty("--fish-opposite-scale", startsFacingRight ? "-1" : "1");
    fish.style.setProperty("--fish-swim-distance", (startsFacingRight ? 1 : -1) * swimDistance + "px");
    fish.style.setProperty("--fish-duration", duration + "s");
    fish.style.setProperty("--fish-delay", -Math.random() * duration + "s");
  });

  const mainMap = {
    id: "main",
    src: "map/main-map.png?v=4",
    width: collision.mapWidth,
    height: collision.mapHeight,
    collision: collision,
    spawn: { x: collision.mapWidth * 0.5, y: collision.mapHeight * 0.34 }
  };
  const farmLv1 = {
    id: "Farmlv1",
    src: "map/Farmlv1/map.png?v=2",
    width: 1536,
    height: 1024,
    collision: {
      isBlocked: function (px, py, radius) { return px < radius || py < radius || px > 1536 - radius || py > 1024 - radius; },
      move: function (px, py, dx, dy, radius) {
        return {
          x: Math.max(radius, Math.min(1536 - radius, px + dx)),
          y: Math.max(radius, Math.min(1024 - radius, py + dy))
        };
      }
    },
    spawn: { x: 768, y: 930 }
  };
  const playerRadius = 12;
  const moveSpeed = 240;
  const framesPerSecond = 6;
  const directionRows = { down: 0, up: 1, right: 2, left: 3 };
  const keys = new Set();
  let currentMap = mainMap;
  let x = mainMap.spawn.x;
  let y = mainMap.spawn.y;
  let facing = "down";
  let walkTime = 0;
  let previousWalkFrame = -1;
  let previousFrame = performance.now();
  let route = [];
  let routeIndex = 0;
  let pendingFarmSelection = false;
  let pendingReturnSelection = false;
  const farmZone = { centerX: 636.5, centerY: 191.5 };
  const farmExitZone = { centerX: 768, centerY: 916.5 };
  const mainFarmPrompt = "\u0042\u1EA1n mu\u1ED1n \u0111\u1EBFn Farm LV1?";
  const returnMapPrompt = "Tr\u1EDF v\u1EC1 nh\u00E0 ?";
  const interactionDistance = 40;

  function renderPlayer() {
    player.style.left = (x / currentMap.width * 100) + "%";
    player.style.top = (y / currentMap.height * 100) + "%";
    updateMapInteraction();
    if (window.farmCamera) {
      window.farmCamera.update(x, y, currentMap.width, currentMap.height);
    }
  }

  function showMoveMarker(point) {
    moveMarker.style.left = (point.x / currentMap.width * 100) + "%";
    moveMarker.style.top = (point.y / currentMap.height * 100) + "%";
    moveMarker.hidden = false;
    moveMarker.style.animation = "none";
    void moveMarker.offsetWidth;
    moveMarker.style.animation = "";
  }

  function updateMapInteraction() {
    farmSign.hidden = currentMap.id !== "main";
    farmExitSign.hidden = currentMap.id !== "Farmlv1";
    pondFishSchool.hidden = currentMap.id !== "main";
    if (currentMap.id === "main") {
      farmMenu.classList.remove("is-exit");
      farmSelect.classList.remove("is-exit-select");
      farmMenuPrompt.textContent = mainFarmPrompt;
      const distance = Math.hypot(x - farmZone.centerX, y - farmZone.centerY);
      const reachedCenter = distance <= interactionDistance;
      farmSelect.hidden = !(reachedCenter || pendingFarmSelection);
      farmMenu.hidden = !(pendingFarmSelection && reachedCenter);
    } else {
      farmMenu.classList.add("is-exit");
      farmSelect.classList.add("is-exit-select");
      farmMenuPrompt.textContent = returnMapPrompt;
      const distance = Math.hypot(x - farmExitZone.centerX, y - farmExitZone.centerY);
      const reachedExit = distance <= interactionDistance;
      farmSelect.hidden = !pendingReturnSelection;
      farmMenu.hidden = !(pendingReturnSelection && reachedExit);
    }
  }

  function switchMap(target, arrival) {
    currentMap = target;
    route = [];
    routeIndex = 0;
    pendingFarmSelection = false;
    pendingReturnSelection = false;
    farmMenu.hidden = true;
    moveMarker.hidden = true;
    x = arrival.x;
    y = arrival.y;
    keys.clear();
    walkTime = 0;
    previousWalkFrame = -1;
    player.classList.remove("is-walking");
    map.src = target.src;
    map.alt = target.id === "main" ? "Map nông trại chính" : "Khu đất trồng Farmlv1";
    renderPlayer();
  }

  function enterFarmLv1() {
    if (currentMap.id === "main" && pendingFarmSelection && Math.hypot(x - farmZone.centerX, y - farmZone.centerY) <= interactionDistance) {
      switchMap(farmLv1, farmLv1.spawn);
    } else if (currentMap.id === "Farmlv1" && pendingReturnSelection && Math.hypot(x - farmExitZone.centerX, y - farmExitZone.centerY) <= interactionDistance) {
      returnToMain();
    }
  }

  function cancelFarmSelection() {
    pendingFarmSelection = false;
    pendingReturnSelection = false;
    farmMenu.hidden = true;
    updateMapInteraction();
  }

  function returnToMain() {
    if (currentMap.id === "Farmlv1") switchMap(mainMap, { x: 640, y: 322 });
  }

  function setSettingsOpen(open) {
    settingsOverlay.hidden = !open;
    settingsToggle.setAttribute("aria-expanded", String(open));
    if (open) {
      keys.clear();
      route = [];
      routeIndex = 0;
      settingsClose.focus();
    } else {
      settingsToggle.focus();
    }
  }

  function syncFullscreenLabel() {
    fullscreenToggle.textContent = document.fullscreenElement ? "Thoát toàn màn hình" : "Bật toàn màn hình";
  }

  function directionFor(code) {
    switch (code) {
      case "ArrowUp": return "up";
      case "ArrowDown": return "down";
      case "ArrowLeft": return "left";
      case "ArrowRight": return "right";
      default: return null;
    }
  }

  function updateWalkFrame() {
    const frame = Math.floor(walkTime * framesPerSecond) % 6;
    if (frame === previousWalkFrame) return;
    previousWalkFrame = frame;
    player.style.setProperty("--frame-x", (frame * 20) + "%");
    player.style.setProperty("--frame-y", (directionRows[facing] * 100 / 3) + "%");
  }

  window.addEventListener("keydown", function (event) {
    if (!settingsOverlay.hidden) {
      if (event.code === "Escape") {
        event.preventDefault();
        setSettingsOpen(false);
      }
      return;
    }
    if (event.code === "Escape" && currentMap.id === "Farmlv1") {
      event.preventDefault();
      returnToMain();
      return;
    }
    const direction = directionFor(event.code);
    if (!direction) return;
    event.preventDefault();
    cancelFarmSelection();
    route = [];
    routeIndex = 0;
    moveMarker.hidden = true;
    keys.add(direction);
  });

  window.addEventListener("keyup", function (event) {
    const direction = directionFor(event.code);
    if (direction) keys.delete(direction);
  });

  window.addEventListener("blur", function () {
    keys.clear();
  });

  farmConfirm.addEventListener("click", enterFarmLv1);
  farmCancel.addEventListener("click", cancelFarmSelection);
  world.addEventListener("click", function (event) {
    if (!settingsOverlay.hidden || event.target.closest("button")) return;
    const rect = world.getBoundingClientRect();
    if (!rect.width || !rect.height || !window.FarmPathfinding) return;
    const target = {
      x: Math.max(0, Math.min(currentMap.width, (event.clientX - rect.left) / rect.width * currentMap.width)),
      y: Math.max(0, Math.min(currentMap.height, (event.clientY - rect.top) / rect.height * currentMap.height))
    };
    const clickedFarmZone = currentMap.id === "main" && target.x >= 520 && target.x <= 755 && target.y >= 100 && target.y <= 290;
    const clickedFarmExit = currentMap.id === "Farmlv1" && target.x >= 683 && target.x <= 853 && target.y >= 809 && target.y <= 1024;
    if (clickedFarmZone || clickedFarmExit) {
      moveMarker.hidden = true;
    } else {
      showMoveMarker({ x: target.x, y: target.y });
    }
    if (clickedFarmZone) {
      pendingFarmSelection = true;
      pendingReturnSelection = false;
      farmMenu.classList.remove("is-exit");
      farmSelect.classList.remove("is-exit-select");
      farmMenuPrompt.textContent = mainFarmPrompt;
      target.x = farmZone.centerX;
      target.y = farmZone.centerY;
    } else if (clickedFarmExit) {
      pendingFarmSelection = false;
      pendingReturnSelection = true;
      farmMenu.classList.add("is-exit");
      farmSelect.classList.add("is-exit-select");
      farmMenuPrompt.textContent = returnMapPrompt;
      target.x = farmExitZone.centerX;
      target.y = farmExitZone.centerY;
    } else {
      cancelFarmSelection();
    }
    route = [];
    routeIndex = 0;
    const path = window.FarmPathfinding.findPath(
      { x: x, y: y }, target, currentMap.width, currentMap.height, playerRadius, currentMap.collision.isBlocked
    );
    if (path) {
      route = path;
      routeIndex = 0;
      keys.clear();
      renderPlayer();
    } else if (clickedFarmZone || clickedFarmExit) {
      cancelFarmSelection();
      renderPlayer();
    }
  });
  settingsToggle.addEventListener("click", function () {
    setSettingsOpen(settingsOverlay.hidden);
  });
  settingsClose.addEventListener("click", function () {
    setSettingsOpen(false);
  });
  settingsOverlay.addEventListener("click", function (event) {
    if (event.target === settingsOverlay) setSettingsOpen(false);
  });
  fullscreenToggle.addEventListener("click", function () {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  });
  document.addEventListener("fullscreenchange", syncFullscreenLabel);
  syncFullscreenLabel();

  function frame(now) {
    const elapsed = Math.min((now - previousFrame) / 1000, 0.05);
    previousFrame = now;

    let dx = (Number(keys.has("right")) - Number(keys.has("left"))) * moveSpeed * elapsed;
    let dy = (Number(keys.has("down")) - Number(keys.has("up"))) * moveSpeed * elapsed;
    if (!keys.size && routeIndex < route.length) {
      const waypoint = route[routeIndex];
      const differenceX = waypoint.x - x;
      const differenceY = waypoint.y - y;
      const distance = Math.hypot(differenceX, differenceY);
      if (distance < Math.max(4, moveSpeed * elapsed)) {
        dx = differenceX;
        dy = differenceY;
        routeIndex += 1;
      } else {
        dx = differenceX / distance * moveSpeed * elapsed;
        dy = differenceY / distance * moveSpeed * elapsed;
      }
    }
    const requestedLength = Math.hypot(dx, dy);

    if (requestedLength > moveSpeed * elapsed) {
      dx = dx / requestedLength * moveSpeed * elapsed;
      dy = dy / requestedLength * moveSpeed * elapsed;
    }

    let moved = false;
    if (requestedLength > 0) {
      const next = currentMap.collision.move(x, y, dx, dy, playerRadius);
      moved = Math.hypot(next.x - x, next.y - y) > 0.01;
      if (moved) {
        x = Math.max(playerRadius, Math.min(currentMap.width - playerRadius, next.x));
        y = Math.max(playerRadius, Math.min(currentMap.height - playerRadius, next.y));
        if (Math.abs(dx) > Math.abs(dy)) facing = dx < 0 ? "left" : "right";
        else facing = dy < 0 ? "up" : "down";
        renderPlayer();
      } else if (!keys.size) {
        route = [];
        routeIndex = 0;
      }
    }

    if (moved) {
      player.classList.add("is-walking");
      walkTime += elapsed;
      updateWalkFrame();
    } else {
      player.classList.remove("is-walking");
      walkTime = 0;
      previousWalkFrame = -1;
      if (routeIndex >= route.length) {
        route = [];
        routeIndex = 0;
        moveMarker.hidden = true;
      }
    }

    requestAnimationFrame(frame);
  }

  renderPlayer();
  requestAnimationFrame(frame);

  window.farmGame = Object.freeze({
    map: map,
    player: player,
    get mapId() { return currentMap.id; },
    get collision() { return currentMap.collision; },
    getPlayerPosition: function () { return { x: x, y: y }; },
    enterFarmLv1: enterFarmLv1,
    returnToMain: returnToMain
  });
})();
