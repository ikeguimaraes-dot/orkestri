"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Search } from "lucide-react";

import { Input } from "@kph/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kph/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@kph/ui/table";
import {
  PERIODICIDADE_LABEL,
  type PerformanceTemplateWithBrand,
} from "@/lib/avaliacoes/types";

export function TemplatesAvaliacaoClient({
  templates,
}: {
  templates: PerformanceTemplateWithBrand[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ativos" | "inativos" | "todos">(
    "ativos",
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (statusFilter === "ativos" && !t.ativo) return false;
      if (statusFilter === "inativos" && t.ativo) return false;
      if (q) {
        const hay = `${t.nome} ${t.descricao ?? ""} ${t.funcao ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [templates, search, statusFilter]);

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", minWidth: 240, flex: 1 }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-3)",
              pointerEvents: "none",
            }}
          />
          <Input
            placeholder="Buscar nome, descrição, função…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => v && setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger style={{ minWidth: 130 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Ativos</SelectItem>
            <SelectItem value="inativos">Inativos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {templates.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
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
          Nenhum template com esses filtros.
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--surface)",
            overflow: "hidden",
          }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Marca / Unidade</TableHead>
                <TableHead style={{ textAlign: "center" }}>Periodicidade</TableHead>
                <TableHead style={{ textAlign: "center" }}>Critérios</TableHead>
                <TableHead style={{ textAlign: "right" }}>Avaliações</TableHead>
                <TableHead style={{ textAlign: "center" }}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow
                  key={t.id}
                  onClick={() =>
                    router.push(`/pessoas/avaliacoes/templates/${t.id}`)
                  }
                  style={{ cursor: "pointer" }}
                >
                  <TableCell>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                      {t.nome}
                    </div>
                    {t.descricao && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-3)",
                          marginTop: 2,
                          maxWidth: 360,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t.descricao}
                      </div>
                    )}
                  </TableCell>
                  <TableCell style={{ fontSize: 12, color: "var(--text-2)" }}>
                    {t.funcao ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: t.brand_color ?? "var(--text-2)",
                      }}
                    >
                      {t.brand_name ?? "—"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {t.unit_name ?? "todas unidades"}
                    </div>
                  </TableCell>
                  <TableCell style={{ textAlign: "center", fontSize: 12, color: "var(--text-2)" }}>
                    {PERIODICIDADE_LABEL[t.periodicidade]}
                  </TableCell>
                  <TableCell
                    style={{
                      textAlign: "center",
                      fontSize: 12,
                      fontVariantNumeric: "tabular-nums",
                      color: "var(--text-2)",
                    }}
                  >
                    {t.criterios?.length ?? 0}
                  </TableCell>
                  <TableCell
                    style={{
                      textAlign: "right",
                      fontSize: 12,
                      fontVariantNumeric: "tabular-nums",
                      color: "var(--text-2)",
                    }}
                  >
                    {t.reviews_count}
                  </TableCell>
                  <TableCell style={{ textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 99,
                        background: t.ativo
                          ? "rgba(34,197,94,0.12)"
                          : "var(--surface-2)",
                        color: t.ativo ? "#22C55E" : "var(--text-3)",
                      }}
                    >
                      {t.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: "56px 20px",
        textAlign: "center",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 99,
          background: "var(--brand-soft)",
          color: "var(--brand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 8px",
        }}
      >
        <ClipboardCheck size={20} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
        Nenhum template de avaliação
      </div>
      <p style={{ fontSize: 12, color: "var(--text-3)", margin: "6px 0 14px" }}>
        Crie templates por função pra padronizar avaliações de desempenho.
      </p>
    </div>
  );
}
