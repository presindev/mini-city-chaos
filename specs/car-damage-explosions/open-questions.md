---
doc: open-questions
title: Open questions — Car damage and explosions
task_id: MCC-001
feature_slug: car-damage-explosions
source_document: Developer request in chat (2026-11-20)
created: 2026-11-20
---

## Summary

- Blocking: 0 · Non-blocking: 0 · Resolved: 8

## Open

None.

## Resolved

::: card
#### Q1 — Player's car at 0 health [!ok Resolved]

- **Question:** What happens to the player when the car they drive reaches 0 health?
- **Decision:** It catches fire and the player has `CAR.BURN_TIME` to exit with E; if still inside at the explosion, the player is moved out beside the car (centre if no free spot) and takes the full explosion damage.
- **Resolved by:** developer, 2026-11-20
- **Related requirements:** REQ-006, REQ-010, EDGE-007
:::

::: card
#### Q2 — Which bullets hit cars [!ok Resolved]

- **Question:** Do all bullets stop on cars, or only the player's?
- **Decision:** All bullets (player's and police) stop on any car body and damage it; cars act as cover, so police bullets hit the player's car, not the player.
- **Resolved by:** developer, 2026-11-20
- **Related requirements:** REQ-002, REQ-003
:::

::: card
#### Q3 — Wanted level [!ok Resolved]

- **Question:** Does destroying a car raise the wanted level?
- **Decision:** Only when attributed to the player: a patrol car gives +1 star (like `copKilled`), a civilian car ensures at least 1 star (like `pedAttacked`).
- **Resolved by:** developer, 2026-11-20
- **Related requirements:** REQ-014, REQ-016
:::

::: card
#### Q4 — Score [!ok Resolved]

- **Question:** Does destroying a car score?
- **Decision:** Civilian car `SCORE.CAR`, patrol car `SCORE.PATROL_CAR`; kills caused by the explosion score as usual on top.
- **Resolved by:** developer, 2026-11-20
- **Related requirements:** REQ-013, REQ-015
:::

::: card
#### Q5 — Crash damage [!ok Resolved]

- **Question:** How do crashes damage cars?
- **Decision:** Every impact that already emits `carCrash` (wall or car-car, including patrol rams) subtracts `impact × CAR.CRASH_DAMAGE_FACTOR`.
- **Resolved by:** developer, 2026-11-20
- **Related requirements:** REQ-004
:::

::: card
#### Q6 — After the explosion [!ok Resolved]

- **Question:** What remains after a car explodes?
- **Decision:** An immobile burnt wreck that blocks bullets without damage, cannot be entered, and is removed after `CAR.WRECK_TIME` or when off screen.
- **Resolved by:** developer, 2026-11-20
- **Related requirements:** REQ-011, REQ-012
:::

::: card
#### Q7 — AI drivers [!ok Resolved]

- **Question:** What do AI drivers do when their car burns?
- **Decision:** Civilian drivers get out as scared pedestrians (reuse `Car.ejectDriver`), leaving the car driverless; patrol cars keep driving with the police AI until they explode.
- **Resolved by:** developer, 2026-11-20
- **Related requirements:** REQ-007, REQ-008
:::

::: card
#### Q8 — HUD [!ok Resolved]

- **Question:** How is car health shown?
- **Decision:** A car health bar under the player's health bar, only while driving, blinking red while the car burns.
- **Resolved by:** developer, 2026-11-20
- **Related requirements:** REQ-017
:::
