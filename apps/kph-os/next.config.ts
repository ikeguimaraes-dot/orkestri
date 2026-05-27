const zones = [
  { prefix: "/financeiro",   host: "kph-os-financeiro.vercel.app" },
  { prefix: "/pessoas",      host: "kph-os-pessoas.vercel.app" },
  { prefix: "/operacao",     host: "kph-os-operacao.vercel.app" },
  { prefix: "/compras",      host: "kph-os-compras.vercel.app" },
  { prefix: "/comercial",    host: "kph-os-ruptura.vercel.app" },
  { prefix: "/marca",        host: "kph-os-marca.vercel.app" },
  { prefix: "/inteligencia", host: "kph-os-inteligencia.vercel.app" },
];

const nextConfig = {
  transpilePackages: ["@kph/db", "@kph/ui", "@kph/auth"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async rewrites() {
    const afterFiles = zones.flatMap(({ prefix, host }) => [
      // Static assets must be proxied before the page routes so the browser
      // can load JS chunks from the correct zone app.
      {
        source: `${prefix}/_next/:path*`,
        destination: `https://${host}${prefix}/_next/:path*`,
      },
      // Exact match (no trailing path) — :path* doesn't match empty string
      {
        source: `${prefix}`,
        destination: `https://${host}${prefix}`,
      },
      {
        source: `${prefix}/:path*`,
        destination: `https://${host}${prefix}/:path*`,
      },
    ]);
    return { afterFiles };
  },
};

export default nextConfig;
