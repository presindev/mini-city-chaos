---
doc: review
title: Review — Car damage and explosions
task_id: MCC-001
feature_slug: car-damage-explosions
reviewer: reviewer
review_status: approved
documentation_status: updated
---

## Decision

Decision: [!ok approved] — Final re-check 2026-11-20: implementation matches `design.md` and REQ-001 – REQ-018, 110/110 tests pass, NBK-1 – NBK-3 resolved, AC-012 passed (developer), documentation updated. No open findings; ready for `done`.

## Traceability

| Requirement | Implemented? | Tested? | Evidence |
| --- | --- | --- | --- |
| REQ-001 | !ok Yes | !ok Yes | `car.js` constructor; AC-001 test |
| REQ-002 | !ok Yes | !ok Yes | `bullet.js` car loop before targets; AC-002 test |
| REQ-003 | !ok Yes | !ok Yes | same loop (player is never a car body); AC-003 test |
| REQ-004 | !ok Yes | !ok Yes | `Car.crash(impact, game, other)`; AC-004 test |
| REQ-005 | !ok Yes | !ok Manual AC-012 (developer, passed) | `Game.emitCarSmoke`; wrecks smoke too (health 0) |
| REQ-006 | !ok Yes | !ok Yes | `Game.damageCar`, `Car.update` burn timer; AC-002, AC-005 tests |
| REQ-007 | !ok Yes | !ok Yes | `damageCar` ejects civilian AI driver; AC-006 test |
| REQ-008 | !ok Yes | !ok Yes | patrol `driver` stays `'ai'`; AC-006 test |
| REQ-009 | !ok Yes | !ok Yes | `Game.explodeCar` falloff loops; AC-007 test |
| REQ-010 | !ok Yes | !ok Yes | `Player.forceExit` then unhalved `damagePlayer`; AC-008 test |
| REQ-011 | !ok Yes | !ok Yes | wreck branch in `Car.update`, `resolveCollisions`, cleanup; AC-009 test |
| REQ-012 | !ok Yes | !ok Yes | `enterNearestCar` guard; AC-009 test |
| REQ-013 | !ok Yes | !ok Yes | `explodeCar` reward block; AC-010 test |
| REQ-014 | !ok Yes | !ok Yes | `wanted.copKilled` / `pedAttacked`; AC-010 test |
| REQ-015 | !ok Yes | !ok Yes | `damageTarget(…, attacker)`; AC-011 test |
| REQ-016 | !ok Yes | !ok Yes | `byPlayer` / `noReward`; AC-004, AC-010 tests |
| REQ-017 | !ok Yes | !ok Manual AC-012 (developer, passed) | `Hud.drawCarBar` |
| REQ-018 | !ok Yes | !ok Manual AC-012 (developer, passed) | `audio.js` sounds, `Effects.fire/explosion` listeners |
| NFR-001 | !ok Yes | !ok Yes | NFR-001 test; `git diff --stat tests/` empty; 110/110 pass |
| EDGE-001 – EDGE-008 | !ok Yes | !ok Yes | AC-002, AC-005 – AC-008 and EDGE-004 tests; EDGE-008 by existing bullet tests passing unchanged |

## Commands run

```text
node --test tests/                    → 109 pass, 0 fail (95 existing + 14 new)
git diff --stat tests/ index.html     → empty (no existing test or index.html change)
git status --short                    → 8 src files + tasks.json modified; spec dir and tests/car-damage.test.js new
grep module.exports src/*.js src/entities/*.js → 18/18 files keep the guarded export
Manual in-browser check (AC-012)      → NOT RUN at first review

Final re-check (2026-11-20):
node --test tests/                    → 110 pass, 0 fail (95 existing + 15 new incl. NBK-1 test)
git diff --stat tests/                → empty; git status: only tests/car-damage.test.js untracked
git diff src/config.js                → additions only (CAR, SCORE, EFFECTS keys); all listed in docs/config.md with matching values
Manual in-browser check (AC-012)      → PASSED — run by the developer, confirmed in chat 2026-11-20
```

## Findings

NBK-1: [!ok resolved] The minimap still drew wrecked patrol cars as patrol markers (`src/hud.js:276`). Fixed: loop skips `car.wreck`; covered by test `NBK-1: minimap skips wrecked patrol cars` in `tests/car-damage.test.js`.
NBK-2: [!ok resolved] Four spec-silent rules the implementation settled are not recorded — kills before car reward (AC-011 civilian car + cop at 0★ gives 1★), burning cars ignore further damage so attribution is frozen at ignition, a player in another car takes halved explosion damage (A9), wrecks smoke; add them to `assumptions.md` and move the developer-approved A1 – A12 cards to `## Accepted`. Fixed: A13 – A16 added (confirmed by the developer 2026-11-20) and A1 – A16 are under `## Accepted` in `assumptions.md`.
NBK-3: [!ok resolved] AC-012 (car bar, smoke/fire/explosion/wreck visuals, both sounds) had not been verified in the browser. Resolved: the developer ran it and reported it passed (chat, 2026-11-20).

Spec-silent choices judged acceptable: kill-then-reward order follows `design.md § Interfaces and data` order; frozen attribution is consistent with EDGE-001 and REQ-016 (no damage lands after ignition); halved in-car damage is A9; wreck smoke is literal REQ-005; burning patrol cars not culled by `spawnPatrolCars` (`src/game.js:245`) follows EDGE-004; new `EFFECTS` keys are allowed by the design; `Effects.burst` `time` is optional and backward compatible; HUD row shift only applies while driving.

## Scope and high-risk review

- Drift: None — every changed file is in `design.md § Files to change`; `src/config.js` changes are additions only, approved with the spec.
- Conventions: one global per file with guarded `module.exports`; new behavior communicates through `carBurning` / `carExploded` events.
- High-risk: None — gameplay-only, no auth, data, infra or public API; standard review.

## Documentation decision

Decision: [!ok required — updated]

| Documentation target | Updated / justified unaffected |
| --- | --- |
| `docs/car.md` | Updated — remove "indestructibles", add health/burn/wreck life cycle and `crash(…, other)` |
| `docs/game.md` | Updated — `damageCar`, `explodeCar`, `emitCarSmoke`, events, `spawnPatrolCars` burning guard |
| `docs/weapons.md` | Updated — bullets stop on car bodies |
| `docs/player.md` | Updated — `forceExit`, enter guard |
| `docs/police.md` | Updated — police bullets hit cars, burning patrol cars keep driving and are not culled (added by review) |
| `docs/audio.md` | Updated — two sounds, `smoke`/`fire`/`explosion`, `burst` `time` |
| `docs/hud.md` | Updated — car health bar and row shift |
| `docs/config.md` | Updated — new `CAR`, `SCORE`, `EFFECTS` keys |
| `docs/README.md` | Updated — car and audio/effects rows |
| `README.md` | Updated (protected, approved) — dropped "Los coches no se rompen" and the in-car half bullet damage line, added car scoring/wanted and damage rules |

Docs re-check: each target updated, Spanish kept, text matches the reviewed code (spot-checked `damageCar`/`explodeCar`, bullet order, `forceExit`, minimap, config values); no secrets. `docs/audio.md` still says the audio test checks "14 eventos": not a finding — it describes the unchanged `tests/audio.test.js`, whose list has 14 events; the two new subscriptions are in the event table.

## Proposals

- **Decision-log entries:** (1) architecture — car damage, explosions and their score/wanted effects route through `Game.damageCar` / `Game.explodeCar`; rejected `Car.takeDamage` emitting events for `Game` to score; (2) gameplay rule — cars are cover for all bullets, so a driving player is shielded from police fire until the car burns (Q2); (3) attribution — a car remembers only its last damage source, frozen at ignition, and never rewards if the player drove it when it caught fire (A2, EDGE-003).
- **Failure-learning entry:** None.
