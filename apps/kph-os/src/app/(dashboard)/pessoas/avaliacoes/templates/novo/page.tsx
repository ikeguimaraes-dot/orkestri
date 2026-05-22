import { redirect } from "next/navigation";
import { listAccessibleBrands } from "@/app/(dashboard)/eventos/actions";
import { requireUser } from "@kph/auth/server";
import { NovoTemplateAvaliacaoClient } from "./novo-template-client";

export const dynamic = "force-dynamic";

export default async function NovoTemplateAvaliacaoPage() {
  await requireUser();
  const brands = await listAccessibleBrands();
  if (brands.length === 0) redirect("/pessoas/avaliacoes/templates");
  return (
    <div style={{ padding: "0 4px" }}>
      <NovoTemplateAvaliacaoClient brands={brands} />
    </div>
  );
}
