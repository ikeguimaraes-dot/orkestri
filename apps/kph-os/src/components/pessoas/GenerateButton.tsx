"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@kph/ui/button";
import { generatePayslipsCurrentUnit } from "@/lib/pessoas/actions";

export function GenerateButton({
  mes,
  ano,
}: {
  mes: number;
  ano: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    if (
      !window.confirm(
        `Gerar holerites de ${formatMes(mes)}/${ano} pra todos os colaboradores ativos?\n\nRegera (UPSERT) holerites em rascunho — aprovados/pagos NÃO são tocados pelo unique key.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await generatePayslipsCurrentUnit(mes, ano);
      if (!res.ok) {
        alert(`Falha: ${res.error}`);
        return;
      }
      const failureMsg =
        res.data.failures.length > 0
          ? `\n\nFalhas (${res.data.failures.length}):\n${res.data.failures.join("\n")}`
          : "";
      alert(`${res.data.count} holerite(s) gerado(s).${failureMsg}`);
      router.refresh();
    });
  };

  return (
    <Button onClick={onClick} disabled={isPending}>
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="mr-2 h-4 w-4" />
      )}
      Gerar holerites
    </Button>
  );
}

function formatMes(m: number): string {
  const meses = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  return meses[m - 1] ?? "";
}
