"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Mail, KeyRound } from "lucide-react";
import { Button } from "@kph/ui/button";
import { Input } from "@kph/ui/input";
import { Label } from "@kph/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kph/ui/tabs";
import { getBrowserClient } from "@kph/db/supabase/client";

export default function LoginPage() {
  // Next 16 exige Suspense em volta de useSearchParams pra static prerender.
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const supabase = getBrowserClient();
  const supabaseConfigured = !!supabase;

  // Colaborador chegando em /ponto via celular → default = senha (magic link
  // dá fricção em mobile: abre mailer, login fora do contexto, pode falhar).
  const isPontoFlow = next.startsWith("/ponto");
  const defaultTab = isPontoFlow ? "password" : "magic";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError("Supabase não configurado. Cole NEXT_PUBLIC_SUPABASE_URL e ANON_KEY em .env.local.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setMessage(`Link de acesso enviado para ${email}. Confere a caixa de entrada.`);
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError("Supabase não configurado.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    window.location.href = next;
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        color: "var(--text)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 32,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>
            KPH <span style={{ color: "var(--brand)" }}>OS</span>
          </div>
          <p
            style={{
              marginTop: 6,
              color: "var(--text-3)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.2,
              textTransform: "uppercase",
            }}
          >
            Operações · Acesso restrito
          </p>
        </div>

        {!supabaseConfigured && (
          <div
            style={{
              marginBottom: 20,
              padding: "10px 12px",
              background: "var(--accent)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 11,
              color: "var(--accent-foreground)",
              lineHeight: 1.5,
            }}
          >
            Supabase ainda não configurado. Crie o projeto kph-os-dev e cole as
            envs em .env.local.
          </div>
        )}

        {isPontoFlow && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 12px",
              background: "var(--brand-soft)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 11,
              color: "var(--text-2)",
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: "var(--brand)" }}>Registro de ponto:</strong>{" "}
            entre com email e senha pelo Safari. Não instale como app no
            homescreen — a sessão pode falhar.
          </div>
        )}

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="magic" className="flex-1">
              <Mail className="mr-2 h-4 w-4" />
              Magic link
            </TabsTrigger>
            <TabsTrigger value="password" className="flex-1">
              <KeyRound className="mr-2 h-4 w-4" />
              Senha
            </TabsTrigger>
          </TabsList>

          <TabsContent value="magic">
            <form onSubmit={handleMagic} className="flex flex-col gap-3 mt-4">
              <div>
                <Label htmlFor="email-magic">Email</Label>
                <Input
                  id="email-magic"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ike@grupokph.com"
                  className="mt-1"
                  autoComplete="email"
                />
              </div>
              <Button type="submit" disabled={loading || !email} className="mt-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar link"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="password">
            <form onSubmit={handlePassword} className="flex flex-col gap-3 mt-4">
              <div>
                <Label htmlFor="email-pwd">Email</Label>
                <Input
                  id="email-pwd"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                  autoComplete="email"
                />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" disabled={loading || !email || !password} className="mt-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        {message && (
          <p
            style={{
              marginTop: 16,
              fontSize: 12,
              color: "var(--brand)",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            {message}
          </p>
        )}
        {error && (
          <p
            style={{
              marginTop: 16,
              fontSize: 12,
              color: "var(--destructive)",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            {error}
          </p>
        )}

        <p
          style={{
            marginTop: 28,
            fontSize: 10,
            color: "var(--text-3)",
            textAlign: "center",
            letterSpacing: 0.4,
          }}
        >
          2FA TOTP chega na próxima onda. Por enquanto, magic link já sobe a barra.
        </p>
      </div>
    </div>
  );
}
