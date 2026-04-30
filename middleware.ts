import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

export const runtime = "nodejs";

export async function middleware(request: NextRequest) {
  console.log('[middleware] path:', request.nextUrl.pathname)
  console.log('[middleware] cookies:', request.cookies.getAll().map(c => c.name))
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.next();
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Padrão oficial @supabase/ssr
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, {
            ...options,
            secure: true,
            sameSite: "lax",
            path: "/",
          }),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.log('[middleware] user:', user?.email ?? 'NULL')

  const pathname = request.nextUrl.pathname;

  const isPublicRoute =
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname === "/ponto" ||
    pathname.startsWith("/_next") ||
    pathname === "/api/ponto/punch";

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
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
