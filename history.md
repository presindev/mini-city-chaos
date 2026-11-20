---
doc: history
title: SDD History
---

## Resume here

- **Updated:** 2026-11-20
- **Current task:** none active. MCC-001 `car-damage-explosions` is `done` (spec, review, docs, decision log complete).
- **Next action:** pick the next feature with the developer and run `/sdd-workflow <description>` to create `MCC-002`. Candidates discussed in chat (not yet tasks): health pickups (botiquines), short missions/errands with HUD arrow, kill-combo score multiplier.
- **Blockers / waiting on:** none.
- **Uncommitted work:** none (MCC-001 committed and pushed at session close).
- **Notes:**
  - `node --test tests/` passes 110/110 (95 pre-SDD + 15 in `tests/car-damage.test.js`).
  - SDD roles are strict: only `spec-author` writes `specs/`, `implementer` writes code, `reviewer` writes `review.md`, `documenter` writes docs; the main conversation orchestrates and updates `tasks.json`.
  - Car damage rules (cover, credit, explosion order) are in `decisions/architecture-decisions.md` (2026-11-20 entries); don't re-litigate.
  - SDD artifacts are in English; game docs (`README.md`, `PLAN.md`, `docs/`) stay in Spanish.

## Entries

<!-- Append a new entry each time a task reaches done — newest first, immediately after the INSERT-ENTRY-HERE marker. Remove the "No entries yet." line when adding the first entry. Entry format:

::: card
#### TASK-001 — feature-slug [!ok done]

- **Date:** YYYY-MM-DD
- **Spec:** `specs/feature-slug/`
- **Summary:** …
- **Files changed:** …
- **Tests run:** …
- **Reviewer decision:** approved
- **Human approval ref:** …
- **Docs updated:** … (targets updated, or "not required")
- **Decisions recorded:** … (entries accepted by the developer, or "none")
- **Follow-ups:** … (or "none")
:::
-->

<!-- INSERT-ENTRY-HERE -->

::: card
#### MCC-001 — car-damage-explosions [!ok done]

- **Date:** 2026-11-20
- **Spec:** `specs/car-damage-explosions/`
- **Summary:** Cars (civilian and patrol) now have health. Bullets (player and police) stop on car bodies and damage them, and hard crashes damage them too. Damaged cars smoke. At 0 health a car burns for 3 s and then explodes with linear-falloff area damage that chains to other cars, leaving a wreck. Destroying cars feeds score (+20 civilian, +100 patrol) and the wanted level (civilian ≥1★, patrol +1★) only when the player is responsible. Adds a car health bar, fire/explosion particles and sounds.
- **Files changed:** `src/config.js`, `src/game.js`, `src/effects.js`, `src/audio.js`, `src/hud.js`, `src/entities/car.js`, `src/entities/bullet.js`, `src/entities/player.js`, `tests/car-damage.test.js` (new), `docs/car.md`, `docs/game.md`, `docs/weapons.md`, `docs/player.md`, `docs/police.md`, `docs/audio.md`, `docs/hud.md`, `docs/config.md`, `docs/README.md`, `README.md`.
- **Tests run:** `node --test tests/` → 110/110 passing (95 existing + 15 new). Manual browser check AC-012 done by the developer on 2026-11-20 and passed.
- **Reviewer decision:** approved
- **Human approval ref:** `tasks.json` approval 2026-11-20 (chat).
- **Docs updated:** `docs/car.md`, `docs/game.md`, `docs/weapons.md`, `docs/player.md`, `docs/police.md`, `docs/audio.md`, `docs/hud.md`, `docs/config.md`, `docs/README.md`, `README.md`.
- **Decisions recorded:** 3 in `decisions/architecture-decisions.md` (car damage via Game; cars are cover; car kill credit) and 1 in `decisions/rejected-options.md` (Car.takeDamage emitting rewards), approved by the developer 2026-11-20.
- **Follow-ups:** none
:::

::: card
#### PRE-SDD — F0–F8 baseline [!ok done]

- **Date:** 2026-11-20 (SDD onboarding)
- **Spec:** none — built before SDD from `PLAN.md` (now frozen as a historical record).
- **Summary:** Complete playable game: city map, camera, player on foot, pedestrians, fists/pistol/shotgun with pickups, traffic and car stealing, wanted level with foot police and patrol cars, HUD/minimap/screens with persisted high score, synthesized sound, effects and balancing.
- **Files changed:** `index.html`, `src/**`, `tests/**`, `docs/**`, `README.md`, `PLAN.md`.
- **Tests run:** `node --test tests/` → 95/95 passing.
- **Reviewer decision:** n/a (pre-SDD; acceptance criteria confirmed by the developer per `PLAN.md`).
- **Human approval ref:** `PLAN.md` acceptance checkboxes.
- **Docs updated:** `docs/` one page per module; `README.md` player guide.
- **Decisions recorded:** none.
- **Follow-ups:** none — next work is tracked in `tasks.json` (IDs `MCC-NNN`).
:::
