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

  // Lista as contas reais via Admin API; profiles é apenas um complemento
  // opcional para exibir o nome cadastrado no sistema.
  const usersResult = await loadUsers();
  if (!usersResult.ok) {
    return (
      <ErrorState
        title="Erro ao carregar usuários"
        detail={usersResult.error}
      />
    );
  }
  const users = usersResult.users;

  type RoleRow = { id: string; name: string; description: string | null };
  type UnitRow = { id: string; name: string };
  type UserRoleRow = { user_id: string; role_id: string; unit_id: string | null };
  const [rolesResult, unitsResult, userRolesResult] = await Promise.all([
    supabase.from("roles").select("id, name, description").order("name").returns<RoleRow[]>(),
    supabase.from("units").select("id, name").eq("active", true).order("name").returns<UnitRow[]>(),
    supabase.from("user_roles").select("user_id, role_id, unit_id").returns<UserRoleRow[]>(),
  ]);

  const accessError = rolesResult.error ?? unitsResult.error ?? userRolesResult.error;
  if (accessError) {
    return <ErrorState title="Erro ao carregar níveis de acesso" detail={accessError.message} />;
  }

  const accessByUser: Record<string, { roleId: string; unitIds: string[] }> = {};
  for (const access of userRolesResult.data ?? []) {
    const userAccess = accessByUser[access.user_id] ?? {
      roleId: access.role_id,
      unitIds: [],
    };
    accessByUser[access.user_id] = userAccess;
    if (
      access.unit_id &&
      userAccess.roleId === access.role_id
    ) {
      userAccess.unitIds.push(access.unit_id);
    }
  }

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
          roles={rolesResult.data ?? []}
          units={unitsResult.data ?? []}
          initialAccess={accessByUser}
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

type AdminListUserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  is_founder: boolean;
};

async function loadUsers(): Promise<
  { ok: true; users: AdminUser[] } | { ok: false; error: string }
> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível." };

  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) return { ok: false, error: `Usuários: ${error.message}` };

  const users = ((data ?? []) as AdminListUserRow[]).map((user) => ({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    isFounder: user.is_founder,
  }));
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
