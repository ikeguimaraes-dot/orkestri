// GET /api/ponto/debug — diagnóstico em produção.
//
// Retorna o estado do server-side: quem o cookie identifica, qual employee
// bate com user_id, roles, e o resultado de um insert real (com rollback
// via service role). O erro do insert é a fonte da verdade — se 42501,
// é RLS; se 23502, é coluna NOT NULL faltando; etc.
//
// Acesso: requer sessão (proxy.ts garante 401 senão). Não expõe segredos.

import { NextResponse } from "next/server";
import { createSupabaseServerClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DebugReport = {
  ts: string;
  auth: {
    user: { id: string; email: string | null } | null;
    error: string | null;
  };
  employee: {
    found: boolean;
    row: unknown | null;
    error: string | null;
  };
  roles: {
    rows: unknown[];
    error: string | null;
  };
  punchesSelectProbe: {
    count: number;
    error: string | null;
  };
  insertProbe: {
    attempted: boolean;
    ok: boolean;
    error: {
      code: string | null;
      message: string;
      details: string | null;
      hint: string | null;
    } | null;
    rolledBack: boolean;
  };
  envCheck: {
    hasUrl: boolean;
    hasAnonKey: boolean;
    hasServiceKey: boolean;
  };
};

export async function GET() {
  const ts = new Date().toISOString();
  const supabase = await createSupabaseServerClient();

  const report: DebugReport = {
    ts,
    auth: { user: null, error: null },
    employee: { found: false, row: null, error: null },
    roles: { rows: [], error: null },
    punchesSelectProbe: { count: 0, error: null },
    insertProbe: { attempted: false, ok: false, error: null, rolledBack: false },
    envCheck: {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  };

  if (!supabase) {
    report.auth.error = "supabase server client null (env ausente)";
    return NextResponse.json(report, { status: 200 });
  }

  // 1) auth.getUser() — server-side
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) {
    report.auth.error = userErr.message;
    return NextResponse.json(report, { status: 200 });
  }
  if (!userRes.user) {
    report.auth.error = "no user (cookie sem sessão server-side)";
    return NextResponse.json(report, { status: 200 });
  }
  report.auth.user = {
    id: userRes.user.id,
    email: userRes.user.email ?? null,
  };
  const uid = userRes.user.id;

  // 2) Employee match (com RLS — falha aqui = bug RLS de employees)
  {
    const { data, error } = await supabase
      .from("employees")
      .select("id, nome, sobrenome, user_id, unit_id, ativo")
      .eq("user_id", uid)
      .maybeSingle();
    report.employee.found = !!data;
    report.employee.row = data ?? null;
    report.employee.error = error?.message ?? null;
  }

  // 3) user_roles do user — caminho alternativo de RLS
  {
    const { data, error } = await supabase
      .from("user_roles")
      .select("unit_id, brand_id, group_id, role_id")
      .eq("user_id", uid);
    report.roles.rows = data ?? [];
    report.roles.error = error?.message ?? null;
  }

  // 4) SELECT em punches do próprio employee — testa migration 008 self-select
  if (report.employee.row) {
    const empId = (report.employee.row as { id: string }).id;
    const { data, error } = await supabase
      .from("time_clock_punches")
      .select("id", { count: "exact", head: false })
      .eq("employee_id", empId)
      .limit(1);
    report.punchesSelectProbe.count = data?.length ?? 0;
    report.punchesSelectProbe.error = error?.message ?? null;
  }

  // 5) Insert probe — tenta um insert real e captura o erro EXATO.
  //    Se passar, deleta na hora (com service role) pra não poluir.
  if (report.employee.row) {
    const empId = (report.employee.row as { id: string }).id;
    report.insertProbe.attempted = true;

    const probe = {
      employee_id: empId,
      tipo: "entrada",
      timestamp_punch: new Date().toISOString(),
      device_info: JSON.stringify({ debug: true, source: "/api/ponto/debug" }),
    };

    const { data, error } = await supabase
      .from("time_clock_punches")
      .insert(probe as never)
      .select("id")
      .single();

    if (error) {
      report.insertProbe.ok = false;
      report.insertProbe.error = {
        code: error.code ?? null,
        message: error.message,
        details: error.details ?? null,
        hint: error.hint ?? null,
      };
    } else {
      report.insertProbe.ok = true;
      const service = createServiceClient();
      if (service && data) {
        await service
          .from("time_clock_punches")
          .delete()
          .eq("id", (data as { id: string }).id);
        report.insertProbe.rolledBack = true;
      }
    }
  }

  return NextResponse.json(report, { status: 200 });
}
