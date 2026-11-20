# SDD onboarding decisions

Answers recorded during SDD onboarding on 2026-11-20 (sdd-onboarding-kit 3.2.0). The developer accepted the **recommended defaults profile** and answered only the deviations and project-specific questions below.

## Project

- Project name: Mini City Chaos
- Project summary: Top-down action mini-game (classic-GTA style) — grid city, pedestrians, traffic, three weapons, escalating police; goal is to survive and score. HTML5 Canvas + vanilla JavaScript, no dependencies, no build.
- Main language/framework: JavaScript (browser globals + `module.exports` for Node tests), HTML5 Canvas 2D, Web Audio.
- Package manager: none (no `package.json`).
- State at onboarding: `PLAN.md` features F0–F8 complete; `node --test tests/` → 95/95 passing.

## Harness

- Primary harness: Claude Code.
- Primary harness directory: `.claude/`.
- Instruction files generated: `AGENTS.md` (source of truth) + `CLAUDE.md` import stub.
- Additional harnesses: none.
- Concepts not available in the harness and fallback used: none (subagents, skills and hooks are all supported).

## Language

- SDD harness files, specs, tasks, history and decisions: **English**.
- Existing game docs (`README.md`, `PLAN.md`, `docs/`) stay in **Spanish**; the documenter keeps each document's existing language.

## Commands

- Init command: `scripts/init.sh` (SDD structure check; the game itself needs no install).
- Test command: `node --test tests/` (wrapped by `scripts/run-tests.sh`).
- Targeted test command: `node --test tests/<module>.test.js`.
- Lint command: none (no linter; `scripts/run-lint.sh` no-ops). Adding tooling (ESLint/Prettier, `package.json`) was explicitly declined.
- Typecheck command: none.
- Format command: none.
- Run locally: `python3 -m http.server 8000` → http://localhost:8000, or open `index.html`.

## SDD policy

- Scope of SDD: only tasks marked `sdd: true` in `tasks.json`.
- Tasks that may skip SDD: anything not marked `sdd: true` — typically small bug fixes, balance tweaks, typos/cosmetic changes, documentation-only changes. Skipping is stated explicitly by the agent; protected-area rules still apply.
- Bug fixes: SDD only when marked `sdd: true`.
- Hotfixes: same rule (no separate bypass marker).
- Human approval required: yes, before implementation (the developer approves; recorded in `tasks.json` `approval`).
- Requirements format: EARS.
- Task storage: local `tasks.json`; ID format `MCC-NNN`; slugs from titles.
- Spec storage: `specs/<feature-slug>/`.
- History storage: `history.md` (completed tasks appended, newest first; seeded with a pre-SDD F0–F8 baseline entry).
- `PLAN.md`: frozen historical record of F0–F8; new work goes only into `tasks.json` + specs.
- Rendered HTML: gitignored (default); `specs/**/feedback.md` gitignored.

## State machine

- Statuses: `pending → spec_draft → spec_ready → human_approved → in_progress → review → done`, plus `rejected` and `blocked`.
- Approval transition rule: only the developer moves `spec_ready → human_approved`.
- Done transition rule: tests pass, reviewer approves, documentation `updated` or `not_required`.
- Tests required before done: yes. Reviewer required before done: yes.

## Git policy

- Branch creation: only when the developer asks (`feature/MCC-NNN-<slug>` / `fix/MCC-NNN-<slug>`).
- Commit policy: ask before every commit; Conventional Commits in English with `Task: MCC-NNN (<slug>)` in the body.
- Push / pull request policy: only when explicitly asked (via `gh`).
- Git mutations: explicit permission per action. Exception granted at onboarding: commit the installed harness to `main` (no push).

## Hooks

- Enabled hooks: none.
- Hooks left as examples: all (not copied; available in the kit).
- Hook failure mode: n/a.
- Hook wiring file(s) per harness: none (`.claude/settings.json` not created).
- Environment: bash and `jq` available.

## MCPs

- Configured MCPs: none (local-first). No `.mcp.json` created.
- Prefer narrow CLI calls over MCPs; `gh` is installed and authenticated. Remote-mutating CLI commands need per-action permission.
- External task mapping: none.

## Protected areas

Require explicit approval before changes:

- `src/config.js` (balance values).
- `index.html` (script load order).
- `PLAN.md`, `README.md`.
- Existing test files in `tests/` (adding new tests is allowed).

## Optional skill packs

- Installed: `run-and-verify`, `git-discipline`, `decision-log`.
- Declined: `context-audit`, `project-map`, `dependency-freshness`, `documentation-update`, `failure-learning`, `ui-qa`, `spec-from-screenshot`, `goblin-mode`.

## Decision logs (§17)

- Architecture decisions: `decisions/architecture-decisions.md`.
- Rejected options: `decisions/rejected-options.md`.
- Workflow decisions: `decisions/workflow-decisions.md`.

## Browser testing (§18)

- Option 1: no Playwright / browser-tester. UI verification is the manual checklist in the `run-and-verify` skill.

## Other defaults accepted (profile)

- Dependency/API freshness: required for high-risk categories, advisory otherwise (the project has no external dependencies).
- Failure learning: proposals only, never automatic writes; project memory by default, global only with explicit approval of the exact entry.
- Documentation phase: enabled. Targets: `docs/<module>.md` + `docs/README.md` table, `README.md` (player-facing behavior/controls — protected, needs approval), `docs/config.md` for balance values, `.claude/context/project-map.md` on structural changes, `history.md`.
- Deep review: recommended for high-risk categories; paid modes only with per-invocation approval.
- Autonomy: disabled except documented read-only monitoring.
- Session recovery rule: kept in `AGENTS.md`; pre-compact hook not enabled.
- Project map: generated at `.claude/context/project-map.md`.

## Open TODOs

- Roadmap after F0–F8 is undefined: `tasks.json` holds only the `TEMPLATE-001` example; replace it with the first real `MCC-001` task.
