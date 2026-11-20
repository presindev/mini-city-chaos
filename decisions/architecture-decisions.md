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

## 2026-11-20 — Vanilla JS globals, no dependencies, no build

- Status: accepted
- Context: recorded at SDD onboarding to capture the existing architecture, which was established during F0–F8.
- Decision: HTML5 Canvas + vanilla JavaScript, loaded by `index.html` in dependency order. Each `src/` file defines one global plus a guarded `module.exports` for the Node tests (`node:test`). Systems communicate through `game.on`/`game.emit`. Tunables live in `CONFIG` (`src/config.js`).
- Alternatives rejected: adding tooling or dependencies (see `rejected-options.md`, 2026-11-20).
- Consequences: new modules follow the same pattern and need a `<script>` tag in `index.html` (protected) and a `docs/<module>.md` page. Introducing a bundler or packages requires an approved spec.
- Source: SDD onboarding; `docs/README.md`; `PLAN.md` F1.
