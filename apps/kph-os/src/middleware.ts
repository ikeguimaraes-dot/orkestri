import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

// HOTFIX 2026-06-12 — bloqueio total temporário enquanto o auth é reativado
// (Sprint 1 de segurança). Toda request retorna 401, exceto assets estáticos
// excluídos pelo matcher. Sem exceções e sem fallbacks.
const MAINTENANCE_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>KPH OS — Sistema em manutenção</title>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
           background: #1A1A1A; color: #F5F0E8; font-family: ui-sans-serif, system-ui, sans-serif; }
    main { text-align: center; padding: 32px; }
    h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.4px; margin: 0 0 8px; }
    p { font-size: 14px; color: #8A8278; margin: 0; }
    .mark { color: #B8975A; font-style: italic; margin-bottom: 24px; font-size: 15px; }
  </style>
</head>
<body>
  <main>
    <div class="mark">KPH OS</div>
    <h1>Sistema em manutenção</h1>
    <p>O painel está temporariamente indisponível. Voltamos em breve.</p>
  </main>
</body>
</html>`;

export function middleware(_request: NextRequest) {
  return new NextResponse(MAINTENANCE_HTML, {
    status: 401,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
