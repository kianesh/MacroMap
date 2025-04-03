// Update your babel.config.js to include dotenv configuration
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Add this plugin with proper configuration
      ["module:react-native-dotenv", {
        "moduleName": "react-native-dotenv",
        "path": ".env",
        "blacklist": null,
        "whitelist": null,
        "safe": false,
        "allowUndefined": true
      }]
    ]
  };
};