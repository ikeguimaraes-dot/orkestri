"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarCheck, CalendarClock, Clock, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateBR } from "@/lib/format";
import type { Vacation, VacationStatus } from "@/types/pessoas";

type VacationRow = Vacation & {
  _employee_name: string;
  _employee_funcao: string;
};

const STATUS_COLOR: Record<
  VacationStatus,
  { bg: string; fg: string; label: string }
> = {
  agendada: { bg: "rgba(59,130,246,0.16)", fg: "#1D4ED8", label: "Agendada" },
  em_andamento: {
    bg: "rgba(245,158,11,0.16)",
    fg: "#A16207",
    label: "Em andamento",
  },
  concluida: { bg: "rgba(34,197,94,0.16)", fg: "#15803D", label: "Concluída" },
  cancelada: { bg: "rgba(239,68,68,0.16)", fg: "#B91C1C", label: "Cancelada" },
};

const TZ_TODAY = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export function FeriasConsolidadoClient({
  unitName,
  vacations,
}: {
  unitName: string;
  vacations: VacationRow[];
}) {
  const [statusFilter, setStatusFilter] = useState<VacationStatus | "all">(
    "all",
  );
  const [search, setSearch] = useState("");

  // Cards do topo — calculados sobre todas as férias (não dependem do filtro).
  const counts = useMemo(() => {
    const today = TZ_TODAY();
    const in30 = new Date(today);
    in30.setDate(today.getDate() + 30);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    let agendadasProx = 0;
    let emAndamento = 0;
    let concluidasMes = 0;

    for (const v of vacations) {
      const start = new Date(`${v.start_date}T00:00:00`);
      if (v.status === "agendada" && start >= today && start <= in30) {
        agendadasProx++;
      }
      if (v.status === "em_andamento") emAndamento++;
      if (
        v.status === "concluida" &&
        new Date(`${v.end_date}T00:00:00`) >= monthStart
      ) {
        concluidasMes++;
      }
    }
    return { agendadasProx, emAndamento, concluidasMes };
  }, [vacations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vacations.filter((v) => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (q && !v._employee_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [vacations, statusFilter, search]);

  return (
    <div>
      {/* Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 22,
        }}
      >
        <Card
          icon={<CalendarClock size={18} />}
          label="Agendadas próximas (30d)"
          value={counts.agendadasProx}
        />
        <Card
          icon={<Clock size={18} />}
          label="Em andamento agora"
          value={counts.emAndamento}
        />
        <Card
          icon={<CalendarCheck size={18} />}
          label="Concluídas este mês"
          value={counts.concluidasMes}
        />
      </div>

      {/* Filtros */}
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
            placeholder="Buscar por colaborador…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger style={{ width: 200 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="agendada">Agendadas</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="concluida">Concluídas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
        <div
          style={{ fontSize: 12, color: "var(--text-3)", marginLeft: "auto" }}
        >
          {unitName} · {filtered.length} período
          {filtered.length === 1 ? "" : "s"}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            color: "var(--text-3)",
            fontSize: 13,
            background: "var(--surface)",
            border: "1px dashed var(--border)",
            borderRadius: 8,
          }}
        >
          Nenhuma férias para o filtro atual.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Dias</TableHead>
              <TableHead>Dobrado</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((v) => {
              const c = STATUS_COLOR[v.status];
              return (
                <TableRow key={v.id}>
                  <TableCell>
                    <Link
                      href={`/pessoas/colaboradores/${v.employee_id}`}
                      style={{
                        fontWeight: 600,
                        color: "var(--text)",
                        textDecoration: "none",
                      }}
                    >
                      {v._employee_name}
                    </Link>
                    {v._employee_funcao && (
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                        {v._employee_funcao}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <strong>{formatDateBR(v.start_date)}</strong>
                    <span style={{ color: "var(--text-3)" }}> → </span>
                    <strong>{formatDateBR(v.end_date)}</strong>
                  </TableCell>
                  <TableCell
                    className="text-right"
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 700,
                      color: "var(--brand)",
                    }}
                  >
                    {v.days_taken ?? "—"}
                  </TableCell>
                  <TableCell style={{ color: "var(--text-3)" }}>
                    {v.is_double_pay ? "Sim" : "Não"}
                  </TableCell>
                  <TableCell>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: 999,
                        background: c.bg,
                        color: c.fg,
                        fontWeight: 600,
                        fontSize: 11,
                      }}
                    >
                      {c.label}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function Card({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 99,
          background: "var(--brand-soft)",
          color: "var(--brand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "var(--text)",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
            marginTop: 2,
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
