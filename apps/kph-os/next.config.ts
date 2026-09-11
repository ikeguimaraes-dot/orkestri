import path from "node:path";

const isDevelopment =
  process.env.NODE_ENV === "development" || process.env.LOCAL_ZONES === "true";

function zoneUrl(envName: string, localPort: number, productionHost: string) {
  const configured = process.env[envName]?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return isDevelopment
    ? `http://localhost:${localPort}`
    : `https://${productionHost}`;
}

const zones = [
  { prefix: "/financeiro",   origin: zoneUrl("FINANCEIRO_APP_URL", 3001, "kph-os-financeiro.vercel.app") },
  { prefix: "/pessoas",      origin: zoneUrl("PESSOAS_APP_URL", 3002, "kph-os-pessoas.vercel.app") },
  { prefix: "/operacao",     origin: zoneUrl("OPERACAO_APP_URL", 3003, "kph-os-operacao.vercel.app") },
  { prefix: "/compras",      origin: zoneUrl("COMPRAS_APP_URL", 3004, "kph-os-compras.vercel.app") },
  { prefix: "/comercial",    origin: zoneUrl("COMERCIAL_APP_URL", 3005, "kph-os-ruptura.vercel.app") },
  { prefix: "/marca",        origin: zoneUrl("MARCA_APP_URL", 3006, "kph-os-marca.vercel.app") },
  { prefix: "/escritorio",   origin: zoneUrl("MARCA_APP_URL", 3006, "kph-os-marca.vercel.app") },
  { prefix: "/clientes",     origin: zoneUrl("MARCA_APP_URL", 3006, "kph-os-marca.vercel.app") },
  { prefix: "/frentes",      origin: zoneUrl("MARCA_APP_URL", 3006, "kph-os-marca.vercel.app") },
  { prefix: "/organograma",  origin: zoneUrl("MARCA_APP_URL", 3006, "kph-os-marca.vercel.app") },
  { prefix: "/inteligencia", origin: zoneUrl("INTELIGENCIA_APP_URL", 3007, "kph-os-inteligencia.vercel.app") },
  { prefix: "/orquestrador", origin: zoneUrl("INTELIGENCIA_APP_URL", 3007, "kph-os-inteligencia.vercel.app") },
  { prefix: "/board",        origin: zoneUrl("INTELIGENCIA_APP_URL", 3007, "kph-os-inteligencia.vercel.app") },
];

const nextConfig = {
  // Raiz do monorepo — sem isso o Turbopack infere a raiz a partir de
  // lockfiles fora do repo e quebra a resolução de módulos.
  turbopack: { root: path.join(import.meta.dirname, "../..") },
  transpilePackages: ["@kph/db", "@kph/ui", "@kph/auth", "@kph/core"],
  async redirects() {
    return [
      // /marcas e /marca/* foram substituídos por /clientes (Sprint B — set/2026)
      { source: "/marcas", destination: "/clientes", permanent: true },
      { source: "/marca", destination: "/clientes", permanent: true },
      // Exclui _next e api: kph-os-marca serve assets via /marca/_next (assetPrefix)
      { source: "/marca/((?!_next|api).+)", destination: "/clientes", permanent: true },
    ];
  },
  async rewrites() {
    const afterFiles = zones.flatMap(({ prefix, origin }) => [
      // Static assets must be proxied before the page routes so the browser
      // can load JS chunks from the correct zone app.
      {
        source: `${prefix}/_next/:path*`,
        // assetPrefix altera a URL pedida pelo browser, não o caminho em que
        // o sub-app publica os chunks. Remova o prefixo ao encaminhar.
        destination: `${origin}/_next/:path*`,
      },
      // Mantém as chamadas de API sob o domínio do shell, onde está a sessão,
      // e remove o prefixo antes de encaminhar ao Route Handler do sub-app.
      {
        source: `${prefix}/api/:path*`,
        destination: `${origin}/api/:path*`,
      },
      // Exact match (no trailing path) — :path* doesn't match empty string
      {
        source: `${prefix}`,
        destination: `${origin}${prefix}`,
      },
      {
        source: `${prefix}/:path*`,
        destination: `${origin}${prefix}/:path*`,
      },
    ]);
    return { afterFiles };
  },
};

export default nextConfig;
