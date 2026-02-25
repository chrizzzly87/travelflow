const fs = require("node:fs");
const path = require("node:path");

const SITE_OG_STATIC_DIR_RELATIVE = "public/images/og/site/generated";
const SITE_OG_ASSET_REGEX = /\.png$/i;
const LOG_PREFIX = "[site-og-build-cache]";

const resolveSiteOgStaticDirectory = (cwd = process.cwd()) => {
  return path.resolve(cwd, ...SITE_OG_STATIC_DIR_RELATIVE.split("/"));
};

const ensureSiteOgStaticDirectory = (cwd = process.cwd()) => {
  fs.mkdirSync(resolveSiteOgStaticDirectory(cwd), { recursive: true });
};

const countGeneratedSiteOgPngs = (cwd = process.cwd()) => {
  const outputDirectory = resolveSiteOgStaticDirectory(cwd);
  if (!fs.existsSync(outputDirectory)) return 0;

  return fs.readdirSync(outputDirectory)
    .filter((fileName) => SITE_OG_ASSET_REGEX.test(fileName))
    .length;
};

const createSiteOgBuildCachePlugin = ({
  countPngs = () => countGeneratedSiteOgPngs(),
  restoreCache = async (utils) => {
    await utils.cache.restore(SITE_OG_STATIC_DIR_RELATIVE);
  },
  saveCache = async (utils) => {
    await utils.cache.save(SITE_OG_STATIC_DIR_RELATIVE);
  },
  log = (message) => console.log(message),
} = {}) => {
  const onPreBuild = async ({ utils }) => {
    const beforeCount = countPngs();
    ensureSiteOgStaticDirectory();
    await restoreCache(utils);
    const afterCount = countPngs();

    if (afterCount > beforeCount) {
      log(`${LOG_PREFIX} restored ${SITE_OG_STATIC_DIR_RELATIVE} cache (${afterCount} png assets available).`);
      return;
    }

    if (afterCount > 0) {
      log(`${LOG_PREFIX} cache directory already populated (${afterCount} png assets).`);
      return;
    }

    log(`${LOG_PREFIX} no cached static OG assets restored.`);
  };

  const persistCache = async ({ utils, reason = "success" }) => {
    const assetCount = countPngs();
    if (assetCount === 0) {
      log(`${LOG_PREFIX} skipping cache save (no static OG assets found; reason=${reason}).`);
      return;
    }

    ensureSiteOgStaticDirectory();
    await saveCache(utils);
    log(`${LOG_PREFIX} saved ${SITE_OG_STATIC_DIR_RELATIVE} cache (${assetCount} png assets; reason=${reason}).`);
  };

  const onSuccess = async ({ utils }) => {
    await persistCache({ utils, reason: "success" });
  };

  const onError = async ({ utils }) => {
    await persistCache({ utils, reason: "error" });
  };

  return {
    onPreBuild,
    onSuccess,
    onError,
  };
};

module.exports = {
  SITE_OG_STATIC_DIR_RELATIVE,
  countGeneratedSiteOgPngs,
  createSiteOgBuildCachePlugin,
  ensureSiteOgStaticDirectory,
  resolveSiteOgStaticDirectory,
};
