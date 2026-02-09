import { escapeHtml } from "../edge-lib/trip-og-data.ts";

const SITE_NAME = "TravelFlow";
const DEFAULT_DESCRIPTION = "Plan and share travel routes with timeline and map previews in TravelFlow.";
const SITE_CACHE_CONTROL = "public, max-age=0, s-maxage=900, stale-while-revalidate=86400";

interface Metadata {
  pageTitle: string;
  description: string;
  canonicalUrl: string;
  ogImageUrl: string;
  robots: string;
}

interface PageDefinition {
  title: string;
  description: string;
  robots?: string;
}

const PAGE_META: Record<string, PageDefinition> = {
  "/": {
    title: "TravelFlow",
    description: "Plan smarter trips with timeline + map routing and share them beautifully.",
  },
  "/create-trip": {
    title: "Create Trip",
    description: "Build your itinerary with flexible stops, routes, and timeline planning.",
  },
  "/features": {
    title: "Features",
    description: "See everything TravelFlow offers for planning and sharing better adventures.",
  },
  "/updates": {
    title: "Product Updates",
    description: "Catch the latest TravelFlow improvements and recently shipped features.",
  },
  "/blog": {
    title: "TravelFlow Blog",
    description: "Guides, trip-planning ideas, and practical workflow tips from the TravelFlow team.",
  },
  "/login": {
    title: "Login",
    description: "Sign in and continue planning your next trip in TravelFlow.",
  },
  "/imprint": {
    title: "Imprint",
    description: "Legal and company information for TravelFlow.",
  },
  "/privacy": {
    title: "Privacy Policy",
    description: "Learn how TravelFlow handles personal data and privacy protection.",
  },
  "/terms": {
    title: "Terms of Service",
    description: "Read the terms that govern the use of TravelFlow.",
  },
  "/cookies": {
    title: "Cookie Policy",
    description: "Understand how TravelFlow uses cookies and similar technologies.",
  },
};

const pathToTitle = (pathname: string): string => {
  if (pathname === "/") return SITE_NAME;
  const leaf = pathname.split("/").filter(Boolean).slice(-1)[0] || "Page";
  const words = leaf
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  return words.length > 0 ? words.join(" ") : "Page";
};

const getPageDefinition = (pathname: string): PageDefinition => {
  if (PAGE_META[pathname]) return PAGE_META[pathname];
  if (pathname.startsWith("/admin")) {
    return {
      title: "Admin Dashboard",
      description: "Internal TravelFlow admin workspace.",
      robots: "noindex,nofollow,max-image-preview:large",
    };
  }
  return {
    title: pathToTitle(pathname),
    description: DEFAULT_DESCRIPTION,
  };
};

const stripSeoTags = (html: string): string => {
  const patterns = [
    /<title>[\s\S]*?<\/title>/gi,
    /<meta[^>]+name=["']description["'][^>]*>/gi,
    /<meta[^>]+name=["']robots["'][^>]*>/gi,
    /<meta[^>]+property=["']og:[^"']+["'][^>]*>/gi,
    /<meta[^>]+name=["']twitter:[^"']+["'][^>]*>/gi,
    /<link[^>]+rel=["']canonical["'][^>]*>/gi,
  ];
  return patterns.reduce((acc, regex) => acc.replace(regex, ""), html);
};

const buildMetaTags = (meta: Metadata): string => {
  const title = escapeHtml(meta.pageTitle);
  const description = escapeHtml(meta.description);
  const canonicalUrl = escapeHtml(meta.canonicalUrl);
  const ogImageUrl = escapeHtml(meta.ogImageUrl);
  const robots = escapeHtml(meta.robots);

  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${canonicalUrl}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    `<meta property="og:image" content="${ogImageUrl}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${title}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${ogImageUrl}" />`,
  ].join("\n");
};

const injectMetaTags = (html: string, meta: Metadata): string => {
  if (!/<head[^>]*>/i.test(html) || !/<\/head>/i.test(html)) {
    return html;
  }
  const cleaned = stripSeoTags(html);
  return cleaned.replace(/<\/head>/i, `${buildMetaTags(meta)}\n</head>`);
};

const buildCanonicalSearch = (url: URL): string => {
  const params = new URLSearchParams(url.search);
  params.delete("prefill");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

const buildMetadata = (url: URL): Metadata => {
  const page = getPageDefinition(url.pathname);
  const title = page.title === SITE_NAME ? SITE_NAME : `${page.title} | ${SITE_NAME}`;
  const canonicalSearch = buildCanonicalSearch(url);
  const canonicalUrl = new URL(url.pathname + canonicalSearch, url.origin).toString();
  const ogImage = new URL("/api/og/site", url.origin);
  ogImage.searchParams.set("title", page.title);
  ogImage.searchParams.set("description", page.description);
  ogImage.searchParams.set("path", url.pathname + canonicalSearch);

  return {
    pageTitle: title,
    description: page.description,
    canonicalUrl,
    ogImageUrl: ogImage.toString(),
    robots: page.robots || "index,follow,max-image-preview:large",
  };
};

export default async (request: Request, context: { next: () => Promise<Response> }): Promise<Response> => {
  const url = new URL(request.url);
  const baseResponse = await context.next();
  const fallbackResponse = baseResponse.clone();
  const contentType = baseResponse.headers.get("content-type") || "";

  if (url.pathname.startsWith("/api/og/") || url.pathname.startsWith("/s/") || url.pathname.startsWith("/trip/")) {
    return baseResponse;
  }

  if (!contentType.includes("text/html")) {
    return baseResponse;
  }

  try {
    const metadata = buildMetadata(url);
    const html = await baseResponse.text();
    const rewrittenHtml = injectMetaTags(html, metadata);
    const headers = new Headers(baseResponse.headers);
    headers.set("content-type", "text/html; charset=utf-8");
    headers.set("cache-control", SITE_CACHE_CONTROL);
    headers.delete("content-length");
    headers.delete("etag");

    return new Response(rewrittenHtml, {
      status: baseResponse.status,
      statusText: baseResponse.statusText,
      headers,
    });
  } catch {
    return fallbackResponse;
  }
};
