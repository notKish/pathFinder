// webpack.config.js
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: {
    'content/content': './src/content/content.js',
    'popup': './src/popup/index.js', // Key is 'popup'
    'background/background': './src/background/background.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: (pathData) => {
      const name = pathData.chunk.name; // Entry key: 'popup', 'content/content', etc.

      // Be explicit based on the entry key names
      if (name === 'popup') {
        return 'popup.bundle.js'; // Should create dist/popup.bundle.js
      }
      if (name === 'content/content') {
        return 'content/content.js'; // Should create dist/content/content.js
      }
      if (name === 'background/background') {
        return 'background/background.js'; // Should create dist/background/background.js
      }

      // Fallback if an unexpected entry key appears (shouldn't happen here)
      console.warn(`Unexpected chunk name in webpack output: ${name}`);
      return `${name}.bundle.js`;
    },
    clean: false, // Let npm script handle cleaning
  },
  // ... rest of your config (module, plugins, devtool, etc.) ...
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'public', to: '.' },
      ],
    }),
  ],
  devtool: process.env.NODE_ENV === 'production' ? false : 'cheap-module-source-map',
  performance: {
    hints: false,
  },
  experiments: {
    topLevelAwait: true,
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
};
