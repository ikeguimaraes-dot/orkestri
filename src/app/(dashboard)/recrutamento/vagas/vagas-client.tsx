"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  ExternalLink,
  Loader2,
  Plus,
  Power,
  Search,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createJobOpening,
  toggleJobOpeningActive,
} from "@/app/(dashboard)/recrutamento/actions";
import { formatDateBR } from "@/lib/format";
import type { BrandOption } from "@/lib/eventos/types";
import type { JobOpeningWithCounts } from "@/lib/recrutamento/types";

export function VagasClient({
  vagas,
  brands,
}: {
  vagas: JobOpeningWithCounts[];
  brands: BrandOption[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "all",
  );
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vagas.filter((v) => {
      if (statusFilter === "active" && !v.is_active) return false;
      if (statusFilter === "inactive" && v.is_active) return false;
      if (q && !v.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [vagas, search, statusFilter]);

  return (
    <>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", minWidth: 240, flex: 1 }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-3)",
              pointerEvents: "none",
            }}
          />
          <Input
            placeholder="Buscar por título…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) =>
            setStatusFilter((v ?? "all") as typeof statusFilter)
          }
        >
          <SelectTrigger style={{ width: 160 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="inactive">Inativas</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={14} className="mr-1" /> Nova vaga
        </Button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "var(--text-3)",
            fontSize: 13,
            background: "var(--surface)",
            border: "1px dashed var(--border)",
            borderRadius: 8,
          }}
        >
          <Briefcase
            size={32}
            style={{ margin: "0 auto 12px", opacity: 0.4, display: "block" }}
          />
          Nenhuma vaga encontrada.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((v) => (
            <VagaCard key={v.id} vaga={v} />
          ))}
        </div>
      )}

      <NovaVagaDialog
        open={showForm}
        onOpenChange={setShowForm}
        brands={brands}
      />
    </>
  );
}

function VagaCard({ vaga }: { vaga: JobOpeningWithCounts }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      await toggleJobOpeningActive(vaga.id);
      router.refresh();
    });
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        opacity: vaga.is_active ? 1 : 0.55,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {vaga.brand_color && (
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: 99,
              background: vaga.brand_color,
              flexShrink: 0,
            }}
          />
        )}
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>
          {vaga.brand_name ?? "—"}
        </span>
        {!vaga.is_active && (
          <span
            style={{
              marginLeft: "auto",
              padding: "2px 8px",
              borderRadius: 999,
              background: "var(--surface-2)",
              color: "var(--text-3)",
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            Inativa
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: "var(--text)",
          letterSpacing: -0.2,
        }}
      >
        {vaga.title}
      </div>
      {vaga.description && (
        <div
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {vaga.description}
        </div>
      )}
      <div
        style={{
          display: "flex",
          gap: 12,
          fontSize: 11,
          color: "var(--text-3)",
        }}
      >
        <span>
          <Users size={11} style={{ verticalAlign: "middle", marginRight: 3 }} />
          {vaga.total_candidatos} candidato
          {vaga.total_candidatos === 1 ? "" : "s"}
        </span>
        {vaga.pendentes > 0 && (
          <span style={{ color: "var(--brand)", fontWeight: 600 }}>
            {vaga.pendentes} pendente{vaga.pendentes === 1 ? "" : "s"}
          </span>
        )}
        <span style={{ marginLeft: "auto" }}>
          {formatDateBR(vaga.created_at)}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 6,
          paddingTop: 8,
          borderTop: "1px solid var(--border)",
        }}
      >
        <Link
          href={`/recrutamento/vagas/${vaga.id}`}
          style={{ ...BTN_GHOST, color: "var(--brand)" }}
        >
          <ExternalLink size={12} /> Gerenciar
        </Link>
        <button
          onClick={handleToggle}
          disabled={pending}
          style={{
            ...BTN_GHOST,
            color: vaga.is_active ? "var(--text-2)" : "var(--brand)",
          }}
        >
          <Power size={12} />
          {vaga.is_active ? "Desativar" : "Ativar"}
        </button>
      </div>
    </div>
  );
}

function NovaVagaDialog({
  open,
  onOpenChange,
  brands,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  brands: BrandOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [brandId, setBrandId] = useState<string>(brands[0]?.id ?? "");

  const reset = () => {
    setTitle("");
    setDescription("");
    setBrandId(brands[0]?.id ?? "");
    setError(null);
  };

  const handleSubmit = () => {
    if (!brandId) {
      setError("Selecione uma marca.");
      return;
    }
    if (!title.trim()) {
      setError("Título obrigatório.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await createJobOpening({
        brand_id: brandId,
        title: title.trim(),
        description: description.trim() || null,
        is_active: true,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      reset();
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent style={{ maxWidth: 520 }}>
        <DialogHeader>
          <DialogTitle>Nova vaga</DialogTitle>
        </DialogHeader>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            marginTop: 8,
          }}
        >
          <Field label="Marca *">
            <Select value={brandId} onValueChange={(v) => setBrandId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Título *">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Garçom"
            />
          </Field>
          <Field label="Descrição">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Resumo da vaga / requisitos…"
            />
          </Field>
          {error && (
            <div
              style={{
                padding: "8px 12px",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.4)",
                borderRadius: 6,
                color: "var(--destructive)",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              marginTop: 4,
            }}
          >
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</label>
      {children}
    </div>
  );
}

const BTN_GHOST: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "5px 10px",
  fontSize: 11,
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
  textDecoration: "none",
};
