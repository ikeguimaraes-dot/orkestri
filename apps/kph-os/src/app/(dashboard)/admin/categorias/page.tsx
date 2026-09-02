import { redirect } from "next/navigation";
import { requireRole } from "@kph/auth/server";
import { createServiceClient, createSupabaseServerClient } from "@kph/db/supabase/server";
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

  // Lista as contas reais via Admin API; profiles é apenas um complemento
  // opcional para exibir o nome cadastrado no sistema.
  const usersResult = await loadUsers();
  if (!usersResult.ok) {
    return (
      <ErrorState
        title="Erro ao carregar usuários"
        detail={usersResult.error}
        hint="Configure SUPABASE_SERVICE_ROLE_KEY no servidor (inclusive na Vercel) e faça um novo deploy. Essa chave nunca deve ser pública."
      />
    );
  }
  const users = usersResult.users;

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
          hint="Não há contas cadastradas no Supabase Auth deste projeto."
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

async function loadUsers(): Promise<
  { ok: true; users: AdminUser[] } | { ok: false; error: string }
> {
  const service = createServiceClient();
  if (!service) {
    return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." };
  }

  const authUsers: Array<{ id: string; email?: string; user_metadata: Record<string, unknown> }> = [];
  const perPage = 1000;
  let page = 1;
  while (true) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage });
    if (error) return { ok: false, error: `Supabase Auth: ${error.message}` };
    authUsers.push(...data.users);
    if (data.users.length < perPage) break;
    page += 1;
  }

  type ProfileRow = { id: string; email: string | null; display_name: string | null };
  const { data: profiles } = await service
    .from("profiles")
    .select("id, email, display_name")
    .returns<ProfileRow[]>();
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const founderSet = new Set<string>();
  const ids = authUsers.map((user) => user.id);

  if (ids.length > 0) {
    const { data: rolesData, error: rolesError } = await service
      .from("user_roles")
      .select("user_id, roles!inner(name)")
      .in("user_id", ids)
      .returns<Array<{ user_id: string; roles: { name: string } | { name: string }[] | null }>>();
    if (rolesError) return { ok: false, error: `Permissões: ${rolesError.message}` };
    for (const row of rolesData ?? []) {
      const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
      if (role?.name === "founder") founderSet.add(row.user_id);
    }
  }

  const users = authUsers.map((user) => {
    const profile = profileById.get(user.id);
    const metadataName = [
      user.user_metadata?.display_name,
      user.user_metadata?.full_name,
      user.user_metadata?.name,
    ].find((value): value is string => typeof value === "string" && value.trim().length > 0);
    return {
      id: user.id,
      email: profile?.email ?? user.email ?? null,
      displayName: profile?.display_name ?? metadataName ?? null,
      isFounder: founderSet.has(user.id),
    };
  });
  users.sort((a, b) =>
    (a.displayName ?? a.email ?? "").localeCompare(b.displayName ?? b.email ?? "", "pt-BR"),
  );
  return { ok: true, users };
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
