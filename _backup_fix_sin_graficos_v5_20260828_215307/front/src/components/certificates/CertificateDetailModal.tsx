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

type DetailAny = CertificateDetail & {
  metrology_results?: any[];
  sensor_loop_results?: any[];
  relief_valve_result?: any | null;
  hydrostatic_result?: any | null;
  hydraulic_test_chart?: any | null;
  files?: any[];
  audit?: any[];
  patterns?: any[];
  test_rows?: any[];
};

const TEMPLATE_LABELS: Record<string, string> = {
  pressure_gauge: "Manómetro / indicador de presión",
  pressure_head_sensor: "Cabeza de presión / sensor electrónico",
  relief_valve_set: "Válvula de seguridad / Relief / PRV",
  hydrostatic_line: "Línea / manguera / brida / conexión",
  general_pressure: "Ensayo general de presión",
};

const HYDRAULIC_REQUIRED_TEMPLATES = new Set(["relief_valve_set", "hydrostatic_line"]);

function valueOrDash(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function numberOrDash(value: unknown, suffix = "") {
  if (value === null || value === undefined || value === "") return "—";
  return `${value}${suffix ? ` ${suffix}` : ""}`;
}

function formatBoolean(value: unknown) {
  if (value === true) return "Sí";
  if (value === false) return "No";
  return "—";
}

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
  const [detail, setDetail] = useState<DetailAny | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [uploadingChart, setUploadingChart] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const hydraulicInputRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    if (!certificate) return;
    try {
      setLoading(true);
      setError(null);
      setDetail((await getCertificateById(certificate.id)) as DetailAny);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el certificado");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      setGeneratedPdfUrl(null);
      load();
    }
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

  function buildCertificatePdfFallbackUrl(current?: Certificate | null) {
    if (!current?.certificate_number) return "";
    const fileName = `${current.certificate_number.replace(/\s+/g, "_").replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`;
    return `${API_BASE_URL}/static/certificates/${fileName}`;
  }

  function getCertificatePdfUrl(current?: Certificate | null) {
    const directUrl = normalizeFileUrl(current?.pdf_url || detail?.certificate?.pdf_url);
    if (directUrl) return directUrl;

    const pdfFile = (detail?.files || []).find((file: any) =>
      file.file_type === "pdf" || file.file_type === "certificate_pdf"
    );
    const fileUrl = normalizeFileUrl(pdfFile?.file_url);
    if (fileUrl) return fileUrl;

    if (current?.status === "approved") return buildCertificatePdfFallbackUrl(current);
    return "";
  }

  function handleOpenPdf() {
    const current = detail?.certificate || certificate;
    const url = getCertificatePdfUrl(current);
    if (!url) {
      setError("Este certificado todavía no tiene PDF generado.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
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

    try {
      // No abrimos una pestaña en blanco antes de que el backend termine.
      // El usuario queda en el modal con estado de carga y recién se abre el PDF cuando existe la URL final.
      setGeneratingPdf(true);
      setBusy(true);
      setGeneratedPdfUrl(null);
      setError(null);

      const result = await generatePdf(current.id);
      const finalUrl = normalizeFileUrl(result?.pdf_url);

      await load();
      onChanged();

      if (finalUrl) {
        setGeneratedPdfUrl(finalUrl);
        window.open(finalUrl, "_blank", "noopener,noreferrer");
      } else {
        setError("El PDF se generó, pero el backend no devolvió una URL.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el PDF");
    } finally {
      setGeneratingPdf(false);
      setBusy(false);
    }
  }

  const hydraulicChart = useMemo(() => {
    const explicit = (detail as any)?.hydraulic_test_chart;
    if (explicit) return explicit;
    return (detail?.files || []).find((file: any) => file.file_type === "hydraulic_test_chart") || null;
  }, [detail]);

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
  if (!c) return null;

  const isClient = hasRole("cliente");
  const templateType = String((c as any).template_type || "general_pressure");
  const templateLabel = TEMPLATE_LABELS[templateType] || valueOrDash(templateType);
  const requiresHydraulicChart = Boolean((c as any).requires_hydraulic_chart || HYDRAULIC_REQUIRED_TEMPLATES.has(templateType));
  const mdRequired = Boolean((c as any).md_required);

  const metrologyRows = detail?.metrology_results || [];
  const sensorRows = detail?.sensor_loop_results || [];
  const reliefResult = detail?.relief_valve_result || null;
  const hydrostaticResult = detail?.hydrostatic_result || null;

  const canSubmit = !isClient && hasRole("admin", "certificador") && (c.status === "draft" || c.status === "rejected");
  const canApprove = !isClient && hasRole("admin", "aprobador") && c.status === "submitted";
  const canGenerate = !isClient && hasRole("admin", "aprobador") && c.status === "approved";
  const canEdit = !isClient && (hasRole("admin") || (hasRole("certificador") && (c.status === "draft" || c.status === "rejected")));
  const canDelete = !isClient && hasRole("admin");
  const canManageHydraulicChart = !isClient && hasRole("admin", "aprobador");

  return (
    <>
      <Modal open={open} title={`Certificado ${c.certificate_number}`} onClose={onClose} wide>
        {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
        {generatingPdf ? (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            Generando PDF... No cierres esta ventana. El archivo se abrirá automáticamente cuando esté listo.
          </div>
        ) : null}
        {generatedPdfUrl ? (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            PDF generado. Si el navegador no lo abrió automáticamente, podés abrirlo desde {" "}
            <a href={generatedPdfUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
              este enlace
            </a>.
          </div>
        ) : null}
        {loading ? <div className="text-sm text-slate-500">Cargando detalle...</div> : null}

        <input
          ref={hydraulicInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={handleHydraulicFileChange}
        />

        <div className="grid gap-5 xl:grid-cols-[1fr_0.82fr]">
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
                <Info label="Documento" value={valueOrDash((c as any).document_type || "Certificado")} />
                <Info label="Plantilla" value={templateLabel} />
                <Info label="Frecuencia" value={numberOrDash(c.test_frequency_months, "meses")} />
                <Info label="Calibración" value={formatDate(c.calibration_date)} />
                <Info label="Vencimiento" value={formatDate(c.expiration_date)} />
                <Info label="Resultado" value={c.trial_result || "—"} />
                <Info label="Elemento" value={c.element || "—"} />
                <Info label="Tipo / Modelo" value={c.type_model || "—"} />
                <Info label="Marca" value={c.brand || "—"} />
                <Info label="Serie" value={c.serial_number || "—"} />
                <Info label="Rango" value={`${c.range_value || "—"} ${c.unit || ""}`} />
                <Info label="Size" value={c.size_value || "—"} />
                <Info label="Código" value={c.certificate_code || "—"} />
                <Info label="Rev." value={valueOrDash(c.certificate_revision)} />
                <Info label="Vigencia formato" value={formatDate((c as any).certificate_validity)} />
              </div>
            </section>

            {(mdRequired || requiresHydraulicChart || templateType !== "general_pressure") ? (
              <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
                <h4 className="font-bold text-slate-950">Requisitos técnicos aplicados</h4>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Info label="Gráfico hidráulico" value={requiresHydraulicChart ? "Obligatorio para aprobar" : "No obligatorio"} />
                  <Info label="Estado del gráfico" value={hydraulicChart?.file_url ? "Cargado" : requiresHydraulicChart ? "Pendiente" : "—"} />
                </div>
                {requiresHydraulicChart && !hydraulicChart?.file_url ? (
                  <p className="mt-3 rounded-xl bg-white p-3 text-sm text-amber-900">
                    Esta plantilla requiere adjuntar el gráfico/carta de prueba hidráulica antes de aprobar.
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="rounded-2xl border border-slate-200 p-5">
              <h4 className="font-bold text-slate-950">Ensayo</h4>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Info label="Tipo de prueba" value={c.test_type || "—"} />
                <Info label="Unidad de medida" value={c.measurement_unit || c.unit || "—"} />
                <Info label="Unidad / equipo" value={valueOrDash((c as any).asset_unit_code)} />
                <Info label="Nº precinto" value={valueOrDash((c as any).seal_number)} />
                <Info label="Medio de prueba" value={valueOrDash((c as any).test_medium)} />
                <Info label="Temperatura ambiente" value={valueOrDash((c as any).ambient_temperature)} />
                <Info label="Responsable" value={valueOrDash((c as any).responsible_name)} />
                <Info label="Matrícula / aclaración" value={valueOrDash((c as any).responsible_license)} />
              </div>
              <div className="mt-4 grid gap-3">
                <TextBlock label="Método / protocolo" value={c.reference_method} />
                <TextBlock label="Condiciones ambientales" value={c.environmental_conditions} />
                <TextBlock label="Conclusiones" value={c.conclusions} />
                <TextBlock label="Observaciones" value={c.observations} />
              </div>
            </section>

            {templateType === "pressure_gauge" ? (
              <MetrologySection rows={metrologyRows} unit={c.unit || c.measurement_unit || ""} />
            ) : null}

            {templateType === "pressure_head_sensor" ? (
              <SensorLoopSection rows={sensorRows} />
            ) : null}

            {templateType === "relief_valve_set" ? (
              <ReliefValveSection result={reliefResult} fallbackSeal={(c as any).seal_number} fallbackMedium={(c as any).test_medium} />
            ) : null}

            {templateType === "hydrostatic_line" ? (
              <HydrostaticSection result={hydrostaticResult} />
            ) : null}

            <section className="rounded-2xl border border-slate-200 p-5">
              <h4 className="font-bold text-slate-950">Registro de ensayo general</h4>
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
                    {(detail?.test_rows || []).length === 0 ? (
                      <tr><td className="p-3 text-slate-500" colSpan={5}>Sin registros de ensayo cargados.</td></tr>
                    ) : null}
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

                {!isClient && (canGenerate || c.qr_url) ? (
                  <Button variant="secondary" disabled={busy} onClick={handleViewQr}>Ver QR</Button>
                ) : null}

                {canGenerate ? <Button variant="secondary" disabled={busy || generatingPdf} onClick={handleGeneratePdf}>{generatingPdf ? "Generando PDF..." : "Generar PDF"}</Button> : null}
                {(c.pdf_url || c.status === "approved") ? (
                  <Button variant="secondary" disabled={busy} onClick={handleOpenPdf}>
                    Ver PDF generado
                  </Button>
                ) : null}
                {!isClient && c.validation_hash ? <a className="rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50" href={`/validar/${c.validation_hash}`} target="_blank">Ver validación pública</a> : null}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 p-5">
              <h4 className="font-bold text-slate-950">Adjuntos técnicos</h4>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Gráfico/carta de prueba hidráulica asociado al certificado. El archivo debe ser PDF.
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
                  <p className={`rounded-xl p-3 text-sm ${requiresHydraulicChart ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-500"}`}>
                    {requiresHydraulicChart ? "Pendiente: esta plantilla requiere gráfico/carta de prueba hidráulica." : "Sin gráfico de prueba hidráulica cargado."}
                  </p>
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
                    <div className="mt-1 text-slate-500">Rango: {p.pattern_range_value || "—"} {p.pattern_unit || ""}</div>
                    <div className="mt-1 text-slate-500">Calibración: {formatDate(p.pattern_calibration_date)} · Recalibración: {formatDate(p.pattern_recalibration_date)}</div>
                  </div>
                ))}
              </div>
            </section>

            {!isClient ? (
              <section className="rounded-2xl border border-slate-200 p-5">
                <h4 className="font-bold text-slate-950">Auditoría</h4>
                <div className="mt-4 space-y-3">
                  {(detail?.audit || []).length === 0 ? <p className="text-sm text-slate-500">Sin movimientos registrados.</p> : null}
                  {(detail?.audit || []).slice(0, 8).map((a) => (
                    <div key={a.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                      <div className="font-medium text-slate-900">{a.action}</div>
                      <div className="mt-1 text-xs text-slate-500">{formatDateTime(a.created_at)} · {a.user_name || "Sistema"}</div>
                      {a.detail ? <div className="mt-1 text-slate-500">{a.detail}</div> : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
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

function MetrologySection({ rows, unit }: { rows: any[]; unit?: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 p-5">
      <h4 className="font-bold text-slate-950">Tabla metrológica - Patrón vs instrumento</h4>
      <p className="mt-1 text-xs text-slate-500">Aplica a manómetros / indicadores de presión. No reemplaza valores numéricos por OK.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Punto</th>
              <th className="p-3">Dirección</th>
              <th className="p-3">Presión patrón</th>
              <th className="p-3">Lectura instrumento</th>
              <th className="p-3">Error</th>
              <th className="p-3">Error admisible</th>
              <th className="p-3">Incertidumbre</th>
              <th className="p-3">Unidad</th>
              <th className="p-3">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <tr><td className="p-3 text-slate-500" colSpan={9}>Sin tabla metrológica cargada.</td></tr> : null}
            {rows.map((row, index) => (
              <tr key={row.id || index} className="border-t border-slate-100">
                <td className="p-3 font-medium">{valueOrDash(row.point_label || `Punto ${index + 1}`)}</td>
                <td className="p-3">{valueOrDash(row.direction)}</td>
                <td className="p-3">{numberOrDash(row.pattern_pressure, row.unit || unit)}</td>
                <td className="p-3">{numberOrDash(row.instrument_reading, row.unit || unit)}</td>
                <td className="p-3">{numberOrDash(row.error_value, row.unit || unit)}</td>
                <td className="p-3">{numberOrDash(row.max_allowed_error, row.unit || unit)}</td>
                <td className="p-3">{numberOrDash(row.uncertainty, row.unit || unit)}</td>
                <td className="p-3">{valueOrDash(row.unit || unit)}</td>
                <td className="p-3">{valueOrDash(row.result)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SensorLoopSection({ rows }: { rows: any[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 p-5">
      <h4 className="font-bold text-slate-950">Tabla de lazo eléctrico</h4>
      <p className="mt-1 text-xs text-slate-500">Aplica a cabezas de presión / sensores electrónicos.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Presión aplicada</th>
              <th className="p-3">Lectura patrón</th>
              <th className="p-3">Señal esperada</th>
              <th className="p-3">Señal medida</th>
              <th className="p-3">Unidad señal</th>
              <th className="p-3">Lectura pantalla</th>
              <th className="p-3">Error</th>
              <th className="p-3">Error adm.</th>
              <th className="p-3">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <tr><td className="p-3 text-slate-500" colSpan={9}>Sin tabla de lazo eléctrico cargada.</td></tr> : null}
            {rows.map((row, index) => (
              <tr key={row.id || index} className="border-t border-slate-100">
                <td className="p-3">{numberOrDash(row.pressure_applied)}</td>
                <td className="p-3">{numberOrDash(row.pattern_reading)}</td>
                <td className="p-3">{numberOrDash(row.expected_signal, row.signal_unit)}</td>
                <td className="p-3">{numberOrDash(row.measured_signal, row.signal_unit)}</td>
                <td className="p-3">{valueOrDash(row.signal_unit)}</td>
                <td className="p-3">{numberOrDash(row.display_reading)}</td>
                <td className="p-3">{numberOrDash(row.error_value)}</td>
                <td className="p-3">{numberOrDash(row.max_allowed_error)}</td>
                <td className="p-3">{valueOrDash(row.result)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReliefValveSection({ result, fallbackSeal, fallbackMedium }: { result: any | null; fallbackSeal?: string | null; fallbackMedium?: string | null }) {
  return (
    <section className="rounded-2xl border border-slate-200 p-5">
      <h4 className="font-bold text-slate-950">Ensayo de apertura / seteo de válvula</h4>
      <p className="mt-1 text-xs text-slate-500">Aplica a válvulas de seguridad, Relief o PRV.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Info label="Presión seteo requerida" value={numberOrDash(result?.set_pressure_required)} />
        <Info label="Presión apertura real" value={numberOrDash(result?.opening_pressure)} />
        <Info label="Tolerancia" value={numberOrDash(result?.tolerance_percent, "%")} />
        <Info label="Reasentamiento / cierre" value={numberOrDash(result?.reclosing_pressure)} />
        <Info label="Hermeticidad asiento" value={numberOrDash(result?.leak_test_pressure)} />
        <Info label="Resultado hermeticidad" value={valueOrDash(result?.leak_test_result)} />
        <Info label="Nº precinto" value={valueOrDash(result?.seal_number || fallbackSeal)} />
        <Info label="Medio de prueba" value={valueOrDash(result?.test_medium || fallbackMedium)} />
        <Info label="Temperatura ambiente" value={valueOrDash(result?.ambient_temperature)} />
        <Info label="Resultado final" value={valueOrDash(result?.result)} />
      </div>
      <div className="mt-4">
        <TextBlock label="Observaciones del ensayo" value={result?.observations} />
      </div>
    </section>
  );
}

function HydrostaticSection({ result }: { result: any | null }) {
  return (
    <section className="rounded-2xl border border-slate-200 p-5">
      <h4 className="font-bold text-slate-950">Ensayo hidrostático de resistencia y estanqueidad</h4>
      <p className="mt-1 text-xs text-slate-500">Aplica a líneas, mangueras, bridas, conexiones y cañerías.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Info label="Presión de trabajo" value={numberOrDash(result?.work_pressure)} />
        <Info label="Presión de prueba" value={numberOrDash(result?.test_pressure)} />
        <Info label="Sostenimiento" value={numberOrDash(result?.hold_minutes, "min")} />
        <Info label="Caída de presión" value={numberOrDash(result?.pressure_drop)} />
        <Info label="Medio de prueba" value={valueOrDash(result?.test_medium)} />
        <Info label="Resultado final" value={valueOrDash(result?.result)} />
        <Info label="Control espesores" value={formatBoolean(result?.thickness_control)} />
        <Info label="Método espesores" value={valueOrDash(result?.thickness_method)} />
        <Info label="Valores espesores" value={valueOrDash(result?.thickness_values)} />
      </div>
      <div className="mt-4">
        <TextBlock label="Observaciones del ensayo" value={result?.observations} />
      </div>
    </section>
  );
}
