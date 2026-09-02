"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@kph/db/supabase/server";
import { requireRole } from "@kph/auth/server";

/**
 * Substitui integralmente o conjunto de categorias de um usuário.
 *
 * Estratégia: apaga tudo do user_id e reinsere — mais simples que
 * diff/merge, e o volume é baixo (max ~8 categorias por usuário).
 * Tudo roda dentro de uma transação via service role; RLS da tabela
 * continua valendo pros usuários comuns.
 *
 * Só founder pode chamar (requireRole). User-alvo é o userId do form.
 */
export async function setUserCategories(
  userId: string,
  categoryIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireRole(["founder"]);

  if (!userId || typeof userId !== "string") {
    return { ok: false, error: "userId inválido" };
  }
  if (!Array.isArray(categoryIds)) {
    return { ok: false, error: "categoryIds precisa ser array" };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível" };

  const uniqueCategoryIds = [...new Set(categoryIds)];
  if (uniqueCategoryIds.some((id) => typeof id !== "string" || !id)) {
    return { ok: false, error: "Uma ou mais categorias são inválidas" };
  }
  if (uniqueCategoryIds.length > 0) {
    const { data: validCategories, error: validationError } = await supabase
      .from("categories")
      .select("id")
      .in("id", uniqueCategoryIds)
      .eq("is_active", true);
    if (validationError) return { ok: false, error: validationError.message };
    if ((validCategories ?? []).length !== uniqueCategoryIds.length) {
      return { ok: false, error: "Uma ou mais categorias não existem ou estão inativas" };
    }
  }

  // DELETE todos os vínculos antigos do user.
  const { error: delErr } = await supabase
    .from("user_categories")
    .delete()
    .eq("user_id", userId);

  if (delErr) {
    return { ok: false, error: `delete: ${delErr.message}` };
  }

  // INSERT em lote (vazio = sem categoria = usuário vê só Dashboard).
  if (uniqueCategoryIds.length > 0) {
    const rows = uniqueCategoryIds.map((categoryId) => ({
      user_id: userId,
      category_id: categoryId,
      granted_by: me.id,
    }));
    // Cast: o Database type manual não tem Relationships definidas pra
    // user_categories (que faz FK pra auth.users/categories) e o
    // .insert() cai em never[] por isso. Tipos estão corretos via
    // Tables<"user_categories"> quando precisar — aqui basta garantir
    // que o shape bate com o Insert type.
    const { error: insErr } = await supabase
      .from("user_categories")
      .insert(rows as never);

    if (insErr) {
      return { ok: false, error: `insert: ${insErr.message}` };
    }
  }

  // Invalida cache do layout (CurrentUser é cache() por request, mas o
  // /api/nav e qualquer página que dependa do user precisa revalidar).
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setUserRole(
  userId: string,
  roleId: string | null,
  unitIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["founder"]);
  if (!userId || typeof userId !== "string") {
    return { ok: false, error: "Usuário inválido" };
  }
  if (roleId !== null && (typeof roleId !== "string" || !roleId)) {
    return { ok: false, error: "Nível de acesso inválido" };
  }
  const uniqueUnitIds = [...new Set(unitIds)];
  if (roleId !== null && uniqueUnitIds.length === 0) {
    return { ok: false, error: "Selecione ao menos uma unidade" };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível" };
  const { error } = await supabase.rpc("admin_set_user_role", {
    p_user_id: userId,
    p_role_id: roleId,
    p_unit_ids: roleId === null ? [] : uniqueUnitIds,
  } as never);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/admin/categorias");
  return { ok: true };
}
