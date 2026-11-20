# Architecture decisions

Durable architectural decisions for this project. This file is project
memory: it answers "why is it built this way?" for future sessions and new
contributors.

Rules:

- Append new entries below the marker, newest first.
- Log only significant decisions. Trivial choices do not belong here.
- Never log secrets, credentials, or sensitive operational data.
- When a decision replaces an earlier one, mark the old entry
  `Status: superseded by <date — title>` instead of deleting it.
- Propose entries to the developer before writing them.

Entry format:

```markdown
## <YYYY-MM-DD> — <short decision title>

- Status: accepted
- Context: <why a decision was needed>
- Decision: <what was decided>
- Alternatives rejected: <what was considered and why it lost; details may go to rejected-options.md>
- Consequences: <what this commits the project to>
- Source: <task/spec/review that settled it>
```

---

## 2026-11-20 — Car damage, score and wanted go through Game

- Status: accepted
- Context: MCC-001 made cars destructible; damage, attribution, score and wanted level needed a single owner.
- Decision: all car damage and explosions go through `Game.damageCar` and `Game.explodeCar`; `Car` only holds state (health, burning, wreck) and emits nothing about rewards.
- Alternatives rejected: `Car.takeDamage` emitting events and applying rewards itself (see `rejected-options.md`, 2026-11-20).
- Consequences: new damage sources (weapons, hazards) must call `Game.damageCar`; score/wanted rules for cars live only in `game.js`.
- Source: MCC-001 `specs/car-damage-explosions/` (design, review).

## 2026-11-20 — Cars are cover for all bullets

- Status: accepted
- Context: MCC-001 Q2 — bullets used to pass through cars.
- Decision: every bullet (player and police) stops on any car body and damages the car; wrecks stop bullets without taking damage. While driving, police bullets hit the car, not the player.
- Alternatives rejected: only player bullets hit cars; bullets damage both car and driver.
- Consequences: a driving player is only hurt by rams, crashes and explosions until the car burns; `CAR.PLAYER_DAMAGE_FACTOR` now mainly affects rams and nearby explosions.
- Source: MCC-001 open-questions Q2 (developer, 2026-11-20).

## 2026-11-20 — Car kill credit: last damage source, frozen at ignition

- Status: accepted
- Context: MCC-001 needed to decide who earns points/stars when a car explodes, including chain reactions.
- Decision: a car credits its last damage source; credit freezes when it starts burning; a car the player was driving when it ignited never rewards. Explosion kills are applied before the car reward.
- Alternatives rejected: last hit before the explosion; car reward before kills (would give 2★ instead of 1★ in mixed cases).
- Consequences: chain explosions inherit the player's credit; finishing a police-damaged car gives full reward.
- Source: MCC-001 assumptions A2, A13, A14 (developer, 2026-11-20).

## 2026-11-20 — Vanilla JS globals, no dependencies, no build

- Status: accepted
- Context: recorded at SDD onboarding to capture the existing architecture, which was established during F0–F8.
- Decision: HTML5 Canvas + vanilla JavaScript, loaded by `index.html` in dependency order. Each `src/` file defines one global plus a guarded `module.exports` for the Node tests (`node:test`). Systems communicate through `game.on`/`game.emit`. Tunables live in `CONFIG` (`src/config.js`).
- Alternatives rejected: adding tooling or dependencies (see `rejected-options.md`, 2026-11-20).
- Consequences: new modules follow the same pattern and need a `<script>` tag in `index.html` (protected) and a `docs/<module>.md` page. Introducing a bundler or packages requires an approved spec.
- Source: SDD onboarding; `docs/README.md`; `PLAN.md` F1.
