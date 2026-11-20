(function (root) {
  'use strict';

  const CONFIG = root.CONFIG || (typeof require !== 'undefined' ? require('../config.js') : null);
  const Utils = root.Utils || (typeof require !== 'undefined' ? require('../utils.js') : null);
  const CityMap = root.CityMap || (typeof require !== 'undefined' ? require('../map.js') : null);
  const Bullet = root.Bullet || (typeof require !== 'undefined' ? require('./bullet.js') : null);

  const POL = CONFIG.POLICE;
  const DEG = Math.PI / 180;

  // Cop on foot. Chases the player, shoots a pistol when in range, leaves a body when killed.
  // When `leaving` is true (wanted level dropped) it walks away; the game removes it off-screen.
  // `game` must provide: player {x, y, dead?}, bullets[], and optionally emit(), scareAt().
  class Police {
    constructor(x, y, rng = Math.random) {
      this.rng = rng;
      this.x = x;
      this.y = y;
      this.radius = POL.RADIUS;
      this.health = POL.HEALTH;
      this.angle = 0;
      this.fireCooldown = POL.FIRE_COOLDOWN * rng(); // desync shots between cops
      this.detourTimer = 0;
      this.detourAngle = 0;
      this.leaving = false;
      this.dead = false;
      this.corpseTimer = 0;
      this.remove = false; // the game drops it from its list when true
    }

    // Vision is just a radius (walls are ignored).
    canSee(x, y) {
      return !this.dead && Utils.dist(this.x, this.y, x, y) <= CONFIG.WANTED.VISION_RADIUS;
    }

    // Returns true if this hit killed it.
    takeDamage(amount) {
      if (this.dead) return false;
      this.health -= amount;
      if (this.health <= 0) {
        this.health = 0;
        this.dead = true;
        this.corpseTimer = POL.CORPSE_TIME;
        return true;
      }
      return false;
    }

    update(dt, game) {
      if (this.dead) {
        this.corpseTimer -= dt;
        if (this.corpseTimer <= 0) this.remove = true;
        return;
      }
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
      const player = game.player;
      const dist = Utils.dist(this.x, this.y, player.x, player.y);
      const toPlayer = Utils.angleTo(this.x, this.y, player.x, player.y);

      if (this.leaving || player.dead) {
        this.angle = toPlayer + Math.PI;
        this.walk(this.angle, dt);
        return;
      }

      this.angle = toPlayer;
      if (dist > POL.KEEP_DISTANCE) {
        if (this.detourTimer > 0) {
          this.detourTimer -= dt;
          this.walk(this.detourAngle, dt);
        } else if (!this.walk(toPlayer, dt)) {
          // Blocked by a building: walk sideways for a moment to get around it.
          const side = this.rng() < 0.5 ? -1 : 1;
          this.detourAngle = toPlayer + side * Math.PI / 2;
          this.detourTimer = POL.DETOUR_TIME;
        }
      }

      if (dist < POL.SHOOT_RANGE && this.fireCooldown <= 0) this.shoot(game, toPlayer);
    }

    // Moves without entering buildings. Returns false if mostly blocked.
    walk(angle, dt) {
      const dx = Math.cos(angle) * POL.SPEED * dt;
      const dy = Math.sin(angle) * POL.SPEED * dt;
      const moved = CityMap.moveCircle(this.x, this.y, this.radius, dx, dy);
      const ok = Math.hypot(moved.x - this.x, moved.y - this.y) >= Math.hypot(dx, dy) * 0.5;
      this.x = moved.x;
      this.y = moved.y;
      return ok;
    }

    shoot(game, angle) {
      this.fireCooldown = POL.FIRE_COOLDOWN;
      const a = angle + (this.rng() * 2 - 1) * POL.AIM_ERROR * DEG;
      const muzzle = this.radius + 4;
      const x = this.x + Math.cos(a) * muzzle;
      const y = this.y + Math.sin(a) * muzzle;
      game.bullets.push(new Bullet(x, y, a, POL.BULLET_SPEED, POL.BULLET_RANGE, POL.DAMAGE, this));
      if (game.effects) game.effects.push({ kind: 'flash', x, y, angle: a, time: CONFIG.EFFECTS.FLASH_TIME });
      if (game.scareAt) game.scareAt(this.x, this.y, CONFIG.SCARE_RADIUS);
      if (game.emit) game.emit('copShot', { cop: this });
    }

    draw(ctx, camera) {
      const p = camera.worldToScreen(this.x, this.y);
      const r = this.radius;
      if (this.dead) {
        ctx.save();
        ctx.globalAlpha = Utils.clamp(this.corpseTimer / 1, 0, 1);
        ctx.fillStyle = '#7a1010';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r * 1.6, r * 1.1, this.angle, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a2a5a';
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(this.angle);
      // Gun.
      ctx.fillStyle = '#111';
      ctx.fillRect(r - 2, -2, 12, 4);
      // Uniform.
      ctx.fillStyle = '#1a2a5a';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Cap with a visor pointing forward and a gold badge.
      ctx.fillStyle = '#0a0f22';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(r * 0.3, -r * 0.4, r * 0.45, r * 0.8);
      ctx.fillStyle = '#f0c040';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---------------- Patrol cars (step 6.4) ----------------
  // A patrol car is a regular Car (F5) with isPolice = true, driver 'ai' and Police.patrolAI.
  // The Car class is looked up lazily because car.js may load after this file in tests.
  function CarClass() {
    return root.Car || (typeof require !== 'undefined' ? require('./car.js') : null);
  }

  const PERIOD = CONFIG.MAP.BLOCK_PERIOD;
  const SIZE = CONFIG.TILE_SIZE;
  const NODE_MAX = Math.floor((CONFIG.MAP_COLS - 1) / PERIOD);

  // Centres of the road intersections (same grid the traffic AI uses).
  const NODES = [];
  for (let i = 1; i <= NODE_MAX; i++) {
    for (let j = 1; j <= NODE_MAX; j++) NODES.push({ i, j, x: (PERIOD * i + 1) * SIZE, y: (PERIOD * j + 1) * SIZE });
  }

  // True if a car-sized circle can travel in a straight line between two points.
  function clearLine(x1, y1, x2, y2) {
    const d = Utils.dist(x1, y1, x2, y2);
    const steps = Math.max(1, Math.ceil(d / 16));
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      if (CityMap.circleHitsSolid(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, CONFIG.CAR.HEIGHT / 2)) return false;
    }
    return true;
  }

  Police.createPatrolCar = function (x, y, angle) {
    const Car = CarClass();
    const car = new Car(x, y, angle, POL.PATROL_COLOR);
    car.isPolice = true;
    car.driver = 'ai';
    car.ai = Police.patrolAI;
    car.leaving = false;
    car.ramCooldown = 0;
    car.stuckTimer = 0;
    car.reverseTimer = 0;
    car.lastNode = null;
    return car;
  };

  // Where the patrol car should drive now: straight at the target if the way is clear,
  // otherwise the intersection reachable in a straight line that best shortens the trip
  // (greedy route along the street grid).
  Police.patrolTarget = function (car, tx, ty) {
    if (Utils.dist(car.x, car.y, tx, ty) < POL.PATROL_SIGHT && clearLine(car.x, car.y, tx, ty)) {
      return { x: tx, y: ty };
    }
    let best = null;
    let bestCost = Infinity;
    for (const n of NODES) {
      const d = Utils.dist(car.x, car.y, n.x, n.y);
      if (d < POL.PATROL_NODE_REACHED) {
        car.lastNode = n;
        continue;
      }
      if (n === car.lastNode) continue;
      if (!clearLine(car.x, car.y, n.x, n.y)) continue;
      const cost = d + Utils.dist(n.x, n.y, tx, ty);
      if (cost < bestCost) {
        bestCost = cost;
        best = n;
      }
    }
    return best || { x: tx, y: ty };
  };

  // Chase-and-ram AI (car.ai hook). Leaving cars drive away from the player.
  Police.patrolAI = function (car, dt, game) {
    const player = game.player;
    car.ramCooldown = Math.max(0, car.ramCooldown - dt);

    let tx = player.x;
    let ty = player.y;
    if (car.leaving || player.dead) {
      tx = car.x + (car.x - player.x);
      ty = car.y + (car.y - player.y);
    }
    const target = Police.patrolTarget(car, tx, ty);
    const rel = Utils.angleTo(car.x, car.y, target.x, target.y) - car.angle;
    const diff = Math.atan2(Math.sin(rel), Math.cos(rel));

    if (car.reverseTimer > 0) {
      car.reverseTimer -= dt;
      car.controls.throttle = -1;
      car.controls.steer = diff > 0 ? -1 : 1; // back up turning the other way
    } else {
      car.controls.steer = Utils.clamp(diff * 2, -1, 1);
      car.controls.throttle = Math.abs(diff) > 1.2 ? 0.4 : 1;
      car.stuckTimer = Math.abs(car.speed) < 15 ? car.stuckTimer + dt : 0;
      if (car.stuckTimer > POL.PATROL_STUCK_TIME) {
        car.stuckTimer = 0;
        car.reverseTimer = POL.PATROL_REVERSE_TIME;
      }
    }

    if (!car.leaving) Police.ram(car, game);
  };

  // Ramming damage against the player (on foot or in their car), with a cooldown.
  Police.ram = function (car, game) {
    const player = game.player;
    if (player.dead || car.ramCooldown > 0 || Math.abs(car.speed) < POL.RAM_MIN_SPEED) return;
    let hit = false;
    let damage = POL.RAM_DAMAGE_ON_FOOT;
    if (player.inCar) {
      const other = player.inCar;
      hit = car.distanceTo(other.x, other.y) < other.width / 2 + car.height / 2 + 6;
      // takeDamage halves damage inside a car, so compensate to deal exactly RAM_DAMAGE_IN_CAR.
      damage = POL.RAM_DAMAGE_IN_CAR / CONFIG.CAR.PLAYER_DAMAGE_FACTOR;
    } else {
      hit = car.distanceTo(player.x, player.y) < car.height / 2 + player.radius + 4;
    }
    if (!hit) return;
    car.ramCooldown = POL.RAM_COOLDOWN;
    game.damagePlayer(damage);
  };

  Police.clearLine = clearLine;

  root.Police = Police;
  if (typeof module !== 'undefined' && module.exports) module.exports = Police;
})(typeof window !== 'undefined' ? window : globalThis);
