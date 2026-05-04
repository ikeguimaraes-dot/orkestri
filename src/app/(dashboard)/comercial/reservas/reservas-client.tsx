"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { listReservations, createReservation, updateReservationStatus } from "./actions";
import type { ReservationRow, ReservationStatus, ReservationOrigem } from "@/types/database";

const STATUS_STYLE: Record<ReservationStatus, { bg: string; fg: string; label: string }> = {
  pendente:   { bg: "rgba(245,158,11,0.16)",  fg: "#A16207", label: "Pendente" },
  confirmada: { bg: "rgba(34,197,94,0.16)",   fg: "#15803D", label: "Confirmada" },
  cancelada:  { bg: "rgba(100,116,139,0.14)", fg: "#475569", label: "Cancelada" },
  no_show:    { bg: "rgba(239,68,68,0.16)",   fg: "#B91C1C", label: "No-show" },
  finalizada: { bg: "rgba(59,130,246,0.16)",  fg: "#1D4ED8", label: "Finalizada" },
};

const ORIGEM_COLOR: Record<ReservationOrigem, string> = {
  whatsapp:   "#25D366",
  instagram:  "#E1306C",
  tagme:      "#F97316",
  telefone:   "var(--text-3)",
  email:      "var(--text-3)",
  presencial: "var(--text-3)",
};

const ORIGEM_LABEL: Record<ReservationOrigem, string> = {
  whatsapp:   "WhatsApp",
  instagram:  "Instagram",
  tagme:      "TagMe",
  telefone:   "Telefone",
  email:      "E-mail",
  presencial: "Presencial",
};

function StatusBadge({ status }: { status: ReservationStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span style={{
      display: "inline-block",
      background: s.bg,
      color: s.fg,
      fontSize: 11,
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: 20,
      whiteSpace: "nowrap",
    }}>
      {s.label}
    </span>
  );
}

function OrigemBadge({ origem }: { origem: ReservationOrigem }) {
  return (
    <span style={{
      display: "inline-block",
      fontSize: 11,
      fontWeight: 600,
      color: ORIGEM_COLOR[origem],
      whiteSpace: "nowrap",
    }}>
      {ORIGEM_LABEL[origem]}
    </span>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "14px 20px",
      minWidth: 120,
      flex: 1,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  cliente_nome: "",
  cliente_telefone: "",
  cliente_email: "",
  data: "",
  hora: "",
  pax: "2",
  origem: "telefone" as ReservationOrigem,
  mesa: "",
  observacoes: "",
};

export function ReservasClient({
  unitId,
  reservas,
  today,
}: {
  unitId: string;
  unitName: string;
  reservas: ReservationRow[];
  today: string;
}) {
  const [rows, setRows] = useState<ReservationRow[]>(reservas);
  const [dateFilter, setDateFilter] = useState(today);
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [formPending, startFormTransition] = useTransition();

  function handleDateChange(newDate: string) {
    setDateFilter(newDate);
    startTransition(async () => {
      const newRows = await listReservations(unitId, newDate);
      setRows(newRows);
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !r.cliente_nome.toLowerCase().includes(q) && !(r.cliente_telefone ?? "").includes(q)) return false;
      return true;
    });
  }, [rows, statusFilter, search]);

  const totalDia = rows.length;
  const confirmadas = rows.filter((r) => r.status === "confirmada").length;
  const pendentes = rows.filter((r) => r.status === "pendente").length;

  function handleStatusAction(id: string, status: ReservationStatus) {
    startTransition(async () => {
      const res = await updateReservationStatus(id, status, null);
      if (res.ok) {
        setRows((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
      }
    });
  }

  function handleFormChange(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleFormSubmit() {
    if (!form.cliente_nome.trim()) { setFormError("Nome do cliente é obrigatório."); return; }
    if (!form.data) { setFormError("Data é obrigatória."); return; }
    if (!form.hora) { setFormError("Hora é obrigatória."); return; }
    if (!form.pax || Number(form.pax) < 1) { setFormError("Número de pessoas deve ser >= 1."); return; }
    setFormError(null);

    startFormTransition(async () => {
      const res = await createReservation({
        unit_id: unitId,
        cliente_nome: form.cliente_nome.trim(),
        cliente_telefone: form.cliente_telefone.trim() || null,
        cliente_email: form.cliente_email.trim() || null,
        data: form.data,
        hora: form.hora,
        pax: Number(form.pax),
        origem: form.origem,
        mesa: form.mesa.trim() || null,
        observacoes: form.observacoes.trim() || null,
        status: "pendente",
        created_by: null,
      });

      if (!res.ok) {
        setFormError(res.error);
        return;
      }

      setRows((prev) => [...prev, res.data]);
      setDialogOpen(false);
      setForm({ ...EMPTY_FORM, data: dateFilter });
    });
  }

  return (
    <div>
      {/* KPI cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <KpiCard label="Total do dia" value={totalDia} />
        <KpiCard label="Confirmadas" value={confirmadas} />
        <KpiCard label="Pendentes" value={pendentes} />
      </div>

      {/* Filtros + nova reserva */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => handleDateChange(e.target.value)}
          style={{
            height: 32,
            padding: "0 10px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: 13,
            outline: "none",
          }}
        />
        <div style={{ width: 180 }}>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter((v ?? "all") as ReservationStatus | "all")}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="confirmada">Confirmada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
              <SelectItem value="no_show">No-show</SelectItem>
              <SelectItem value="finalizada">Finalizada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          placeholder="Buscar por nome ou telefone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 240, height: 32, fontSize: 13 }}
        />
        <div style={{ marginLeft: "auto" }}>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger onClick={() => { setForm({ ...EMPTY_FORM, data: dateFilter }); setFormError(null); }}>
              <Button size="sm">
                + Nova Reserva
              </Button>
            </DialogTrigger>
            <DialogContent style={{ maxWidth: 520 }}>
              <DialogHeader>
                <DialogTitle>Nova Reserva</DialogTitle>
              </DialogHeader>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 4 }}>
                    Nome do cliente *
                  </label>
                  <Input
                    value={form.cliente_nome}
                    onChange={(e) => handleFormChange("cliente_nome", e.target.value)}
                    placeholder="Ex: Maria Silva"
                  />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 4 }}>
                      Telefone
                    </label>
                    <Input
                      value={form.cliente_telefone}
                      onChange={(e) => handleFormChange("cliente_telefone", e.target.value)}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 4 }}>
                      E-mail
                    </label>
                    <Input
                      value={form.cliente_email}
                      onChange={(e) => handleFormChange("cliente_email", e.target.value)}
                      placeholder="cliente@email.com"
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 4 }}>
                      Data *
                    </label>
                    <input
                      type="date"
                      value={form.data}
                      onChange={(e) => handleFormChange("data", e.target.value)}
                      style={{
                        width: "100%",
                        height: 36,
                        padding: "0 10px",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        background: "var(--surface)",
                        color: "var(--text)",
                        fontSize: 13,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 4 }}>
                      Hora *
                    </label>
                    <input
                      type="time"
                      value={form.hora}
                      onChange={(e) => handleFormChange("hora", e.target.value)}
                      style={{
                        width: "100%",
                        height: 36,
                        padding: "0 10px",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        background: "var(--surface)",
                        color: "var(--text)",
                        fontSize: 13,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 4 }}>
                      Pax *
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={form.pax}
                      onChange={(e) => handleFormChange("pax", e.target.value)}
                      placeholder="2"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 4 }}>
                      Mesa
                    </label>
                    <Input
                      value={form.mesa}
                      onChange={(e) => handleFormChange("mesa", e.target.value)}
                      placeholder="Ex: 12"
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 4 }}>
                    Origem *
                  </label>
                  <Select value={form.origem} onValueChange={(v) => v && handleFormChange("origem", v)}>
                    <SelectTrigger style={{ width: "100%" }}>
                      <SelectValue placeholder="Origem" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="tagme">TagMe</SelectItem>
                      <SelectItem value="telefone">Telefone</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="presencial">Presencial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 4 }}>
                    Observações
                  </label>
                  <Textarea
                    value={form.observacoes}
                    onChange={(e) => handleFormChange("observacoes", e.target.value)}
                    placeholder="Alergia, pedido especial, aniversário…"
                    rows={3}
                  />
                </div>
                {formError && (
                  <p style={{ fontSize: 12, color: "#B91C1C", margin: 0 }}>{formError}</p>
                )}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                  <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={formPending}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleFormSubmit} disabled={formPending}>
                    {formPending ? "Salvando…" : "Criar Reserva"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Estado de carregamento */}
      {pending && (
        <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8 }}>Atualizando…</div>
      )}

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: "32px 22px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
          Nenhuma reserva encontrada para os filtros selecionados.
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Pax</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mesa</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>
                      {r.cliente_nome}
                    </div>
                    {r.cliente_telefone && (
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
                        {r.cliente_telefone}
                      </div>
                    )}
                  </TableCell>
                  <TableCell style={{ fontSize: 13, color: "var(--text)", whiteSpace: "nowrap" }}>
                    {r.hora.slice(0, 5)}
                  </TableCell>
                  <TableCell className="text-right" style={{ fontSize: 13, color: "var(--text)" }}>
                    {r.pax}
                  </TableCell>
                  <TableCell>
                    <OrigemBadge origem={r.origem} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell style={{ fontSize: 13, color: "var(--text)" }}>
                    {r.mesa ?? "—"}
                  </TableCell>
                  <TableCell>
                    {r.status === "pendente" && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={() => handleStatusAction(r.id, "confirmada")}
                          disabled={pending}
                          title="Confirmar"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            border: "1px solid var(--border)",
                            background: "transparent",
                            color: "#15803D",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => handleStatusAction(r.id, "no_show")}
                          disabled={pending}
                          title="No-show"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            border: "1px solid var(--border)",
                            background: "transparent",
                            color: "#A16207",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          <Clock size={13} />
                        </button>
                        <button
                          onClick={() => handleStatusAction(r.id, "cancelada")}
                          disabled={pending}
                          title="Cancelar"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            border: "1px solid var(--border)",
                            background: "transparent",
                            color: "#B91C1C",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
