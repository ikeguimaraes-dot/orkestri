import { notFound } from "next/navigation";

import { PayslipDetail } from "@/components/pessoas/PayslipDetail";
import { getPayslip } from "@/lib/pessoas/actions";
import { isFounder, requireUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function PayslipDetailPage({
  params,
}: {
  params: Params;
}) {
  const user = await requireUser();
  const { id } = await params;

  const payslip = await getPayslip(id);
  if (!payslip) notFound();

  return <PayslipDetail payslip={payslip} isFounder={isFounder(user)} />;
}
