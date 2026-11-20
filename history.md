---
doc: history
title: SDD History
---

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
