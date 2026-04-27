"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import {
  ArrowUpDown, ChevronLeft, ChevronRight, MoreHorizontal,
  Pencil, UserMinus, Search,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { deactivateEmployee } from "@/lib/pessoas/actions";
import { ScoreDot } from "@/components/pessoas/ScoreBar";
import { avatarColor, formatBRL, formatDateBR, initials } from "@/lib/format";
import type { Employee, EmployeeScore } from "@/types/pessoas";

const PAGE_SIZE = 10;

export function EmployeeTable({
  data,
  scores,
}: {
  data: Employee[];
  scores?: Record<string, EmployeeScore>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [funcaoFilter, setFuncaoFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativos" | "inativos">("ativos");
  const [search, setSearch] = useState("");

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((e) => {
      if (statusFilter === "ativos" && !e.ativo) return false;
      if (statusFilter === "inativos" && e.ativo) return false;
      if (funcaoFilter !== "__all__" && e.funcao !== funcaoFilter) return false;
      if (!q) return true;
      const hay = `${e.nome} ${e.sobrenome} ${e.funcao} ${e.cpf ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data, search, funcaoFilter, statusFilter]);

  const funcoes = useMemo(() => {
    const set = new Set<string>();
    for (const e of data) if (e.funcao) set.add(e.funcao);
    return Array.from(set).sort();
  }, [data]);

  const columns = useMemo<ColumnDef<Employee>[]>(
    () => [
      {
        accessorKey: "nome",
        header: ({ column }) => (
          <SortableHeader
            label="Colaborador"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => {
          const e = row.original;
          const fullName = `${e.nome} ${e.sobrenome}`.trim();
          const s = scores?.[e.id];
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={fullName} />
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text)",
                  }}
                >
                  {s && (
                    <ScoreDot
                      score={s.score}
                      warnings={s.warnings_count}
                      absences={s.absences_count}
                    />
                  )}
                  {fullName}
                </span>
                {e.cpf && (
                  <span style={{ fontSize: 10, color: "var(--text-3)" }}>
                    CPF {e.cpf}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "funcao",
        header: ({ column }) => (
          <SortableHeader
            label="Função"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => (
          <span style={{ fontSize: 12, color: "var(--text-2)" }}>{row.original.funcao}</span>
        ),
      },
      {
        accessorKey: "salario_base",
        header: ({ column }) => (
          <SortableHeader
            label="Salário-base"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            align="right"
          />
        ),
        cell: ({ row }) => (
          <span
            style={{
              fontSize: 12,
              color: "var(--text)",
              fontVariantNumeric: "tabular-nums",
              display: "block",
              textAlign: "right",
            }}
          >
            {formatBRL(row.original.salario_base)}
          </span>
        ),
      },
      {
        accessorKey: "data_admissao",
        header: ({ column }) => (
          <SortableHeader
            label="Admissão"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => (
          <span style={{ fontSize: 12, color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
            {formatDateBR(row.original.data_admissao)}
          </span>
        ),
      },
      {
        accessorKey: "ativo",
        header: "Status",
        cell: ({ row }) => {
          const ativo = row.original.ativo;
          return (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 99,
                background: ativo ? "rgba(34,197,94,0.12)" : "var(--muted)",
                color: ativo ? "#22C55E" : "var(--muted-foreground)",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 99,
                  background: ativo ? "#22C55E" : "var(--muted-foreground)",
                }}
              />
              {ativo ? "Ativo" : "Inativo"}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const e = row.original;
          const onDeactivate = () => {
            if (!e.ativo) return;
            const ok = window.confirm(
              `Desativar ${e.nome} ${e.sobrenome}? Soft delete — preserva histórico.`,
            );
            if (!ok) return;
            startTransition(async () => {
              await deactivateEmployee(e.id);
              router.refresh();
            });
          };
          return (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={buttonVariants({ variant: "ghost", size: "icon" })}
                  aria-label="Ações"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => router.push(`/pessoas/colaboradores/${e.id}/editar`)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                  {e.ativo && (
                    <DropdownMenuItem
                      onClick={onDeactivate}
                      style={{ color: "var(--destructive)" }}
                    >
                      <UserMinus className="mr-2 h-4 w-4" />
                      Desativar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [router, startTransition, scores],
  );

  const table = useReactTable({
    data: filteredData,
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
          gridTemplateColumns: "minmax(180px, 1fr) auto auto",
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative" }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-3)",
            }}
          />
          <Input
            placeholder="Buscar nome, CPF, função…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>
        <Select
          value={funcaoFilter}
          onValueChange={(v) => setFuncaoFilter(v ?? "__all__")}
        >
          <SelectTrigger style={{ minWidth: 160 }}>
            <SelectValue placeholder="Função" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas funções</SelectItem>
            {funcoes.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => v && setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger style={{ minWidth: 140 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Ativos</SelectItem>
            <SelectItem value="inativos">Inativos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
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
                    Nenhum colaborador encontrado com esses filtros.
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
            {Math.max(table.getPageCount(), 1)} · {filteredData.length} colaborador
            {filteredData.length === 1 ? "" : "es"}
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
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: "transparent",
        border: "none",
        color: "var(--text-3)",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        cursor: "pointer",
        padding: 0,
        margin: 0,
        marginLeft: align === "right" ? "auto" : 0,
      }}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );
}

function Avatar({ name }: { name: string }) {
  const color = avatarColor(name || "?");
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 99,
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  );
}
