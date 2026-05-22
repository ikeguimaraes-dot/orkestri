"use client";

import { useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { avatarColor, initials } from "@/lib/format";
import type { Employee, Shift } from "@kph/db/types/pessoas";

type EmployeeStub = Pick<Employee, "id" | "nome" | "sobrenome" | "funcao" | "departamento">;

type Props = {
  employees: EmployeeStub[];
  shifts: Shift[];
  monthIso: string;
  unitId: string;
};

const DEPT_COLORS: Record<string, { bg: string; fg: string }> = {
  cozinha: { bg: "rgba(59,130,246,0.18)", fg: "#1D4ED8" },
  salão: { bg: "rgba(34,197,94,0.18)", fg: "#15803D" },
  salao: { bg: "rgba(34,197,94,0.18)", fg: "#15803D" },
  bar: { bg: "rgba(168,85,247,0.18)", fg: "#6D28D9" },
};

function deptColor(departamento: string | null): { bg: string; fg: string } {
  if (!departamento) return { bg: "rgba(148,163,184,0.18)", fg: "var(--text-2)" };
  const d = departamento.toLowerCase();
  for (const [key, val] of Object.entries(DEPT_COLORS)) {
    if (d.includes(key)) return val;
  }
  return { bg: "rgba(148,163,184,0.18)", fg: "var(--text-2)" };
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const TIPO_LABEL: Record<string, string> = {
  normal: "Normal",
  extra: "Extra",
  folga: "Folga",
  feriado: "Feriado",
};

export function EscalaMonthView({ employees, shifts, monthIso }: Props) {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthStart = startOfMonth(parseISO(`${monthIso}-01`));
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const leadingBlanks = getDay(monthStart);

  const employeeById = new Map<string, EmployeeStub>();
  for (const e of employees) employeeById.set(e.id, e);

  const shiftsByDay = new Map<string, Shift[]>();
  for (const s of shifts) {
    const arr = shiftsByDay.get(s.data) ?? [];
    arr.push(s);
    shiftsByDay.set(s.data, arr);
  }

  const navigateMonth = (offset: number) => {
    const next = addMonths(monthStart, offset);
    router.push(`/pessoas/escala?view=mes&mes=${format(next, "yyyy-MM")}`);
  };

  const monthLabel = format(monthStart, "MMMM yyyy", { locale: ptBR });

  const selectedDayIso = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
  const selectedShifts = selectedDayIso ? (shiftsByDay.get(selectedDayIso) ?? []) : [];

  const cells: (Date | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...days,
  ];

  const trailingCount = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < trailingCount; i++) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
        }}
      >
        <button
          onClick={() => navigateMonth(-1)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 10px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "transparent",
            color: "var(--text)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <ChevronLeft size={14} />
          Mês anterior
        </button>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text)",
            textTransform: "capitalize",
            letterSpacing: -0.2,
          }}
        >
          {monthLabel}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
            <a
              href={`/pessoas/escala?view=semana`}
              style={{
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 600,
                background: "transparent",
                color: "var(--text-2)",
                textDecoration: "none",
                display: "inline-block",
                transition: "background var(--t)",
              }}
            >
              Semana
            </a>
            <span
              style={{
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 700,
                background: "var(--brand)",
                color: "#fff",
                display: "inline-block",
                cursor: "default",
              }}
            >
              Mês
            </span>
          </div>
          <button
            onClick={() => navigateMonth(1)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 10px",
              border: "1px solid var(--border)",
              borderRadius: 6,
              background: "transparent",
              color: "var(--text)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Próximo mês
            <ChevronRight size={14} />
          </button>
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
          }}
        >
          {DAY_LABELS.map((label) => (
            <div
              key={label}
              style={{
                padding: "8px 0",
                textAlign: "center",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "var(--text-3)",
                borderBottom: "1px solid var(--border)",
                background: "var(--surface-2, var(--surface))",
              }}
            >
              {label}
            </div>
          ))}

          {weeks.flatMap((week, wi) =>
            week.map((day, di) => {
              if (!day) {
                return (
                  <div
                    key={`blank-${wi}-${di}`}
                    style={{
                      minHeight: 90,
                      borderTop: wi > 0 ? "1px solid var(--border)" : undefined,
                      borderLeft: di > 0 ? "1px solid var(--border)" : undefined,
                      background: "var(--surface-2, color-mix(in srgb, var(--surface) 60%, transparent))",
                    }}
                  />
                );
              }

              const iso = format(day, "yyyy-MM-dd");
              const dayShifts = shiftsByDay.get(iso) ?? [];
              const isToday = isSameDay(day, new Date());
              const inMonth = isSameMonth(day, monthStart);
              const visible = dayShifts.slice(0, 4);
              const overflow = dayShifts.length - visible.length;

              return (
                <div
                  key={iso}
                  onClick={() => dayShifts.length > 0 && setSelectedDay(day)}
                  style={{
                    minHeight: 90,
                    padding: "6px 7px",
                    borderTop: wi > 0 ? "1px solid var(--border)" : undefined,
                    borderLeft: di > 0 ? "1px solid var(--border)" : undefined,
                    cursor: dayShifts.length > 0 ? "pointer" : "default",
                    background: isToday
                      ? "color-mix(in srgb, var(--brand) 6%, var(--surface))"
                      : "transparent",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    opacity: inMonth ? 1 : 0.35,
                    transition: "background var(--t)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: isToday ? 800 : 600,
                      color: isToday ? "var(--brand)" : "var(--text-2)",
                      lineHeight: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    {format(day, "d")}
                    {dayShifts.length > 0 && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: "var(--text-3)",
                        }}
                      >
                        {dayShifts.length}
                      </span>
                    )}
                  </span>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {visible.map((s) => {
                      const emp = employeeById.get(s.employee_id);
                      const name = emp ? `${emp.nome} ${emp.sobrenome}`.trim() : "?";
                      const color = avatarColor(name);
                      const dc = emp ? deptColor(emp.departamento) : { bg: "rgba(148,163,184,0.18)", fg: "var(--text-2)" };
                      return (
                        <span
                          key={s.id}
                          title={name}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 22,
                            height: 22,
                            borderRadius: 99,
                            background: dc.bg,
                            color: dc.fg,
                            fontSize: 9,
                            fontWeight: 700,
                            flexShrink: 0,
                            border: `1px solid ${color}33`,
                          }}
                        >
                          {initials(name)}
                        </span>
                      );
                    })}
                    {overflow > 0 && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 22,
                          height: 22,
                          borderRadius: 99,
                          background: "rgba(148,163,184,0.18)",
                          color: "var(--text-3)",
                          fontSize: 9,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        +{overflow}
                      </span>
                    )}
                  </div>
                </div>
              );
            }),
          )}
        </div>
      </div>

      {selectedDay && (
        <DayOverlay
          day={selectedDay}
          shifts={selectedShifts}
          employeeById={employeeById}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}

function DayOverlay({
  day,
  shifts,
  employeeById,
  onClose,
}: {
  day: Date;
  shifts: Shift[];
  employeeById: Map<string, EmployeeStub>;
  onClose: () => void;
}) {
  const label = format(day, "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          width: "100%",
          maxWidth: 420,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--text)",
              textTransform: "capitalize",
            }}
          >
            {label}
          </span>
          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-2)",
              cursor: "pointer",
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div
          style={{
            overflowY: "auto",
            padding: "10px 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {shifts.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
              Nenhum turno neste dia.
            </p>
          ) : (
            shifts.map((s) => {
              const emp = employeeById.get(s.employee_id);
              const name = emp ? `${emp.nome} ${emp.sobrenome}`.trim() : "Colaborador removido";
              const color = avatarColor(name);
              const dc = emp ? deptColor(emp.departamento) : { bg: "rgba(148,163,184,0.18)", fg: "var(--text-2)" };
              const isFolga = s.tipo === "folga";
              const horaIni = s.hora_inicio.slice(0, 5);
              const horaFim = s.hora_fim.slice(0, 5);

              return (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface-2, var(--surface))",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 99,
                      background: dc.bg,
                      color: dc.fg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                      border: `1px solid ${color}33`,
                    }}
                  >
                    {initials(name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
                      {emp?.funcao}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: isFolga ? "var(--text-3)" : "var(--text)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {isFolga ? "Folga" : `${horaIni} – ${horaFim}`}
                    </div>
                    <div
                      style={{
                        display: "inline-block",
                        marginTop: 3,
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: 0.6,
                        textTransform: "uppercase",
                        padding: "2px 5px",
                        borderRadius: 4,
                        background: dc.bg,
                        color: dc.fg,
                      }}
                    >
                      {TIPO_LABEL[s.tipo] ?? s.tipo}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
