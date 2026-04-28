import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  CreditCard,
  GraduationCap,
  IdCard,
  Pencil,
  Plane,
} from "lucide-react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  getEmployee,
  listDependents,
  listOvertimeRecords,
  listTipsRecords,
  listTransportVouchers,
  listVacations,
} from "@/lib/pessoas/actions";
import { listRecordsForEmployee } from "@/app/(dashboard)/pessoas/treinamentos/actions";
import { requireUser } from "@/lib/auth/server";
import { avatarColor, initials } from "@/lib/format";
import { GorjetasTab } from "@/components/pessoas/profile-tabs/GorjetasTab";
import { VtTab } from "@/components/pessoas/profile-tabs/VtTab";
import { HorasExtrasTab } from "@/components/pessoas/profile-tabs/HorasExtrasTab";
import { FeriasTab } from "@/components/pessoas/profile-tabs/FeriasTab";
import { TreinamentosTab } from "@/components/pessoas/profile-tabs/TreinamentosTab";

const TIPO_CONTRATO_LABEL: Record<string, string> = {
  CLT: "CLT",
  PJ: "PJ",
  temporario: "Temporário",
  estagiario: "Estagiário",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return "—";
  return `${dia}/${mes}/${ano}`;
}

function formatCurrency(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";
  const n = typeof val === "string" ? Number(val) : val;
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function joinNonEmpty(parts: Array<string | null | undefined>, sep = " / "): string | null {
  const filtered = parts.filter((p): p is string => Boolean(p && p.trim()));
  return filtered.length ? filtered.join(sep) : null;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  const display = value && String(value).trim() ? String(value) : "—";
  return (
    <div>
      <dt style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{label}</dt>
      <dd style={{ fontSize: 13, color: "var(--text)", fontWeight: 500, margin: 0 }}>
        {display}
      </dd>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--border)",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text)",
        }}
      >
        {title}
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  let stroke = "#DC2626";
  if (clamped > 80) stroke = "#22C55E";
  else if (clamped >= 50) stroke = "#D97706";
  return (
    <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
      <svg width={72} height={72} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={36} cy={36} r={radius} fill="none" strokeWidth={5} stroke="var(--border)" />
        <circle
          cx={36}
          cy={36}
          r={radius}
          fill="none"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          stroke={stroke}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{clamped}</span>
        <span style={{ fontSize: 9, color: "var(--text-3)", marginTop: -2 }}>score</span>
      </div>
    </div>
  );
}

const FIELD_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 16,
  margin: 0,
};

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

const STATUS_RH_LABEL: Record<string, { fg: string; label: string }> = {
  ativo: { fg: "#22C55E", label: "Ativo" },
  inativo: { fg: "var(--text-3)", label: "Inativo" },
  ferias: { fg: "#3B82F6", label: "Em férias" },
  afastado: { fg: "#A16207", label: "Afastado" },
};

export default async function ColaboradorPerfilPage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) notFound();

  const [tips, vts, hes, vacations, dependents, trainings] = await Promise.all([
    listTipsRecords(id),
    listTransportVouchers(id),
    listOvertimeRecords(id),
    listVacations(id, "employee"),
    listDependents(id),
    listRecordsForEmployee(id),
  ]);

  const fullName = `${employee.nome} ${employee.sobrenome}`.trim();
  const display = employee.nome_social || fullName;
  const color = avatarColor(fullName);
  const status = STATUS_RH_LABEL[employee.status_rh] ?? STATUS_RH_LABEL.ativo!;
  const tipoContratoLabel = employee.tipo_contrato
    ? TIPO_CONTRATO_LABEL[employee.tipo_contrato] ?? employee.tipo_contrato
    : null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <Link
        href="/pessoas/colaboradores"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "var(--text-3)",
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} /> Colaboradores
      </Link>

      {/* Header card */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 22,
          marginBottom: 22,
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 99,
            background: `color-mix(in srgb, ${color} 22%, transparent)`,
            color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials(fullName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: -0.4,
              color: "var(--text)",
            }}
          >
            {display}
          </div>
          <div
            style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}
          >
            {employee.funcao}
            {employee.departamento ? ` · ${employee.departamento}` : ""}
            {employee.employee_code ? ` · #${employee.employee_code}` : ""}
          </div>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 9px",
                borderRadius: 99,
                color: status.fg,
                background: `color-mix(in srgb, ${status.fg} 14%, transparent)`,
                border: `1px solid color-mix(in srgb, ${status.fg} 30%, transparent)`,
              }}
            >
              {status.label}
            </span>
            {tipoContratoLabel && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: 99,
                  color: "var(--text-2)",
                  background: "var(--bg-2, transparent)",
                  border: "1px solid var(--border)",
                }}
              >
                {tipoContratoLabel}
              </span>
            )}
            {employee.email && (
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>{employee.email}</span>
            )}
            {employee.telefone && (
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>{employee.telefone}</span>
            )}
          </div>
        </div>
        <ScoreRing score={employee.score} />
        <Link
          href={`/pessoas/colaboradores/${id}/editar`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--text-2)",
            fontSize: 12,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          <Pencil size={14} /> Editar cadastro
        </Link>
      </div>

      <Tabs defaultValue="dados-pessoais">
        <TabsList variant="line">
          <TabsTrigger value="dados-pessoais">
            <IdCard className="mr-1.5 h-3.5 w-3.5" />
            Dados Pessoais
          </TabsTrigger>
          <TabsTrigger value="gorjetas">
            <CreditCard className="mr-1.5 h-3.5 w-3.5" />
            Gorjetas ({tips.length})
          </TabsTrigger>
          <TabsTrigger value="vt">
            <CreditCard className="mr-1.5 h-3.5 w-3.5" />
            Vale Transporte ({vts.length})
          </TabsTrigger>
          <TabsTrigger value="he">
            <Clock className="mr-1.5 h-3.5 w-3.5" />
            Horas Extras ({hes.length})
          </TabsTrigger>
          <TabsTrigger value="ferias">
            <Plane className="mr-1.5 h-3.5 w-3.5" />
            Férias ({vacations.length})
          </TabsTrigger>
          <TabsTrigger value="treinamentos">
            <GraduationCap className="mr-1.5 h-3.5 w-3.5" />
            Treinamentos ({trainings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dados-pessoais">
          <div style={{ marginTop: 16 }}>
            <SectionCard title="Informações Pessoais">
              <dl style={FIELD_GRID}>
                <Field label="Nome completo" value={fullName} />
                <Field label="Nome social" value={employee.nome_social} />
                <Field label="CPF" value={employee.cpf} />
                <Field label="Data de nascimento" value={formatDate(employee.data_nascimento)} />
                <Field label="Sexo" value={employee.genero} />
                <Field label="Raça/Cor" value={employee.raca} />
                <Field label="Estado civil" value={employee.estado_civil} />
                <Field label="Escolaridade" value={employee.escolaridade} />
                <Field label="Nome da mãe" value={employee.nome_mae} />
                <Field label="Nome do pai" value={employee.nome_pai} />
                <Field
                  label="Naturalidade"
                  value={joinNonEmpty([employee.cidade_nascimento, employee.uf_nascimento])}
                />
                <Field label="País de nascimento" value={employee.pais_nascimento} />
                <Field label="Telefone" value={employee.telefone} />
                <Field label="Email" value={employee.email} />
              </dl>
            </SectionCard>

            <SectionCard title="Endereço">
              <dl style={FIELD_GRID}>
                <Field label="Logradouro" value={employee.rua} />
                <Field label="Número" value={employee.numero} />
                <Field label="Complemento" value={employee.complemento} />
                <Field label="Bairro" value={employee.bairro} />
                <Field label="CEP" value={employee.cep} />
                <Field label="Cidade" value={employee.cidade} />
                <Field label="UF" value={employee.estado} />
              </dl>
            </SectionCard>

            <SectionCard title="Documentos">
              <dl style={FIELD_GRID}>
                <Field label="RG" value={employee.rg} />
                <Field label="UF RG" value={employee.rg_uf} />
                <Field label="Órgão RG" value={employee.rg_orgao} />
                <Field label="PIS" value={employee.pis} />
                <Field label="CTPS" value={employee.ctps} />
                <Field label="Série CTPS" value={employee.ctps_serie} />
                <Field label="UF CTPS" value={employee.ctps_uf} />
                <Field label="Expedição CTPS" value={formatDate(employee.ctps_expedicao)} />
                <Field label="Título de eleitor" value={employee.titulo_eleitor} />
                <Field label="Zona eleitoral" value={employee.zona_eleitoral} />
                <Field label="Seção eleitoral" value={employee.secao_eleitoral} />
                <Field label="RNE" value={employee.rne} />
                <Field label="Órgão RNE" value={employee.rne_orgao} />
                <Field label="Expedição RNE" value={formatDate(employee.rne_expedicao)} />
                <Field label="Reservista" value={employee.reservista} />
              </dl>
            </SectionCard>

            <SectionCard title="Vínculo">
              <dl style={FIELD_GRID}>
                <Field label="Cargo / Função" value={employee.funcao} />
                <Field label="Departamento" value={employee.departamento} />
                <Field label="Tipo de contrato" value={tipoContratoLabel} />
                <Field label="Data de admissão" value={formatDate(employee.data_admissao)} />
                <Field label="Salário base" value={formatCurrency(employee.salario_base)} />
                <Field label="Jornada" value={employee.jornada} />
                <Field label="Status RH" value={status.label} />
                <Field label="Código funcionário" value={employee.employee_code} />
                <Field label="Código eSocial" value={employee.esocial_code} />
                <Field label="Contato emergência (nome)" value={employee.contato_emergencia_nome} />
                <Field label="Contato emergência (telefone)" value={employee.contato_emergencia_tel} />
              </dl>
            </SectionCard>

            <SectionCard title="Dependentes">
              {dependents.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
                  Nenhum dependente cadastrado.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {dependents.map((dep) => (
                    <div
                      key={dep.id}
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: 14,
                      }}
                    >
                      <dl style={FIELD_GRID}>
                        <Field label="Nome" value={dep.nome} />
                        <Field label="Nascimento" value={formatDate(dep.data_nascimento)} />
                        <Field label="CPF" value={dep.cpf} />
                        <Field label="Parentesco" value={dep.parentesco} />
                      </dl>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="gorjetas">
          <GorjetasTab
            employeeId={id}
            unitId={employee.unit_id}
            records={tips}
          />
        </TabsContent>
        <TabsContent value="vt">
          <VtTab
            employeeId={id}
            unitId={employee.unit_id}
            records={vts}
          />
        </TabsContent>
        <TabsContent value="he">
          <HorasExtrasTab
            employeeId={id}
            unitId={employee.unit_id}
            records={hes}
            currentUserId={user.id}
          />
        </TabsContent>
        <TabsContent value="ferias">
          <FeriasTab
            employeeId={id}
            unitId={employee.unit_id}
            records={vacations}
            currentUserId={user.id}
          />
        </TabsContent>
        <TabsContent value="treinamentos">
          <TreinamentosTab records={trainings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
