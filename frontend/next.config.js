// next.config.js – ensure Turbopack resolves Tailwind from frontend node_modules
const path = require('path');
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { webpack }) => {
    // Alias Tailwind CSS to the local frontend node_modules
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      tailwindcss: path.resolve(__dirname, 'node_modules', 'tailwindcss')
    };
    return config;
  },
  turbopack: {},
  // No experimental options needed; Turbopack is enabled by default in Next.js 16
  // If you need custom memory limits, consider adjusting Node's memory allocation when launching.
};
module.exports = nextConfig;
