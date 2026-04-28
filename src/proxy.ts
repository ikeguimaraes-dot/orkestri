import { NextResponse, type NextRequest } from "next/server";

// TEMP: auth gate desativado para testes de Ponto — restaurar antes de produção real
export async function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Tudo, exceto assets estáticos do Next + assets PWA (manifest e ícones
    // precisam ser acessíveis sem auth pra browser fazer install).
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|icon-).*)",
  ],
};
