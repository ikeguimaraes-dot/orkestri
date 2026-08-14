import { redirect } from "next/navigation";
import { requireRole } from "@kph/auth/server";
import { createSupabaseServerClient } from "@kph/db/supabase/server";
import type { Category, UserCategory } from "@kph/db/types/database";
import { CategoriasAdminClient } from "./CategoriasAdminClient";

export const dynamic = "force-dynamic";

/**
 * Página admin pra atribuir categorias (módulos visíveis) aos usuários.
 *
 * Acesso restrito a founder — quem não for founder cai em redirect.
 *
 * Carrega:
 *   - Lista de usuários com e-mail (via auth.users via service role
 *     wrapper, OU melhor: lista via profiles se houver view segura).
 *   - Catálogo de categorias.
 *   - Vínculos user_categories atuais.
 */
export default async function CategoriasAdminPage() {
  // Gate: só founder chega aqui.
  await requireRole(["founder"]);

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");

  // Categorias (catálogo).
  const { data: categories, error: catErr } = await supabase
    .from("categories")
    .select("id, slug, name, description, icon, sort_order")
    .eq("is_active", true)
    .order("sort_order")
    .returns<Category[]>();

  if (catErr) {
    return (
      <ErrorState
        title="Erro ao carregar categorias"
        detail={catErr.message}
        hint="Você rodou a migration 001_categories.sql? Tabelas 'categories' e 'user_categories' precisam existir."
      />
    );
  }

  // Vínculos atuais (RLS founder permite ver tudo).
  const { data: links, error: linksErr } = await supabase
    .from("user_categories")
    .select("user_id, category_id")
    .returns<UserCategory[]>();

  if (linksErr) {
    return (
      <ErrorState
        title="Erro ao carregar vínculos"
        detail={linksErr.message}
      />
    );
  }

  // Lista de usuários. Como o auth.users é gerenciado pelo Supabase Auth,
  // a forma recomendada é listar via service role. Aqui usamos a tabela
  // pública 'profiles' se existir; senão, cai pra service role admin.
  const users = await loadUsers();

  // Indexa vínculos por user_id pra lookup O(1) no client.
  const linksByUser = new Map<string, string[]>();
  for (const l of links ?? []) {
    const arr = linksByUser.get(l.user_id) ?? [];
    arr.push(l.category_id);
    linksByUser.set(l.user_id, arr);
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Admin · Acesso
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            margin: "8px 0 6px",
            color: "var(--text)",
            letterSpacing: -0.5,
          }}
        >
          Categorias por usuário
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-2)",
            maxWidth: 680,
            lineHeight: 1.6,
          }}
        >
          Define quais módulos cada usuário enxerga no sidebar. Categorias
          são ortogonais a roles — um gerente pode ter acesso só ao
          Financeiro, por exemplo. <strong>Founders</strong> sempre vêem
          tudo, independente do que estiver marcado aqui.
        </p>
      </header>

      {users.length === 0 ? (
        <ErrorState
          title="Nenhum usuário encontrado"
          detail="A consulta a auth.users / profiles retornou vazia."
          hint="Se você está em produção, configure a função loadUsers() para usar service role key e listar auth.users."
        />
      ) : (
        <CategoriasAdminClient
          users={users}
          categories={categories ?? []}
          initialLinks={Object.fromEntries(linksByUser)}
        />
      )}
    </div>
  );
}

type AdminUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  isFounder: boolean;
};

async function loadUsers(): Promise<AdminUser[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  // 1) Tenta via profiles (campos públicos: id, email, display_name).
  type ProfileRow = { id: string; email: string | null; display_name: string | null };
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .order("email")
    .returns<ProfileRow[]>();

  if (!pErr && profiles && profiles.length > 0) {
    // Detecta founder via user_roles.
    const ids = profiles.map((p) => p.id);
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("user_id, roles!inner(name)")
      .in("user_id", ids)
      .returns<Array<{ user_id: string; roles: { name: string } | { name: string }[] | null }>>();

    const founderSet = new Set<string>();
    for (const r of rolesData ?? []) {
      const role = Array.isArray(r.roles) ? r.roles[0] : r.roles;
      if (role?.name === "founder") founderSet.add(r.user_id);
    }

    return profiles.map((p) => ({
      id: p.id,
      email: p.email ?? null,
      displayName: p.display_name ?? null,
      isFounder: founderSet.has(p.id),
    }));
  }

  // 2) Fallback: lista direto de auth.users via service role. Requer que
  // createSupabaseServerClient esteja usando service role no servidor.
  // (Como fallback seguro, retornamos array vazio e o usuário vê a msg
  // orientando a criar a tabela profiles.)
  console.warn(
    "[loadUsers] Tabela profiles vazia/inexistente — adicione 'profiles' (id, email, display_name) " +
      "para popular esta tela. SELECT * FROM auth.users direto requer service role configurado.",
  );
  return [];
}

function ErrorState({
  title,
  detail,
  hint,
}: {
  title: string;
  detail?: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        padding: 24,
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "var(--surface-2)",
      }}
    >
      <h2
        style={{
          fontSize: 16,
          fontWeight: 600,
          margin: 0,
          marginBottom: 8,
          color: "var(--text)",
        }}
      >
        {title}
      </h2>
      {detail && (
        <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 12px" }}>
          {detail}
        </p>
      )}
      {hint && (
        <p
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            margin: 0,
            fontStyle: "italic",
          }}
        >
          💡 {hint}
        </p>
      )}
    </div>
  );
}
