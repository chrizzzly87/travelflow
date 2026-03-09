export type SiteOgStaticBuildMode = "full" | "skip";

const NETLIFY_SKIP_CONTEXTS = new Set(["deploy-preview", "branch-deploy", "dev"]);

const normalize = (value: string | undefined): string => (value || "").trim().toLowerCase();

export const resolveSiteOgStaticBuildMode = (
  env: NodeJS.ProcessEnv = process.env,
): SiteOgStaticBuildMode => {
  const override = normalize(env.SITE_OG_STATIC_BUILD_MODE);
  if (override === "skip") return "skip";
  if (override === "full") return "full";

  const isCi = normalize(env.CI) === "true";
  const githubEventName = normalize(env.GITHUB_EVENT_NAME);
  if (isCi && (githubEventName === "pull_request" || githubEventName === "pull_request_target")) {
    return "skip";
  }

  const isNetlify = normalize(env.NETLIFY) === "true" || normalize(env.NETLIFY) === "1";
  const context = normalize(env.CONTEXT);
  if (isNetlify && NETLIFY_SKIP_CONTEXTS.has(context)) {
    return "skip";
  }

  return "full";
};

export const shouldSkipSiteOgStaticBuild = (
  env: NodeJS.ProcessEnv = process.env,
): boolean => resolveSiteOgStaticBuildMode(env) === "skip";
