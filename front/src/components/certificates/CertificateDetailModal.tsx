"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Modal } from "@/src/components/ui/Modal";
import {
  approveCertificate,
  deleteCertificate,
  deleteHydraulicTestChart,
  generatePdf,
  generateQr,
  getCertificateById,
  rejectCertificate,
  submitCertificate,
  uploadHydraulicTestChart,
} from "@/src/lib/certificatesApi";
import { formatDate, formatDateTime } from "@/src/lib/format";
import { API_BASE_URL, resolveApiUrl } from "@/src/lib/config";
import { useAuth } from "@/src/context/AuthContext";
import type { Certificate, CertificateDetail } from "@/src/types";
import { CertificateFormModal } from "./CertificateFormModal";

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
  const [uploadingChart, setUploadingChart] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const hydraulicInputRef = useRef<HTMLInputElement | null>(null);

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

  function normalizeFileUrl(url?: string | null) {
    if (!url) return "";
    const resolved = resolveApiUrl(url);
    return resolved.replace(/^http:\/\/localhost:8000/i, API_BASE_URL);
  }

  function openUrl(url?: string | null) {
    const finalUrl = normalizeFileUrl(url);
    if (!finalUrl) return false;
    window.open(finalUrl, "_blank", "noopener,noreferrer");
    return true;
  }

  async function handleDelete() {
    const current = detail?.certificate || certificate;
    if (!current) return;

    const confirmed = window.confirm(
      `¿Eliminar definitivamente el certificado ${current.certificate_number}? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    try {
      setBusy(true);
      setError(null);
      await deleteCertificate(current.id, true);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el certificado");
    } finally {
      setBusy(false);
    }
  }

  async function handleViewQr() {
    const current = detail?.certificate || certificate;
    if (!current) return;

    if (current.qr_url && openUrl(current.qr_url)) return;

    const popup = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;
    try {
      setBusy(true);
      setError(null);
      const result = await generateQr(current.id);
      await load();
      onChanged();

      const finalUrl = normalizeFileUrl(result?.qr_url);
      if (finalUrl) {
        if (popup) popup.location.href = finalUrl;
        else window.open(finalUrl, "_blank", "noopener,noreferrer");
      } else {
        popup?.close();
        setError("El QR se generó, pero el backend no devolvió una URL.");
      }
    } catch (err) {
      popup?.close();
      setError(err instanceof Error ? err.message : "No se pudo generar/ver el QR");
    } finally {
      setBusy(false);
    }
  }

  async function handleGeneratePdf() {
    const current = detail?.certificate || certificate;
    if (!current) return;

    const popup = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;
    try {
      setBusy(true);
      setError(null);
      const result = await generatePdf(current.id);
      await load();
      onChanged();

      const finalUrl = normalizeFileUrl(result?.pdf_url);
      if (finalUrl) {
        if (popup) popup.location.href = finalUrl;
        else window.open(finalUrl, "_blank", "noopener,noreferrer");
      } else {
        popup?.close();
        setError("El PDF se generó, pero el backend no devolvió una URL.");
      }
    } catch (err) {
      popup?.close();
      setError(err instanceof Error ? err.message : "No se pudo generar el PDF");
    } finally {
      setBusy(false);
    }
  }

  async function handleHydraulicFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const current = detail?.certificate || certificate;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!current || !file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("El gráfico de prueba hidráulica debe ser un archivo PDF.");
      return;
    }

    const confirmed = hydraulicChart
      ? window.confirm("Ya existe un gráfico de prueba hidráulica. ¿Querés reemplazarlo por este nuevo PDF?")
      : true;
    if (!confirmed) return;

    try {
      setUploadingChart(true);
      setError(null);
      await uploadHydraulicTestChart(current.id, file);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el gráfico de prueba hidráulica");
    } finally {
      setUploadingChart(false);
    }
  }

  async function handleDeleteHydraulicChart() {
    const current = detail?.certificate || certificate;
    if (!current) return;
    const confirmed = window.confirm("¿Eliminar el gráfico de prueba hidráulica asociado a este certificado?");
    if (!confirmed) return;

    try {
      setUploadingChart(true);
      setError(null);
      await deleteHydraulicTestChart(current.id);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el gráfico de prueba hidráulica");
    } finally {
      setUploadingChart(false);
    }
  }

  const c = detail?.certificate || certificate;

  const hydraulicChart = useMemo(() => {
    const explicit = (detail as any)?.hydraulic_test_chart;
    if (explicit) return explicit;
    return (detail?.files || []).find((file: any) => file.file_type === "hydraulic_test_chart") || null;
  }, [detail]);

  if (!c) return null;

  const canSubmit = hasRole("admin", "certificador") && (c.status === "draft" || c.status === "rejected");
  const canApprove = hasRole("admin", "aprobador") && c.status === "submitted";
  const canGenerate = hasRole("admin", "aprobador") && c.status === "approved";
  const canEdit = hasRole("admin") || (hasRole("certificador") && (c.status === "draft" || c.status === "rejected"));
  const canDelete = hasRole("admin");
  const canManageHydraulicChart = hasRole("admin", "aprobador");

  return (
    <>
      <Modal open={open} title={`Certificado ${c.certificate_number}`} onClose={onClose} wide>
        {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
        {loading ? <div className="text-sm text-slate-500">Cargando detalle...</div> : null}

        <input
          ref={hydraulicInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={handleHydraulicFileChange}
        />

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
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Acciones operativas del flujo de certificación.
              </p>
              <div className="mt-4 grid gap-3">
                {canSubmit ? <Button disabled={busy} onClick={() => runAction(() => submitCertificate(c.id))}>Enviar a aprobación</Button> : null}
                {canApprove ? <Button variant="success" disabled={busy} onClick={() => runAction(() => approveCertificate(c.id))}>Aprobar certificado</Button> : null}
                {canApprove ? <Button variant="danger" disabled={busy} onClick={() => {
                  const reason = window.prompt("Motivo del rechazo") || "Rechazado para corrección.";
                  runAction(() => rejectCertificate(c.id, reason));
                }}>Rechazar</Button> : null}

                {(canGenerate || c.qr_url) ? (
                  <Button variant="secondary" disabled={busy} onClick={handleViewQr}>Ver QR</Button>
                ) : null}

                {canGenerate ? <Button variant="secondary" disabled={busy} onClick={handleGeneratePdf}>Generar PDF</Button> : null}
                {c.pdf_url ? <a className="rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50" href={normalizeFileUrl(c.pdf_url)} target="_blank">Abrir PDF</a> : null}
                {c.validation_hash ? <a className="rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50" href={`/validar/${c.validation_hash}`} target="_blank">Ver validación pública</a> : null}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 p-5">
              <h4 className="font-bold text-slate-950">Adjuntos técnicos</h4>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Gráfico de prueba hidráulica asociado al certificado. El archivo debe ser PDF.
              </p>

              <div className="mt-4 grid gap-3">
                {hydraulicChart?.file_url ? (
                  <a
                    className="rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    href={normalizeFileUrl(hydraulicChart.file_url)}
                    target="_blank"
                  >
                    Ver gráfico prueba hidráulica
                  </a>
                ) : (
                  <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Sin gráfico de prueba hidráulica cargado.</p>
                )}

                {canManageHydraulicChart ? (
                  <Button
                    variant="secondary"
                    disabled={uploadingChart}
                    onClick={() => hydraulicInputRef.current?.click()}
                  >
                    {hydraulicChart ? "Reemplazar gráfico prueba hidráulica" : "Subir gráfico prueba hidráulica"}
                  </Button>
                ) : null}

                {canManageHydraulicChart && hydraulicChart ? (
                  <Button variant="danger" disabled={uploadingChart} onClick={handleDeleteHydraulicChart}>
                    Eliminar gráfico prueba hidráulica
                  </Button>
                ) : null}
              </div>
            </section>

            {(canEdit || canDelete) ? (
              <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
                <h4 className="font-bold text-slate-950">Edición y eliminación</h4>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Usar solo para corregir errores de carga. La eliminación es definitiva.
                </p>
                <div className="mt-4 grid gap-3">
                  {canEdit ? (
                    <Button variant="secondary" disabled={busy} onClick={() => setEditing(true)}>
                      Editar certificado
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button variant="danger" disabled={busy} onClick={handleDelete}>
                      Eliminar certificado definitivamente
                    </Button>
                  ) : null}
                </div>
              </section>
            ) : null}

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

      <CertificateFormModal
        open={editing}
        mode="edit"
        certificateId={c.id}
        onClose={() => setEditing(false)}
        onCreated={async () => {
          setEditing(false);
          await load();
          onChanged();
        }}
      />
    </>
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
