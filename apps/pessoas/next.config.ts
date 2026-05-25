const nextConfig = {
  transpilePackages: ["@kph/db", "@kph/ui", "@kph/auth"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // When accessed through the kph-os shell, static assets are proxied via
  // /pessoas/_next/*. assetPrefix ensures chunks are served from that path.
  assetPrefix: process.env.VERCEL ? "/pessoas" : undefined,
};

export default nextConfig;
