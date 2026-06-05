import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

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
  ]
}

Regras:
- cmv_pct: valor decimal (ex: 0.27 para 27%)
- pct_bruto: valor decimal (ex: 0.17 para 17%)
- permanencia_media: formato "HH:MM:SS"
- Campos não encontrados no PDF: usar null
- Arrays vazios se a seção não existir: []`;

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
- Campos não encontrados: usar null
- pagamentos: array vazio [] se não houver`;

async function parsePdfWithClaude(
  pdfBase64: string,
  tipo: "workday" | "caixa",
  filename: string,
) {
  console.log(`[lorean] Calling Claude for ${filename} (tipo: ${tipo})...`);
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
          } as any,
          { type: "text", text: tipo === "workday" ? WORKDAY_PROMPT : CAIXA_PROMPT },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  console.log(`[lorean] Claude raw response for ${filename} (first 300 chars):`, text.slice(0, 300));

  const clean = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const parsed = JSON.parse(clean);
  console.log(`[lorean] Parsed JSON keys for ${filename}:`, Object.keys(parsed));
  return parsed;
}

// ── Database insertion ──────────────────────────────────────────────────────

function classifyTurno(aberturaAt: string): "almoco" | "jantar" {
  const hora = new Date(aberturaAt).getHours();
  return hora >= 10 && hora < 17 ? "almoco" : "jantar";
}

async function insertWorkday(
  parsed: any,
  unitId: string,
  emailId: string,
  filename: string,
) {
  console.log(`[lorean] insertWorkday: data=${parsed.data} unit=${unitId}`);

  const { data: existing } = await supabase
    .from("lorean_workdays")
    .select("id, turno, abertura_at")
    .eq("unit_id", unitId)
    .eq("data", parsed.data)
    .maybeSingle();

  let turno: string = "dia_inteiro";

  if (existing) {
    const turnoExistente = classifyTurno(existing.abertura_at);
    console.log(`[lorean] Existing workday found (${existing.id}), reclassifying to turno=${turnoExistente}`);
    await supabase
      .from("lorean_workdays")
      .update({ turno: turnoExistente })
      .eq("id", existing.id);
    turno = classifyTurno(parsed.abertura_at);
    console.log(`[lorean] New workday turno=${turno}`);
  }

  const { data: wd, error: wdErr } = await supabase
    .from("lorean_workdays")
    .upsert(
      {
        unit_id: unitId,
        data: parsed.data,
        workday_id: parsed.workday_id,
        turno,
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
      { onConflict: "unit_id,data,turno" },
    )
    .select()
    .single();

  if (wdErr) throw new Error(`lorean_workdays upsert: ${wdErr.message}`);
  console.log(`[lorean] lorean_workdays upserted: id=${wd.id}`);

  await Promise.all([
    supabase.from("lorean_pagamentos").delete().eq("workday_id_fk", wd.id),
    supabase.from("lorean_ambientes").delete().eq("workday_id_fk", wd.id),
    supabase.from("lorean_turnos").delete().eq("workday_id_fk", wd.id),
    supabase.from("lorean_grupos").delete().eq("workday_id_fk", wd.id),
    supabase.from("lorean_descontos").delete().eq("workday_id_fk", wd.id),
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
  await Promise.all(inserts);

  console.log(`[lorean] Child tables inserted for workday ${wd.id}: pagamentos=${parsed.pagamentos?.length ?? 0} ambientes=${parsed.ambientes?.length ?? 0} turnos=${parsed.turnos?.length ?? 0} grupos=${parsed.grupos?.length ?? 0} descontos=${parsed.descontos?.length ?? 0}`);

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

  if (tipo === "venda") {
    console.log(`[lorean] Skipping "Venda" PDF (not implemented): ${filename}`);
    return;
  }

  console.log(`[lorean] Downloading PDF attachment ${attachmentId}...`);
  const pdfBase64 = await getAttachmentBase64(accessToken, emailId, attachmentId);
  console.log(`[lorean] PDF downloaded, base64 length=${pdfBase64.length}`);
  const parsed = await parsePdfWithClaude(pdfBase64, tipo, filename);

  if (tipo === "workday") {
    await insertWorkday(parsed, supabaseUnitId, emailId, filename);
  } else {
    await insertCaixa(parsed, supabaseUnitId, emailId, filename);
  }
  console.log(`[lorean] Done: ${filename}`);
}

// ── Entry point ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  console.log("[lorean] process-lorean-emails started");

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

    const emailIds = await fetchLoreanEmailIds(accessToken);
    const results = { total_emails: emailIds.length, processed: 0, skipped: 0, errors: 0, detail: [] as any[] };

    for (const emailId of emailIds) {
      if (processedIds.has(emailId)) {
        console.log(`[lorean] Skipping already-processed email: ${emailId}`);
        results.skipped++;
        results.detail.push({ emailId, status: "skipped" });
        continue;
      }

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
      const pdfAttachments = attachments.filter(
        (a) => /lorean/i.test(a.filename) && /\.pdf$/i.test(a.filename),
      );

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
