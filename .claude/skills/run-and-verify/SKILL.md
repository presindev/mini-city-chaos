---
name: run-and-verify
description: Run Mini City Chaos and verify behavior using its real commands. Use when validating an implementation, reproducing a bug, or confirming acceptance criteria before review.
---

# Run and verify — Mini City Chaos

How to run, inspect, and verify this project. Implementation claims
("it works") must be backed by observed behavior from the commands below,
not by assumptions.

Rules for this file:

- Commands here come from repository inspection and developer answers.
  If a command is unknown, keep it as `TODO: ask the developer` — never
  invent one.
- Record environment variables by **name only**. Never write secret
  values, tokens, or credentials in this file.
- Update this file when commands, services, or verification steps change.

## When to use

- Before marking an implementation task ready for review.
- When the reviewer validates an implementation against its spec.
- Reproducing a reported bug before fixing it.
- Confirming acceptance criteria that describe runtime behavior.

## When not to use

- Pure documentation or comment changes with no runtime effect.
- When required services or credentials are unavailable — record a TODO
  and report that verification was not performed, rather than faking it.

## Project commands

| Action | Command |
|---|---|
| Start dev server / run locally | `python3 -m http.server 8000` → http://localhost:8000 (or open `index.html` directly in the browser) |
| Run all tests | `node --test tests/` (or `scripts/run-tests.sh`) |
| Run targeted tests | `node --test tests/<module>.test.js` (e.g. `node --test tests/car.test.js`) |
| Lint | None — the project has no linter. |
| Typecheck | None — plain JavaScript, no type checker. |
| Build | None — no build step; the browser loads `src/*.js` directly via `index.html`. |

## Required services

None. The game is static HTML5 Canvas + vanilla JavaScript with no
dependencies; tests need only Node.js (built-in `node:test`).

## Required environment variables

None.

## How to verify behavior

### UI verification

Manual checklist (the developer confirms in the browser; the agent reports
which items it could not observe itself):

1. Serve with `python3 -m http.server 8000` and open http://localhost:8000.
2. The browser console shows no errors on load or during play.
3. `Enter` starts the game; `P` pauses/resumes; `M` toggles sound.
4. Play one full game to Game Over, exercising the changed feature
   (movement, weapons `1`/`2`/`3`, `E` to enter/exit cars, wanted level,
   HUD/minimap) per the spec's acceptance criteria.
5. `Enter` after Game Over restarts cleanly (0 ★, no leftover police,
   patrol cars or bullets); the high score (`localStorage` key
   `mcc-highscore`) persists across a reload.

### API / CLI verification

Not applicable (no API or CLI). Game logic is verified through the
`node:test` suites in `tests/`; each `src/` module exposes its global via
`module.exports` so tests can `require` it.

## Procedure

1. Confirm required services are up and environment variables are set
   (by name; do not echo values).
2. Identify the narrowest check that exercises the change (targeted test,
   single route, one CLI invocation) and run it; capture actual output.
3. Run the broader applicable checks the project defines (tests, lint,
   typecheck, build when relevant).
4. Verify runtime behavior against the spec's acceptance criteria using
   the UI/API verification steps above.
5. Report honestly: what ran, what passed, what failed (with output), and
   what could not be verified and why.

## Output artifact

Verification evidence in the task's review notes (`review.md`) or the
implementation summary: commands run, results, and unverified items.

## Safety constraints

- Never invent commands; unknown commands are `TODO: ask the developer`.
- Do not run destructive operations (migrations, data deletion, deploys)
  without explicit approval.
- Never store secrets in this skill, specs, or evidence; reference
  variable names only.
- Prefer local/test environments; never verify against production without
  explicit instruction.
