"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Eye,
  FileText,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kph/ui/select";
import {
  uploadDocument,
  deleteDocument,
  getDocumentSignedUrl,
} from "@/lib/pessoas/document-actions";
import {
  DOCUMENT_TIPO_LABELS,
  getDocStatus,
  type EmployeeDocumentWithEmployee,
  type EmployeeDocumentTipo,
} from "@kph/db/types/pessoas";
import type { BrandOption } from "@/lib/pessoas/headcount-actions";

type EmployeeStub = { id: string; nome: string; sobrenome: string; funcao: string };

type Props = {
  brandId: string;
  brands: BrandOption[];
  docs: EmployeeDocumentWithEmployee[];
  employees: EmployeeStub[];
  stats: { total: number; vencidos: number; vencendo_30d: number; sem_validade: number };
};

const STATUS_META = {
  valido:       { label: "Válido",          fg: "#15803D", bg: "rgba(34,197,94,0.14)" },
  vencendo:     { label: "Vence em 30d",    fg: "#A16207", bg: "rgba(245,158,11,0.14)" },
  vencido:      { label: "Vencido",         fg: "#B91C1C", bg: "rgba(239,68,68,0.14)" },
  sem_validade: { label: "Sem validade",    fg: "var(--text-3)", bg: "var(--surface)" },
};

const TIPO_OPTIONS = Object.entries(DOCUMENT_TIPO_LABELS) as [EmployeeDocumentTipo, string][];

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function formatBytes(b: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function KpiCard({
  label,
  value,
  fg,
  bg,
}: {
  label: string;
  value: number;
  fg: string;
  bg: string;
}) {
  return (
    <div
      style={{
        flex: "1 1 160px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "18px 20px",
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 700, color: fg }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

export function DocumentosClient({ brandId, brands, docs, employees, stats }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // filters (local)
  const [empSearch, setEmpSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<EmployeeDocumentTipo | "">("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "vencidos" | "vencendo_30d" | "validos">("todos");

  // modal
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalErr, setModalErr] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // view/delete state
  const [loadingId, setLoadingId] = useState<string | null>(null);

  function navigate(brand: string) {
    const sp = new URLSearchParams();
    if (brand) sp.set("brandId", brand);
    startTransition(() => router.push(`/pessoas/documentos?${sp.toString()}`));
  }

  // apply local filters
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);
  const todayStr = today.toISOString().slice(0, 10);
  const in30Str = in30.toISOString().slice(0, 10);

  const filtered = docs.filter((d) => {
    if (tipoFilter && d.tipo !== tipoFilter) return false;
    if (statusFilter !== "todos") {
      const v = d.data_validade;
      if (statusFilter === "vencidos" && !(v && v < todayStr)) return false;
      if (statusFilter === "vencendo_30d" && !(v && v >= todayStr && v <= in30Str)) return false;
      if (statusFilter === "validos" && !(v == null || v > in30Str)) return false;
    }
    if (empSearch.trim()) {
      const q = empSearch.toLowerCase();
      const fullName = d.employee
        ? `${d.employee.nome} ${d.employee.sobrenome}`.toLowerCase()
        : "";
      if (!fullName.includes(q)) return false;
    }
    return true;
  });

  async function handleView(id: string) {
    setLoadingId(id);
    const res = await getDocumentSignedUrl(id);
    setLoadingId(null);
    if (res.ok) {
      window.open(res.data, "_blank");
    } else {
      alert(res.error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Deletar documento? Ação irreversível.")) return;
    setLoadingId(id);
    const res = await deleteDocument(id);
    setLoadingId(null);
    if (res.ok) {
      router.refresh();
    } else {
      alert(res.error);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    setSaving(true);
    setModalErr("");
    const fd = new FormData(formRef.current);
    const res = await uploadDocument(fd);
    setSaving(false);
    if (res.ok) {
      setShowModal(false);
      formRef.current.reset();
      router.refresh();
    } else {
      setModalErr(res.error);
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: -0.3 }}
          >
            Documentos
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 2 }}>
            Compliance trabalhista · 24 tipos de documento
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            background: "var(--brand)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Plus size={15} />
          Adicionar Documento
        </button>
      </div>

      {/* Alertas */}
      {stats.vencidos > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8,
            marginBottom: 10,
            fontSize: 13,
            color: "#B91C1C",
            fontWeight: 500,
          }}
        >
          <AlertTriangle size={16} />
          {stats.vencidos} documento{stats.vencidos > 1 ? "s" : ""} vencido
          {stats.vencidos > 1 ? "s" : ""}. Risco trabalhista.
        </div>
      )}
      {stats.vencendo_30d > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.3)",
            borderRadius: 8,
            marginBottom: 10,
            fontSize: 13,
            color: "#92400E",
            fontWeight: 500,
          }}
        >
          <AlertTriangle size={16} />
          {stats.vencendo_30d} documento{stats.vencendo_30d > 1 ? "s" : ""} vence
          {stats.vencendo_30d > 1 ? "m" : ""} nos próximos 30 dias.
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <KpiCard label="Total cadastrados" value={stats.total} fg="var(--text)" bg="var(--surface)" />
        <KpiCard label="Vencidos" value={stats.vencidos} fg="#B91C1C" bg="rgba(239,68,68,0.08)" />
        <KpiCard label="Vencendo em 30d" value={stats.vencendo_30d} fg="#A16207" bg="rgba(245,158,11,0.08)" />
        <KpiCard label="Sem validade" value={stats.sem_validade} fg="var(--text-3)" bg="var(--surface)" />
      </div>

      {/* Filters */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "12px 16px",
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        {/* Brand */}
        <Select value={brandId || "__all__"} onValueChange={(v) => navigate(v === "__all__" ? "" : (v ?? ""))}>
          <SelectTrigger style={{ width: 180, fontSize: 13 }}>
            <SelectValue>
              {brandId ? (brands.find((b) => b.id === brandId)?.name ?? "—") : "Todas as marcas"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as marcas</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Employee search */}
        <input
          type="text"
          placeholder="Buscar colaborador..."
          value={empSearch}
          onChange={(e) => setEmpSearch(e.target.value)}
          style={{
            flex: "1 1 180px",
            padding: "7px 12px",
            border: "1px solid var(--border)",
            borderRadius: 7,
            fontSize: 13,
            background: "transparent",
            color: "var(--text)",
            outline: "none",
          }}
        />

        {/* Tipo */}
        <Select value={tipoFilter || "__all__"} onValueChange={(v) => setTipoFilter(v === "__all__" ? "" : (v as EmployeeDocumentTipo))}>
          <SelectTrigger style={{ width: 200, fontSize: 13 }}>
            <SelectValue>
              {tipoFilter ? DOCUMENT_TIPO_LABELS[tipoFilter] : "Todos os tipos"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os tipos</SelectItem>
            {TIPO_OPTIONS.map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status */}
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger style={{ width: 160, fontSize: 13 }}>
            <SelectValue>
              {{ todos: "Todos os status", validos: "Válidos", vencendo_30d: "Vencendo em 30d", vencidos: "Vencidos" }[statusFilter]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="validos">Válidos</SelectItem>
            <SelectItem value="vencendo_30d">Vencendo em 30d</SelectItem>
            <SelectItem value="vencidos">Vencidos</SelectItem>
          </SelectContent>
        </Select>

        {isPending && <Loader2 size={16} style={{ color: "var(--text-3)", animation: "spin 1s linear infinite" }} />}
      </div>

      {/* Table */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              padding: 48,
              textAlign: "center",
              fontSize: 14,
              color: "var(--text-3)",
            }}
          >
            <FileText size={32} style={{ margin: "0 auto 12px", opacity: 0.35 }} />
            Nenhum documento encontrado.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border)",
                  background: "color-mix(in srgb, var(--border) 30%, transparent)",
                }}
              >
                {["Colaborador", "Tipo", "Nome", "Emissão", "Validade", "Status", ""].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-3)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => {
                const status = getDocStatus(doc.data_validade);
                const meta = STATUS_META[status];
                const emp = doc.employee;
                const isLoading = loadingId === doc.id;
                return (
                  <tr
                    key={doc.id}
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td style={{ padding: "10px 14px" }}>
                      {emp ? (
                        <div>
                          <div style={{ fontWeight: 500, color: "var(--text)" }}>
                            {emp.nome} {emp.sobrenome}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{emp.funcao}</div>
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-3)" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-2)" }}>
                      {DOCUMENT_TIPO_LABELS[doc.tipo] ?? doc.tipo}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text)", maxWidth: 220 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {doc.nome}
                      </div>
                      {doc.file_size && (
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                          {formatBytes(doc.file_size)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-2)", whiteSpace: "nowrap" }}>
                      {formatDate(doc.data_emissao)}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-2)", whiteSpace: "nowrap" }}>
                      {formatDate(doc.data_validade)}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 9px",
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 600,
                          color: meta.fg,
                          background: meta.bg,
                        }}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        {doc.file_path && (
                          <button
                            onClick={() => handleView(doc.id)}
                            disabled={isLoading}
                            title="Visualizar"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "5px 10px",
                              background: "transparent",
                              border: "1px solid var(--border)",
                              borderRadius: 6,
                              fontSize: 12,
                              color: "var(--text-2)",
                              cursor: "pointer",
                            }}
                          >
                            {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
                            Ver
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(doc.id)}
                          disabled={isLoading}
                          title="Deletar"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "5px 8px",
                            background: "transparent",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            color: "#B91C1C",
                            cursor: "pointer",
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Upload Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              width: "100%",
              maxWidth: 560,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                Adicionar Documento
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}
              >
                <X size={18} />
              </button>
            </div>

            <form ref={formRef} onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Colaborador */}
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
                  Colaborador *
                </span>
                <select
                  name="employeeId"
                  required
                  style={{
                    padding: "8px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 7,
                    fontSize: 13,
                    background: "var(--surface)",
                    color: "var(--text)",
                  }}
                >
                  <option value="">Selecione...</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome} {e.sobrenome} — {e.funcao}
                    </option>
                  ))}
                </select>
              </label>

              {/* Tipo */}
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
                  Tipo de documento *
                </span>
                <select
                  name="tipo"
                  required
                  style={{
                    padding: "8px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 7,
                    fontSize: 13,
                    background: "var(--surface)",
                    color: "var(--text)",
                  }}
                >
                  <option value="">Selecione...</option>
                  {TIPO_OPTIONS.map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </label>

              {/* Nome */}
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
                  Nome do documento *
                </span>
                <input
                  name="nome"
                  required
                  placeholder="Ex: ASO Admissional — João Silva"
                  style={{
                    padding: "8px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 7,
                    fontSize: 13,
                    background: "transparent",
                    color: "var(--text)",
                  }}
                />
              </label>

              {/* Descrição */}
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
                  Descrição
                </span>
                <input
                  name="descricao"
                  placeholder="Opcional"
                  style={{
                    padding: "8px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 7,
                    fontSize: 13,
                    background: "transparent",
                    color: "var(--text)",
                  }}
                />
              </label>

              {/* Datas */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
                    Data de emissão
                  </span>
                  <input
                    type="date"
                    name="dataEmissao"
                    style={{
                      padding: "8px 10px",
                      border: "1px solid var(--border)",
                      borderRadius: 7,
                      fontSize: 13,
                      background: "transparent",
                      color: "var(--text)",
                    }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
                    Data de validade
                  </span>
                  <input
                    type="date"
                    name="dataValidade"
                    style={{
                      padding: "8px 10px",
                      border: "1px solid var(--border)",
                      borderRadius: 7,
                      fontSize: 13,
                      background: "transparent",
                      color: "var(--text)",
                    }}
                  />
                </label>
              </div>

              {/* Arquivo */}
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
                  Arquivo (PDF, JPG, PNG — máx. 10 MB)
                </span>
                <input
                  type="file"
                  name="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{
                    padding: "6px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 7,
                    fontSize: 13,
                    background: "transparent",
                    color: "var(--text)",
                  }}
                />
              </label>

              {/* Observações */}
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
                  Observações
                </span>
                <textarea
                  name="observacoes"
                  rows={3}
                  placeholder="Opcional"
                  style={{
                    padding: "8px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 7,
                    fontSize: 13,
                    background: "transparent",
                    color: "var(--text)",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </label>

              {modalErr && (
                <p style={{ fontSize: 12, color: "#B91C1C", margin: 0 }}>{modalErr}</p>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: "8px 16px",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: 7,
                    fontSize: 13,
                    cursor: "pointer",
                    color: "var(--text-2)",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 20px",
                    background: "var(--brand)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 7,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
