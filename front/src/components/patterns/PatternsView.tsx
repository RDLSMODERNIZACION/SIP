"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AppShell } from "@/src/components/layout/AppShell";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { StatusBadge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Field, inputClass } from "@/src/components/ui/Field";
import { Modal } from "@/src/components/ui/Modal";
import {
  createPattern,
  getPatterns,
  uploadPatternCertificate,
  deletePatternCertificate,
} from "@/src/lib/resourcesApi";
import { formatDate } from "@/src/lib/format";
import type { Pattern } from "@/src/types";

function getPatternCertificateUrl(pattern: Pattern) {
  return (pattern as any).certificate_url as string | undefined;
}

function getPatternCertificateFileName(pattern: Pattern) {
  return ((pattern as any).certificate_file_name || pattern.certificate_number || "Certificado patrón") as string;
}

export default function PatternsView() {
  const [items, setItems] = useState<Pattern[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setItems(await getPatterns({ q, status }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar patrones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpload(pattern: Pattern, file?: File | null) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("El certificado del patrón debe ser un PDF.");
      return;
    }
    try {
      setUploadingId(pattern.id);
      setError(null);
      await uploadPatternCertificate(pattern.id, file);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el certificado del patrón");
    } finally {
      setUploadingId(null);
      const input = fileInputs.current[pattern.id];
      if (input) input.value = "";
    }
  }

  async function handleDeleteCertificate(pattern: Pattern) {
    const ok = window.confirm("¿Eliminar el PDF del certificado patrón? Podés volver a cargarlo después.");
    if (!ok) return;
    try {
      setUploadingId(pattern.id);
      setError(null);
      await deletePatternCertificate(pattern.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el certificado del patrón");
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <AppShell title="Patrones" description="Control de instrumentos patrón, vencimientos y certificados de trazabilidad.">
      <Card>
        <CardHeader
          title="Instrumentos patrón"
          description="Cargá el certificado del patrón en PDF para que el certificado final muestre trazabilidad sin links externos."
          action={<Button onClick={() => setOpen(true)}>Nuevo patrón</Button>}
        />
        <CardContent>
          <div className="mb-5 grid gap-3 md:grid-cols-[1fr_240px_auto]">
            <Field label="Buscar">
              <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, serie, certificado..." />
            </Field>
            <Field label="Estado">
              <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Todos</option>
                <option value="vigente">Vigente</option>
                <option value="por_vencer_30_dias">Por vencer 30 días</option>
                <option value="por_vencer_60_dias">Por vencer 60 días</option>
                <option value="vencido">Vencido</option>
              </select>
            </Field>
            <div className="flex items-end">
              <Button variant="secondary" onClick={load}>Filtrar</Button>
            </div>
          </div>

          {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
          {loading ? <div className="text-sm text-slate-500">Cargando...</div> : null}
          {!loading && items.length === 0 ? <EmptyState title="No hay patrones" /> : null}

          {items.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full min-w-[1050px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-4">Patrón</th>
                    <th className="p-4">Serie</th>
                    <th className="p-4">Certificado</th>
                    <th className="p-4">Rango</th>
                    <th className="p-4">Calibración</th>
                    <th className="p-4">Recalibración</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4">Archivo patrón</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => {
                    const url = getPatternCertificateUrl(p);
                    const fileName = getPatternCertificateFileName(p);
                    return (
                      <tr key={p.id} className="border-t border-slate-100 align-top">
                        <td className="p-4 font-bold">{p.name}</td>
                        <td className="p-4">{p.serial_number}</td>
                        <td className="p-4">{p.certificate_number || "—"}</td>
                        <td className="p-4">{p.range_value || "—"} {p.unit || ""}</td>
                        <td className="p-4">{formatDate(p.calibration_date)}</td>
                        <td className="p-4">{formatDate(p.recalibration_date)}</td>
                        <td className="p-4"><StatusBadge status={p.visible_status} /></td>
                        <td className="p-4">
                          <div className="flex flex-col gap-2">
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm font-semibold text-slate-900 underline underline-offset-4"
                              >
                                Ver certificado patrón
                              </a>
                            ) : (
                              <span className="text-sm text-slate-500">Sin PDF cargado</span>
                            )}
                            {url ? <span className="text-xs text-slate-500">{fileName}</span> : null}
                            <input
                              ref={(el) => { fileInputs.current[p.id] = el; }}
                              type="file"
                              accept="application/pdf,.pdf"
                              className="hidden"
                              onChange={(e) => handleUpload(p, e.target.files?.[0])}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => fileInputs.current[p.id]?.click()}
                                disabled={uploadingId === p.id}
                              >
                                {uploadingId === p.id ? "Subiendo..." : url ? "Reemplazar PDF" : "Subir PDF"}
                              </Button>
                              {url ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => handleDeleteCertificate(p)}
                                  disabled={uploadingId === p.id}
                                >
                                  Quitar
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <PatternModal open={open} onClose={() => setOpen(false)} onSaved={load} />
    </AppShell>
  );
}

function PatternModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: "",
    brand: "",
    model: "",
    serial_number: "",
    certificate_number: "",
    range_value: "",
    unit: "",
    calibration_date: "",
    recalibration_date: "",
    certificate_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      await createPattern(form);
      onSaved();
      onClose();
      setForm({ name: "", brand: "", model: "", serial_number: "", certificate_number: "", range_value: "", unit: "", calibration_date: "", recalibration_date: "", certificate_url: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo patrón">
      <form onSubmit={submit} className="space-y-4">
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="Serie"><input className={inputClass} value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} required /></Field>
          <Field label="Certificado"><input className={inputClass} value={form.certificate_number} onChange={(e) => setForm({ ...form, certificate_number: e.target.value })} /></Field>
          <Field label="Rango"><input className={inputClass} value={form.range_value} onChange={(e) => setForm({ ...form, range_value: e.target.value })} /></Field>
          <Field label="Unidad"><input className={inputClass} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
          <Field label="Fecha calibración"><input className={inputClass} type="date" value={form.calibration_date} onChange={(e) => setForm({ ...form, calibration_date: e.target.value })} /></Field>
          <Field label="Fecha recalibración"><input className={inputClass} type="date" value={form.recalibration_date} onChange={(e) => setForm({ ...form, recalibration_date: e.target.value })} /></Field>
          <Field label="URL certificado externo"><input className={inputClass} value={form.certificate_url} onChange={(e) => setForm({ ...form, certificate_url: e.target.value })} placeholder="Opcional. Mejor usar Subir PDF luego." /></Field>
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
        </div>
      </form>
    </Modal>
  );
}
