const fs = require("node:fs");
const path = require("node:path");

const SITE_OG_STATIC_DIR_RELATIVE = "public/images/og/site/generated";
const SITE_OG_ASSET_REGEX = /\.png$/i;

const resolveSiteOgStaticDirectory = (cwd = process.cwd()) => {
  return path.resolve(cwd, ...SITE_OG_STATIC_DIR_RELATIVE.split("/"));
};

const countGeneratedSiteOgPngs = (cwd = process.cwd()) => {
  const outputDirectory = resolveSiteOgStaticDirectory(cwd);
  if (!fs.existsSync(outputDirectory)) return 0;

  return fs.readdirSync(outputDirectory)
    .filter((fileName) => SITE_OG_ASSET_REGEX.test(fileName))
    .length;
};

module.exports = {
  SITE_OG_STATIC_DIR_RELATIVE,
  countGeneratedSiteOgPngs,
  resolveSiteOgStaticDirectory,
};
