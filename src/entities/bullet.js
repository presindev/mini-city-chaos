(function (root) {
  'use strict';

  const CityMap = root.CityMap || (typeof require !== 'undefined' ? require('../map.js') : null);

  const SUBSTEP = 4; // px; small enough not to skip over a 10 px pedestrian

  // Projectile: flies straight, dies on buildings, at max range, or on the first car or
  // target hit. Car bodies are tested before people, so cars act as cover (also for the
  // player driving one). Hitting a car damages it through game.damageCar (wrecks: no damage).
  class Bullet {
    constructor(x, y, angle, speed, range, damage, owner) {
      this.x = x;
      this.y = y;
      this.prevX = x;
      this.prevY = y;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.speed = speed;
      this.rangeLeft = range;
      this.damage = damage;
      this.owner = owner;
      this.dead = false;
    }

    update(dt, game) {
      if (this.dead) return;
      this.prevX = this.x;
      this.prevY = this.y;
      const distance = Math.min(this.speed * dt, this.rangeLeft);
      const steps = Math.max(1, Math.ceil(distance / SUBSTEP));
      const sx = (this.vx / this.speed) * distance / steps;
      const sy = (this.vy / this.speed) * distance / steps;
      const targets = game.getTargets();
      const cars = game.cars || [];
      for (let i = 0; i < steps; i++) {
        this.x += sx;
        this.y += sy;
        if (CityMap.isSolid(this.x, this.y)) {
          this.dead = true;
          if (game.emit) game.emit('bulletImpact', { x: this.x, y: this.y, target: null });
          return;
        }
        for (const c of cars) {
          if (c.distanceTo(this.x, this.y) !== 0) continue;
          if (game.damageCar) game.damageCar(c, this.damage, this.owner);
          this.dead = true;
          if (game.emit) game.emit('bulletImpact', { x: this.x, y: this.y, target: null, car: c });
          return;
        }
        for (const t of targets) {
          if (t === this.owner || t.dead) continue;
          const dx = t.x - this.x;
          const dy = t.y - this.y;
          if (dx * dx + dy * dy < t.radius * t.radius) {
            game.damageTarget(t, this.damage, this.x - this.vx, this.y - this.vy, this.owner);
            this.dead = true;
            if (game.emit) game.emit('bulletImpact', { x: this.x, y: this.y, target: t });
            return;
          }
        }
      }
      this.rangeLeft -= distance;
      if (this.rangeLeft <= 0) this.dead = true;
    }

    draw(ctx, camera) {
      const a = camera.worldToScreen(this.prevX, this.prevY);
      const b = camera.worldToScreen(this.x, this.y);
      ctx.strokeStyle = '#ffe080';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  root.Bullet = Bullet;
  if (typeof module !== 'undefined' && module.exports) module.exports = Bullet;
})(typeof window !== 'undefined' ? window : globalThis);
