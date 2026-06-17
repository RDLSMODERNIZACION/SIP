"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Modal } from "@/src/components/ui/Modal";
import { approveCertificate, generatePdf, generateQr, getCertificateById, rejectCertificate, submitCertificate } from "@/src/lib/certificatesApi";
import { formatDate, formatDateTime } from "@/src/lib/format";
import { resolveApiUrl } from "@/src/lib/config";
import { useAuth } from "@/src/context/AuthContext";
import type { Certificate, CertificateDetail } from "@/src/types";

export function CertificateDetailModal({
  certificate,
  open,
  onClose,
  onChanged,
}: {
  certificate: Certificate | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { hasRole } = useAuth();
  const [detail, setDetail] = useState<CertificateDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!certificate) return;
    try {
      setLoading(true);
      setError(null);
      setDetail(await getCertificateById(certificate.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el certificado");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
  }, [open, certificate?.id]);

  async function runAction(action: () => Promise<any>) {
    if (!certificate) return;
    try {
      setBusy(true);
      setError(null);
      await action();
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ejecutar la acción");
    } finally {
      setBusy(false);
    }
  }

  const c = detail?.certificate || certificate;
  if (!c) return null;

  const canSubmit = hasRole("admin", "certificador") && (c.status === "draft" || c.status === "rejected");
  const canApprove = hasRole("admin", "aprobador") && c.status === "submitted";
  const canGenerate = hasRole("admin", "aprobador") && c.status === "approved";

  return (
    <Modal open={open} title={`Certificado ${c.certificate_number}`} onClose={onClose} wide>
      {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
      {loading ? <div className="text-sm text-slate-500">Cargando detalle...</div> : null}
      <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-950">{c.certificate_number}</h3>
                <p className="mt-1 text-sm text-slate-500">{c.client_name} · CUIT {c.client_cuit || "—"}</p>
              </div>
              <StatusBadge status={c.visible_status} />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <Info label="Calibración" value={formatDate(c.calibration_date)} />
              <Info label="Vencimiento" value={formatDate(c.expiration_date)} />
              <Info label="Resultado" value={c.trial_result || "—"} />
              <Info label="Elemento" value={c.element || "—"} />
              <Info label="Marca" value={c.brand || "—"} />
              <Info label="Serie" value={c.serial_number || "—"} />
              <Info label="Rango" value={`${c.range_value || "—"} ${c.unit || ""}`} />
              <Info label="Modelo" value={c.type_model || "—"} />
              <Info label="Código" value={c.certificate_code || "—"} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-5">
            <h4 className="font-bold text-slate-950">Ensayo</h4>
            <div className="mt-4 grid gap-3">
              <TextBlock label="Método / protocolo" value={c.reference_method} />
              <TextBlock label="Condiciones ambientales" value={c.environmental_conditions} />
              <TextBlock label="Conclusiones" value={c.conclusions} />
              <TextBlock label="Observaciones" value={c.observations} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-5">
            <h4 className="font-bold text-slate-950">Resultados de pruebas</h4>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Prueba</th>
                    <th className="p-3">Valor</th>
                    <th className="p-3">Criterio</th>
                    <th className="p-3">Resultado</th>
                    <th className="p-3">Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail?.test_rows || []).map((row) => (
                    <tr key={`${row.row_order}-${row.pressure_label}`} className="border-t border-slate-100">
                      <td className="p-3 font-medium">{row.pressure_label}</td>
                      <td className="p-3">{row.range_value ?? "—"} {row.unit || ""}</td>
                      <td className="p-3">{row.acceptance_criteria || "—"}</td>
                      <td className="p-3">{row.result || "—"}</td>
                      <td className="p-3">{row.observations || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-slate-200 p-5">
            <h4 className="font-bold text-slate-950">Acciones</h4>
            <div className="mt-4 grid gap-3">
              {canSubmit ? <Button disabled={busy} onClick={() => runAction(() => submitCertificate(c.id))}>Enviar a aprobación</Button> : null}
              {canApprove ? <Button variant="success" disabled={busy} onClick={() => runAction(() => approveCertificate(c.id))}>Aprobar certificado</Button> : null}
              {canApprove ? <Button variant="danger" disabled={busy} onClick={() => {
                const reason = window.prompt("Motivo del rechazo") || "Rechazado para corrección.";
                runAction(() => rejectCertificate(c.id, reason));
              }}>Rechazar</Button> : null}
              {canGenerate ? <Button variant="secondary" disabled={busy} onClick={() => runAction(() => generateQr(c.id))}>Generar QR</Button> : null}
              {canGenerate ? <Button variant="secondary" disabled={busy} onClick={() => runAction(() => generatePdf(c.id))}>Generar PDF</Button> : null}
              {c.pdf_url ? <a className="rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50" href={resolveApiUrl(c.pdf_url)} target="_blank">Abrir PDF</a> : null}
              {c.validation_hash ? <a className="rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50" href={`/validar/${c.validation_hash}`} target="_blank">Ver validación pública</a> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-5">
            <h4 className="font-bold text-slate-950">Patrones aplicados</h4>
            <div className="mt-4 space-y-3">
              {(detail?.patterns || []).length === 0 ? <p className="text-sm text-slate-500">Sin patrones vinculados.</p> : null}
              {(detail?.patterns || []).map((p) => (
                <div key={p.id || p.pattern_serial_number} className="rounded-xl bg-slate-50 p-4 text-sm">
                  <div className="font-semibold text-slate-950">{p.pattern_name || "Patrón"}</div>
                  <div className="mt-1 text-slate-500">Serie {p.pattern_serial_number || "—"} · Cert. {p.pattern_certificate_number || "—"}</div>
                  <div className="mt-1 text-slate-500">Recalibración: {formatDate(p.pattern_recalibration_date)}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-5">
            <h4 className="font-bold text-slate-950">Auditoría</h4>
            <div className="mt-4 space-y-3">
              {(detail?.audit || []).slice(0, 8).map((a) => (
                <div key={a.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                  <div className="font-medium text-slate-900">{a.action}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatDateTime(a.created_at)} · {a.user_name || "Sistema"}</div>
                  {a.detail ? <div className="mt-1 text-slate-500">{a.detail}</div> : null}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <p className="mt-1 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{value || "—"}</p>
    </div>
  );
}
