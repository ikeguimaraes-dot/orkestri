import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { AuthProvider } from "@/lib/auth/context";
import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Unit } from "@/types/database";

// Layout chama cookies() via getCurrentUser — Next 16 não pode prerender estaticamente
// rotas que dependem de request. Toda página dentro do (dashboard) é dynamic.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // proxy.ts já redireciona — defesa em profundidade.
  const user = await requireUser();

  const units = await loadAccessibleUnits();

  return (
    <AuthProvider user={user} units={units}>
      <div
        style={{
          display: "flex",
          height: "100vh",
          background: "var(--bg)",
          color: "var(--text)",
        }}
      >
        <Sidebar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <TopBar />
          <main className="shell-main" style={{ flex: 1, overflowY: "auto", padding: "32px 28px" }}>{children}</main>
        </div>
      </div>
    </AuthProvider>
  );
}

async function loadAccessibleUnits(): Promise<Unit[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      console.warn("[loadAccessibleUnits] supabase indisponível");
      return [];
    }
    // RLS no servidor garante que só vem o que o user pode ver.
    const { data, error } = await supabase
      .from("units")
      .select("*")
      .eq("active", true)
      .order("name");
    if (error) {
      console.error("[loadAccessibleUnits] query error:", error.message);
      return [];
    }
    return data ?? [];
  } catch (e) {
    console.error("[loadAccessibleUnits] exceção:", e);
    return [];
  }
}
