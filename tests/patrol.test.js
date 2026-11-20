'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const CONFIG = require('../src/config.js');
const CityMap = require('../src/map.js');
const Car = require('../src/entities/car.js');
const Police = require('../src/entities/police.js');
const Game = require('../src/game.js');

const SIZE = CONFIG.TILE_SIZE;
const POL = CONFIG.POLICE;

function seeded(seed) {
  return () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
}

function makeInput() {
  return {
    down: new Set(),
    isDown(c) { return this.down.has(c); },
    wasPressed: () => false,
    wheel: 0,
    mouse: { x: 0, y: 0, down: false }
  };
}

function playingGame(seed = 1) {
  const game = new Game(makeInput(), seeded(seed));
  game.start();
  game.pedestrians = []; // keep the scene simple
  game.spawnPedestrians = () => {};
  return game;
}

test('number of patrol cars follows WANTED.PATROL_CARS and extra ones leave', () => {
  const game = playingGame(2);
  game.police = [];
  game.spawnPolice = () => {};
  for (const stars of [0, 1, 2, 3]) {
    game.wanted.setStars(stars);
    for (let i = 0; i < 40; i++) game.spawnPatrolCars();
    assert.equal(game.patrolCars().length, CONFIG.WANTED.PATROL_CARS[stars], `stars ${stars}`);
  }
  for (const c of game.patrolCars()) {
    assert.equal(CityMap.getTile(CityMap.worldToTile(c.x), CityMap.worldToTile(c.y)), CONFIG.TILE.ROAD);
    assert.ok(!game.isOnScreen(c.x, c.y));
  }
  game.wanted.setStars(0);
  game.spawnPatrolCars();
  assert.equal(game.patrolCars().length, 0);
  assert.ok(game.cars.filter((c) => c.isPolice).every((c) => c.leaving));
});

test('a patrol car drives through the street grid to the player and rams them', () => {
  for (const seed of [3, 4, 5]) {
    const game = playingGame(seed);
    game.police = [];
    game.spawnPolice = () => {};
    game.wanted.setStars(2); // 1 patrol car
    let hurt = 0;
    game.on('playerHurt', (d) => { hurt += d.amount; });
    let rammedAt = -1;
    for (let i = 0; i < 1200 && rammedAt < 0; i++) {
      game.update(0.05);
      for (const c of game.cars) {
        assert.ok(!Car.hitsSolid(c.x, c.y, c.angle), 'cars never overlap buildings');
      }
      if (hurt > 0) rammedAt = i * 0.05;
    }
    assert.ok(rammedAt >= 0, `seed ${seed}: patrol car reached the player within 60 s`);
    assert.equal(hurt, POL.RAM_DAMAGE_ON_FOOT);
  }
});

test('ramming: 25 on foot, 10 in a car, with a cooldown', () => {
  const game = playingGame(6);
  const p = game.player;
  const car = Police.createPatrolCar(p.x - 40, p.y, 0);
  car.speed = 100;
  Police.ram(car, game);
  assert.equal(p.health, 100 - POL.RAM_DAMAGE_ON_FOOT);
  Police.ram(car, game);
  assert.equal(p.health, 100 - POL.RAM_DAMAGE_ON_FOOT, 'cooldown');

  const game2 = playingGame(7);
  const p2 = game2.player;
  const mine = new Car(p2.x, p2.y, 0);
  game2.cars.push(mine);
  p2.inCar = mine;
  mine.driver = 'player';
  const cop = Police.createPatrolCar(mine.x - 50, mine.y, 0);
  cop.speed = 100;
  Police.ram(cop, game2);
  assert.equal(p2.health, 100 - POL.RAM_DAMAGE_IN_CAR);

  const slow = Police.createPatrolCar(p.x - 40, p.y, 0);
  slow.speed = 10;
  const before = p.health;
  Police.ram(slow, game);
  assert.equal(p.health, before, 'too slow to hurt');
});

test('patrol cars count as seeing the player', () => {
  const game = playingGame(8);
  game.police = [];
  assert.equal(game.isPlayerSeen(), false);
  const p = game.player;
  game.cars.push(Police.createPatrolCar(p.x + 200, p.y, 0));
  assert.equal(game.isPlayerSeen(), true);
});
