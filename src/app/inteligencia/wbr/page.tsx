import { requireUser } from "@kph/auth/server";
import { currentWeekIso, loadWbr } from "@/lib/inteligencia/wbr";
import { WbrClient } from "./wbr-client";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ ref?: string }>;
};

export default async function WbrPage({ searchParams }: Props) {
  await requireUser();
  const sp = await searchParams;
  const ref = sp?.ref ?? currentWeekIso();
  const data = await loadWbr(ref);
  return <WbrClient refDate={ref} payload={data} />;
}
