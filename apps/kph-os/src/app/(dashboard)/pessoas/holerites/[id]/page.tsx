import { notFound } from "next/navigation";

import { PayslipDetail } from "@/components/pessoas/PayslipDetail";
import { getPayslipFull } from "@/lib/pessoas/actions";
import { isFounder, requireUser } from "@kph/auth/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function PayslipDetailPage({
  params,
}: {
  params: Params;
}) {
  const user = await requireUser();
  const { id } = await params;

  const full = await getPayslipFull(id);
  if (!full) notFound();

  return (
    <PayslipDetail
      payslip={full.payslip}
      isFounder={isFounder(user)}
      employeeExtra={full.employeeExtra}
      unit={full.unit}
      brand={full.brand}
    />
  );
}
