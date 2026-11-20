(function (root) {
  'use strict';

  const CONFIG = root.CONFIG || (typeof require !== 'undefined' ? require('../config.js') : null);
  const Utils = root.Utils || (typeof require !== 'undefined' ? require('../utils.js') : null);
  const CityMap = root.CityMap || (typeof require !== 'undefined' ? require('../map.js') : null);

  const CAR = CONFIG.CAR;
  const SIZE = CONFIG.TILE_SIZE;
  const PERIOD = CONFIG.MAP.BLOCK_PERIOD;
  // Intersections used by traffic: road pairs at tiles PERIOD*k, PERIOD*k+1 (k = 1..4).
  const NODE_MIN = 1;
  const NODE_MAX = Math.floor((CONFIG.MAP_COLS - 1) / PERIOD);
  const DIRS = {
    E: { dx: 1, dy: 0 },
    W: { dx: -1, dy: 0 },
    S: { dx: 0, dy: 1 },
    N: { dx: 0, dy: -1 }
  };
  const OPPOSITE = { E: 'W', W: 'E', N: 'S', S: 'N' };

  function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  // Lazy lookup: pedestrian.js is loaded after car.js in tests that only need cars.
  function getPedestrianClass() {
    return root.Pedestrian || (typeof require !== 'undefined' ? require('./pedestrian.js') : null);
  }

  // Car: rotated rectangle with simple arcade physics. Driven by `controls`
  // ({throttle, steer} in -1..1), which are filled by the player, the traffic AI
  // or a custom `ai(car, dt, game)` hook (police cars in F6).
  // Life cycle (MCC-001): intact -> burning (health 0, BURN_TIME s) -> wreck (WRECK_TIME s).
  // Damage, explosions and their score/wanted effects go through Game.damageCar/explodeCar.
  // For collisions the body is approximated by a capsule (3 circles along its length).
  class Car {
    constructor(x, y, angle = 0, color = CAR.COLORS[0]) {
      this.x = x;
      this.y = y;
      this.angle = angle; // radians, 0 = facing +x
      this.speed = 0; // px/s along the facing direction (negative = reverse)
      this.width = CAR.WIDTH; // length along the facing direction
      this.height = CAR.HEIGHT;
      this.color = color;
      this.driver = null; // 'ai' | 'player' | null (parked)
      this.isPolice = false;
      this.controls = { throttle: 0, steer: 0 };
      this.ai = undefined; // optional (car, dt, game) => void; replaces the traffic AI
      this.route = null; // traffic AI state {i, j, dir, next}
      this.crashCooldown = 0;
      this.stuckTimer = 0;
      this.reverseTimer = 0;
      this.blockedTimer = 0;
      this.idleTime = 0; // seconds (almost) stopped while driven by the traffic AI
      this.remove = false; // the game drops it from game.cars when true
      this.health = CAR.HEALTH;
      this.burnTimer = 0; // > 0: burning, explodes when it reaches 0
      this.wreck = false; // burnt-out, immobile, driverless
      this.wreckTimer = 0; // seconds until a wreck is removed
      this.byPlayer = false; // last damage came from the player (score/wanted attribution)
      this.noReward = false; // caught fire while the player drove it: never rewards
    }

    isBurning() {
      return this.burnTimer > 0 && !this.wreck;
    }

    get radius() {
      return this.height / 2;
    }

    // Centres of the capsule circles for a given pose (back, middle, front).
    static circles(x, y, angle) {
      const off = CAR.WIDTH / 2 - CAR.HEIGHT / 2;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      return [
        { x: x - c * off, y: y - s * off },
        { x, y },
        { x: x + c * off, y: y + s * off }
      ];
    }

    static hitsSolid(x, y, angle) {
      const r = CAR.HEIGHT / 2;
      return Car.circles(x, y, angle).some((p) => CityMap.circleHitsSolid(p.x, p.y, r));
    }

    // Distance from (px, py) to the car body (rotated rectangle); 0 if inside.
    distanceTo(px, py) {
      const c = Math.cos(-this.angle);
      const s = Math.sin(-this.angle);
      const lx = (px - this.x) * c - (py - this.y) * s;
      const ly = (px - this.x) * s + (py - this.y) * c;
      const dx = Math.max(Math.abs(lx) - this.width / 2, 0);
      const dy = Math.max(Math.abs(ly) - this.height / 2, 0);
      return Math.hypot(dx, dy);
    }

    // Closest point of the capsule's centre segment to (px, py).
    closestAxisPoint(px, py) {
      const off = this.width / 2 - this.height / 2;
      const c = Math.cos(this.angle);
      const s = Math.sin(this.angle);
      const t = Utils.clamp((px - this.x) * c + (py - this.y) * s, -off, off);
      return { x: this.x + c * t, y: this.y + s * t };
    }

    update(dt, game) {
      if (this.wreck) {
        this.speed = 0;
        this.wreckTimer -= dt;
        if (this.wreckTimer <= 0) this.remove = true;
        return;
      }
      if (this.burnTimer > 0) {
        this.burnTimer = Math.max(0, this.burnTimer - dt);
        if (this.burnTimer === 0 && game && game.explodeCar) {
          game.explodeCar(this);
          return;
        }
      }
      this.crashCooldown = Math.max(0, this.crashCooldown - dt);
      if (this.driver === 'ai') {
        if (this.ai) this.ai(this, dt, game);
        else Car.trafficAI(this, dt, game);
      } else if (this.driver === null) {
        this.controls.throttle = 0;
        this.controls.steer = 0;
      }
      this.applyPhysics(dt, game);

      if (this.driver === 'player' && game && game.player && game.player.inCar === this) {
        // Keep the player glued to the car (police aims at player.x/y).
        game.player.x = this.x;
        game.player.y = this.y;
        game.player.angle = this.angle;
        this.runOver(game);
      }
    }

    applyPhysics(dt, game) {
      const throttle = Utils.clamp(this.controls.throttle || 0, -1, 1);
      const steer = Utils.clamp(this.controls.steer || 0, -1, 1);

      // Speed: accelerate, brake (pressing against the motion) or roll with friction.
      if (throttle !== 0 && Math.sign(throttle) !== Math.sign(this.speed) && this.speed !== 0) {
        const brake = CAR.BRAKE * Math.abs(throttle) * dt;
        this.speed = Math.abs(this.speed) <= brake ? 0 : this.speed - Math.sign(this.speed) * brake;
      } else if (throttle !== 0) {
        this.speed += CAR.ACCELERATION * throttle * dt;
      } else {
        const f = CAR.FRICTION * dt;
        this.speed = Math.abs(this.speed) <= f ? 0 : this.speed - Math.sign(this.speed) * f;
      }
      this.speed = Utils.clamp(this.speed, -CAR.MAX_REVERSE_SPEED, CAR.MAX_SPEED);

      // Turning is proportional to speed (up to TURN_FULL_SPEED); reversing inverts it.
      const turnFactor = Utils.clamp(this.speed / CAR.TURN_FULL_SPEED, -1, 1);
      const newAngle = this.angle + steer * CAR.TURN_RATE * turnFactor * dt;
      if (!Car.hitsSolid(this.x, this.y, newAngle)) this.angle = newAngle;

      this.move(this.speed * dt, game);
    }

    // Moves `dist` px along the facing direction in small sub-steps. Slides along
    // walls (each axis separately); a head-on hit bounces back.
    move(dist, game) {
      if (dist === 0) return;
      const vx = Math.cos(this.angle) * dist;
      const vy = Math.sin(this.angle) * dist;
      const steps = Math.max(1, Math.ceil(Math.abs(dist) / 4));
      const sx = vx / steps;
      const sy = vy / steps;
      let x = this.x;
      let y = this.y;
      let hit = false;
      for (let i = 0; i < steps; i++) {
        if (!Car.hitsSolid(x + sx, y + sy, this.angle)) {
          x += sx;
          y += sy;
          continue;
        }
        hit = true;
        if (!Car.hitsSolid(x + sx, y, this.angle)) x += sx;
        else if (!Car.hitsSolid(x, y + sy, this.angle)) y += sy;
      }
      const moved = Math.hypot(x - this.x, y - this.y);
      this.x = x;
      this.y = y;
      if (!hit) return;

      const before = Math.abs(this.speed);
      const ratio = moved / Math.abs(dist);
      if (ratio < 0.1) this.speed = -this.speed * CAR.BOUNCE; // blocked: bounce
      else this.speed *= ratio; // scraping: lose the blocked part
      this.crash(before - Math.abs(this.speed), game);
    }

    // Emits carCrash when an impact loses enough speed (with a short cooldown) and
    // loses impact * CRASH_DAMAGE_FACTOR health. `other` is the car hit (null = wall);
    // the damage is the player's if the player drove either car. Wrecks ignore crashes.
    crash(impact, game, other = null) {
      if (this.wreck || impact < CAR.CRASH_SPEED || this.crashCooldown > 0) return;
      this.crashCooldown = CAR.CRASH_COOLDOWN;
      if (game && game.emit) game.emit('carCrash', { car: this, speed: impact });
      if (game && game.damageCar) {
        const byPlayer = this.driver === 'player' || (other && other.driver === 'player');
        game.damageCar(this, impact * CAR.CRASH_DAMAGE_FACTOR, byPlayer ? game.player : other);
      }
    }

    // Player's car above RUN_OVER_SPEED kills every target it touches.
    runOver(game) {
      if (Math.abs(this.speed) <= CAR.RUN_OVER_SPEED || !game.getTargets) return;
      for (const t of game.getTargets()) {
        if (t === game.player || t.dead) continue;
        const r = t.radius || 0;
        if (this.distanceTo(t.x, t.y) >= r) continue;
        game.damageTarget(t, 9999, this.x, this.y, game.player);
        if (game.emit) game.emit('runOver', { target: t, car: this });
      }
    }

    // Pushes a circle-shaped person ({x, y, radius}) out of the car body. Returns true if it touched.
    pushOut(person) {
      const a = this.closestAxisPoint(person.x, person.y);
      const minDist = this.height / 2 + person.radius;
      let dx = person.x - a.x;
      let dy = person.y - a.y;
      let d = Math.hypot(dx, dy);
      if (d >= minDist) return false;
      if (d < 1e-6) {
        dx = -Math.sin(this.angle); // push sideways
        dy = Math.cos(this.angle);
        d = 1;
      }
      const push = minDist - d;
      const moved = CityMap.moveCircle(person.x, person.y, person.radius, dx / d * push, dy / d * push);
      person.x = moved.x;
      person.y = moved.y;
      return true;
    }

    // Puts the AI driver on foot next to the car, running away (when the player steals it).
    ejectDriver(game) {
      const Pedestrian = getPedestrianClass();
      if (!Pedestrian || !game.pedestrians) return null;
      const spot = this.freeSpotBeside(CONFIG.PEDESTRIAN.RADIUS, game);
      if (!spot) return null;
      const ped = new Pedestrian(spot.x, spot.y, game.rng || Math.random);
      ped.scare(this.x, this.y);
      game.pedestrians.push(ped);
      return ped;
    }

    // Free position for a circle of radius r next to the car: left, right, front, back.
    freeSpotBeside(r, game) {
      const c = Math.cos(this.angle);
      const s = Math.sin(this.angle);
      const side = this.height / 2 + r + 4;
      const end = this.width / 2 + r + 4;
      const options = [
        { x: this.x + s * side, y: this.y - c * side },
        { x: this.x - s * side, y: this.y + c * side },
        { x: this.x + c * end, y: this.y + s * end },
        { x: this.x - c * end, y: this.y - s * end }
      ];
      const cars = (game && game.cars) || [];
      return options.find((p) => !CityMap.circleHitsSolid(p.x, p.y, r) &&
        !cars.some((o) => o.distanceTo(p.x, p.y) < r)) || null;
    }

    // ---------------- Traffic AI ----------------

    static laneX(i, dir) {
      return (PERIOD * i + (dir === 'S' ? 0.5 : 1.5)) * SIZE;
    }

    static laneY(j, dir) {
      return (PERIOD * j + (dir === 'W' ? 0.5 : 1.5)) * SIZE;
    }

    static nodeCenter(i, j) {
      return { x: (PERIOD * i + 1) * SIZE, y: (PERIOD * j + 1) * SIZE };
    }

    static validNode(i, j) {
      return i >= NODE_MIN && i <= NODE_MAX && j >= NODE_MIN && j <= NODE_MAX;
    }

    // Point inside intersection (i, j) where a car coming in `dir` and leaving in `next` aims.
    static waypoint(i, j, dir, next) {
      const p = Car.nodeCenter(i, j);
      if (dir === 'N' || dir === 'S') p.x = Car.laneX(i, dir);
      else p.y = Car.laneY(j, dir);
      if (next === 'N' || next === 'S') p.x = Car.laneX(i, next);
      else p.y = Car.laneY(j, next);
      return p;
    }

    // Random exit from intersection (i, j) arriving in `dir`: no U-turns, stays in the grid.
    static chooseExit(i, j, dir, rng = Math.random) {
      const options = Object.keys(DIRS).filter((d) => d !== OPPOSITE[dir] &&
        Car.validNode(i + DIRS[d].dx, j + DIRS[d].dy));
      if (options.length === 0) return OPPOSITE[dir];
      return options[Math.floor(rng() * options.length)];
    }

    // Starts a route from the current pose: cardinal direction from the angle and
    // the next intersection ahead (or the nearest one if there is none ahead).
    initRoute(rng = Math.random) {
      const c = Math.cos(this.angle);
      const s = Math.sin(this.angle);
      let dir;
      if (Math.abs(c) >= Math.abs(s)) dir = c >= 0 ? 'E' : 'W';
      else dir = s >= 0 ? 'S' : 'N';
      const d = DIRS[dir];
      const clampNode = (v) => Utils.clamp(v, NODE_MIN, NODE_MAX);
      const near = (v) => clampNode(Math.round((v / SIZE - 1) / PERIOD));
      let i = near(this.x);
      let j = near(this.y);
      if (d.dx !== 0) {
        const ahead = (this.x / SIZE - 1) / PERIOD;
        i = clampNode(d.dx > 0 ? Math.floor(ahead) + 1 : Math.ceil(ahead) - 1);
      } else {
        const ahead = (this.y / SIZE - 1) / PERIOD;
        j = clampNode(d.dy > 0 ? Math.floor(ahead) + 1 : Math.ceil(ahead) - 1);
      }
      this.route = { i, j, dir, next: Car.chooseExit(i, j, dir, rng) };
    }

    // True if something is right in front of the car (other car or person).
    static obstacleAhead(car, game) {
      const c = Math.cos(car.angle);
      const s = Math.sin(car.angle);
      const check = (x, y, reach, halfWidth) => {
        const rx = x - car.x;
        const ry = y - car.y;
        const along = rx * c + ry * s;
        const lateral = Math.abs(-rx * s + ry * c);
        return along > 0 && along < reach && lateral < halfWidth;
      };
      for (const o of game.cars || []) {
        if (o !== car && check(o.x, o.y, CAR.WIDTH + CAR.TRAFFIC_GAP, CAR.HEIGHT + 2)) return true;
      }
      const people = [];
      if (game.player && !game.player.inCar) people.push(game.player);
      if (game.getTargets) {
        for (const t of game.getTargets()) if (!t.dead && t !== game.player) people.push(t);
      }
      for (const p of people) {
        if (check(p.x, p.y, CAR.WIDTH / 2 + CAR.TRAFFIC_GAP + p.radius, CAR.HEIGHT / 2 + p.radius + 4)) return true;
      }
      return false;
    }

    // Default AI for traffic: follows the right-hand lane from intersection to
    // intersection, turning at random, slowing down for turns and stopping for obstacles.
    static trafficAI(car, dt, game) {
      const rng = (game && game.rng) || Math.random;
      car.idleTime = Math.abs(car.speed) < 5 ? car.idleTime + dt : 0;
      if (!car.route) car.initRoute(rng);
      let r = car.route;
      let wp = Car.waypoint(r.i, r.j, r.dir, r.next);
      const turning = r.next !== r.dir;
      const d = DIRS[r.dir];
      const along = (wp.x - car.x) * d.dx + (wp.y - car.y) * d.dy;
      if (along < (turning ? CAR.TURN_START : CAR.WAYPOINT_REACHED)) {
        const ni = r.i + DIRS[r.next].dx;
        const nj = r.j + DIRS[r.next].dy;
        car.route = r = { i: ni, j: nj, dir: r.next, next: Car.chooseExit(ni, nj, r.next, rng) };
        wp = Car.waypoint(r.i, r.j, r.dir, r.next);
      }

      const diff = wrapAngle(Utils.angleTo(car.x, car.y, wp.x, wp.y) - car.angle);
      let steer = Utils.clamp(diff * 3, -1, 1);
      const dist = Utils.dist(car.x, car.y, wp.x, wp.y);
      let target = CAR.TRAFFIC_SPEED;
      if ((r.next !== r.dir && dist < CAR.TURN_SLOWDOWN_DIST) || Math.abs(diff) > 0.4) target = CAR.TRAFFIC_TURN_SPEED;

      // Stop for obstacles, but give up waiting after MAX_WAIT s (avoids deadlocks;
      // pushing then moves people/cars out of the way).
      const blocked = Car.obstacleAhead(car, game);
      car.blockedTimer = blocked ? car.blockedTimer + dt : 0;
      if (blocked && car.blockedTimer < CAR.MAX_WAIT) target = 0;

      // Stuck against a wall: reverse for a moment.
      if (car.reverseTimer > 0) {
        car.reverseTimer -= dt;
        car.controls.throttle = -1;
        car.controls.steer = -steer;
        return;
      }
      if (target > 0 && Math.abs(car.speed) < 5) {
        car.stuckTimer += dt;
        if (car.stuckTimer > CAR.STUCK_TIME) {
          car.stuckTimer = 0;
          car.reverseTimer = CAR.REVERSE_TIME;
        }
      } else {
        car.stuckTimer = 0;
      }

      car.controls.throttle = Utils.clamp((target - car.speed) / 40, -1, 1);
      car.controls.steer = steer;
    }

    // Random traffic car on a lane between two intersections, or null.
    static randomTrafficCar(rng = Math.random) {
      const dirs = Object.keys(DIRS);
      const dir = dirs[Math.floor(rng() * dirs.length)];
      const span = NODE_MAX - NODE_MIN + 1;
      const i = NODE_MIN + Math.floor(rng() * span);
      const j = NODE_MIN + Math.floor(rng() * span);
      const d = DIRS[dir];
      const pi = i - d.dx;
      const pj = j - d.dy;
      if (!Car.validNode(pi, pj)) return null;
      const a = Car.nodeCenter(pi, pj);
      const b = Car.nodeCenter(i, j);
      const x = d.dx !== 0 ? (a.x + b.x) / 2 : Car.laneX(i, dir);
      const y = d.dy !== 0 ? (a.y + b.y) / 2 : Car.laneY(j, dir);
      const angle = Math.atan2(d.dy, d.dx);
      const car = new Car(x, y, angle, CAR.COLORS[Math.floor(rng() * CAR.COLORS.length)]);
      car.driver = 'ai';
      car.speed = CAR.TRAFFIC_SPEED * 0.5;
      car.route = { i, j, dir, next: Car.chooseExit(i, j, dir, rng) };
      return car;
    }

    static isTraffic(car) {
      return car.driver === 'ai' && !car.ai && !car.isPolice;
    }

    // Keeps TRAFFIC_COUNT traffic cars, spawning them out of view and away from other cars.
    static spawnTraffic(game) {
      const rng = game.rng || Math.random;
      let count = game.cars.filter(Car.isTraffic).length;
      let attempts = 30;
      while (count < CAR.TRAFFIC_COUNT && attempts-- > 0) {
        const car = Car.randomTrafficCar(rng);
        if (!car) continue;
        if (game.isOnScreen && game.isOnScreen(car.x, car.y, CAR.WIDTH)) continue;
        if (game.cars.some((o) => Utils.dist(o.x, o.y, car.x, car.y) < CAR.WIDTH * 2)) continue;
        game.cars.push(car);
        count++;
      }
    }

    // Separates overlapping cars (capsules) and slows them down on impact.
    static resolveCollisions(game) {
      const cars = game.cars;
      const r = CAR.HEIGHT / 2;
      for (let a = 0; a < cars.length; a++) {
        for (let b = a + 1; b < cars.length; b++) {
          const A = cars[a];
          const B = cars[b];
          if (A.wreck && B.wreck) continue;
          if (Math.abs(A.x - B.x) > CAR.WIDTH || Math.abs(A.y - B.y) > CAR.WIDTH) continue;
          // Deepest overlapping pair of capsule circles.
          let best = null;
          for (const p of Car.circles(A.x, A.y, A.angle)) {
            for (const q of Car.circles(B.x, B.y, B.angle)) {
              const d = Utils.dist(p.x, p.y, q.x, q.y);
              const overlap = 2 * r - d;
              if (overlap > 0 && (!best || overlap > best.overlap)) best = { p, q, d, overlap };
            }
          }
          if (!best) continue;
          let nx = 1;
          let ny = 0;
          if (best.d > 1e-6) {
            nx = (best.q.x - best.p.x) / best.d;
            ny = (best.q.y - best.p.y) / best.d;
          }
          // Always push B away from A's centre (crossed circle pairs would point backwards).
          if (nx * (B.x - A.x) + ny * (B.y - A.y) < 0) {
            nx = -nx;
            ny = -ny;
          }
          // Wrecks are never pushed: the other car takes the whole separation.
          const half = best.overlap / 2 + 0.01;
          const pushA = A.wreck ? 0 : B.wreck ? half * 2 : half;
          const pushB = B.wreck ? 0 : A.wreck ? half * 2 : half;
          if (pushA > 0 && !Car.hitsSolid(A.x - nx * pushA, A.y - ny * pushA, A.angle)) {
            A.x -= nx * pushA;
            A.y -= ny * pushA;
          }
          if (pushB > 0 && !Car.hitsSolid(B.x + nx * pushB, B.y + ny * pushB, B.angle)) {
            B.x += nx * pushB;
            B.y += ny * pushB;
          }
          const vax = Math.cos(A.angle) * A.speed;
          const vay = Math.sin(A.angle) * A.speed;
          const vbx = Math.cos(B.angle) * B.speed;
          const vby = Math.sin(B.angle) * B.speed;
          const impact = Math.hypot(vax - vbx, vay - vby);
          A.speed *= CAR.CAR_HIT_DAMPING;
          B.speed *= CAR.CAR_HIT_DAMPING;
          A.crash(impact, game, B);
          B.crash(impact, game, A);
        }
      }
    }

    // One call per frame from Game.update: AI/physics, car-car collisions,
    // pushing people out of cars, traffic upkeep and removing abandoned cars off screen.
    static updateAll(dt, game) {
      for (const c of game.cars) c.update(dt, game);
      Car.resolveCollisions(game);
      // getTargets() includes the player (F6); handle the player separately (only on foot).
      const people = game.getTargets().filter((t) => !t.dead && t !== game.player);
      if (!game.player.inCar) people.push(game.player);
      for (const c of game.cars) {
        for (const p of people) c.pushOut(p);
      }
      for (const c of game.cars) {
        const offScreen = !game.isOnScreen(c.x, c.y, CAR.WIDTH * 2);
        // Parked/abandoned (also stolen patrol cars and wrecks); burning cars explode first.
        if (offScreen && c.driver === null && !c.isBurning()) c.remove = true;
        if (offScreen && Car.isTraffic(c) && c.idleTime > CAR.STUCK_REMOVE_TIME) c.remove = true;
      }
      game.cars = game.cars.filter((c) => !c.remove);
      Car.spawnTraffic(game);
    }

    draw(ctx, camera) {
      const p = camera.worldToScreen(this.x, this.y);
      const w = this.width;
      const h = this.height;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(this.angle);
      // Shadow.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(-w / 2 + 3, -h / 2 + 3, w, h);
      if (this.wreck) {
        // Charred shell: dark body, empty window frames, no lights.
        ctx.fillStyle = '#2a2622';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = '#141210';
        ctx.fillRect(w * 0.12, -h / 2 + 3, w * 0.16, h - 6);
        ctx.fillRect(-w * 0.36, -h / 2 + 4, w * 0.1, h - 8);
        ctx.fillStyle = '#4a3a30';
        ctx.fillRect(-w * 0.15, -h / 2 + 4, w * 0.2, h - 8);
        ctx.restore();
        return;
      }
      // Body.
      ctx.fillStyle = this.isPolice ? '#f4f4f4' : this.color;
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      if (this.isPolice) {
        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(-w / 2, -h / 2, w * 0.25, h);
        ctx.fillRect(w / 4, -h / 2, w * 0.25, h);
      }
      // Windshield (front) and rear window.
      ctx.fillStyle = '#9fd4ff';
      ctx.fillRect(w * 0.12, -h / 2 + 3, w * 0.16, h - 6);
      ctx.fillStyle = '#6a9ac0';
      ctx.fillRect(-w * 0.36, -h / 2 + 4, w * 0.1, h - 8);
      // Headlights.
      ctx.fillStyle = '#fff6b0';
      ctx.fillRect(w / 2 - 3, -h / 2 + 2, 3, 5);
      ctx.fillRect(w / 2 - 3, h / 2 - 7, 3, 5);
      if (this.isPolice) {
        ctx.fillStyle = '#e22';
        ctx.fillRect(-4, -h / 2 + 2, 6, h / 2 - 2);
        ctx.fillStyle = '#26f';
        ctx.fillRect(-4, 0, 6, h / 2 - 2);
      }
      ctx.restore();
    }
  }

  root.Car = Car;
  if (typeof module !== 'undefined' && module.exports) module.exports = Car;
})(typeof window !== 'undefined' ? window : globalThis);
