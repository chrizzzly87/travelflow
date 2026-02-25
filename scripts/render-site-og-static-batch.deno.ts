import siteOgImage from "../netlify/edge-functions/site-og-image.tsx";
import { dirname, fromFileUrl, join, normalize } from "https://deno.land/std@0.224.0/path/mod.ts";

interface SiteOgStaticRenderTask {
  routeKey: string;
  outputPath: string;
  query: Record<string, string>;
}

interface SiteOgStaticRenderBatchPayload {
  tasks: SiteOgStaticRenderTask[];
  concurrency?: number;
  logEvery?: number;
}

const getContentType = (filePath: string): string => {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".woff2")) return "font/woff2";
  if (lower.endsWith(".woff")) return "font/woff";
  if (lower.endsWith(".ttf")) return "font/ttf";
  if (lower.endsWith(".otf")) return "font/otf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".json")) return "application/json";
  return "application/octet-stream";
};

const normalizePublicRequestPath = (pathname: string): string | null => {
  if (!pathname.startsWith("/")) return null;
  const cleaned = normalize(pathname);
  if (!cleaned.startsWith("/") || cleaned.includes("..")) return null;
  return cleaned;
};

const readBatchPayload = async (payloadPath: string): Promise<SiteOgStaticRenderBatchPayload> => {
  const raw = await Deno.readTextFile(payloadPath);
  const parsed = JSON.parse(raw) as SiteOgStaticRenderBatchPayload;

  if (!Array.isArray(parsed.tasks)) {
    throw new Error("Invalid batch payload: tasks must be an array.");
  }

  for (const task of parsed.tasks) {
    if (!task || typeof task !== "object") {
      throw new Error("Invalid task entry in batch payload.");
    }
    if (typeof task.routeKey !== "string" || !task.routeKey.trim()) {
      throw new Error("Invalid task.routeKey in batch payload.");
    }
    if (typeof task.outputPath !== "string" || !task.outputPath.trim()) {
      throw new Error("Invalid task.outputPath in batch payload.");
    }
    if (!task.query || typeof task.query !== "object") {
      throw new Error(`Invalid task.query for routeKey ${task.routeKey}.`);
    }
  }

  return parsed;
};

const buildRequestUrl = (origin: string, query: Record<string, string>): string => {
  const url = new URL("/api/og/site", origin);

  const keys = Object.keys(query).sort((left, right) => left.localeCompare(right));
  for (const key of keys) {
    const value = query[key];
    if (!value) continue;
    url.searchParams.set(key, value);
  }

  return url.toString();
};

const run = async (): Promise<void> => {
  const payloadPath = Deno.args[0];
  if (!payloadPath) {
    throw new Error("Missing batch payload path.");
  }

  const payload = await readBatchPayload(payloadPath);
  const tasks = payload.tasks;

  if (tasks.length === 0) {
    console.log("[site-og-static:deno] no render tasks");
    return;
  }

  const scriptDir = dirname(fromFileUrl(import.meta.url));
  const projectRoot = normalize(join(scriptDir, ".."));
  const publicRoot = normalize(join(projectRoot, "public"));
  const abortController = new AbortController();

  const server = Deno.serve({
    hostname: "127.0.0.1",
    port: 0,
    signal: abortController.signal,
    onListen: () => {},
  }, async (request) => {
    const requestUrl = new URL(request.url);
    const normalizedPath = normalizePublicRequestPath(requestUrl.pathname);
    if (!normalizedPath) return new Response("Not Found", { status: 404 });

    const absolutePath = normalize(join(publicRoot, normalizedPath.replace(/^\//, "")));
    if (!absolutePath.startsWith(publicRoot)) {
      return new Response("Not Found", { status: 404 });
    }

    try {
      const file = await Deno.readFile(absolutePath);
      return new Response(file, {
        status: 200,
        headers: {
          "content-type": getContentType(absolutePath),
          "cache-control": "no-store",
        },
      });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  });
  const serverAddress = server.addr as Deno.NetAddr;
  const origin = `http://${serverAddress.hostname}:${serverAddress.port}`;

  const concurrency = Math.max(1, Math.min(12, payload.concurrency ?? 6));
  const logEvery = Math.max(1, payload.logEvery ?? 100);

  let cursor = 0;
  let done = 0;

  const renderOne = async (task: SiteOgStaticRenderTask): Promise<void> => {
    const requestUrl = buildRequestUrl(origin, task.query);
    const response = await siteOgImage(new Request(requestUrl));
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Render failed for ${task.routeKey} (status=${response.status}): ${body.slice(0, 320)}`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    await Deno.writeFile(task.outputPath, bytes);
  };

  const worker = async (): Promise<void> => {
    for (;;) {
      if (cursor >= tasks.length) return;
      const index = cursor;
      cursor += 1;
      const task = tasks[index];

      await renderOne(task);
      done += 1;

      if (done % logEvery === 0 || done === tasks.length) {
        console.log(`[site-og-static:deno] progress rendered=${done}/${tasks.length}`);
      }
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  } finally {
    abortController.abort();
    await server.finished;
  }
};

await run();
