"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Botão "Gerar holerites" — chama a Server Action que itera todos os
 * colaboradores ativos da unit. Server Action lê a unit do cookie via
 * getCurrentUnit, então passamos só mes/ano daqui.
 */
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
      // A unit vem do cookie no servidor — precisamos chamar via wrapper que
      // resolve a unit. A API expõe generatePayslipsForUnit(unitId, mes, ano)
      // — então precisamos buscar a unit antes. Mais simples: outra action
      // wrapper que pega cookie. Por v1, deixamos o usuário trocar de unit
      // pelo seletor da sidebar e chamamos uma rota dedicada.
      const res = await fetch("/api/holerites/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mes, ano }),
      });
      const json = (await res.json()) as
        | { ok: true; count: number; failures: string[] }
        | { ok: false; error: string };
      if (!json.ok) {
        alert(`Falha: ${json.error}`);
        return;
      }
      const failureMsg =
        json.failures.length > 0
          ? `\n\nFalhas (${json.failures.length}):\n${json.failures.join("\n")}`
          : "";
      alert(`${json.count} holerite(s) gerado(s).${failureMsg}`);
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
