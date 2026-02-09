/**
 * Minimal self-contained OG meta test for /login.
 * No external imports, no onError bypass — if the Deno runtime works,
 * this will inject OG tags. If it crashes, we'll see the real error.
 */

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export default async (
  request: Request,
  context: { next: () => Promise<Response> }
): Promise<Response> => {
  const baseResponse = await context.next();
  const contentType = baseResponse.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) {
    return baseResponse;
  }

  const html = await baseResponse.text();

  const title = escape("Login | TravelFlow");
  const description = escape(
    "Sign in and continue planning your next trip in TravelFlow."
  );
  const url = new URL(request.url);
  const canonicalUrl = escape(`${url.origin}/login`);
  const ogImageUrl = escape(
    `${url.origin}/api/og/site?title=Login&description=Sign+in+and+continue+planning+your+next+trip+in+TravelFlow.&path=/login`
  );

  const metaTags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${canonicalUrl}" />`,
    `<meta name="robots" content="index,follow,max-image-preview:large" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="TravelFlow" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    `<meta property="og:image" content="${ogImageUrl}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${ogImageUrl}" />`,
  ].join("\n");

  // Strip existing SEO tags and inject new ones
  let cleaned = html;
  cleaned = cleaned.replace(/<title>[\s\S]*?<\/title>/gi, "");
  cleaned = cleaned.replace(/<meta[^>]+property=["']og:[^"']+["'][^>]*>/gi, "");
  cleaned = cleaned.replace(/<meta[^>]+name=["']twitter:[^"']+["'][^>]*>/gi, "");
  cleaned = cleaned.replace(/<meta[^>]+name=["']description["'][^>]*>/gi, "");
  cleaned = cleaned.replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi, "");

  const rewritten = cleaned.replace(/<\/head>/i, `${metaTags}\n</head>`);

  const headers = new Headers(baseResponse.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("x-edge-test", "login-og-active");
  headers.delete("content-length");
  headers.delete("etag");

  return new Response(rewritten, {
    status: baseResponse.status,
    statusText: baseResponse.statusText,
    headers,
  });
};
