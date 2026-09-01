module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Lets Drizzle's generated .sql migrations be `import`ed as strings so the
    // migrator can run them at startup without any filesystem access.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
