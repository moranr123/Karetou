module.exports = function(api) {
  api.cache(true);
  
  return {
    presets: ['babel-preset-expo'],
    env: {
      production: {
        plugins: [
          [
            'transform-remove-console',
            {
              // Exclude console.error and console.warn from removal
              exclude: ['error', 'warn']
            }
          ]
        ]
      }
    }
  };
};

