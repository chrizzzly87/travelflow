import type { Config, Context } from "@netlify/edge-functions";

export default async (_req: Request, _context: Context) =>
  new Response("edge-ok", { status: 200, headers: { "content-type": "text/plain" } });

export const config: Config = {
  path: "/api/health",
};
