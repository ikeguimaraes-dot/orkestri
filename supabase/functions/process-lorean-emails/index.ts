import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Client created per-call inside parsePdfWithClaude to avoid shared state with npm: shim

// ── Gmail OAuth ─────────────────────────────────────────────────────────────

async function refreshGmailToken(): Promise<string> {
  console.log("[lorean] Refreshing Gmail token...");
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GMAIL_CLIENT_ID")!,
      client_secret: Deno.env.get("GMAIL_CLIENT_SECRET")!,
      refresh_token: Deno.env.get("GMAIL_REFRESH_TOKEN")!,
      grant_type: "refresh_token",
    }),
  });
  const data = await resp.json();
  if (!data.access_token) {
    throw new Error(`Gmail token refresh failed: ${JSON.stringify(data)}`);
  }
  console.log("[lorean] Gmail token OK");
  return data.access_token;
}

// ── Gmail message fetch ─────────────────────────────────────────────────────

async function fetchLoreanEmailIds(accessToken: string): Promise<string[]> {
  // 7 days back for initial testing; production will catch yesterday's emails
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const y = since.getFullYear();
  const m = String(since.getMonth() + 1).padStart(2, "0");
  const d = String(since.getDate()).padStart(2, "0");
  const dateStr = `${y}/${m}/${d}`;

  const query = `from:lorean has:attachment filename:pdf after:${dateStr}`;
  console.log("[lorean] Gmail query:", query);

  const resp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = await resp.json();

  if (data.error) {
    throw new Error(`Gmail messages.list error: ${JSON.stringify(data.error)}`);
  }

  const ids = (data.messages ?? []).map((m: { id: string }) => m.id);
  console.log(`[lorean] Gmail returned ${ids.length} message(s):`, ids);
  return ids;
}

interface Attachment {
  filename: string;
  attachmentId: string;
  mimeType: string;
}

async function getEmailAttachments(
  accessToken: string,
  messageId: string,
): Promise<Attachment[]> {
  const resp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const msg = await resp.json();

  if (msg.error) {
    throw new Error(`Gmail messages.get error for ${messageId}: ${JSON.stringify(msg.error)}`);
  }

  const attachments: Attachment[] = [];

  function walk(parts: any[]) {
    for (const part of parts ?? []) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          attachmentId: part.body.attachmentId,
          mimeType: part.mimeType ?? "",
        });
      }
      if (part.parts) walk(part.parts);
    }
  }
  walk(msg.payload?.parts ?? []);

  // Log ALL attachments found regardless of type
  if (attachments.length === 0) {
    console.log(`[lorean] email ${messageId}: no attachments with attachmentId found`);
    // Log raw payload structure for debugging
    console.log(`[lorean] email ${messageId} payload keys:`, Object.keys(msg.payload ?? {}));
    const topParts = (msg.payload?.parts ?? []).map((p: any) => ({
      filename: p.filename,
      mimeType: p.mimeType,
      hasAttachmentId: !!p.body?.attachmentId,
    }));
    console.log(`[lorean] email ${messageId} top-level parts:`, JSON.stringify(topParts));
  } else {
    console.log(
      `[lorean] email ${messageId}: ${attachments.length} attachment(s):`,
      attachments.map((a) => `${a.filename} (${a.mimeType})`),
    );
  }

  return attachments;
}

async function getAttachmentBase64(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<string> {
  const resp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = await resp.json();
  if (data.error) {
    throw new Error(`Gmail attachments.get error: ${JSON.stringify(data.error)}`);
  }
  // Gmail uses URL-safe base64 — convert to standard base64
  return (data.data as string).replace(/-/g, "+").replace(/_/g, "/");
}

// ── Claude PDF parsing ──────────────────────────────────────────────────────

const WORKDAY_PROMPT = `Extraia os dados deste relatório Lorean Workday e retorne APENAS JSON válido, sem texto adicional, sem markdown.

Formato esperado:
{
  "workday_id": number,
  "data": "YYYY-MM-DD",
  "abertura_at": "YYYY-MM-DD HH:MM:SS",
  "fechamento_at": "YYYY-MM-DD HH:MM:SS",
  "receita_bruta": number,
  "desconto": number,
  "gorjeta": number,
  "receita_liquida": number,
  "custo": number,
  "cmv_pct": number,
  "lucro": number,
  "clientes": number,
  "ticket_medio": number,
  "ticket_real": number,
  "permanencia_media": "HH:MM:SS",
  "previsto": number,
  "devedor": number,
  "pagamentos": [
    { "forma": string, "valor_fechado": number, "valor_recebido": number, "diferenca": number }
  ],
  "ambientes": [
    { "ambiente": string, "clientes": number, "gorjeta": number, "produto": number, "consumo": number }
  ],
  "turnos": [
    { "turno": string, "clientes": number, "gorjeta": number, "produto": number, "consumo": number }
  ],
  "grupos": [
    { "grupo": string, "pct_bruto": number, "bruto": number, "desconto": number, "gorjeta": number, "consumo": number }
  ],
  "descontos": [
    { "motivo": string, "qtd": number, "consumo": number }
  ],
  "descontos_detalhe": [
    { "item": string, "usuario": string, "motivo": string, "qtd": number, "valor": number }
  ],
  "cancelamentos_detalhe": [
    { "item": string, "usuario": string, "motivo": string, "qtd": number, "valor": number }
  ]
}

Regras:
- IMPORTANTE: As datas estão no formato DD.MM.YY (dia.mês.ano brasileiro). Ex: 02.06.26 = 2 de junho de 2026 = 2026-06-02. Converter para ISO 8601: YYYY-MM-DD.
- IMPORTANTE: O horário de abertura e fechamento aparecem no formato "DIA, DD MES AAAA HH:MM" (ex: "SÁB, 09 MAI 2026 18:15"). Converta para ISO 8601: "YYYY-MM-DD HH:MM:00". Ex: "SÁB, 09 MAI 2026 18:15" → "2026-05-09 18:15:00". Meses em português: JAN=01, FEV=02, MAR=03, ABR=04, MAI=05, JUN=06, JUL=07, AGO=08, SET=09, OUT=10, NOV=11, DEZ=12.
- cmv_pct: valor decimal (ex: 0.27 para 27%)
- pct_bruto: valor decimal (ex: 0.17 para 17%)
- permanencia_media: formato "HH:MM:SS"
- Campos não encontrados no PDF: usar null
- Arrays vazios se a seção não existir: []
- descontos_detalhe: extrair da seção detalhada de Desconto que lista cada produto descontado com Usuário, Motivo, Qtde e Consumo (ignorar as linhas de cabeçalho de comanda como '115 - LOREAN DESK'). valor = coluna Consumo.
- cancelamentos_detalhe: extrair da seção detalhada de Cancelado que lista cada produto cancelado com Usuário, Motivo, Qtde e Consumo (ignorar linhas de cabeçalho de comanda como '103 - LOREAN DESK'). valor = coluna Consumo.`;

const CAIXA_PROMPT = `Extraia os dados deste relatório de fechamento de caixa Lorean e retorne APENAS JSON válido, sem texto adicional, sem markdown.

Formato esperado:
{
  "caixa_id": number,
  "operador": string,
  "data": "YYYY-MM-DD",
  "abertura_at": "YYYY-MM-DD HH:MM:SS",
  "fechamento_at": "YYYY-MM-DD HH:MM:SS",
  "total_fechado": number,
  "total_recebido": number,
  "diferenca": number,
  "pagamentos": [
    { "forma": string, "valor_fechado": number, "valor_recebido": number, "diferenca": number }
  ]
}

Regras:
- IMPORTANTE: As datas estão no formato DD.MM.YY (dia.mês.ano brasileiro). Ex: 02.06.26 = 2 de junho de 2026 = 2026-06-02. Converter para ISO 8601: YYYY-MM-DD.
- Campos não encontrados: usar null
- pagamentos: array vazio [] se não houver`;

const VENDA_PROMPT_1 = `Extraia os dados deste relatório Lorean de Venda e retorne APENAS JSON válido, sem texto adicional, sem markdown.

Extraia SOMENTE estes 2 arrays: grupos de produto e cancelamentos.

Formato esperado:
{
  "grupos": [
    { "grupo": string, "pct_bruto": number, "bruto": number, "desconto": number, "gorjeta": number, "consumo": number }
  ],
  "cancelamentos": [
    { "motivo": string, "qtd": number, "consumo": number }
  ]
}

Regras:
- pct_bruto: valor decimal (ex: 0.17 para 17%)
- Arrays vazios se a seção não existir no PDF: []`;

const VENDA_PROMPT_3 = `Extraia TODOS os produtos vendidos de TODAS as seções de grupo deste relatório Lorean de Venda e retorne APENAS JSON válido, sem texto adicional, sem markdown.

Cada seção tem um título de grupo (ex: Soft Drinks, Vinho Tinto, Da Brasa) e linhas de produtos com colunas Qtde, Garrafa, CMV, Bruto, Desconto, Gorjeta, Total.

Formato esperado:
{
  "produtos": [
    { "grupo": string, "produto": string, "qtd": number, "cmv_pct": number, "bruto": number, "desconto": number, "gorjeta": number, "total": number }
  ]
}

Regras:
- cmv_pct: valor decimal (ex: 0.27 para 27%)
- Ignorar linhas de subtotal das seções
- Array vazio [] se não houver produtos`;

const VENDA_PROMPT_2 = `Extraia os dados deste relatório Lorean de Venda e retorne APENAS JSON válido, sem texto adicional, sem markdown.

Extraia SOMENTE estes 2 arrays: vendas por horário e vendas por garçom/usuário.

Formato esperado:
{
  "horarios": [
    { "hora": number, "clientes": number, "gorjeta": number, "produto": number, "consumo": number }
  ],
  "usuarios": [
    { "usuario": string, "qtd": number, "gorjeta": number, "produto": number, "consumo": number }
  ]
}

Regras:
- horarios.hora: número inteiro da hora (12, 13, 14 ... 23)
- Arrays vazios se a seção não existir no PDF: []`;

async function parsePdfWithClaude(
  pdfBase64: string,
  prompt: string,
  filename: string,
  label: string,
) {
  // Create client per-call — avoids shared state issues with npm: shim in Deno
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY secret not set");

  const client = new Anthropic({ apiKey });
  console.log(`[lorean] Calling Claude for ${filename} (label: ${label}, apiKey prefix: ${apiKey.slice(0, 10)}...)`);

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
          } as any,
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  // Log full response structure to diagnose unexpected formats
  console.log(`[lorean] Response for ${filename} [${label}]: stop_reason=${response.stop_reason} content_blocks=${response.content.length}`);
  for (const [i, block] of response.content.entries()) {
    console.log(`[lorean]   block[${i}]: type=${block.type} text_len=${block.type === "text" ? block.text.length : "N/A"}`);
  }

  // Find the first text block — don't assume it's index 0
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`No text block in Claude response for ${filename} [${label}]. stop_reason=${response.stop_reason}`);
  }

  const raw = textBlock.text;
  console.log(`[lorean] Raw text for ${filename} [${label}] (first 2000 chars): ${raw.slice(0, 2000)}`);

  // Guard: catch the case where Claude output is not JSON at all
  const clean = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  if (!clean.startsWith("{")) {
    throw new Error(`Claude response is not JSON for ${filename} [${label}]. Starts with: "${clean.slice(0, 80)}"`);
  }

  const parsed = JSON.parse(clean);
  console.log(`[lorean] Parsed OK for ${filename} [${label}]: keys=${Object.keys(parsed).join(",")}`);
  return parsed;
}

// ── Database insertion ──────────────────────────────────────────────────────

function classifyTurno(aberturaAt: string | null | undefined): "almoco" | "jantar" | "dia_inteiro" {
  if (!aberturaAt) return "dia_inteiro";
  const hora = new Date(aberturaAt).getHours();
  return hora >= 10 && hora < 17 ? "almoco" : "jantar";
}

const MONTHS_PT: Record<string, string> = {
  JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06",
  JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12",
};

function extractTimestamps(pdfText: string): { abertura_at: string | null; fechamento_at: string | null } {
  const re = /[A-ZÁÉÍÓÚÃÕÊ]{3},\s+(\d{2})\s+([A-Z]{3})\s+(\d{4})\s+(\d{2}:\d{2})/g;
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(pdfText)) !== null && matches.length < 2) {
    const mm = MONTHS_PT[m[2]!];
    if (mm) matches.push(`${m[3]}-${mm}-${m[1]} ${m[4]}:00`);
  }
  return { abertura_at: matches[0] ?? null, fechamento_at: matches[1] ?? null };
}

async function insertWorkday(
  parsed: any,
  unitId: string,
  emailId: string,
  filename: string,
) {
  console.log(`[lorean] insertWorkday: data=${parsed.data} workday_id=${parsed.workday_id} unit=${unitId}`);

  const { data: wd, error: wdErr } = await supabase
    .from("lorean_workdays")
    .upsert(
      {
        unit_id: unitId,
        data: parsed.data,
        workday_id: parsed.workday_id,
        turno: "dia_inteiro",  // placeholder — reclassificado abaixo
        abertura_at: parsed.abertura_at,
        fechamento_at: parsed.fechamento_at,
        receita_bruta: parsed.receita_bruta,
        desconto: parsed.desconto,
        gorjeta: parsed.gorjeta,
        receita_liquida: parsed.receita_liquida,
        custo: parsed.custo,
        cmv_pct: parsed.cmv_pct,
        lucro: parsed.lucro,
        clientes: parsed.clientes,
        ticket_medio: parsed.ticket_medio,
        ticket_real: parsed.ticket_real,
        permanencia_media: parsed.permanencia_media,
        previsto: parsed.previsto,
        devedor: parsed.devedor,
      },
      { onConflict: "unit_id,workday_id" },
    )
    .select()
    .single();

  if (wdErr) throw new Error(`lorean_workdays upsert: ${wdErr.message}`);
  console.log(`[lorean] lorean_workdays upserted: id=${wd.id}`);

  // Reclassifica todos os workdays do dia por ordem de workday_id
  const { data: siblings } = await supabase
    .from("lorean_workdays")
    .select("id, workday_id")
    .eq("unit_id", unitId)
    .eq("data", parsed.data)
    .order("workday_id", { ascending: true });

  const turnosNomes: string[] = (parsed.turnos ?? []).map((t: any) => (t.turno ?? "").toLowerCase());
  const temTarde = turnosNomes.some((t: string) => t.includes("tarde"));
  const temNoite = turnosNomes.some((t: string) => t.includes("noite"));

  let turnoClassificado: "almoco" | "jantar" | "dia_inteiro";
  if (temTarde && temNoite) {
    turnoClassificado = "dia_inteiro";
  } else if (temTarde) {
    turnoClassificado = "almoco";
  } else if (temNoite) {
    turnoClassificado = "jantar";
  } else {
    if (siblings?.length === 1) {
      turnoClassificado = "dia_inteiro";
      console.log(`[lorean] turno fallback: dia_inteiro (único workday do dia)`);
    } else if (siblings && siblings.length >= 2) {
      await supabase.from("lorean_workdays").update({ turno: "almoco" }).eq("id", siblings[0].id);
      await supabase.from("lorean_workdays").update({ turno: "jantar" }).eq("id", siblings[1].id);
      console.log(`[lorean] turno fallback siblings: ${siblings[0].workday_id}→almoco, ${siblings[1].workday_id}→jantar`);
      turnoClassificado = wd.workday_id === siblings[0].workday_id ? "almoco" : "jantar";
    } else {
      turnoClassificado = "dia_inteiro";
    }
  }

  await supabase.from("lorean_workdays").update({ turno: turnoClassificado }).eq("id", wd.id);
  console.log(`[lorean] turno: ${turnoClassificado} (PDF turnos: [${turnosNomes.join(", ")}])`);

  await Promise.all([
    supabase.from("lorean_pagamentos").delete().eq("workday_id_fk", wd.id),
    supabase.from("lorean_ambientes").delete().eq("workday_id_fk", wd.id),
    supabase.from("lorean_turnos").delete().eq("workday_id_fk", wd.id),
    supabase.from("lorean_grupos").delete().eq("workday_id_fk", wd.id),
    supabase.from("lorean_descontos").delete().eq("workday_id_fk", wd.id),
    supabase.from("lorean_descontos_detalhe").delete().eq("workday_id_fk", wd.id),
    supabase.from("lorean_cancelamentos_detalhe").delete().eq("workday_id_fk", wd.id),
  ]);

  const inserts: Promise<any>[] = [];
  if (parsed.pagamentos?.length) {
    inserts.push(supabase.from("lorean_pagamentos").insert(
      parsed.pagamentos.map((p: any) => ({ ...p, workday_id_fk: wd.id })),
    ));
  }
  if (parsed.ambientes?.length) {
    inserts.push(supabase.from("lorean_ambientes").insert(
      parsed.ambientes.map((a: any) => ({ ...a, workday_id_fk: wd.id })),
    ));
  }
  if (parsed.turnos?.length) {
    inserts.push(supabase.from("lorean_turnos").insert(
      parsed.turnos.map((t: any) => ({ ...t, workday_id_fk: wd.id })),
    ));
  }
  if (parsed.grupos?.length) {
    inserts.push(supabase.from("lorean_grupos").insert(
      parsed.grupos.map((g: any) => ({ ...g, workday_id_fk: wd.id })),
    ));
  }
  if (parsed.descontos?.length) {
    inserts.push(supabase.from("lorean_descontos").insert(
      parsed.descontos.map((d: any) => ({ ...d, workday_id_fk: wd.id })),
    ));
  }
  if (parsed.descontos_detalhe?.length) {
    inserts.push(supabase.from("lorean_descontos_detalhe").insert(
      parsed.descontos_detalhe.map((d: any) => ({ ...d, workday_id_fk: wd.id })),
    ));
  }
  if (parsed.cancelamentos_detalhe?.length) {
    inserts.push(supabase.from("lorean_cancelamentos_detalhe").insert(
      parsed.cancelamentos_detalhe.map((d: any) => ({ ...d, workday_id_fk: wd.id })),
    ));
  }
  await Promise.all(inserts);

  console.log(`[lorean] Child tables inserted for workday ${wd.id}: pagamentos=${parsed.pagamentos?.length ?? 0} ambientes=${parsed.ambientes?.length ?? 0} turnos=${parsed.turnos?.length ?? 0} grupos=${parsed.grupos?.length ?? 0} descontos=${parsed.descontos?.length ?? 0} descontos_detalhe=${parsed.descontos_detalhe?.length ?? 0}`);

  await supabase.from("lorean_import_log").insert({
    email_id: emailId,
    filename,
    tipo: "workday",
    data_referente: parsed.data,
    status: "success",
  });
}

async function insertCaixa(
  parsed: any,
  unitId: string,
  emailId: string,
  filename: string,
) {
  console.log(`[lorean] insertCaixa: caixa_id=${parsed.caixa_id} operador=${parsed.operador} data=${parsed.data}`);

  const { data: wd } = await supabase
    .from("lorean_workdays")
    .select("id")
    .eq("unit_id", unitId)
    .eq("data", parsed.data)
    .maybeSingle();

  if (!wd) {
    console.log(`[lorean] No workday found for unit=${unitId} data=${parsed.data} — inserting caixa unlinked`);
  }

  const { error: caixaErr } = await supabase.from("lorean_caixas").insert({
    workday_id_fk: wd?.id ?? null,
    caixa_id: parsed.caixa_id,
    operador: parsed.operador,
    abertura_at: parsed.abertura_at,
    fechamento_at: parsed.fechamento_at,
    total_fechado: parsed.total_fechado,
    total_recebido: parsed.total_recebido,
    diferenca: parsed.diferenca,
  });

  if (caixaErr) throw new Error(`lorean_caixas insert: ${caixaErr.message}`);
  console.log(`[lorean] lorean_caixas inserted for operador=${parsed.operador}`);

  await supabase.from("lorean_import_log").insert({
    email_id: emailId,
    filename,
    tipo: "caixa",
    data_referente: parsed.data,
    status: "success",
    erro: wd ? null : "workday não encontrado — caixa inserido sem vínculo",
  });
}

async function insertVenda(
  parsed: any,
  unitId: string,
  emailId: string,
  filename: string,
) {
  // Extract lorean workday_id from filename: "Venda (1913 [04.06.26])" → 1913
  const wdMatch = filename.match(/\((\d+)/);
  const loreanWorkdayId = wdMatch ? parseInt(wdMatch[1], 10) : null;
  console.log(`[lorean] insertVenda: lorean workday_id=${loreanWorkdayId} unit=${unitId}`);

  if (!loreanWorkdayId) {
    throw new Error(`Cannot extract workday_id from Venda filename: "${filename}"`);
  }

  // Look up workday already created by Movimento — do NOT upsert lorean_workdays
  const { data: wd } = await supabase
    .from("lorean_workdays")
    .select("id, data")
    .eq("unit_id", unitId)
    .eq("workday_id", loreanWorkdayId)
    .maybeSingle();

  if (!wd) {
    throw new Error(`Workday not found for unit=${unitId} workday_id=${loreanWorkdayId} — process Movimento first`);
  }

  console.log(`[lorean] Found workday: id=${wd.id} data=${wd.data}`);

  // Idempotent: clear Venda-specific child tables before re-inserting
  await Promise.all([
    supabase.from("lorean_grupos").delete().eq("workday_id_fk", wd.id),
    supabase.from("lorean_cancelamentos").delete().eq("workday_id_fk", wd.id),
    supabase.from("lorean_horarios").delete().eq("workday_id_fk", wd.id),
    supabase.from("lorean_usuarios").delete().eq("workday_id_fk", wd.id),
    supabase.from("lorean_produtos_dia").delete().eq("workday_id_fk", wd.id),
  ]);

  console.log("[venda] grupos:", parsed.grupos?.length ?? 0);
  console.log("[venda] cancelamentos:", parsed.cancelamentos?.length ?? 0);
  console.log("[venda] horarios:", parsed.horarios?.length ?? 0);
  console.log("[venda] usuarios:", parsed.usuarios?.length ?? 0);
  console.log("[venda] produtos:", parsed.produtos?.length ?? 0);
  console.log("[venda] JSON keys from Claude:", Object.keys(parsed).join(", "));

  const inserts: Promise<any>[] = [];
  if (parsed.grupos?.length)        inserts.push(supabase.from("lorean_grupos").insert(parsed.grupos.map((r: any) => ({ ...r, workday_id_fk: wd.id }))));
  if (parsed.cancelamentos?.length) inserts.push(supabase.from("lorean_cancelamentos").insert(parsed.cancelamentos.map((r: any) => ({ ...r, workday_id_fk: wd.id }))));
  if (parsed.horarios?.length)      inserts.push(supabase.from("lorean_horarios").insert(parsed.horarios.map((r: any) => ({ ...r, workday_id_fk: wd.id }))));
  if (parsed.usuarios?.length)      inserts.push(supabase.from("lorean_usuarios").insert(parsed.usuarios.map((r: any) => ({ ...r, workday_id_fk: wd.id }))));
  if (parsed.produtos?.length)      inserts.push(supabase.from("lorean_produtos_dia").insert(parsed.produtos.map((r: any) => ({ ...r, workday_id_fk: wd.id }))));

  await Promise.all(inserts);
  console.log("[venda] inserts dispatched");

  await supabase.from("lorean_import_log").insert({
    email_id: emailId,
    filename,
    tipo: "venda",
    data_referente: wd.data,
    status: "success",
  });
}

async function logError(emailId: string, filename: string, err: unknown) {
  const tipo = filename.includes("Movimento") ? "workday" : filename.includes("Caixa") ? "caixa" : "venda";
  const errMsg = String(err);
  console.error(`[lorean] ERROR processing ${filename}:`, errMsg);
  await supabase.from("lorean_import_log").insert({
    email_id: emailId,
    filename,
    tipo,
    status: "error",
    erro: errMsg,
  });
}

// ── Date extraction from filename ───────────────────────────────────────────

// Extracts date from "LOREAN [2031] - Movimento (1908 [01.06.26]).pdf"
// Pattern [DD.MM.YY] → "20YY-MM-DD"
function extractDateFromFilename(filename: string): string | null {
  const m = filename.match(/\[(\d{2})\.(\d{2})\.(\d{2})\]/);
  if (!m) return null;
  const [, dd, mm, yy] = m;
  return `20${yy}-${mm}-${dd}`;
}

// ── Attachment processing ────────────────────────────────────────────────────

async function processAttachment(
  accessToken: string,
  emailId: string,
  attachment: Attachment,
): Promise<void> {
  const { filename, attachmentId } = attachment;
  console.log(`[lorean] Processing attachment: ${filename}`);

  // Accepts both "LOREAN [2031]" and "LOREAN__2031__" formats
  const unitMatch = filename.match(/LOREAN\s*[\[\(]?(\d+)[\]\)]?/i);
  const loreanUnitId = unitMatch?.[1];
  const unitMap: Record<string, string> = JSON.parse(
    Deno.env.get("LOREAN_UNIT_MAP") ?? "{}",
  );
  const supabaseUnitId = loreanUnitId ? unitMap[loreanUnitId] : undefined;
  console.log(`[lorean] Unit: lorean=${loreanUnitId} → supabase=${supabaseUnitId ?? "NOT FOUND"}`);

  if (!supabaseUnitId) {
    throw new Error(`Unidade Lorean desconhecida: ${loreanUnitId ?? "?"} em "${filename}". LOREAN_UNIT_MAP=${Deno.env.get("LOREAN_UNIT_MAP")}`);
  }

  // Detect PDF type — skip "Venda" (not yet handled)
  const tipo: "workday" | "caixa" | "venda" = filename.includes("Movimento")
    ? "workday"
    : filename.includes("Caixa")
    ? "caixa"
    : "venda";

  console.log(`[lorean] Downloading PDF attachment ${attachmentId}...`);
  const pdfBase64 = await getAttachmentBase64(accessToken, emailId, attachmentId);
  console.log(`[lorean] PDF downloaded, base64 length=${pdfBase64.length}`);

  if (tipo === "venda") {
    console.log("[venda] starting 3-part extraction");
    const [part1, part2, part3] = await Promise.all([
      parsePdfWithClaude(pdfBase64, VENDA_PROMPT_1, filename, "venda-part1"),
      parsePdfWithClaude(pdfBase64, VENDA_PROMPT_2, filename, "venda-part2"),
      parsePdfWithClaude(pdfBase64, VENDA_PROMPT_3, filename, "venda-part3"),
    ]);
    const result = { ...part1, ...part2, ...part3 };
    console.log("[venda] merged grupos:", result.grupos?.length ?? 0);
    console.log("[venda] merged horarios:", result.horarios?.length ?? 0);
    console.log("[venda] merged usuarios:", result.usuarios?.length ?? 0);
    console.log("[venda] merged produtos:", result.produtos?.length ?? 0);
    console.log("[venda] merged keys:", Object.keys(result).join(", "));
    await insertVenda(result, supabaseUnitId, emailId, filename);
  } else {
    const parsed = await parsePdfWithClaude(
      pdfBase64,
      tipo === "workday" ? WORKDAY_PROMPT : CAIXA_PROMPT,
      filename,
      tipo,
    );

    // Override Claude's date with the filename date — filename is authoritative (DD.MM.YY format)
    const filenameDate = extractDateFromFilename(filename);
    if (filenameDate) {
      console.log(`[lorean] Date override: Claude said "${parsed.data}", filename says "${filenameDate}" — using filename`);
      parsed.data = filenameDate;
    } else {
      console.log(`[lorean] No date in filename, using Claude's date: "${parsed.data}"`);
    }

    if (tipo === "workday") {
      // Extract abertura_at / fechamento_at via regex — more reliable than Claude for this field
      const pdfBytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
      const pdfText = new TextDecoder("latin1").decode(pdfBytes);
      const { abertura_at, fechamento_at } = extractTimestamps(pdfText);
      if (abertura_at !== null) { parsed.abertura_at = abertura_at; }
      if (fechamento_at !== null) { parsed.fechamento_at = fechamento_at; }
      console.log(`[lorean] timestamps from regex: abertura=${abertura_at} fechamento=${fechamento_at}`);
      await insertWorkday(parsed, supabaseUnitId, emailId, filename);
    } else {
      await insertCaixa(parsed, supabaseUnitId, emailId, filename);
    }
  }
  console.log(`[lorean] Done: ${filename}`);
}

// ── Entry point ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const limit = Math.max(1, parseInt(url.searchParams.get("limit") ?? "1", 10));
  console.log(`[lorean] process-lorean-emails started (limit=${limit})`);

  try {
    const accessToken = await refreshGmailToken();

    // Load processed IDs for the last 10 days (wider than 7-day search window)
    const since = new Date();
    since.setDate(since.getDate() - 10);
    const { data: logRows } = await supabase
      .from("lorean_import_log")
      .select("email_id")
      .eq("status", "success")
      .gte("processado_em", since.toISOString());
    const processedIds = new Set((logRows ?? []).map((r: any) => r.email_id));
    console.log(`[lorean] Already-processed email IDs in window: ${processedIds.size}`);

    const allEmailIds = await fetchLoreanEmailIds(accessToken);
    // Apply limit: only process N unprocessed emails per run to avoid timeout
    const unprocessedIds = allEmailIds.filter((id) => !processedIds.has(id));
    const emailIds = unprocessedIds.slice(0, limit);
    console.log(`[lorean] ${allEmailIds.length} total, ${unprocessedIds.length} unprocessed, processing ${emailIds.length} (limit=${limit})`);

    const results = {
      total_emails: allEmailIds.length,
      unprocessed: unprocessedIds.length,
      processing: emailIds.length,
      processed: 0,
      skipped: 0,
      errors: 0,
      detail: [] as any[],
    };

    for (const emailId of emailIds) {
      let attachments: Attachment[];
      try {
        attachments = await getEmailAttachments(accessToken, emailId);
      } catch (err) {
        console.error(`[lorean] Failed to fetch attachments for ${emailId}:`, err);
        results.errors++;
        results.detail.push({ emailId, status: "error", error: String(err) });
        continue;
      }

      // Filter: PDF attachments with "lorean" in name
      // Sort: Movimento (workday) always before Caixa so workday exists when caixa is inserted
      const pdfAttachments = attachments
        .filter((a) => /lorean/i.test(a.filename) && /\.pdf$/i.test(a.filename))
        .sort((a, b) => {
          const rank = (f: string) => (f.includes("Movimento") ? 0 : f.includes("Venda") ? 1 : f.includes("Caixa") ? 2 : 3);
          return rank(a.filename) - rank(b.filename);
        });

      // Log attachments that didn't pass the filter
      for (const a of attachments) {
        const isLorean = /lorean/i.test(a.filename);
        const isPdf = /\.pdf$/i.test(a.filename);
        if (!isLorean || !isPdf) {
          console.log(`[lorean] Skipping attachment "${a.filename}" (mimeType=${a.mimeType}) — isLorean=${isLorean} isPdf=${isPdf}`);
        }
      }

      if (pdfAttachments.length === 0) {
        console.log(`[lorean] email ${emailId}: no Lorean PDFs found among ${attachments.length} attachment(s)`);
        results.detail.push({ emailId, status: "no_pdf", attachments: attachments.map((a) => a.filename) });
        continue;
      }

      console.log(`[lorean] email ${emailId}: processing ${pdfAttachments.length} Lorean PDF(s)`);

      for (const attachment of pdfAttachments) {
        try {
          await processAttachment(accessToken, emailId, attachment);
          results.processed++;
          results.detail.push({ emailId, filename: attachment.filename, status: "success" });
        } catch (err) {
          await logError(emailId, attachment.filename, err);
          results.errors++;
          results.detail.push({ emailId, filename: attachment.filename, status: "error", error: String(err) });
        }
      }
    }

    console.log("[lorean] Finished:", results);
    return Response.json(results, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("[lorean] Fatal error:", err);
    return Response.json({ error: String(err) }, { status: 500, headers: CORS_HEADERS });
  }
});
