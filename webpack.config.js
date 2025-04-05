const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function(env, argv) {
  const config = await createExpoWebpackConfigAsync({
    ...env,
  }, argv);

  // Add resolver alias for react-native-maps
  if (!config.resolve) {
    config.resolve = {};
  }

  if (!config.resolve.alias) {
    config.resolve.alias = {};
  }

  // Replace react-native-maps with an empty module in web
  config.resolve.alias['react-native-maps'] = path.resolve(__dirname, './empty-module.js');

  // Add null-loader for any imports from react-native-maps
  config.module.rules.push({
    test: /react-native-maps/,
    use: 'null-loader',
  });

  return config;
};