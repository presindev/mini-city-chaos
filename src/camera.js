(function (root) {
  'use strict';

  const CONFIG = root.CONFIG || (typeof require !== 'undefined' ? require('./config.js') : null);
  const Utils = root.Utils || (typeof require !== 'undefined' ? require('./utils.js') : null);

  // Camera: (x, y) is the world position of the screen's top-left corner.
  // It centres on a target and is clamped so it never shows outside the map.
  class Camera {
    constructor(mapWidth, mapHeight, viewWidth = CONFIG.SCREEN_WIDTH, viewHeight = CONFIG.SCREEN_HEIGHT) {
      this.mapWidth = mapWidth;
      this.mapHeight = mapHeight;
      this.width = viewWidth;
      this.height = viewHeight;
      this.x = 0;
      this.y = 0;
    }

    follow(targetX, targetY) {
      this.x = Utils.clamp(targetX - this.width / 2, 0, Math.max(0, this.mapWidth - this.width));
      this.y = Utils.clamp(targetY - this.height / 2, 0, Math.max(0, this.mapHeight - this.height));
    }

    worldToScreen(x, y) {
      return { x: x - this.x, y: y - this.y };
    }

    screenToWorld(x, y) {
      return { x: x + this.x, y: y + this.y };
    }
  }

  root.Camera = Camera;
  if (typeof module !== 'undefined' && module.exports) module.exports = Camera;
})(typeof window !== 'undefined' ? window : globalThis);
