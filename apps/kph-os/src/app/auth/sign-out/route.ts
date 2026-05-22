import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@kph/db/supabase/server";

async function handle(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  const url = new URL("/login", request.url);
  return NextResponse.redirect(url);
}

// Aceita GET (link direto) e POST (formulário) — UX simples.
export const GET = handle;
export const POST = handle;
