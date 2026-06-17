"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Modal } from "@/src/components/ui/Modal";
import { Button } from "@/src/components/ui/Button";
import { Field, inputClass } from "@/src/components/ui/Field";
import { createCertificate, type CertificateCreatePayload } from "@/src/lib/certificatesApi";
import { getClients, getEquipment, getPatterns } from "@/src/lib/resourcesApi";
import type { Client, Equipment, Pattern } from "@/src/types";

export function CertificateFormModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatternId, setSelectedPatternId] = useState("");

  const [form, setForm] = useState<CertificateCreatePayload>({
    certificate_number: `SIP ${new Date().getFullYear().toString().slice(-2)}-${String(Math.floor(Math.random() * 900) + 100)}`,
    certificate_code: "CE-SIP-01",
    certificate_revision: "5",
    certificate_validity: "2024-10-01",
    client_id: "",
    equipment_id: null,
    calibration_date: new Date().toISOString().slice(0, 10),
    expiration_date: "",
    test_frequency_months: 60,
    test_type: "Prueba de presión",
    reference_method: "Se aplica presión en baja y luego se eleva a presión de trabajo. Se verifica que no tenga pérdida durante el tiempo establecido.",
    environmental_conditions: "Temperatura referencia 20 ºC (+/- 1 ºC). Presión atmosférica 998 hPa.",
    measurement_unit: "PSI",
    observations: "SIN",
    conclusions: "EL ELEMENTO SE ENCUENTRA APTO PARA SU USO, RESPETANDO LAS FRECUENCIAS DE CONTROL ESTABLECIDAS.",
    trial_result: "Aprobado",
    approved_result: true,
    is_paid: false,
    test_rows: [
      { row_order: 1, pressure_label: "PRESIÓN DE TRABAJO", range_value: 185, unit: "PSI" },
      { row_order: 2, pressure_label: "PRESIÓN DE PRUEBA N°1", range_value: 46, unit: "PSI", acceptance_criteria: "SIN ERROR", result: "POSITIVO", observations: "OK" },
      { row_order: 3, pressure_label: "PRESIÓN DE PRUEBA N°2", range_value: 93, unit: "PSI", acceptance_criteria: "SIN ERROR", result: "POSITIVO", observations: "OK" },
      { row_order: 4, pressure_label: "PRESIÓN DE PRUEBA N°3", range_value: 185, unit: "PSI", acceptance_criteria: "SIN ERROR", result: "POSITIVO", observations: "OK" },
    ],
    pattern_usages: [],
  });

  async function loadResources() {
    const [c, e, p] = await Promise.all([getClients(), getEquipment(), getPatterns()]);
    setClients(c);
    setEquipment(e);
    setPatterns(p);
    setForm((prev) => ({ ...prev, client_id: prev.client_id || c[0]?.id || "" }));
  }

  useEffect(() => {
    if (open) loadResources().catch((err) => setError(err instanceof Error ? err.message : "Error cargando datos"));
  }, [open]);

  const filteredEquipment = useMemo(() => equipment.filter((e) => e.client_id === form.client_id), [equipment, form.client_id]);

  function update<K extends keyof CertificateCreatePayload>(key: K, value: CertificateCreatePayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function applyEquipment(id: string) {
    const eq = equipment.find((item) => item.id === id);
    update("equipment_id", id || null);
    if (!eq) return;
    setForm((prev) => ({
      ...prev,
      equipment_id: id,
      element: eq.element || prev.element,
      type_model: eq.type_model || prev.type_model,
      brand: eq.brand || prev.brand,
      serial_number: eq.serial_number || prev.serial_number,
      range_value: eq.range_value || prev.range_value,
      unit: eq.unit || prev.unit,
      size_value: eq.size_value || prev.size_value,
    }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!form.client_id) {
      setError("Seleccioná un cliente.");
      return;
    }
    try {
      setLoading(true);
      const payload = {
        ...form,
        pattern_usages: selectedPatternId ? [{ pattern_id: selectedPatternId }] : [],
      };
      await createCertificate(payload);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el certificado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} title="Nuevo certificado" onClose={onClose} wide>
      <form onSubmit={onSubmit} className="space-y-6">
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Nº certificado"><input className={inputClass} value={form.certificate_number} onChange={(e) => update("certificate_number", e.target.value)} /></Field>
          <Field label="Código"><input className={inputClass} value={form.certificate_code || ""} onChange={(e) => update("certificate_code", e.target.value)} /></Field>
          <Field label="Rev."><input className={inputClass} value={form.certificate_revision || ""} onChange={(e) => update("certificate_revision", e.target.value)} /></Field>
          <Field label="Vigencia"><input className={inputClass} type="date" value={form.certificate_validity || ""} onChange={(e) => update("certificate_validity", e.target.value)} /></Field>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Cliente">
            <select className={inputClass} value={form.client_id} onChange={(e) => update("client_id", e.target.value)}>
              <option value="">Seleccionar</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name} {c.cuit ? `- ${c.cuit}` : ""}</option>)}
            </select>
          </Field>
          <Field label="Equipo">
            <select className={inputClass} value={form.equipment_id || ""} onChange={(e) => applyEquipment(e.target.value)}>
              <option value="">Sin equipo vinculado</option>
              {filteredEquipment.map((e) => <option key={e.id} value={e.id}>{e.name} {e.serial_number ? `- Serie ${e.serial_number}` : ""}</option>)}
            </select>
          </Field>
          <Field label="Patrón aplicado">
            <select className={inputClass} value={selectedPatternId} onChange={(e) => setSelectedPatternId(e.target.value)}>
              <option value="">Sin patrón</option>
              {patterns.map((p) => <option key={p.id} value={p.id}>{p.name} - Serie {p.serial_number}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Fecha calibración"><input className={inputClass} type="date" value={form.calibration_date || ""} onChange={(e) => update("calibration_date", e.target.value)} /></Field>
          <Field label="Vencimiento"><input className={inputClass} type="date" value={form.expiration_date || ""} onChange={(e) => update("expiration_date", e.target.value)} /></Field>
          <Field label="Frecuencia meses"><input className={inputClass} type="number" value={form.test_frequency_months || ""} onChange={(e) => update("test_frequency_months", Number(e.target.value))} /></Field>
          <Field label="Unidad"><input className={inputClass} value={form.measurement_unit || ""} onChange={(e) => update("measurement_unit", e.target.value)} /></Field>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Elemento"><input className={inputClass} value={form.element || ""} onChange={(e) => update("element", e.target.value)} /></Field>
          <Field label="Modelo"><input className={inputClass} value={form.type_model || ""} onChange={(e) => update("type_model", e.target.value)} /></Field>
          <Field label="Marca"><input className={inputClass} value={form.brand || ""} onChange={(e) => update("brand", e.target.value)} /></Field>
          <Field label="Serie"><input className={inputClass} value={form.serial_number || ""} onChange={(e) => update("serial_number", e.target.value)} /></Field>
          <Field label="Rango"><input className={inputClass} value={form.range_value || ""} onChange={(e) => update("range_value", e.target.value)} /></Field>
          <Field label="Unidad rango"><input className={inputClass} value={form.unit || ""} onChange={(e) => update("unit", e.target.value)} /></Field>
          <Field label="Size"><input className={inputClass} value={form.size_value || ""} onChange={(e) => update("size_value", e.target.value)} /></Field>
          <Field label="Orden compra"><input className={inputClass} value={form.purchase_order || ""} onChange={(e) => update("purchase_order", e.target.value)} /></Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Método / protocolo"><textarea className={inputClass} rows={4} value={form.reference_method || ""} onChange={(e) => update("reference_method", e.target.value)} /></Field>
          <Field label="Conclusiones"><textarea className={inputClass} rows={4} value={form.conclusions || ""} onChange={(e) => update("conclusions", e.target.value)} /></Field>
          <Field label="Condiciones ambientales"><textarea className={inputClass} rows={3} value={form.environmental_conditions || ""} onChange={(e) => update("environmental_conditions", e.target.value)} /></Field>
          <Field label="Observaciones"><textarea className={inputClass} rows={3} value={form.observations || ""} onChange={(e) => update("observations", e.target.value)} /></Field>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? "Creando..." : "Crear borrador"}</Button>
        </div>
      </form>
    </Modal>
  );
}
