import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Endpoint de diagnóstico temporário — mostra estado da sessão e cookies.
 * Remover após resolver o bug de auth.
 */
export async function GET(request: NextRequest) {
  const allCookies = request.cookies.getAll();

  const supabaseCookies = allCookies
    .filter((c) => c.name.includes("supabase") || c.name.includes("sb-"))
    .map((c) => ({ name: c.name, len: c.value.length, preview: c.value.slice(0, 40) }));

  let userResult: Record<string, unknown> = { status: "not_checked" };
  let sessionResult: Record<string, unknown> = { status: "not_checked" };

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    userResult = { status: "error", message: "supabase client null — env vars ausentes" };
  } else {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      userResult = { status: "error", message: error.message, code: error.code };
    } else if (data.user) {
      userResult = { status: "ok", email: data.user.email, id: data.user.id };
    } else {
      userResult = { status: "null", message: "getUser retornou null sem erro" };
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      sessionResult = { status: "error", message: sessionError.message };
    } else if (sessionData.session) {
      const exp = sessionData.session.expires_at;
      sessionResult = {
        status: "ok",
        expires_at: exp ? new Date(exp * 1000).toISOString() : null,
        hasRefreshToken: !!sessionData.session.refresh_token,
      };
    } else {
      sessionResult = { status: "null", message: "getSession retornou null" };
    }
  }

  return NextResponse.json({
    totalCookies: allCookies.length,
    supabaseCookies,
    user: userResult,
    session: sessionResult,
  });
}
