// Barra de score (verde/amarelo/vermelho) — usada na tabela de score
// e como badge mini ao lado do nome do colaborador.

import { SCORE_COLORS, scoreColor } from "@/lib/pessoas/score";

export function ScoreBar({
  score,
  warnings = 0,
  absences = 0,
  showNumber = true,
}: {
  score: number;
  warnings?: number;
  absences?: number;
  showNumber?: boolean;
}) {
  const zone = scoreColor(score);
  const c = SCORE_COLORS[zone];
  const tooltip = `Score ${score}/100 · ${warnings} adv · ${absences} faltas`;
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 120 }}
      title={tooltip}
    >
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 99,
          background: "var(--muted)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: "100%",
            background: c.fg,
            transition: "width 0.3s ease, background 0.3s ease",
          }}
        />
      </div>
      {showNumber && (
        <span
          style={{
            fontSize: 11,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 700,
            color: c.fg,
            minWidth: 28,
            textAlign: "right",
          }}
        >
          {score}
        </span>
      )}
    </div>
  );
}

/** Dot mini — só cor, sem número (usado em tabela densa). */
export function ScoreDot({
  score,
  warnings = 0,
  absences = 0,
}: {
  score: number;
  warnings?: number;
  absences?: number;
}) {
  const zone = scoreColor(score);
  const c = SCORE_COLORS[zone];
  return (
    <span
      title={`Score ${score}/100 · ${warnings} adv · ${absences} faltas`}
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: 99,
        background: c.fg,
        flexShrink: 0,
      }}
    />
  );
}
