import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/ui",

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  output: 'standalone',

  images: {
    unoptimized: true,
  },
};

export default nextConfig;