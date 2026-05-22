"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle,
  FileUp,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";

import { Button } from "@kph/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@kph/ui/table";
import { processPontoImport, type ImportSummary } from "@/lib/pessoas/import-actions";
import {
  normalizeCpf,
  parsePontoCsv,
  type PontoCsvRow,
} from "@/lib/pessoas/csv-parser";
import type { ImportLog } from "@kph/db/types/pessoas";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("pt-BR") +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

function formatPeriodo(iso: string | null): string {
  if (!iso) return "—";
  const [y, m] = iso.split("-");
  return `${m}/${y?.slice(2)}`;
}

export function ImportClient({
  unitId,
  unitName,
  initialLogs,
}: {
  unitId: string;
  unitName: string;
  initialLogs: ImportLog[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [logs, setLogs] = useState(initialLogs);
  const [dragOver, setDragOver] = useState(false);
  const [parsedRows, setParsedRows] = useState<PontoCsvRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const readFile = useCallback((file: File) => {
    setFileName(file.name);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parsePontoCsv(text);
      if (rows.length === 0) {
        setError("CSV vazio ou formato não reconhecido.");
        setParsedRows(null);
        return;
      }
      setParsedRows(rows);
    };
    reader.readAsText(file, "ISO-8859-1");
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) readFile(file);
  }

  function handleReset() {
    setParsedRows(null);
    setFileName("");
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleImport() {
    if (!parsedRows || parsedRows.length === 0) return;
    setError(null);
    startTransition(async () => {
      const r = await processPontoImport(unitId, parsedRows);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setResult(r.data);
      // refetch local: prepend a "log" reconstruído pra UI imediata.
      setLogs((prev) => [
        {
          id: r.data.log_id,
          unit_id: unitId,
          periodo: r.data.periodo,
          tipo: "ponto",
          total_linhas: r.data.total_linhas,
          importados: r.data.importados,
          nao_encontrados: r.data.nao_encontrados.length,
          erros: r.data.erros.length,
          detalhes: { not_found: r.data.nao_encontrados, errors: r.data.erros },
          imported_by: null,
          imported_at: new Date().toISOString(),
        } as ImportLog,
        ...prev,
      ]);
    });
  }

  return (
    <>
      <header style={{ marginBottom: 18 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Pessoas · Importação
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
          Importação de Ponto (Totvs)
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
          Unidade {unitName}. Aceita CSV exportado do Totvs em ISO-8859-1.
        </p>
      </header>

      {/* Upload / Preview */}
      <Card title="Upload do CSV" icon={<Upload size={16} />}>
        {!parsedRows ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "44px 20px",
              borderRadius: 12,
              border: `2px dashed ${dragOver ? "var(--brand)" : "var(--border)"}`,
              background: dragOver ? "var(--brand-soft)" : "transparent",
              transition: "all var(--t)",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: "var(--brand-soft)",
                color: "var(--brand)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <FileUp size={26} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              Arraste o CSV aqui ou clique pra selecionar
            </div>
            <p style={{ fontSize: 11, color: "var(--text-3)", margin: "4px 0 12px" }}>
              Apenas .csv do relatório Totvs.
            </p>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              Selecionar arquivo
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                  {fileName}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {parsedRows.length} linha(s){" "}
                  {parsedRows[0]?.periodo ? `· período ${parsedRows[0].periodo}` : ""}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleReset}>
                Trocar arquivo
              </Button>
            </div>

            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                overflow: "hidden",
                background: "var(--surface)",
              }}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>H. previstas</TableHead>
                    <TableHead>H. trabalhadas</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Faltas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 5).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell style={{ fontSize: 13, fontWeight: 500 }}>
                        {r.nome}
                      </TableCell>
                      <TableCell style={{ fontSize: 12, color: "var(--text-2)" }}>
                        {normalizeCpf(r.cpf)}
                      </TableCell>
                      <TableCell style={{ fontSize: 12 }}>
                        {r.horasPrevistas || "—"}
                      </TableCell>
                      <TableCell style={{ fontSize: 12 }}>
                        {r.horasTrabalhadas || "—"}
                      </TableCell>
                      <TableCell style={{ fontSize: 12 }}>{r.saldo || "—"}</TableCell>
                      <TableCell style={{ fontSize: 12 }}>
                        {r.faltasInjustificadasDias || "0"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {parsedRows.length > 5 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        style={{
                          textAlign: "center",
                          fontSize: 11,
                          color: "var(--text-3)",
                        }}
                      >
                        … e mais {parsedRows.length - 5} linha(s)
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {!result && (
              <div>
                <Button onClick={handleImport} disabled={pending}>
                  {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmar importação
                </Button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              background: "rgba(239,68,68,0.10)",
              border: "1px solid rgba(239,68,68,0.30)",
              borderRadius: 8,
              fontSize: 12,
              color: "#B91C1C",
            }}
          >
            {error}
          </div>
        )}
      </Card>

      {/* Resultado */}
      {result && (
        <Card title={`Resultado da importação · ${formatPeriodo(result.periodo)}`}>
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              marginBottom: 14,
            }}
          >
            <ResultStat label="Total no CSV" value={String(result.total_linhas)} />
            <ResultStat
              label="Importados"
              value={String(result.importados)}
              tone="ok"
            />
            <ResultStat
              label="Não encontrados"
              value={String(result.nao_encontrados.length)}
              tone={result.nao_encontrados.length > 0 ? "warn" : "neutral"}
            />
            <ResultStat
              label="Erros"
              value={String(result.erros.length)}
              tone={result.erros.length > 0 ? "danger" : "neutral"}
            />
          </div>

          {result.nao_encontrados.length > 0 && (
            <ListBlock
              icon={<AlertTriangle size={14} />}
              tone="warn"
              title={`Não encontrados na unidade (${result.nao_encontrados.length})`}
              items={result.nao_encontrados}
            />
          )}
          {result.erros.length > 0 && (
            <ListBlock
              icon={<XCircle size={14} />}
              tone="danger"
              title={`Erros (${result.erros.length})`}
              items={result.erros}
            />
          )}

          <div style={{ marginTop: 14 }}>
            <Button variant="outline" onClick={handleReset}>
              Nova importação
            </Button>
          </div>
        </Card>
      )}

      {/* Histórico */}
      <Card title="Histórico (últimas 20)">
        {logs.length === 0 ? (
          <p
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              padding: "24px 0",
              textAlign: "center",
              margin: 0,
            }}
          >
            Nenhuma importação realizada ainda.
          </p>
        ) : (
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 10,
              overflow: "hidden",
              background: "var(--surface)",
            }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead style={{ textAlign: "right" }}>Total</TableHead>
                  <TableHead style={{ textAlign: "right" }}>Importados</TableHead>
                  <TableHead style={{ textAlign: "right" }}>Não enc.</TableHead>
                  <TableHead style={{ textAlign: "right" }}>Erros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell style={{ fontSize: 12, color: "var(--text-2)" }}>
                      {formatDateTime(log.imported_at)}
                    </TableCell>
                    <TableCell>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 99,
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                          color: "var(--text-2)",
                        }}
                      >
                        {formatPeriodo(log.periodo)}
                      </span>
                    </TableCell>
                    <TableCell style={{ fontSize: 12, color: "var(--text-2)" }}>
                      {log.tipo}
                    </TableCell>
                    <TableCell
                      style={{
                        fontSize: 12,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {log.total_linhas ?? "—"}
                    </TableCell>
                    <TableCell
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#15803D",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {log.importados ?? 0}
                    </TableCell>
                    <TableCell
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: log.nao_encontrados ? "#A16207" : "var(--text-3)",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {log.nao_encontrados ?? 0}
                    </TableCell>
                    <TableCell
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: log.erros ? "#B91C1C" : "var(--text-3)",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {log.erros ?? 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 18,
        marginBottom: 14,
      }}
    >
      <h2
        style={{
          fontSize: 15,
          fontWeight: 700,
          margin: "0 0 14px",
          color: "var(--text)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

function ResultStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "danger" | "neutral";
}) {
  const colorMap = {
    ok: "#15803D",
    warn: "#A16207",
    danger: "#B91C1C",
    neutral: "var(--text)",
  } as const;
  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 14,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: colorMap[tone],
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-3)",
          marginTop: 2,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function ListBlock({
  title,
  items,
  icon,
  tone,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
  tone: "warn" | "danger";
}) {
  const bg = tone === "warn" ? "rgba(245,158,11,0.10)" : "rgba(239,68,68,0.10)";
  const fg = tone === "warn" ? "#A16207" : "#B91C1C";
  const border =
    tone === "warn" ? "rgba(245,158,11,0.30)" : "rgba(239,68,68,0.30)";
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: fg,
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {icon}
        {title}
      </div>
      <ul
        style={{
          margin: 0,
          padding: "0 0 0 18px",
          fontSize: 12,
          color: fg,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
