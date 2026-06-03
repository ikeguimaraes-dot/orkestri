-- Tabelas para integração Lorean (frente de caixa) → Supabase
-- Process: Gmail → Edge Function → parse PDF → tabelas abaixo

CREATE TABLE public.lorean_workdays (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id           uuid REFERENCES units(id),
  data              date NOT NULL,
  workday_id        integer,
  turno             varchar NOT NULL DEFAULT 'dia_inteiro',
  abertura_at       timestamptz,
  fechamento_at     timestamptz,
  receita_bruta     numeric,
  desconto          numeric,
  gorjeta           numeric,
  receita_liquida   numeric,
  custo             numeric,
  cmv_pct           numeric,
  lucro             numeric,
  clientes          integer,
  ticket_medio      numeric,
  ticket_real       numeric,
  permanencia_media interval,
  previsto          numeric,
  devedor           numeric,
  criado_em         timestamptz DEFAULT now(),
  UNIQUE (unit_id, data, turno)
);

CREATE TABLE public.lorean_pagamentos (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workday_id_fk   uuid REFERENCES lorean_workdays(id) ON DELETE CASCADE,
  forma           varchar NOT NULL,
  valor_fechado   numeric,
  valor_recebido  numeric,
  diferenca       numeric,
  criado_em       timestamptz DEFAULT now()
);

CREATE TABLE public.lorean_ambientes (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workday_id_fk uuid REFERENCES lorean_workdays(id) ON DELETE CASCADE,
  ambiente      varchar NOT NULL,
  clientes      integer,
  gorjeta       numeric,
  produto       numeric,
  consumo       numeric,
  criado_em     timestamptz DEFAULT now()
);

CREATE TABLE public.lorean_turnos (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workday_id_fk uuid REFERENCES lorean_workdays(id) ON DELETE CASCADE,
  turno         varchar NOT NULL,
  clientes      integer,
  gorjeta       numeric,
  produto       numeric,
  consumo       numeric,
  criado_em     timestamptz DEFAULT now()
);

CREATE TABLE public.lorean_grupos (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workday_id_fk uuid REFERENCES lorean_workdays(id) ON DELETE CASCADE,
  grupo         varchar NOT NULL,
  pct_bruto     numeric,
  bruto         numeric,
  desconto      numeric,
  gorjeta       numeric,
  consumo       numeric,
  criado_em     timestamptz DEFAULT now()
);

CREATE TABLE public.lorean_descontos (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workday_id_fk uuid REFERENCES lorean_workdays(id) ON DELETE CASCADE,
  motivo        varchar NOT NULL,
  qtd           integer,
  consumo       numeric,
  criado_em     timestamptz DEFAULT now()
);

CREATE TABLE public.lorean_caixas (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workday_id_fk   uuid REFERENCES lorean_workdays(id) ON DELETE CASCADE,
  caixa_id        integer,
  operador        varchar,
  abertura_at     timestamptz,
  fechamento_at   timestamptz,
  total_fechado   numeric,
  total_recebido  numeric,
  diferenca       numeric,
  criado_em       timestamptz DEFAULT now()
);

CREATE TABLE public.lorean_import_log (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id      varchar,
  filename      varchar,
  tipo          varchar,
  data_referente date,
  status        varchar,
  erro          text,
  processado_em timestamptz DEFAULT now()
);

-- Índices úteis para queries do módulo Receita DRE
CREATE INDEX lorean_workdays_unit_data  ON lorean_workdays (unit_id, data);
CREATE INDEX lorean_workdays_data       ON lorean_workdays (data);
CREATE INDEX lorean_import_log_email_id ON lorean_import_log (email_id, status);
