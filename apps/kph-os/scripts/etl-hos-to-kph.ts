/* eslint-disable no-console */
// ETL: HOS RH (afxsrcezmetipzgosdvb) → KPH OS (iqgrvptrtphvbmvrqntm)
//
// - Read-only no HOS (login Alexandre, anon)
// - Write no KPH autenticado como founder via password (RLS aceita)
// - Idempotente: dedup por CPF (employees), por (employee_id, competencia)
//   pra payslips, por (employee_id, data, tipo) pra absences/warnings.
// - Não migra: schedules (formato pobre) e score_events (gamificação diferente)
//
// Run: `npm run etl:hos`

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Config ─────────────────────────────────────────────────────
const HOS_URL = "https://afxsrcezmetipzgosdvb.supabase.co";
// Anon key extraída do bundle JS público do app HOS — não é segredo.
const HOS_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmeHNyY2V6bWV0aXB6Z29zZHZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjMxNjAsImV4cCI6MjA5MDE5OTE2MH0.HYfbH91E8p_9jYbN5xEl3M5HXttj0E8pbEhHaEIUTrs";
const HOS_EMAIL = "alexandreitner@meeteat.com.br";
const HOS_PASS = "Meet287@";

const KPH_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KPH_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!KPH_URL || !KPH_SERVICE_KEY) {
  console.error(
    "✗ Variáveis ausentes em .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

// ── Tipos do HOS RH (descobertos via REST) ─────────────────────
type HosEmployee = {
  id: string;
  full_name: string | null;
  cpf: string | null;
  rg: string | null;
  rg_uf: string | null;
  rg_orgao: string | null;
  pis: string | null;
  ctps: string | null;
  ctps_serie: string | null;
  ctps_uf: string | null;
  titulo_eleitor: string | null;
  reservista: string | null;
  hire_date: string | null;
  salary: number | null;
  role: string | null;
  department: string | null;
  status: string | null;
  // Endereço FLAT (não é objeto JSON)
  address: string | null;
  numero_endereco: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  cidade: string | null;
  uf_endereco: string | null;
  // Sociodemográfico
  education_level: string | null;
  race: string | null;
  gender: string | null;
  mother_name: string | null;
  father_name: string | null;
};

type HosDependent = {
  id: string;
  employee_id: string;
  name: string;
  cpf: string | null;
  birth_date: string | null;
  relationship: string;
  order_num: number | null;
};

type HosOvertime = {
  id: string;
  employee_id: string;
  date: string;
  hours: number;
  type: string;
  approved: boolean | null;
  source: string | null;
};

type HosPayslip = {
  id: string;
  employee_id: string;
  periodo: string; // "YYYY-MM"
  salary_base: number | null;
  total_vencimentos: number | null;
  total_descontos: number | null;
  valor_liquido: number | null;
  pdf_path: string | null;
};

type HosAbsence = {
  id: string;
  employee_id: string;
  date: string;
  type: string;
  reason: string | null;
  score_impact: number | null;
  atestado_path: string | null;
};

type HosWarning = {
  id: string;
  employee_id: string;
  date: string;
  level: string;
  description: string;
  score_impact: number | null;
  documento_path: string | null;
};

// ── Clientes ───────────────────────────────────────────────────
const hos = createClient(HOS_URL, HOS_ANON);
// service_role bypassa RLS — não há login, não há JWT de user.
const kph = createClient(KPH_URL, KPH_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const counters = {
  employees_inserted: 0,
  employees_updated: 0,
  employees_skipped_no_cpf: 0,
  employees_failed: 0,
  dependents_upserted: 0,
  dependents_skipped: 0,
  overtime_aggregated_employees: 0,
  overtime_total_minutes: 0,
  payslips_upserted: 0,
  payslips_skipped: 0,
  absences_upserted: 0,
  warnings_upserted: 0,
};

const errors: Array<{ kind: string; ref: string; error: string }> = [];

function logErr(kind: string, ref: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  errors.push({ kind, ref, error: msg });
  console.error(`  ✗ ${kind} [${ref}]: ${msg}`);
}

function splitName(full: string | null): { nome: string; sobrenome: string } {
  if (!full) return { nome: "", sobrenome: "" };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 0) return { nome: "", sobrenome: "" };
  if (parts.length === 1) return { nome: parts[0]!, sobrenome: "" };
  return { nome: parts[0]!, sobrenome: parts.slice(1).join(" ") };
}

function nullIfEmpty(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

function clampUf(v: string | null | undefined): string | null {
  const s = nullIfEmpty(v);
  if (!s) return null;
  return s.length === 2 ? s.toUpperCase() : null;
}

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("ETL HOS RH → KPH OS");
  console.log("═══════════════════════════════════════════════\n");

  console.log(`✓ KPH cliente service_role (RLS bypass)`);

  // 2) Login HOS
  const hosAuth = await hos.auth.signInWithPassword({
    email: HOS_EMAIL,
    password: HOS_PASS,
  });
  if (hosAuth.error || !hosAuth.data.user) {
    throw new Error(`Auth HOS falhou: ${hosAuth.error?.message ?? "user nulo"}`);
  }
  console.log(`✓ HOS autenticado como ${hosAuth.data.user.email}`);

  // 3) Resolve unit_id "Meet & Eat" — cria brand+unit se não existirem (idempotente).
  // Schema: units(id, brand_id, name, address, whatsapp_number, active) — sem slug.
  const TARGET_BRAND_NAME = "Meet & Eat";
  const TARGET_BRAND_SLUG = "meet-and-eat";
  const TARGET_UNIT_NAME = "Meet & Eat";

  // 3a) Group KPH
  const { data: kphGroup, error: gErr } = await kph
    .from("groups")
    .select("id, name")
    .eq("slug", "kph")
    .maybeSingle();
  if (gErr) throw new Error(`Falha resolvendo group KPH: ${gErr.message}`);
  if (!kphGroup) throw new Error("Group 'kph' não existe no KPH OS.");
  const kphGroupId = (kphGroup as { id: string }).id;

  // 3b) Brand "Meet & Eat"
  let brandId: string;
  const { data: existingBrand } = await kph
    .from("brands")
    .select("id, name")
    .eq("slug", TARGET_BRAND_SLUG)
    .maybeSingle();
  if (existingBrand) {
    brandId = (existingBrand as { id: string }).id;
    console.log(`✓ Brand existente: ${TARGET_BRAND_NAME} → ${brandId}`);
  } else {
    const { data: newBrand, error: bErr } = await kph
      .from("brands")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        group_id: kphGroupId,
        name: TARGET_BRAND_NAME,
        slug: TARGET_BRAND_SLUG,
        active: true,
      } as any)
      .select("id")
      .single();
    if (bErr || !newBrand) throw new Error(`Falha criando brand: ${bErr?.message ?? "null"}`);
    brandId = (newBrand as { id: string }).id;
    console.log(`✓ Brand criada: ${TARGET_BRAND_NAME} → ${brandId}`);
  }

  // 3c) Unit "Meet & Eat" — dedup por (brand_id, name)
  let unitId: string;
  const { data: existingUnit } = await kph
    .from("units")
    .select("id, name, brand_id")
    .eq("brand_id", brandId)
    .eq("name", TARGET_UNIT_NAME)
    .maybeSingle();
  if (existingUnit) {
    unitId = (existingUnit as { id: string }).id;
    console.log(`✓ Unit existente: ${TARGET_UNIT_NAME} → ${unitId}\n`);
  } else {
    const { data: newUnit, error: uErr } = await kph
      .from("units")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        brand_id: brandId,
        name: TARGET_UNIT_NAME,
        active: true,
      } as any)
      .select("id")
      .single();
    if (uErr || !newUnit) throw new Error(`Falha criando unit: ${uErr?.message ?? "null"}`);
    unitId = (newUnit as { id: string }).id;
    console.log(`✓ Unit criada: ${TARGET_UNIT_NAME} → ${unitId}\n`);
  }

  // 4) ETL EMPLOYEES ─────────────────────────────────────────────
  const { data: hosEmps, error: empErr } = await hos
    .from("employees")
    .select("*")
    .order("full_name");
  if (empErr) throw new Error(`Falha listando employees no HOS: ${empErr.message}`);

  const employees = (hosEmps ?? []) as HosEmployee[];
  console.log(`→ Importando ${employees.length} colaboradores...`);

  // Mapas: HOS id → KPH id (chave principal pra FKs depois)
  //        cpf normalizado → KPH id (debug)
  const hosIdToKphId = new Map<string, string>();
  const cpfToKphId = new Map<string, string>();

  for (let i = 0; i < employees.length; i++) {
    const e = employees[i]!;
    try {
      const cpf = nullIfEmpty(e.cpf);
      if (!cpf) {
        counters.employees_skipped_no_cpf++;
        console.log(`  · ${i + 1}/${employees.length} ${e.full_name ?? "(sem nome)"} — sem CPF, pulado`);
        continue;
      }

      const { nome, sobrenome } = splitName(e.full_name);
      const ativo = e.status === "ativo" || e.status === "afastado";
      const data_admissao =
        nullIfEmpty(e.hire_date) ?? new Date().toISOString().slice(0, 10);

      const payload = {
        unit_id: unitId,
        nome: nome || "(sem nome)",
        sobrenome: sobrenome || "",
        cpf,
        funcao: nullIfEmpty(e.role) ?? nullIfEmpty(e.department) ?? "Não informado",
        salario_base: e.salary ?? 0,
        data_admissao,
        ativo,
        rg: nullIfEmpty(e.rg),
        rg_orgao: nullIfEmpty(e.rg_orgao),
        rg_uf: clampUf(e.rg_uf),
        pis: nullIfEmpty(e.pis),
        ctps: nullIfEmpty(e.ctps),
        ctps_serie: nullIfEmpty(e.ctps_serie),
        ctps_uf: clampUf(e.ctps_uf),
        titulo_eleitor: nullIfEmpty(e.titulo_eleitor),
        reservista: nullIfEmpty(e.reservista),
        rua: nullIfEmpty(e.address),
        numero: nullIfEmpty(e.numero_endereco),
        complemento: nullIfEmpty(e.complemento),
        bairro: nullIfEmpty(e.bairro),
        cidade: nullIfEmpty(e.cidade),
        estado: clampUf(e.uf_endereco),
        cep: nullIfEmpty(e.cep),
        escolaridade: nullIfEmpty(e.education_level),
        raca: nullIfEmpty(e.race),
        genero: nullIfEmpty(e.gender),
        nome_mae: nullIfEmpty(e.mother_name),
        nome_pai: nullIfEmpty(e.father_name),
        departamento: nullIfEmpty(e.department),
      };

      // Dedup manual por CPF (não temos UNIQUE em employees.cpf)
      const { data: existing } = await kph
        .from("employees")
        .select("id")
        .eq("cpf", cpf)
        .maybeSingle();

      if (existing && (existing as { id: string }).id) {
        const id = (existing as { id: string }).id;
        const { error: updErr } = await kph
          .from("employees")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update(payload as any)
          .eq("id", id);
        if (updErr) throw updErr;
        hosIdToKphId.set(e.id, id);
        cpfToKphId.set(cpf, id);
        counters.employees_updated++;
        console.log(`  ↻ ${i + 1}/${employees.length} ${e.full_name} — atualizado`);
      } else {
        const { data: inserted, error: insErr } = await kph
          .from("employees")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(payload as any)
          .select("id")
          .single();
        if (insErr || !inserted) throw insErr ?? new Error("insert null");
        const id = (inserted as { id: string }).id;
        hosIdToKphId.set(e.id, id);
        cpfToKphId.set(cpf, id);
        counters.employees_inserted++;
        console.log(`  ✓ ${i + 1}/${employees.length} ${e.full_name}`);
      }
    } catch (err) {
      counters.employees_failed++;
      logErr("employee", e.full_name ?? e.id, err);
    }
  }

  // 5) ETL DEPENDENTS ────────────────────────────────────────────
  const { data: hosDepsData, error: depsErr } = await hos
    .from("dependents")
    .select("*");
  if (depsErr) console.warn(`[deps] erro listando: ${depsErr.message}`);
  const hosDeps = (hosDepsData ?? []) as HosDependent[];
  console.log(`\n→ Importando ${hosDeps.length} dependentes...`);

  for (const d of hosDeps) {
    const kphEmpId = hosIdToKphId.get(d.employee_id);
    if (!kphEmpId) {
      counters.dependents_skipped++;
      continue;
    }
    try {
      // Dedup manual: (employee_id, nome). dependents pode ter cpf null.
      const { data: existing } = await kph
        .from("dependents")
        .select("id")
        .eq("employee_id", kphEmpId)
        .eq("nome", d.name)
        .maybeSingle();
      if (existing) continue;

      const { error } = await kph.from("dependents").insert({
        employee_id: kphEmpId,
        nome: d.name,
        cpf: nullIfEmpty(d.cpf),
        data_nascimento: nullIfEmpty(d.birth_date),
        parentesco: d.relationship,
        ordem: d.order_num ?? 1,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (error) throw error;
      counters.dependents_upserted++;
    } catch (err) {
      logErr("dependent", `${d.name} → emp:${d.employee_id}`, err);
    }
  }

  // 6) ETL OVERTIME → time_bank_balance (agregado por employee) ──
  const { data: hosOtData, error: otErr } = await hos
    .from("overtime_records")
    .select("*");
  if (otErr) console.warn(`[overtime] erro listando: ${otErr.message}`);
  const hosOt = (hosOtData ?? []) as HosOvertime[];

  // Agrega minutos por employee_id HOS (todos os registros, sem filtrar por approved)
  const minutesByHosEmp = new Map<string, number>();
  let lastDateByHosEmp = new Map<string, string>();
  for (const r of hosOt) {
    const mins = Math.round(Number(r.hours) * 60);
    minutesByHosEmp.set(r.employee_id, (minutesByHosEmp.get(r.employee_id) ?? 0) + mins);
    const prev = lastDateByHosEmp.get(r.employee_id);
    if (!prev || r.date > prev) lastDateByHosEmp.set(r.employee_id, r.date);
  }
  console.log(`\n→ Agregando overtime: ${hosOt.length} registros → ${minutesByHosEmp.size} colaboradores`);

  for (const [hosEmpId, totalMin] of minutesByHosEmp) {
    const kphEmpId = hosIdToKphId.get(hosEmpId);
    if (!kphEmpId) continue;
    try {
      const ultimo = lastDateByHosEmp.get(hosEmpId) ?? null;
      const { error } = await kph.from("time_bank_balance").upsert(
        {
          employee_id: kphEmpId,
          saldo_minutos: totalMin,
          ultimo_calculo: ultimo,
          source: "totvs",
          observacao: `${hosOt.filter((r) => r.employee_id === hosEmpId).length} registros importados Totvs`,
          updated_at: new Date().toISOString(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        { onConflict: "employee_id" },
      );
      if (error) throw error;
      counters.overtime_aggregated_employees++;
      counters.overtime_total_minutes += totalMin;
    } catch (err) {
      logErr("overtime", hosEmpId, err);
    }
  }

  // 7) ETL PAYSLIPS ──────────────────────────────────────────────
  const { data: hosPsData, error: psErr } = await hos
    .from("payslips")
    .select("*");
  if (psErr) console.warn(`[payslips] erro listando: ${psErr.message}`);
  const hosPs = (hosPsData ?? []) as HosPayslip[];
  console.log(`\n→ Importando ${hosPs.length} holerites Totvs (status=pago)...`);

  for (const p of hosPs) {
    const kphEmpId = hosIdToKphId.get(p.employee_id);
    if (!kphEmpId) {
      counters.payslips_skipped++;
      continue;
    }
    try {
      const competencia = `${p.periodo}-01`; // "2026-01" → "2026-01-01"
      const total = Number(p.total_vencimentos ?? 0);
      const desc = Number(p.total_descontos ?? 0);
      const liq = Number(p.valor_liquido ?? 0);

      const { error } = await kph.from("payslips").upsert(
        {
          employee_id: kphEmpId,
          competencia,
          // Totvs traz só agregados — zera breakdown CLT, mantém só valor_liquido autoritativo.
          // outros_acrescimos consolida total_vencimentos; salário_base zerado pra não
          // duplicar (Total proventos exibido = outros_acrescimos).
          salario_base: 0,
          horas_extras: 0,
          adicional_noturno: 0,
          gorjeta: 0,
          dsr_gorjeta: 0,
          desconto_inss: 0,
          desconto_irrf: 0,
          desconto_vale_transporte: 0,
          desconto_vale_refeicao: 0,
          outros_acrescimos: total,
          outros_descontos: desc,
          liquido: liq,
          status: "pago",
          pdf_url: nullIfEmpty(p.pdf_path),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        { onConflict: "employee_id,competencia" },
      );
      if (error) throw error;
      counters.payslips_upserted++;
    } catch (err) {
      logErr("payslip", `${p.employee_id} ${p.periodo}`, err);
    }
  }

  // 8) ETL ABSENCES ──────────────────────────────────────────────
  const { data: hosAbsData, error: absErr } = await hos
    .from("absences")
    .select("*");
  if (absErr) console.warn(`[absences] erro: ${absErr.message}`);
  const hosAbs = (hosAbsData ?? []) as HosAbsence[];
  console.log(`\n→ Importando ${hosAbs.length} faltas...`);

  for (const a of hosAbs) {
    const kphEmpId = hosIdToKphId.get(a.employee_id);
    if (!kphEmpId) continue;
    try {
      // Dedup: (employee_id, data, tipo)
      const { data: existing } = await kph
        .from("absences")
        .select("id")
        .eq("employee_id", kphEmpId)
        .eq("data", a.date)
        .eq("tipo", a.type)
        .maybeSingle();
      if (existing) continue;

      const { error } = await kph.from("absences").insert({
        employee_id: kphEmpId,
        data: a.date,
        tipo: a.type,
        motivo: nullIfEmpty(a.reason),
        score_impact: a.score_impact ?? 0,
        atestado_path: nullIfEmpty(a.atestado_path),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (error) throw error;
      counters.absences_upserted++;
    } catch (err) {
      logErr("absence", `emp:${a.employee_id} ${a.date}`, err);
    }
  }

  // 9) ETL WARNINGS ──────────────────────────────────────────────
  const { data: hosWarnData, error: warnErr } = await hos
    .from("warnings")
    .select("*");
  if (warnErr) console.warn(`[warnings] erro: ${warnErr.message}`);
  const hosWarn = (hosWarnData ?? []) as HosWarning[];
  console.log(`→ Importando ${hosWarn.length} advertências...`);

  for (const w of hosWarn) {
    const kphEmpId = hosIdToKphId.get(w.employee_id);
    if (!kphEmpId) continue;
    try {
      const { data: existing } = await kph
        .from("warnings")
        .select("id")
        .eq("employee_id", kphEmpId)
        .eq("data", w.date)
        .eq("nivel", w.level)
        .maybeSingle();
      if (existing) continue;

      const { error } = await kph.from("warnings").insert({
        employee_id: kphEmpId,
        nivel: w.level,
        descricao: w.description,
        score_impact: w.score_impact ?? 0,
        documento_path: nullIfEmpty(w.documento_path),
        data: w.date,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (error) throw error;
      counters.warnings_upserted++;
    } catch (err) {
      logErr("warning", `emp:${w.employee_id} ${w.date}`, err);
    }
  }

  // ── Resumo ─────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════");
  console.log("ETL CONCLUÍDO");
  console.log("═══════════════════════════════════════════════");
  console.log(`Colaboradores  · novos:      ${counters.employees_inserted}`);
  console.log(`               · atualizados:${counters.employees_updated}`);
  console.log(`               · sem CPF:    ${counters.employees_skipped_no_cpf}`);
  console.log(`               · falharam:   ${counters.employees_failed}`);
  console.log(`Dependentes    · upserted:   ${counters.dependents_upserted}`);
  console.log(`               · pulados:    ${counters.dependents_skipped}`);
  console.log(`Banco horas    · ${counters.overtime_aggregated_employees} colab · ${counters.overtime_total_minutes}min total`);
  console.log(`Holerites      · upserted:   ${counters.payslips_upserted}`);
  console.log(`               · pulados:    ${counters.payslips_skipped}`);
  console.log(`Faltas         · upserted:   ${counters.absences_upserted}`);
  console.log(`Advertências   · upserted:   ${counters.warnings_upserted}`);
  console.log(`Erros totais:                ${errors.length}`);
  console.log("═══════════════════════════════════════════════");

  // Salva log
  const out = {
    timestamp: new Date().toISOString(),
    unit_id: unitId,
    unit_name: TARGET_UNIT_NAME,
    brand_id: brandId,
    counters,
    errors,
    hosIdToKphId: Object.fromEntries(hosIdToKphId),
    cpfToKphId: Object.fromEntries(cpfToKphId),
  };
  const outPath = resolve(process.cwd(), "scripts/etl-output.json");
  writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
  console.log(`\nLog salvo em: ${outPath}`);
}

main().catch((e) => {
  console.error("\n✗ FATAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
