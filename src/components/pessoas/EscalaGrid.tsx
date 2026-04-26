"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  format,
  isSameDay,
  parse,
  parseISO,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  createShift,
  deleteShift,
  updateShift,
} from "@/lib/pessoas/actions";
import { calculateLaborCost, hoursWorked } from "@/lib/pessoas/labor";
import { avatarColor, formatBRL, initials } from "@/lib/format";
import type {
  Employee,
  Shift,
  ShiftInsert,
  ShiftTipo,
} from "@/types/pessoas";

type Props = {
  unitId: string;
  unitName: string;
  employees: Employee[];
  shifts: Shift[];
  weekStartIso: string; // "YYYY-MM-DD" (domingo)
};

type FormState = {
  employeeId: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  tipo: ShiftTipo;
  observacao: string;
};

type ModalState =
  | { open: false }
  | { open: true; mode: "create"; initial: FormState }
  | { open: true; mode: "edit"; shift: Shift; initial: FormState };

const TIPO_LABEL: Record<ShiftTipo, string> = {
  normal: "Normal",
  extra: "Extra",
  folga: "Folga",
  feriado: "Feriado",
};

export function EscalaGrid({
  unitId,
  unitName,
  employees,
  shifts: initialShifts,
  weekStartIso,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [shifts, setShifts] = useState<Shift[]>(initialShifts);
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [pendingShiftId, setPendingShiftId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // weekStartIso é usado como key no parent — trocar de semana remonta
  // o componente, então não precisamos sincronizar shifts via effect.

  const weekStart = parse(weekStartIso, "yyyy-MM-dd", new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const employeeById = useMemo(() => {
    const m = new Map<string, Employee>();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  const shiftsByCell = useMemo(() => {
    const m = new Map<string, Shift[]>();
    for (const s of shifts) {
      const key = cellKey(s.employee_id, s.data);
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }
    return m;
  }, [shifts]);

  // Totais por dia + semana.
  const totals = useMemo(() => {
    const perDay = days.map(() => ({ horas: 0, custo: 0 }));
    let weekHoras = 0;
    let weekCusto = 0;
    for (const s of shifts) {
      const emp = employeeById.get(s.employee_id);
      if (!emp) continue;
      if (s.tipo === "folga") continue;
      const horas = hoursWorked(s.hora_inicio, s.hora_fim);
      const custo = calculateLaborCost(emp.salario_base, s.hora_inicio, s.hora_fim);
      const dayIdx = days.findIndex((d) => isSameDay(d, parseISO(s.data)));
      if (dayIdx >= 0) {
        const cell = perDay[dayIdx];
        if (cell) {
          cell.horas += horas;
          cell.custo += custo;
        }
      }
      weekHoras += horas;
      weekCusto += custo;
    }
    return { perDay, weekHoras, weekCusto };
  }, [shifts, days, employeeById]);

  const navigateWeek = (offsetDays: number) => {
    const next = format(addDays(weekStart, offsetDays), "yyyy-MM-dd");
    router.push(`/pessoas/escala?inicio=${next}`);
  };

  const goToday = () => {
    const today = startOfWeek(new Date(), { weekStartsOn: 0 });
    router.push(`/pessoas/escala?inicio=${format(today, "yyyy-MM-dd")}`);
  };

  const openCreate = (employeeId: string, data: string) => {
    setModal({
      open: true,
      mode: "create",
      initial: {
        employeeId,
        data,
        horaInicio: "10:00",
        horaFim: "18:00",
        tipo: "normal",
        observacao: "",
      },
    });
  };

  const openEdit = (shift: Shift) => {
    setModal({
      open: true,
      mode: "edit",
      shift,
      initial: {
        employeeId: shift.employee_id,
        data: shift.data,
        horaInicio: shift.hora_inicio.slice(0, 5),
        horaFim: shift.hora_fim.slice(0, 5),
        tipo: (shift.tipo as ShiftTipo) ?? "normal",
        observacao: shift.observacao ?? "",
      },
    });
  };

  const closeModal = () => setModal({ open: false });

  const handleSave = (form: FormState) => {
    const emp = employeeById.get(form.employeeId);
    if (!emp) return;
    const labor = calculateLaborCost(emp.salario_base, form.horaInicio, form.horaFim);
    const horaInicioSec = `${form.horaInicio}:00`;
    const horaFimSec = `${form.horaFim}:00`;

    if (modal.open && modal.mode === "edit") {
      const id = modal.shift.id;
      setPendingShiftId(id);
      // Optimistic update.
      setShifts((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                employee_id: form.employeeId,
                data: form.data,
                hora_inicio: horaInicioSec,
                hora_fim: horaFimSec,
                tipo: form.tipo,
                observacao: form.observacao || null,
                labor_cost: labor.toFixed(2),
              }
            : s,
        ),
      );
      closeModal();
      startTransition(async () => {
        const res = await updateShift(id, {
          employee_id: form.employeeId,
          data: form.data,
          hora_inicio: horaInicioSec,
          hora_fim: horaFimSec,
          tipo: form.tipo,
          observacao: form.observacao || null,
          labor_cost: labor.toFixed(2),
        } as never);
        setPendingShiftId(null);
        if (!res.ok) {
          console.error("[EscalaGrid] updateShift failed:", res.error);
          alert(`Falha ao salvar turno: ${res.error}`);
          router.refresh();
        }
      });
      return;
    }

    // Create
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: Shift = {
      id: optimisticId,
      employee_id: form.employeeId,
      unit_id: unitId,
      data: form.data,
      hora_inicio: horaInicioSec,
      hora_fim: horaFimSec,
      tipo: form.tipo,
      labor_cost: labor.toFixed(2),
      observacao: form.observacao || null,
      created_at: new Date().toISOString(),
    };
    setShifts((prev) => [...prev, optimistic]);
    closeModal();
    startTransition(async () => {
      const payload: ShiftInsert = {
        employee_id: form.employeeId,
        unit_id: unitId,
        data: form.data,
        hora_inicio: horaInicioSec,
        hora_fim: horaFimSec,
        tipo: form.tipo,
        labor_cost: labor.toFixed(2),
        observacao: form.observacao || null,
      };
      const res = await createShift(payload);
      if (!res.ok) {
        console.error("[EscalaGrid] createShift failed:", res.error);
        alert(`Falha ao criar turno: ${res.error}`);
        // Roll back optimistic.
        setShifts((prev) => prev.filter((s) => s.id !== optimisticId));
        return;
      }
      // Trocar optimistic pelo real.
      const real = res.data;
      setShifts((prev) => prev.map((s) => (s.id === optimisticId ? real : s)));
    });
  };

  const handleDelete = () => {
    if (!modal.open || modal.mode !== "edit") return;
    const id = modal.shift.id;
    if (!window.confirm("Excluir este turno? Ação não pode ser desfeita.")) return;
    setPendingShiftId(id);
    setShifts((prev) => prev.filter((s) => s.id !== id));
    closeModal();
    startTransition(async () => {
      const res = await deleteShift(id);
      setPendingShiftId(null);
      if (!res.ok) {
        console.error("[EscalaGrid] deleteShift failed:", res.error);
        alert(`Falha ao excluir turno: ${res.error}`);
        router.refresh();
      }
    });
  };

  // Drag and drop — mover turno de uma célula pra outra.
  const handleDragStart = (e: React.DragEvent, shift: Shift) => {
    e.dataTransfer.setData("application/x-shift-id", shift.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverKey !== key) setDragOverKey(key);
  };

  const handleDragLeave = (key: string) => {
    if (dragOverKey === key) setDragOverKey(null);
  };

  const handleDrop = (
    e: React.DragEvent,
    employeeId: string,
    data: string,
  ) => {
    e.preventDefault();
    setDragOverKey(null);
    const shiftId = e.dataTransfer.getData("application/x-shift-id");
    if (!shiftId) return;
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return;
    if (shift.employee_id === employeeId && shift.data === data) return;
    const emp = employeeById.get(employeeId);
    if (!emp) return;

    const labor = calculateLaborCost(emp.salario_base, shift.hora_inicio, shift.hora_fim);
    setPendingShiftId(shift.id);
    setShifts((prev) =>
      prev.map((s) =>
        s.id === shiftId
          ? { ...s, employee_id: employeeId, data, labor_cost: labor.toFixed(2) }
          : s,
      ),
    );
    startTransition(async () => {
      const res = await updateShift(shift.id, {
        employee_id: employeeId,
        data,
        labor_cost: labor.toFixed(2),
      } as never);
      setPendingShiftId(null);
      if (!res.ok) {
        console.error("[EscalaGrid] drop updateShift failed:", res.error);
        alert(`Falha ao mover turno: ${res.error}`);
        router.refresh();
      }
    });
  };

  const rangeLabel = `${format(weekStart, "d MMM", { locale: ptBR })} — ${format(
    addDays(weekStart, 6),
    "d MMM",
    { locale: ptBR },
  )}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar: navegação + totais */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 14px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button variant="outline" size="sm" onClick={() => navigateWeek(-7)}>
            <ChevronLeft className="h-4 w-4" />
            Semana
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            <CalendarDays className="mr-2 h-3.5 w-3.5" />
            Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigateWeek(7)}>
            Semana
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text)",
              marginLeft: 8,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {rangeLabel}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>· {unitName}</span>
        </div>
        <div
          style={{
            display: "flex",
            gap: 18,
            fontSize: 12,
            color: "var(--text-2)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span>
            <span style={{ color: "var(--text-3)" }}>Horas semana:</span>{" "}
            <span style={{ color: "var(--text)", fontWeight: 600 }}>
              {totals.weekHoras.toFixed(1)}h
            </span>
          </span>
          <span>
            <span style={{ color: "var(--text-3)" }}>Custo semana:</span>{" "}
            <span style={{ color: "var(--brand)", fontWeight: 700 }}>
              {formatBRL(totals.weekCusto)}
            </span>
          </span>
        </div>
      </div>

      {/* Grade */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--surface)",
          overflow: "hidden",
          overflowX: "auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(200px, 220px) repeat(7, minmax(120px, 1fr))",
            minWidth: 1080,
          }}
        >
          {/* Header row */}
          <div
            style={{
              padding: "10px 14px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: "var(--text-3)",
              borderBottom: "1px solid var(--border)",
              background: "var(--surface-2, var(--surface))",
            }}
          >
            Colaborador
          </div>
          {days.map((d, i) => {
            const isToday = isSameDay(d, new Date());
            return (
              <div
                key={i}
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--border)",
                  borderLeft: "1px solid var(--border)",
                  background: "var(--surface-2, var(--surface))",
                  fontSize: 11,
                  color: isToday ? "var(--brand)" : "var(--text-3)",
                  fontWeight: 700,
                  letterSpacing: 0.4,
                }}
              >
                <span style={{ textTransform: "uppercase" }}>
                  {format(d, "EEE", { locale: ptBR })}
                </span>{" "}
                <span
                  style={{
                    color: isToday ? "var(--brand)" : "var(--text)",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {format(d, "d")}
                </span>
              </div>
            );
          })}

          {/* Linhas */}
          {employees.map((emp) => (
            <EmployeeRow
              key={emp.id}
              employee={emp}
              days={days}
              shiftsByCell={shiftsByCell}
              dragOverKey={dragOverKey}
              pendingShiftId={pendingShiftId}
              onCellClick={openCreate}
              onShiftClick={openEdit}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            />
          ))}

          {/* Footer: totais por dia */}
          <div
            style={{
              padding: "10px 14px",
              borderTop: "2px solid var(--border)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: "var(--text-3)",
              background: "var(--surface-2, var(--surface))",
            }}
          >
            Totais
          </div>
          {totals.perDay.map((t, i) => (
            <div
              key={i}
              style={{
                padding: "10px 12px",
                borderTop: "2px solid var(--border)",
                borderLeft: "1px solid var(--border)",
                background: "var(--surface-2, var(--surface))",
                fontSize: 11,
                fontVariantNumeric: "tabular-nums",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <span style={{ color: "var(--text)", fontWeight: 600 }}>
                {t.horas.toFixed(1)}h
              </span>
              <span style={{ color: t.custo > 0 ? "var(--brand)" : "var(--text-3)" }}>
                {t.custo > 0 ? formatBRL(t.custo) : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {modal.open && (
        <ShiftDialog
          key={modal.mode === "edit" ? modal.shift.id : `new-${modal.initial.employeeId}-${modal.initial.data}`}
          isEdit={modal.mode === "edit"}
          initial={modal.initial}
          employees={employees}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

function EmployeeRow({
  employee,
  days,
  shiftsByCell,
  dragOverKey,
  pendingShiftId,
  onCellClick,
  onShiftClick,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  employee: Employee;
  days: Date[];
  shiftsByCell: Map<string, Shift[]>;
  dragOverKey: string | null;
  pendingShiftId: string | null;
  onCellClick: (employeeId: string, data: string) => void;
  onShiftClick: (shift: Shift) => void;
  onDragStart: (e: React.DragEvent, shift: Shift) => void;
  onDragOver: (e: React.DragEvent, key: string) => void;
  onDragLeave: (key: string) => void;
  onDrop: (e: React.DragEvent, employeeId: string, data: string) => void;
}) {
  const fullName = `${employee.nome} ${employee.sobrenome}`.trim();
  const color = avatarColor(fullName);

  return (
    <>
      <div
        style={{
          padding: "10px 14px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          minHeight: 64,
          background: "var(--surface)",
          position: "sticky",
          left: 0,
          zIndex: 1,
        }}
      >
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
          {initials(fullName)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {fullName}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>{employee.funcao}</span>
        </div>
      </div>
      {days.map((d, i) => {
        const dataIso = format(d, "yyyy-MM-dd");
        const key = cellKey(employee.id, dataIso);
        const cellShifts = shiftsByCell.get(key) ?? [];
        const isOver = dragOverKey === key;
        return (
          <div
            key={i}
            onClick={() => cellShifts.length === 0 && onCellClick(employee.id, dataIso)}
            onDragOver={(e) => onDragOver(e, key)}
            onDragLeave={() => onDragLeave(key)}
            onDrop={(e) => onDrop(e, employee.id, dataIso)}
            style={{
              padding: 6,
              borderTop: "1px solid var(--border)",
              borderLeft: "1px solid var(--border)",
              minHeight: 64,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              cursor: cellShifts.length === 0 ? "pointer" : "default",
              background: isOver
                ? "color-mix(in srgb, var(--brand) 10%, transparent)"
                : "transparent",
              transition: "background var(--t)",
              position: "relative",
            }}
            className="escala-cell"
          >
            {cellShifts.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-3)",
                  opacity: 0,
                  transition: "opacity var(--t)",
                }}
                className="escala-cell-add"
              >
                <Plus size={14} />
              </div>
            ) : (
              cellShifts.map((s) => (
                <ShiftPill
                  key={s.id}
                  shift={s}
                  funcao={employee.funcao}
                  pending={pendingShiftId === s.id}
                  onClick={() => onShiftClick(s)}
                  onDragStart={(e) => onDragStart(e, s)}
                />
              ))
            )}
          </div>
        );
      })}
      <style>{`
        .escala-cell:hover .escala-cell-add { opacity: 0.7; }
      `}</style>
    </>
  );
}

function ShiftPill({
  shift,
  funcao,
  pending,
  onClick,
  onDragStart,
}: {
  shift: Shift;
  funcao: string;
  pending: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const color = funcaoColor(funcao);
  const isFolga = shift.tipo === "folga";
  const horaIni = shift.hora_inicio.slice(0, 5);
  const horaFim = shift.hora_fim.slice(0, 5);
  const label = isFolga ? "Folga" : `${formatHora(horaIni)}–${formatHora(horaFim)}`;

  return (
    <div
      draggable={!pending}
      onDragStart={onDragStart}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "5px 7px",
        borderRadius: 6,
        background: isFolga ? "var(--muted)" : color.bg,
        color: isFolga ? "var(--muted-foreground)" : color.fg,
        fontSize: 11,
        fontWeight: 600,
        cursor: pending ? "wait" : "grab",
        opacity: pending ? 0.6 : 1,
        userSelect: "none",
        fontVariantNumeric: "tabular-nums",
        position: "relative",
        border: `1px solid ${isFolga ? "var(--border)" : color.border}`,
      }}
      title={shift.observacao || label}
    >
      <GripVertical
        size={11}
        style={{
          opacity: 0.4,
          flexShrink: 0,
          cursor: "grab",
        }}
      />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      {shift.tipo === "extra" && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            background: "rgba(0,0,0,0.12)",
            padding: "1px 4px",
            borderRadius: 4,
            marginLeft: "auto",
          }}
        >
          EXTRA
        </span>
      )}
    </div>
  );
}

function ShiftDialog({
  isEdit,
  initial,
  employees,
  onClose,
  onSave,
  onDelete,
}: {
  isEdit: boolean;
  initial: FormState;
  employees: Employee[];
  onClose: () => void;
  onSave: (form: FormState) => void;
  onDelete: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial);

  const valid =
    form.employeeId &&
    form.data &&
    form.horaInicio &&
    form.horaFim &&
    form.tipo;

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar turno" : "Novo turno"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Ajuste horário, tipo ou colaborador."
              : "Preencha o turno e o custo é calculado automaticamente."}
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Colaborador">
            <Select
              value={form.employeeId}
              onValueChange={(v) => v && setForm({ ...form, employeeId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome} {e.sobrenome} · {e.funcao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Field label="Data">
              <Input
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </Field>
            <Field label="Início">
              <Input
                type="time"
                value={form.horaInicio}
                onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
              />
            </Field>
            <Field label="Fim">
              <Input
                type="time"
                value={form.horaFim}
                onChange={(e) => setForm({ ...form, horaFim: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Tipo">
            <Select
              value={form.tipo}
              onValueChange={(v) => v && setForm({ ...form, tipo: v as ShiftTipo })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_LABEL) as ShiftTipo[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Observação (opcional)">
            <Textarea
              rows={2}
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              placeholder="Cobertura de almoço, evento, etc."
            />
          </Field>

          <PreviewCost form={form} employees={employees} />
        </div>

        <DialogFooter>
          {isEdit && (
            <button
              type="button"
              onClick={onDelete}
              className={buttonVariants({ variant: "ghost" })}
              style={{ color: "var(--destructive)", marginRight: "auto" }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!valid}
            onClick={() => valid && onSave(form)}
          >
            {isEdit ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <Label
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          color: "var(--text-3)",
        }}
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

function PreviewCost({
  form,
  employees,
}: {
  form: FormState;
  employees: Employee[];
}) {
  const emp = employees.find((e) => e.id === form.employeeId);
  if (!emp || form.tipo === "folga") return null;
  const horas = hoursWorked(form.horaInicio, form.horaFim);
  const custo = calculateLaborCost(emp.salario_base, form.horaInicio, form.horaFim);
  return (
    <div
      style={{
        marginTop: 4,
        padding: "10px 12px",
        borderRadius: 8,
        background: "var(--brand-soft)",
        border: "1px solid var(--border)",
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        fontSize: 12,
      }}
    >
      <div style={{ color: "var(--text-2)" }}>
        <span style={{ color: "var(--text-3)" }}>Duração: </span>
        <strong style={{ color: "var(--text)" }}>{horas.toFixed(1)}h</strong>
      </div>
      <div style={{ color: "var(--text-2)" }}>
        <span style={{ color: "var(--text-3)" }}>Custo estimado: </span>
        <strong style={{ color: "var(--brand)" }}>{formatBRL(custo)}</strong>
      </div>
    </div>
  );
}

// ---------- Helpers locais ----------

function cellKey(employeeId: string, dataIso: string): string {
  return `${employeeId}|${dataIso}`;
}

function formatHora(hhmm: string): string {
  const [hRaw, m] = hhmm.split(":");
  const h = hRaw ?? "00";
  if (m === "00") return `${Number(h)}h`;
  return `${h}:${m}h`;
}

function funcaoColor(funcao: string): {
  bg: string;
  fg: string;
  border: string;
} {
  const f = funcao.toLowerCase();
  if (f.includes("cozinh") || f.includes("chef")) {
    return {
      bg: "color-mix(in srgb, #F59E0B 16%, transparent)",
      fg: "#B45309",
      border: "color-mix(in srgb, #F59E0B 30%, transparent)",
    };
  }
  if (
    f.includes("garç") ||
    f.includes("garc") ||
    f.includes("salão") ||
    f.includes("salao") ||
    f.includes("atendent")
  ) {
    return {
      bg: "color-mix(in srgb, #3B82F6 14%, transparent)",
      fg: "#1D4ED8",
      border: "color-mix(in srgb, #3B82F6 28%, transparent)",
    };
  }
  if (f.includes("host") || f.includes("recep")) {
    return {
      bg: "color-mix(in srgb, #A855F7 14%, transparent)",
      fg: "#6D28D9",
      border: "color-mix(in srgb, #A855F7 28%, transparent)",
    };
  }
  return {
    bg: "var(--muted)",
    fg: "var(--text)",
    border: "var(--border)",
  };
}
