# Mini City Chaos — project instructions for coding agents

This project uses **Spec Driven Development (SDD)** for non-trivial implementation work. These instructions apply to every coding agent working in this repository.

## Project summary

Top-down action mini-game in the style of classic GTA: a grid city with pedestrians, traffic, three weapons (fists, pistol, shotgun), stealable cars and police whose pressure scales with a 0–3 ★ wanted level. The goal is to survive and score. Pure HTML5 Canvas + vanilla JavaScript, **no dependencies, no build, no `package.json`**. Each `src/` file defines one global and ends with a guarded `module.exports` for the Node tests. `index.html` loads scripts in dependency order. The original plan (`PLAN.md`, F0–F8) is complete and frozen. New work is tracked in `tasks.json`.

SDD artifacts (specs, tasks, history, decisions) are written in **English**. The existing game docs (`README.md`, `PLAN.md`, `docs/`) are in **Spanish**: keep each document's language when editing it.

## Project map

Repository structure, entrypoints, commands, important docs, and protected
areas are described in the project map:

```text
.claude/context/project-map.md
```

Read it when you need orientation; do not duplicate its directory tree into
this file. Update it when the structure changes significantly (new
top-level directories, moved entrypoints, changed commands, new protected
areas).

## Commands

Use these project commands:

```bash
# Install or validate environment (SDD structure check; the game has no install step)
scripts/init.sh

# Run all tests
node --test tests/          # or scripts/run-tests.sh
# Run one suite
node --test tests/<module>.test.js

# Run lint
# none — the project has no linter (scripts/run-lint.sh no-ops)

# Run typecheck
# none — plain JavaScript

# Format code
# none

# Run the game locally
python3 -m http.server 8000   # → http://localhost:8000 (or open index.html)
```

If any command is unknown, ask the developer before inventing one. Do not add tooling or dependencies (`package.json`, ESLint, bundlers) without an approved spec.

## SDD policy

SDD applies only to tasks marked `"sdd": true` in `tasks.json`. Those tasks follow the full workflow below. Requirements use **EARS** (`When <trigger>, the system shall <response>.`), and every requirement maps to at least one test or a justified manual check. New tasks use IDs `MCC-NNN` with slugs derived from titles.

Default state machine:

```text
pending → spec_draft → spec_ready → human_approved → in_progress → review → done
```

Optional states: `rejected`, `blocked`.

Do not implement an SDD task unless it is in `human_approved` or `in_progress`.

If a task is marked `spec_ready`, stop and ask for human approval.

## Task storage

Task state is stored in:

```text
tasks.json
```

## Spec storage

Specs are stored in:

```text
specs/<feature-slug>/
├── requirements.md
├── design.md
├── tasks.md
└── review.md
```

Spec files are markdown and are the source of truth (format: `.claude/skills/sdd-workflow/spec-format.md`).
Render a spec for human review with `sh scripts/render-spec.sh specs/<feature-slug>/`. It writes one page, `specs/<feature-slug>/spec.html`. That page is a gitignored artifact, so never hand-edit it.
The developer reviews items on that page and saves `specs/<feature-slug>/feedback.md` (or pastes it in chat). When asked to read the feedback, apply it to the markdown sources, re-render, and delete the feedback file.
Structured state (task status, approval) lives in `tasks.json`, not in spec files.

## Required SDD workflow

For each SDD task:

1. Read the task.
2. Create or update the spec.
3. Stop for human approval.
4. Implement only after approval.
5. Run tests and validation (`node --test tests/` must be green; follow the `run-and-verify` skill for in-browser checks).
6. Run the reviewer role.
7. If the reviewer requires documentation updates, run the documenter role, then the reviewer re-checks the docs.
8. Mark done only if requirements, implementation, tests and required docs are aligned.
9. Append a summary to `history.md`.

## SDD skill

The full procedure is the `sdd-workflow` skill:

```text
.claude/skills/sdd-workflow/SKILL.md
```

Invoke it by name (`sdd-workflow`) with the task ID or feature description, using this harness's skill invocation (`/sdd-workflow` in Claude Code). If the harness does not load skills automatically, read `SKILL.md` and follow it.

## Session skills

- `bro`: re-explains the previous answer, a file, a spec item (`REQ-003`) or a term in plain language, in a few lines.
- `closing`: run before ending a session. It checks that every durable artifact is up to date, updates project memory, writes a handoff so a fresh session can resume from the files, commits and pushes per the git policy, and says whether it is safe to close. Invoking it is the approval for those steps.

Invoke them by name with this harness's skill invocation (`/bro`, `/closing`). Their instructions live in `.claude/skills/<name>/SKILL.md`.

## Optional skills installed

- `run-and-verify`: how to run the game and verify behavior (tests and the manual in-browser checklist).
- `git-discipline`: clean, traceable branches, commits and PR text without risky git actions.
- `decision-log`: propose durable architecture, rejected-option and workflow decisions for `decisions/`.

Invoke them by name when their trigger applies. Their full instructions live in `.claude/skills/<name>/SKILL.md` and load only when used, so do not duplicate them here.

## Roles (subagents)

The SDD roles are defined in `.claude/agents/`. Use them as subagents where the harness supports them. Otherwise, read the role file and act as that role in the main conversation, one role at a time. Roles never call each other: the main conversation orchestrates.

- `leader`: inspects task state and recommends which role to run next.
- `spec-author`: creates requirements, design and implementation tasks.
- `implementer`: writes code from approved specs.
- `reviewer`: validates implementation against specs; decides whether documentation updates are required.
- `documenter`: updates affected documentation after review approval, before a task is marked done.

Harness notes: none — Claude Code supports subagents, skills and hooks natively.

## Human approval policy

Human approval is mandatory before implementing any SDD task. Only the developer moves a task from `spec_ready` to `human_approved`, and the approval is recorded in `tasks.json` (`approval.approved_by`, `approval.approved_at`). The agent stops after the spec is written and rendered. If feedback changes the spec, the developer must approve the revised spec again. A task reaches `done` only after these three conditions hold:

- tests pass;
- the reviewer approves;
- documentation is `updated` or `not_required`.

## Hooks policy

No hooks are enabled (see `.claude/hooks/README.md`). The rules here are instruction-level. Do not enable or add hooks without the developer's explicit approval.

## MCP policy

No MCP servers are configured; the project is local-first. Do not configure MCPs without explicit approval. Where a CLI and an MCP could both do a job, prefer the narrow CLI call (`gh` is available). Remote-mutating commands always need per-action permission.

## Git policy

Every git mutation needs explicit permission for that action: branch, commit, push, PR, merge. Never force-push or rewrite history. When a commit is requested, use Conventional Commits **in English** (`feat(car): …`, `fix(police): …`, `docs: …`) and put `Task: MCC-NNN (<slug>)` in the body. Branch names, only when requested, are `feature/MCC-NNN-<slug>` or `fix/MCC-NNN-<slug>`. The default branch is `main`. Details are in the `git-discipline` skill.

## Protected areas

Ask for explicit approval before modifying:

- `src/config.js`: balance values tuned in F8. Balance changes must also update `docs/config.md`.
- `index.html`: especially the `<script>` load order, which encodes dependencies.
- `PLAN.md` (frozen historical plan) and `README.md` (player guide).
- Existing tests in `tests/`. Adding new test files is allowed. Never weaken or delete a test to make the suite pass.

Conventions to preserve:

- One global per `src/` file plus a guarded `module.exports`.
- Systems communicate through `game.on`/`game.emit`.
- A module change also updates its `docs/<module>.md` page and its row in the `docs/README.md` table.

## When SDD may be skipped

Tasks not marked `sdd: true` may skip SDD. Typical examples are small bug fixes, balance tweaks, typos, cosmetic changes, and documentation-only changes. When skipping, say so explicitly. Protected-area approvals, green tests, and doc updates for any changed module still apply.

## Context economy

The context window is a scarce resource. Rules:

- Keep this file short; link to deeper docs instead of duplicating them.
- Long procedures belong in skills, not here.
- Inspect context usage and compact between unrelated tasks with the harness's context commands (`/context` and `/compact [focus]` in Claude Code). Give focus instructions that preserve decisions, task status, architecture constraints, and unresolved questions.
- Delegate noisy, many-file exploration to subagents where available; keep only conclusions in the main conversation.
- Durable truth lives in artifacts (`tasks.json`, `specs/`, decision logs, `history.md`), not in chat history.

## Session recovery

If unsure after resuming a session, a rewind, or a compaction, inspect the durable artifacts before continuing:

- `tasks.json` for task state;
- the active spec for what is approved;
- the latest review for open findings;
- `git status` for actual changes.

When conversation memory and an artifact disagree, the artifact wins.

## Final rule

Prefer a clear spec over a clever implementation. If the spec is ambiguous, ask or revise the spec before coding.

## Functional documents

Functional documents, PRDs, tickets, user stories, or informal feature descriptions are source material.

They are not approved implementation specs.

When a functional document is provided, the agent must first generate an SDD spec under:

specs/<feature-slug>/

Required files:

- requirements.md
- design.md
- tasks.md
- assumptions.md
- open-questions.md
- acceptance-tests.md

The agent must stop after generating the spec and wait for human approval before implementation.

## Harness updates

The SDD harness was installed from the sdd-onboarding-kit. The version, harness layout and file inventory are in `.claude/sdd-kit-manifest.json`. To update the harness when the kit publishes a new version, invoke the `sdd-update` skill.
