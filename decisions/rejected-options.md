# Rejected options

Designs, tools, and approaches this project considered and rejected.
Recording them prevents future sessions from re-litigating settled
questions ("why don't we just use X?" — because we tried, and here is why
not).

Rules:

- Append new entries below the marker, newest first.
- Log only options that were seriously considered and meaningfully rejected.
- Never log secrets, credentials, or sensitive operational data.
- If the conditions that caused the rejection change, add a new entry that
  reopens or reverses the question; do not delete the old one.
- Propose entries to the developer before writing them.

Entry format:

```markdown
## <YYYY-MM-DD> — <option that was rejected>

- Rejected in favor of: <the chosen approach; link the architecture/workflow entry if one exists>
- Reason: <why it lost>
- Revisit when: <conditions that would reopen the question, or "unlikely">
- Source: <task/spec/review>
```

---

## 2026-11-20 — Adding ESLint/Prettier (package.json + dependencies)

- Rejected in favor of: keeping the project dependency-free. Tests run with `node --test tests/`; there is no lint, typecheck or format step, and `scripts/run-lint.sh` no-ops.
- Reason: it would break the "no dependencies, no install, no build" philosophy of the game.
- Revisit when: the codebase grows enough that lint/format errors become a recurring review finding.
- Source: SDD onboarding conversation (commands question).

## 2026-11-20 — Playwright browser-tester subagent

- Rejected in favor of: Node tests plus the manual in-browser checklist in the `run-and-verify` skill.
- Reason: not needed for now; the developer verifies the UI by playing the game.
- Revisit when: UI regressions slip past manual checks, or automated visual verification becomes valuable.
- Source: SDD onboarding conversation (questions.md §18).
