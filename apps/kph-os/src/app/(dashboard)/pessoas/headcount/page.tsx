import { Suspense } from "react";
import Link from "next/link";
import { requireRole } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import { getVacationAlerts } from "@/lib/pessoas/actions";
import {
  getHeadcountStats,
  getDistribuicaoMarcas,
  getDistribuicaoFuncoes,
  getDistribuicaoDepartamentos,
  getMovimentacoesRecentes,
  getVagasAbertas,
  getHeadcountBrands,
  type Period,
} from "@/lib/pessoas/headcount-actions";
import { HeadcountClient } from "./headcount-client";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ period?: string; brandId?: string }>;
};

export default async function HeadcountPage({ searchParams }: Props) {
  await requireRole(["founder", "cfo", "gm", "pessoas"]);

  const sp = await searchParams;
  const period: Period =
    sp.period === "trimestre" || sp.period === "ano" ? sp.period : "mes";
  const brandId = sp.brandId ?? "";

  const filters = { period, brandId: brandId || undefined };

  const [stats, marcas, funcoes, departamentos, movimentacoes, vagas, brands] =
    await Promise.all([
      getHeadcountStats(filters),
      getDistribuicaoMarcas(filters),
      getDistribuicaoFuncoes(filters),
      getDistribuicaoDepartamentos(filters),
      getMovimentacoesRecentes(filters),
      getVagasAbertas({ brandId: brandId || undefined }),
      getHeadcountBrands(),
    ]);

  return (
    <>
      <Suspense fallback={null}>
        <VacationAlertBanner />
      </Suspense>
      <HeadcountClient
        period={period}
        brandId={brandId}
        brands={brands}
        stats={stats}
        marcas={marcas}
        funcoes={funcoes}
        departamentos={departamentos}
        movimentacoes={movimentacoes}
        vagas={vagas}
      />
    </>
  );
}

async function VacationAlertBanner() {
  const unit = await getCurrentUnit();
  if (!unit) return null;
  const alerts = await getVacationAlerts(unit.id);
  const { vencidas, vencendo30, vencendo60 } = alerts;
  const total = vencidas.length + vencendo30.length + vencendo60.length;
  if (total === 0) return null;

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto 0", paddingBottom: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        {vencidas.length > 0 && (
          <Link href="/pessoas/ferias" style={{ textDecoration: "none", flex: "1 1 220px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 10, cursor: "pointer" }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#B91C1C" }}>{vencidas.length} férias vencida{vencidas.length > 1 ? "s" : ""}</div>
                <div style={{ fontSize: 11, color: "#B91C1C" }}>Risco trabalhista — agendar agora</div>
              </div>
            </div>
          </Link>
        )}
        {(vencendo30.length > 0 || vencendo60.length > 0) && (
          <Link href="/pessoas/ferias" style={{ textDecoration: "none", flex: "1 1 220px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.40)", borderRadius: 10, cursor: "pointer" }}>
              <span style={{ fontSize: 20 }}>⏰</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#A16207" }}>{vencendo30.length + vencendo60.length} férias vencendo em 60 dias</div>
                <div style={{ fontSize: 11, color: "#A16207" }}>Ver detalhes em Férias</div>
              </div>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
