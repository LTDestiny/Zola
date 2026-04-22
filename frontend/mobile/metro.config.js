const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const srcRoot = path.resolve(projectRoot, "src");
const config = getDefaultConfig(projectRoot);

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@shared/env") {
    const absolutePath = path.join(srcRoot, "shared/env");
    return context.resolveRequest(context, absolutePath, platform);
  }

  if (moduleName.startsWith("@shared/")) {
    const absolutePath = path.join(srcRoot, "shared", moduleName.slice("@shared/".length));
    return context.resolveRequest(context, absolutePath, platform);
  }

  if (moduleName.startsWith("@/")) {
    const absolutePath = path.join(srcRoot, moduleName.slice(2));
    return context.resolveRequest(context, absolutePath, platform);
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
