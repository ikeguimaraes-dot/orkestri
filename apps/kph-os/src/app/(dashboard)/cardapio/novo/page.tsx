import { redirect } from "next/navigation";
import { listAccessibleBrands } from "@/app/(dashboard)/eventos/actions";
import { requireUser } from "@kph/auth/server";
import { CardapioFormClient } from "../cardapio-form-client";

export const dynamic = "force-dynamic";

export default async function NovoCardapioItemPage() {
  await requireUser();
  const brands = await listAccessibleBrands();
  if (brands.length === 0) {
    redirect("/cardapio");
  }
  return (
    <div style={{ padding: "0 4px" }}>
      <CardapioFormClient mode="create" brands={brands} />
    </div>
  );
}
