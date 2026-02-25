export type BaseHeadingFontWeight = 400 | 700 | 800;

const LOCAL_HEADLINE_FONT_PATHS: Record<BaseHeadingFontWeight, string[]> = {
  400: [
    "/fonts/bricolage-grotesque/bricolage-grotesque-latin-400-normal.woff",
    "/fonts/bricolage-grotesque/bricolage-grotesque-latin-ext-400-normal.woff",
  ],
  700: [
    "/fonts/bricolage-grotesque/bricolage-grotesque-latin-700-normal.woff",
    "/fonts/bricolage-grotesque/bricolage-grotesque-latin-ext-700-normal.woff",
  ],
  800: [
    "/fonts/bricolage-grotesque/bricolage-grotesque-latin-800-normal.woff",
    "/fonts/bricolage-grotesque/bricolage-grotesque-latin-ext-800-normal.woff",
  ],
};

const LOCAL_RTL_HEADLINE_FONT_PATHS: Record<BaseHeadingFontWeight, string[]> = {
  400: [
    "/fonts/vazirmatn/vazirmatn-arabic-400-normal.woff",
  ],
  700: [
    "/fonts/vazirmatn/vazirmatn-arabic-700-normal.woff",
  ],
  800: [
    "/fonts/vazirmatn/vazirmatn-arabic-800-normal.woff",
  ],
};

export const buildLocalHeadingFontUrls = (origin: string, weight: BaseHeadingFontWeight): string[] => {
  return LOCAL_HEADLINE_FONT_PATHS[weight].map((path) => new URL(path, origin).toString());
};

export const buildLocalRtlHeadingFontUrls = (origin: string, weight: BaseHeadingFontWeight): string[] => {
  return LOCAL_RTL_HEADLINE_FONT_PATHS[weight].map((path) => new URL(path, origin).toString());
};
