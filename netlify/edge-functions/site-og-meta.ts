import { escapeHtml } from "../edge-lib/trip-og-data.ts";

const SITE_NAME = "TravelFlow";
const DEFAULT_DESCRIPTION = "Plan and share travel routes with timeline and map previews in TravelFlow.";
const SITE_CACHE_CONTROL = "public, max-age=0, s-maxage=900, stale-while-revalidate=86400";

interface Metadata {
  pageTitle: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  canonicalUrl: string;
  ogImageUrl: string;
  robots: string;
}

interface PageDefinition {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  robots?: string;
  pill?: string;
}

const PAGE_META: Record<string, PageDefinition> = {
  "/": {
    title: "TravelFlow",
    description: "Plan smarter trips with timeline + map routing and share them beautifully.",
    pill: "TRAVELFLOW",
  },
  "/create-trip": {
    title: "Create Trip",
    description: "Build your itinerary with flexible stops, routes, and timeline planning.",
    pill: "TRIP PLANNER",
  },
  "/features": {
    title: "Features",
    description: "See everything TravelFlow offers for planning and sharing better adventures.",
    pill: "FEATURES",
  },
  "/updates": {
    title: "Product Updates",
    description: "Catch the latest TravelFlow improvements and recently shipped features.",
    pill: "PRODUCT UPDATES",
  },
  "/blog": {
    title: "TravelFlow Blog",
    description: "Guides, trip-planning ideas, and practical workflow tips from the TravelFlow team.",
    pill: "BLOG",
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
  "/inspirations": {
    title: "Where Will You Go Next?",
    description: "Browse curated trip ideas by theme, month, country, or upcoming festivals.",
    pill: "TRIP INSPIRATIONS",
  },
  "/inspirations/themes": {
    title: "Travel by Theme",
    description: "Find curated trip ideas that match your travel style — adventure, food, photography, and more.",
    pill: "TRIP INSPIRATIONS",
  },
  "/inspirations/best-time-to-travel": {
    title: "When to Go Where",
    description: "Month-by-month guide to the best time to visit destinations around the world.",
    pill: "TRIP INSPIRATIONS",
  },
  "/inspirations/countries": {
    title: "Explore by Country",
    description: "Country-specific travel guides with best-month picks, top cities, and local tips.",
    pill: "TRIP INSPIRATIONS",
  },
  "/inspirations/events-and-festivals": {
    title: "Plan Around a Festival",
    description: "Discover upcoming festivals and build your itinerary around the event.",
    pill: "TRIP INSPIRATIONS",
  },
  "/inspirations/weekend-getaways": {
    title: "Quick Escapes for Busy Travelers",
    description: "2–3 day getaway ideas for spontaneous adventurers — pack light and make the most of a long weekend.",
    pill: "TRIP INSPIRATIONS",
  },
  "/pricing": {
    title: "Simple, Transparent Pricing",
    description: "Start for free and upgrade when you need more. No hidden fees, cancel anytime.",
    pill: "PRICING",
  },
};

interface BlogMeta {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
}

const BLOG_META: Record<string, BlogMeta> = {
  "best-time-visit-japan": {
    title: "The Best Time to Visit Japan — A Month-by-Month Guide",
    description: "Japan transforms with every season. From cherry blossoms to powder snow, here's when to go.",
    ogTitle: "Best Time to Visit Japan — Month by Month",
    ogDescription: "Cherry blossoms in spring, festivals in summer, fiery foliage in autumn, powder snow in winter — find the perfect month for your Japan trip with seasonal highlights and travel tips.",
  },
  "budget-travel-europe": {
    title: "Budget Travel Hacks for Europe",
    description: "Smart timing, local habits, and a few practical tricks can cut your Europe costs in half.",
    ogDescription: "Smart timing, local transport passes, affordable stays, and a few practical habits that can cut your Europe trip costs in half without sacrificing the experience.",
  },
  "festival-travel-guide": {
    title: "How to Plan a Trip Around a Festival",
    description: "Festival-centered trips are some of the most memorable journeys. Here's how to plan one.",
    ogDescription: "From picking the right event to booking accommodation early and building a flexible itinerary — a step-by-step guide to festival-centered travel planning.",
  },
  "how-to-plan-multi-city-trip": {
    title: "How to Plan the Perfect Multi-City Trip",
    description: "Practical advice on route planning, timing, and logistics for multi-destination travel.",
    ogDescription: "Route sequencing, realistic day counts, transport links between stops, and packing strategies — practical advice for planning a smooth multi-destination itinerary.",
  },
  "weekend-getaway-tips": {
    title: "Weekend Getaway Planning: From Idea to Boarding Pass",
    description: "How to squeeze the most out of a 2–3 day trip without the stress.",
    ogTitle: "Weekend Getaway Planning Made Simple",
    ogDescription: "Pick a destination, book fast, pack light, and make every hour count — a concise guide to squeezing the most out of a 2–3 day trip without the planning stress.",
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

  // /blog/:slug — look up static blog meta or fall back to pathToTitle
  const blogMatch = pathname.match(/^\/blog\/([^/]+)\/?$/);
  if (blogMatch) {
    const slug = blogMatch[1];
    const blog = BLOG_META[slug];
    return {
      title: blog ? blog.title : pathToTitle(pathname),
      description: blog ? blog.description : "Read this article on the TravelFlow blog.",
      ogTitle: blog?.ogTitle,
      ogDescription: blog?.ogDescription,
      pill: "BLOG",
    };
  }

  // /inspirations/country/:countryName
  const countryMatch = pathname.match(/^\/inspirations\/country\/([^/]+)\/?$/);
  if (countryMatch) {
    const country = decodeURIComponent(countryMatch[1])
      .split(/[-_]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    return {
      title: `Travel to ${country}`,
      description: `Plan your trip to ${country} — best months, itineraries, and tips.`,
      pill: "TRIP INSPIRATIONS",
    };
  }

  // /inspirations/* catch-all
  if (pathname.startsWith("/inspirations")) {
    return {
      title: pathToTitle(pathname),
      description: "Explore curated trip ideas and travel inspiration on TravelFlow.",
      pill: "TRIP INSPIRATIONS",
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
  const ogTitle = escapeHtml(meta.ogTitle);
  const ogDescription = escapeHtml(meta.ogDescription);
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
    `<meta property="og:title" content="${ogTitle}" />`,
    `<meta property="og:description" content="${ogDescription}" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    `<meta property="og:image" content="${ogImageUrl}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${ogTitle}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${ogTitle}" />`,
    `<meta name="twitter:description" content="${ogDescription}" />`,
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

  // OG values: use overrides if provided, fall back to page values
  const ogTitleRaw = page.ogTitle || page.title;
  const ogDescriptionRaw = page.ogDescription || page.description;
  const ogTitleFull = ogTitleRaw === SITE_NAME ? SITE_NAME : `${ogTitleRaw} | ${SITE_NAME}`;

  const ogImage = new URL("/api/og/site", url.origin);
  ogImage.searchParams.set("title", ogTitleRaw);
  ogImage.searchParams.set("description", ogDescriptionRaw);
  ogImage.searchParams.set("path", url.pathname + canonicalSearch);
  if (page.pill) {
    ogImage.searchParams.set("pill", page.pill);
  }

  return {
    pageTitle: title,
    description: page.description,
    ogTitle: ogTitleFull,
    ogDescription: ogDescriptionRaw,
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
