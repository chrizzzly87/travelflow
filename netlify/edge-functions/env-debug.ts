import type { Context } from "@netlify/edge-functions";

export default async (request: Request, context: Context) => {
  // Check various ways environment variables might be accessed
  const diagnostics = {
    timestamp: new Date().toISOString(),
    deployment_url: context.site?.url || "unknown",

    // Check Deno environment access
    deno_env: {
      VITE_SUPABASE_URL: Deno.env.get("VITE_SUPABASE_URL") || "NOT_FOUND",
      VITE_SUPABASE_ANON_KEY: Deno.env.get("VITE_SUPABASE_ANON_KEY") ? "SET (hidden)" : "NOT_FOUND",
      VITE_GOOGLE_MAPS_API_KEY: Deno.env.get("VITE_GOOGLE_MAPS_API_KEY") ? "SET (hidden)" : "NOT_FOUND",
      GEMINI_API_KEY: Deno.env.get("GEMINI_API_KEY") ? "SET (hidden)" : "NOT_FOUND",
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ? "SET (hidden)" : "NOT_FOUND",
    },

    // Check if process.env exists (shouldn't in Deno)
    has_process_env: typeof (globalThis as any).process !== "undefined",

    // List all available env vars (keys only for security)
    available_env_keys: Array.from(Deno.env.toObject()).map(([key]) => key).sort(),

    // Check specific prefixes
    vite_vars: Array.from(Deno.env.toObject())
      .filter(([key]) => key.startsWith("VITE_"))
      .map(([key]) => key),

    // Netlify-specific context
    netlify_context: {
      geo: context.geo,
      site: context.site,
      deploy: (context as any).deploy,
    },
  };

  return new Response(JSON.stringify(diagnostics, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-cache, no-store, must-revalidate",
    },
  });
};

export const config = {
  path: "/api/debug/env",
};