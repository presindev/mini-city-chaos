(function (root) {
  'use strict';

  const CONFIG = root.CONFIG || (typeof require !== 'undefined' ? require('./config.js') : null);
  const Utils = root.Utils || (typeof require !== 'undefined' ? require('./utils.js') : null);
  const Bullet = root.Bullet || (typeof require !== 'undefined' ? require('./entities/bullet.js') : null);

  const DEG = Math.PI / 180;

  // Weapon definitions and inventory logic. An inventory is a plain object:
  // { owned: {FISTS, PISTOL, SHOTGUN}, ammo: {PISTOL, SHOTGUN}, current, cooldown }.
  // `game` must provide: bullets[], effects[], getTargets(), damageTarget(t, n, x, y, attacker),
  // scareAt(x, y, r) and optionally emit(name, data) (events 'shot' and 'punch').
  const Weapons = {
    ORDER: ['FISTS', 'PISTOL', 'SHOTGUN'], // slot 1, 2, 3
    DEFS: CONFIG.WEAPONS,

    createInventory() {
      return {
        owned: { FISTS: true, PISTOL: false, SHOTGUN: false },
        ammo: { PISTOL: 0, SHOTGUN: 0 },
        current: 'FISTS',
        cooldown: 0
      };
    },

    update(inv, dt) {
      inv.cooldown = Math.max(0, inv.cooldown - dt);
    },

    // Pickup: gives the weapon (if missing) and ammo, capped at MAX_AMMO.
    addWeapon(inv, key, ammo) {
      inv.owned[key] = true;
      inv.ammo[key] = Math.min(Weapons.DEFS[key].MAX_AMMO, inv.ammo[key] + ammo);
    },

    // Selects slot index 0..2 if that weapon is owned. Returns true on success.
    select(inv, index) {
      const key = Weapons.ORDER[index];
      if (!key || !inv.owned[key]) return false;
      inv.current = key;
      return true;
    },

    // Next/previous owned weapon (dir = +1 or -1), wrapping around.
    cycle(inv, dir) {
      const n = Weapons.ORDER.length;
      let i = Weapons.ORDER.indexOf(inv.current);
      for (let k = 0; k < n; k++) {
        i = (i + dir + n) % n;
        if (inv.owned[Weapons.ORDER[i]]) {
          inv.current = Weapons.ORDER[i];
          return;
        }
      }
    },

    canFire(inv) {
      const def = Weapons.DEFS[inv.current];
      return inv.cooldown <= 0 && (def.INFINITE_AMMO || inv.ammo[inv.current] > 0);
    },

    // Fires the current weapon from `owner` ({x, y, radius}) towards `angle` (radians).
    // Returns true if it fired.
    fire(inv, owner, angle, game) {
      if (!Weapons.canFire(inv)) return false;
      const def = Weapons.DEFS[inv.current];
      inv.cooldown = def.COOLDOWN;
      if (inv.current === 'FISTS') {
        Weapons.punch(owner, angle, def, game);
        return true;
      }

      inv.ammo[inv.current]--;
      const muzzle = owner.radius + 4;
      const x = owner.x + Math.cos(angle) * muzzle;
      const y = owner.y + Math.sin(angle) * muzzle;
      const spread = def.SPREAD * DEG;
      for (let i = 0; i < def.PELLETS; i++) {
        const a = def.PELLETS > 1 ? angle + (i / (def.PELLETS - 1) - 0.5) * spread : angle;
        game.bullets.push(new Bullet(x, y, a, def.BULLET_SPEED, def.RANGE, def.DAMAGE, owner));
      }
      game.effects.push({ kind: 'flash', x, y, angle, time: CONFIG.EFFECTS.FLASH_TIME });
      game.scareAt(owner.x, owner.y, CONFIG.SCARE_RADIUS);
      if (game.emit) game.emit('shot', { weapon: inv.current, x, y, owner });
      return true;
    },

    // Melee: hits every target whose edge is within RANGE and inside the ARC in front.
    punch(owner, angle, def, game) {
      const halfArc = def.ARC * DEG / 2;
      let hit = false;
      for (const t of game.getTargets()) {
        if (t === owner || t.dead) continue;
        const d = Utils.dist(owner.x, owner.y, t.x, t.y);
        if (d - t.radius > owner.radius + def.RANGE) continue;
        const rel = Utils.angleTo(owner.x, owner.y, t.x, t.y) - angle;
        const diff = Math.atan2(Math.sin(rel), Math.cos(rel)); // normalised to [-PI, PI]
        // Outside the arc only counts if the bodies are already touching.
        if (Math.abs(diff) > halfArc && d > owner.radius + t.radius) continue;
        game.damageTarget(t, def.DAMAGE, owner.x, owner.y, owner);
        hit = true;
      }
      game.effects.push({ kind: 'swing', x: owner.x, y: owner.y, angle, time: CONFIG.EFFECTS.SWING_TIME });
      if (game.emit) game.emit('punch', { hit, x: owner.x, y: owner.y, owner });
    }
  };

  root.Weapons = Weapons;
  if (typeof module !== 'undefined' && module.exports) module.exports = Weapons;
})(typeof window !== 'undefined' ? window : globalThis);
