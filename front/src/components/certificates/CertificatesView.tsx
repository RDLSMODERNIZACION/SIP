"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/src/components/layout/AppShell";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { StatusBadge } from "@/src/components/ui/Badge";
import { Field, inputClass } from "@/src/components/ui/Field";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { CertificateDetailModal } from "./CertificateDetailModal";
import { CertificateFormModal } from "./CertificateFormModal";
import { getCertificates } from "@/src/lib/certificatesApi";
import { formatDate } from "@/src/lib/format";
import { useAuth } from "@/src/context/AuthContext";
import type { Certificate } from "@/src/types";

export default function CertificatesView() {
  const { hasRole } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Certificate | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setCertificates(await getCertificates({ q: q || undefined, status: status || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar certificados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AppShell title="Certificados" description="Bandeja de certificados, estados, aprobación y generación de PDF/QR.">
      <Card>
        <CardHeader
          title="Listado de certificados"
          description="Datos reales obtenidos desde el backend FastAPI y la base Supabase/PostgreSQL."
          action={hasRole("admin", "certificador") ? <Button onClick={() => setCreating(true)}>Nuevo certificado</Button> : null}
        />
        <CardContent>
          <div className="mb-5 grid gap-3 md:grid-cols-[1fr_240px_auto]">
            <Field label="Buscar">
              <input className={inputClass} placeholder="Nº certificado, cliente, serie, elemento..." value={q} onChange={(e) => setQ(e.target.value)} />
            </Field>
            <Field label="Estado">
              <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Todos</option>
                <option value="vigente">Vigente</option>
                <option value="por_vencer_30_dias">Por vencer 30 días</option>
                <option value="por_vencer_60_dias">Por vencer 60 días</option>
                <option value="vencido">Vencido</option>
                <option value="pendiente_aprobacion">Pendiente aprobación</option>
                <option value="borrador">Borrador</option>
                <option value="rechazado">Rechazado</option>
                <option value="anulado">Anulado</option>
              </select>
            </Field>
            <div className="flex items-end"><Button variant="secondary" onClick={load} className="w-full">Filtrar</Button></div>
          </div>

          {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
          {loading ? <div className="text-sm text-slate-500">Cargando certificados...</div> : null}
          {!loading && certificates.length === 0 ? <EmptyState title="No hay certificados" description="Probá cambiar los filtros o crear un certificado nuevo." /> : null}

          {certificates.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-4">Certificado</th>
                    <th className="p-4">Cliente</th>
                    <th className="p-4">Equipo</th>
                    <th className="p-4">Serie</th>
                    <th className="p-4">Calibración</th>
                    <th className="p-4">Vencimiento</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {certificates.map((cert) => (
                    <tr key={cert.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="p-4 font-bold text-slate-950">{cert.certificate_number}</td>
                      <td className="p-4"><div className="font-semibold">{cert.client_name}</div><div className="text-xs text-slate-500">CUIT {cert.client_cuit || "—"}</div></td>
                      <td className="p-4">{cert.element || "—"}</td>
                      <td className="p-4">{cert.serial_number || "—"}</td>
                      <td className="p-4">{formatDate(cert.calibration_date)}</td>
                      <td className="p-4">{formatDate(cert.expiration_date)}</td>
                      <td className="p-4"><StatusBadge status={cert.visible_status} /></td>
                      <td className="p-4 text-right"><Button variant="secondary" onClick={() => setSelected(cert)}>Ver</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <CertificateDetailModal certificate={selected} open={Boolean(selected)} onClose={() => setSelected(null)} onChanged={load} />
      <CertificateFormModal open={creating} onClose={() => setCreating(false)} onCreated={load} />
    </AppShell>
  );
}
