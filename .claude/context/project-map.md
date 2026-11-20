# Mini City Chaos — project map

Orientation artifact for the agent and developers: where things live, how
the project runs, and what must not be touched without approval.

Rules for this file:

- Keep it concise — aim for one or two screens. It exists to avoid loading
  many files into context, not to replace them (see the context-economy
  policy).
- Keep the tree shallow (2–3 levels) and annotated; omit generated and
  vendored directories. Do not list every file.
- Never record secrets, credentials, or tokens here.
- **Maintenance rule:** update this map when the structure changes
  significantly — new top-level directories, moved entrypoints, renamed
  build/test commands, or new protected areas.

## Directory tree

```text
mini-city-chaos/
├── index.html            # canvas 960×640 + <script> tags in dependency order (PROTECTED)
├── src/                  # game code: one global object/class per file + module.exports
│   ├── config.js         # CONFIG: every tunable/balance constant (PROTECTED)
│   ├── utils.js, input.js, map.js, camera.js
│   ├── weapons.js, wanted.js, hud.js, effects.js, audio.js
│   ├── game.js           # Game: state machine, update/draw loop, spawners, event bus
│   ├── main.js           # bootstrap: creates Game, rAF loop, audio unlock
│   └── entities/         # player, pedestrian, car, police (+ patrol cars), bullet, pickup
├── tests/                # node:test suites, one per module (existing tests PROTECTED)
├── docs/                 # one page per src/ module (Spanish) + README index
├── PLAN.md               # original F0–F8 plan — historical, frozen (PROTECTED)
├── README.md             # player-facing: how to play, controls, rules (PROTECTED)
├── AGENTS.md / CLAUDE.md # agent instructions (CLAUDE.md imports AGENTS.md)
├── .claude/              # SDD harness: agents, skills, reference policies, this map
├── specs/                # SDD specs, one folder per feature slug
├── decisions/            # onboarding answers + decision logs
├── scripts/              # SDD scripts: init, run-tests, run-lint, render-spec, validate
├── tasks.json            # SDD task state
└── history.md            # completed SDD tasks, newest first
```

## Key entrypoints

| Entrypoint | Purpose |
|---|---|
| `index.html` | Browser entrypoint; loads `src/` scripts in order (each defines a global used by later ones). |
| `src/main.js` | Creates the `Game` instance and runs the `requestAnimationFrame` loop. |
| `src/game.js` | Game state (`menu/playing/paused/gameover`), `update(dt)` → `draw(ctx)`, `on/emit` events. |
| `tests/*.test.js` | Node test suites; `require` the `src/` modules via `module.exports`. |

## Commands

| Action | Command |
|---|---|
| Install / validate environment | `scripts/init.sh` (SDD structure check; the game has no install step) |
| Run all tests | `node --test tests/` |
| Lint | None (no linter configured) |
| Typecheck | None (plain JavaScript) |
| Build | None (no build step) |
| Run the game | `python3 -m http.server 8000` → http://localhost:8000, or open `index.html` |

## Framework and runtime assumptions

- Vanilla JavaScript + HTML5 Canvas 2D, **no dependencies**, no bundler, no
  `package.json`. Keep it that way unless a decision says otherwise.
- Every `src/` file defines one global (`CONFIG`, `Game`, `Car`, `Police`,
  `Sound`…) and ends with a guarded `module.exports` so Node tests can load it.
- Script load order in `index.html` encodes dependencies.
- Tests: Node.js built-in `node:test` runner (95 tests passing at onboarding,
  2026-11-20). Browser APIs (`AudioContext`, `localStorage`) are faked in tests.
- Sound is synthesized with Web Audio (no asset files). High score is stored
  in `localStorage` key `mcc-highscore`.

## Important documentation

| Document | Path |
|---|---|
| Player guide (controls, rules) | `README.md` |
| Code docs index + frame flow | `docs/README.md` |
| Per-module docs | `docs/<module>.md` |
| Balance values | `docs/config.md` |
| Original implementation plan (F0–F8, done) | `PLAN.md` |
| SDD onboarding answers | `decisions/answers.md` |

## Protected areas

Files or directories that require explicit approval before changes:

- `src/config.js` — balance values tuned in F8.
- `index.html` — especially the script load order.
- `PLAN.md`, `README.md`.
- Existing files in `tests/` — do not modify or delete existing tests without approval (adding new test files is fine).

## SDD locations

| Artifact | Path |
|---|---|
| Task state | `tasks.json` |
| Specs | specs/<feature-slug>/ |
| History | history.md |
| Decisions | decisions/ |

## Generated files and do-not-edit

| Path | Rule |
|---|---|
| `specs/**/spec.html`, `history.html` | Rendered by `scripts/render-spec.sh`; gitignored; never hand-edit. |
| `specs/**/feedback.md` | Saved from the spec page; gitignored; deleted once applied. |
| `.claude/sdd-kit-manifest.json` | Written by onboarding / `sdd-update`; do not hand-edit. |
