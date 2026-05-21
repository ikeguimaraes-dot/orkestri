"use client";

import { useState, useTransition } from "react";
import { updateUnitGeofence } from "./actions";
import { toast } from "sonner";

type UnitRow = {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_m: number | null;
};

export function UnidadesClient({ units }: { units: UnitRow[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {units.map((u) => (
        <UnitCard key={u.id} unit={u} />
      ))}
    </div>
  );
}

function UnitCard({ unit }: { unit: UnitRow }) {
  const [lat, setLat] = useState(unit.latitude?.toString() ?? "");
  const [lon, setLon] = useState(unit.longitude?.toString() ?? "");
  const [radius, setRadius] = useState((unit.geofence_radius_m ?? 200).toString());
  const [isPending, startTransition] = useTransition();

  const hasGeo = unit.latitude != null && unit.longitude != null;

  function handleSave() {
    const latNum = lat.trim() === "" ? null : parseFloat(lat);
    const lonNum = lon.trim() === "" ? null : parseFloat(lon);
    const radiusNum = parseInt(radius, 10) || 200;

    if (
      (latNum != null && (isNaN(latNum) || latNum < -90 || latNum > 90)) ||
      (lonNum != null && (isNaN(lonNum) || lonNum < -180 || lonNum > 180))
    ) {
      toast.error("Coordenadas inválidas");
      return;
    }

    startTransition(async () => {
      const result = await updateUnitGeofence({
        unitId: unit.id,
        latitude: latNum,
        longitude: lonNum,
        geofenceRadiusM: radiusNum,
      });
      if (result.ok) {
        toast.success("Geofencing salvo com sucesso");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleClear() {
    setLat("");
    setLon("");
    setRadius("200");
    startTransition(async () => {
      const result = await updateUnitGeofence({
        unitId: unit.id,
        latitude: null,
        longitude: null,
        geofenceRadiusM: 200,
      });
      if (result.ok) {
        toast.success("Geofencing removido — aprovação será manual");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "20px 22px",
      }}
    >
      {/* Header da unidade */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text)",
            }}
          >
            {unit.name}
          </div>
          {unit.address && (
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
              {unit.address}
            </div>
          )}
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 700,
            background: hasGeo ? "rgba(34,197,94,0.12)" : "rgba(107,114,128,0.12)",
            color: hasGeo ? "#16A34A" : "#6B7280",
          }}
        >
          {hasGeo ? "● Geofence ativo" : "○ Sem geofence"}
        </div>
      </div>

      {/* Campos */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <Field
          label="Latitude"
          placeholder="-23.5505"
          value={lat}
          onChange={setLat}
          hint="Ex: -23.5505 (São Paulo)"
        />
        <Field
          label="Longitude"
          placeholder="-46.6333"
          value={lon}
          onChange={setLon}
          hint="Ex: -46.6333 (São Paulo)"
        />
        <Field
          label="Raio (metros)"
          placeholder="200"
          value={radius}
          onChange={setRadius}
          hint="Distância máxima permitida"
        />
      </div>

      {/* Dica de como obter coords */}
      <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
        Dica: abra{" "}
        <span style={{ fontFamily: "monospace", fontSize: 11 }}>maps.google.com</span>, clique
        com o botão direito no endereço da unidade e copie as coordenadas.
      </p>

      {/* Ações */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleSave}
          disabled={isPending}
          style={{
            padding: "8px 18px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 8,
            border: "none",
            background: "var(--brand, #1d4ed8)",
            color: "#fff",
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? "Salvando…" : "Salvar geofence"}
        </button>
        {hasGeo && (
          <button
            onClick={handleClear}
            disabled={isPending}
            style={{
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-3)",
              cursor: isPending ? "not-allowed" : "pointer",
            }}
          >
            Remover
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  hint,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  hint: string;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "var(--text-3)",
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      <input
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          height: 36,
          padding: "0 10px",
          fontSize: 13,
          background: "var(--background)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          boxSizing: "border-box",
        }}
      />
      <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 3 }}>{hint}</div>
    </div>
  );
}
