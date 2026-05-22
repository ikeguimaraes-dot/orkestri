import { redirect } from "next/navigation";
import { listAccessibleBrands } from "@/app/(dashboard)/eventos/actions";
import { requireUser } from "@kph/auth/server";
import { NovoTemplateClient } from "./novo-template-client";

export const dynamic = "force-dynamic";

export default async function NovoTemplatePage() {
  await requireUser();
  const brands = await listAccessibleBrands();
  if (brands.length === 0) redirect("/pessoas/treinamentos");
  return (
    <div style={{ padding: "0 4px" }}>
      <NovoTemplateClient brands={brands} />
    </div>
  );
}
