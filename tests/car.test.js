'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const CONFIG = require('../src/config.js');
const CityMap = require('../src/map.js');
const Car = require('../src/entities/car.js');
const Pedestrian = require('../src/entities/pedestrian.js');
const Game = require('../src/game.js');

const SIZE = CONFIG.TILE_SIZE;
const CAR = CONFIG.CAR;
// Eastbound lane of the horizontal road at tiles ty = 8, 9 (long straight stretch).
const LANE_Y = 9.5 * SIZE;

function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

// Input stub: keys held with `down`, one-frame presses with `press`.
function makeInput() {
  let pressed = new Set();
  const down = new Set();
  return {
    down,
    press(code) { pressed.add(code); },
    wasPressed(code) { return pressed.has(code); },
    isDown(code) { return down.has(code); },
    wheel: 0,
    mouse: { x: 0, y: 0, down: false },
    endFrame() { pressed = new Set(); }
  };
}

// Playing game with no traffic/pedestrians (tests add what they need).
function makeGame() {
  const input = makeInput();
  const game = new Game(input, seeded(3));
  game.start();
  game.cars = [];
  game.pedestrians = [];
  game.isOnScreen = () => true; // spawners only use off-screen spots -> no new traffic
  game.spawnPedestrians = () => {};
  return { game, input };
}

// Car with someone at the wheel so its controls apply (parked cars ignore them).
function drivenCar(x, y, angle = 0) {
  const car = new Car(x, y, angle);
  car.driver = 'player';
  return car;
}

function step(game, input, dt = 1 / 60) {
  game.update(dt);
  input.endFrame();
}

test('accelerates, is capped at max speed and stops by friction', () => {
  const car = drivenCar(12 * SIZE, LANE_Y, 0);
  car.controls.throttle = 1;
  car.update(0.25);
  assert.ok(Math.abs(car.speed - CAR.ACCELERATION * 0.25) < 1e-9);
  for (let i = 0; i < 20; i++) car.update(0.05);
  assert.equal(car.speed, CAR.MAX_SPEED);
  car.x = 12 * SIZE;
  car.controls.throttle = 0;
  for (let i = 0; i < 60; i++) car.update(0.05);
  assert.equal(car.speed, 0);
});

test('S brakes and then reverses up to the reverse limit', () => {
  const car = drivenCar(20 * SIZE, LANE_Y, 0);
  car.speed = 100;
  car.controls.throttle = -1;
  car.update(0.05);
  assert.ok(car.speed < 100 && car.speed > 0, 'braking first');
  for (let i = 0; i < 40; i++) car.update(0.05);
  assert.equal(car.speed, -CAR.MAX_REVERSE_SPEED);
});

test('turning needs speed and is proportional to it at low speed', () => {
  const still = drivenCar(12 * SIZE, LANE_Y, 0);
  still.controls.steer = 1;
  still.update(0.1);
  assert.equal(still.angle, 0);

  const slow = drivenCar(12 * SIZE, LANE_Y, 0);
  slow.speed = CAR.TURN_FULL_SPEED / 2;
  slow.controls.throttle = 1; // keep speed roughly constant
  slow.controls.steer = 1;
  slow.update(0.01);
  const fast = drivenCar(12 * SIZE, LANE_Y, 0);
  fast.speed = CAR.TURN_FULL_SPEED;
  fast.controls.throttle = 1;
  fast.controls.steer = 1;
  fast.update(0.01);
  assert.ok(slow.angle > 0 && fast.angle > slow.angle * 1.5);
});

test('does not go through buildings: stops/bounces and emits carCrash', () => {
  const game = { emit(name, d) { (this.events = this.events || []).push([name, d]); } };
  const car = drivenCar(36 * SIZE, LANE_Y, 0); // heading to the east border wall
  car.speed = CAR.MAX_SPEED;
  car.controls.throttle = 1;
  for (let i = 0; i < 120; i++) {
    car.update(1 / 60, game);
    assert.ok(!Car.hitsSolid(car.x, car.y, car.angle));
  }
  assert.ok(car.x < (CONFIG.MAP_COLS - 1) * SIZE);
  assert.ok(game.events.some(([n, d]) => n === 'carCrash' && d.car === car && d.speed > 0));
});

test('overlapping cars are pushed apart', () => {
  const a = new Car(12 * SIZE, LANE_Y, 0);
  const b = new Car(12 * SIZE + 20, LANE_Y, 0);
  const game = { cars: [a, b] };
  for (let i = 0; i < 10; i++) Car.resolveCollisions(game);
  assert.ok(b.x - a.x >= CAR.WIDTH - 1e-6, 'capsules no longer overlap');
  assert.equal(a.y, b.y);
});

test('E enters the nearest car, its AI driver flees, E again exits to a free spot', () => {
  const { game, input } = makeGame();
  const events = [];
  game.on('carEnter', (d) => events.push(['enter', d.car]));
  game.on('carExit', (d) => events.push(['exit', d.car]));
  const near = new Car(12 * SIZE, LANE_Y, 0);
  near.driver = 'ai';
  const far = new Car(12 * SIZE + 200, LANE_Y, 0);
  game.cars.push(near, far);
  game.player.x = 12 * SIZE;
  game.player.y = LANE_Y - CAR.HEIGHT / 2 - 30;

  input.press('KeyE');
  step(game, input);
  assert.equal(game.player.inCar, near);
  assert.equal(near.driver, 'player');
  assert.equal(game.pedestrians.length, 1, 'the driver got out');
  assert.ok(game.pedestrians[0].fleeing);
  assert.deepEqual(events, [['enter', near]]);

  input.press('KeyE');
  step(game, input);
  assert.equal(game.player.inCar, null);
  assert.equal(near.driver, null);
  assert.ok(!CityMap.circleHitsSolid(game.player.x, game.player.y, game.player.radius));
  assert.ok(near.distanceTo(game.player.x, game.player.y) >= game.player.radius);
  assert.deepEqual(events[1], ['exit', near]);
});

test('E does nothing when no car is within ENTER_DISTANCE', () => {
  const { game, input } = makeGame();
  game.cars.push(new Car(12 * SIZE, LANE_Y, 0));
  game.player.x = 12 * SIZE;
  game.player.y = LANE_Y - CAR.HEIGHT / 2 - CAR.ENTER_DISTANCE - 5;
  input.press('KeyE');
  step(game, input);
  assert.equal(game.player.inCar, null);
});

test('driving: W moves the car, player follows it, cannot shoot or pick up', () => {
  const { game, input } = makeGame();
  const car = new Car(12 * SIZE, LANE_Y, 0);
  game.cars.push(car);
  game.player.inventory.owned.PISTOL = true;
  game.player.inventory.ammo.PISTOL = 10;
  game.player.inventory.current = 'PISTOL';
  game.player.x = car.x;
  game.player.y = car.y - 30;
  assert.equal(game.player.enterNearestCar(game), car);
  // A pickup right in the car's path.
  game.pickups = [game.pickups[0]];
  game.pickups[0].x = 12 * SIZE + 60;
  game.pickups[0].y = LANE_Y;
  input.down.add('KeyW');
  input.mouse.down = true;
  for (let i = 0; i < 30; i++) step(game, input, 0.05);
  assert.ok(car.x > 12 * SIZE + 100);
  assert.equal(game.player.x, car.x);
  assert.equal(game.player.y, car.y);
  assert.equal(game.bullets.length, 0);
  assert.equal(game.player.inventory.ammo.PISTOL, 10);
  assert.ok(game.pickups[0].active, 'pickup not collected from the car');
});

function runOverScene(speed) {
  const { game, input } = makeGame();
  const car = new Car(12 * SIZE, LANE_Y, 0);
  game.cars.push(car);
  game.player.x = car.x;
  game.player.y = car.y - 30;
  game.player.enterNearestCar(game);
  const ped = new Pedestrian(car.x + CAR.WIDTH / 2 + 12, LANE_Y, seeded(5));
  ped.update = () => {}; // stands still
  game.pedestrians.push(ped);
  const events = [];
  game.on('runOver', (d) => events.push(d));
  car.speed = speed;
  input.down.add('KeyW');
  if (speed <= CAR.RUN_OVER_SPEED) input.down.clear(); // let it roll slowly
  for (let i = 0; i < 10; i++) {
    if (speed <= CAR.RUN_OVER_SPEED) car.speed = speed; // keep it slow
    step(game, input);
  }
  return { game, ped, events, car };
}

test('running over above RUN_OVER_SPEED kills and scores', () => {
  const { game, ped, events, car } = runOverScene(CAR.RUN_OVER_SPEED + 80);
  assert.ok(ped.dead);
  assert.equal(game.score, CONFIG.SCORE.PEDESTRIAN);
  assert.equal(events.length, 1);
  assert.equal(events[0].target, ped);
  assert.equal(events[0].car, car);
});

test('below RUN_OVER_SPEED the car only pushes people', () => {
  const { ped, events } = runOverScene(CAR.RUN_OVER_SPEED - 40);
  assert.ok(!ped.dead);
  assert.equal(events.length, 0);
});

test('traffic drives on the road without going through buildings or getting stuck', () => {
  const input = makeInput();
  const game = new Game(input, seeded(11));
  game.start();
  assert.equal(game.cars.length, CAR.TRAFFIC_COUNT);
  const start = new Map(game.cars.map((c) => [c, { x: c.x, y: c.y }]));
  for (let i = 0; i < 60 * 30; i++) {
    step(game, input);
    for (const c of game.cars) {
      assert.ok(!Car.hitsSolid(c.x, c.y, c.angle), 'car inside a building');
      assert.ok(CityMap.isRoad(c.x, c.y), 'car left the road');
    }
  }
  const moved = [...start].filter(([c, p]) => game.cars.includes(c) && Math.hypot(c.x - p.x, c.y - p.y) > 200);
  assert.ok(moved.length >= CAR.TRAFFIC_COUNT / 2, 'most traffic cars keep moving');
  assert.ok(game.pedestrians.every((p) => !p.dead), 'traffic does not kill');
});

test('a custom ai hook replaces the traffic AI', () => {
  const car = new Car(12 * SIZE, LANE_Y, 0);
  car.driver = 'ai';
  car.ai = (c) => { c.controls.throttle = -1; c.controls.steer = 0; };
  car.update(0.1, { cars: [car] });
  assert.ok(car.speed < 0);
  assert.equal(car.route, null);
});
