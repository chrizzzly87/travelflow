# Worktree + Branch Thread Context

## Current thread context (must verify first)
- Worktree: `/Users/chrizzzly/.codex/worktrees/ff8f/travelflow-codex`
- Branch: `codex/profile-nav-create-trip-cta`

## Required startup check for future chats
Run this before any code changes:

```bash
pwd && git rev-parse --abbrev-ref HEAD && git status --short
```

If path or branch differs from the thread context above, stop and confirm with the user before editing.
