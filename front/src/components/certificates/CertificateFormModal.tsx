"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Modal } from "@/src/components/ui/Modal";
import { Button } from "@/src/components/ui/Button";
import { Field, inputClass } from "@/src/components/ui/Field";
import {
  createCertificatePending,
  getNextCertificateNumber,
  type CertificateCreatePayload,
} from "@/src/lib/certificatesApi";
import { getClients, getEquipment, getPatterns } from "@/src/lib/resourcesApi";
import { getCatalogItems, type CatalogItem } from "@/src/lib/catalogsApi";
import type { Client, Equipment, Pattern } from "@/src/types";

const FIXED_CERTIFICATE_CODE = "CE-SIP-01";
const FIXED_CERTIFICATE_REVISION = "5";
const FIXED_CERTIFICATE_VALIDITY = "2024-10-01";
const DEFAULT_FREQUENCY_MONTHS = 60;

function textValue(item: CatalogItem, field: keyof CatalogItem = "name") {
  const value = item[field];
  return value === null || value === undefined ? "" : String(value);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addMonthsIso(dateIso: string, months: number) {
  if (!dateIso) return "";
  const date = new Date(`${dateIso}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function defaultForm(certificateNumber = ""): CertificateCreatePayload {
  const calibrationDate = todayIso();
  return {
    certificate_number: certificateNumber,
    certificate_code: FIXED_CERTIFICATE_CODE,
    certificate_revision: FIXED_CERTIFICATE_REVISION,
    certificate_validity: FIXED_CERTIFICATE_VALIDITY,
    client_id: "",
    equipment_id: null,
    calibration_date: calibrationDate,
    expiration_date: addMonthsIso(calibrationDate, DEFAULT_FREQUENCY_MONTHS),
    test_frequency_months: DEFAULT_FREQUENCY_MONTHS,
    test_type: "Prueba de presión",
    reference_method:
      "Se aplica presión en baja y luego se eleva a presión de trabajo. Se verifica que no tenga pérdida durante el tiempo establecido.",
    environmental_conditions: "Temperatura referencia 20 ºC (+/- 1 ºC). Presión atmosférica 998 hPa.",
    measurement_unit: "PSI",
    observations: "SIN",
    conclusions:
      "EL ELEMENTO SE ENCUENTRA APTO PARA SU USO, RESPETANDO LAS FRECUENCIAS DE CONTROL ESTABLECIDAS.",
    trial_result: "Aprobado",
    approved_result: true,
    is_paid: false,
    test_rows: [
      { row_order: 1, pressure_label: "PRESIÓN DE TRABAJO", range_value: 185, unit: "PSI" },
      {
        row_order: 2,
        pressure_label: "PRESIÓN DE PRUEBA N°1",
        range_value: 46,
        unit: "PSI",
        acceptance_criteria: "SIN ERROR",
        result: "POSITIVO",
        observations: "OK",
      },
      {
        row_order: 3,
        pressure_label: "PRESIÓN DE PRUEBA N°2",
        range_value: 93,
        unit: "PSI",
        acceptance_criteria: "SIN ERROR",
        result: "POSITIVO",
        observations: "OK",
      },
      {
        row_order: 4,
        pressure_label: "PRESIÓN DE PRUEBA N°3",
        range_value: 185,
        unit: "PSI",
        acceptance_criteria: "SIN ERROR",
        result: "POSITIVO",
        observations: "OK",
      },
      { row_order: 5, pressure_label: "PRESIÓN DE PRUEBA N°4", range_value: null, unit: "PSI" },
      { row_order: 6, pressure_label: "PRESIÓN DE PRUEBA N°5", range_value: null, unit: "PSI" },
    ],
    pattern_usages: [],
  };
}

function fixedInputClass(editable: boolean) {
  return `${inputClass} ${editable ? "" : "cursor-not-allowed bg-slate-100 text-slate-500"}`;
}

export function CertificateFormModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [units, setUnits] = useState<CatalogItem[]>([]);
  const [testTypes, setTestTypes] = useState<CatalogItem[]>([]);
  const [elements, setElements] = useState<CatalogItem[]>([]);
  const [elementModels, setElementModels] = useState<CatalogItem[]>([]);
  const [sizes, setSizes] = useState<CatalogItem[]>([]);
  const [frequencies, setFrequencies] = useState<CatalogItem[]>([]);
  const [pressureRows, setPressureRows] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingNumber, setLoadingNumber] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatternId, setSelectedPatternId] = useState("");
  const [allowHeaderEdit, setAllowHeaderEdit] = useState(false);
  const [form, setForm] = useState<CertificateCreatePayload>(() => defaultForm());

  async function refreshNextNumber() {
    setLoadingNumber(true);
    try {
      const next = await getNextCertificateNumber({ prefix: "SIP" });
      setForm((prev) => ({ ...prev, certificate_number: next.certificate_number }));
    } finally {
      setLoadingNumber(false);
    }
  }

  async function loadResources() {
    setError(null);
    setLoadingNumber(true);
    const [c, e, p, next, catUnits, catTestTypes, catElements, catElementModels, catSizes, catFrequencies, catPressureRows] = await Promise.all([
      getClients(),
      getEquipment(),
      getPatterns(),
      getNextCertificateNumber({ prefix: "SIP" }),
      getCatalogItems("units", { active: true }),
      getCatalogItems("test-types", { active: true }),
      getCatalogItems("elements", { active: true }),
      getCatalogItems("element-models", { active: true }),
      getCatalogItems("sizes", { active: true }),
      getCatalogItems("frequencies", { active: true }),
      getCatalogItems("pressure-rows", { active: true }),
    ]);
    setClients(c);
    setEquipment(e);
    setPatterns(p);
    setUnits(catUnits);
    setTestTypes(catTestTypes);
    setElements(catElements);
    setElementModels(catElementModels);
    setSizes(catSizes);
    setFrequencies(catFrequencies);
    setPressureRows(catPressureRows);
    setSelectedPatternId("");
    setAllowHeaderEdit(false);
    const baseForm = defaultForm(next.certificate_number);
    const defaultRows = catPressureRows.length > 0
      ? catPressureRows.map((row, index) => ({
          row_order: Number(row.row_order || index + 1),
          pressure_label: textValue(row),
          range_value: index === 0 ? 185 : null,
          unit: catUnits.find((u) => textValue(u) === "PSI") ? "PSI" : textValue(catUnits[0]) || "PSI",
          acceptance_criteria: index === 0 ? undefined : "SIN ERROR",
          result: index === 0 ? undefined : "POSITIVO",
          observations: index === 0 ? undefined : "OK",
        }))
      : baseForm.test_rows;
    setForm({
      ...baseForm,
      client_id: c[0]?.id || "",
      measurement_unit: textValue(catUnits.find((u) => textValue(u) === "PSI") || catUnits[0]) || baseForm.measurement_unit,
      unit: textValue(catUnits.find((u) => textValue(u) === "PSI") || catUnits[0]) || baseForm.unit,
      test_type: textValue(catTestTypes[0]) || baseForm.test_type,
      test_rows: defaultRows,
    });
    setLoadingNumber(false);
  }

  useEffect(() => {
    if (open) {
      loadResources().catch((err) => {
        setLoadingNumber(false);
        setError(err instanceof Error ? err.message : "Error cargando datos");
      });
    }
  }, [open]);

  const filteredEquipment = useMemo(
    () => equipment.filter((e) => e.client_id === form.client_id),
    [equipment, form.client_id]
  );

  const filteredElementModels = useMemo(
    () => elementModels.filter((m) => !form.element || String(m.element_name || "").toUpperCase() === String(form.element || "").toUpperCase()),
    [elementModels, form.element]
  );

  function update<K extends keyof CertificateCreatePayload>(key: K, value: CertificateCreatePayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateCalibrationDate(value: string) {
    setForm((prev) => ({
      ...prev,
      calibration_date: value,
      expiration_date: addMonthsIso(value, Number(prev.test_frequency_months || DEFAULT_FREQUENCY_MONTHS)),
    }));
  }

  function updateFrequency(value: number) {
    setForm((prev) => ({
      ...prev,
      test_frequency_months: value,
      expiration_date: addMonthsIso(prev.calibration_date || todayIso(), value),
    }));
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

  function updateTestRow(index: number, key: string, value: string) {
    setForm((prev) => {
      const rows = [...(prev.test_rows || [])];
      const row = { ...rows[index] } as any;
      row[key] = key === "range_value" ? (value === "" ? null : Number(value)) : value;
      rows[index] = row;
      return { ...prev, test_rows: rows };
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!form.certificate_number?.trim()) {
      setError("El número de certificado es obligatorio.");
      return;
    }

    if (!form.client_id) {
      setError("Seleccioná un cliente.");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...form,
        certificate_number: form.certificate_number.trim().toUpperCase(),
        certificate_code: form.certificate_code || FIXED_CERTIFICATE_CODE,
        certificate_revision: form.certificate_revision || FIXED_CERTIFICATE_REVISION,
        certificate_validity: form.certificate_validity || FIXED_CERTIFICATE_VALIDITY,
        pattern_usages: selectedPatternId ? [{ pattern_id: selectedPatternId }] : [],
      };
      await createCertificatePending(payload);
      onCreated();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo crear el certificado";
      setError(message.includes("duplicate") ? "El número de certificado ya existe. Actualizá el número y volvé a intentar." : message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} title="Nuevo certificado" onClose={onClose} wide>
      <form onSubmit={onSubmit} className="space-y-6">
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Encabezado del certificado</h3>
              <p className="text-xs text-slate-500">
                Código, Rev. y Vigencia quedan fijos por defecto. Se pueden editar manualmente si hace falta.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={refreshNextNumber} disabled={loadingNumber}>
                {loadingNumber ? "Buscando..." : "Actualizar Nº"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setAllowHeaderEdit((v) => !v)}>
                {allowHeaderEdit ? "Bloquear fijos" : "Editar fijos"}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Nº certificado">
              <input
                className={inputClass}
                value={form.certificate_number}
                onChange={(e) => update("certificate_number", e.target.value.toUpperCase())}
                placeholder="SIP 26-033"
                required
              />
            </Field>
            <Field label="Código">
              <input
                className={fixedInputClass(allowHeaderEdit)}
                value={form.certificate_code || FIXED_CERTIFICATE_CODE}
                onChange={(e) => update("certificate_code", e.target.value)}
                disabled={!allowHeaderEdit}
              />
            </Field>
            <Field label="Rev.">
              <input
                className={fixedInputClass(allowHeaderEdit)}
                value={form.certificate_revision || FIXED_CERTIFICATE_REVISION}
                onChange={(e) => update("certificate_revision", e.target.value)}
                disabled={!allowHeaderEdit}
              />
            </Field>
            <Field label="Vigencia">
              <input
                className={fixedInputClass(allowHeaderEdit)}
                type="date"
                value={form.certificate_validity || FIXED_CERTIFICATE_VALIDITY}
                onChange={(e) => update("certificate_validity", e.target.value)}
                disabled={!allowHeaderEdit}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Cliente">
              <select className={inputClass} value={form.client_id} onChange={(e) => update("client_id", e.target.value)} required>
                <option value="">Seleccionar</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.cuit ? `- ${c.cuit}` : ""}</option>
                ))}
              </select>
            </Field>
            <Field label="Equipo">
              <select className={inputClass} value={form.equipment_id || ""} onChange={(e) => applyEquipment(e.target.value)}>
                <option value="">Sin equipo vinculado</option>
                {filteredEquipment.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} {e.serial_number ? `- Serie ${e.serial_number}` : ""}</option>
                ))}
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
            <Field label="Fecha calibración">
              <input className={inputClass} type="date" value={form.calibration_date || ""} onChange={(e) => updateCalibrationDate(e.target.value)} />
            </Field>
            <Field label="Frecuencia">
              <select className={inputClass} value={form.test_frequency_months || ""} onChange={(e) => updateFrequency(Number(e.target.value || DEFAULT_FREQUENCY_MONTHS))}>
                {frequencies.length === 0 ? <option value={form.test_frequency_months || DEFAULT_FREQUENCY_MONTHS}>{form.test_frequency_months || DEFAULT_FREQUENCY_MONTHS} meses</option> : null}
                {frequencies.map((f) => (
                  <option key={f.id} value={Number(f.months || 0)}>{f.name || `${f.months} MESES`}</option>
                ))}
              </select>
            </Field>
            <Field label="Vencimiento">
              <input className={inputClass} type="date" value={form.expiration_date || ""} onChange={(e) => update("expiration_date", e.target.value)} />
            </Field>
            <Field label="Orden compra">
              <input className={inputClass} value={form.purchase_order || ""} onChange={(e) => update("purchase_order", e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Datos del equipo</h3>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Elemento">
              <select className={inputClass} value={form.element || ""} onChange={(e) => setForm((prev) => ({ ...prev, element: e.target.value, type_model: "" }))}>
                <option value="">Seleccionar</option>
                {elements.map((el) => <option key={el.id} value={textValue(el)}>{textValue(el)}</option>)}
              </select>
            </Field>
            <Field label="Tipo / Modelo">
              <select className={inputClass} value={form.type_model || ""} onChange={(e) => update("type_model", e.target.value)}>
                <option value="">Seleccionar</option>
                {filteredElementModels.map((m) => <option key={m.id} value={textValue(m, "full_name")}>{textValue(m, "full_name")}</option>)}
              </select>
            </Field>
            <Field label="Marca"><input className={inputClass} value={form.brand || ""} onChange={(e) => update("brand", e.target.value)} /></Field>
            <Field label="Serie"><input className={inputClass} value={form.serial_number || ""} onChange={(e) => update("serial_number", e.target.value)} /></Field>
            <Field label="Rango"><input className={inputClass} value={form.range_value || ""} onChange={(e) => update("range_value", e.target.value)} /></Field>
            <Field label="Unidad rango">
              <select className={inputClass} value={form.unit || ""} onChange={(e) => update("unit", e.target.value)}>
                <option value="">Seleccionar</option>
                {units.map((u) => <option key={u.id} value={textValue(u)}>{textValue(u)}</option>)}
              </select>
            </Field>
            <Field label="Size">
              <select className={inputClass} value={form.size_value || ""} onChange={(e) => update("size_value", e.target.value)}>
                <option value="">Seleccionar</option>
                {sizes.map((s) => <option key={s.id} value={textValue(s)}>{textValue(s)}</option>)}
              </select>
            </Field>
            <Field label="Unidad ensayo">
              <select className={inputClass} value={form.measurement_unit || ""} onChange={(e) => update("measurement_unit", e.target.value)}>
                <option value="">Seleccionar</option>
                {units.map((u) => <option key={u.id} value={textValue(u)}>{textValue(u)}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Ensayo y resultado</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tipo de prueba">
              <select className={inputClass} value={form.test_type || ""} onChange={(e) => update("test_type", e.target.value)}>
                <option value="">Seleccionar</option>
                {testTypes.map((t) => <option key={t.id} value={textValue(t)}>{textValue(t)}</option>)}
              </select>
            </Field>
            <Field label="Método / protocolo"><textarea className={inputClass} rows={4} value={form.reference_method || ""} onChange={(e) => update("reference_method", e.target.value)} /></Field>
            <Field label="Conclusiones"><textarea className={inputClass} rows={4} value={form.conclusions || ""} onChange={(e) => update("conclusions", e.target.value)} /></Field>
            <Field label="Condiciones ambientales"><textarea className={inputClass} rows={3} value={form.environmental_conditions || ""} onChange={(e) => update("environmental_conditions", e.target.value)} /></Field>
            <Field label="Observaciones"><textarea className={inputClass} rows={3} value={form.observations || ""} onChange={(e) => update("observations", e.target.value)} /></Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Registro de ensayo</h3>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-3">Presión</th>
                  <th className="p-3">Rango / Unidad</th>
                  <th className="p-3">Criterio aceptación</th>
                  <th className="p-3">Resultado</th>
                  <th className="p-3">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {(form.test_rows || []).map((row, index) => (
                  <tr key={row.row_order} className="border-t border-slate-100">
                    <td className="p-2"><input className={inputClass} value={row.pressure_label} onChange={(e) => updateTestRow(index, "pressure_label", e.target.value)} /></td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <input className={inputClass} type="number" value={row.range_value ?? ""} onChange={(e) => updateTestRow(index, "range_value", e.target.value)} />
                        <input className={`${inputClass} max-w-24`} value={row.unit || ""} onChange={(e) => updateTestRow(index, "unit", e.target.value)} />
                      </div>
                    </td>
                    <td className="p-2"><input className={inputClass} value={row.acceptance_criteria || ""} onChange={(e) => updateTestRow(index, "acceptance_criteria", e.target.value)} /></td>
                    <td className="p-2"><input className={inputClass} value={row.result || ""} onChange={(e) => updateTestRow(index, "result", e.target.value)} /></td>
                    <td className="p-2"><input className={inputClass} value={row.observations || ""} onChange={(e) => updateTestRow(index, "observations", e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-slate-500">
            Al guardar, el certificado queda automáticamente en <strong>pendiente de aprobación</strong>. El PDF y QR final se generan después de aprobar.
          </p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || loadingNumber}>
              {loading ? "Creando..." : "Guardar y enviar a aprobación"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
