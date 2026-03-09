export interface SiteOgStaticManifestEntry {
  path: string;
  hash: string;
}

export interface SiteOgStaticManifest {
  generatedAt: string;
  revision: string;
  entries: Record<string, SiteOgStaticManifestEntry>;
}

export const isSiteOgStaticManifest = (value: unknown): value is SiteOgStaticManifest => {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<SiteOgStaticManifest>;
  if (typeof payload.generatedAt !== "string") return false;
  if (typeof payload.revision !== "string") return false;
  if (!payload.entries || typeof payload.entries !== "object") return false;

  for (const entry of Object.values(payload.entries)) {
    if (!entry || typeof entry !== "object") return false;
    const candidate = entry as Partial<SiteOgStaticManifestEntry>;
    if (typeof candidate.path !== "string") return false;
    if (typeof candidate.hash !== "string") return false;
  }

  return true;
};
