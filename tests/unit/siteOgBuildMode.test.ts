import { describe, expect, it } from "vitest";
import {
  resolveSiteOgStaticBuildMode,
  shouldSkipSiteOgStaticBuild,
} from "../../scripts/site-og-build-mode.ts";

describe("site og static build mode", () => {
  it("respects explicit skip/full overrides", () => {
    expect(resolveSiteOgStaticBuildMode({
      SITE_OG_STATIC_BUILD_MODE: "skip",
    })).toBe("skip");

    expect(resolveSiteOgStaticBuildMode({
      SITE_OG_STATIC_BUILD_MODE: "full",
      NETLIFY: "true",
      CONTEXT: "deploy-preview",
    })).toBe("full");
  });

  it("auto-skips non-production netlify contexts", () => {
    expect(shouldSkipSiteOgStaticBuild({
      NETLIFY: "true",
      CONTEXT: "deploy-preview",
    })).toBe(true);

    expect(shouldSkipSiteOgStaticBuild({
      NETLIFY: "true",
      CONTEXT: "branch-deploy",
    })).toBe(true);

    expect(shouldSkipSiteOgStaticBuild({
      NETLIFY: "true",
      CONTEXT: "dev",
    })).toBe(true);
  });

  it("auto-skips pull request CI runs", () => {
    expect(resolveSiteOgStaticBuildMode({
      CI: "true",
      GITHUB_EVENT_NAME: "pull_request",
    })).toBe("skip");
  });

  it("keeps production and non-netlify builds in full mode", () => {
    expect(resolveSiteOgStaticBuildMode({
      NETLIFY: "true",
      CONTEXT: "production",
    })).toBe("full");

    expect(resolveSiteOgStaticBuildMode({})).toBe("full");
  });
});
