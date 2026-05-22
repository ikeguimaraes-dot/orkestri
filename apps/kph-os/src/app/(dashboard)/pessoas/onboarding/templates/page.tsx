import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { buttonVariants } from "@kph/ui/button";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import { listTemplates } from "../actions";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  await requireUser();
  const unit = await getCurrentUnit();

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
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
            <Link
              href="/pessoas/onboarding"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              Onboarding
            </Link>
            {" · Templates"}
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              margin: "6px 0 4px",
              color: "var(--text)",
              letterSpacing: -0.3,
            }}
          >
            Templates de Onboarding
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
            Defina os processos de integração reutilizáveis para novos colaboradores.
          </p>
        </div>
        <Link
          href="/pessoas/onboarding/templates/novo"
          className={buttonVariants({ variant: "default" })}
        >
          <Plus size={15} style={{ marginRight: 6 }} />
          Novo Template
        </Link>
      </header>

      {!unit ? (
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
          Selecione uma unit no menu.
        </div>
      ) : (
        <TemplatesList unitId={unit.id} />
      )}
    </div>
  );
}

async function TemplatesList({ unitId }: { unitId: string }) {
  const templates = await listTemplates(unitId);

  if (templates.length === 0) {
    return (
      <div
        style={{
          padding: "48px 24px",
          textAlign: "center",
          background: "var(--surface)",
          border: "1px dashed var(--border)",
          borderRadius: 12,
          color: "var(--text-3)",
          fontSize: 13,
        }}
      >
        Nenhum template criado ainda.{" "}
        <Link
          href="/pessoas/onboarding/templates/novo"
          style={{ color: "var(--brand)", textDecoration: "none", fontWeight: 600 }}
        >
          Criar o primeiro
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {templates.map((tpl) => (
        <div
          key={tpl.id}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text)",
                marginBottom: 3,
              }}
            >
              {tpl.nome}
            </div>
            {tpl.descricao && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-3)",
                  marginBottom: 4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 480,
                }}
              >
                {tpl.descricao}
              </div>
            )}
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
              {tpl.tarefas.length} tarefa{tpl.tarefas.length !== 1 ? "s" : ""}
            </div>
          </div>

          <Link
            href={`/pessoas/onboarding/templates/${tpl.id}`}
            className={buttonVariants({ variant: "outline", size: "sm" } as any)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Pencil size={13} />
            Editar
          </Link>
        </div>
      ))}
    </div>
  );
}
