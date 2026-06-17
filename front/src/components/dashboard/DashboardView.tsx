"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/src/components/layout/AppShell";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { StatusBadge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { getCertificates } from "@/src/lib/certificatesApi";
import { formatDate } from "@/src/lib/format";
import type { Certificate } from "@/src/types";

export default function DashboardView() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setCertificates(await getCertificates());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el panel");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const by = (status: string) => certificates.filter((c) => c.visible_status === status).length;
    const porVencer = certificates.filter((c) => c.visible_status === "por_vencer_30_dias" || c.visible_status === "por_vencer_60_dias").length;
    return {
      total: certificates.length,
      vigentes: by("vigente"),
      vencidos: by("vencido"),
      pendientes: by("pendiente_aprobacion"),
      porVencer,
    };
  }, [certificates]);

  return (
    <AppShell title="Panel general" description="Resumen de certificados, vencimientos y pendientes de aprobación.">
      {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      <div className="grid gap-4 md:grid-cols-5">
        <Metric title="Total" value={stats.total} />
        <Metric title="Vigentes" value={stats.vigentes} />
        <Metric title="Por vencer" value={stats.porVencer} />
        <Metric title="Vencidos" value={stats.vencidos} />
        <Metric title="Pendientes" value={stats.pendientes} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader title="Certificados recientes" description="Últimos certificados registrados en la base de datos." />
          <CardContent>
            {loading ? <div className="text-sm text-slate-500">Cargando...</div> : null}
            {!loading && certificates.length === 0 ? <EmptyState title="No hay certificados" description="Cuando se creen certificados, aparecerán en este panel." /> : null}
            <div className="space-y-3">
              {certificates.slice(0, 8).map((c) => (
                <div key={c.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-bold text-slate-950">{c.certificate_number}</div>
                    <div className="mt-1 text-sm text-slate-500">{c.client_name} · {c.element || "Equipo sin detalle"}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs text-slate-500">Vence<br /><span className="font-semibold text-slate-700">{formatDate(c.expiration_date)}</span></div>
                    <StatusBadge status={c.visible_status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Control rápido" description="Estados que requieren seguimiento." />
          <CardContent className="space-y-4">
            <ControlItem title="Aprobación pendiente" value={stats.pendientes} description="Certificados cargados por trabajadores esperando revisión." />
            <ControlItem title="Vencidos" value={stats.vencidos} description="Certificados aprobados con vencimiento superado." />
            <ControlItem title="Próximos vencimientos" value={stats.porVencer} description="Oportunidades de renovación y contacto comercial." />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardContent>
        <div className="text-sm font-medium text-slate-500">{title}</div>
        <div className="mt-3 text-3xl font-bold text-slate-950">{value}</div>
      </CardContent>
    </Card>
  );
}

function ControlItem({ title, value, description }: { title: string; value: number; description: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="font-semibold text-slate-900">{title}</div>
        <div className="text-2xl font-bold text-slate-950">{value}</div>
      </div>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}
