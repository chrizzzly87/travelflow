# TravelFlow

TravelFlow is a React + TypeScript + Vite app for generating and managing travel itineraries.

## Requirements

- Node.js 18+
- npm

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create your local env file:

```bash
cp .env.example .env.local
```

3. Add your API keys to `.env.local`:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

4. Start the app:

```bash
npm run dev
```

## Routes

- `/` marketing landing page
- `/create-trip` trip creation flow
- `/trip/:tripId` planner
- `/updates` marketing updates feed from markdown release files
- `/admin/dashboard` admin metrics placeholder (future role-gated)

## Supabase Setup And Troubleshooting

For DB-backed trips, history snapshots, sharing, and auth/RLS troubleshooting, use:

- `/Users/chrizzzly/.codex/worktrees/7b0e/travelflow-codex/docs/SUPABASE_RUNBOOK.md`

## Build

```bash
npm run build
```

The production output is generated in `dist/`.

`npm run build` includes release-note validation (`npm run updates:validate`) for `content/updates/*.md`.

Admin dashboard planning scope is documented in `docs/ADMIN_DASHBOARD_PLAN.md`.

## Deploy To Vercel

This repo includes `vercel.json` for Vite + SPA routing.

1. Push this repo to GitHub.
2. In Vercel, import the GitHub repository.
3. In Vercel project settings, add:
   - `VITE_GEMINI_API_KEY`
   - `VITE_GOOGLE_MAPS_API_KEY`
4. Deploy.

## Deploy To Netlify

This repo includes `netlify.toml` for build settings + SPA redirects.

1. Push this repo to GitHub.
2. In Netlify, create a new site from Git.
3. Confirm build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. In Netlify environment variables, add:
   - `VITE_GEMINI_API_KEY`
   - `VITE_GOOGLE_MAPS_API_KEY`
5. Deploy.

## Create The GitHub Repo (CLI)

If GitHub CLI is authenticated, run:

```bash
gh repo create travelflow --source=. --remote=origin --public --push
```

Use `--private` instead of `--public` if you want a private repo.
