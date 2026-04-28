import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import {
  getCmvItem,
  listRecipeItems,
  listRecipeNotes,
} from "@/app/(dashboard)/cardapio/actions";
import { DetalheFichaClient } from "./detalhe-client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FichaTecnicaPage({ params }: Props) {
  await requireUser();
  const { id } = await params;
  const [item, recipeItems, notes] = await Promise.all([
    getCmvItem(id),
    listRecipeItems(id),
    listRecipeNotes(id),
  ]);
  if (!item) notFound();
  return (
    <DetalheFichaClient item={item} initialItems={recipeItems} initialNotes={notes} />
  );
}
