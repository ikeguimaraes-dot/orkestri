-- 064_agent_tables: Conversas e métricas dos agentes WhatsApp (Theo e Maya)
-- Criado em 2026-05-21
-- Aplicar manualmente no Supabase SQL Editor (projeto iqgrvptrtphvbmvrqntm)

-- Histórico de conversas por telefone/agente
CREATE TABLE IF NOT EXISTS agent_conversations (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  phone       text        NOT NULL,
  agent_name  text        NOT NULL,
  messages    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Métricas por chamada de LLM (custo, latência, intenção)
CREATE TABLE IF NOT EXISTS agent_metrics (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name    text        NOT NULL,
  intent        text,
  input_tokens  int,
  output_tokens int,
  cost          numeric,
  latency_ms    int,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_agent_conversations_agent   ON agent_conversations (agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_phone   ON agent_conversations (phone);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_updated ON agent_conversations (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent         ON agent_metrics (agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_created       ON agent_metrics (created_at DESC);
