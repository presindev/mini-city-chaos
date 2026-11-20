(function (root) {
  'use strict';

  const CONFIG = root.CONFIG || (typeof require !== 'undefined' ? require('../config.js') : null);
  const Utils = root.Utils || (typeof require !== 'undefined' ? require('../utils.js') : null);
  const CityMap = root.CityMap || (typeof require !== 'undefined' ? require('../map.js') : null);

  const PED = CONFIG.PEDESTRIAN;

  // NPC on foot. Wanders on sidewalks/parks, flees when scared, leaves a body when killed.
  // `rng` is injectable for deterministic tests.
  class Pedestrian {
    constructor(x, y, rng = Math.random) {
      this.rng = rng;
      this.x = x;
      this.y = y;
      this.radius = PED.RADIUS;
      this.health = PED.HEALTH;
      this.color = PED.COLORS[Math.floor(rng() * PED.COLORS.length)];
      this.angle = rng() * Math.PI * 2;
      this.turnTimer = Utils.randRange(PED.TURN_MIN, PED.TURN_MAX, rng);
      this.fleeTimer = 0;
      this.dead = false;
      this.corpseTimer = 0;
      this.remove = false; // the game drops it from its list when true
    }

    get fleeing() {
      return this.fleeTimer > 0;
    }

    pickDirection() {
      this.angle = this.rng() * Math.PI * 2;
      this.turnTimer = Utils.randRange(PED.TURN_MIN, PED.TURN_MAX, this.rng);
    }

    // Run away from (fromX, fromY) for FLEE_TIME seconds.
    scare(fromX, fromY) {
      if (this.dead) return;
      this.fleeTimer = PED.FLEE_TIME;
      this.angle = Utils.angleTo(fromX, fromY, this.x, this.y);
    }

    // Returns true if this hit killed it. Survivors flee from (fromX, fromY) if given.
    takeDamage(amount, fromX, fromY) {
      if (this.dead) return false;
      this.health -= amount;
      if (this.health <= 0) {
        this.health = 0;
        this.dead = true;
        this.corpseTimer = PED.CORPSE_TIME;
        return true;
      }
      if (fromX !== undefined) this.scare(fromX, fromY);
      else this.scare(this.x - Math.cos(this.angle), this.y - Math.sin(this.angle));
      return false;
    }

    update(dt) {
      if (this.dead) {
        this.corpseTimer -= dt;
        if (this.corpseTimer <= 0) this.remove = true;
        return;
      }

      let speed = PED.SPEED;
      if (this.fleeing) {
        this.fleeTimer -= dt;
        speed = PED.FLEE_SPEED;
      } else {
        this.turnTimer -= dt;
        if (this.turnTimer <= 0) this.pickDirection();
      }

      const cos = Math.cos(this.angle);
      const sin = Math.sin(this.angle);

      // When calm, do not step off the sidewalk/park onto the road.
      if (!this.fleeing && CityMap.isWalkable(this.x, this.y)) {
        const aheadX = this.x + cos * (this.radius + 2);
        const aheadY = this.y + sin * (this.radius + 2);
        if (!CityMap.isWalkable(aheadX, aheadY)) {
          this.pickDirection();
          return;
        }
      }

      const dx = cos * speed * dt;
      const dy = sin * speed * dt;
      const moved = CityMap.moveCircle(this.x, this.y, this.radius, dx, dy);
      const blocked = Math.hypot(moved.x - this.x, moved.y - this.y) < Math.hypot(dx, dy) * 0.5;
      this.x = moved.x;
      this.y = moved.y;
      if (blocked) {
        if (this.fleeing) this.angle += Utils.randRange(-Math.PI / 2, Math.PI / 2, this.rng);
        else this.pickDirection();
      }
    }

    draw(ctx, camera) {
      const p = camera.worldToScreen(this.x, this.y);
      const r = this.radius;
      if (this.dead) {
        ctx.save();
        ctx.globalAlpha = Utils.clamp(this.corpseTimer / 1, 0, 1); // fade out in the last second
        ctx.fillStyle = '#7a1010';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r * 1.6, r * 1.1, this.angle, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(this.angle);
      ctx.fillStyle = this.color;
      ctx.strokeStyle = this.fleeing ? '#ff3030' : '#222';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath();
      ctx.arc(r * 0.2, 0, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  root.Pedestrian = Pedestrian;
  if (typeof module !== 'undefined' && module.exports) module.exports = Pedestrian;
})(typeof window !== 'undefined' ? window : globalThis);
