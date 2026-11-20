(function (root) {
  'use strict';

  const CONFIG = root.CONFIG || (typeof require !== 'undefined' ? require('./config.js') : null);
  const CityMap = root.CityMap || (typeof require !== 'undefined' ? require('./map.js') : null);
  const Weapons = root.Weapons || (typeof require !== 'undefined' ? require('./weapons.js') : null);

  const H = CONFIG.HUD;

  // Control list shown on the start and pause screens.
  const CONTROLS = [
    ['WASD', 'mover / conducir'],
    ['Ratón', 'apuntar'],
    ['Clic', 'disparar / golpear'],
    ['1 2 3 / rueda', 'cambiar arma'],
    ['E', 'entrar / salir del coche'],
    ['P', 'pausa'],
    ['M', 'silenciar']
  ];

  // HUD, minimap and full-screen menus. Highscore helpers are pure (storage is
  // injectable) so they can be tested in Node; draw* functions only touch `ctx`.
  const Hud = {
    minimapCanvas: null, // pre-rendered city (created lazily, browser only)

    // ---- Pure helpers -------------------------------------------------------

    // 75.4 -> '01:15'
    formatTime(seconds) {
      const s = Math.max(0, Math.floor(seconds));
      const mm = Math.floor(s / 60);
      const ss = s % 60;
      return (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;
    },

    // localStorage in the browser (null in Node or if access throws, e.g. Safari privacy settings).
    defaultStorage() {
      if (typeof window === 'undefined') return null;
      try {
        return window.localStorage || null;
      } catch (e) {
        return null;
      }
    },

    // `storage` (getItem/setItem) defaults to localStorage. Never throws; returns 0 if unknown.
    loadHighscore(storage) {
      const st = storage === undefined ? Hud.defaultStorage() : storage;
      if (!st) return 0;
      try {
        const v = parseInt(st.getItem(CONFIG.HIGHSCORE_KEY), 10);
        return Number.isFinite(v) && v > 0 ? v : 0;
      } catch (e) {
        return 0;
      }
    },

    // Returns true if it was saved.
    saveHighscore(score, storage) {
      const st = storage === undefined ? Hud.defaultStorage() : storage;
      if (!st) return false;
      try {
        st.setItem(CONFIG.HIGHSCORE_KEY, String(Math.floor(score)));
        return true;
      } catch (e) {
        return false;
      }
    },

    // ---- In-game HUD --------------------------------------------------------

    draw(ctx, game) {
      Hud.drawStatus(ctx, game);
      Hud.drawScore(ctx, game);
      Hud.drawMinimap(ctx, game);
    },

    // Top-left panel: health bar, current weapon + ammo, weapon slots.
    drawStatus(ctx, game) {
      const m = H.MARGIN;
      const p = game.player;
      const inv = p.inventory;
      const def = CONFIG.WEAPONS[inv.current];

      ctx.fillStyle = H.PANEL;
      ctx.fillRect(m, m, 250, 92);

      // Health bar
      const ratio = Math.max(0, Math.min(1, p.health / CONFIG.PLAYER.MAX_HEALTH));
      const bx = m + 10;
      const by = m + 10;
      const bw = 230;
      const bh = 16;
      ctx.fillStyle = '#400';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = ratio > 0.5 ? '#3c3' : ratio > 0.25 ? '#ec3' : '#e33';
      ctx.fillRect(bx, by, bw * ratio, bh);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const hpText = 'VIDA ' + Math.max(0, Math.ceil(p.health));
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(hpText, bx + bw / 2, by + bh / 2 + 1);
      ctx.fillText(hpText, bx + bw / 2, by + bh / 2 + 1);

      // Current weapon + ammo
      const ammo = def.INFINITE_AMMO ? '∞' : String(inv.ammo[inv.current]);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(def.NAME, bx, by + 24);
      ctx.textAlign = 'right';
      ctx.fillText(ammo, bx + bw, by + 24);

      // Weapon slots: owned ones bright, current one highlighted.
      const slotW = (bw - 8) / 3;
      Weapons.ORDER.forEach((k, i) => {
        const sx = bx + i * (slotW + 4);
        const sy = by + 50;
        const owned = inv.owned[k];
        ctx.fillStyle = k === inv.current ? H.ACCENT : owned ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)';
        ctx.fillRect(sx, sy, slotW, 18);
        ctx.fillStyle = k === inv.current ? '#000' : owned ? '#fff' : '#777';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((i + 1) + ' ' + CONFIG.WEAPONS[k].NAME, sx + slotW / 2, sy + 10);
      });

      if (p.inCar) {
        ctx.fillStyle = H.ACCENT;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('EN COCHE (E: salir)', m, m + 98);
      }
    },

    // Top-right: wanted stars, score and time survived.
    drawScore(ctx, game) {
      const w = CONFIG.SCREEN_WIDTH;
      const m = H.MARGIN;
      const stars = game.wanted ? game.wanted.stars : 0;
      const max = CONFIG.WANTED.MAX_STARS;
      const size = 13;
      for (let i = 0; i < max; i++) {
        const cx = w - m - size - i * (size * 2 + 6);
        Hud.drawStar(ctx, cx, m + size, size, max - 1 - i < stars);
      }
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 22px sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      const scoreText = 'PUNTOS ' + Math.floor(game.score);
      ctx.strokeText(scoreText, w - m, m + size * 2 + 8);
      ctx.fillStyle = '#fff';
      ctx.fillText(scoreText, w - m, m + size * 2 + 8);
      ctx.font = 'bold 16px sans-serif';
      const timeText = Hud.formatTime(game.time);
      ctx.strokeText(timeText, w - m, m + size * 2 + 36);
      ctx.fillText(timeText, w - m, m + size * 2 + 36);
    },

    drawStar(ctx, cx, cy, r, filled) {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const rr = i % 2 === 0 ? r : r * 0.45;
        ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = filled ? H.STAR : 'rgba(0,0,0,0.45)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = filled ? '#fff' : 'rgba(255,255,255,0.6)';
      ctx.stroke();
    },

    // ---- Minimap ------------------------------------------------------------

    // Renders the static city once (1 tile = MINIMAP_SIZE / cols px). Browser only.
    getMinimapCanvas() {
      if (Hud.minimapCanvas || typeof document === 'undefined') return Hud.minimapCanvas;
      const size = H.MINIMAP_SIZE;
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const g = c.getContext('2d');
      const ts = size / CityMap.cols;
      const T = CONFIG.TILE;
      const colors = {};
      colors[T.ROAD] = H.MINIMAP_COLORS.ROAD;
      colors[T.SIDEWALK] = H.MINIMAP_COLORS.SIDEWALK;
      colors[T.BUILDING] = H.MINIMAP_COLORS.BUILDING;
      colors[T.PARK] = H.MINIMAP_COLORS.PARK;
      for (let ty = 0; ty < CityMap.rows; ty++) {
        for (let tx = 0; tx < CityMap.cols; tx++) {
          g.fillStyle = colors[CityMap.getTile(tx, ty)];
          g.fillRect(tx * ts, ty * ts, Math.ceil(ts), Math.ceil(ts));
        }
      }
      Hud.minimapCanvas = c;
      return c;
    },

    // Bottom-right minimap: city, camera view, player, cops and patrol cars.
    drawMinimap(ctx, game) {
      const size = H.MINIMAP_SIZE;
      const x0 = CONFIG.SCREEN_WIDTH - H.MARGIN - size;
      const y0 = CONFIG.SCREEN_HEIGHT - H.MARGIN - size;
      const scale = size / CityMap.width; // world px -> minimap px
      const toMap = (wx, wy) => ({ x: x0 + wx * scale, y: y0 + wy * scale });

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x0 - 3, y0 - 3, size + 6, size + 6);
      const img = Hud.getMinimapCanvas();
      if (img) {
        ctx.globalAlpha = 0.85;
        ctx.drawImage(img, x0, y0);
        ctx.globalAlpha = 1;
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, size, size);
      ctx.clip();

      // Camera view
      const cam = game.camera;
      const c = toMap(cam.x, cam.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(c.x + 0.5, c.y + 0.5, cam.width * scale, cam.height * scale);

      // Patrol cars and foot cops
      for (const car of game.cars || []) {
        if (!car.isPolice) continue;
        const q = toMap(car.x, car.y);
        ctx.fillStyle = H.MINIMAP_COLORS.PATROL;
        ctx.fillRect(q.x - 3, q.y - 3, 6, 6);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(q.x - 3, q.y - 3, 6, 6);
      }
      ctx.fillStyle = H.MINIMAP_COLORS.COP;
      for (const cop of game.police || []) {
        if (cop.dead) continue;
        const q = toMap(cop.x, cop.y);
        ctx.beginPath();
        ctx.arc(q.x, q.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Player (or the car they drive)
      const p = game.player;
      const src = p.inCar || p;
      const q = toMap(src.x, src.y);
      ctx.fillStyle = H.MINIMAP_COLORS.PLAYER;
      ctx.strokeStyle = '#000';
      ctx.beginPath();
      ctx.arc(q.x, q.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.strokeRect(x0 - 0.5, y0 - 0.5, size + 1, size + 1);
    },

    // ---- Full-screen states ---------------------------------------------------

    // Darkens the whole screen and draws a centred panel of height `panelH`.
    dim(ctx, alpha, panelTop, panelH) {
      ctx.fillStyle = 'rgba(0, 0, 0, ' + alpha + ')';
      ctx.fillRect(0, 0, CONFIG.SCREEN_WIDTH, CONFIG.SCREEN_HEIGHT);
      ctx.fillStyle = 'rgba(10, 10, 14, 0.85)';
      ctx.fillRect(CONFIG.SCREEN_WIDTH / 2 - 260, panelTop, 520, panelH);
    },

    text(ctx, str, x, y, font, color = '#fff', align = 'center') {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.fillText(str, x, y);
    },

    drawControls(ctx, cx, top) {
      CONTROLS.forEach(([key, action], i) => {
        const y = top + i * 26;
        Hud.text(ctx, key, cx - 12, y, 'bold 17px sans-serif', H.ACCENT, 'right');
        Hud.text(ctx, action, cx + 12, y, '17px sans-serif', '#ddd', 'left');
      });
    },

    drawMenu(ctx, game) {
      const w = CONFIG.SCREEN_WIDTH;
      const h = CONFIG.SCREEN_HEIGHT;
      ctx.fillStyle = '#16161a';
      ctx.fillRect(0, 0, w, h);
      // Faint city in the background
      const img = Hud.getMinimapCanvas();
      if (img) {
        ctx.globalAlpha = 0.12;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, (h - w) / 2, w, w);
        ctx.imageSmoothingEnabled = true;
        ctx.globalAlpha = 1;
      }
      Hud.text(ctx, 'MINI CITY CHAOS', w / 2, 110, 'bold 60px sans-serif', H.ACCENT);
      Hud.text(ctx, 'Sobrevive todo lo que puedas. El caos atrae a la policía.', w / 2, 160, '18px sans-serif', '#ccc');
      Hud.drawControls(ctx, w / 2, 230);
      const blink = Math.floor(Date.now() / 500) % 2 === 0;
      if (blink) Hud.text(ctx, 'Pulsa Enter para empezar', w / 2, 450, 'bold 26px sans-serif');
      Hud.text(ctx, 'Récord: ' + game.highscore, w / 2, 510, '20px sans-serif', '#ccc');
    },

    drawPause(ctx) {
      const w = CONFIG.SCREEN_WIDTH;
      Hud.dim(ctx, 0.5, 90, 380);
      Hud.text(ctx, 'PAUSA', w / 2, 140, 'bold 48px sans-serif');
      Hud.text(ctx, 'Pulsa P para continuar', w / 2, 195, '20px sans-serif', '#ccc');
      Hud.drawControls(ctx, w / 2, 270);
    },

    drawGameOver(ctx, game) {
      const w = CONFIG.SCREEN_WIDTH;
      Hud.dim(ctx, 0.55, 110, 390);
      Hud.text(ctx, 'GAME OVER', w / 2, 170, 'bold 64px sans-serif', '#e33');
      Hud.text(ctx, 'Puntos: ' + Math.floor(game.score), w / 2, 260, 'bold 32px sans-serif');
      Hud.text(ctx, 'Tiempo sobrevivido: ' + Hud.formatTime(game.time), w / 2, 305, '20px sans-serif', '#ccc');
      Hud.text(ctx, 'Récord: ' + game.highscore, w / 2, 340, '20px sans-serif', '#ccc');
      if (game.newRecord) Hud.text(ctx, '¡Nuevo récord!', w / 2, 390, 'bold 28px sans-serif', H.STAR);
      Hud.text(ctx, 'Pulsa Enter para reiniciar', w / 2, 460, 'bold 24px sans-serif');
    }
  };

  root.Hud = Hud;
  if (typeof module !== 'undefined' && module.exports) module.exports = Hud;
})(typeof window !== 'undefined' ? window : globalThis);
