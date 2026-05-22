import { requireRole } from "@kph/auth/server";
import {
  listDocuments,
  getDocumentStats,
  listEmployeesForSelect,
} from "@/lib/pessoas/document-actions";
import { getHeadcountBrands } from "@/lib/pessoas/headcount-actions";
import { DocumentosClient } from "./documentos-client";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ brandId?: string }>;
};

export default async function DocumentosPage({ searchParams }: Props) {
  await requireRole(["founder", "cfo", "gm", "pessoas"]);

  const sp = await searchParams;
  const brandId = sp.brandId ?? "";

  const [docs, stats, employees, brands] = await Promise.all([
    listDocuments({ brandId: brandId || undefined }),
    getDocumentStats(brandId || undefined),
    listEmployeesForSelect(brandId || undefined),
    getHeadcountBrands(),
  ]);

  return (
    <DocumentosClient
      brandId={brandId}
      brands={brands}
      docs={docs}
      employees={employees}
      stats={stats}
    />
  );
}
