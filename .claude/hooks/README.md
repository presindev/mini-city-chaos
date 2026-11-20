# Project hooks

This directory documents the project-specific hooks of the SDD harness for Claude Code.

Hooks are enabled from the harness's wiring file (`.claude/settings.json`, `"hooks"` key), not by placing scripts here automatically. The scripts are harness-neutral (see the adapter block at the top of each one); only the wiring is harness-specific.

## Enabled hooks

None. Hooks were left disabled at onboarding (2026-11-20, recommended defaults profile: "recommend but do not enable without approval"). SDD rules are enforced at instruction level (`AGENTS.md` + the `sdd-workflow` skill).

## Available hook scripts

None copied. The kit's examples (block implementation before approval, run tests after edit, protected-file guard, destructive-command guard, task-state validation, spec drift, pre-compact capture) can be installed later from https://github.com/Sapere-IA/sdd-onboarding-kit (`hooks/examples/`, wiring in `hooks/settings-snippets.md`). `bash` and `jq` are available on the developer's machine.

## Policy

- Do not enable new hooks without developer approval.
- Prefer warning mode before blocking mode unless the developer approved strict enforcement.
- Keep hook scripts small and deterministic.
- Document every hook's purpose and failure mode.
- Keep the adapter block identical across scripts; put project logic below it.
