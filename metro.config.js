const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require('path');

const config = getDefaultConfig(__dirname);
const projectRoot = __dirname;

const backendFolderPath = path.resolve(projectRoot, 'backend');
const trainingFolderPath = path.resolve(projectRoot, 'training');

const backendIgnorePattern = new RegExp(
    `${backendFolderPath.replace(/[/\\]/g, '\\\\')}[\\\\\\/].*`
  );
const trainingIgnorePattern = new RegExp(
    `${trainingFolderPath.replace(/[/\\]/g, '\\\\')}[\\\\\\/].*`
  );

config.resolver = config.resolver || {};
config.resolver.blockList = new RegExp(
  [
    ...(config.resolver.blockList ? [config.resolver.blockList.source] : []),
    backendIgnorePattern.source,
    trainingIgnorePattern.source,
  ].join('|')
);

module.exports = withNativeWind(config, { input: "./global.css" });
