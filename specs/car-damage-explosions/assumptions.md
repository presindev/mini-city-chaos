---
doc: assumptions
title: Assumptions — Car damage and explosions
task_id: MCC-001
feature_slug: car-damage-explosions
source_document: Developer request in chat (2026-11-20)
created: 2026-11-20
---

## Summary

- Risk: low 13 · medium 3 · high 0 · blocking: no
- Status: accepted 16 · pending 0 · rejected 0

## Pending

None.

## Accepted

::: card risk-low
#### A13 — Kills before car reward [!ok Accepted 2026-11-20]

- **Assumption:** On a player-attributed explosion, kill effects (REQ-015) apply before the car reward (REQ-013, REQ-014), so a civilian-car explosion that kills a cop at 0★ yields 1★, not 2★.
- **Reason:** Confirmed by the developer in chat; follows the event order in `design.md § Interfaces and data`.
- **Risk / impact if wrong:** low — one star of difference in a rare case.
- **Blocks implementation:** No
- **Related requirements:** REQ-013 – REQ-015
:::

::: card risk-low
#### A14 — Attribution frozen at ignition [!ok Accepted 2026-11-20]

- **Assumption:** A car's attribution is fixed when it starts burning, and later hits do not change who gets credit.
- **Reason:** Confirmed by the developer in chat; consistent with EDGE-001.
- **Risk / impact if wrong:** low — finishing a burning car never steals credit.
- **Blocks implementation:** No
- **Related requirements:** REQ-016, EDGE-001
:::

::: card risk-low
#### A15 — Player in another car takes halved damage [!ok Accepted 2026-11-20]

- **Assumption:** A player inside a different car near an explosion takes the normal in-car damage halved by `CAR.PLAYER_DAMAGE_FACTOR`, and their car takes its own explosion damage.
- **Reason:** Confirmed by the developer in chat; keeps A9's rule.
- **Risk / impact if wrong:** low — feel only.
- **Blocks implementation:** No
- **Related requirements:** REQ-009, REQ-010
:::

::: card risk-low
#### A16 — Wrecks keep smoking [!ok Accepted 2026-11-20]

- **Assumption:** Wrecks keep emitting smoke because their health 0 is below `CAR.SMOKE_HEALTH`.
- **Reason:** Confirmed by the developer in chat; literal reading of REQ-005.
- **Risk / impact if wrong:** low — cosmetic.
- **Blocks implementation:** No
- **Related requirements:** REQ-005, REQ-011
:::

::: card risk-medium
#### A1 — Tunable numbers [!ok Accepted 2026-11-20]

- **Assumption:** `CAR.HEALTH` 100, `SMOKE_HEALTH` 50, `BURN_TIME` 3 s, `EXPLOSION_RADIUS` 110 px, `EXPLOSION_DAMAGE` 80, `CRASH_DAMAGE_FACTOR` 0.1, `WRECK_TIME` 15 s, `SCORE.CAR` 20, `SCORE.PATROL_CAR` 100 (pistol: 4 shots; cop bullet: ~17 hits).
- **Reason:** Proposed by the developer as starting balance.
- **Risk / impact if wrong:** medium — balance only; values live in `src/config.js` and `docs/config.md`.
- **Blocks implementation:** No
- **Related requirements:** REQ-001, REQ-004 – REQ-006, REQ-009, REQ-011, REQ-013
:::

::: card risk-medium
#### A2 — Attribution rule [!ok Accepted 2026-11-20]

- **Assumption:** A car remembers only its last damage source, and a car the player was driving when it caught fire never rewards.
- **Reason:** Simplest rule that matches Q3/Q4 without tracking damage history.
- **Risk / impact if wrong:** medium — finishing a cop-damaged car gives the player full credit, and vice versa.
- **Blocks implementation:** No
- **Related requirements:** REQ-016, EDGE-003
:::

::: card risk-low
#### A3 — Fists do not damage cars [!ok Accepted 2026-11-20]

- **Assumption:** Melee hits ignore cars.
- **Reason:** Fists only test `getTargets()` today.
- **Risk / impact if wrong:** low — a later tweak.
- **Blocks implementation:** No
- **Related requirements:** EDGE-006
:::

::: card risk-low
#### A4 — Burn timer is fixed [!ok Accepted 2026-11-20]

- **Assumption:** Extra damage never changes a burn timer, and chained cars get their own full timer.
- **Reason:** Gives the player a predictable escape window.
- **Risk / impact if wrong:** low — chains feel slower than instant ones.
- **Blocks implementation:** No
- **Related requirements:** EDGE-001, EDGE-002
:::

::: card risk-low
#### A5 — Burning cars survive off-screen cleanup [!ok Accepted 2026-11-20]

- **Assumption:** A burning driverless car is removed only after it explodes and becomes an off-screen wreck.
- **Reason:** Otherwise a burning car could vanish silently.
- **Risk / impact if wrong:** low — at most `BURN_TIME` of extra lifetime.
- **Blocks implementation:** No
- **Related requirements:** EDGE-004
:::

::: card risk-medium
#### A6 — Patrol car counting [!ok Accepted 2026-11-20]

- **Assumption:** A burning patrol car still counts in `game.patrolCars()`; its wreck does not, so a replacement spawns.
- **Reason:** Matches Q7 (it keeps driving) and the existing `driver === 'ai'` filter.
- **Risk / impact if wrong:** medium — affects police pressure right after a kill.
- **Blocks implementation:** No
- **Related requirements:** EDGE-005
:::

::: card risk-low
#### A7 — No entering burning cars or wrecks [!ok Accepted 2026-11-20]

- **Assumption:** `enterNearestCar` skips both.
- **Reason:** Prevents trivially escaping the fire into another doomed car.
- **Risk / impact if wrong:** low.
- **Blocks implementation:** No
- **Related requirements:** REQ-012
:::

::: card risk-low
#### A8 — Explosions scare pedestrians [!ok Accepted 2026-11-20]

- **Assumption:** Uses the existing `scareAt` with `SCARE_RADIUS`.
- **Reason:** Consistent with gunshots.
- **Risk / impact if wrong:** low.
- **Blocks implementation:** No
- **Related requirements:** REQ-009
:::

::: card risk-low
#### A9 — Existing damage rules unchanged [!ok Accepted 2026-11-20]

- **Assumption:** `Player.takeDamage` halving in a car and `Police.ram` stay as they are.
- **Reason:** Existing tests depend on them; REQ-010 bypasses halving by exiting first.
- **Risk / impact if wrong:** low.
- **Blocks implementation:** No
- **Related requirements:** REQ-010, NFR-001
:::

::: card risk-low
#### A10 — Wrecks are immovable obstacles [!ok Accepted 2026-11-20]

- **Assumption:** In car-car collisions a wreck is never pushed (the other car takes the whole separation) and takes no crash damage.
- **Reason:** "Immobile" in Q6; added by spec-author.
- **Risk / impact if wrong:** low — wrecks could be shoved aside instead.
- **Blocks implementation:** No
- **Related requirements:** REQ-011
:::

::: card risk-low
#### A11 — Explosion geometry [!ok Accepted 2026-11-20]

- **Assumption:** Distance `d` is measured from the car centre to the target centre (to the other car's body for cars), and explosions apply no physical push.
- **Reason:** Simplest falloff; added by spec-author.
- **Risk / impact if wrong:** low — feel only.
- **Blocks implementation:** No
- **Related requirements:** REQ-009
:::

::: card risk-low
#### A12 — Driverless burning cars coast [!ok Accepted 2026-11-20]

- **Assumption:** A civilian car left driverless keeps its momentum and stops under normal friction.
- **Reason:** Existing parked-car physics; added by spec-author.
- **Risk / impact if wrong:** low.
- **Blocks implementation:** No
- **Related requirements:** REQ-007
:::

## Rejected or replaced

None yet.
