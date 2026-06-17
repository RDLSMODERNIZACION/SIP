"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/context/AuthContext";
import { Button } from "@/src/components/ui/Button";
import { Field, inputClass } from "@/src/components/ui/Field";

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [email, setEmail] = useState("admin@sip.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft md:grid-cols-[1.05fr_0.95fr]">
        <div className="bg-slate-950 p-8 text-white md:p-10">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">SIP Instrumentación</div>
          <h1 className="mt-6 text-3xl font-bold leading-tight">Sistema de certificados digitales</h1>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            Emisión, aprobación, control de vencimientos, trazabilidad de patrones y validación pública por QR.
          </p>
          <div className="mt-10 grid gap-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Administrador: gestión completa del sistema.</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Certificador: carga técnica y envío a aprobación.</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Cliente: consulta de certificados vigentes y vencidos.</div>
          </div>
        </div>
        <div className="p-8 md:p-10">
          <h2 className="text-2xl font-bold text-slate-950">Ingresar</h2>
          <p className="mt-2 text-sm text-slate-500">Usá los usuarios de prueba o los creados en la base.</p>
          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            <Field label="Email">
              <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </Field>
            <Field label="Contraseña">
              <input className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
            </Field>
            {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
            <Button className="w-full" disabled={loading}>{loading ? "Ingresando..." : "Ingresar al sistema"}</Button>
          </form>
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
            Usuarios de prueba: admin@sip.com / trabajador@sip.com / aprobador@sip.com / cliente@tanckoating.com.
          </div>
        </div>
      </section>
    </main>
  );
}
