import { listAccessibleBrands } from "@/app/(dashboard)/eventos/actions";
import { listJobOpenings } from "@/app/(dashboard)/recrutamento/actions";
import { requireUser } from "@/lib/auth/server";
import { VagasClient } from "./vagas-client";

export const dynamic = "force-dynamic";

export default async function VagasPage() {
  await requireUser();

  const [vagas, brands] = await Promise.all([
    listJobOpenings(),
    listAccessibleBrands(),
  ]);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Recrutamento
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
          Vagas
        </h1>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            margin: 0,
            lineHeight: 1.55,
            maxWidth: 720,
          }}
        >
          Cada vaga tem perguntas em vídeo (RH grava) e candidatos respondem
          via app mobile. Aqui você ativa/desativa, gerencia perguntas e revisa
          respostas dos candidatos.
        </p>
      </header>

      <VagasClient vagas={vagas} brands={brands} />
    </div>
  );
}
