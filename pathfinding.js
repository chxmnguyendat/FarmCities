// Grid-based A* navigation with obstacle-aware path smoothing.
(function (root) {
  "use strict";

  const STEP = 16;
  const DIRECTIONS = [
    [-1, 0, 10], [1, 0, 10], [0, -1, 10], [0, 1, 10],
    [-1, -1, 14], [1, -1, 14], [-1, 1, 14], [1, 1, 14]
  ];

  function MinHeap() {
    this.items = [];
  }

  MinHeap.prototype.push = function (node, score) {
    const item = { node: node, score: score };
    let i = this.items.length;
    this.items.push(item);
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.items[parent].score <= score) break;
      this.items[i] = this.items[parent];
      i = parent;
    }
    this.items[i] = item;
  };

  MinHeap.prototype.pop = function () {
    if (!this.items.length) return null;
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length) {
      let i = 0;
      while (true) {
        const left = i * 2 + 1;
        const right = left + 1;
        if (left >= this.items.length) break;
        const child = right < this.items.length && this.items[right].score < this.items[left].score ? right : left;
        if (this.items[child].score >= last.score) break;
        this.items[i] = this.items[child];
        i = child;
      }
      this.items[i] = last;
    }
    return first;
  };

  function findPath(start, target, width, height, radius, isBlocked) {
    if (typeof isBlocked !== "function") return null;
    const safeRadius = Math.max(0, radius || 0);
    const columns = Math.floor((width - safeRadius * 2) / STEP) + 1;
    const rows = Math.floor((height - safeRadius * 2) / STEP) + 1;
    const total = columns * rows;
    const point = function (gx, gy) {
      return { x: safeRadius + gx * STEP, y: safeRadius + gy * STEP };
    };
    const idOf = function (gx, gy) { return gy * columns + gx; };
    const gridPoint = function (id) { return { x: id % columns, y: Math.floor(id / columns) }; };
    const isWalkable = function (gx, gy) {
      if (gx < 0 || gy < 0 || gx >= columns || gy >= rows) return false;
      const p = point(gx, gy);
      return !isBlocked(p.x, p.y, safeRadius);
    };
    const nearestCell = function (p) {
      return {
        x: Math.max(0, Math.min(columns - 1, Math.round((p.x - safeRadius) / STEP))),
        y: Math.max(0, Math.min(rows - 1, Math.round((p.y - safeRadius) / STEP)))
      };
    };

    function nearestWalkable(p) {
      const origin = nearestCell(p);
      if (isWalkable(origin.x, origin.y)) return origin;
      for (let ring = 1; ring <= 12; ring += 1) {
        let best = null;
        let bestDistance = Infinity;
        for (let dy = -ring; dy <= ring; dy += 1) {
          for (let dx = -ring; dx <= ring; dx += 1) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
            const gx = origin.x + dx;
            const gy = origin.y + dy;
            if (!isWalkable(gx, gy)) continue;
            const candidate = point(gx, gy);
            const distance = (candidate.x - p.x) ** 2 + (candidate.y - p.y) ** 2;
            if (distance < bestDistance) {
              bestDistance = distance;
              best = { x: gx, y: gy };
            }
          }
        }
        if (best) return best;
      }
      return null;
    }

    const startCell = nearestWalkable(start);
    const targetCell = nearestWalkable(target);
    if (!startCell || !targetCell) return null;
    const startId = idOf(startCell.x, startCell.y);
    const targetId = idOf(targetCell.x, targetCell.y);
    const costs = new Float64Array(total);
    costs.fill(Infinity);
    const parents = new Int32Array(total);
    parents.fill(-1);
    const closed = new Uint8Array(total);
    const heap = new MinHeap();
    const goal = targetCell;
    const heuristic = function (gx, gy) {
      const dx = Math.abs(gx - goal.x);
      const dy = Math.abs(gy - goal.y);
      return 14 * Math.min(dx, dy) + 10 * Math.abs(dx - dy);
    };
    costs[startId] = 0;
    heap.push(startId, heuristic(startCell.x, startCell.y));

    while (heap.items.length) {
      const current = heap.pop().node;
      if (closed[current]) continue;
      if (current === targetId) break;
      closed[current] = 1;
      const cell = gridPoint(current);

      for (let i = 0; i < DIRECTIONS.length; i += 1) {
        const direction = DIRECTIONS[i];
        const nx = cell.x + direction[0];
        const ny = cell.y + direction[1];
        if (!isWalkable(nx, ny)) continue;
        if (direction[0] && direction[1] && (!isWalkable(cell.x + direction[0], cell.y) || !isWalkable(cell.x, cell.y + direction[1]))) continue;

        const next = idOf(nx, ny);
        if (closed[next]) continue;
        const nextCost = costs[current] + direction[2];
        if (nextCost >= costs[next]) continue;
        costs[next] = nextCost;
        parents[next] = current;
        heap.push(next, nextCost + heuristic(nx, ny));
      }
    }

    if (startId !== targetId && parents[targetId] === -1) return null;
    const raw = [];
    let cursor = targetId;
    while (cursor !== startId) {
      const cell = gridPoint(cursor);
      raw.push(point(cell.x, cell.y));
      cursor = parents[cursor];
      if (cursor < 0) return null;
    }
    raw.reverse();

    const lineIsWalkable = function (a, b) {
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(distance / Math.max(4, safeRadius / 2)));
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        if (isBlocked(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, safeRadius)) return false;
      }
      return true;
    };

    const smoothed = [];
    let anchor = start;
    let index = 0;
    while (index < raw.length) {
      let furthest = index;
      for (let candidate = raw.length - 1; candidate >= index; candidate -= 1) {
        if (lineIsWalkable(anchor, raw[candidate])) {
          furthest = candidate;
          break;
        }
      }
      smoothed.push(raw[furthest]);
      anchor = raw[furthest];
      index = furthest + 1;
    }
    if (Math.hypot(anchor.x - target.x, anchor.y - target.y) > 2 && !isBlocked(target.x, target.y, safeRadius) && lineIsWalkable(anchor, target)) {
      smoothed.push({ x: target.x, y: target.y });
    }
    return smoothed;
  }

  root.FarmPathfinding = Object.freeze({ findPath: findPath });
})(typeof window !== "undefined" ? window : globalThis);
