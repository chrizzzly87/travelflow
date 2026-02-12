import React from "https://esm.sh/react@18.3.1";
import { ImageResponse } from "https://deno.land/x/og_edge/mod.ts";
import { APP_NAME } from "../../config/appGlobals.ts";

const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;
const SITE_NAME = APP_NAME;
const HEADLINE_FONT_FAMILY = "Bricolage Grotesque";
const LOCAL_HEADLINE_FONT_PATH =
  "/fonts/bricolage-grotesque/bricolage-grotesque-latin.woff2";
const LOCAL_SPACE_FONT_PATH =
  "/fonts/space-grotesk/space-grotesk-latin.woff2";
const LEGACY_HEADLINE_FONT_URL =
  "https://unpkg.com/@fontsource/space-grotesk@5.0.18/files/space-grotesk-latin-700-normal.woff";

const DEFAULT_TITLE = APP_NAME;
const DEFAULT_SUBLINE = "Plan and share travel routes with timeline and map previews.";

// Keep OG visuals aligned with global app accent tokens.
const ACCENT_200 = "#c7d2fe";
const ACCENT_500 = "#6366f1";
const ACCENT_600 = "#4f46e5";
const ACCENT_700 = "#4338ca";

const headingFontPromiseByOrigin = new Map<string, Promise<ArrayBuffer | null>>();

const fetchFontArrayBuffer = async (fontUrl: string): Promise<ArrayBuffer | null> => {
  try {
    const response = await fetch(fontUrl);
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
};

const buildHeadingFontUrls = (requestUrl: URL): string[] => [
  new URL(LOCAL_HEADLINE_FONT_PATH, requestUrl.origin).toString(),
  new URL(LOCAL_SPACE_FONT_PATH, requestUrl.origin).toString(),
  LEGACY_HEADLINE_FONT_URL,
];

const loadHeadingFont = async (requestUrl: URL): Promise<ArrayBuffer | null> => {
  const cacheKey = requestUrl.origin;
  let fontPromise = headingFontPromiseByOrigin.get(cacheKey);

  if (!fontPromise) {
    fontPromise = (async () => {
      for (const fontUrl of buildHeadingFontUrls(requestUrl)) {
        const fontData = await fetchFontArrayBuffer(fontUrl);
        if (fontData) return fontData;
      }
      return null;
    })();
    headingFontPromiseByOrigin.set(cacheKey, fontPromise);
  }

  return fontPromise;
};

const sanitizeText = (value: string | null, max: number): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}...` : trimmed;
};

const getSearchParam = (url: URL, key: string): string | null => {
  return url.searchParams.get(key) ?? url.searchParams.get(`amp;${key}`);
};

const normalizePath = (value: string | null): string => {
  if (!value) return "/";
  const trimmed = value.trim();
  if (!trimmed) return "/";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      return url.pathname + (url.search || "");
    } catch {
      return "/";
    }
  }
  if (trimmed.startsWith("/")) return trimmed;
  return `/${trimmed}`;
};

const BLOG_IMAGE_PATH_REGEX = /^\/images\/blog\/[a-z0-9-]+-og-vertical\.(png|jpe?g)$/;

const normalizeBlogImagePath = (value: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!BLOG_IMAGE_PATH_REGEX.test(trimmed)) return null;
  return trimmed;
};

const normalizeHexColor = (value: string | null, fallback: string): string => {
  if (!value) return fallback;
  const trimmed = value.trim();
  const match = trimmed.match(/^#([0-9a-fA-F]{6})$/);
  return match ? `#${match[1].toLowerCase()}` : fallback;
};

const normalizeOptionalHexColor = (value: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^#([0-9a-fA-F]{6})$/);
  return match ? `#${match[1].toLowerCase()}` : null;
};

const normalizeTintIntensity = (value: string | null, fallback = 60): number => {
  if (!value) return fallback;
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, parsed));
};

const hexToRgba = (hex: string, alpha: number): string => {
  const safeHex = normalizeHexColor(hex, ACCENT_600);
  const clean = safeHex.slice(1);
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const truncateText = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max - 1)}...` : value;

const splitWord = (word: string, maxChars: number): string[] => {
  if (word.length <= maxChars) return [word];
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < word.length) {
    const remaining = word.length - cursor;
    const chunkSize = Math.min(remaining, remaining > maxChars ? maxChars - 1 : maxChars);
    const chunk = word.slice(cursor, cursor + chunkSize);
    cursor += chunkSize;
    chunks.push(cursor < word.length ? `${chunk}-` : chunk);
  }
  return chunks;
};

const wrapTitle = (value: string, maxChars: number, maxLines: number): string[] => {
  const words = value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .flatMap((word) => splitWord(word, maxChars));

  if (words.length === 0) return [value];

  const lines: string[] = [];
  let current = "";
  let index = 0;

  while (index < words.length) {
    const token = words[index];
    const candidate = current ? `${current} ${token}` : token;

    if (candidate.length <= maxChars) {
      current = candidate;
      index += 1;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
      if (lines.length >= maxLines) break;
      continue;
    }

    lines.push(token);
    index += 1;
    if (lines.length >= maxLines) break;
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  const hasOverflow = index < words.length;
  if (hasOverflow && lines.length > 0) {
    const lastIndex = lines.length - 1;
    const raw = lines[lastIndex].replace(/…+$/g, "");
    const clipped = raw.length >= maxChars ? raw.slice(0, Math.max(1, maxChars - 1)) : raw;
    lines[lastIndex] = `${clipped}…`;
  }

  return lines;
};

const getSiteTitleSpec = (title: string): { lines: string[]; fontSize: number } => {
  const length = title.length;

  let fontSize = 70;
  let maxCharsPerLine = 17;

  if (length > 30) { fontSize = 58; maxCharsPerLine = 22; }
  if (length > 44) { fontSize = 48; maxCharsPerLine = 27; }
  if (length > 62) { fontSize = 42; maxCharsPerLine = 31; }
  if (length > 84) { fontSize = 36; maxCharsPerLine = 35; }

  return {
    lines: wrapTitle(title, maxCharsPerLine, 3),
    fontSize,
  };
};

const svgToDataUri = (svg: string): string => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const PLANE_GLYPH_PATH =
  "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z";

const FOOTER_PLANE_ICON_URI = svgToDataUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='#ffffff' d='${PLANE_GLYPH_PATH}'/><path fill='none' stroke='rgba(255,255,255,0.42)' stroke-width='0.75' d='${PLANE_GLYPH_PATH}'/></svg>`,
);

const TOPO_CONTOUR_OVERLAY_URI = svgToDataUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 520 630' preserveAspectRatio='none'>
    <g fill='none' stroke-linecap='round' stroke-linejoin='round'>
      <path d='M-72 72C0 20 82 18 152 56c74 40 152 44 238 8 84-36 146-34 228 2' stroke='rgba(255,255,255,0.26)' stroke-width='1.2'/>
      <path d='M-72 118C8 62 92 62 170 98c78 36 160 38 246 2 84-36 150-36 230-2' stroke='rgba(255,255,255,0.22)' stroke-width='1.1'/>
      <path d='M-72 168C10 112 96 114 178 148c80 34 166 34 256-4 86-36 154-38 234 0' stroke='rgba(255,255,255,0.24)' stroke-width='1.1'/>
      <path d='M-72 216c84-56 174-58 260-20 86 38 174 38 262 0 84-36 148-36 228-6' stroke='rgba(255,255,255,0.2)' stroke-width='1'/>
      <path d='M-72 270c90-62 188-62 280-18 88 42 176 40 262-4 82-42 146-44 226-8' stroke='rgba(255,255,255,0.2)' stroke-width='1'/>
      <path d='M-72 324c94-64 196-64 292-18 94 46 184 42 270-10 80-48 144-52 222-14' stroke='rgba(255,255,255,0.2)' stroke-width='1'/>
      <path d='M-72 382c98-66 202-66 302-16 98 50 188 44 272-12 76-50 140-56 218-18' stroke='rgba(255,255,255,0.19)' stroke-width='1'/>
      <path d='M-72 442c102-68 210-70 312-18 100 52 192 46 274-12 74-52 138-60 216-22' stroke='rgba(255,255,255,0.19)' stroke-width='1'/>
      <path d='M-72 506c106-74 218-76 324-22 100 52 192 44 274-18 70-54 134-62 212-28' stroke='rgba(255,255,255,0.18)' stroke-width='1'/>
      <path d='M-72 568c112-80 232-84 344-28 104 52 196 42 276-26 66-56 128-68 206-36' stroke='rgba(255,255,255,0.16)' stroke-width='1'/>
    </g>
    <g fill='none' stroke-linecap='round' stroke-linejoin='round' stroke='rgba(199,210,254,0.34)'>
      <path d='M28 86c38-36 92-38 136-4 42 32 94 34 144 0 50-34 110-34 152-2' stroke-width='1.2'/>
      <path d='M56 266c44-38 100-40 146-4 46 36 102 36 154 0 48-34 106-34 146-2' stroke-width='1.1'/>
      <path d='M74 454c48-42 108-44 156-6 50 38 108 38 160-2 50-38 108-40 148-8' stroke-width='1.1'/>
    </g>
  </svg>`,
);

export default async (request: Request): Promise<Response> => {
  try {
    const url = new URL(request.url);
    const headingFontData = await loadHeadingFont(url);

    const title = sanitizeText(getSearchParam(url, "title"), 110) || DEFAULT_TITLE;
    const subline = sanitizeText(getSearchParam(url, "description"), 160) || DEFAULT_SUBLINE;
    const pillText = sanitizeText(getSearchParam(url, "pill"), 30) || SITE_NAME;
    const pagePath = normalizePath(getSearchParam(url, "path"));
    const displayUrl = truncateText(`${url.host}${pagePath}`, 62);
    const blogImagePath = normalizeBlogImagePath(getSearchParam(url, "blog_image"));
    const blogTint = normalizeOptionalHexColor(getSearchParam(url, "blog_tint"));
    const blogTintIntensity = normalizeTintIntensity(getSearchParam(url, "blog_tint_intensity"), 60);
    const blogImageUrl = blogImagePath ? new URL(blogImagePath, url.origin).toString() : null;
    const blogTintStrength = blogTintIntensity / 100;
    const hasTint = Boolean(blogTint) && blogTintStrength > 0.001;
    const blogTintGradient = hasTint && blogTint
      ? `linear-gradient(180deg, ${hexToRgba(blogTint, 0)} 0%, ${hexToRgba(blogTint, 0.24 * blogTintStrength)} 48%, ${hexToRgba(blogTint, 0.72 * blogTintStrength)} 100%)`
      : null;

    const { lines: titleLines, fontSize: titleFontSize } = getSiteTitleSpec(title);

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            padding: 28,
            color: "#0f172a",
            background:
              "linear-gradient(165deg, #f8fafc 0%, #eef2ff 62%, #e0e7ff 100%)",
          }}
        >
          <div
            style={{
              width: "67%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              borderRadius: 28,
              padding: "38px 42px 34px",
              background: "rgba(255, 255, 255, 0.88)",
              border: "1px solid rgba(148, 163, 184, 0.28)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                alignSelf: "flex-start",
                padding: "10px 18px",
                borderRadius: 9999,
                background: ACCENT_600,
                color: "#ffffff",
                fontSize: 20,
                fontWeight: 700,
                fontFamily: `"${HEADLINE_FONT_FAMILY}", "Avenir Next", "Segoe UI", sans-serif`,
              }}
            >
              <img src={FOOTER_PLANE_ICON_URI} alt="" style={{ width: 16, height: 16, display: "flex" }} />
              {pillText}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                marginTop: 18,
                fontSize: titleFontSize,
                lineHeight: 1.08,
                letterSpacing: -1.8,
                fontWeight: 800,
                textWrap: "pretty",
                color: "#0f172a",
                fontFamily: `"${HEADLINE_FONT_FAMILY}", "Avenir Next", "Segoe UI", sans-serif`,
              }}
            >
              {titleLines.map((line, i) => (
                <div key={`title-${i}`} style={{ display: "flex" }}>
                  {line}
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 16,
                fontSize: 30,
                lineHeight: 1.25,
                color: "#334155",
                textWrap: "pretty",
              }}
            >
              {subline}
            </div>

            <div
              style={{
                marginTop: "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderTop: "1px solid rgba(148, 163, 184, 0.36)",
                paddingTop: 20,
                gap: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: ACCENT_600,
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img src={FOOTER_PLANE_ICON_URI} alt={`${SITE_NAME} icon`} style={{ width: 18, height: 18 }} />
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: "#111827",
                    display: "flex",
                    fontFamily: `"${HEADLINE_FONT_FAMILY}", "Avenir Next", "Segoe UI", sans-serif`,
                  }}
                >
                  {SITE_NAME}
                </div>
              </div>

              <div
                style={{
                  fontSize: 20,
                  color: "#475569",
                  display: "flex",
                  minWidth: 0,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                {displayUrl}
              </div>
            </div>
          </div>

          <div
            style={{
              width: "33%",
              height: "100%",
              paddingLeft: 20,
              display: "flex",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                position: "relative",
                borderRadius: 28,
                overflow: "hidden",
                border: "1px solid rgba(148, 163, 184, 0.35)",
                background: blogImageUrl
                  ? "#0f172a"
                  : `radial-gradient(circle at 36% 26%, ${ACCENT_200} 0%, rgba(199,210,254,0.2) 22%, transparent 54%), radial-gradient(circle at 72% 76%, rgba(99,102,241,0.36), transparent 56%), linear-gradient(145deg, ${ACCENT_500} 0%, ${ACCENT_600} 48%, ${ACCENT_700} 100%)`,
                boxShadow: "inset 0 0 120px rgba(15,23,42,0.18)",
              }}
            >
              {blogImageUrl
                ? (
                  <>
                    <img
                      src={blogImageUrl}
                      alt="Blog social preview"
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        objectFit: "cover",
                        opacity: 1,
                      }}
                    />
                    {blogTintGradient
                      ? (
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            right: 0,
                            bottom: 0,
                            left: 0,
                            display: "flex",
                            background: blogTintGradient,
                          }}
                        />
                      )
                      : null}
                  </>
                )
                : (
                  <img
                    src={TOPO_CONTOUR_OVERLAY_URI}
                    alt="Topographic contours"
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      objectFit: "cover",
                      opacity: 0.72,
                    }}
                  />
                )}
            </div>
          </div>
        </div>
      ),
      {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=43200, stale-while-revalidate=604800",
        },
        ...(headingFontData
          ? {
              fonts: [
                {
                  name: HEADLINE_FONT_FAMILY,
                  data: headingFontData,
                  style: "normal",
                  weight: 700,
                },
              ],
            }
          : {}),
      },
    );
  } catch (error) {
    const message = error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack || ""}`
      : String(error);
    return new Response(`Site OG render error\n${message}`, {
      status: 500,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
};
