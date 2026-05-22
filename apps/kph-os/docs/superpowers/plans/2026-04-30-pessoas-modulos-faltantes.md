# KPH OS — Módulos Faltantes (Fase 1 + Fase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar os módulos faltantes do KPH OS em duas fases: (1) Pessoas — Faltas, Horas Extras, Gorjetas, VT; (2) Operação/Compras/Comercial — Análise CMV, Cotações, Reservas, Auditorias, Performance, Mapa da Casa.

**Architecture:** Cada módulo segue o padrão canônico do projeto — `page.tsx` (Server Component) busca dados e passa props; `client.tsx` ("use client") renderiza tabela + filtros + cards de KPI. As actions de CRUD por colaborador já existem; precisamos adicionar 3 novas actions de listagem por unit (HE, Gorjetas, VT) e criar as 10 novas páginas da Fase 2.

**Tech Stack:** Next.js 16 (App Router, Server Components), React 19, TypeScript, Supabase (PostgREST join filter), Zod — sem novas dependências.

---

## Contexto obrigatório antes de escrever código

- Padrão canônico: `src/app/(dashboard)/pessoas/ferias/page.tsx` + `ferias-client.tsx`
- Actions existentes: `src/lib/pessoas/actions.ts` (todas as CRUD individuais já existem)
- Tipos: `src/types/pessoas.ts` (Absence, OvertimeRecord, TipsRecord, TransportVoucher + variantes WithEmployee)
- Utilidades: `formatBRL`, `formatDateBR` em `src/lib/format.ts`
- Layout: `getCurrentUnit()` de `src/lib/auth/unit.ts`; `requireUser()` de `src/lib/auth/server.ts`
- UI: `Table`, `TableHeader`, `TableRow`, `TableHead`, `TableBody`, `TableCell` de `@/components/ui/table`; `Button`, `Input`, `Select` do shadcn em `@/components/ui/`
- CSS: sempre `style={{}}` inline com `var(--text)`, `var(--surface)`, `var(--border)`, `var(--brand)` — sem classes Tailwind fora de `className="text-right"` nos Table helpers
- `AbsenceWithEmployee`, `OvertimeRecordWithEmployee`, `TipsRecordWithEmployee`, `TransportVoucherWithEmployee` já existem em `src/types/pessoas.ts`

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/lib/pessoas/actions.ts` | **Modificar** | Adicionar `listOvertimeByUnit`, `listTipsByUnit`, `listVouchersByUnit` |
| `src/app/(dashboard)/pessoas/faltas/page.tsx` | **Reescrever** | Server component: carrega faltas da unit |
| `src/app/(dashboard)/pessoas/faltas/faltas-client.tsx` | **Criar** | Tabela + filtros + cards KPI de faltas |
| `src/app/(dashboard)/pessoas/horas-extras/page.tsx` | **Reescrever** | Server component: carrega HE da unit |
| `src/app/(dashboard)/pessoas/horas-extras/horas-extras-client.tsx` | **Criar** | Tabela + filtros + aprovação inline |
| `src/app/(dashboard)/pessoas/gorjetas/page.tsx` | **Reescrever** | Server component: carrega gorjetas da unit |
| `src/app/(dashboard)/pessoas/gorjetas/gorjetas-client.tsx` | **Criar** | Tabela + filtro de período |
| `src/app/(dashboard)/pessoas/vale-transporte/page.tsx` | **Reescrever** | Server component: carrega VT da unit |
| `src/app/(dashboard)/pessoas/vale-transporte/vt-client.tsx` | **Criar** | Tabela + filtro de período + totalizadores |

---

## Task 1: Adicionar actions de listagem por unit (HE, Gorjetas, VT)

**Files:**
- Modify: `src/lib/pessoas/actions.ts` — logo após cada seção existente de CRUD individual

### Por que é necessário

`listOvertimeRecords`, `listTipsRecords` e `listTransportVouchers` só aceitam `employeeId`. As páginas consolidadas precisam buscar todos os registros da unit de uma vez, com join para o nome do colaborador (igual ao que `listAbsences` já faz).

- [ ] **Step 1: Adicionar `listOvertimeByUnit` em actions.ts**

Adicionar logo após `approveOvertime` (linha ~1490), antes de `// ── Férias`:

```typescript
/** Lista HE da unit. Filtra por mês/ano se ambos vierem. */
export async function listOvertimeByUnit(
  unitId: string,
  mes?: number,
  ano?: number,
): Promise<OvertimeRecordWithEmployee[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    type OTJoinRow = OvertimeRecord & {
      employees: { id: string; nome: string; sobrenome: string; funcao: string | null; departamento: string | null; unit_id: string } | null;
    };
    let query = supabase
      .from(OT_TABLE)
      .select("*, employees!inner(id, nome, sobrenome, funcao, departamento, unit_id)")
      .eq("employees.unit_id", unitId)
      .order("date", { ascending: false });
    if (mes && ano) {
      const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const lastDay = new Date(ano, mes, 0).getDate();
      const end = `${ano}-${String(mes).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      query = query.gte("date", start).lte("date", end);
    }
    const { data, error } = await query.returns<OTJoinRow[]>();
    if (error) {
      console.error("[listOvertimeByUnit] error:", error.message);
      return [];
    }
    return (data ?? []).map((row) => ({
      ...row,
      employee: unwrapEmployee(row.employees),
    })) as OvertimeRecordWithEmployee[];
  } catch (e) {
    console.error("[listOvertimeByUnit] exceção:", e);
    return [];
  }
}
```

- [ ] **Step 2: Adicionar `listTipsByUnit` em actions.ts**

Adicionar logo após `deleteTipsRecord` (~linha 1298), antes de `// ── Vale Transporte`:

```typescript
/** Lista gorjetas da unit. Filtra por mês/ano se ambos vierem. */
export async function listTipsByUnit(
  unitId: string,
  mes?: number,
  ano?: number,
): Promise<TipsRecordWithEmployee[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    type TipsJoinRow = TipsRecord & {
      employees: { id: string; nome: string; sobrenome: string; funcao: string | null; departamento: string | null; unit_id: string } | null;
    };
    let query = supabase
      .from(TIPS_TABLE)
      .select("*, employees!inner(id, nome, sobrenome, funcao, departamento, unit_id)")
      .eq("employees.unit_id", unitId)
      .order("periodo", { ascending: false });
    if (mes && ano) {
      const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const end = `${ano}-${String(mes).padStart(2, "0")}-01`;
      query = query.gte("periodo", start).lte("periodo", end);
    }
    const { data, error } = await query.returns<TipsJoinRow[]>();
    if (error) {
      console.error("[listTipsByUnit] error:", error.message);
      return [];
    }
    return (data ?? []).map((row) => ({
      ...row,
      employee: unwrapEmployee(row.employees),
    })) as TipsRecordWithEmployee[];
  } catch (e) {
    console.error("[listTipsByUnit] exceção:", e);
    return [];
  }
}
```

- [ ] **Step 3: Adicionar `listVouchersByUnit` em actions.ts**

Adicionar logo após `deleteTransportVoucher` (~linha 1378), antes de `// ── Horas Extras`:

```typescript
/** Lista vale-transportes da unit. Filtra por mês/ano se ambos vierem. */
export async function listVouchersByUnit(
  unitId: string,
  mes?: number,
  ano?: number,
): Promise<TransportVoucherWithEmployee[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    type VTJoinRow = TransportVoucher & {
      employees: { id: string; nome: string; sobrenome: string; funcao: string | null; departamento: string | null; unit_id: string } | null;
    };
    let query = supabase
      .from(VT_TABLE)
      .select("*, employees!inner(id, nome, sobrenome, funcao, departamento, unit_id)")
      .eq("employees.unit_id", unitId)
      .order("periodo", { ascending: false });
    if (mes && ano) {
      const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const end = `${ano}-${String(mes).padStart(2, "0")}-01`;
      query = query.gte("periodo", start).lte("periodo", end);
    }
    const { data, error } = await query.returns<VTJoinRow[]>();
    if (error) {
      console.error("[listVouchersByUnit] error:", error.message);
      return [];
    }
    return (data ?? []).map((row) => ({
      ...row,
      employee: unwrapEmployee(row.employees),
    })) as TransportVoucherWithEmployee[];
  } catch (e) {
    console.error("[listVouchersByUnit] exceção:", e);
    return [];
  }
}
```

- [ ] **Step 4: Verificar que TypeScript compila**

```bash
cd /Users/henriqueguimaraes/Desktop/_ORKESTRI/kph-os
npx tsc --noEmit 2>&1 | grep -v "ponto/debug"
```

Esperado: sem erros relacionados às 3 novas funções.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pessoas/actions.ts
git commit -m "feat(pessoas): add listOvertimeByUnit, listTipsByUnit, listVouchersByUnit actions"
```

---

## Task 2: Página Faltas

**Files:**
- Rewrite: `src/app/(dashboard)/pessoas/faltas/page.tsx`
- Create: `src/app/(dashboard)/pessoas/faltas/faltas-client.tsx`

### Dados exibidos
Tabela com: Colaborador (link → perfil), Data, Tipo (badge colorido), Motivo, Impacto no Score.
Cards KPI: Total do mês, Injustificadas, Atestados.
Filtros: busca por nome + select de tipo + select mês/ano (padrão = mês atual).

### Tipos de falta e cores
- `justificada` → azul `rgba(59,130,246,0.16)` / `#1D4ED8`
- `injustificada` → vermelho `rgba(239,68,68,0.16)` / `#B91C1C`
- `atestado` → amarelo `rgba(245,158,11,0.16)` / `#A16207`
- `falta_abono` → verde `rgba(34,197,94,0.16)` / `#15803D`

- [ ] **Step 1: Reescrever `page.tsx`**

```tsx
// src/app/(dashboard)/pessoas/faltas/page.tsx
import { Suspense } from "react";

import { listAbsences } from "@/lib/pessoas/actions";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import { FaltasClient } from "./faltas-client";

export const dynamic = "force-dynamic";

export default async function FaltasPage() {
  await requireUser();
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-3)" }}>
          Pessoas · Faltas
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 4px", color: "var(--text)", letterSpacing: -0.4 }}>
          Faltas da unit
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.55, maxWidth: 720 }}>
          Registro consolidado de faltas por unit. Para lançar uma nova falta, acesse o perfil do colaborador.
        </p>
      </header>
      <Suspense fallback={<div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>}>
        <FaltasSection />
      </Suspense>
    </div>
  );
}

async function FaltasSection() {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: "32px 22px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
        Selecione uma unit no topo para ver as faltas.
      </div>
    );
  }

  const now = new Date();
  const absences = await listAbsences(unit.id, now.getMonth() + 1, now.getFullYear());

  return <FaltasClient unitName={unit.name} absences={absences} defaultMes={now.getMonth() + 1} defaultAno={now.getFullYear()} />;
}
```

- [ ] **Step 2: Criar `faltas-client.tsx`**

```tsx
// src/app/(dashboard)/pessoas/faltas/faltas-client.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarX, FileText, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateBR } from "@/lib/format";
import type { AbsenceWithEmployee } from "@/types/pessoas";

const TIPO_COLOR: Record<string, { bg: string; fg: string; label: string }> = {
  justificada:    { bg: "rgba(59,130,246,0.16)",  fg: "#1D4ED8", label: "Justificada" },
  injustificada:  { bg: "rgba(239,68,68,0.16)",   fg: "#B91C1C", label: "Injustificada" },
  atestado:       { bg: "rgba(245,158,11,0.16)",  fg: "#A16207", label: "Atestado" },
  falta_abono:    { bg: "rgba(34,197,94,0.16)",   fg: "#15803D", label: "Abono" },
};

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export function FaltasClient({
  unitName,
  absences,
  defaultMes,
  defaultAno,
}: {
  unitName: string;
  absences: AbsenceWithEmployee[];
  defaultMes: number;
  defaultAno: number;
}) {
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");

  const counts = useMemo(() => {
    const total = absences.length;
    const injustificadas = absences.filter((a) => a.tipo === "injustificada").length;
    const atestados = absences.filter((a) => a.tipo === "atestado").length;
    return { total, injustificadas, atestados };
  }, [absences]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return absences.filter((a) => {
      if (tipoFilter !== "all" && a.tipo !== tipoFilter) return false;
      if (q) {
        const name = a.employee ? `${a.employee.nome} ${a.employee.sobrenome}`.toLowerCase() : "";
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [absences, tipoFilter, search]);

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 22 }}>
        <KpiCard icon={<CalendarX size={18} />} label="Total do período" value={counts.total} />
        <KpiCard icon={<AlertCircle size={18} />} label="Injustificadas" value={counts.injustificadas} highlight />
        <KpiCard icon={<FileText size={18} />} label="Atestados" value={counts.atestados} />
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", minWidth: 240, flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
          <Input placeholder="Buscar por colaborador…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 30 }} />
        </div>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger style={{ width: 180 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="justificada">Justificada</SelectItem>
            <SelectItem value="injustificada">Injustificada</SelectItem>
            <SelectItem value="atestado">Atestado</SelectItem>
            <SelectItem value="falta_abono">Abono</SelectItem>
          </SelectContent>
        </Select>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginLeft: "auto" }}>
          {unitName} · {MESES[defaultMes - 1]}/{defaultAno} · {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-3)", fontSize: 13, background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8 }}>
          Nenhuma falta para o filtro atual.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((a) => {
              const cor = TIPO_COLOR[a.tipo] ?? { bg: "rgba(100,100,100,0.12)", fg: "var(--text-2)", label: a.tipo };
              const name = a.employee ? `${a.employee.nome} ${a.employee.sobrenome}`.trim() : "—";
              return (
                <TableRow key={a.id}>
                  <TableCell>
                    {a.employee ? (
                      <Link href={`/pessoas/colaboradores/${a.employee_id}`} style={{ fontWeight: 600, color: "var(--text)", textDecoration: "none" }}>
                        {name}
                      </Link>
                    ) : (
                      <span style={{ color: "var(--text-3)" }}>—</span>
                    )}
                    {a.employee?.funcao && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{a.employee.funcao}</div>}
                  </TableCell>
                  <TableCell style={{ fontVariantNumeric: "tabular-nums" }}>{formatDateBR(a.data)}</TableCell>
                  <TableCell>
                    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, background: cor.bg, color: cor.fg, fontWeight: 600, fontSize: 11 }}>
                      {cor.label}
                    </span>
                  </TableCell>
                  <TableCell style={{ color: "var(--text-2)", fontSize: 13 }}>{a.motivo ?? "—"}</TableCell>
                  <TableCell className="text-right" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: a.score_impact < 0 ? "#B91C1C" : "var(--text-3)" }}>
                    {a.score_impact !== 0 ? `${a.score_impact > 0 ? "+" : ""}${a.score_impact}` : "—"}
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

function KpiCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 99, background: highlight ? "rgba(239,68,68,0.12)" : "var(--brand-soft)", color: highlight ? "#B91C1C" : "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", lineHeight: 1, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar que TypeScript compila**

```bash
cd /Users/henriqueguimaraes/Desktop/_ORKESTRI/kph-os
npx tsc --noEmit 2>&1 | grep -E "faltas|error" | grep -v "ponto/debug"
```

Esperado: sem erros em arquivos de faltas.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/pessoas/faltas/
git commit -m "feat(pessoas): implement Faltas consolidated view"
```

---

## Task 3: Página Horas Extras

**Files:**
- Rewrite: `src/app/(dashboard)/pessoas/horas-extras/page.tsx`
- Create: `src/app/(dashboard)/pessoas/horas-extras/horas-extras-client.tsx`

### Dados exibidos
Tabela: Colaborador, Data, Horas, Tipo (50%/100%/Banco), Status de aprovação (badge), Ações (aprovar/rejeitar inline).
Cards KPI: Total de horas, Pendentes de aprovação, Aprovadas.
Filtros: busca por nome + tipo + status de aprovação.
Aprovação inline: `approveOvertime(id, true, userId)` / `approveOvertime(id, false, null)`.

### Tipos e cores
- `50` → "50%" → azul
- `100` → "100%" → laranja
- `banco` → "Banco de horas" → roxo

### Status aprovação
- `null` → "Pendente" → cinza
- `true` → "Aprovada" → verde
- `false` → "Rejeitada" → vermelho

- [ ] **Step 1: Reescrever `page.tsx`**

```tsx
// src/app/(dashboard)/pessoas/horas-extras/page.tsx
import { Suspense } from "react";

import { listOvertimeByUnit } from "@/lib/pessoas/actions";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import { HorasExtrasClient } from "./horas-extras-client";

export const dynamic = "force-dynamic";

export default async function HorasExtrasPage() {
  await requireUser();
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-3)" }}>
          Pessoas · Horas Extras
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 4px", color: "var(--text)", letterSpacing: -0.4 }}>
          Horas Extras da unit
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.55, maxWidth: 720 }}>
          Registros de horas extras com aprovação inline. Para lançar HE, acesse o perfil do colaborador.
        </p>
      </header>
      <Suspense fallback={<div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>}>
        <HorasExtrasSection />
      </Suspense>
    </div>
  );
}

async function HorasExtrasSection() {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: "32px 22px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
        Selecione uma unit no topo para ver as horas extras.
      </div>
    );
  }

  const now = new Date();
  const records = await listOvertimeByUnit(unit.id, now.getMonth() + 1, now.getFullYear());

  return <HorasExtrasClient unitName={unit.name} records={records} defaultMes={now.getMonth() + 1} defaultAno={now.getFullYear()} />;
}
```

- [ ] **Step 2: Criar `horas-extras-client.tsx`**

```tsx
// src/app/(dashboard)/pessoas/horas-extras/horas-extras-client.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clock, Loader2, Search, Timer, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateBR } from "@/lib/format";
import { approveOvertime } from "@/lib/pessoas/actions";
import type { OvertimeRecordWithEmployee } from "@/types/pessoas";

const TIPO_LABEL: Record<string, string> = { "50": "50%", "100": "100%", banco: "Banco" };
const TIPO_COLOR: Record<string, { bg: string; fg: string }> = {
  "50":   { bg: "rgba(59,130,246,0.16)",  fg: "#1D4ED8" },
  "100":  { bg: "rgba(245,158,11,0.16)",  fg: "#A16207" },
  banco:  { bg: "rgba(168,85,247,0.16)",  fg: "#7E22CE" },
};
const STATUS_COLOR = {
  pendente:  { bg: "rgba(100,116,139,0.14)", fg: "#475569", label: "Pendente" },
  aprovada:  { bg: "rgba(34,197,94,0.16)",   fg: "#15803D", label: "Aprovada" },
  rejeitada: { bg: "rgba(239,68,68,0.16)",   fg: "#B91C1C", label: "Rejeitada" },
};

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export function HorasExtrasClient({
  unitName,
  records,
  defaultMes,
  defaultAno,
}: {
  unitName: string;
  records: OvertimeRecordWithEmployee[];
  defaultMes: number;
  defaultAno: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const counts = useMemo(() => {
    const totalHoras = records.reduce((acc, r) => acc + Number(r.hours), 0);
    const pendentes = records.filter((r) => r.approved === null).length;
    const aprovadas = records.filter((r) => r.approved === true).length;
    return { totalHoras, pendentes, aprovadas };
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (tipoFilter !== "all" && r.type !== tipoFilter) return false;
      if (statusFilter === "pendente" && r.approved !== null) return false;
      if (statusFilter === "aprovada" && r.approved !== true) return false;
      if (statusFilter === "rejeitada" && r.approved !== false) return false;
      if (q) {
        const name = r.employee ? `${r.employee.nome} ${r.employee.sobrenome}`.toLowerCase() : "";
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [records, tipoFilter, statusFilter, search]);

  function handleApprove(id: string, name: string, approverId: string | null) {
    if (!window.confirm(`Aprovar HE de ${name}?`)) return;
    setActingOn(id);
    startTransition(async () => {
      const r = await approveOvertime(id, true, approverId);
      setActingOn(null);
      if (!r.ok) { alert(`Falha: ${r.error}`); return; }
      router.refresh();
    });
  }

  function handleReject(id: string, name: string) {
    if (!window.confirm(`Rejeitar HE de ${name}?`)) return;
    setActingOn(id);
    startTransition(async () => {
      const r = await approveOvertime(id, false, null);
      setActingOn(null);
      if (!r.ok) { alert(`Falha: ${r.error}`); return; }
      router.refresh();
    });
  }

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 22 }}>
        <KpiCard icon={<Timer size={18} />} label="Total de horas" value={`${counts.totalHoras.toFixed(1)}h`} />
        <KpiCard icon={<Clock size={18} />} label="Pendentes de aprovação" value={counts.pendentes} highlight={counts.pendentes > 0} />
        <KpiCard icon={<Check size={18} />} label="Aprovadas" value={counts.aprovadas} />
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", minWidth: 240, flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
          <Input placeholder="Buscar por colaborador…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 30 }} />
        </div>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger style={{ width: 160 }}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="50">50%</SelectItem>
            <SelectItem value="100">100%</SelectItem>
            <SelectItem value="banco">Banco de horas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger style={{ width: 160 }}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="aprovada">Aprovada</SelectItem>
            <SelectItem value="rejeitada">Rejeitada</SelectItem>
          </SelectContent>
        </Select>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginLeft: "auto" }}>
          {unitName} · {MESES[defaultMes - 1]}/{defaultAno} · {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-3)", fontSize: 13, background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8 }}>
          Nenhum registro para o filtro atual.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Horas</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead style={{ textAlign: "right" }}>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => {
              const tipoCor = TIPO_COLOR[r.type] ?? { bg: "rgba(100,100,100,0.12)", fg: "var(--text-2)" };
              const statusKey = r.approved === null ? "pendente" : r.approved ? "aprovada" : "rejeitada";
              const statusCor = STATUS_COLOR[statusKey];
              const name = r.employee ? `${r.employee.nome} ${r.employee.sobrenome}`.trim() : "—";
              const acting = actingOn === r.id;
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.employee ? (
                      <Link href={`/pessoas/colaboradores/${r.employee_id}`} style={{ fontWeight: 600, color: "var(--text)", textDecoration: "none" }}>
                        {name}
                      </Link>
                    ) : <span style={{ color: "var(--text-3)" }}>—</span>}
                    {r.employee?.funcao && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{r.employee.funcao}</div>}
                  </TableCell>
                  <TableCell style={{ fontVariantNumeric: "tabular-nums" }}>{formatDateBR(r.date)}</TableCell>
                  <TableCell className="text-right" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--brand)" }}>
                    {Number(r.hours).toFixed(1)}h
                  </TableCell>
                  <TableCell>
                    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, background: tipoCor.bg, color: tipoCor.fg, fontWeight: 600, fontSize: 11 }}>
                      {TIPO_LABEL[r.type] ?? r.type}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, background: statusCor.bg, color: statusCor.fg, fontWeight: 600, fontSize: 11 }}>
                      {statusCor.label}
                    </span>
                  </TableCell>
                  <TableCell style={{ textAlign: "right" }}>
                    {r.approved === null ? (
                      <div style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                        <Button size="sm" variant="outline" onClick={() => handleApprove(r.id, name, null)} disabled={pending} title="Aprovar">
                          {acting && pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" style={{ color: "#15803D" }} />}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleReject(r.id, name)} disabled={pending} title="Rejeitar">
                          <X className="h-3.5 w-3.5" style={{ color: "#B91C1C" }} />
                        </Button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>—</span>
                    )}
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

function KpiCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string | number; highlight?: boolean }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 99, background: highlight ? "rgba(245,158,11,0.14)" : "var(--brand-soft)", color: highlight ? "#A16207" : "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", lineHeight: 1, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "horas-extras|error" | grep -v "ponto/debug"
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/pessoas/horas-extras/
git commit -m "feat(pessoas): implement Horas Extras consolidated view with inline approval"
```

---

## Task 4: Página Gorjetas

**Files:**
- Rewrite: `src/app/(dashboard)/pessoas/gorjetas/page.tsx`
- Create: `src/app/(dashboard)/pessoas/gorjetas/gorjetas-client.tsx`

### Dados exibidos
Tabela: Colaborador, Período, Valor do Ponto, Total de Pontos, Abatimento, Pontos Líquidos, Observações.
Cards KPI: Total de registros no período, Soma de pontos líquidos, Valor médio do ponto.
Filtros: busca por nome.

### Notas sobre o modelo
- `periodo` é `DATE` (YYYY-MM-DD) representando o 1º dia do mês
- `pontos_liquidos` é coluna GENERATED pelo banco: `total_pontos - abatimento_pontos`
- Valor final em R$ = `pontos_liquidos × valor_ponto` (calcular no client para exibir)

- [ ] **Step 1: Reescrever `page.tsx`**

```tsx
// src/app/(dashboard)/pessoas/gorjetas/page.tsx
import { Suspense } from "react";

import { listTipsByUnit } from "@/lib/pessoas/actions";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import { GorjetasClient } from "./gorjetas-client";

export const dynamic = "force-dynamic";

export default async function GorjetasPage() {
  await requireUser();
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-3)" }}>
          Pessoas · Gorjetas
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 4px", color: "var(--text)", letterSpacing: -0.4 }}>
          Gorjetas da unit
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.55, maxWidth: 720 }}>
          Distribuição mensal de gorjetas por pontuação. Para lançar gorjetas de um colaborador, acesse seu perfil.
        </p>
      </header>
      <Suspense fallback={<div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>}>
        <GorjetasSection />
      </Suspense>
    </div>
  );
}

async function GorjetasSection() {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: "32px 22px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
        Selecione uma unit no topo para ver as gorjetas.
      </div>
    );
  }

  const now = new Date();
  const records = await listTipsByUnit(unit.id, now.getMonth() + 1, now.getFullYear());

  return <GorjetasClient unitName={unit.name} records={records} defaultMes={now.getMonth() + 1} defaultAno={now.getFullYear()} />;
}
```

- [ ] **Step 2: Criar `gorjetas-client.tsx`**

```tsx
// src/app/(dashboard)/pessoas/gorjetas/gorjetas-client.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DollarSign, Search, Star, TrendingUp } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBRL } from "@/lib/format";
import type { TipsRecordWithEmployee } from "@/types/pessoas";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export function GorjetasClient({
  unitName,
  records,
  defaultMes,
  defaultAno,
}: {
  unitName: string;
  records: TipsRecordWithEmployee[];
  defaultMes: number;
  defaultAno: number;
}) {
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const totalPontos = records.reduce((acc, r) => acc + r.pontos_liquidos, 0);
    const mediaValorPonto = records.length > 0
      ? records.reduce((acc, r) => acc + Number(r.valor_ponto), 0) / records.length
      : 0;
    return { total: records.length, totalPontos, mediaValorPonto };
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => {
      const name = r.employee ? `${r.employee.nome} ${r.employee.sobrenome}`.toLowerCase() : "";
      return name.includes(q);
    });
  }, [records, search]);

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 22 }}>
        <KpiCard icon={<Star size={18} />} label="Registros no período" value={counts.total} />
        <KpiCard icon={<TrendingUp size={18} />} label="Total de pontos líquidos" value={counts.totalPontos.toLocaleString("pt-BR")} />
        <KpiCard icon={<DollarSign size={18} />} label="Valor médio do ponto" value={formatBRL(counts.mediaValorPonto)} />
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", minWidth: 240, flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
          <Input placeholder="Buscar por colaborador…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 30 }} />
        </div>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginLeft: "auto" }}>
          {unitName} · {MESES[defaultMes - 1]}/{defaultAno} · {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-3)", fontSize: 13, background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8 }}>
          Nenhum registro para o filtro atual.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Valor/Ponto</TableHead>
              <TableHead className="text-right">Total Pontos</TableHead>
              <TableHead className="text-right">Abatimento</TableHead>
              <TableHead className="text-right">Pontos Líq.</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => {
              const name = r.employee ? `${r.employee.nome} ${r.employee.sobrenome}`.trim() : "—";
              const valorTotal = r.pontos_liquidos * Number(r.valor_ponto);
              const periodoLabel = (() => {
                const d = new Date(`${r.periodo}T00:00:00`);
                if (Number.isNaN(d.getTime())) return r.periodo;
                return `${MESES[d.getMonth()]}/${d.getFullYear()}`;
              })();
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.employee ? (
                      <Link href={`/pessoas/colaboradores/${r.employee_id}`} style={{ fontWeight: 600, color: "var(--text)", textDecoration: "none" }}>
                        {name}
                      </Link>
                    ) : <span style={{ color: "var(--text-3)" }}>—</span>}
                    {r.employee?.funcao && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{r.employee.funcao}</div>}
                  </TableCell>
                  <TableCell style={{ color: "var(--text-2)" }}>{periodoLabel}</TableCell>
                  <TableCell className="text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{formatBRL(r.valor_ponto)}</TableCell>
                  <TableCell className="text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{r.total_pontos.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right" style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-3)" }}>
                    {r.abatimento_pontos > 0 ? `−${r.abatimento_pontos.toLocaleString("pt-BR")}` : "—"}
                  </TableCell>
                  <TableCell className="text-right" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--brand)" }}>
                    {r.pontos_liquidos.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                    {formatBRL(valorTotal)}
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

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 99, background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", lineHeight: 1, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "gorjetas|error" | grep -v "ponto/debug"
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/pessoas/gorjetas/
git commit -m "feat(pessoas): implement Gorjetas consolidated view"
```

---

## Task 5: Página Vale Transporte

**Files:**
- Rewrite: `src/app/(dashboard)/pessoas/vale-transporte/page.tsx`
- Create: `src/app/(dashboard)/pessoas/vale-transporte/vt-client.tsx`

### Dados exibidos
Tabela: Colaborador, Período, Dias Úteis, Valor Diário, Total Bruto, Desconto Funcionário (6% padrão), Valor Empresa, Operadora.
Cards KPI: Total de beneficiários, Custo total empresa, Total de descontos aplicados.
Filtros: busca por nome.

### Notas sobre o modelo
- `total_bruto = dias_uteis × valor_diario`
- `desconto_funcionario` = valor descontado do salário do colaborador (6% do bruto)
- `valor_empresa = total_bruto − desconto_funcionario`

- [ ] **Step 1: Reescrever `page.tsx`**

```tsx
// src/app/(dashboard)/pessoas/vale-transporte/page.tsx
import { Suspense } from "react";

import { listVouchersByUnit } from "@/lib/pessoas/actions";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import { VtClient } from "./vt-client";

export const dynamic = "force-dynamic";

export default async function ValeTransportePage() {
  await requireUser();
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-3)" }}>
          Pessoas · Vale Transporte
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 4px", color: "var(--text)", letterSpacing: -0.4 }}>
          Vale Transporte da unit
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.55, maxWidth: 720 }}>
          Custo mensal de VT por colaborador. Para lançar ou editar, acesse o perfil do colaborador.
        </p>
      </header>
      <Suspense fallback={<div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>}>
        <VtSection />
      </Suspense>
    </div>
  );
}

async function VtSection() {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: "32px 22px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
        Selecione uma unit no topo para ver os vales transporte.
      </div>
    );
  }

  const now = new Date();
  const records = await listVouchersByUnit(unit.id, now.getMonth() + 1, now.getFullYear());

  return <VtClient unitName={unit.name} records={records} defaultMes={now.getMonth() + 1} defaultAno={now.getFullYear()} />;
}
```

- [ ] **Step 2: Criar `vt-client.tsx`**

```tsx
// src/app/(dashboard)/pessoas/vale-transporte/vt-client.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bus, Search, TrendingDown, Users } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBRL } from "@/lib/format";
import type { TransportVoucherWithEmployee } from "@/types/pessoas";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export function VtClient({
  unitName,
  records,
  defaultMes,
  defaultAno,
}: {
  unitName: string;
  records: TransportVoucherWithEmployee[];
  defaultMes: number;
  defaultAno: number;
}) {
  const [search, setSearch] = useState("");

  const totals = useMemo(() => {
    const custoEmpresa = records.reduce((acc, r) => acc + Number(r.valor_empresa), 0);
    const totalDescontos = records.reduce((acc, r) => acc + Number(r.desconto_funcionario), 0);
    return { beneficiarios: records.length, custoEmpresa, totalDescontos };
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => {
      const name = r.employee ? `${r.employee.nome} ${r.employee.sobrenome}`.toLowerCase() : "";
      return name.includes(q);
    });
  }, [records, search]);

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 22 }}>
        <KpiCard icon={<Users size={18} />} label="Beneficiários" value={totals.beneficiarios} />
        <KpiCard icon={<Bus size={18} />} label="Custo total empresa" value={formatBRL(totals.custoEmpresa)} />
        <KpiCard icon={<TrendingDown size={18} />} label="Total de descontos" value={formatBRL(totals.totalDescontos)} />
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", minWidth: 240, flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
          <Input placeholder="Buscar por colaborador…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 30 }} />
        </div>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginLeft: "auto" }}>
          {unitName} · {MESES[defaultMes - 1]}/{defaultAno} · {filtered.length} colaborador{filtered.length !== 1 ? "es" : ""}
        </div>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-3)", fontSize: 13, background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8 }}>
          Nenhum registro para o filtro atual.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Dias Úteis</TableHead>
              <TableHead className="text-right">Valor/Dia</TableHead>
              <TableHead className="text-right">Bruto</TableHead>
              <TableHead className="text-right">Desconto</TableHead>
              <TableHead className="text-right">Custo Empresa</TableHead>
              <TableHead>Operadora</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => {
              const name = r.employee ? `${r.employee.nome} ${r.employee.sobrenome}`.trim() : "—";
              const periodoLabel = (() => {
                const d = new Date(`${r.periodo}T00:00:00`);
                if (Number.isNaN(d.getTime())) return r.periodo;
                return `${MESES[d.getMonth()]}/${d.getFullYear()}`;
              })();
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.employee ? (
                      <Link href={`/pessoas/colaboradores/${r.employee_id}`} style={{ fontWeight: 600, color: "var(--text)", textDecoration: "none" }}>
                        {name}
                      </Link>
                    ) : <span style={{ color: "var(--text-3)" }}>—</span>}
                    {r.employee?.funcao && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{r.employee.funcao}</div>}
                  </TableCell>
                  <TableCell style={{ color: "var(--text-2)" }}>{periodoLabel}</TableCell>
                  <TableCell className="text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{r.dias_uteis}</TableCell>
                  <TableCell className="text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{formatBRL(r.valor_diario)}</TableCell>
                  <TableCell className="text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{formatBRL(r.total_bruto)}</TableCell>
                  <TableCell className="text-right" style={{ fontVariantNumeric: "tabular-nums", color: "#B91C1C" }}>
                    {Number(r.desconto_funcionario) > 0 ? `−${formatBRL(r.desconto_funcionario)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--brand)" }}>
                    {formatBRL(r.valor_empresa)}
                  </TableCell>
                  <TableCell style={{ fontSize: 12, color: "var(--text-2)" }}>{r.operadora ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 99, background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", lineHeight: 1, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "vale-transporte|error" | grep -v "ponto/debug"
```

Esperado: sem erros.

- [ ] **Step 4: Commit final**

```bash
git add src/app/\(dashboard\)/pessoas/vale-transporte/
git commit -m "feat(pessoas): implement Vale Transporte consolidated view"
```

---

## Verificação Final

- [ ] **Rodar tsc completo uma última vez**

```bash
npx tsc --noEmit 2>&1 | grep -v "ponto/debug"
```

Esperado: sem erros em nenhum dos 9 arquivos criados/modificados.

- [ ] **Checar que as 4 rotas da sidebar respondem (não retornam 404)**

Rotas:
- `/pessoas/faltas`
- `/pessoas/horas-extras`
- `/pessoas/gorjetas`
- `/pessoas/vale-transporte`

Todas devem renderizar a tela (mesmo que com "Selecione uma unit") sem erro 500.

---

# FASE 2 — Operação · Compras · Comercial

> Motivação: itens do backlog operacional (Controle de qualidade diário, Planilha de Cotação, Confirmação de reservas, Análise CMV) mapeados para stubs existentes na sidebar.

## Mapa de Arquivos — Fase 2

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/app/(dashboard)/compras/analise/page.tsx` | **Reescrever** | CMV overview por marca (usa view existente) |
| `src/app/(dashboard)/compras/analise/analise-client.tsx` | **Criar** | Cards CMV por marca + alertas críticos |
| `supabase/migrations/027_reservations.sql` | **Criar** | Tabela `reservations` + RLS |
| `src/types/database.ts` | **Modificar** | Adicionar tipos de `reservations` |
| `src/app/(dashboard)/comercial/reservas/actions.ts` | **Criar** | CRUD reservations |
| `src/app/(dashboard)/comercial/reservas/page.tsx` | **Reescrever** | Server component reservas |
| `src/app/(dashboard)/comercial/reservas/reservas-client.tsx` | **Criar** | Lista + form inline de reservas |
| `supabase/migrations/028_price_quotes.sql` | **Criar** | Tabelas `price_quotes` + `price_quote_items` + RLS |
| `src/types/database.ts` | **Modificar** | Adicionar tipos de cotações |
| `src/app/(dashboard)/compras/cotacoes/actions.ts` | **Criar** | CRUD cotações |
| `src/app/(dashboard)/compras/cotacoes/page.tsx` | **Reescrever** | Server component cotações |
| `src/app/(dashboard)/compras/cotacoes/cotacoes-client.tsx` | **Criar** | Lista de cotações + detalhe |
| `supabase/migrations/029_quality_checklists.sql` | **Criar** | Tabelas `quality_checklists` + `checklist_records` + RLS |
| `src/types/database.ts` | **Modificar** | Adicionar tipos de checklists |
| `src/app/(dashboard)/operacao/auditorias/actions.ts` | **Criar** | CRUD checklists + records |
| `src/app/(dashboard)/operacao/auditorias/page.tsx` | **Reescrever** | Server component auditorias |
| `src/app/(dashboard)/operacao/auditorias/auditorias-client.tsx` | **Criar** | Checklist diário + histórico |

---

## Task 6: Compras / Análise CMV

**Files:**
- Rewrite: `src/app/(dashboard)/compras/analise/page.tsx`
- Create: `src/app/(dashboard)/compras/analise/analise-client.tsx`

### Contexto

Já existe a view `v_cmv_dashboard` no banco com dados por marca:

```typescript
// CmvDashboardRow (src/types/database.ts linha ~2613)
{
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  total_itens: number;
  sem_ficha_tecnica: number;
  itens_criticos_acima_40: number;  // CMV > 40% — risco alto
  itens_atencao_30_40: number;       // CMV 30-40% — atenção
  cmv_medio_pct: number | null;
  cmv_medio_criticos: number | null;
}
```

A página `/financeiro/[brand_slug]/cmv` já tem o detalhe por marca (375 linhas). Esta tela é o **overview de grupo** — cards por marca com alertas, link para o detalhe.

### page.tsx

- [ ] **Step 1: Reescrever `page.tsx`**

```tsx
// src/app/(dashboard)/compras/analise/page.tsx
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CmvDashboardRow } from "@/types/database";
import { AnaliseCmvClient } from "./analise-client";

export const dynamic = "force-dynamic";

export default async function AnaliseCmvPage() {
  await requireUser();
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-3)" }}>
          Compras · Análise CMV
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 4px", color: "var(--text)", letterSpacing: -0.4 }}>
          Análise de CMV por Marca
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.55, maxWidth: 720 }}>
          Visão consolidada do CMV por marca. Itens críticos (&gt;40%) exigem revisão de ficha técnica ou negociação com fornecedor.
        </p>
      </header>
      <Suspense fallback={<div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>}>
        <AnaliseCmvSection />
      </Suspense>
    </div>
  );
}

async function AnaliseCmvSection() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <div style={{ color: "var(--text-3)" }}>Serviço indisponível.</div>;

  const { data, error } = await supabase
    .from("v_cmv_dashboard")
    .select("*")
    .order("cmv_medio_pct", { ascending: false });

  if (error || !data) {
    return <div style={{ color: "var(--text-3)", fontSize: 13 }}>Não foi possível carregar os dados.</div>;
  }

  return <AnaliseCmvClient rows={data as CmvDashboardRow[]} />;
}
```

- [ ] **Step 2: Criar `analise-client.tsx`**

```tsx
// src/app/(dashboard)/compras/analise/analise-client.tsx
"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileX, TrendingUp } from "lucide-react";
import type { CmvDashboardRow } from "@/types/database";

function cmvColor(pct: number | null): { bg: string; fg: string } {
  if (pct === null) return { bg: "rgba(100,116,139,0.12)", fg: "#64748B" };
  if (pct > 40) return { bg: "rgba(239,68,68,0.14)", fg: "#B91C1C" };
  if (pct > 30) return { bg: "rgba(245,158,11,0.14)", fg: "#A16207" };
  return { bg: "rgba(34,197,94,0.14)", fg: "#15803D" };
}

export function AnaliseCmvClient({ rows }: { rows: CmvDashboardRow[] }) {
  const totalCriticos = rows.reduce((a, r) => a + r.itens_criticos_acima_40, 0);
  const totalSemFicha = rows.reduce((a, r) => a + r.sem_ficha_tecnica, 0);
  const cmvMedioGrupo = rows.length > 0
    ? rows.filter((r) => r.cmv_medio_pct !== null).reduce((a, r) => a + (r.cmv_medio_pct ?? 0), 0) /
      rows.filter((r) => r.cmv_medio_pct !== null).length
    : null;

  return (
    <div>
      {/* KPI grupo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 28 }}>
        <KpiCard icon={<TrendingUp size={18} />} label="CMV médio do grupo" value={cmvMedioGrupo !== null ? `${cmvMedioGrupo.toFixed(1)}%` : "—"} highlight={cmvMedioGrupo !== null && cmvMedioGrupo > 35} />
        <KpiCard icon={<AlertTriangle size={18} />} label="Itens críticos (>40%)" value={totalCriticos} highlight={totalCriticos > 0} />
        <KpiCard icon={<FileX size={18} />} label="Sem ficha técnica" value={totalSemFicha} highlight={totalSemFicha > 0} />
      </div>

      {/* Cards por marca */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        {rows.map((r) => {
          const cor = cmvColor(r.cmv_medio_pct);
          return (
            <div key={r.brand_id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{r.brand_name}</div>
                <span style={{ display: "inline-block", padding: "3px 12px", borderRadius: 999, background: cor.bg, color: cor.fg, fontWeight: 700, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                  {r.cmv_medio_pct !== null ? `${r.cmv_medio_pct.toFixed(1)}%` : "—"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                <Stat label="Total itens" value={r.total_itens} />
                <Stat label="Críticos >40%" value={r.itens_criticos_acima_40} danger={r.itens_criticos_acima_40 > 0} />
                <Stat label="Atenção 30-40%" value={r.itens_atencao_30_40} warn={r.itens_atencao_30_40 > 0} />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                {r.sem_ficha_tecnica > 0 ? (
                  <span style={{ fontSize: 11, color: "#A16207", display: "flex", alignItems: "center", gap: 4 }}>
                    <FileX size={12} /> {r.sem_ficha_tecnica} sem ficha técnica
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: "#15803D", display: "flex", alignItems: "center", gap: 4 }}>
                    <CheckCircle2 size={12} /> Todas com ficha técnica
                  </span>
                )}
                <Link
                  href={`/financeiro/${r.brand_slug}/cmv`}
                  style={{ fontSize: 12, color: "var(--brand)", textDecoration: "none", fontWeight: 600 }}
                >
                  Ver detalhe →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {rows.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-3)", fontSize: 13, background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8 }}>
          Nenhuma marca com dados de CMV. Cadastre fichas técnicas no Cardápio.
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string | number; highlight?: boolean }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 99, background: highlight ? "rgba(239,68,68,0.12)" : "var(--brand-soft)", color: highlight ? "#B91C1C" : "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", lineHeight: 1, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, danger, warn }: { label: string; value: number; danger?: boolean; warn?: boolean }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: danger ? "#B91C1C" : warn ? "#A16207" : "var(--text)" }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>{label}</div>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "analise|error" | grep -v "ponto/debug"
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/compras/analise/
git commit -m "feat(compras): implement Análise CMV overview por marca"
```

---

## Task 7: Migration — Reservations

**Files:**
- Create: `supabase/migrations/027_reservations.sql`

### Schema

```sql
-- supabase/migrations/027_reservations.sql

create type reservation_status as enum (
  'pendente', 'confirmada', 'cancelada', 'no_show', 'finalizada'
);

create type reservation_origem as enum (
  'whatsapp', 'telefone', 'email', 'tagme', 'presencial', 'instagram'
);

create table reservations (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references units(id) on delete cascade,
  data        date not null,
  hora        time not null,
  pax         integer not null check (pax > 0),
  status      reservation_status not null default 'pendente',
  origem      reservation_origem not null default 'whatsapp',
  cliente_nome     text not null,
  cliente_telefone text,
  cliente_email    text,
  mesa        text,
  observacoes text,
  confirmado_por   uuid references auth.users(id),
  confirmado_em    timestamptz,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index reservations_unit_data_idx on reservations(unit_id, data);

alter table reservations enable row level security;

create policy "unit members can select reservations"
  on reservations for select
  using (kph_has_role_for_unit(unit_id));

create policy "unit members can insert reservations"
  on reservations for insert
  with check (kph_has_role_for_unit(unit_id));

create policy "unit members can update reservations"
  on reservations for update
  using (kph_has_role_for_unit(unit_id));
```

- [ ] **Step 1: Criar arquivo de migration**

Crie `supabase/migrations/027_reservations.sql` com o SQL acima.

- [ ] **Step 2: Aplicar no Supabase**

No Supabase SQL Editor (Dashboard do projeto `iqgrvptrtphvbmvrqntm`), cole e execute o SQL. Verificar que a tabela `reservations` aparece no schema.

- [ ] **Step 3: Atualizar `src/types/database.ts`**

Adicionar na seção `Tables` de `Database["public"]`:

```typescript
reservations: {
  Row: {
    id: string;
    unit_id: string;
    data: string;           // DATE
    hora: string;           // TIME
    pax: number;
    status: "pendente" | "confirmada" | "cancelada" | "no_show" | "finalizada";
    origem: "whatsapp" | "telefone" | "email" | "tagme" | "presencial" | "instagram";
    cliente_nome: string;
    cliente_telefone: string | null;
    cliente_email: string | null;
    mesa: string | null;
    observacoes: string | null;
    confirmado_por: string | null;
    confirmado_em: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    unit_id: string;
    data: string;
    hora: string;
    pax: number;
    status?: "pendente" | "confirmada" | "cancelada" | "no_show" | "finalizada";
    origem?: "whatsapp" | "telefone" | "email" | "tagme" | "presencial" | "instagram";
    cliente_nome: string;
    cliente_telefone?: string | null;
    cliente_email?: string | null;
    mesa?: string | null;
    observacoes?: string | null;
    confirmado_por?: string | null;
    confirmado_em?: string | null;
    created_by?: string | null;
  };
  Update: Partial<Omit<Tables<"reservations">["Insert"], "unit_id">>;
};
```

Adicionar ao final do arquivo:
```typescript
export type ReservationRow = Tables<"reservations">;
export type ReservationStatus = ReservationRow["status"];
export type ReservationOrigem = ReservationRow["origem"];
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/027_reservations.sql src/types/database.ts
git commit -m "feat(reservas): migration + types for reservations table"
```

---

## Task 8: Comercial / Reservas (UI)

**Files:**
- Rewrite: `src/app/(dashboard)/comercial/reservas/page.tsx`
- Create: `src/app/(dashboard)/comercial/reservas/actions.ts`
- Create: `src/app/(dashboard)/comercial/reservas/reservas-client.tsx`

### Dados exibidos

Tabela: Cliente, Data/Hora, Pax, Origem (badge), Status (badge), Mesa, Ações (confirmar/cancelar).
Cards KPI: Reservas do dia, Confirmadas, Pendentes.
Filtros: busca por nome + status + data.
Ações: confirmar (status → confirmada) + cancelar (→ cancelada) + no-show (→ no_show).
Form inline (Sheet/Dialog) para criar nova reserva.

### actions.ts

```typescript
// src/app/(dashboard)/comercial/reservas/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import type { ActionResult } from "@/lib/result";
import type { ReservationRow } from "@/types/database";

const TABLE = "reservations" as const;

export async function listReservations(
  unitId: string,
  data?: string,
): Promise<ReservationRow[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    let query = supabase
      .from(TABLE)
      .select("*")
      .eq("unit_id", unitId)
      .order("data", { ascending: true })
      .order("hora", { ascending: true });
    if (data) query = query.eq("data", data);
    const { data: rows, error } = await query;
    if (error) { console.error("[listReservations]", error.message); return []; }
    return (rows ?? []) as ReservationRow[];
  } catch (e) { console.error("[listReservations] exceção:", e); return []; }
}

export async function createReservation(
  input: Omit<ReservationRow, "id" | "created_at" | "updated_at" | "confirmado_por" | "confirmado_em">,
): Promise<ActionResult<ReservationRow>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(TABLE)
      .insert(input as never)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha ao criar" };
    revalidatePath("/comercial/reservas");
    return { ok: true, data: data as ReservationRow };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erro" }; }
}

export async function updateReservationStatus(
  id: string,
  status: ReservationRow["status"],
  userId?: string | null,
): Promise<ActionResult<ReservationRow>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const patch: Record<string, unknown> = { status };
    if (status === "confirmada" && userId) {
      patch.confirmado_por = userId;
      patch.confirmado_em = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from(TABLE)
      .update(patch as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
    revalidatePath("/comercial/reservas");
    return { ok: true, data: data as ReservationRow };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erro" }; }
}
```

### page.tsx

```tsx
// src/app/(dashboard)/comercial/reservas/page.tsx
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import { listReservations } from "./actions";
import { ReservasClient } from "./reservas-client";

export const dynamic = "force-dynamic";

export default async function ReservasPage() {
  await requireUser();
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-3)" }}>
          Comercial · Reservas
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 4px", color: "var(--text)", letterSpacing: -0.4 }}>
          Reservas
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.55, maxWidth: 720 }}>
          Controle de reservas da unit — confirmação, cancelamento e acompanhamento em tempo real.
        </p>
      </header>
      <Suspense fallback={<div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>}>
        <ReservasSection />
      </Suspense>
    </div>
  );
}

async function ReservasSection() {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: "32px 22px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
        Selecione uma unit no topo para ver as reservas.
      </div>
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  const reservas = await listReservations(unit.id, today);
  return <ReservasClient unitId={unit.id} unitName={unit.name} reservas={reservas} today={today} />;
}
```

### reservas-client.tsx

Componente `"use client"` com:
- 3 KPI cards (total do dia, confirmadas, pendentes)
- Filtro de data (input type="date" com default hoje) + filtro de status + busca por nome
- Tabela com colunas: Cliente, Hora, Pax, Origem (badge), Status (badge), Mesa, Ações
- Ações por linha: botão Confirmar (→ confirmada), botão No-show, botão Cancelar — apenas quando status === "pendente"
- Botão "+ Nova Reserva" que abre Dialog com form (campos: cliente_nome, cliente_telefone, data, hora, pax, origem, mesa, observacoes)
- Ao mudar data no filtro, recarrega via `listReservations(unitId, data)` + `router.refresh()`

Cores de status:
- `pendente` → amarelo `rgba(245,158,11,0.16)` / `#A16207`
- `confirmada` → verde `rgba(34,197,94,0.16)` / `#15803D`
- `cancelada` → cinza `rgba(100,116,139,0.14)` / `#475569`
- `no_show` → vermelho `rgba(239,68,68,0.16)` / `#B91C1C`
- `finalizada` → azul `rgba(59,130,246,0.16)` / `#1D4ED8`

Cores de origem:
- `whatsapp` → verde `#25D366`
- `instagram` → roxo `#E1306C`
- `tagme` → laranja `#F97316`
- `telefone`, `email`, `presencial` → cinza

- [ ] **Step 1: Criar `actions.ts`** com o código acima
- [ ] **Step 2: Reescrever `page.tsx`** com o código acima
- [ ] **Step 3: Criar `reservas-client.tsx`** com a lógica descrita
- [ ] **Step 4: TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "reservas|error" | grep -v "ponto/debug"
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/comercial/reservas/
git commit -m "feat(comercial): implement Reservas with CRUD and status flow"
```

---

## Task 9: Migration — Price Quotes (Cotações)

**Files:**
- Create: `supabase/migrations/028_price_quotes.sql`

### Schema

```sql
-- supabase/migrations/028_price_quotes.sql

create type quote_status as enum ('rascunho', 'enviada', 'recebida', 'aprovada', 'cancelada');

create table price_quotes (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references units(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  periodo     date not null,                       -- primeiro dia do mês de referência
  status      quote_status not null default 'rascunho',
  titulo      text,
  observacoes text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table price_quote_items (
  id              uuid primary key default gen_random_uuid(),
  quote_id        uuid not null references price_quotes(id) on delete cascade,
  descricao       text not null,
  unidade         text not null default 'kg',
  quantidade      numeric(10,3) not null,
  preco_unitario  numeric(10,4),
  total           numeric(12,2) generated always as (
    case when preco_unitario is not null then quantidade * preco_unitario else null end
  ) stored,
  observacoes     text,
  created_at      timestamptz not null default now()
);

create index price_quotes_unit_idx on price_quotes(unit_id, periodo);
create index price_quote_items_quote_idx on price_quote_items(quote_id);

alter table price_quotes enable row level security;
alter table price_quote_items enable row level security;

create policy "unit members can select quotes"
  on price_quotes for select using (kph_has_role_for_unit(unit_id));
create policy "unit members can insert quotes"
  on price_quotes for insert with check (kph_has_role_for_unit(unit_id));
create policy "unit members can update quotes"
  on price_quotes for update using (kph_has_role_for_unit(unit_id));

create policy "unit members can select quote items"
  on price_quote_items for select
  using (exists (select 1 from price_quotes q where q.id = quote_id and kph_has_role_for_unit(q.unit_id)));
create policy "unit members can insert quote items"
  on price_quote_items for insert
  with check (exists (select 1 from price_quotes q where q.id = quote_id and kph_has_role_for_unit(q.unit_id)));
create policy "unit members can update quote items"
  on price_quote_items for update
  using (exists (select 1 from price_quotes q where q.id = quote_id and kph_has_role_for_unit(q.unit_id)));
create policy "unit members can delete quote items"
  on price_quote_items for delete
  using (exists (select 1 from price_quotes q where q.id = quote_id and kph_has_role_for_unit(q.unit_id)));
```

- [ ] **Step 1:** Criar `supabase/migrations/028_price_quotes.sql`
- [ ] **Step 2:** Aplicar no Supabase SQL Editor
- [ ] **Step 3:** Adicionar tipos em `database.ts` (`price_quotes`, `price_quote_items`, `PriceQuoteRow`, `PriceQuoteItemRow`, `QuoteStatus`)
- [ ] **Step 4:** Commit

```bash
git add supabase/migrations/028_price_quotes.sql src/types/database.ts
git commit -m "feat(cotacoes): migration + types for price_quotes tables"
```

---

## Task 10: Compras / Cotações (UI)

**Files:**
- Create: `src/app/(dashboard)/compras/cotacoes/actions.ts`
- Rewrite: `src/app/(dashboard)/compras/cotacoes/page.tsx`
- Create: `src/app/(dashboard)/compras/cotacoes/cotacoes-client.tsx`

### Fluxo

1. Lista de cotações da unit (filtro por período/status)
2. Criar nova cotação (titulo, supplier, periodo)
3. Adicionar itens à cotação (descricao, unidade, qtd, preço)
4. Mudar status: rascunho → enviada → recebida → aprovada

### actions.ts

```typescript
// src/app/(dashboard)/compras/cotacoes/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/result";
import type { PriceQuoteRow, PriceQuoteItemRow } from "@/types/database";

export async function listQuotes(unitId: string, mes?: number, ano?: number): Promise<(PriceQuoteRow & { supplier_nome?: string | null; total_itens: number; total_valor: number | null })[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  let query = supabase
    .from("price_quotes")
    .select("*, suppliers(nome), price_quote_items(total)")
    .eq("unit_id", unitId)
    .order("created_at", { ascending: false });
  if (mes && ano) {
    const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
    query = query.eq("periodo", start);
  }
  const { data, error } = await query;
  if (error) { console.error("[listQuotes]", error.message); return []; }
  return (data ?? []).map((r: any) => ({
    ...r,
    supplier_nome: r.suppliers?.nome ?? null,
    total_itens: r.price_quote_items?.length ?? 0,
    total_valor: r.price_quote_items?.reduce((acc: number, i: any) => acc + (i.total ?? 0), 0) ?? null,
  }));
}

export async function createQuote(input: Omit<PriceQuoteRow, "id" | "created_at" | "updated_at">): Promise<ActionResult<PriceQuoteRow>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível" };
  const { data, error } = await supabase.from("price_quotes").insert(input as never).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
  revalidatePath("/compras/cotacoes");
  return { ok: true, data: data as PriceQuoteRow };
}

export async function updateQuoteStatus(id: string, status: PriceQuoteRow["status"]): Promise<ActionResult<PriceQuoteRow>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível" };
  const { data, error } = await supabase.from("price_quotes").update({ status } as never).eq("id", id).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
  revalidatePath("/compras/cotacoes");
  return { ok: true, data: data as PriceQuoteRow };
}

export async function listQuoteItems(quoteId: string): Promise<PriceQuoteItemRow[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("price_quote_items").select("*").eq("quote_id", quoteId).order("created_at");
  if (error) return [];
  return (data ?? []) as PriceQuoteItemRow[];
}

export async function createQuoteItem(input: Omit<PriceQuoteItemRow, "id" | "total" | "created_at">): Promise<ActionResult<PriceQuoteItemRow>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível" };
  const { data, error } = await supabase.from("price_quote_items").insert(input as never).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
  revalidatePath("/compras/cotacoes");
  return { ok: true, data: data as PriceQuoteItemRow };
}

export async function deleteQuoteItem(id: string): Promise<ActionResult<null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível" };
  const { error } = await supabase.from("price_quote_items").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/compras/cotacoes");
  return { ok: true, data: null };
}
```

### page.tsx

```tsx
// src/app/(dashboard)/compras/cotacoes/page.tsx
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import { listQuotes } from "./actions";
import { CotacoesClient } from "./cotacoes-client";

export const dynamic = "force-dynamic";

export default async function CotacoesPage() {
  await requireUser();
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-3)" }}>
          Compras · Cotações
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 4px", color: "var(--text)", letterSpacing: -0.4 }}>
          Cotações
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.55, maxWidth: 720 }}>
          Planilha de cotação por fornecedor — crie, envie e compare preços por período.
        </p>
      </header>
      <Suspense fallback={<div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>}>
        <CotacoesSection />
      </Suspense>
    </div>
  );
}

async function CotacoesSection() {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: "32px 22px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
        Selecione uma unit no topo para ver as cotações.
      </div>
    );
  }
  const now = new Date();
  const quotes = await listQuotes(unit.id, now.getMonth() + 1, now.getFullYear());
  return <CotacoesClient unitId={unit.id} unitName={unit.name} quotes={quotes} defaultMes={now.getMonth() + 1} defaultAno={now.getFullYear()} />;
}
```

### cotacoes-client.tsx

Componente `"use client"` com:
- KPI cards: Total de cotações, Enviadas aguardando, Total estimado
- Filtro de status + busca por título/fornecedor
- Tabela: Título, Fornecedor, Período, Itens, Total Estimado, Status (badge), Ações
- Botão "+ Nova Cotação" → Dialog com form (titulo, supplier_id select, periodo month-picker)
- Click na linha → expandir ou navegar para detalhe com lista de itens + form de add item
- Ações inline: avançar status (rascunho→enviada→recebida→aprovada)

Cores de status:
- `rascunho` → cinza
- `enviada` → azul
- `recebida` → amarelo
- `aprovada` → verde
- `cancelada` → vermelho

- [ ] **Step 1:** Criar `actions.ts`
- [ ] **Step 2:** Reescrever `page.tsx`
- [ ] **Step 3:** Criar `cotacoes-client.tsx`
- [ ] **Step 4:** TypeScript check
- [ ] **Step 5:** Commit

```bash
git add src/app/\(dashboard\)/compras/cotacoes/
git commit -m "feat(compras): implement Cotações with CRUD and status flow"
```

---

## Task 11: Migration — Quality Checklists (Auditorias)

**Files:**
- Create: `supabase/migrations/029_quality_checklists.sql`

### Schema

```sql
-- supabase/migrations/029_quality_checklists.sql

create type checklist_turno as enum ('abertura', 'almoco', 'jantar', 'fechamento');
create type checklist_area  as enum ('cozinha', 'bar', 'salao', 'higiene', 'geral');

create table quality_checklists (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references units(id) on delete cascade,
  nome        text not null,
  area        checklist_area not null default 'geral',
  turno       checklist_turno not null default 'abertura',
  items       jsonb not null default '[]'::jsonb,
  -- items é array de { id: uuid, texto: string, obrigatorio: boolean }
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

create table checklist_records (
  id              uuid primary key default gen_random_uuid(),
  checklist_id    uuid not null references quality_checklists(id) on delete cascade,
  unit_id         uuid not null references units(id) on delete cascade,
  data            date not null default current_date,
  turno           checklist_turno not null,
  responsavel_id  uuid references auth.users(id),
  respostas       jsonb not null default '{}'::jsonb,
  -- respostas é { [item_id]: boolean }
  score_pct       integer,    -- % de itens OK — calculado no client antes de salvar
  observacoes     text,
  created_at      timestamptz not null default now()
);

create index quality_checklists_unit_idx on quality_checklists(unit_id);
create index checklist_records_unit_data_idx on checklist_records(unit_id, data);

alter table quality_checklists enable row level security;
alter table checklist_records  enable row level security;

create policy "unit members can select checklists"
  on quality_checklists for select using (kph_has_role_for_unit(unit_id));
create policy "unit members can manage checklists"
  on quality_checklists for all using (kph_has_role_for_unit(unit_id));

create policy "unit members can select records"
  on checklist_records for select using (kph_has_role_for_unit(unit_id));
create policy "unit members can insert records"
  on checklist_records for insert with check (kph_has_role_for_unit(unit_id));
```

- [ ] **Step 1:** Criar `supabase/migrations/029_quality_checklists.sql`
- [ ] **Step 2:** Aplicar no Supabase SQL Editor
- [ ] **Step 3:** Adicionar tipos em `database.ts` (`quality_checklists`, `checklist_records`, `QualityChecklistRow`, `ChecklistRecordRow`)
- [ ] **Step 4:** Commit

```bash
git add supabase/migrations/029_quality_checklists.sql src/types/database.ts
git commit -m "feat(auditorias): migration + types for quality_checklists tables"
```

---

## Task 12: Operação / Auditorias (UI)

**Files:**
- Create: `src/app/(dashboard)/operacao/auditorias/actions.ts`
- Rewrite: `src/app/(dashboard)/operacao/auditorias/page.tsx`
- Create: `src/app/(dashboard)/operacao/auditorias/auditorias-client.tsx`

### Fluxo

1. Aba "Checklists do dia" — selecionar turno, ver checklists ativos, preencher e submeter
2. Aba "Histórico" — tabela de records dos últimos 30 dias com score_pct
3. Aba "Configurar" — criar/editar templates de checklist (admin only)

### actions.ts

```typescript
// src/app/(dashboard)/operacao/auditorias/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/result";
import type { QualityChecklistRow, ChecklistRecordRow } from "@/types/database";

export async function listChecklists(unitId: string, apenasAtivos = true): Promise<QualityChecklistRow[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  let q = supabase.from("quality_checklists").select("*").eq("unit_id", unitId).order("area").order("turno");
  if (apenasAtivos) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as QualityChecklistRow[];
}

export async function listChecklistRecords(unitId: string, dias = 30): Promise<ChecklistRecordRow[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const { data, error } = await supabase
    .from("checklist_records")
    .select("*")
    .eq("unit_id", unitId)
    .gte("data", desde.toISOString().slice(0, 10))
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as ChecklistRecordRow[];
}

export async function submitChecklistRecord(
  input: Omit<ChecklistRecordRow, "id" | "created_at">,
): Promise<ActionResult<ChecklistRecordRow>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível" };
  const { data, error } = await supabase.from("checklist_records").insert(input as never).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
  revalidatePath("/operacao/auditorias");
  return { ok: true, data: data as ChecklistRecordRow };
}

export async function createChecklist(
  input: Omit<QualityChecklistRow, "id" | "created_at">,
): Promise<ActionResult<QualityChecklistRow>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível" };
  const { data, error } = await supabase.from("quality_checklists").insert(input as never).select().single();
  if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
  revalidatePath("/operacao/auditorias");
  return { ok: true, data: data as QualityChecklistRow };
}
```

### page.tsx

```tsx
// src/app/(dashboard)/operacao/auditorias/page.tsx
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import { listChecklists, listChecklistRecords } from "./actions";
import { AuditoriasClient } from "./auditorias-client";

export const dynamic = "force-dynamic";

export default async function AuditoriasPage() {
  await requireUser();
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-3)" }}>
          Operação · Auditorias
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 4px", color: "var(--text)", letterSpacing: -0.4 }}>
          Controle de Qualidade
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.55, maxWidth: 720 }}>
          Checklists diários por turno — cozinha, bar, salão e higiene. Histórico com score de conformidade.
        </p>
      </header>
      <Suspense fallback={<div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>}>
        <AuditoriasSection />
      </Suspense>
    </div>
  );
}

async function AuditoriasSection() {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: "32px 22px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
        Selecione uma unit no topo para ver os checklists.
      </div>
    );
  }
  const [checklists, records] = await Promise.all([
    listChecklists(unit.id),
    listChecklistRecords(unit.id, 30),
  ]);
  return <AuditoriasClient unitId={unit.id} unitName={unit.name} checklists={checklists} records={records} />;
}
```

### auditorias-client.tsx

Componente `"use client"` com 3 abas:

**Aba 1 — Hoje:**
- Select de turno (abertura/almoço/jantar/fechamento)
- Cards de checklist do turno selecionado
- Cada card: nome, área, lista de itens como checkboxes
- Botão "Submeter" calcula score_pct (% de itens marcados) e chama `submitChecklistRecord`

**Aba 2 — Histórico:**
- Tabela: Data, Turno, Checklist, Score (badge colorido), Observações
- Score: verde >80%, amarelo 60-80%, vermelho <60%

**Aba 3 — Configurar:**
- Lista de checklists existentes
- Botão "+ Novo Checklist" → form (nome, área, turno, itens em textarea separados por linha)

- [ ] **Step 1:** Criar `actions.ts`
- [ ] **Step 2:** Reescrever `page.tsx`
- [ ] **Step 3:** Criar `auditorias-client.tsx` com as 3 abas
- [ ] **Step 4:** TypeScript check
- [ ] **Step 5:** Commit

```bash
git add src/app/\(dashboard\)/operacao/auditorias/
git commit -m "feat(operacao): implement Auditorias checklist diário com histórico"
```

---

## Task 13: Operação / Performance (KPI Operacional)

**Files:**
- Create: `src/app/(dashboard)/operacao/performance/actions.ts`
- Rewrite: `src/app/(dashboard)/operacao/performance/page.tsx`
- Create: `src/app/(dashboard)/operacao/performance/performance-client.tsx`

### Contexto

Nenhuma migration nova é necessária — a página agrega dados de tabelas existentes:
- `absences` → taxa de absenteísmo do mês
- `overtime_records` → HE totais e pendentes
- `employees` → headcount ativo por função/departamento
- `checklist_records` → score médio de auditorias (disponível após Task 12)

### actions.ts

```typescript
// src/app/(dashboard)/operacao/performance/actions.ts
"use server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PerformanceKpis = {
  headcountAtivo: number;
  headcountPorFuncao: { funcao: string; count: number }[];
  faltasMes: number;
  absenteismoPct: number;
  heHorasMes: number;
  hePendentes: number;
  checklistScoreMedio: number | null; // null se sem registros
  checklistRegistros: number;
};

export async function getPerformanceKpis(
  unitId: string,
  mes: number,
  ano: number,
): Promise<PerformanceKpis> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return emptyKpis();

  const mesStr = String(mes).padStart(2, "0");
  const start = `${ano}-${mesStr}-01`;
  const lastDay = new Date(ano, mes, 0).getDate();
  const end = `${ano}-${mesStr}-${String(lastDay).padStart(2, "0")}`;

  const [empRes, faltasRes, heRes, checkRes] = await Promise.all([
    supabase
      .from("employees")
      .select("id, funcao")
      .eq("unit_id", unitId)
      .eq("status", "ativo"),
    supabase
      .from("absences")
      .select("id")
      .eq("unit_id", unitId)
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("overtime_records")
      .select("id, hours, approved")
      .eq("unit_id", unitId)
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("checklist_records")
      .select("score_pct")
      .eq("unit_id", unitId)
      .gte("data", start)
      .lte("data", end),
  ]);

  const employees = empRes.data ?? [];
  const faltas = faltasRes.data ?? [];
  const hes = heRes.data ?? [];
  const checks = (checkRes.data ?? []).filter((c) => c.score_pct !== null);

  const headcountAtivo = employees.length;
  const faltasMes = faltas.length;
  const diasUteis = 22; // aproximação
  const absenteismoPct =
    headcountAtivo > 0
      ? Math.round((faltasMes / (headcountAtivo * diasUteis)) * 100 * 10) / 10
      : 0;

  const funcaoCounts = new Map<string, number>();
  for (const e of employees) {
    const f = e.funcao ?? "Sem função";
    funcaoCounts.set(f, (funcaoCounts.get(f) ?? 0) + 1);
  }
  const headcountPorFuncao = Array.from(funcaoCounts.entries())
    .map(([funcao, count]) => ({ funcao, count }))
    .sort((a, b) => b.count - a.count);

  const heHorasMes = hes.reduce((s, h) => s + Number(h.hours), 0);
  const hePendentes = hes.filter((h) => h.approved === null).length;

  const checklistScoreMedio =
    checks.length > 0
      ? Math.round(checks.reduce((s, c) => s + (c.score_pct ?? 0), 0) / checks.length)
      : null;

  return {
    headcountAtivo,
    headcountPorFuncao,
    faltasMes,
    absenteismoPct,
    heHorasMes,
    hePendentes,
    checklistScoreMedio,
    checklistRegistros: checks.length,
  };
}

function emptyKpis(): PerformanceKpis {
  return {
    headcountAtivo: 0,
    headcountPorFuncao: [],
    faltasMes: 0,
    absenteismoPct: 0,
    heHorasMes: 0,
    hePendentes: 0,
    checklistScoreMedio: null,
    checklistRegistros: 0,
  };
}
```

### page.tsx

```tsx
// src/app/(dashboard)/operacao/performance/page.tsx
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import { getPerformanceKpis } from "./actions";
import { PerformanceClient } from "./performance-client";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  await requireUser();
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-3)" }}>
          Operação · Performance
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 4px", color: "var(--text)", letterSpacing: -0.4 }}>
          KPIs Operacionais
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.55, maxWidth: 720 }}>
          Headcount, absenteísmo, horas extras e score de auditorias no período selecionado.
        </p>
      </header>
      <Suspense fallback={<div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>}>
        <PerformanceSection />
      </Suspense>
    </div>
  );
}

async function PerformanceSection() {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: "32px 22px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
        Selecione uma unit no topo para ver os KPIs.
      </div>
    );
  }
  const hoje = new Date();
  const kpis = await getPerformanceKpis(unit.id, hoje.getMonth() + 1, hoje.getFullYear());
  return <PerformanceClient unitName={unit.name} kpis={kpis} defaultMes={hoje.getMonth() + 1} defaultAno={hoje.getFullYear()} />;
}
```

### performance-client.tsx

Componente `"use client"` com:

**Linha 1 — Seletor de período:**
- `Select` com meses (Jan-Dez) + input de ano
- Ao mudar: `router.push` com `?mes=X&ano=Y`, page re-fetches via `force-dynamic`

**Linha 2 — Cards de KPI (grid 3 colunas):**
- Headcount ativo (ícone Users)
- Faltas no período + % absenteísmo (ícone UserX)  
- Horas extras acumuladas + X pendentes (ícone Clock, highlight se pendentes > 0)
- Score médio de auditorias (badge colorido: verde >80%, amarelo 60-80%, vermelho <60%, cinza se sem dados)

**Seção — Headcount por função:**
- Tabela simples: Função | Colaboradores
- Ordenada por count desc

```tsx
// src/app/(dashboard)/operacao/performance/performance-client.tsx
"use client";
import { Users, UserX, Clock, ClipboardCheck } from "lucide-react";
import type { PerformanceKpis } from "./actions";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function scoreBadge(score: number | null) {
  if (score === null) return { bg: "var(--surface)", fg: "var(--text-3)", label: "—" };
  if (score >= 80) return { bg: "rgba(21,128,61,0.12)", fg: "#15803D", label: `${score}%` };
  if (score >= 60) return { bg: "rgba(161,98,7,0.12)", fg: "#A16207", label: `${score}%` };
  return { bg: "rgba(185,28,28,0.12)", fg: "#B91C1C", label: `${score}%` };
}

export function PerformanceClient({
  unitName,
  kpis,
  defaultMes,
  defaultAno,
}: {
  unitName: string;
  kpis: PerformanceKpis;
  defaultMes: number;
  defaultAno: number;
}) {
  const badge = scoreBadge(kpis.checklistScoreMedio);
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 18 }}>
        {unitName} · {MESES[defaultMes - 1]}/{defaultAno}
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 28 }}>
        <KpiCard icon={<Users size={18} />} label="Headcount ativo" value={kpis.headcountAtivo} />
        <KpiCard
          icon={<UserX size={18} />}
          label="Faltas no período"
          value={`${kpis.faltasMes} (${kpis.absenteismoPct}%)`}
          highlight={kpis.absenteismoPct > 5}
        />
        <KpiCard
          icon={<Clock size={18} />}
          label="Horas extras"
          value={`${kpis.heHorasMes.toFixed(1)}h`}
          sub={kpis.hePendentes > 0 ? `${kpis.hePendentes} pendente${kpis.hePendentes > 1 ? "s" : ""}` : undefined}
          highlight={kpis.hePendentes > 0}
        />
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 99, background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ClipboardCheck size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>Score de auditorias</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{badge.label}</span>
              {kpis.checklistRegistros > 0 && (
                <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, background: badge.bg, color: badge.fg, fontWeight: 600, fontSize: 11 }}>
                  {kpis.checklistRegistros} registro{kpis.checklistRegistros > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Headcount por função */}
      {kpis.headcountPorFuncao.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>Headcount por função</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Função</TableHead>
                <TableHead className="text-right">Colaboradores</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpis.headcountPorFuncao.map((row) => (
                <TableRow key={row.funcao}>
                  <TableCell style={{ fontWeight: 500 }}>{row.funcao}</TableCell>
                  <TableCell className="text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, highlight }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; highlight?: boolean }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 99, background: highlight ? "rgba(245,158,11,0.14)" : "var(--brand-soft)", color: highlight ? "#A16207" : "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", lineHeight: 1, marginTop: 2 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: highlight ? "#A16207" : "var(--text-3)", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 1:** Criar `actions.ts`
- [ ] **Step 2:** Reescrever `page.tsx`
- [ ] **Step 3:** Criar `performance-client.tsx`
- [ ] **Step 4:** TypeScript check
- [ ] **Step 5:** Commit

```bash
git add src/app/\(dashboard\)/operacao/performance/
git commit -m "feat(operacao): implement Performance KPI dashboard"
```

---

## Task 14: Migration + Operação / Mapa da Casa

**Files:**
- Create: `supabase/migrations/030_restaurant_tables.sql`
- Create: `src/app/(dashboard)/operacao/mapa/actions.ts`
- Rewrite: `src/app/(dashboard)/operacao/mapa/page.tsx`
- Create: `src/app/(dashboard)/operacao/mapa/mapa-client.tsx`

### Contexto

O Mapa da Casa mostra a planta de mesas do restaurante com status de ocupação. Integra com `reservations` (Task 7) para mostrar reservas do dia. MVP visual: grid de cards de mesa, não drag-and-drop.

### Migration

```sql
-- supabase/migrations/030_restaurant_tables.sql

create type table_status as enum ('livre', 'ocupada', 'reservada', 'bloqueada');
create type table_area   as enum ('salao', 'varanda', 'bar', 'vip', 'externa');

create table restaurant_tables (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references units(id) on delete cascade,
  numero     text not null,          -- ex: "1", "A3", "VIP-2"
  capacidade integer not null default 4,
  area       table_area not null default 'salao',
  status     table_status not null default 'livre',
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (unit_id, numero)
);

create index restaurant_tables_unit_idx on restaurant_tables(unit_id);

alter table restaurant_tables enable row level security;

create policy "unit members can select tables"
  on restaurant_tables for select using (kph_has_role_for_unit(unit_id));
create policy "unit members can manage tables"
  on restaurant_tables for all using (kph_has_role_for_unit(unit_id));
```

- [ ] **Step 1:** Criar `supabase/migrations/030_restaurant_tables.sql`
- [ ] **Step 2:** Aplicar no Supabase SQL Editor

### actions.ts

```typescript
// src/app/(dashboard)/operacao/mapa/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RestaurantTable = {
  id: string;
  unit_id: string;
  numero: string;
  capacidade: number;
  area: "salao" | "varanda" | "bar" | "vip" | "externa";
  status: "livre" | "ocupada" | "reservada" | "bloqueada";
  ativo: boolean;
  created_at: string;
};

export type TableWithReserva = RestaurantTable & {
  reserva_nome?: string;   // nome do cliente da reserva do dia, se houver
  reserva_horario?: string;
};

export async function listRestaurantTables(unitId: string): Promise<TableWithReserva[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const hoje = new Date().toISOString().slice(0, 10);
  const [tablesRes, reservasRes] = await Promise.all([
    supabase
      .from("restaurant_tables")
      .select("*")
      .eq("unit_id", unitId)
      .eq("ativo", true)
      .order("area")
      .order("numero"),
    supabase
      .from("reservations")
      .select("mesa, nome_cliente, horario, status")
      .eq("unit_id", unitId)
      .eq("data", hoje)
      .in("status", ["confirmada", "pendente"]),
  ]);
  const reservasByMesa = new Map<string, { nome_cliente: string; horario: string }>();
  for (const r of reservasRes.data ?? []) {
    if (r.mesa) reservasByMesa.set(r.mesa, { nome_cliente: r.nome_cliente, horario: r.horario });
  }
  return (tablesRes.data ?? []).map((t) => {
    const res = reservasByMesa.get(t.numero);
    return {
      ...t,
      reserva_nome: res?.nome_cliente,
      reserva_horario: res?.horario,
    } as TableWithReserva;
  });
}

export async function updateTableStatus(
  id: string,
  status: RestaurantTable["status"],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível" };
  const { error } = await supabase
    .from("restaurant_tables")
    .update({ status } as never)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/operacao/mapa");
  return { ok: true };
}

export async function createRestaurantTable(input: {
  unit_id: string;
  numero: string;
  capacidade: number;
  area: RestaurantTable["area"];
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível" };
  const { error } = await supabase.from("restaurant_tables").insert(input as never);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/operacao/mapa");
  return { ok: true };
}
```

### page.tsx

```tsx
// src/app/(dashboard)/operacao/mapa/page.tsx
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/server";
import { getCurrentUnit } from "@/lib/auth/unit";
import { listRestaurantTables } from "./actions";
import { MapaClient } from "./mapa-client";

export const dynamic = "force-dynamic";

export default async function MapaPage() {
  await requireUser();
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-3)" }}>
          Operação · Mapa da Casa
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 4px", color: "var(--text)", letterSpacing: -0.4 }}>
          Mapa da Casa
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.55, maxWidth: 720 }}>
          Status das mesas em tempo real. Clique em uma mesa para alterar o status. Reservas do dia são marcadas automaticamente.
        </p>
      </header>
      <Suspense fallback={<div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>}>
        <MapaSection />
      </Suspense>
    </div>
  );
}

async function MapaSection() {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: "32px 22px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
        Selecione uma unit no topo para ver o mapa.
      </div>
    );
  }
  const tables = await listRestaurantTables(unit.id);
  return <MapaClient unitId={unit.id} unitName={unit.name} tables={tables} />;
}
```

### mapa-client.tsx

Componente `"use client"` com:

**Toolbar:**
- Filtro por área (Select: Todas, Salão, Varanda, Bar, VIP, Externa)
- Legenda de status (bolinhas coloridas: livre=verde, ocupada=vermelho, reservada=amarelo, bloqueada=cinza)
- Botão "+ Mesa" → modal/form inline (numero, capacidade, área)

**Grid de mesas:**
- CSS grid `repeat(auto-fill, minmax(140px, 1fr))`
- Cada card de mesa:
  - Número da mesa (grande, bold)
  - Ícone de cadeira + capacidade
  - Badge de área
  - Se reservada: nome do cliente + horário (pequeno)
  - Fundo colorido por status: livre=`rgba(21,128,61,0.10)`, ocupada=`rgba(185,28,28,0.10)`, reservada=`rgba(161,98,7,0.10)`, bloqueada=`rgba(100,100,100,0.10)`
  - Borda colorida correspondente
  - Ao clicar: `<select>` inline de status chama `updateTableStatus` via `useTransition`

```tsx
// src/app/(dashboard)/operacao/mapa/mapa-client.tsx
"use client";
import { useState, useTransition } from "react";
import { Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TableWithReserva, RestaurantTable } from "./actions";
import { updateTableStatus, createRestaurantTable } from "./actions";

const AREAS: RestaurantTable["area"][] = ["salao", "varanda", "bar", "vip", "externa"];
const AREA_LABEL: Record<RestaurantTable["area"], string> = {
  salao: "Salão", varanda: "Varanda", bar: "Bar", vip: "VIP", externa: "Externa",
};
const STATUS_STYLE: Record<RestaurantTable["status"], { bg: string; border: string; fg: string; label: string }> = {
  livre:     { bg: "rgba(21,128,61,0.10)",   border: "rgba(21,128,61,0.35)",   fg: "#15803D", label: "Livre" },
  ocupada:   { bg: "rgba(185,28,28,0.10)",   border: "rgba(185,28,28,0.35)",   fg: "#B91C1C", label: "Ocupada" },
  reservada: { bg: "rgba(161,98,7,0.10)",    border: "rgba(161,98,7,0.35)",    fg: "#A16207", label: "Reservada" },
  bloqueada: { bg: "rgba(100,100,100,0.10)", border: "rgba(100,100,100,0.35)", fg: "var(--text-3)", label: "Bloqueada" },
};

export function MapaClient({
  unitId,
  unitName,
  tables,
}: {
  unitId: string;
  unitName: string;
  tables: TableWithReserva[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [areaFilter, setAreaFilter] = useState<RestaurantTable["area"] | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [formNumero, setFormNumero] = useState("");
  const [formCapacidade, setFormCapacidade] = useState("4");
  const [formArea, setFormArea] = useState<RestaurantTable["area"]>("salao");

  const filtered = areaFilter === "all" ? tables : tables.filter((t) => t.area === areaFilter);

  const counts = {
    livre: tables.filter((t) => t.status === "livre").length,
    ocupada: tables.filter((t) => t.status === "ocupada").length,
    reservada: tables.filter((t) => t.status === "reservada").length,
    bloqueada: tables.filter((t) => t.status === "bloqueada").length,
  };

  function handleStatusChange(id: string, status: RestaurantTable["status"]) {
    startTransition(async () => {
      await updateTableStatus(id, status);
      router.refresh();
    });
  }

  async function handleCreateTable() {
    if (!formNumero.trim()) return;
    startTransition(async () => {
      const r = await createRestaurantTable({
        unit_id: unitId,
        numero: formNumero.trim(),
        capacidade: Number(formCapacidade) || 4,
        area: formArea,
      });
      if (!r.ok) { alert(`Erro: ${r.error}`); return; }
      setFormNumero("");
      setFormCapacidade("4");
      setShowForm(false);
      router.refresh();
    });
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
        <Select value={areaFilter} onValueChange={(v) => setAreaFilter((v ?? "all") as typeof areaFilter)}>
          <SelectTrigger style={{ width: 160 }}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as áreas</SelectItem>
            {AREAS.map((a) => <SelectItem key={a} value={a}>{AREA_LABEL[a]}</SelectItem>)}
          </SelectContent>
        </Select>
        <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-3)", flexWrap: "wrap" }}>
          {(Object.entries(counts) as [RestaurantTable["status"], number][]).map(([s, n]) => (
            <span key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: STATUS_STYLE[s].fg, display: "inline-block" }} />
              {STATUS_STYLE[s].label}: <strong style={{ color: "var(--text)" }}>{n}</strong>
            </span>
          ))}
        </div>
        <Button size="sm" variant="outline" style={{ marginLeft: "auto" }} onClick={() => setShowForm(!showForm)}>
          + Mesa
        </Button>
      </div>

      {/* Form nova mesa */}
      {showForm && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 18, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Número</div>
            <Input value={formNumero} onChange={(e) => setFormNumero(e.target.value)} placeholder="ex: 1, A3" style={{ width: 100 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Capacidade</div>
            <Input type="number" value={formCapacidade} onChange={(e) => setFormCapacidade(e.target.value)} style={{ width: 90 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Área</div>
            <Select value={formArea} onValueChange={(v) => setFormArea((v ?? "salao") as RestaurantTable["area"])}>
              <SelectTrigger style={{ width: 140 }}><SelectValue /></SelectTrigger>
              <SelectContent>
                {AREAS.map((a) => <SelectItem key={a} value={a}>{AREA_LABEL[a]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={handleCreateTable} disabled={pending || !formNumero.trim()}>Adicionar</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-3)", fontSize: 13, background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8 }}>
          {tables.length === 0 ? 'Nenhuma mesa cadastrada. Clique em "+ Mesa" para começar.' : "Nenhuma mesa nesta área."}
        </div>
      )}

      {/* Grid de mesas */}
      {filtered.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          {filtered.map((t) => {
            const st = STATUS_STYLE[t.status];
            return (
              <div
                key={t.id}
                style={{
                  background: st.bg,
                  border: `1.5px solid ${st.border}`,
                  borderRadius: 10,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minHeight: 120,
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>{t.numero}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-3)" }}>
                  <Users size={12} /> {t.capacidade} pessoas
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>{AREA_LABEL[t.area]}</div>
                {t.reserva_nome && (
                  <div style={{ fontSize: 11, color: "#A16207", fontWeight: 600 }}>
                    {t.reserva_nome}{t.reserva_horario ? ` · ${t.reserva_horario}` : ""}
                  </div>
                )}
                <div style={{ marginTop: "auto" }}>
                  <Select value={t.status} onValueChange={(v) => handleStatusChange(t.id, (v ?? t.status) as RestaurantTable["status"])}>
                    <SelectTrigger style={{ width: "100%", fontSize: 11, height: 28, color: st.fg, borderColor: st.border }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="livre">Livre</SelectItem>
                      <SelectItem value="ocupada">Ocupada</SelectItem>
                      <SelectItem value="reservada">Reservada</SelectItem>
                      <SelectItem value="bloqueada">Bloqueada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 1:** Criar migration `030_restaurant_tables.sql`
- [ ] **Step 2:** Aplicar no Supabase SQL Editor
- [ ] **Step 3:** Criar `actions.ts`
- [ ] **Step 4:** Reescrever `page.tsx`
- [ ] **Step 5:** Criar `mapa-client.tsx`
- [ ] **Step 6:** TypeScript check
- [ ] **Step 7:** Commit

```bash
git add supabase/migrations/030_restaurant_tables.sql src/app/\(dashboard\)/operacao/mapa/
git commit -m "feat(operacao): implement Mapa da Casa com status de mesas e integração com reservas"
```

---

## Verificação Final — Fase 2

- [ ] `npx tsc --noEmit 2>&1 | grep -v "ponto/debug"` — sem erros
- [ ] Rotas funcionando (sem 404 ou 500):
  - `/compras/analise`
  - `/comercial/reservas`
  - `/compras/cotacoes`
  - `/operacao/auditorias`
  - `/operacao/performance`
  - `/operacao/mapa`
