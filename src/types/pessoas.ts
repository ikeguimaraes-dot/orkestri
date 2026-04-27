// Tipos do módulo Pessoas (Fase 1).
// Espelha supabase/migrations/003_pessoas.sql.
//
// NUMERIC do Postgres vem como string no JSON da API REST (preserva precisão).
// Mantemos como string e convertemos pra Number só onde for fazer cálculo na UI.

import type { Json } from "./database";

export type ShiftTipo = "normal" | "extra" | "folga" | "feriado";

export type PunchTipo = "entrada" | "saida" | "intervalo_inicio" | "intervalo_fim";

export type PayslipStatus = "rascunho" | "aprovado" | "pago";

export type TipoConta = "corrente" | "poupanca" | "salario" | string;

export type Employee = {
  id: string;
  unit_id: string;
  user_id: string | null;
  nome: string;
  sobrenome: string;
  cpf: string | null;
  ctps: string | null;
  ctps_serie: string | null;
  ctps_uf: string | null;
  rg: string | null;
  rg_orgao: string | null;
  rg_uf: string | null;
  pis: string | null;
  titulo_eleitor: string | null;
  reservista: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  escolaridade: string | null;
  raca: string | null;
  genero: string | null;
  nome_mae: string | null;
  nome_pai: string | null;
  departamento: string | null;
  funcao: string;
  salario_base: string;          // NUMERIC(10,2)
  data_admissao: string;         // ISO date
  data_demissao: string | null;
  ativo: boolean;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: TipoConta | null;
  pix: string | null;
  created_at: string;
  updated_at: string;
};

export type EmployeeInsert = {
  id?: string;
  unit_id: string;
  user_id?: string | null;
  nome: string;
  sobrenome: string;
  cpf?: string | null;
  ctps?: string | null;
  ctps_serie?: string | null;
  ctps_uf?: string | null;
  rg?: string | null;
  rg_orgao?: string | null;
  rg_uf?: string | null;
  pis?: string | null;
  titulo_eleitor?: string | null;
  reservista?: string | null;
  rua?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  escolaridade?: string | null;
  raca?: string | null;
  genero?: string | null;
  nome_mae?: string | null;
  nome_pai?: string | null;
  departamento?: string | null;
  funcao: string;
  salario_base?: string | number;
  data_admissao: string;
  data_demissao?: string | null;
  ativo?: boolean;
  banco?: string | null;
  agencia?: string | null;
  conta?: string | null;
  tipo_conta?: string | null;
  pix?: string | null;
};

export type EmployeeUpdate = Partial<Omit<EmployeeInsert, "unit_id">>;

// ── Dependentes (IRRF) ─────────────────────────────────────────
export type Dependent = {
  id: string;
  employee_id: string;
  nome: string;
  cpf: string | null;
  data_nascimento: string | null;
  parentesco: string;
  ordem: number;
  created_at: string;
};

export type DependentInsert = {
  id?: string;
  employee_id: string;
  nome: string;
  cpf?: string | null;
  data_nascimento?: string | null;
  parentesco: string;
  ordem?: number;
};

export type DependentUpdate = Partial<Omit<DependentInsert, "employee_id">>;

// ── Faltas / atestados ─────────────────────────────────────────
export type AbsenceTipo =
  | "justificada"
  | "injustificada"
  | "atestado"
  | "falta_abono"
  | string;

export type Absence = {
  id: string;
  employee_id: string;
  data: string;
  tipo: AbsenceTipo;
  motivo: string | null;
  score_impact: number;
  atestado_path: string | null;
  created_at: string;
};

export type AbsenceInsert = {
  id?: string;
  employee_id: string;
  data: string;
  tipo: AbsenceTipo;
  motivo?: string | null;
  score_impact?: number;
  atestado_path?: string | null;
};

export type AbsenceUpdate = Partial<Omit<AbsenceInsert, "employee_id">>;

// ── Advertências (CLT) ─────────────────────────────────────────
export type WarningNivel = "verbal" | "escrita" | "suspensao" | string;

export type Warning = {
  id: string;
  employee_id: string;
  nivel: WarningNivel;
  descricao: string;
  score_impact: number;
  documento_path: string | null;
  data: string;
  created_at: string;
};

export type WarningInsert = {
  id?: string;
  employee_id: string;
  nivel: WarningNivel;
  descricao: string;
  score_impact?: number;
  documento_path?: string | null;
  data?: string;
};

export type WarningUpdate = Partial<Omit<WarningInsert, "employee_id">>;

// ── Score / gamificação RH ─────────────────────────────────────
export type ScoreEvent = {
  id: string;
  employee_id: string;
  tipo: string;
  delta: number;
  descricao: string | null;
  referencia_id: string | null;
  created_at: string;
};

export type ScoreEventInsert = {
  id?: string;
  employee_id: string;
  tipo: string;
  delta: number;
  descricao?: string | null;
  referencia_id?: string | null;
};

export type Shift = {
  id: string;
  employee_id: string;
  unit_id: string;
  data: string;                  // ISO date
  hora_inicio: string;           // HH:MM:SS
  hora_fim: string;
  tipo: ShiftTipo | string;
  labor_cost: string | null;
  observacao: string | null;
  created_at: string;
};

export type ShiftInsert = {
  id?: string;
  employee_id: string;
  unit_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  tipo?: ShiftTipo | string;
  labor_cost?: string | number | null;
  observacao?: string | null;
};

export type ShiftUpdate = Partial<Omit<ShiftInsert, "employee_id" | "unit_id">>;

export type TimeClockPunch = {
  id: string;
  employee_id: string;
  tipo: PunchTipo | string;
  timestamp_punch: string;
  latitude: string | null;
  longitude: string | null;
  device_info: string | null;
  aprovado: boolean | null;      // null = pendente
  created_at: string;
};

export type TimeClockPunchInsert = {
  id?: string;
  employee_id: string;
  tipo: PunchTipo;
  timestamp_punch?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  device_info?: string | null;
  aprovado?: boolean | null;
};

export type TimeBankBalance = {
  id: string;
  employee_id: string;
  saldo_minutos: number;
  ultimo_calculo: string | null;
  updated_at: string;
};

export type TimeBankBalanceUpsert = {
  id?: string;
  employee_id: string;
  saldo_minutos?: number;
  ultimo_calculo?: string | null;
};

export type Payslip = {
  id: string;
  employee_id: string;
  competencia: string;           // primeiro dia do mês (ISO date)
  salario_base: string;
  horas_extras: string;
  adicional_noturno: string;
  gorjeta: string;
  dsr_gorjeta: string;
  desconto_inss: string;
  desconto_irrf: string;
  desconto_vale_transporte: string;
  desconto_vale_refeicao: string;
  outros_descontos: string;
  outros_acrescimos: string;
  liquido: string;
  status: PayslipStatus | string;
  pdf_url: string | null;
  created_at: string;
};

export type PayslipInsert = {
  id?: string;
  employee_id: string;
  competencia: string;
  salario_base: string | number;
  horas_extras?: string | number;
  adicional_noturno?: string | number;
  gorjeta?: string | number;
  dsr_gorjeta?: string | number;
  desconto_inss?: string | number;
  desconto_irrf?: string | number;
  desconto_vale_transporte?: string | number;
  desconto_vale_refeicao?: string | number;
  outros_descontos?: string | number;
  outros_acrescimos?: string | number;
  liquido: string | number;
  status?: PayslipStatus | string;
  pdf_url?: string | null;
};

export type PayslipUpdate = Partial<Omit<PayslipInsert, "employee_id" | "competencia">>;

// Holerite com employee anexo (resultado do listPayslips/getPayslip).
export type PayslipWithEmployee = Payslip & {
  employee: Pick<Employee, "id" | "nome" | "sobrenome" | "funcao" | "salario_base"> | null;
};

export type GeneratePayslipInput = {
  employeeId: string;
  mes: number;
  ano: number;
  gorjeta?: number;
  dependentes?: number;
  descontoVT?: number;
  descontoVR?: number;
};

export type CCTVersion = {
  id: string;
  sindicato: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  piso_salarial: string | null;
  adicional_noturno_pct: string;
  hora_extra_50_pct: string;
  hora_extra_100_pct: string;
  gorjeta_percentual: string | null;
  dsr_sobre_gorjeta: boolean;
  dados_completos: Json | null;
  ativo: boolean;
  created_at: string;
};

export type CCTVersionInsert = {
  id?: string;
  sindicato: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  piso_salarial?: string | number | null;
  adicional_noturno_pct?: string | number;
  hora_extra_50_pct?: string | number;
  hora_extra_100_pct?: string | number;
  gorjeta_percentual?: string | number | null;
  dsr_sobre_gorjeta?: boolean;
  dados_completos?: Json | null;
  ativo?: boolean;
};
