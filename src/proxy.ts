import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next 16 renomeou middleware → proxy (file: proxy.ts, fn: proxy).
 * Runtime: Node.js. Edge runtime NÃO é suportado em proxy.
 *
 * Gating:
 *   - sem sessão → redireciona pra /login (exceto rotas públicas)
 *   - com sessão em /login → redireciona pra / (dashboard)
 */

const PUBLIC_PREFIXES = ["/login", "/auth/callback", "/auth/sign-out", "/api/auth-debug"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (!user && !isPublic(path)) {
    // /api/* deve responder 401 JSON, não redirecionar pra página HTML —
    // do contrário fetches client-side seguem o 307 com POST e batem em
    // /login (page sem handler POST), retornando 405. Acontece em mobile
    // PWA quando o cookie de sessão expira silenciosamente.
    if (path.startsWith("/api/")) {
      const apiResponse = NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 },
      );
      // Propaga cookies de sessão atualizados (ex: limpeza de tokens)
      response.cookies.getAll().forEach((cookie) => {
        apiResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
      return apiResponse;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    const redirectResponse = NextResponse.redirect(url);
    // Propaga cookies de sessão atualizados (ex: limpeza de tokens)
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    const redirectResponse = NextResponse.redirect(url);
    // Propaga cookies de sessão atualizados (ex: refresh de tokens)
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    // Tudo, exceto assets estáticos do Next + assets PWA (manifest e ícones
    // precisam ser acessíveis sem auth pra browser fazer install).
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|icon-).*)",
  ],
};
