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
  if (!supabase) return { ok: false, error: "supabase indisponível" };

  // DELETE todos os vínculos antigos do user.
  const { error: delErr } = await supabase
    .from("user_categories")
    .delete()
    .eq("user_id", userId);

  if (delErr) {
    return { ok: false, error: `delete: ${delErr.message}` };
  }

  // INSERT em lote (vazio = sem categoria = usuário vê só Dashboard).
  if (categoryIds.length > 0) {
    const rows = categoryIds.map((categoryId) => ({
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
