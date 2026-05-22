"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  ExternalLink,
  Search,
} from "lucide-react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Input } from "@kph/ui/input";
import { Button, buttonVariants } from "@kph/ui/button";
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

import { approvePayslip, markPayslipPaid } from "@/lib/pessoas/actions";
import { avatarColor, formatBRL, initials } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import type { PayslipStatus, PayslipWithEmployee } from "@kph/db/types/pessoas";

const PAGE_SIZE = 15;

const STATUS_LABEL: Record<PayslipStatus, string> = {
  rascunho: "Rascunho",
  aprovado: "Aprovado",
  pago: "Pago",
};

const STATUS_COLOR: Record<PayslipStatus, { bg: string; fg: string }> = {
  rascunho: { bg: "var(--muted)", fg: "var(--muted-foreground)" },
  aprovado: { bg: "rgba(59,130,246,0.12)", fg: "#1D4ED8" },
  pago: { bg: "rgba(34,197,94,0.12)", fg: "#15803D" },
};

export function PayslipsTable({
  data,
  isFounder,
}: {
  data: PayslipWithEmployee[];
  isFounder: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PayslipStatus | "todos">("todos");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((p) => {
      const status = (p.status as PayslipStatus) ?? "rascunho";
      if (statusFilter !== "todos" && status !== statusFilter) return false;
      if (!q) return true;
      const name = `${p.employee?.nome ?? ""} ${p.employee?.sobrenome ?? ""}`.toLowerCase();
      const funcao = (p.employee?.funcao ?? "").toLowerCase();
      return name.includes(q) || funcao.includes(q);
    });
  }, [data, search, statusFilter]);

  const handleApprove = (id: string) => {
    startTransition(async () => {
      const res = await approvePayslip(id);
      if (!res.ok) {
        console.error("[PayslipsTable] approve failed:", res.error);
        alert(`Falha ao aprovar: ${res.error}`);
        return;
      }
      router.refresh();
    });
  };

  const handlePay = (id: string) => {
    startTransition(async () => {
      const res = await markPayslipPaid(id);
      if (!res.ok) {
        console.error("[PayslipsTable] pay failed:", res.error);
        alert(`Falha ao marcar como pago: ${res.error}`);
        return;
      }
      router.refresh();
    });
  };

  const columns = useMemo<ColumnDef<PayslipWithEmployee>[]>(
    () => [
      {
        accessorKey: "employee_name",
        header: ({ column }) => (
          <SortableHeader
            label="Colaborador"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        accessorFn: (r) =>
          `${r.employee?.nome ?? ""} ${r.employee?.sobrenome ?? ""}`.trim(),
        cell: ({ row }) => {
          const p = row.original;
          const name = `${p.employee?.nome ?? "—"} ${p.employee?.sobrenome ?? ""}`.trim();
          const color = avatarColor(name);
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 32, height: 32, borderRadius: 99,
                  background: `color-mix(in srgb, ${color} 18%, transparent)`,
                  color, fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {initials(name)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                  {name}
                </span>
                {p.employee?.funcao && (
                  <span style={{ fontSize: 10, color: "var(--text-3)" }}>
                    {p.employee.funcao}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "competencia",
        header: ({ column }) => (
          <SortableHeader
            label="Competência"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => (
          <span style={{ fontSize: 12, color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
            {competenciaLabel(row.original.competencia)}
          </span>
        ),
      },
      {
        accessorKey: "salario_base",
        header: ({ column }) => (
          <SortableHeader
            label="Bruto"
            align="right"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        accessorFn: (r) =>
          Number(r.salario_base) +
          Number(r.horas_extras) +
          Number(r.adicional_noturno) +
          Number(r.gorjeta) +
          Number(r.dsr_gorjeta),
        cell: ({ getValue }) => (
          <span style={{
            fontSize: 12, color: "var(--text)",
            fontVariantNumeric: "tabular-nums", display: "block", textAlign: "right",
          }}>
            {formatBRL(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "liquido",
        header: ({ column }) => (
          <SortableHeader
            label="Líquido"
            align="right"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => (
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: "var(--brand)", fontVariantNumeric: "tabular-nums",
            display: "block", textAlign: "right",
          }}>
            {formatBRL(row.original.liquido)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = (row.original.status as PayslipStatus) ?? "rascunho";
          const c = STATUS_COLOR[status];
          return (
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 11, fontWeight: 600,
                padding: "2px 8px", borderRadius: 99,
                background: c.bg, color: c.fg,
              }}
            >
              {STATUS_LABEL[status]}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const p = row.original;
          const status = (p.status as PayslipStatus) ?? "rascunho";
          return (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
              {status === "rascunho" && (
                <Button variant="outline" size="sm" onClick={() => handleApprove(p.id)}>
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  Aprovar
                </Button>
              )}
              {status === "aprovado" && isFounder && (
                <Button variant="outline" size="sm" onClick={() => handlePay(p.id)}>
                  <CircleDollarSign className="mr-1 h-3.5 w-3.5" />
                  Pago
                </Button>
              )}
              <a
                href={`/pessoas/holerites/${p.id}`}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
                title="Ver holerite"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          );
        },
      },
    ],
    // handleApprove e handlePay não estão na deps — usam startTransition+router que
    // não mudam de identidade entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isFounder],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "minmax(200px, 1fr) auto",
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative" }}>
          <Search
            size={14}
            style={{
              position: "absolute", left: 10, top: "50%",
              transform: "translateY(-50%)", color: "var(--text-3)",
            }}
          />
          <Input
            placeholder="Buscar nome ou função…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Select
            value={statusFilter}
            onValueChange={(v) => v && setStatusFilter(v as PayslipStatus | "todos")}
          >
            <SelectTrigger style={{ minWidth: 160 }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="aprovado">Aprovado</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            style={{ height: 36, gap: 6, whiteSpace: "nowrap" }}
            onClick={() => {
              const rows = filtered.map((p) => {
                const nome = `${p.employee?.nome ?? ""} ${p.employee?.sobrenome ?? ""}`.trim();
                const bruto =
                  Number(p.salario_base) +
                  Number(p.horas_extras) +
                  Number(p.adicional_noturno) +
                  Number(p.gorjeta) +
                  Number(p.dsr_gorjeta);
                return [
                  nome,
                  p.employee?.funcao ?? "",
                  p.competencia,
                  bruto.toFixed(2),
                  Number(p.liquido).toFixed(2),
                  (p.status as string) ?? "rascunho",
                ];
              });
              downloadCsv(
                `holerites-${new Date().toISOString().slice(0, 10)}.csv`,
                ["Colaborador", "Função", "Competência", "Bruto", "Líquido", "Status"],
                rows,
              );
            }}
          >
            <Download size={13} />
            CSV
          </Button>
        </div>
      </div>

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--surface)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id}>
                      {h.isPlaceholder
                        ? null
                        : flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    style={{
                      textAlign: "center",
                      padding: "48px 16px",
                      color: "var(--text-3)",
                      fontSize: 12,
                    }}
                  >
                    Nenhum holerite encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderTop: "1px solid var(--border)",
            fontSize: 11,
            color: "var(--text-3)",
          }}
        >
          <span>
            Página {table.getState().pagination.pageIndex + 1} de{" "}
            {Math.max(table.getPageCount(), 1)} · {filtered.length} holerite
            {filtered.length === 1 ? "" : "s"}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <Button
              variant="outline"
              size="sm"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  onClick,
  align = "left",
}: {
  label: string;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        background: "transparent", border: "none",
        color: "var(--text-3)", fontSize: 11, fontWeight: 600,
        letterSpacing: 0.6, textTransform: "uppercase",
        cursor: "pointer", padding: 0, margin: 0,
        marginLeft: align === "right" ? "auto" : 0,
      }}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );
}

function competenciaLabel(iso: string): string {
  const m = Number(iso.slice(5, 7));
  const y = iso.slice(0, 4);
  const meses = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  return `${meses[m - 1] ?? ""}/${y}`;
}
