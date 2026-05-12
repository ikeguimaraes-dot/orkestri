import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import {
  getEmployeeByUser,
  listColaboradoresParaFeedback,
} from "../actions";
import { NovoFeedbackClient } from "./novo-feedback-client";

export const dynamic = "force-dynamic";

export default async function NovoFeedbackPage() {
  const user = await requireUser();
  const unit = await getCurrentUnit();

  if (!unit) redirect("/pessoas/feedback");

  const myEmployee = await getEmployeeByUser(user.id, unit.id);

  if (!myEmployee) {
    redirect("/pessoas/feedback");
  }

  const colaboradores = await listColaboradoresParaFeedback(unit.id, myEmployee.id);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.6,
          textTransform: "uppercase",
          color: "var(--text-3)",
          marginBottom: 16,
        }}
      >
        Pessoas · Feedback · Novo
      </div>

      <NovoFeedbackClient
        unitId={unit.id}
        myEmployeeId={myEmployee.id}
        colaboradores={colaboradores}
      />
    </div>
  );
}
