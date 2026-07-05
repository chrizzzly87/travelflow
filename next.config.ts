import type { NextConfig } from 'next';

// Embeds content/blog + content/updates markdown as generated TS modules
// (replaces Vite's import.meta.glob). Runs at config load for dev and build.
import './scripts/generate-content-modules.mjs';

// The Netlify deployment env still uses VITE_-prefixed names for browser
// values (edge functions read them too). Map them onto the NEXT_PUBLIC_ names
// the app code uses so no deployment env change is required. Follow-up issue
// tracks renaming the deployment env and dropping this mapping.
const publicEnvFromVite = (viteKey: string, nextKey: string): Record<string, string> => {
    const value = process.env[nextKey] ?? process.env[viteKey];
    return value === undefined ? {} : { [nextKey]: value };
};

const nextConfig: NextConfig = {
    turbopack: {
        root: __dirname,
    },
    // This worktree lives inside the main checkout (parent lockfiles above),
    // so Next would infer the wrong workspace root — that nests the traced
    // server bundle under dev/travelflow/.claude/... and the Netlify Next
    // runtime then 404s every route.
    outputFileTracingRoot: __dirname,
    env: {
        ...publicEnvFromVite('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'),
        ...publicEnvFromVite('VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
        ...publicEnvFromVite('VITE_GOOGLE_MAPS_API_KEY', 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'),
        ...publicEnvFromVite('VITE_MAPBOX_ACCESS_TOKEN', 'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN'),
        ...publicEnvFromVite('VITE_MAP_RUNTIME_PRESET', 'NEXT_PUBLIC_MAP_RUNTIME_PRESET'),
        ...publicEnvFromVite('VITE_PADDLE_CLIENT_TOKEN', 'NEXT_PUBLIC_PADDLE_CLIENT_TOKEN'),
        ...publicEnvFromVite('VITE_UMAMI_SCRIPT_URL', 'NEXT_PUBLIC_UMAMI_SCRIPT_URL'),
        ...publicEnvFromVite('VITE_UMAMI_WEBSITE_ID', 'NEXT_PUBLIC_UMAMI_WEBSITE_ID'),
        ...publicEnvFromVite('VITE_APP_VERSION', 'NEXT_PUBLIC_APP_VERSION'),
        ...publicEnvFromVite('VITE_SITE_URL', 'NEXT_PUBLIC_SITE_URL'),
        ...publicEnvFromVite('VITE_DEV_ADMIN_BYPASS', 'NEXT_PUBLIC_DEV_ADMIN_BYPASS'),
        ...publicEnvFromVite('VITE_DEBUG_DB', 'NEXT_PUBLIC_DEBUG_DB'),
        ...publicEnvFromVite('VITE_E2E_AUTH_SANDBOX', 'NEXT_PUBLIC_E2E_AUTH_SANDBOX'),
        ...publicEnvFromVite('VITE_NAV_PREFETCH_ENABLED', 'NEXT_PUBLIC_NAV_PREFETCH_ENABLED'),
        ...publicEnvFromVite('VITE_PREFETCH_DEBUG', 'NEXT_PUBLIC_PREFETCH_DEBUG'),
        ...publicEnvFromVite('VITE_SPECULATION_RULES_ENABLED', 'NEXT_PUBLIC_SPECULATION_RULES_ENABLED'),
    },
    // Gates run separately: tsc via `pnpm typecheck` (follow-up issue #425
    // tracks strict mode + eslint-config-next).
    typescript: {
        ignoreBuildErrors: true,
    },
    async rewrites() {
        if (process.env.NODE_ENV !== 'development') return [];
        // Dev-only proxy to `netlify dev` (edge functions) — mirrors the old
        // vite.config server.proxy entries.
        const netlifyDev = 'http://localhost:8888';
        return [
            '/api/internal/ai/generation-worker',
            '/api/internal/admin/iam',
            '/api/internal/admin/audit/replay-export',
            '/api/billing/paddle/checkout',
            '/api/billing/paddle/webhook',
            '/api/trip-map-preview',
        ].map((path) => ({ source: path, destination: `${netlifyDev}${path}` }));
    },
};

export default nextConfig;
