"use client";

import type {
  CicloDetalhe,
  CicloStatus,
  AvaliacaoParticipante,
} from "@/app/(dashboard)/pessoas/avaliacoes/actions";
import { formatDateBR } from "@/lib/format";

const STATUS_LABEL: Record<CicloStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  encerrado: "Encerrado",
};

const STATUS_COLOR: Record<CicloStatus, { fg: string; bg: string }> = {
  aberto: { fg: "#1D4ED8", bg: "rgba(59,130,246,0.14)" },
  em_andamento: { fg: "#92400E", bg: "rgba(245,158,11,0.14)" },
  encerrado: { fg: "#15803D", bg: "rgba(34,197,94,0.14)" },
};

const PART_STATUS_COLOR: Record<"pendente" | "concluido", { fg: string; bg: string }> = {
  pendente: { fg: "var(--text-3)", bg: "var(--surface-2)" },
  concluido: { fg: "#15803D", bg: "rgba(34,197,94,0.14)" },
};

const TIPO_LABEL: Record<AvaliacaoParticipante["tipo_avaliador"], string> = {
  autoavaliacao: "Autoavaliação",
  par: "Par",
  gestor: "Gestor",
  liderado: "Liderado",
};

export function CicloDetalheClient({ ciclo }: { ciclo: CicloDetalhe }) {
  const meta = STATUS_COLOR[ciclo.status];
  const total = ciclo.participantes.length;
  const concluidos = ciclo.participantes.filter((p) => p.status === "concluido").length;
  const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  // Agrupa participantes por avaliado
  const byAvaliado = new Map<
    string,
    { nome: string; sobrenome: string; funcao: string; participantes: typeof ciclo.participantes }
  >();
  for (const p of ciclo.participantes) {
    const key = p.avaliado_id;
    if (!byAvaliado.has(key)) {
      byAvaliado.set(key, {
        nome: p.avaliado_nome,
        sobrenome: p.avaliado_sobrenome,
        funcao: p.avaliado_funcao,
        participantes: [],
      });
    }
    byAvaliado.get(key)!.participantes.push(p);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Cabeçalho do ciclo */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 2 }}>
            {formatDateBR(ciclo.data_inicio)} → {formatDateBR(ciclo.data_fim)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 99,
                background: meta.bg,
                color: meta.fg,
              }}
            >
              {STATUS_LABEL[ciclo.status]}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            Progresso: {concluidos}/{total} avaliações
          </div>
          <div
            style={{
              width: 200,
              height: 8,
              background: "var(--surface-2)",
              borderRadius: 99,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: pct === 100 ? "#22C55E" : "var(--brand)",
                borderRadius: 99,
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{pct}% concluído</div>
        </div>
      </div>

      {/* Participantes agrupados por avaliado */}
      {total === 0 ? (
        <div
          style={{
            padding: "32px 16px",
            textAlign: "center",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--text-3)",
            fontSize: 13,
          }}
        >
          Nenhum participante cadastrado neste ciclo.
        </div>
      ) : (
        Array.from(byAvaliado.entries()).map(([avaliadoId, group]) => (
          <div
            key={avaliadoId}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                background: "var(--surface-2)",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                  {group.nome} {group.sobrenome}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>{group.funcao}</div>
              </div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>Avaliador</Th>
                  <Th>Tipo</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {group.participantes.map((p) => {
                  const pMeta = PART_STATUS_COLOR[p.status];
                  return (
                    <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <Td>
                        {p.avaliador_nome} {p.avaliador_sobrenome}
                      </Td>
                      <Td>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 99,
                            background: "var(--brand-soft)",
                            color: "var(--brand)",
                          }}
                        >
                          {TIPO_LABEL[p.tipo_avaliador]}
                        </span>
                      </Td>
                      <Td>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 99,
                            background: pMeta.bg,
                            color: pMeta.fg,
                          }}
                        >
                          {p.status === "concluido" ? "Concluído" : "Pendente"}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "8px 14px",
        textAlign: "left",
        fontSize: 11,
        fontWeight: 700,
        color: "var(--text-3)",
        textTransform: "uppercase",
        letterSpacing: 0.6,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--text)" }}>
      {children}
    </td>
  );
}
