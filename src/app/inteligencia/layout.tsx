import { AuthProvider } from "@kph/auth/context";
import { requireUser } from "@kph/auth/server";
import { createSupabaseServerClient } from "@kph/db/supabase/server";
import type { Unit } from "@kph/db/types/database";
import { Sidebar } from "@kph/ui/sidebar";
import { PageViewTracker } from "@/components/shell/PageViewTracker";
import { SkipLink } from "@/components/shell/SkipLink";

export const dynamic = "force-dynamic";

export default async function InteligenciaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const units = await loadAccessibleUnits();

  return (
    <AuthProvider user={user} units={units}>
      <PageViewTracker />
      {/* Skip link — WCAG 2.4.1 Bypass Blocks */}
      <SkipLink />
      <div style={{ display: "flex", height: "100vh" }}>
        <Sidebar />
        <main
          id="main-content"
          tabIndex={-1}
          style={{ flex: 1, overflowY: "auto", padding: "32px 28px", outline: "none" }}
        >
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}

async function loadAccessibleUnits(): Promise<Unit[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("units")
      .select("*")
      .eq("active", true)
      .order("name");
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}
