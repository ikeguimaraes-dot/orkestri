import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import {
  getEmployeeByUser,
  listFeedbacksRecebidos,
  listFeedbacksEnviados,
} from "./actions";
import { FeedbackClient } from "./feedback-client";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  await requireUser();

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 24,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            Pessoas · Feedback
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              margin: "6px 0 4px",
              color: "var(--text)",
              letterSpacing: -0.4,
            }}
          >
            Feedback Contínuo
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, maxWidth: 580 }}>
            Feedbacks positivos e de desenvolvimento entre colaboradores da unidade.
          </p>
        </div>
        <Link
          href="/pessoas/feedback/novo"
          className={buttonVariants({ variant: "default" })}
        >
          <Plus size={15} style={{ marginRight: 6 }} />
          Dar feedback
        </Link>
      </header>

      <Suspense
        fallback={
          <div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>
        }
      >
        <FeedbackSection />
      </Suspense>
    </div>
  );
}

async function FeedbackSection() {
  const unit = await getCurrentUnit();

  if (!unit) {
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px dashed var(--border)",
          borderRadius: 8,
          padding: "32px 22px",
          textAlign: "center",
          color: "var(--text-3)",
          fontSize: 13,
        }}
      >
        Selecione uma unit no menu para ver os feedbacks.
      </div>
    );
  }

  const user = await requireUser();
  const myEmployee = await getEmployeeByUser(user.id, unit.id);

  const [recebidos, enviados] = myEmployee
    ? await Promise.all([
        listFeedbacksRecebidos(myEmployee.id),
        listFeedbacksEnviados(myEmployee.id),
      ])
    : [[], []];

  return (
    <>
      {!myEmployee && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(245,158,11,0.10)",
            border: "1px solid rgba(245,158,11,0.35)",
            borderRadius: 10,
            fontSize: 13,
            color: "#A16207",
            marginBottom: 16,
          }}
        >
          Seu usuário não está vinculado a um colaborador nesta unit. Feedbacks não podem ser exibidos ou criados.
        </div>
      )}

      <FeedbackClient
        feedbacksRecebidos={recebidos}
        feedbacksEnviados={enviados}
        hasEmployee={!!myEmployee}
      />
    </>
  );
}
