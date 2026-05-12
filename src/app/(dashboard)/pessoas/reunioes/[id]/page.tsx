import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { getReuniao } from "../actions";
import { ReuniaoDetalheClient } from "./reuniao-detalhe-client";

export const dynamic = "force-dynamic";

export default async function ReuniaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const reuniao = await getReuniao(id);
  if (!reuniao) notFound();

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <Link
        href="/pessoas/reunioes"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "var(--text-3)",
          textDecoration: "none",
          marginBottom: 20,
        }}
      >
        <ArrowLeft size={14} />
        Reuniões 1:1
      </Link>

      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.6,
          textTransform: "uppercase",
          color: "var(--text-3)",
          marginBottom: 4,
        }}
      >
        Pessoas · Reuniões
      </div>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          margin: "0 0 20px",
          color: "var(--text)",
          letterSpacing: -0.3,
        }}
      >
        {reuniao.gestor.nome} ↔ {reuniao.colaborador.nome}
      </h1>

      <ReuniaoDetalheClient reuniao={reuniao} />
    </div>
  );
}
