"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import type { ActionResult } from "@/lib/result";

export interface AgentMessage {
  role: string;
  content: string;
  timestamp: string;
}

export interface AgentConversation {
  id: string;
  phone: string;
  agent_name: string;
  messages: AgentMessage[];
  created_at: string;
  updated_at: string;
}

export interface AgentMetricsSummary {
  total_conversations: number;
  total_cost: number;
  avg_latency_ms: number;
  top_intents: Array<{ intent: string; count: number }>;
}

export async function getAgentMetricsSummary(): Promise<AgentMetricsSummary> {
  await requireUser();
  const supabase = createServiceClient();
  if (!supabase) {
    return { total_conversations: 0, total_cost: 0, avg_latency_ms: 0, top_intents: [] };
  }

  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceIso = since.toISOString();

  const [{ count: total_conversations }, { data: metrics }] = await Promise.all([
    (supabase as any)
      .from("agent_conversations")
      .select("id", { count: "exact", head: true }),
    (supabase as any)
      .from("agent_metrics")
      .select("cost, latency_ms, intent")
      .gte("created_at", sinceIso),
  ]);

  const rows = (metrics ?? []) as Array<{ cost: number | null; latency_ms: number | null; intent: string | null }>;

  const total_cost = rows.reduce((sum, m) => sum + (m.cost ?? 0), 0);
  const latencies = rows.filter((m) => m.latency_ms != null);
  const avg_latency_ms =
    latencies.length > 0
      ? latencies.reduce((sum, m) => sum + (m.latency_ms ?? 0), 0) / latencies.length
      : 0;

  const intentCounts: Record<string, number> = {};
  for (const m of rows) {
    if (m.intent) {
      intentCounts[m.intent] = (intentCounts[m.intent] ?? 0) + 1;
    }
  }
  const top_intents = Object.entries(intentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([intent, count]) => ({ intent, count }));

  return {
    total_conversations: total_conversations ?? 0,
    total_cost,
    avg_latency_ms,
    top_intents,
  };
}

export async function getAgentConversations(agentFilter?: string): Promise<AgentConversation[]> {
  await requireUser();
  const supabase = createServiceClient();
  if (!supabase) return [];

  let query = (supabase as any)
    .from("agent_conversations")
    .select("id, phone, agent_name, messages, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (agentFilter) {
    query = query.eq("agent_name", agentFilter);
  }

  const { data } = await query;
  return (data ?? []) as AgentConversation[];
}

export async function deleteConversation(id: string): Promise<ActionResult<string>> {
  await requireUser();
  const supabase = createServiceClient();
  if (!supabase) return { ok: false, error: "Serviço indisponível" };

  const { error } = await (supabase as any)
    .from("agent_conversations")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: id };
}
