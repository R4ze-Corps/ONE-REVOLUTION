/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  distDir: path.resolve(__dirname, '..', '..', '.next'),
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  turbopack: {
    root: path.resolve(__dirname, '..', '..'),
  },
};

module.exports = nextConfig;
