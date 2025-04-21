// Update your babel.config.js to include dotenv configuration
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: []
  };
};