(function (root) {
  'use strict';

  // Pure math and collision helpers. No DOM access (tested with node --test).
  const Utils = {
    clamp(value, min, max) {
      return value < min ? min : value > max ? max : value;
    },

    lerp(a, b, t) {
      return a + (b - a) * t;
    },

    dist(x1, y1, x2, y2) {
      return Math.hypot(x2 - x1, y2 - y1);
    },

    // Angle in radians from (x1, y1) towards (x2, y2). 0 = +x, PI/2 = +y (down).
    angleTo(x1, y1, x2, y2) {
      return Math.atan2(y2 - y1, x2 - x1);
    },

    // Random float in [min, max). `rng` is injectable for deterministic tests.
    randRange(min, max, rng = Math.random) {
      return min + rng() * (max - min);
    },

    // Circle (cx, cy, r) vs axis-aligned rect (x, y, w, h). Touching counts as no collision.
    circleRectCollide(cx, cy, r, x, y, w, h) {
      const nearestX = Utils.clamp(cx, x, x + w);
      const nearestY = Utils.clamp(cy, y, y + h);
      const dx = cx - nearestX;
      const dy = cy - nearestY;
      return dx * dx + dy * dy < r * r;
    },

    circleCircleCollide(x1, y1, r1, x2, y2, r2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const rs = r1 + r2;
      return dx * dx + dy * dy < rs * rs;
    },

    // Axis-aligned rects given as {x, y, w, h}. Shared edges do not overlap.
    rectsOverlap(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }
  };

  root.Utils = Utils;
  if (typeof module !== 'undefined' && module.exports) module.exports = Utils;
})(typeof window !== 'undefined' ? window : globalThis);
