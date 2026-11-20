---
doc: design
title: Design — Car damage and explosions
task_id: MCC-001
feature_slug: car-damage-explosions
status: spec_ready
---

## Summary

`Car` gains health and a three-phase life (intact → burning → wreck) ticked in `Car.update`; all damage and the explosion go through two new `Game` methods so score, wanted and attribution (REQ-013 – REQ-016) stay in `game.js` like `damagePedestrian`/`damagePolice`. Bullets test car bodies before people (REQ-002, REQ-003), and `Car.crash` feeds crash damage (REQ-004). Visuals, sound and HUD react to two new events, `carBurning` and `carExploded`, plus a per-frame smoke/fire pass.

## Files to change

| File | Change | Reason |
| --- | --- | --- |
| `src/entities/car.js` | Health/burn/wreck state; burn and wreck timers in `update`; wreck skips physics and is not pushed in `resolveCollisions`; `crash(impact, game, other)` calls `game.damageCar`; `updateAll` cleanup skips burning cars; charred wreck in `draw` | REQ-001, REQ-004 – REQ-008, REQ-011, EDGE-004 |
| `src/entities/bullet.js` | Per substep, test `game.cars \|\| []` bodies (`distanceTo === 0`) before targets | REQ-002, REQ-003, EDGE-008 |
| `src/game.js` | `damageCar`, `explodeCar`, smoke/fire pass in `update`, effect listeners | REQ-006, REQ-007, REQ-009, REQ-010, REQ-013 – REQ-016 |
| `src/entities/player.js` | `enterNearestCar` skips burning/wreck; new `forceExit(game)` | REQ-010, REQ-012 |
| `src/effects.js` | `smoke`, `fire`, `explosion` helpers on top of `burst`/`cap` | REQ-005, REQ-018, NFR-001 |
| `src/audio.js` | `carBurning`, `carExploded` in `SOUNDS` and `EVENT_SOUNDS` | REQ-018 |
| `src/hud.js` | Car health bar in the player panel while `p.inCar` | REQ-017 |
| `src/config.js` (protected) | New keys only, see § Interfaces and data; approving this spec approves them | A1 |
| `tests/car-damage.test.js` | New file | all REQ |
| Do not change | `index.html`, existing `tests/*`, `Player.takeDamage`, `Police.ram`, `src/wanted.js`, `src/weapons.js` | AGENTS.md protected areas, A9 |

## Interfaces and data

```text
CONFIG.CAR   += HEALTH, SMOKE_HEALTH, BURN_TIME, EXPLOSION_RADIUS, EXPLOSION_DAMAGE, CRASH_DAMAGE_FACTOR, WRECK_TIME
CONFIG.SCORE += CAR, PATROL_CAR
CONFIG.EFFECTS += smoke/fire/explosion particle counts, speeds, colors (values: implementer's choice)

Car fields: health, burnTimer (0 = not burning), wreck (bool), wreckTimer,
            byPlayer (bool: last damage source was the player, REQ-016), noReward (bool, EDGE-003)
Car.isBurning() → bool          Car.crash(impact, game, other = null)
Game.damageCar(car, amount, attacker)   // no-op on wrecks; burning cars keep their timer;
                                        // at 0: burnTimer = BURN_TIME, noReward if player drives,
                                        // ejectDriver + driver = null for civilian AI, emit carBurning
Game.explodeCar(car)            // attacker = byPlayer && !noReward ? player : car;
                                // damageTarget for peds/cops, forceExit + damagePlayer for the player,
                                // damageCar for other cars; score/wanted; scareAt; wreck; emit carExploded
Player.forceExit(game)          // freeSpotBeside or car centre; inCar = null
Events: carBurning {car}, carExploded {car, x, y, byPlayer}; bulletImpact gains optional {car}
```

## External dependencies and freshness

None.

## Security and permissions

None.

## Test design

New `tests/car-damage.test.js` (`node:test`, game stubs modelled on `tests/car.test.js` and `tests/patrol.test.js`), one test group per AC-001 – AC-011, using a real `Game` where score/wanted are asserted. AC-012 is a manual check per the `run-and-verify` skill. NFR-001: `node --test tests/` stays green with existing files untouched.

UI verification plan: `python3 -m http.server 8000`, shoot a parked car, crash a stolen car into walls until it burns, exit in time and stay inside once, chain two cars, blow up a patrol car at ★2.

## Documentation targets

`docs/car.md`, `docs/game.md` (events, new methods), `docs/weapons.md` (bullets vs cars), `docs/player.md`, `docs/audio.md` (sounds and effects), `docs/hud.md`, `docs/config.md`, `docs/README.md` (car row), `README.md` (protected: remove "Los coches no se rompen", add car scoring).

## Risks and rollback

- Not a high-risk category (no auth, data, infra or public API); normal review applies.
- Cars as cover make a driving player nearly immune to police bullets until the car burns — a balance shift accepted in Q2 (decision candidate).
- Chain explosions in dense traffic could spike particles and deaths; mitigated by `Effects.cap` and the falloff.
- Routing car damage through `Game` rather than `Car` keeps score/wanted in one place (decision candidate; rejected: `Car.takeDamage` emitting events for `Game` to score).
- Rollback: revert the feature commit; no data or save-format changes (highscore key untouched).
