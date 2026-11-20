# Workflow decisions

Durable workflow rules agreed with the developer ("from now on, X"). This
file records the decision and its context; rules that every session needs
loaded should additionally be promoted to a one-line `AGENTS.md` rule (see
`.claude/reference/memory-policy.md`).

Rules:

- Append new entries below the marker, newest first.
- Log only agreed, durable rules — not one-off instructions for a single task.
- Never log secrets, credentials, or sensitive operational data.
- When a rule replaces an earlier one, mark the old entry
  `Status: superseded by <date — title>` instead of deleting it.
- Propose entries to the developer before writing them.

Entry format:

```markdown
## <YYYY-MM-DD> — <short rule title>

- Status: accepted
- Rule: <the agreed way of working>
- Context: <what prompted the rule>
- Applies to: <where the rule holds, and any exceptions>
- Source: <task/spec/review, or a summarized conversation>
```

---

## 2026-11-20 — PLAN.md frozen; new work tracked in tasks.json

- Status: accepted
- Rule: `PLAN.md` (F0–F8, all done) is a frozen historical record. New work is created only as `MCC-NNN` tasks in `tasks.json`, with specs under `specs/<slug>/` for `sdd: true` tasks. Completed work goes to `history.md`.
- Context: SDD onboarding of a repo whose original plan was already complete.
- Applies to: all new features, fixes and balance work. Editing `PLAN.md` requires explicit approval (protected file).
- Source: SDD onboarding conversation, recorded in `decisions/answers.md`.

## 2026-11-20 — SDD only for tasks marked sdd: true

- Status: accepted
- Rule: the full SDD flow (spec, human approval, implementation, review, docs) applies only to tasks marked `"sdd": true`. Other tasks (small fixes, balance tweaks, typos, docs-only) skip it explicitly. Protected-area approvals and green tests still apply.
- Context: small solo game project; the developer wants SDD where it adds value.
- Applies to: every task in `tasks.json`.
- Source: SDD onboarding conversation, recorded in `decisions/answers.md`.
