import { redirect } from "next/navigation";
import { requireUser } from "@kph/auth/server";

// Raiz do dashboard — redireciona pro Dashboard Executivo (E3).
export default async function DashboardRootPage() {
  await requireUser();
  redirect("/dashboard");
}
