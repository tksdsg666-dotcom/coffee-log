const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Drizzle migrations ship as .sql files that babel-plugin-inline-import turns
// into string imports; Metro has to treat them as source, not as assets.
config.resolver.sourceExts.push('sql');
// expo-sqlite ships SQLite as WebAssembly for the web target.
config.resolver.assetExts.push('wasm');

module.exports = config;
