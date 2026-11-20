(function (root) {
  'use strict';

  const CONFIG = root.CONFIG || (typeof require !== 'undefined' ? require('./config.js') : null);
  const Utils = root.Utils || (typeof require !== 'undefined' ? require('./utils.js') : null);

  const TILE = CONFIG.TILE;
  const SIZE = CONFIG.TILE_SIZE;
  const COLS = CONFIG.MAP_COLS;
  const ROWS = CONFIG.MAP_ROWS;
  const PERIOD = CONFIG.MAP.BLOCK_PERIOD;
  const ROAD_WIDTH = CONFIG.MAP.ROAD_WIDTH;

  // Deterministic city grid. Every PERIOD tiles: ROAD_WIDTH road
  // tiles followed by a block (1-tile sidewalk ring around a building or park).
  // Named CityMap to avoid shadowing the built-in Map.
  const CityMap = {
    cols: COLS,
    rows: ROWS,
    width: COLS * SIZE,
    height: ROWS * SIZE,
    tiles: null, // Uint8Array, index = ty * COLS + tx

    generate() {
      const tiles = new Uint8Array(COLS * ROWS);
      for (let ty = 0; ty < ROWS; ty++) {
        for (let tx = 0; tx < COLS; tx++) {
          tiles[ty * COLS + tx] = CityMap.tileAt(tx, ty);
        }
      }
      CityMap.tiles = tiles;
      return tiles;
    },

    // Tile type from the layout rules (used by generate()).
    tileAt(tx, ty) {
      if (tx <= 0 || ty <= 0 || tx >= COLS - 1 || ty >= ROWS - 1) return TILE.BUILDING;
      const lx = tx % PERIOD;
      const ly = ty % PERIOD;
      if (lx < ROAD_WIDTH || ly < ROAD_WIDTH) return TILE.ROAD;
      if (lx === ROAD_WIDTH || ly === ROAD_WIDTH || lx === PERIOD - 1 || ly === PERIOD - 1) {
        return TILE.SIDEWALK;
      }
      const bx = Math.floor(tx / PERIOD);
      const by = Math.floor(ty / PERIOD);
      const isPark = CONFIG.MAP.PARK_BLOCKS.some(([px, py]) => px === bx && py === by);
      return isPark ? TILE.PARK : TILE.BUILDING;
    },

    // Out-of-bounds tiles count as BUILDING (solid).
    getTile(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return TILE.BUILDING;
      return CityMap.tiles[ty * COLS + tx];
    },

    worldToTile(x) {
      return Math.floor(x / SIZE);
    },

    // World coordinates of the centre of a tile.
    tileCenter(tx, ty) {
      return { x: (tx + 0.5) * SIZE, y: (ty + 0.5) * SIZE };
    },

    isSolid(x, y) {
      return CityMap.getTile(CityMap.worldToTile(x), CityMap.worldToTile(y)) === TILE.BUILDING;
    },

    isRoad(x, y) {
      return CityMap.getTile(CityMap.worldToTile(x), CityMap.worldToTile(y)) === TILE.ROAD;
    },

    // Pedestrians walk calmly only on sidewalks and parks.
    isWalkable(x, y) {
      const t = CityMap.getTile(CityMap.worldToTile(x), CityMap.worldToTile(y));
      return t === TILE.SIDEWALK || t === TILE.PARK;
    },

    // Random tile {tx, ty} of the given type. `rng` is injectable for tests.
    randomTileOfType(type, rng = Math.random) {
      const candidates = [];
      for (let i = 0; i < CityMap.tiles.length; i++) {
        if (CityMap.tiles[i] === type) candidates.push(i);
      }
      if (candidates.length === 0) return null;
      const i = candidates[Math.floor(rng() * candidates.length)];
      return { tx: i % COLS, ty: Math.floor(i / COLS) };
    },

    // True if a circle overlaps any solid tile.
    circleHitsSolid(x, y, r) {
      const tx0 = CityMap.worldToTile(x - r);
      const tx1 = CityMap.worldToTile(x + r);
      const ty0 = CityMap.worldToTile(y - r);
      const ty1 = CityMap.worldToTile(y + r);
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          if (CityMap.getTile(tx, ty) !== TILE.BUILDING) continue;
          if (Utils.circleRectCollide(x, y, r, tx * SIZE, ty * SIZE, SIZE, SIZE)) return true;
        }
      }
      return false;
    },

    // Moves a circle by (dx, dy) without entering solid tiles. Moves in small
    // sub-steps, each axis separately, so it slides along walls.
    moveCircle(x, y, r, dx, dy) {
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 2));
      const sx = dx / steps;
      const sy = dy / steps;
      for (let i = 0; i < steps; i++) {
        if (sx !== 0 && !CityMap.circleHitsSolid(x + sx, y, r)) x += sx;
        if (sy !== 0 && !CityMap.circleHitsSolid(x, y + sy, r)) y += sy;
      }
      return { x, y };
    },

    // Draws only the tiles visible through `camera` ({x, y} = top-left in world px).
    draw(ctx, camera) {
      const colors = CONFIG.MAP.COLORS;
      const tx0 = Math.max(0, CityMap.worldToTile(camera.x));
      const ty0 = Math.max(0, CityMap.worldToTile(camera.y));
      const tx1 = Math.min(COLS - 1, CityMap.worldToTile(camera.x + CONFIG.SCREEN_WIDTH));
      const ty1 = Math.min(ROWS - 1, CityMap.worldToTile(camera.y + CONFIG.SCREEN_HEIGHT));
      const ox = -Math.round(camera.x);
      const oy = -Math.round(camera.y);

      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const tile = CityMap.getTile(tx, ty);
          const sx = tx * SIZE + ox;
          const sy = ty * SIZE + oy;
          switch (tile) {
            case TILE.ROAD:
              ctx.fillStyle = colors.ROAD;
              ctx.fillRect(sx, sy, SIZE, SIZE);
              CityMap.drawRoadMarking(ctx, tx, ty, sx, sy);
              break;
            case TILE.SIDEWALK:
              ctx.fillStyle = colors.SIDEWALK;
              ctx.fillRect(sx, sy, SIZE, SIZE);
              ctx.strokeStyle = colors.SIDEWALK_LINE;
              ctx.lineWidth = 1;
              ctx.strokeRect(sx + 0.5, sy + 0.5, SIZE - 1, SIZE - 1);
              break;
            case TILE.PARK:
              ctx.fillStyle = colors.PARK;
              ctx.fillRect(sx, sy, SIZE, SIZE);
              // One tree on alternating tiles (deterministic).
              if ((tx + ty) % 2 === 0) {
                ctx.fillStyle = colors.TREE;
                ctx.beginPath();
                ctx.arc(sx + SIZE / 2, sy + SIZE / 2, SIZE * 0.3, 0, Math.PI * 2);
                ctx.fill();
              }
              break;
            default:
              CityMap.drawBuildingTile(ctx, tx, ty, sx, sy);
          }
        }
      }
    },

    // Dashed centre line between the two lanes; nothing at crossings.
    drawRoadMarking(ctx, tx, ty, sx, sy) {
      const lx = tx % PERIOD;
      const ly = ty % PERIOD;
      const inHorizontalRoad = ly < ROAD_WIDTH;
      const inVerticalRoad = lx < ROAD_WIDTH;
      if (inHorizontalRoad === inVerticalRoad) return; // crossing
      const dash = SIZE / 2;
      ctx.fillStyle = CONFIG.MAP.COLORS.ROAD_LINE;
      if (inHorizontalRoad && ly === 0) ctx.fillRect(sx + SIZE / 4, sy + SIZE - 2, dash, 4);
      if (inVerticalRoad && lx === 0) ctx.fillRect(sx + SIZE - 2, sy + SIZE / 4, 4, dash);
    },

    // Building roof: colour per block, darker edge where it meets non-building tiles.
    drawBuildingTile(ctx, tx, ty, sx, sy) {
      const colors = CONFIG.MAP.COLORS;
      const isBorder = tx === 0 || ty === 0 || tx === COLS - 1 || ty === ROWS - 1;
      const blockIndex = Math.floor(tx / PERIOD) + Math.floor(ty / PERIOD) * 7;
      ctx.fillStyle = isBorder ? colors.WALL : colors.ROOFS[blockIndex % colors.ROOFS.length];
      ctx.fillRect(sx, sy, SIZE, SIZE);
      const edge = 4;
      ctx.fillStyle = colors.ROOF_EDGE;
      if (CityMap.getTile(tx, ty - 1) !== TILE.BUILDING) ctx.fillRect(sx, sy, SIZE, edge);
      if (CityMap.getTile(tx, ty + 1) !== TILE.BUILDING) ctx.fillRect(sx, sy + SIZE - edge, SIZE, edge);
      if (CityMap.getTile(tx - 1, ty) !== TILE.BUILDING) ctx.fillRect(sx, sy, edge, SIZE);
      if (CityMap.getTile(tx + 1, ty) !== TILE.BUILDING) ctx.fillRect(sx + SIZE - edge, sy, edge, SIZE);
    }
  };

  CityMap.generate();

  root.CityMap = CityMap;
  if (typeof module !== 'undefined' && module.exports) module.exports = CityMap;
})(typeof window !== 'undefined' ? window : globalThis);
