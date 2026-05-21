"use client";

// GestaoClient — Client Component wrapper para a tela de Gestão de Ponto.
//
// Responsabilidades:
//   1) Auto-refresh a cada 30s quando a data exibida é hoje (isHoje).
//   2) Exibe "Atualizado às HH:MM:SS" no canto superior direito.
//
// Por que não usar revalidatePath/route handler:
//   Server Components não têm acesso ao timer do browser.
//   router.refresh() re-executa o fetch server-side sem re-montar a árvore,
//   mantendo o estado client (ex.: scroll position).

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export function GestaoClient({
  children,
  isHoje,
}: {
  children: React.ReactNode;
  isHoje: boolean;
}) {
  const router = useRouter();
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    router.refresh();
    setLastRefreshed(new Date());
  }, [router]);

  // Registra hora do mount como "última atualização" inicial
  useEffect(() => {
    setLastRefreshed(new Date());
  }, []);

  // Auto-refresh a cada 30s somente para o dia de hoje
  useEffect(() => {
    if (!isHoje) return;
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [isHoje, refresh]);

  return (
    <div>
      {/* Barra de status do refresh */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
          marginBottom: 12,
          minHeight: 20,
        }}
      >
        {isHoje && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            {/* Dot pulsante */}
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#22C55E",
                display: "inline-block",
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
            Ao vivo · atualiza 30s
            {lastRefreshed && (
              <>
                {" · "}
                {lastRefreshed.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </>
            )}
          </span>
        )}

        {/* Botão de refresh manual */}
        {isHoje && (
          <button
            onClick={refresh}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-3)",
              cursor: "pointer",
            }}
          >
            ↻ Atualizar
          </button>
        )}
      </div>

      {children}
    </div>
  );
}
