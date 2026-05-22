"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Loader2 } from "lucide-react";

import { Button } from "@kph/ui/button";
import { Input } from "@kph/ui/input";
import { Label } from "@kph/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kph/ui/select";
import {
  employeeFormSchema,
  type EmployeeFormInput,
  type EmployeeFormOutput,
} from "@/lib/pessoas/schema";
import { createEmployee, updateEmployee } from "@/lib/pessoas/actions";
import type { Employee } from "@kph/db/types/pessoas";

type Props =
  | { mode: "create"; unitId: string; defaultValues?: undefined; employeeId?: undefined }
  | { mode: "edit"; unitId: string; employeeId: string; defaultValues: EmployeeFormInput };

const ESCOLARIDADE_OPTIONS = [
  "Fundamental Incompleto",
  "Fundamental Completo",
  "Médio Incompleto",
  "Médio Completo",
  "Superior Incompleto",
  "Superior Completo",
  "Pós-graduação",
] as const;

const RACA_OPTIONS = ["Branca", "Preta", "Parda", "Amarela", "Indígena", "Não declarada"] as const;
const GENERO_OPTIONS = ["Masculino", "Feminino", "Outro", "Não declarado"] as const;

// HOS RH expansion (migration 011)
const ESTADO_CIVIL_OPTIONS = [
  "Solteiro",
  "Casado",
  "União Estável",
  "Divorciado",
  "Viúvo",
  "Separado",
] as const;

const TIPO_CONTRATO_OPTIONS = [
  { value: "CLT", label: "CLT" },
  { value: "PJ", label: "PJ" },
  { value: "temporario", label: "Temporário" },
  { value: "estagiario", label: "Estagiário" },
] as const;

const STATUS_RH_OPTIONS = [
  { value: "ativo", label: "Ativo" },
  { value: "inativo", label: "Inativo" },
  { value: "ferias", label: "Em férias" },
  { value: "afastado", label: "Afastado" },
] as const;

export function EmployeeForm(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);

  // RHF: TFieldValues = input (o que o user digita), TTransformedValues = output
  // (depois do schema transform com nulls). Sem isso, o tipo do resolver não bate.
  const form = useForm<EmployeeFormInput, undefined, EmployeeFormOutput>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues:
      props.mode === "edit"
        ? props.defaultValues
        : {
            nome: "",
            sobrenome: "",
            funcao: "",
            salario_base: "" as unknown as number,
            data_admissao: "",
            cpf: "",
            rg: "",
            rg_orgao: "",
            rg_uf: "",
            pis: "",
            ctps: "",
            ctps_serie: "",
            ctps_uf: "",
            titulo_eleitor: "",
            reservista: "",
            cep: "",
            rua: "",
            numero: "",
            complemento: "",
            bairro: "",
            cidade: "",
            estado: "",
            escolaridade: "",
            raca: "",
            genero: "",
            nome_mae: "",
            nome_pai: "",
            departamento: "",
            banco: "",
            agencia: "",
            conta: "",
            tipo_conta: "",
            pix: "",
            // HOS RH expansion
            employee_code: "",
            esocial_code: "",
            nome_social: "",
            data_nascimento: "",
            cidade_nascimento: "",
            uf_nascimento: "",
            pais_nascimento: "Brasil",
            estado_civil: "",
            tipo_contrato: "CLT",
            jornada: "",
            status_rh: "ativo",
            telefone: "",
            email: "",
            photo_url: "",
            contato_emergencia_nome: "",
            contato_emergencia_tel: "",
            zona_eleitoral: "",
            secao_eleitoral: "",
            rne: "",
            rne_orgao: "",
            rne_expedicao: "",
            ctps_expedicao: "",
          },
  });

  // ViaCEP: ao perder foco do CEP, busca e preenche endereço.
  const handleCepBlur = async (rawCep: string) => {
    const cep = rawCep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!res.ok) return;
      const data: {
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
        erro?: boolean;
      } = await res.json();
      if (data.erro) return;
      // Só sobrescreve campos vazios — não pisa em edição manual.
      const setIfEmpty = (k: keyof EmployeeFormInput, v: string | undefined) => {
        if (!v) return;
        const curr = form.getValues(k);
        if (curr === undefined || curr === null || curr === "") {
          form.setValue(k, v as never, { shouldValidate: true, shouldDirty: true });
        }
      };
      setIfEmpty("rua", data.logradouro);
      setIfEmpty("bairro", data.bairro);
      setIfEmpty("cidade", data.localidade);
      setIfEmpty("estado", data.uf);
    } catch (e) {
      console.warn("[ViaCEP] falha:", e);
    } finally {
      setCepLoading(false);
    }
  };

  const onSubmit = (parsed: EmployeeFormOutput) => {
    setSubmitError(null);
    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await createEmployee({ ...parsed, unit_id: props.unitId })
          : await updateEmployee(props.employeeId, parsed);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      router.push("/pessoas/colaboradores");
      router.refresh();
    });
  };

  const errs = form.formState.errors;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 820 }}
    >
      <Section title="Identificação" desc="Dados pessoais e função na casa.">
        <Row>
          <Field label="Nome" error={errs.nome?.message}>
            <Input {...form.register("nome")} autoComplete="off" />
          </Field>
          <Field label="Sobrenome" error={errs.sobrenome?.message}>
            <Input {...form.register("sobrenome")} autoComplete="off" />
          </Field>
        </Row>
        <Row>
          <Field label="Nome social (opcional)" error={errs.nome_social?.message}>
            <Input {...form.register("nome_social")} autoComplete="off" />
          </Field>
          <Field label="CPF (opcional)" error={errs.cpf?.message}>
            <Input {...form.register("cpf")} placeholder="000.000.000-00" />
          </Field>
        </Row>
        <Row>
          <Field label="Função" error={errs.funcao?.message}>
            <Input {...form.register("funcao")} placeholder="Ex: Garçom I, Cozinheiro II" />
          </Field>
          <Field
            label="Código Totvs / interno"
            error={errs.employee_code?.message}
          >
            <Input
              {...form.register("employee_code")}
              placeholder="Ex: 1234"
              autoComplete="off"
            />
          </Field>
          <Field label="Código eSocial" error={errs.esocial_code?.message}>
            <Input {...form.register("esocial_code")} autoComplete="off" />
          </Field>
        </Row>
      </Section>

      <Section title="Nascimento" desc="Origem e estado civil.">
        <Row>
          <Field label="Data de nascimento" error={errs.data_nascimento?.message}>
            <Input type="date" {...form.register("data_nascimento")} />
          </Field>
          <Field label="Cidade" error={errs.cidade_nascimento?.message}>
            <Input {...form.register("cidade_nascimento")} />
          </Field>
          <Field label="UF" error={errs.uf_nascimento?.message}>
            <Input {...form.register("uf_nascimento")} maxLength={2} placeholder="SP" />
          </Field>
        </Row>
        <Row>
          <Field label="País" error={errs.pais_nascimento?.message}>
            <Input {...form.register("pais_nascimento")} />
          </Field>
          <Field label="Estado civil" error={errs.estado_civil?.message}>
            <Select
              value={form.watch("estado_civil") ?? ""}
              onValueChange={(v) =>
                form.setValue("estado_civil", v as EmployeeFormInput["estado_civil"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {ESTADO_CIVIL_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Row>
      </Section>

      <Section
        title="Vínculo e remuneração"
        desc="Salário-base é o de carteira (sem horas extras / gorjeta)."
      >
        <Row>
          <Field label="Salário-base (R$)" error={errs.salario_base?.message}>
            <Input
              type="number"
              step="0.01"
              min="0"
              {...form.register("salario_base")}
              placeholder="0,00"
            />
          </Field>
          <Field label="Data de admissão" error={errs.data_admissao?.message}>
            <Input type="date" {...form.register("data_admissao")} />
          </Field>
        </Row>
        <Row>
          <Field label="Tipo de contrato" error={errs.tipo_contrato?.message}>
            <Select
              value={form.watch("tipo_contrato") ?? ""}
              onValueChange={(v) =>
                form.setValue("tipo_contrato", v as EmployeeFormInput["tipo_contrato"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {TIPO_CONTRATO_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Jornada"
            error={errs.jornada?.message}
          >
            <Input
              {...form.register("jornada")}
              placeholder="Ex: 44h semanais, 6x1, 12x36"
            />
          </Field>
          <Field label="Status RH" error={errs.status_rh?.message}>
            <Select
              value={form.watch("status_rh") ?? "ativo"}
              onValueChange={(v) =>
                form.setValue("status_rh", v as EmployeeFormInput["status_rh"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_RH_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Row>
        <Field label="Departamento" error={errs.departamento?.message}>
          <Input
            {...form.register("departamento")}
            placeholder="Ex: COZINHA, SALAO, ADMINISTRATIVO"
          />
        </Field>
      </Section>

      <Section title="Documentos" desc="Não bloqueia o cadastro. Preenche conforme tiver.">
        <Row>
          <Field label="RG" error={errs.rg?.message}>
            <Input {...form.register("rg")} />
          </Field>
          <Field label="Órgão emissor" error={errs.rg_orgao?.message}>
            <Input {...form.register("rg_orgao")} placeholder="SSP" />
          </Field>
          <Field label="UF" error={errs.rg_uf?.message}>
            <Input {...form.register("rg_uf")} maxLength={2} placeholder="SP" />
          </Field>
        </Row>
        <Row>
          <Field label="PIS / NIS" error={errs.pis?.message}>
            <Input {...form.register("pis")} />
          </Field>
          <Field label="CTPS número" error={errs.ctps?.message}>
            <Input {...form.register("ctps")} />
          </Field>
        </Row>
        <Row>
          <Field label="CTPS série" error={errs.ctps_serie?.message}>
            <Input {...form.register("ctps_serie")} />
          </Field>
          <Field label="CTPS UF" error={errs.ctps_uf?.message}>
            <Input {...form.register("ctps_uf")} maxLength={2} />
          </Field>
          <Field
            label="CTPS — data de expedição"
            error={errs.ctps_expedicao?.message}
          >
            <Input type="date" {...form.register("ctps_expedicao")} />
          </Field>
        </Row>
        <Row>
          <Field label="Título de eleitor" error={errs.titulo_eleitor?.message}>
            <Input {...form.register("titulo_eleitor")} />
          </Field>
          <Field label="Zona eleitoral" error={errs.zona_eleitoral?.message}>
            <Input {...form.register("zona_eleitoral")} />
          </Field>
          <Field label="Seção eleitoral" error={errs.secao_eleitoral?.message}>
            <Input {...form.register("secao_eleitoral")} />
          </Field>
        </Row>
        <Field label="Reservista" error={errs.reservista?.message}>
          <Input {...form.register("reservista")} />
        </Field>
      </Section>

      <CollapsibleSection
        title="Estrangeiro (RNE)"
        desc="Preencher apenas se o colaborador for estrangeiro."
      >
        <Row>
          <Field label="RNE" error={errs.rne?.message}>
            <Input {...form.register("rne")} />
          </Field>
          <Field label="Órgão emissor" error={errs.rne_orgao?.message}>
            <Input {...form.register("rne_orgao")} placeholder="PF" />
          </Field>
          <Field label="Data de expedição" error={errs.rne_expedicao?.message}>
            <Input type="date" {...form.register("rne_expedicao")} />
          </Field>
        </Row>
      </CollapsibleSection>

      <Section
        title="Endereço"
        desc="Digite o CEP e o resto preenche automático (ViaCEP)."
      >
        <Row>
          <Field
            label={cepLoading ? "CEP (buscando…)" : "CEP"}
            error={errs.cep?.message}
          >
            <Input
              {...form.register("cep", {
                onBlur: (e) => handleCepBlur(e.target.value),
              })}
              placeholder="00000-000"
              maxLength={9}
            />
          </Field>
          <Field label="Estado" error={errs.estado?.message}>
            <Input {...form.register("estado")} maxLength={2} placeholder="SP" />
          </Field>
        </Row>
        <Field label="Rua / Logradouro" error={errs.rua?.message}>
          <Input {...form.register("rua")} />
        </Field>
        <Row>
          <Field label="Número" error={errs.numero?.message}>
            <Input {...form.register("numero")} />
          </Field>
          <Field label="Complemento" error={errs.complemento?.message}>
            <Input {...form.register("complemento")} placeholder="Apto, casa, fundos…" />
          </Field>
        </Row>
        <Row>
          <Field label="Bairro" error={errs.bairro?.message}>
            <Input {...form.register("bairro")} />
          </Field>
          <Field label="Cidade" error={errs.cidade?.message}>
            <Input {...form.register("cidade")} />
          </Field>
        </Row>
      </Section>

      <Section
        title="Contato"
        desc="Email e telefone aparecem no app mobile do colaborador."
      >
        <Row>
          <Field label="Telefone" error={errs.telefone?.message}>
            <Input
              {...form.register("telefone")}
              placeholder="(11) 99999-9999"
              autoComplete="off"
            />
          </Field>
          <Field label="Email" error={errs.email?.message}>
            <Input
              type="email"
              {...form.register("email")}
              placeholder="nome@dominio.com"
              autoComplete="off"
            />
          </Field>
        </Row>
        <Field label="Foto (URL no bucket avatars)" error={errs.photo_url?.message}>
          <Input
            {...form.register("photo_url")}
            placeholder="path no Supabase Storage (bucket avatars)"
            autoComplete="off"
          />
        </Field>
      </Section>

      <Section
        title="Contato de emergência"
        desc="Quem chamar em caso de acidente / urgência."
      >
        <Row>
          <Field label="Nome" error={errs.contato_emergencia_nome?.message}>
            <Input {...form.register("contato_emergencia_nome")} autoComplete="off" />
          </Field>
          <Field label="Telefone" error={errs.contato_emergencia_tel?.message}>
            <Input
              {...form.register("contato_emergencia_tel")}
              placeholder="(11) 99999-9999"
              autoComplete="off"
            />
          </Field>
        </Row>
      </Section>

      <Section
        title="Informações adicionais"
        desc="Dados sociodemográficos exigidos pelo eSocial / RAIS."
      >
        <Row>
          <Field label="Escolaridade" error={errs.escolaridade?.message}>
            <Select
              value={form.watch("escolaridade") ?? ""}
              onValueChange={(v) =>
                form.setValue("escolaridade", v as EmployeeFormInput["escolaridade"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {ESCOLARIDADE_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Raça/Cor" error={errs.raca?.message}>
            <Select
              value={form.watch("raca") ?? ""}
              onValueChange={(v) =>
                form.setValue("raca", v as EmployeeFormInput["raca"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {RACA_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Gênero" error={errs.genero?.message}>
            <Select
              value={form.watch("genero") ?? ""}
              onValueChange={(v) =>
                form.setValue("genero", v as EmployeeFormInput["genero"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {GENERO_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Row>
        <Row>
          <Field label="Nome da mãe" error={errs.nome_mae?.message}>
            <Input {...form.register("nome_mae")} autoComplete="off" />
          </Field>
          <Field label="Nome do pai" error={errs.nome_pai?.message}>
            <Input {...form.register("nome_pai")} autoComplete="off" />
          </Field>
        </Row>
      </Section>

      <Section
        title="Dados bancários"
        desc="Opcionais. Preenche quando tiver os dados; não bloqueia o cadastro."
      >
        <Row>
          <Field label="Banco" error={errs.banco?.message}>
            <Input {...form.register("banco")} placeholder="Ex: Itaú" />
          </Field>
          <Field label="Agência" error={errs.agencia?.message}>
            <Input {...form.register("agencia")} />
          </Field>
        </Row>
        <Row>
          <Field label="Conta" error={errs.conta?.message}>
            <Input {...form.register("conta")} />
          </Field>
          <Field label="Tipo de conta" error={errs.tipo_conta?.message}>
            <Select
              value={form.watch("tipo_conta") ?? ""}
              onValueChange={(v) =>
                form.setValue("tipo_conta", v as EmployeeFormInput["tipo_conta"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="corrente">Corrente</SelectItem>
                <SelectItem value="poupanca">Poupança</SelectItem>
                <SelectItem value="salario">Salário</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Row>
        <Field label="Chave PIX" error={errs.pix?.message}>
          <Input {...form.register("pix")} placeholder="CPF, email ou aleatória" />
        </Field>
      </Section>

      {submitError && (
        <div
          style={{
            padding: "10px 12px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: 8,
            color: "var(--destructive)",
            fontSize: 12,
          }}
        >
          {submitError}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/pessoas/colaboradores")}
          disabled={pending}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : props.mode === "create" ? (
            "Criar colaborador"
          ) : (
            "Salvar alterações"
          )}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset
      style={{
        border: "1px solid var(--border)",
        background: "var(--surface)",
        borderRadius: 12,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <legend style={{ padding: "0 6px", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
        {title}
      </legend>
      {desc && (
        <p style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5, margin: 0 }}>
          {desc}
        </p>
      )}
      {children}
    </fieldset>
  );
}

/**
 * Como Section, mas começa fechada. Usado pra blocos opcionais (Estrangeiro)
 * que normalmente ficam vazios.
 */
function CollapsibleSection({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <fieldset
      style={{
        border: "1px solid var(--border)",
        background: "var(--surface)",
        borderRadius: 12,
        padding: open ? "20px 22px" : "12px 22px",
        display: "flex",
        flexDirection: "column",
        gap: open ? 14 : 0,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          margin: 0,
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "var(--text)",
        }}
      >
        <ChevronDown
          size={14}
          style={{
            color: "var(--text-3)",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 0.2s",
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
      </button>
      {open && desc && (
        <p style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5, margin: 0 }}>
          {desc}
        </p>
      )}
      {open && children}
    </fieldset>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 14,
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Label style={{ fontSize: 11, color: "var(--text-2)" }}>{label}</Label>
      {children}
      {error && (
        <span style={{ fontSize: 11, color: "var(--destructive)" }}>{error}</span>
      )}
    </div>
  );
}

/** Helper pra preencher defaultValues do form a partir de um Employee carregado. */
export function employeeToFormDefaults(e: Employee): EmployeeFormInput {
  return {
    nome: e.nome,
    sobrenome: e.sobrenome,
    funcao: e.funcao,
    salario_base: Number(e.salario_base) as unknown as number,
    data_admissao: e.data_admissao.slice(0, 10),
    cpf: e.cpf ?? "",
    rg: e.rg ?? "",
    rg_orgao: e.rg_orgao ?? "",
    rg_uf: e.rg_uf ?? "",
    pis: e.pis ?? "",
    ctps: e.ctps ?? "",
    ctps_serie: e.ctps_serie ?? "",
    ctps_uf: e.ctps_uf ?? "",
    titulo_eleitor: e.titulo_eleitor ?? "",
    reservista: e.reservista ?? "",
    cep: e.cep ?? "",
    rua: e.rua ?? "",
    numero: e.numero ?? "",
    complemento: e.complemento ?? "",
    bairro: e.bairro ?? "",
    cidade: e.cidade ?? "",
    estado: e.estado ?? "",
    escolaridade: e.escolaridade ?? "",
    raca: e.raca ?? "",
    genero: e.genero ?? "",
    nome_mae: e.nome_mae ?? "",
    nome_pai: e.nome_pai ?? "",
    departamento: e.departamento ?? "",
    banco: e.banco ?? "",
    agencia: e.agencia ?? "",
    conta: e.conta ?? "",
    tipo_conta:
      e.tipo_conta === "corrente" || e.tipo_conta === "poupanca" || e.tipo_conta === "salario"
        ? e.tipo_conta
        : "",
    pix: e.pix ?? "",
    // HOS RH expansion (migration 011)
    employee_code: e.employee_code ?? "",
    esocial_code: e.esocial_code ?? "",
    nome_social: e.nome_social ?? "",
    data_nascimento: e.data_nascimento?.slice(0, 10) ?? "",
    cidade_nascimento: e.cidade_nascimento ?? "",
    uf_nascimento: e.uf_nascimento ?? "",
    pais_nascimento: e.pais_nascimento ?? "Brasil",
    estado_civil: e.estado_civil ?? "",
    tipo_contrato: e.tipo_contrato ?? "CLT",
    jornada: e.jornada ?? "",
    status_rh: e.status_rh ?? "ativo",
    telefone: e.telefone ?? "",
    email: e.email ?? "",
    photo_url: e.photo_url ?? "",
    contato_emergencia_nome: e.contato_emergencia_nome ?? "",
    contato_emergencia_tel: e.contato_emergencia_tel ?? "",
    zona_eleitoral: e.zona_eleitoral ?? "",
    secao_eleitoral: e.secao_eleitoral ?? "",
    rne: e.rne ?? "",
    rne_orgao: e.rne_orgao ?? "",
    rne_expedicao: e.rne_expedicao?.slice(0, 10) ?? "",
    ctps_expedicao: e.ctps_expedicao?.slice(0, 10) ?? "",
  };
}
