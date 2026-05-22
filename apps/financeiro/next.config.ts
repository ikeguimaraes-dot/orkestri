import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kph/db", "@kph/ui", "@kph/auth"],
};

export default nextConfig;
