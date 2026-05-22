"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Eye, FileText, Loader2, Plus, Trash2, X } from "lucide-react";
import {
  uploadDocument,
  deleteDocument,
  getDocumentSignedUrl,
} from "@/lib/pessoas/document-actions";
import {
  DOCUMENT_TIPO_LABELS,
  getDocStatus,
  type EmployeeDocument,
  type EmployeeDocumentTipo,
} from "@kph/db/types/pessoas";

const TIPO_OPTIONS = Object.entries(DOCUMENT_TIPO_LABELS) as [EmployeeDocumentTipo, string][];

const STATUS_META = {
  valido:       { label: "Válido",        fg: "#15803D", bg: "rgba(34,197,94,0.14)" },
  vencendo:     { label: "Vence em 30d",  fg: "#A16207", bg: "rgba(245,158,11,0.14)" },
  vencido:      { label: "Vencido",       fg: "#B91C1C", bg: "rgba(239,68,68,0.14)" },
  sem_validade: { label: "Sem validade",  fg: "var(--text-3)", bg: "var(--surface)" },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function formatBytes(b: number | null) {
  if (!b) return "";
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

type Props = {
  employeeId: string;
  records: EmployeeDocument[];
};

export function DocumentosTab({ employeeId, records }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalErr, setModalErr] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const vencidos = records.filter((d) => getDocStatus(d.data_validade) === "vencido").length;
  const vencendo = records.filter((d) => getDocStatus(d.data_validade) === "vencendo").length;

  async function handleView(id: string) {
    setLoadingId(id);
    const res = await getDocumentSignedUrl(id);
    setLoadingId(null);
    if (res.ok) window.open(res.data, "_blank");
    else alert(res.error);
  }

  async function handleDelete(id: string) {
    if (!confirm("Deletar documento? Ação irreversível.")) return;
    setLoadingId(id);
    const res = await deleteDocument(id);
    setLoadingId(null);
    if (res.ok) startTransition(() => router.refresh());
    else alert(res.error);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    setSaving(true);
    setModalErr("");
    const fd = new FormData(formRef.current);
    fd.set("employeeId", employeeId);
    const res = await uploadDocument(fd);
    setSaving(false);
    if (res.ok) {
      setShowModal(false);
      formRef.current.reset();
      startTransition(() => router.refresh());
    } else {
      setModalErr(res.error);
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      {/* Alert banners */}
      {vencidos > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 14px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8,
            fontSize: 13,
            color: "#B91C1C",
            fontWeight: 500,
            marginBottom: 10,
          }}
        >
          <AlertTriangle size={15} />
          {vencidos} documento{vencidos > 1 ? "s" : ""} vencido{vencidos > 1 ? "s" : ""}.
        </div>
      )}
      {vencendo > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 14px",
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.3)",
            borderRadius: 8,
            fontSize: 13,
            color: "#92400E",
            fontWeight: 500,
            marginBottom: 10,
          }}
        >
          <AlertTriangle size={15} />
          {vencendo} documento{vencendo > 1 ? "s" : ""} vence{vencendo > 1 ? "m" : ""} em 30 dias.
        </div>
      )}

      {/* List card */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "13px 16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
            Documentos ({records.length})
          </span>
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 12px",
              background: "var(--brand)",
              color: "#fff",
              border: "none",
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Plus size={13} /> Adicionar
          </button>
        </div>

        {records.length === 0 ? (
          <div style={{ padding: 36, textAlign: "center", fontSize: 13, color: "var(--text-3)" }}>
            <FileText size={28} style={{ margin: "0 auto 10px", opacity: 0.35 }} />
            Nenhum documento cadastrado.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Tipo", "Nome", "Emissão", "Validade", "Status", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 14px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-3)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((doc) => {
                  const status = getDocStatus(doc.data_validade);
                  const meta = STATUS_META[status];
                  const isLoading = loadingId === doc.id;
                  return (
                    <tr key={doc.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "9px 14px", color: "var(--text-2)", whiteSpace: "nowrap" }}>
                        {DOCUMENT_TIPO_LABELS[doc.tipo] ?? doc.tipo}
                      </td>
                      <td style={{ padding: "9px 14px", color: "var(--text)", maxWidth: 200 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {doc.nome}
                        </div>
                        {doc.file_size && (
                          <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                            {formatBytes(doc.file_size)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "9px 14px", color: "var(--text-2)", whiteSpace: "nowrap" }}>
                        {formatDate(doc.data_emissao)}
                      </td>
                      <td style={{ padding: "9px 14px", color: "var(--text-2)", whiteSpace: "nowrap" }}>
                        {formatDate(doc.data_validade)}
                      </td>
                      <td style={{ padding: "9px 14px" }}>
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
                      <td style={{ padding: "9px 14px" }}>
                        <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                          {doc.file_path && (
                            <button
                              onClick={() => handleView(doc.id)}
                              disabled={isLoading}
                              title="Visualizar"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "4px 9px",
                                background: "transparent",
                                border: "1px solid var(--border)",
                                borderRadius: 6,
                                fontSize: 12,
                                color: "var(--text-2)",
                                cursor: "pointer",
                              }}
                            >
                              {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
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
                              padding: "4px 7px",
                              background: "transparent",
                              border: "1px solid var(--border)",
                              borderRadius: 6,
                              color: "#B91C1C",
                              cursor: "pointer",
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
              maxWidth: 520,
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
                marginBottom: 18,
              }}
            >
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                Adicionar Documento
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}
              >
                <X size={17} />
              </button>
            </div>

            <form ref={formRef} onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              {/* Tipo */}
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
                  Tipo *
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
                  Nome *
                </span>
                <input
                  name="nome"
                  required
                  placeholder="Ex: ASO Admissional Jan/2025"
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
                    Emissão
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
                    Validade
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
                  rows={2}
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
                    padding: "8px 14px",
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
                    padding: "8px 18px",
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
                  {saving && <Loader2 size={13} className="animate-spin" />}
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
