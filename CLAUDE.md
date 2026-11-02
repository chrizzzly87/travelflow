@AGENTS.md

## Claude Code notes
- Run long commands in the background or with a timeout that fits them:
  - `pnpm test:core` takes about 1.5 min;
  - `pnpm typecheck` takes about 1 min;
  - `pnpm ci:local` takes 3–4 min (`--fast` about 70 s);
  - a GitHub PR Quality run takes about 5–6 min (checks and build run in parallel; docs-only PRs skip it).
- Prefix Node commands with Node 22 when the shell default differs (for example `~/.nvm/versions/node/v22.20.0/bin`).
- Use the preview tooling (`.claude/launch.json`) for the dev server, not Bash.
- The dev server serves the client-only shell for many routes. Check server rendering with `curl` against a production build (`node scripts/serve-built-site.mjs`) or a deploy preview.
