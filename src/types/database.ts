// Tipos do schema Supabase do KPH OS.
//
// Mantido manualmente — quando o schema crescer, considerar gerar via
// `supabase gen types typescript`. Por enquanto, single source of truth aqui.

export type RoleName =
  | "founder"
  | "cfo"
  | "gm"
  | "pessoas"
  | "chef"
  | "comprador"
  | "colaborador"
  | "socio_readonly";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      groups: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          created_at?: string;
        };
      };
      brands: {
        Row: {
          id: string;
          group_id: string | null;
          name: string;
          slug: string;
          color: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id?: string | null;
          name: string;
          slug: string;
          color?: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string | null;
          name?: string;
          slug?: string;
          color?: string;
          active?: boolean;
          created_at?: string;
        };
      };
      units: {
        Row: {
          id: string;
          brand_id: string | null;
          name: string;
          address: string | null;
          whatsapp_number: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id?: string | null;
          name: string;
          address?: string | null;
          whatsapp_number?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string | null;
          name?: string;
          address?: string | null;
          whatsapp_number?: string | null;
          active?: boolean;
          created_at?: string;
        };
      };
      roles: {
        Row: {
          id: string;
          name: RoleName;
          description: string | null;
        };
        Insert: {
          id?: string;
          name: RoleName;
          description?: string | null;
        };
        Update: {
          id?: string;
          name?: RoleName;
          description?: string | null;
        };
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role_id: string;
          unit_id: string | null;
          brand_id: string | null;
          group_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role_id: string;
          unit_id?: string | null;
          brand_id?: string | null;
          group_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role_id?: string;
          unit_id?: string | null;
          brand_id?: string | null;
          group_id?: string | null;
          created_at?: string;
        };
      };
      audit_log: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          resource: string;
          resource_id: string | null;
          old_data: Json | null;
          new_data: Json | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          resource: string;
          resource_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: string;
          resource?: string;
          resource_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
      };
      // ── Fase 1 / Pessoas ──────────────────────────────────────
      employees: {
        Row: {
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
          salario_base: string;
          data_admissao: string;
          data_demissao: string | null;
          ativo: boolean;
          banco: string | null;
          agencia: string | null;
          conta: string | null;
          tipo_conta: string | null;
          pix: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
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
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unit_id?: string;
          user_id?: string | null;
          nome?: string;
          sobrenome?: string;
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
          funcao?: string;
          salario_base?: string | number;
          data_admissao?: string;
          data_demissao?: string | null;
          ativo?: boolean;
          banco?: string | null;
          agencia?: string | null;
          conta?: string | null;
          tipo_conta?: string | null;
          pix?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      shifts: {
        Row: {
          id: string;
          employee_id: string;
          unit_id: string;
          data: string;
          hora_inicio: string;
          hora_fim: string;
          tipo: string;
          labor_cost: string | null;
          observacao: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          unit_id: string;
          data: string;
          hora_inicio: string;
          hora_fim: string;
          tipo?: string;
          labor_cost?: string | number | null;
          observacao?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          unit_id?: string;
          data?: string;
          hora_inicio?: string;
          hora_fim?: string;
          tipo?: string;
          labor_cost?: string | number | null;
          observacao?: string | null;
          created_at?: string;
        };
      };
      time_clock_punches: {
        Row: {
          id: string;
          employee_id: string;
          tipo: string;
          timestamp_punch: string;
          latitude: string | null;
          longitude: string | null;
          device_info: string | null;
          aprovado: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          tipo: string;
          timestamp_punch?: string;
          latitude?: string | number | null;
          longitude?: string | number | null;
          device_info?: string | null;
          aprovado?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          tipo?: string;
          timestamp_punch?: string;
          latitude?: string | number | null;
          longitude?: string | number | null;
          device_info?: string | null;
          aprovado?: boolean | null;
          created_at?: string;
        };
      };
      time_bank_balance: {
        Row: {
          id: string;
          employee_id: string;
          saldo_minutos: number;
          ultimo_calculo: string | null;
          source: string | null;
          observacao: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          saldo_minutos?: number;
          ultimo_calculo?: string | null;
          source?: string | null;
          observacao?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          saldo_minutos?: number;
          ultimo_calculo?: string | null;
          source?: string | null;
          observacao?: string | null;
          updated_at?: string;
        };
      };
      dependents: {
        Row: {
          id: string;
          employee_id: string;
          nome: string;
          cpf: string | null;
          data_nascimento: string | null;
          parentesco: string;
          ordem: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          nome: string;
          cpf?: string | null;
          data_nascimento?: string | null;
          parentesco: string;
          ordem?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          nome?: string;
          cpf?: string | null;
          data_nascimento?: string | null;
          parentesco?: string;
          ordem?: number;
          created_at?: string;
        };
      };
      absences: {
        Row: {
          id: string;
          employee_id: string;
          data: string;
          tipo: string;
          motivo: string | null;
          score_impact: number;
          atestado_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          data: string;
          tipo: string;
          motivo?: string | null;
          score_impact?: number;
          atestado_path?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          data?: string;
          tipo?: string;
          motivo?: string | null;
          score_impact?: number;
          atestado_path?: string | null;
          created_at?: string;
        };
      };
      warnings: {
        Row: {
          id: string;
          employee_id: string;
          nivel: string;
          descricao: string;
          score_impact: number;
          documento_path: string | null;
          data: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          nivel: string;
          descricao: string;
          score_impact?: number;
          documento_path?: string | null;
          data?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          nivel?: string;
          descricao?: string;
          score_impact?: number;
          documento_path?: string | null;
          data?: string;
          created_at?: string;
        };
      };
      score_events: {
        Row: {
          id: string;
          employee_id: string;
          tipo: string;
          delta: number;
          descricao: string | null;
          referencia_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          tipo: string;
          delta: number;
          descricao?: string | null;
          referencia_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          tipo?: string;
          delta?: number;
          descricao?: string | null;
          referencia_id?: string | null;
          created_at?: string;
        };
      };
      payslips: {
        Row: {
          id: string;
          employee_id: string;
          competencia: string;
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
          status: string;
          pdf_url: string | null;
          created_at: string;
        };
        Insert: {
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
          status?: string;
          pdf_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          competencia?: string;
          salario_base?: string | number;
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
          liquido?: string | number;
          status?: string;
          pdf_url?: string | null;
          created_at?: string;
        };
      };
      cct_versions: {
        Row: {
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
        Insert: {
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
          created_at?: string;
        };
        Update: {
          id?: string;
          sindicato?: string;
          vigencia_inicio?: string;
          vigencia_fim?: string;
          piso_salarial?: string | number | null;
          adicional_noturno_pct?: string | number;
          hora_extra_50_pct?: string | number;
          hora_extra_100_pct?: string | number;
          gorjeta_percentual?: string | number | null;
          dsr_sobre_gorjeta?: boolean;
          dados_completos?: Json | null;
          ativo?: boolean;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      kph_is_founder: { Args: Record<string, never>; Returns: boolean };
      kph_is_founder_or_cfo: { Args: Record<string, never>; Returns: boolean };
      kph_has_role_for_unit: { Args: { p_unit_id: string }; Returns: boolean };
      kph_has_role_for_brand: { Args: { p_brand_id: string }; Returns: boolean };
      kph_has_role_for_group: { Args: { p_group_id: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
  };
};

// Helpers ergonômicos pra o app — pegar Row de uma tabela sem repetir caminho.
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Group = Tables<"groups">;
export type Brand = Tables<"brands">;
export type Unit = Tables<"units">;
export type RoleRow = Tables<"roles">;
export type UserRole = Tables<"user_roles">;
export type AuditLogEntry = Tables<"audit_log">;
