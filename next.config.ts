import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  assetPrefix: process.env.VERCEL ? "/inteligencia" : undefined,
};

export default nextConfig;
