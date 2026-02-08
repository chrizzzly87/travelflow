import React from "https://esm.sh/react@18.3.1";
import { ImageResponse } from "https://deno.land/x/og_edge/mod.ts";

const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;
const SITE_NAME = "TravelFlow";
const HEADLINE_FONT_FAMILY = "Space Grotesk";
const HEADLINE_FONT_URL =
  "https://unpkg.com/@fontsource/space-grotesk@5.0.18/files/space-grotesk-latin-700-normal.woff";

const DEFAULT_TITLE = "TravelFlow";
const DEFAULT_SUBLINE = "Plan and share travel routes with timeline and map previews.";

// Keep OG visuals aligned with global app accent tokens.
const ACCENT_200 = "#c7d2fe";
const ACCENT_500 = "#6366f1";
const ACCENT_600 = "#4f46e5";
const ACCENT_700 = "#4338ca";

let headingFontPromise: Promise<ArrayBuffer | null> | null = null;

const loadHeadingFont = async (): Promise<ArrayBuffer | null> => {
  if (!headingFontPromise) {
    headingFontPromise = (async () => {
      try {
        const response = await fetch(HEADLINE_FONT_URL);
        if (!response.ok) return null;
        return await response.arrayBuffer();
      } catch {
        return null;
      }
    })();
  }
  return headingFontPromise;
};

const sanitizeText = (value: string | null, max: number): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}...` : trimmed;
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

const truncateText = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max - 1)}...` : value;

const svgToDataUri = (svg: string): string => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const PLANE_GLYPH_PATH =
  "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z";

const FOOTER_PLANE_ICON_URI = svgToDataUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='#ffffff' d='${PLANE_GLYPH_PATH}'/><path fill='none' stroke='rgba(255,255,255,0.42)' stroke-width='0.75' d='${PLANE_GLYPH_PATH}'/></svg>`,
);

const HERO_PLANE_ICON_URI = svgToDataUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'><defs><filter id='g' x='-50%' y='-50%' width='200%' height='200%'><feDropShadow dx='0' dy='8' stdDeviation='8' flood-color='rgba(255,255,255,0.32)'/></filter></defs><circle cx='80' cy='80' r='62' fill='rgba(255,255,255,0.16)'/><circle cx='80' cy='80' r='48' fill='rgba(255,255,255,0.1)'/><g filter='url(#g)' transform='translate(56 44) scale(2.35) rotate(-8 12 12)'><path fill='#ffffff' d='${PLANE_GLYPH_PATH}'/></g></svg>`,
);

export default async (request: Request): Promise<Response> => {
  try {
    const url = new URL(request.url);
    const headingFontData = await loadHeadingFont();

    const title = sanitizeText(url.searchParams.get("title"), 110) || DEFAULT_TITLE;
    const subline = sanitizeText(url.searchParams.get("description"), 160) || DEFAULT_SUBLINE;
    const pagePath = normalizePath(url.searchParams.get("path"));
    const displayUrl = truncateText(`${url.host}${pagePath}`, 62);

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
              width: "61%",
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
              TravelFlow
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 18,
                fontSize: 70,
                lineHeight: 1.02,
                letterSpacing: -1.8,
                fontWeight: 800,
                textWrap: "pretty",
                color: "#0f172a",
                fontFamily: `"${HEADLINE_FONT_FAMILY}", "Avenir Next", "Segoe UI", sans-serif`,
              }}
            >
              {title}
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
                  <img src={FOOTER_PLANE_ICON_URI} alt="TravelFlow icon" style={{ width: 18, height: 18 }} />
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
              width: "39%",
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
                borderRadius: 28,
                overflow: "hidden",
                border: "1px solid rgba(148, 163, 184, 0.35)",
                background:
                  `radial-gradient(circle at 36% 26%, ${ACCENT_200} 0%, rgba(199,210,254,0.2) 22%, transparent 54%), radial-gradient(circle at 72% 76%, rgba(99,102,241,0.36), transparent 56%), linear-gradient(145deg, ${ACCENT_500} 0%, ${ACCENT_600} 48%, ${ACCENT_700} 100%)`,
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "inset 0 0 120px rgba(15,23,42,0.18)",
              }}
            >
              <img
                src={HERO_PLANE_ICON_URI}
                alt="Plane icon"
                style={{
                  width: 236,
                  height: 236,
                  opacity: 0.98,
                  display: "flex",
                  filter: "drop-shadow(0 16px 32px rgba(15,23,42,0.24))",
                  transform: "translate(4px, -2px)",
                }}
              />
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
