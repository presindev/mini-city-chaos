(function (root) {
  'use strict';

  const CONFIG = root.CONFIG || (typeof require !== 'undefined' ? require('../config.js') : null);
  const Weapons = root.Weapons || (typeof require !== 'undefined' ? require('../weapons.js') : null);

  const STYLE = {
    PISTOL: { color: '#4aa8ff', label: 'P' },
    SHOTGUN: { color: '#ff9a3a', label: 'E' }
  };

  // Weapon pickup at a fixed spot. Walking over it gives the weapon + ammo;
  // it comes back after RESPAWN_TIME seconds.
  class Pickup {
    constructor(x, y, weapon) {
      this.x = x;
      this.y = y;
      this.weapon = weapon; // 'PISTOL' | 'SHOTGUN'
      this.radius = CONFIG.PICKUPS.RADIUS;
      this.active = true;
      this.respawnTimer = 0;
      this.bob = Math.random() * Math.PI * 2; // visual only
    }

    // `player` needs {x, y, radius, inventory}. Returns true if picked up this frame.
    update(dt, player) {
      this.bob += dt * 4;
      if (!this.active) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) this.active = true;
        return false;
      }
      if (!player) return false;
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const r = player.radius + this.radius;
      if (dx * dx + dy * dy >= r * r) return false;
      Weapons.addWeapon(player.inventory, this.weapon, CONFIG.WEAPONS[this.weapon].PICKUP_AMMO);
      this.active = false;
      this.respawnTimer = CONFIG.PICKUPS.RESPAWN_TIME;
      return true;
    }

    draw(ctx, camera) {
      if (!this.active) return;
      const p = camera.worldToScreen(this.x, this.y);
      const s = STYLE[this.weapon];
      const r = this.radius + Math.sin(this.bob) * 1.5;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.arc(p.x + 2, p.y + 3, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.color;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.label, p.x, p.y + 1);
    }
  }

  root.Pickup = Pickup;
  if (typeof module !== 'undefined' && module.exports) module.exports = Pickup;
})(typeof window !== 'undefined' ? window : globalThis);
