const {
  SITE_OG_STATIC_DIR_RELATIVE,
  countGeneratedSiteOgPngs,
} = require("./lib.js");

const LOG_PREFIX = "[site-og-build-cache]";

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

  const onSuccess = async ({ utils }) => {
    const assetCount = countPngs();
    if (assetCount === 0) {
      log(`${LOG_PREFIX} skipping cache save (no static OG assets found).`);
      return;
    }

    await saveCache(utils);
    log(`${LOG_PREFIX} saved ${SITE_OG_STATIC_DIR_RELATIVE} cache (${assetCount} png assets).`);
  };

  return {
    onPreBuild,
    onSuccess,
  };
};

const plugin = createSiteOgBuildCachePlugin();

module.exports = {
  ...plugin,
  _internal: {
    createSiteOgBuildCachePlugin,
  },
};
