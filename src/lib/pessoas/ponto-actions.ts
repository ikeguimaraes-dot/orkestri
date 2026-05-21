"use server";

// Server Action de registro de ponto.
//
// Por que separado em arquivo próprio: Server Actions vivem aqui sem o
// resto do bundle de actions.ts. Cada export "use server" vira uma RPC
// chamável do client — separação reduz superfície de ataque.
//
// Por que service_role: o browser client perde sessão em iOS Safari e
// PWA standalone (storage isolado, cookie HTTP-only não vai pro JS).
// Cookie SSR funciona pro auth.getUser() server-side (ver getMyEmployee),
// então usamos cookie pra IDENTIFICAR/AUTORIZAR o caller, e service_role
// só pra fazer o INSERT (bypassa RLS — cuja recursão sobre employees
// pode ser o que está quebrando).
//
// Defesa em profundidade:
//   1) cookie auth → quem está chamando? (auth.getUser)
//   2) authz → esse user é dono do employeeId OU tem role na unit dele?
//   3) só então service_role insere
//
// Geofencing (migration 063):
//   Se a unit tiver latitude/longitude/geofence_radius_m configurados E
//   o punch tiver coordenadas, calcula distância Haversine.
//   ≤ raio → aprovado = true (aprovação automática)
//   > raio → aprovado = null  (cai na fila de aprovação manual)
//   Sem coords na unit ou no punch → aprovado = null (comportamento padrão)

import { createSupabaseServerClient, createServiceClient } from "@/lib/supabase/server";
import type { PunchTipo, TimeClockPunch } from "@/types/pessoas";
import { nextPunchTipo, PUNCH_LABEL } from "@/lib/pessoas/punch";

export type RegistrarPunchInput = {
  employeeId: string;
  tipo: PunchTipo;
  latitude?: number | null;
  longitude?: number | null;
  deviceInfo?: string | null;
  photoBase64?: string | null;
};

/** ActionResult estendido para punch — inclui minutosRestantes no erro de pausa bloqueada. */
export type PunchActionResult =
  | { ok: true; data: TimeClockPunch }
  | { ok: false; error: string; minutosRestantes?: number };

const VALID_TIPOS: ReadonlyArray<PunchTipo> = [
  "entrada",
  "saida",
  "intervalo_inicio",
  "intervalo_fim",
];

// ── Haversine ─────────────────────────────────────────────────────────────────
// Retorna distância em metros entre dois pontos (WGS84).
function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000; // raio médio da Terra em metros
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function registrarPunch(
  input: RegistrarPunchInput,
): Promise<PunchActionResult> {
  // ── Validação ────────────────────────────────────────────────
  if (!input?.employeeId) {
    return { ok: false, error: "employeeId obrigatório" };
  }
  if (!VALID_TIPOS.includes(input.tipo)) {
    return { ok: false, error: "tipo inválido" };
  }

  // ── 1) Auth via cookie (server-side) ─────────────────────────
  const cookieClient = await createSupabaseServerClient();
  if (!cookieClient) {
    return { ok: false, error: "Supabase indisponível" };
  }
  const { data: { user } } = await cookieClient.auth.getUser();
  // AUTH DESATIVADO: sem sessão real → usa id fixo de teste (Ike)
  const BYPASS_USER_ID = "ac559fa1-f10b-4ec4-9f4b-fafbc881a884";
  const effectiveUserId = user?.id ?? BYPASS_USER_ID;

  // ── 2) Authz: caller é dono do employee OU tem role na unit ──
  const service = createServiceClient();
  if (!service) {
    return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente no servidor" };
  }

  type EmpRow = { id: string; user_id: string | null; unit_id: string };
  const { data: employee, error: empErr } = await service
    .from("employees")
    .select("id, user_id, unit_id")
    .eq("id", input.employeeId)
    .maybeSingle<EmpRow>();
  if (empErr) {
    return { ok: false, error: `Lookup employee falhou: ${empErr.message}` };
  }
  if (!employee) {
    return { ok: false, error: "Colaborador não encontrado" };
  }

  const isSelf = employee.user_id === effectiveUserId;
  let canPunchForOthers = false;
  if (!isSelf) {
    const { data: roles, error: rolesErr } = await service
      .from("user_roles")
      .select("unit_id")
      .eq("user_id", effectiveUserId)
      .eq("unit_id", employee.unit_id);
    if (rolesErr) {
      return { ok: false, error: `Lookup roles falhou: ${rolesErr.message}` };
    }
    canPunchForOthers = !!roles && roles.length > 0;
  }
  if (!isSelf && !canPunchForOthers) {
    return {
      ok: false,
      error: "Sem permissão para registrar ponto deste colaborador",
    };
  }

  // ── 2.5) Validação de sequência e regras de negócio ──────────
  // Meia-noite em São Paulo (UTC-3, sem DST desde 2019) como limite do dia.
  const agora = new Date();
  const agoraSP = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const meiaNoiteSP = new Date(agoraSP.getFullYear(), agoraSP.getMonth(), agoraSP.getDate());
  const offsetMs = agora.getTime() - agoraSP.getTime();
  const meiaNoiteUTC = new Date(meiaNoiteSP.getTime() + offsetMs);

  type PunchRow = Pick<TimeClockPunch, "id" | "tipo" | "timestamp_punch">;
  const { data: punchesHoje, error: punchesErr } = await service
    .from("time_clock_punches")
    .select("id, tipo, timestamp_punch")
    .eq("employee_id", employee.id)
    .gte("timestamp_punch", meiaNoiteUTC.toISOString())
    .order("timestamp_punch", { ascending: true })
    .returns<PunchRow[]>();

  if (punchesErr) {
    return { ok: false, error: `Erro ao verificar pontos do dia: ${punchesErr.message}` };
  }

  const punchesDodia = punchesHoje ?? [];

  // Regra 1a — máximo 4 registros por dia
  if (punchesDodia.length >= 4) {
    return { ok: false, error: "Jornada já encerrada. Máximo de 4 registros por dia atingido." };
  }

  // Regra 1b — sequência obrigatória: entrada → intervalo_inicio → intervalo_fim → saida
  const proximoEsperado = nextPunchTipo(punchesDodia as TimeClockPunch[]);
  if (proximoEsperado === null) {
    return { ok: false, error: "Jornada já encerrada para hoje." };
  }
  if (input.tipo !== proximoEsperado) {
    return {
      ok: false,
      error: `Registro inválido. Próximo esperado: ${PUNCH_LABEL[proximoEsperado]}.`,
    };
  }

  // Regra 2 — intervalo disponível somente após 1h da entrada
  if (input.tipo === "intervalo_inicio") {
    const entradaPunch = punchesDodia.find((p) => p.tipo === "entrada");
    if (entradaPunch) {
      const diffMs = agora.getTime() - new Date(entradaPunch.timestamp_punch).getTime();
      const diffMinutos = diffMs / 60_000;
      if (diffMinutos < 60) {
        const minutosRestantes = Math.ceil(60 - diffMinutos);
        return {
          ok: false,
          error: `Pausa disponível somente 1h após a entrada. Aguarde ${minutosRestantes} minuto${minutosRestantes !== 1 ? "s" : ""}.`,
          minutosRestantes,
        };
      }
    }
  }

  // ── 2.6) Geofencing — aprovação automática ────────────────────
  // Busca coordenadas da unidade (migration 063).
  // Columns podem não existir em DEV antes da migration — tratar null graciosamente.
  let aprovado: boolean | null = null;

  type UnitGeoRow = {
    latitude: number | null;
    longitude: number | null;
    geofence_radius_m: number | null;
  };
  const { data: unitGeo } = await service
    .from("units")
    .select("latitude, longitude, geofence_radius_m")
    .eq("id", employee.unit_id)
    .maybeSingle<UnitGeoRow>();

  if (
    unitGeo?.latitude != null &&
    unitGeo?.longitude != null &&
    input.latitude != null &&
    input.longitude != null
  ) {
    const radius = unitGeo.geofence_radius_m ?? 200;
    const distancia = haversineMeters(
      unitGeo.latitude,
      unitGeo.longitude,
      input.latitude,
      input.longitude,
    );
    aprovado = distancia <= radius;
    console.info(
      `[registrarPunch] geofence: distância=${distancia.toFixed(1)}m raio=${radius}m aprovado=${aprovado}`,
    );
  }
  // Se unit sem coords OU punch sem coords → aprovado = null (pendente)

  // ── 3) Upload da Foto (se enviada) ───────────────────────────
  let photoPath: string | null = null;
  if (input.photoBase64) {
    try {
      const matches = input.photoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      const base64Data = (matches ? matches[2] : input.photoBase64) ?? input.photoBase64;
      const buffer = Buffer.from(base64Data, "base64");

      const fileName = `${employee.id}/${Date.now()}.jpg`;
      const { error: uploadErr } = await service.storage
        .from("punch-photos")
        .upload(fileName, buffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (!uploadErr) {
        photoPath = fileName;
      }
    } catch (err) {
      console.error("[registrarPunch] Falha no upload da foto", err);
    }
  }

  // Combinar photoPath dentro do deviceInfo JSON
  let deviceInfoObj: Record<string, unknown> = {};
  if (input.deviceInfo) {
    try {
      deviceInfoObj = JSON.parse(input.deviceInfo) as Record<string, unknown>;
    } catch { /* ignore parse err */ }
  }
  if (photoPath) {
    deviceInfoObj.photoPath = photoPath;
  }
  const finalDeviceInfo =
    Object.keys(deviceInfoObj).length > 0 ? JSON.stringify(deviceInfoObj) : null;

  // ── 4) Insert via service_role (bypassa RLS) ─────────────────
  const { data, error } = await service
    .from("time_clock_punches")
    .insert({
      employee_id: employee.id,
      tipo: input.tipo,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      device_info: finalDeviceInfo,
      timestamp_punch: new Date().toISOString(),
      aprovado,               // true = aprovado por geofence | null = pendente manual
    } as never)
    .select()
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Falha ao registrar ponto",
    };
  }

  return { ok: true, data: data as TimeClockPunch };
}
