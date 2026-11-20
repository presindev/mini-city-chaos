---
doc: requirements
title: Requirements — Car damage and explosions
task_id: MCC-001
feature_slug: car-damage-explosions
status: spec_ready
author: spec-author
human_approval: pending
---

## Summary

Cars stop being indestructible: bullets and hard crashes wear down their health, damaged cars smoke, and a car at 0 health burns briefly and then explodes with area damage that can chain to other cars. Cars become cover against bullets, and destroying cars feeds score and the wanted level when the player is responsible. Tunable numbers and minor rules are in `assumptions.md`; the developer's decisions are in `open-questions.md § Resolved`.

## Requirements

REQ-001: When a car spawns, the system shall give it `CAR.HEALTH` health.
REQ-002: When any bullet (player's or police) reaches a car body, the system shall stop the bullet there, emit `bulletImpact`, and subtract the bullet's damage from the car's health.
REQ-003: While the player drives a car, the system shall let police bullets hit the car instead of the player.
REQ-004: When an impact emits `carCrash` (wall or car-car, including patrol rams), the system shall subtract `impact × CAR.CRASH_DAMAGE_FACTOR` from that car's health.
REQ-005: While a car's health is at or below `CAR.SMOKE_HEALTH` and it is not burning, the system shall emit smoke from it.
REQ-006: When a car's health reaches 0, the system shall set it on fire, emit `carBurning`, and explode it `CAR.BURN_TIME` seconds later.
REQ-007: When a civilian traffic car starts burning, the system shall eject its driver as a scared pedestrian and leave the car driverless.
REQ-008: While a patrol car is burning, the system shall keep driving it with the police AI until it explodes.
REQ-009: When a car explodes, the system shall deal `CAR.EXPLOSION_DAMAGE × (1 − d / CAR.EXPLOSION_RADIUS)` to every pedestrian, police officer, the player and every other car within `CAR.EXPLOSION_RADIUS`, emit `carExploded`, and scare pedestrians within `SCARE_RADIUS`.
REQ-010: If the player is still inside a car when it explodes, the system shall place the player beside the car (at its centre if no free spot) and apply the full, unhalved explosion damage.
REQ-011: When a car explodes, the system shall leave an immobile, driverless wreck that blocks bullets without taking damage and is removed after `CAR.WRECK_TIME` seconds or when off screen.
REQ-012: If the player presses E near a burning car or a wreck, the system shall not let the player enter it.
REQ-013: When a car whose destruction is attributed to the player explodes, the system shall add `SCORE.CAR` for a civilian car or `SCORE.PATROL_CAR` for a patrol car.
REQ-014: When a player-attributed patrol car explodes, the system shall raise the wanted level by 1 star, and when a player-attributed civilian car explodes, the system shall ensure at least 1 star.
REQ-015: When a player-attributed explosion kills pedestrians or police, the system shall apply their usual score and wanted effects, and when a non-player explosion does, the system shall apply neither.
REQ-016: The system shall attribute a car's destruction to the player when its last damage came from a player bullet, a crash in which the player drove either car, or a player-attributed explosion.
REQ-017: While the player drives, the system shall show a car health bar under the player's health bar, blinking red while the car burns.
REQ-018: When a car starts burning or explodes, the system shall play the `carBurning` / `carExploded` sound and show fire / explosion particles.
NFR-001: The system shall keep all particles within `EFFECTS.MAX_PARTICLES` and the existing test suite passing unchanged.

## Edge cases and errors

EDGE-001: If a burning car takes more damage, the system shall neither reset nor shorten its burn timer.
EDGE-002: When an explosion sets another car on fire, the system shall give that car its own full `CAR.BURN_TIME`.
EDGE-003: If the player was driving a car when it started burning, the system shall never award score or stars for that car.
EDGE-004: While a car is burning, the system shall not remove it by the off-screen cleanup.
EDGE-005: While a patrol car burns it shall count in `game.patrolCars()`, and once it is a wreck it shall not, so a replacement can spawn.
EDGE-006: When a fist hits a car, the system shall not damage the car.
EDGE-007: If the player leaves a burning car before it explodes, the system shall damage the player as an on-foot target, and only within the radius.
EDGE-008: If `game.cars` is missing (test stubs), the system shall run bullets exactly as before.

## Acceptance criteria

AC-001: A new traffic or patrol car reports `health === CAR.HEALTH` (REQ-001).
AC-002: A pistol bullet fired at a car stops at its body and lowers its health by 25; four such bullets set it on fire (REQ-002, REQ-006).
AC-003: A police bullet aimed at the driving player damages the car and leaves the player's health unchanged (REQ-003).
AC-004: A `carCrash` with impact 200 lowers the car's health by 20 (REQ-004).
AC-005: After `CAR.BURN_TIME` seconds a burning car becomes a wreck and `carExploded` fires once (REQ-006, REQ-011, EDGE-001).
AC-006: A civilian car set on fire gets `driver === null` and a new scared pedestrian beside it; a burning patrol car keeps `driver === 'ai'` (REQ-007, REQ-008, EDGE-005).
AC-007: An explosion at distance d damages a pedestrian, a cop, the player and a nearby car by the falloff formula, and a second car reduced to 0 burns for a full `BURN_TIME` (REQ-009, EDGE-002).
AC-008: A player inside an exploding car ends up on foot beside it with health reduced by the full explosion damage (REQ-010).
AC-009: `enterNearestCar` ignores burning cars and wrecks; a wreck is removed after `WRECK_TIME` (REQ-011, REQ-012).
AC-010: Player-shot civilian and patrol cars add 20 / 100 points and ≥ 1 / +1 star; a car the player set on fire while driving, or one burnt by police fire, adds nothing (REQ-013, REQ-014, REQ-016, EDGE-003).
AC-011: Cops killed by a non-player explosion give no score; by a player-attributed one they score `SCORE.POLICE` (REQ-015).
AC-012: In the browser the car bar shows only while driving and blinks red while burning; smoke, fire, explosion and both sounds are visible/audible (REQ-005, REQ-017, REQ-018, NFR-001).
