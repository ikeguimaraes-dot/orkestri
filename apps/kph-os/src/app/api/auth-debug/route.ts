import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@kph/db/types/database";

/**
 * Endpoint de diagnóstico temporário — bypassa o proxy (está em PUBLIC_PREFIXES).
 * Mostra env vars, cookies e estado da sessão diretamente.
 * Remover após resolver o bug de auth.
 */
export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const allCookies = request.cookies.getAll();
  const supabaseCookies = allCookies
    .filter((c) => c.name.includes("supabase") || c.name.startsWith("sb-"))
    .map((c) => ({ name: c.name, len: c.value.length, preview: c.value.slice(0, 60) }));

  const envCheck = {
    hasUrl: !!url,
    urlPreview: url ? url.slice(0, 40) : null,
    hasAnonKey: !!anonKey,
    anonKeyPreview: anonKey ? anonKey.slice(0, 30) + "..." : null,
  };

  if (!url || !anonKey) {
    return NextResponse.json({
      envCheck,
      supabaseCookies,
      allCookieNames: allCookies.map((c) => c.name),
      user: { status: "skipped", reason: "env vars ausentes" },
    });
  }

  // Cria cliente sem next/headers — lê cookies direto do request
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // read-only neste contexto
      },
    },
  });

  let userResult: Record<string, unknown>;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      userResult = { status: "error", message: error.message, code: (error as { code?: string }).code };
    } else if (data.user) {
      userResult = { status: "ok", email: data.user.email, id: data.user.id.slice(0, 8) + "..." };
    } else {
      userResult = { status: "null" };
    }
  } catch (e) {
    userResult = { status: "exception", message: String(e) };
  }

  return NextResponse.json({
    envCheck,
    supabaseCookies,
    allCookieNames: allCookies.map((c) => c.name),
    user: userResult,
  });
}
