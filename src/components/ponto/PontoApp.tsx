"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Camera,
  CheckCircle2,
  Clock,
  Coffee,
  LogIn,
  LogOut as LogOutIcon,
  Play,
  Sparkles,
} from "lucide-react";

import { CameraCapture } from "@/components/ponto/CameraCapture";
import { useDeviceInfo, useGeolocation } from "@/components/ponto/useGeolocation";
import {
  PUNCH_BUTTON_LABEL,
  PUNCH_COLOR,
  PUNCH_LABEL,
  formatHHMM,
  formatMinutesAsHours,
  calcWorkHours,
  nextPunchTipo,
} from "@/lib/pessoas/punch";
import { avatarColor, initials } from "@/lib/format";
import type { PunchTipo, TimeClockPunch } from "@/types/pessoas";

const ICONS: Record<PunchTipo, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  entrada: LogIn,
  intervalo_inicio: Coffee,
  intervalo_fim: Play,
  saida: LogOutIcon,
};

type SuccessState = { punch: TimeClockPunch; at: number } | null;

export function PontoApp({
  employeeId,
  employeeName,
  employeeFuncao,
  initialPunches,
}: {
  employeeId: string;
  employeeName: string;
  employeeFuncao: string;
  initialPunches: TimeClockPunch[];
}) {
  const [pending, startTransition] = useTransition();
  const [punches, setPunches] = useState<TimeClockPunch[]>(initialPunches);
  const [now, setNow] = useState<Date>(() => new Date());
  const [showCamera, setShowCamera] = useState(false);
  const [success, setSuccess] = useState<SuccessState>(null);
  const [error, setError] = useState<string | null>(null);

  const geo = useGeolocation();
  const ua = useDeviceInfo();

  // Relógio em tempo real (1 tick/s)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-dismiss do banner de sucesso
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const next = useMemo(() => nextPunchTipo(punches), [punches]);
  const totals = useMemo(() => calcWorkHours(punches), [punches]);

  const Icon = next ? ICONS[next] : Sparkles;
  const color = next ? PUNCH_COLOR[next] : "var(--brand)";
  const buttonLabel = next ? PUNCH_BUTTON_LABEL[next] : "Jornada concluída";

  const handlePress = () => {
    if (!next || pending) return;
    setError(null);
    setShowCamera(true);
  };

  const handleCaptureDone = (photoBase64: string | null) => {
    setShowCamera(false);
    if (!next) return;

    startTransition(async () => {
      // Pede geo em paralelo (não-bloqueante)
      const geoState = await geo.request();

      // Vibração háptica (mobile)
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(80);
        } catch {
          /* ignore */
        }
      }

      const deviceInfo = JSON.stringify({
        ua: ua ?? null,
        photoTaken: photoBase64 !== null, // foto capturada mas NÃO armazenada (storage v2)
        geoStatus: geoState.status,
      });

      const lat = geoState.status === "ok" ? geoState.lat : null;
      const lng = geoState.status === "ok" ? geoState.lng : null;

      // POST via fetch em vez de Server Action — em PWA standalone iOS,
      // Server Actions + revalidatePath têm race condition que perde o
      // cookie de sessão Supabase, fazendo o user ser jogado pra /login.
      // Route handler /api/ponto/punch evita isso.
      let res: Response;
      try {
        res = await fetch("/api/ponto/punch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            employeeId,
            tipo: next,
            latitude: lat,
            longitude: lng,
            deviceInfo,
          }),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha de rede");
        return;
      }

      if (!res.ok) {
        if (res.status === 401) {
          setError(
            "Sua sessão expirou. Toque pra recarregar e fazer login novamente.",
          );
          return;
        }
        const txt = await res.text().catch(() => "");
        try {
          const j = JSON.parse(txt) as { error?: string };
          setError(j.error ?? `Erro ${res.status}`);
        } catch {
          setError(txt || `Erro ${res.status}`);
        }
        return;
      }

      const json = (await res.json()) as { ok: true; data: TimeClockPunch };
      // Optimistic update — sem router.refresh() pra não invalidar a sessão
      // no mobile PWA. Próximo SSR natural (próxima navegação) sincroniza.
      setPunches((prev) => [...prev, json.data]);
      setSuccess({ punch: json.data, at: Date.now() });
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <Header employeeName={employeeName} employeeFuncao={employeeFuncao} now={now} />

      {success && <SuccessBanner punch={success.punch} />}
      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

      <PunchButton
        Icon={Icon}
        label={buttonLabel}
        color={color}
        disabled={!next || pending}
        loading={pending}
        onClick={handlePress}
      />

      <Totals
        worked={totals.worked_minutes}
        breakMin={totals.break_minutes}
      />

      <Timeline punches={punches} />

      <SignOutFooter />

      {showCamera && (
        <CameraCapture
          onClose={() => setShowCamera(false)}
          onCapture={handleCaptureDone}
        />
      )}
    </div>
  );
}

// ── Subcomponentes ─────────────────────────────────────────────

function Header({
  employeeName,
  employeeFuncao,
  now,
}: {
  employeeName: string;
  employeeFuncao: string;
  now: Date;
}) {
  const color = avatarColor(employeeName);
  const time = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const date = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        marginTop: 12,
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: 2,
          fontWeight: 700,
          color: "var(--brand)",
          textTransform: "uppercase",
        }}
      >
        KPH · Ponto
      </div>
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
        }}
      >
        {initials(employeeName)}
      </div>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: "var(--font-playfair, var(--font-geist-sans))",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text)",
            letterSpacing: -0.4,
            lineHeight: 1.1,
          }}
        >
          {employeeName}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
          {employeeFuncao}
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 4 }}>
        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: "var(--text)",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: -1,
            lineHeight: 1,
          }}
        >
          {time}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            marginTop: 4,
            textTransform: "capitalize",
          }}
        >
          {date}
        </div>
      </div>
    </div>
  );
}

function PunchButton({
  Icon,
  label,
  color,
  disabled,
  loading,
  onClick,
}: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  color: string;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        position: "relative",
        width: "100%",
        minHeight: 140,
        background: disabled ? "var(--surface-2)" : color,
        color: disabled ? "var(--text-3)" : "white",
        border: "none",
        borderRadius: 18,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        boxShadow: disabled ? "none" : `0 8px 20px -8px ${color}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        transition: "all 0.2s ease",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 99,
          background: "rgba(255,255,255,0.16)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {loading ? (
          <Camera size={22} strokeWidth={2.4} />
        ) : (
          <Icon size={22} strokeWidth={2.4} />
        )}
      </div>
      <span
        style={{
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: -0.2,
        }}
      >
        {loading ? "Registrando..." : label}
      </span>
    </button>
  );
}

function Totals({ worked, breakMin }: { worked: number; breakMin: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
      }}
    >
      <Stat label="Trabalhado" value={formatMinutesAsHours(worked)} />
      <Stat label="Intervalo" value={formatMinutesAsHours(breakMin)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span
        style={{
          fontSize: 9,
          letterSpacing: 1.4,
          fontWeight: 700,
          color: "var(--text-3)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "var(--text)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: -0.5,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Timeline({ punches }: { punches: TimeClockPunch[] }) {
  const sorted = [...punches].sort(
    (a, b) =>
      new Date(b.timestamp_punch).getTime() - new Date(a.timestamp_punch).getTime(),
  );
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: 1.4,
          fontWeight: 700,
          color: "var(--text-3)",
          textTransform: "uppercase",
        }}
      >
        Pontos de hoje
      </div>
      {sorted.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-3)", padding: "8px 0" }}>
          Nenhum ponto registrado.
        </div>
      ) : (
        sorted.map((p) => {
          const tipo = p.tipo as PunchTipo;
          const Icon = ICONS[tipo] ?? Clock;
          const c = PUNCH_COLOR[tipo] ?? "var(--text-3)";
          const status =
            p.aprovado === true ? "Aprovado" : p.aprovado === false ? "Rejeitado" : "Pendente";
          const statusColor =
            p.aprovado === true
              ? "#22C55E"
              : p.aprovado === false
                ? "var(--destructive)"
                : "var(--text-3)";
          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 99,
                  background: `color-mix(in srgb, ${c} 18%, transparent)`,
                  color: c,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                  {PUNCH_LABEL[tipo] ?? tipo}
                </div>
                <div style={{ fontSize: 10, color: statusColor, fontWeight: 600 }}>
                  {status}
                </div>
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--text)",
                  letterSpacing: -0.2,
                }}
              >
                {formatHHMM(p.timestamp_punch)}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function SuccessBanner({ punch }: { punch: TimeClockPunch }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "rgba(34,197,94,0.16)",
        border: "1px solid rgba(34,197,94,0.4)",
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        gap: 10,
        color: "#22C55E",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <CheckCircle2 size={18} />
      <span>
        {PUNCH_LABEL[punch.tipo as PunchTipo] ?? punch.tipo} registrado às{" "}
        <strong style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatHHMM(punch.timestamp_punch)}
        </strong>
      </span>
    </div>
  );
}

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  const isAuth = message.toLowerCase().includes("sessão");
  const handleClick = () => {
    if (isAuth && typeof window !== "undefined") {
      window.location.reload();
    } else {
      onClose();
    }
  };
  return (
    <div
      onClick={handleClick}
      style={{
        padding: "12px 14px",
        background: "rgba(239,68,68,0.12)",
        border: "1px solid rgba(239,68,68,0.4)",
        borderRadius: 10,
        color: "var(--destructive)",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      <strong>Erro:</strong> {message}
      <span style={{ float: "right", opacity: 0.6 }}>{isAuth ? "↻" : "×"}</span>
    </div>
  );
}

function SignOutFooter() {
  return (
    <Link
      href="/auth/sign-out"
      style={{
        textAlign: "center",
        padding: "10px 12px",
        fontSize: 11,
        color: "var(--text-3)",
        textDecoration: "none",
      }}
    >
      Sair
    </Link>
  );
}
