const path = require('path');
const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Add fallbacks for Node.js modules in browser environment
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "crypto": require.resolve("crypto-browserify"),
        "buffer": require.resolve("buffer"),
        "stream": require.resolve("stream-browserify"),
        "process": require.resolve("process/browser.js"),
        "assert": require.resolve("assert"),
        "http": require.resolve("stream-http"),
        "https": require.resolve("https-browserify"),
        "os": require.resolve("os-browserify/browser"),
        "url": require.resolve("url"),
        "fs": false,
        "path": require.resolve("path-browserify"),
        "vm": require.resolve("vm-browserify"),
        "util": require.resolve("util")
      };

      // Add plugins for polyfills - IMPORTANT: Order matters!
      webpackConfig.plugins = [
        ...webpackConfig.plugins,
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser.js',
        }),
        new webpack.DefinePlugin({
          'process.env.NODE_ENV': JSON.stringify(env),
          'process.version': JSON.stringify(process.version),
          'process.browser': JSON.stringify(true),
          'global': 'globalThis',
        }),
        // Add buffer polyfill globally
        new webpack.ProvidePlugin({
          'global.Buffer': ['buffer', 'Buffer'],
        }),
      ];

      // Ignore source map warnings for crypto libraries
      webpackConfig.ignoreWarnings = [
        /Failed to parse source map/,
        /Critical dependency: the request of a dependency is an expression/,
        /Module not found: Error: Can't resolve 'process\/browser'/,
        /the request of a dependency is an expression/
      ];

      // Resolve extensions
      webpackConfig.resolve.extensions = [
        ...webpackConfig.resolve.extensions,
        '.mjs'
      ];

      // Add module rules for better handling
      webpackConfig.module.rules.push({
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false,
        },
      });

      return webpackConfig;
    },
  },
};
