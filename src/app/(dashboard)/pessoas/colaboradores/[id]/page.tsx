import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarRange,
  Clock,
  CreditCard,
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
  listOvertimeRecords,
  listTipsRecords,
  listTransportVouchers,
  listVacations,
} from "@/lib/pessoas/actions";
import { requireUser } from "@/lib/auth/server";
import { avatarColor, initials } from "@/lib/format";
import { GorjetasTab } from "@/components/pessoas/profile-tabs/GorjetasTab";
import { VtTab } from "@/components/pessoas/profile-tabs/VtTab";
import { HorasExtrasTab } from "@/components/pessoas/profile-tabs/HorasExtrasTab";
import { FeriasTab } from "@/components/pessoas/profile-tabs/FeriasTab";

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

  const [tips, vts, hes, vacations] = await Promise.all([
    listTipsRecords(id),
    listTransportVouchers(id),
    listOvertimeRecords(id),
    listVacations(id, "employee"),
  ]);

  const fullName = `${employee.nome} ${employee.sobrenome}`.trim();
  const display = employee.nome_social || fullName;
  const color = avatarColor(fullName);
  const status = STATUS_RH_LABEL[employee.status_rh] ?? STATUS_RH_LABEL.ativo!;

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
              fontSize: 11,
              marginTop: 6,
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              color: "var(--text-3)",
            }}
          >
            <span>
              Status:{" "}
              <span style={{ color: status.fg, fontWeight: 600 }}>
                {status.label}
              </span>
            </span>
            <span>
              Score:{" "}
              <span style={{ color: "var(--brand)", fontWeight: 700 }}>
                {employee.score}
              </span>
            </span>
            {employee.email && <span>{employee.email}</span>}
            {employee.telefone && <span>{employee.telefone}</span>}
          </div>
        </div>
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

      <Tabs defaultValue="gorjetas">
        <TabsList variant="line">
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
        </TabsList>

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
      </Tabs>
    </div>
  );
}
