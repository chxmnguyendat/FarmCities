/*
 * Map movement bounds for main-map.png (1536 x 1024 coordinate space).
 * Character positions passed here are the center of the character collider.
 * Fence segments block movement; coordinates match the farmstead map.
 * Include this file when adding player movement and call FarmFenceCollision.move().
 */
(function (root) {
  "use strict";

  const obstacles = [
    // Upper boundary fence sections.
    { x: 84, y: 72, w: 642, h: 18 },
    { x: 816, y: 72, w: 332, h: 18 },

    // Pig enclosure.
    { x: 36, y: 399, w: 245, h: 18 },
    { x: 42, y: 392, w: 18, h: 218 },
    { x: 258, y: 392, w: 18, h: 218 },
    { x: 36, y: 591, w: 245, h: 18 },

    // Cow enclosure.
    { x: 1208, y: 399, w: 292, h: 18 },
    { x: 1214, y: 392, w: 18, h: 220 },
    { x: 1476, y: 392, w: 18, h: 220 },
    { x: 1208, y: 591, w: 292, h: 18 },

    // Chicken enclosure.
    { x: 336, y: 681, w: 232, h: 18 },
    { x: 342, y: 674, w: 18, h: 238 },
    { x: 544, y: 674, w: 18, h: 238 },
    { x: 336, y: 887, w: 232, h: 18 },

    // Short porch railings by the farmhouse.
    { x: 1198, y: 241, w: 148, h: 16 },
    { x: 1202, y: 238, w: 14, h: 68 },
    { x: 1330, y: 238, w: 14, h: 68 },

    // Cow barn roof and upper walls; keep the player in front of the building.
    { x: 1260, y: 344, w: 230, h: 142 }
  ];

  function blocked(x, y, radius) {
    const r = Math.max(0, radius || 8);
    const blockedByFence = obstacles.some(function (box) {
      const nearestX = Math.max(box.x, Math.min(x, box.x + box.w));
      const nearestY = Math.max(box.y, Math.min(y, box.y + box.h));
      const dx = x - nearestX;
      const dy = y - nearestY;
      return dx * dx + dy * dy < r * r;
    });
    if (blockedByFence) return true;

    const pondRadiusX = 142 + r;
    const pondRadiusY = 110 + r;
    const pondX = (x - 130) / pondRadiusX;
    const pondY = (y - 790) / pondRadiusY;
    const insidePond = pondX * pondX + pondY * pondY < 1;
    const onBridge = x >= 210 - r && x <= 280 + r && y >= 791 - r && y <= 853 + r;
    return insidePond && !onBridge;
  }

  // Move in small axis-separated steps to prevent tunnelling through a fence.
  function move(x, y, dx, dy, radius) {
    const r = Math.max(0, radius || 8);
    const count = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / Math.max(1, r / 2)));
    const stepX = dx / count;
    const stepY = dy / count;
    for (let i = 0; i < count; i += 1) {
      if (!blocked(x + stepX, y, r)) x += stepX;
      if (!blocked(x, y + stepY, r)) y += stepY;
    }
    return { x: x, y: y };
  }

  root.FarmFenceCollision = Object.freeze({
    mapWidth: 1536,
    mapHeight: 1024,
    defaultRadius: 8,
    obstacles: Object.freeze(obstacles.map(function (box) { return Object.freeze(box); })),
    isBlocked: blocked,
    move: move
  });
})(typeof window !== "undefined" ? window : globalThis);
