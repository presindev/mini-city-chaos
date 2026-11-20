---
doc: tasks
title: Tasks — Car damage and explosions
task_id: MCC-001
feature_slug: car-damage-explosions
status: spec_ready
---

## Tasks

1. [x] T1: Add config keys and failing tests — New keys per `design.md § Interfaces and data` with A1 values; `tests/car-damage.test.js` covering AC-001 – AC-011.
2. [x] T2: Car health, crash damage and burning — `Car` state, `Game.damageCar`, `crash(…, other)`, cleanup guard (REQ-001, REQ-004 – REQ-008, REQ-016, EDGE-001, EDGE-003 – EDGE-005).
3. [x] T3: Bullets stop on cars — `Bullet.update` car test before targets (REQ-002, REQ-003, EDGE-006, EDGE-008).
4. [x] T4: Explosions, wrecks and rewards — `Game.explodeCar`, `Player.forceExit`, wreck lifecycle, `enterNearestCar` guard (REQ-009 – REQ-015, EDGE-002, EDGE-007).
5. [x] T5: Smoke, fire, explosion, sounds and HUD bar — `effects.js`, `audio.js`, `hud.js`, `Car.draw` (REQ-005, REQ-017, REQ-018, NFR-001).
6. [x] T6: Run validation — `node --test tests/` green with existing tests unchanged; manual AC-012 via the `run-and-verify` skill.
7. [x] T7: Update docs — Targets in `design.md § Documentation targets` (Spanish), after review approval.
8. [x] T8: Propose decision-log entries — The two decision candidates in `design.md § Risks and rollback`.
