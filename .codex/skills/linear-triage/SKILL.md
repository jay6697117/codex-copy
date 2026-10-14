---
name: linear-triage
description: Automated issue triage, root-cause localization, severity labeling, and worktree fix generation connected to Linear team backlogs.
---
# Linear Issue Triage & Fix (`$linear-triage`)

## Workflow Instructions
1. **Fetch & Classify**: Query open Linear issues, reproduce stack traces against the local repository using the `explorer` subagent, and assign priority/component labels.
2. **Spawn Isolated Worktree**: For high-confidence bugs, create a dedicated Git worktree (`wt/linear-<issue-id>`) and delegate the fix + regression test to a `worker` subagent.
3. **Queue for Review**: Deposit the verified diff and Linear comment draft into the Codex Review Queue.
