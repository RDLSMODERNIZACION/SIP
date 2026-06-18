"use client";

import { FormEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/src/components/ui/Modal";
import { Button } from "@/src/components/ui/Button";
import { Field, inputClass } from "@/src/components/ui/Field";
import {
  createCertificatePending,
  getCertificateTemplates,
  getNextCertificateNumber,
  type CertificateCreatePayload,
  type CertificateTemplate,
} from "@/src/lib/certificatesApi";
import { getClients, getEquipment, getPatterns } from "@/src/lib/resourcesApi";
import {
  deleteCatalogItem,
  ensureCatalogItem,
  getCatalogItems,
  type CatalogCode,
  type CatalogItem,
} from "@/src/lib/catalogsApi";
import type { Client, Equipment, Pattern } from "@/src/types";

const FIXED_CERTIFICATE_CODE = "CE-SIP-01";
const FIXED_CERTIFICATE_REVISION = "5";
const FIXED_CERTIFICATE_VALIDITY = "2024-10-01";
const DEFAULT_FREQUENCY_MONTHS = 12;
const MD_DEFAULT_FREQUENCY_MONTHS = 12;

const TEMPLATE_HELP: Record<string, string> = {
  pressure_gauge: "Manómetro: debe cargar valores numéricos patrón vs instrumento, error e incertidumbre. No usar solo OK/SIN ERROR.",
  pressure_head_sensor: "Cabeza de presión/sensor: debe cargar presión aplicada, señal mA/V y lectura final.",
  relief_valve_set: "Válvula relief/PRV: requiere apertura/seteo, cierre, hermeticidad, precinto y gráfico/carta de prueba.",
  hydrostatic_line: "Línea/manguera/brida/conexión: requiere parámetros hidrostáticos y gráfico/carta de presión vs tiempo.",
};

type SuggestionItem = {
  label: string;
  id?: string;
  catalog?: CatalogCode;
};

function normalizeText(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function sameText(a: unknown, b: unknown) {
  return normalizeText(a).toUpperCase() === normalizeText(b).toUpperCase();
}

function uniqueTexts(values: Array<string | null | undefined>) {
  const result: string[] = [];
  values.forEach((value) => {
    const clean = normalizeText(value);
    if (clean && !result.some((item) => sameText(item, clean))) result.push(clean);
  });
  return result.sort((a, b) => a.localeCompare(b));
}

function uniqueSuggestionItems(items: SuggestionItem[]) {
  const result: SuggestionItem[] = [];
  items.forEach((item) => {
    const label = normalizeText(item.label);
    if (!label) return;
    const existingIndex = result.findIndex((current) => sameText(current.label, label));
    const cleanItem = { ...item, label };
    if (existingIndex === -1) {
      result.push(cleanItem);
      return;
    }

    // Si ya existía como sugerencia histórica sin id, pero ahora viene desde catálogo,
    // reemplazamos para poder mostrar la X de eliminación.
    if (!result[existingIndex].id && cleanItem.id) {
      result[existingIndex] = cleanItem;
    }
  });
  return result.sort((a, b) => a.label.localeCompare(b.label));
}

async function settleCatalogSaves(tasks: Array<Promise<unknown>>) {
  const results = await Promise.allSettled(tasks);
  const rejected = results.filter((r) => r.status === "rejected");
  if (rejected.length > 0) {
    console.warn("Algunos catálogos no pudieron guardarse como sugerencia", rejected);
  }
}

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
    document_type: "Certificado de Calibración",
    template_type: "general_pressure",
    md_required: false,
    requires_hydraulic_chart: false,
    responsible_name: "Walter Cisterna",
    responsible_license: "Jefe Tecnico",
    asset_unit_code: "",
    seal_number: "",
    test_medium: "",
    ambient_temperature: "20° Centigrados",
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
    metrology_results: [],
    sensor_loop_results: [],
    relief_valve_result: null,
    hydrostatic_result: null,
  };
}

function fixedInputClass(editable: boolean) {
  return `${inputClass} ${editable ? "" : "cursor-not-allowed bg-slate-100 text-slate-500"}`;
}

function requiredInputClass(value: unknown) {
  const filled = normalizeText(value).length > 0;
  return `${inputClass} ${filled ? "" : "border-amber-300 bg-amber-50"}`;
}

function CatalogAutocomplete({
  value,
  onChange,
  suggestions,
  placeholder = "Escribir o elegir",
  onDeleteSuggestion,
}: {
  value: string;
  onChange: (value: string) => void;
  suggestions: SuggestionItem[];
  placeholder?: string;
  onDeleteSuggestion?: (item: SuggestionItem) => Promise<void> | void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = normalizeText(value).toUpperCase();
    const result = query
      ? suggestions.filter((item) => item.label.toUpperCase().includes(query))
      : suggestions;
    return result.slice(0, 12);
  }, [suggestions, value]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleDelete(item: SuggestionItem, event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!item.id || !item.catalog || !onDeleteSuggestion) return;
    const confirmed = window.confirm(`¿Eliminar "${item.label}" de las sugerencias?`);
    if (!confirmed) return;

    try {
      setDeletingId(item.id);
      await onDeleteSuggestion(item);
      if (sameText(value, item.label)) onChange("");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          className={`${inputClass} pr-10`}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-slate-900"
          onClick={() => setOpen((current) => !current)}
          aria-label="Mostrar sugerencias"
        >
          ▾
        </button>
      </div>

      {open && filtered.length > 0 ? (
        <div className="absolute z-[80] mt-2 max-h-72 w-full min-w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-xl md:min-w-[420px]">
          {filtered.map((item) => {
            const canDelete = Boolean(item.id && item.catalog && onDeleteSuggestion);
            return (
              <div
                key={`${item.catalog || "local"}-${item.id || item.label}`}
                title={item.label}
                className="group flex cursor-pointer items-start justify-between gap-3 rounded-lg px-3 py-2 text-slate-800 hover:bg-slate-100"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(item.label);
                  setOpen(false);
                }}
              >
                <span className="min-w-0 flex-1 whitespace-normal break-words text-left font-medium leading-snug">
                  {item.label}
                </span>
                {canDelete ? (
                  <button
                    type="button"
                    title="Eliminar sugerencia"
                    className="mt-[-2px] flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 opacity-100 hover:bg-red-50 hover:text-red-700 md:opacity-0 md:group-hover:opacity-100"
                    onMouseDown={(event) => handleDelete(item, event)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? "…" : "×"}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function CertificateFormModal({
  open,
  onClose,
  onCreated,
  mode = "create",
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  mode?: "create" | "edit";
  certificateId?: string;
}) {
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
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
  const modalTitle = mode === "edit" ? "Editar certificado" : "Nuevo certificado";

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

    // Carga catálogos sin romper todo el formulario si algún catálogo opcional
    // todavía no existe en backend/Supabase. Esto evita mostrar "Not Found" arriba.
    const safeCatalog = async (catalog: CatalogCode): Promise<CatalogItem[]> => {
      try {
        return await getCatalogItems(catalog, { active: true });
      } catch (err) {
        console.warn(`No se pudo cargar el catálogo ${catalog}`, err);
        return [];
      }
    };

    const [
      tpl,
      c,
      e,
      p,
      next,
      catUnits,
      catTestTypes,
      catElements,
      catElementModels,
      catSizes,
      catFrequencies,
      catPressureRows,
    ] = await Promise.all([
      getCertificateTemplates(),
      getClients(),
      getEquipment(),
      getPatterns(),
      getNextCertificateNumber({ prefix: "SIP" }),
      safeCatalog("units"),
      safeCatalog("test-types"),
      safeCatalog("elements"),
      safeCatalog("element-models"),
      safeCatalog("sizes"),
      safeCatalog("frequencies"),
      safeCatalog("pressure-rows"),
    ]);

    setTemplates(tpl);
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
    setSelectedPatternId(p[0]?.id || "");
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

  const elementSuggestions = useMemo(
    () => uniqueSuggestionItems([
      ...elements.map((item) => ({ label: textValue(item), id: item.id, catalog: "elements" as CatalogCode })),
      ...equipment.map((item) => ({ label: item.element || "" })),
      { label: form.element || "" },
    ]),
    [elements, equipment, form.element]
  );

  const typeModelSuggestions = useMemo(
    () => uniqueSuggestionItems([
      ...filteredElementModels.map((item) => ({ label: textValue(item, "full_name"), id: item.id, catalog: "element-models" as CatalogCode })),
      ...equipment
        .filter((item) => !form.element || sameText(item.element, form.element))
        .map((item) => ({ label: item.type_model || "" })),
      { label: form.type_model || "" },
    ]),
    [filteredElementModels, equipment, form.element, form.type_model]
  );

  const unitSuggestions = useMemo(
    () => uniqueSuggestionItems([
      ...units.map((item) => ({ label: textValue(item), id: item.id, catalog: "units" as CatalogCode })),
      ...equipment.map((item) => ({ label: item.unit || "" })),
      { label: form.unit || "" },
      { label: form.measurement_unit || "" },
    ]),
    [units, equipment, form.unit, form.measurement_unit]
  );

  const sizeSuggestions = useMemo(
    () => uniqueSuggestionItems([
      ...sizes.map((item) => ({ label: textValue(item), id: item.id, catalog: "sizes" as CatalogCode })),
      ...equipment.map((item) => ({ label: item.size_value || "" })),
      { label: form.size_value || "" },
    ]),
    [sizes, equipment, form.size_value]
  );

  const brandSuggestions = useMemo(
    () => uniqueSuggestionItems([...equipment.map((item) => ({ label: item.brand || "" })), { label: form.brand || "" }]),
    [equipment, form.brand]
  );

  const testTypeSuggestions = useMemo(
    () => uniqueSuggestionItems([
      ...testTypes.map((item) => ({ label: textValue(item), id: item.id, catalog: "test-types" as CatalogCode })),
      { label: form.test_type || "" },
    ]),
    [testTypes, form.test_type]
  );

  const pressureLabelSuggestions = useMemo(
    () => uniqueSuggestionItems([
      ...pressureRows.map((item) => ({ label: textValue(item), id: item.id, catalog: "pressure-rows" as CatalogCode })),
      ...(form.test_rows || []).map((row) => ({ label: row.pressure_label })),
    ]),
    [pressureRows, form.test_rows]
  );

  async function handleDeleteSuggestion(item: SuggestionItem) {
    if (!item.catalog || !item.id) return;
    setError(null);
    try {
      await deleteCatalogItem(item.catalog, item.id, false);
      if (item.catalog === "elements") setElements((prev) => prev.filter((current) => current.id !== item.id));
      if (item.catalog === "element-models") setElementModels((prev) => prev.filter((current) => current.id !== item.id));
      if (item.catalog === "units") setUnits((prev) => prev.filter((current) => current.id !== item.id));
      if (item.catalog === "sizes") setSizes((prev) => prev.filter((current) => current.id !== item.id));
      if (item.catalog === "test-types") setTestTypes((prev) => prev.filter((current) => current.id !== item.id));
      if (item.catalog === "pressure-rows") setPressureRows((prev) => prev.filter((current) => current.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la sugerencia");
      throw err;
    }
  }

  async function saveNewCatalogSuggestions(payload: CertificateCreatePayload) {
    const tasks: Array<Promise<unknown>> = [];
    const element = normalizeText(payload.element);
    const typeModel = normalizeText(payload.type_model);
    const unit = normalizeText(payload.unit);
    const measurementUnit = normalizeText(payload.measurement_unit);
    const size = normalizeText(payload.size_value);
    const testType = normalizeText(payload.test_type);

    if (element) tasks.push(ensureCatalogItem("elements", { name: element }));
    if (typeModel && element) {
      tasks.push(ensureCatalogItem("element-models", { element_name: element, full_name: typeModel }));
    }
    if (unit) tasks.push(ensureCatalogItem("units", { name: unit }));
    if (measurementUnit && !sameText(measurementUnit, unit)) tasks.push(ensureCatalogItem("units", { name: measurementUnit }));
    if (size) tasks.push(ensureCatalogItem("sizes", { name: size }));
    if (testType) tasks.push(ensureCatalogItem("test-types", { name: testType }));

    (payload.test_rows || []).forEach((row, index) => {
      const label = normalizeText(row.pressure_label);
      if (label) tasks.push(ensureCatalogItem("pressure-rows", { name: label, row_order: row.row_order || index + 1 }));
      const rowUnit = normalizeText(row.unit);
      if (rowUnit) tasks.push(ensureCatalogItem("units", { name: rowUnit }));
    });

    await settleCatalogSaves(tasks);
  }


  function isMdClient(clientId: string) {
    const client = clients.find((item) => item.id === clientId);
    const name = normalizeText(client?.name).toUpperCase();
    return name === "MD" || name === "MD SRL" || name === "MD S.R.L." || client?.cuit === "30710046898";
  }

  function templateForcesHydraulicChart(templateCode: string) {
    const template = templates.find((item) => item.code === templateCode);
    return Boolean(template?.requires_hydraulic_chart || ["relief_valve_set", "hydrostatic_line"].includes(templateCode));
  }

  function effectiveRequiresHydraulicChart(templateCode = String(form.template_type || "general_pressure"), manualValue = Boolean(form.requires_hydraulic_chart)) {
    return templateForcesHydraulicChart(templateCode) || manualValue;
  }

  function getAutomaticRequirementInfo(templateCode = String(form.template_type || "general_pressure")) {
    const chartForced = templateForcesHydraulicChart(templateCode);
    const chartRequired = effectiveRequiresHydraulicChart(templateCode);
    return { chartForced, chartRequired };
  }

  function buildAutomaticRequirementPatch(clientId = form.client_id, templateCode = String(form.template_type || "general_pressure")) {
    const template = templates.find((item) => item.code === templateCode);
    const md = isMdClient(clientId);
    const frequency = md
      ? MD_DEFAULT_FREQUENCY_MONTHS
      : Number(template?.default_frequency_months || form.test_frequency_months || DEFAULT_FREQUENCY_MONTHS);

    return {
      md_required: md,
      requires_hydraulic_chart: templateForcesHydraulicChart(templateCode) || (templateCode === "general_pressure" ? Boolean(form.requires_hydraulic_chart) : false),
      test_frequency_months: frequency,
      expiration_date: addMonthsIso(form.calibration_date || todayIso(), frequency),
    };
  }

  function applyTemplate(templateCode: string) {
    const template = templates.find((item) => item.code === templateCode);
    const automatic = buildAutomaticRequirementPatch(form.client_id, templateCode);

    const patch: Partial<CertificateCreatePayload> = {
      template_type: templateCode,
      document_type: template?.document_type || "Certificado de Calibración",
      reference_method: template?.default_method || form.reference_method,
      ...automatic,
    };

    if (templateCode === "pressure_gauge") {
      patch.test_type = "Calibración por comparación directa";
      patch.metrology_results = [
        { row_order: 1, point_label: "Punto 1", direction: "ascendente", unit: form.unit || "PSI" },
        { row_order: 2, point_label: "Punto 2", direction: "ascendente", unit: form.unit || "PSI" },
        { row_order: 3, point_label: "Punto 3", direction: "ascendente", unit: form.unit || "PSI" },
        { row_order: 4, point_label: "Punto 4", direction: "descendente", unit: form.unit || "PSI" },
        { row_order: 5, point_label: "Punto 5", direction: "descendente", unit: form.unit || "PSI" },
      ];
    }

    if (templateCode === "pressure_head_sensor") {
      patch.test_type = "Calibración de lazo eléctrico";
      patch.sensor_loop_results = [1, 2, 3, 4, 5].map((n) => ({ row_order: n, signal_unit: "mA", result: "" }));
    }

    if (templateCode === "relief_valve_set") {
      patch.test_type = "Ensayo de apertura / seteo";
      patch.relief_valve_result = { tolerance_percent: 5, result: "APTO", test_medium: form.test_medium || "Agua/Aire" };
    }

    if (templateCode === "hydrostatic_line") {
      patch.test_type = "Ensayo hidrostático de resistencia y estanqueidad";
      patch.hydrostatic_result = { hold_minutes: 15, pressure_drop: 0, test_medium: form.test_medium || "Agua", result: "APTO" };
    }

    setForm((prev) => ({ ...prev, ...patch }));
  }

  function updateMetrologyRow(index: number, key: string, value: string) {
    setForm((prev) => {
      const rows = [...(prev.metrology_results || [])];
      const row = { ...(rows[index] || { row_order: index + 1 }) } as any;
      row[key] = ["pattern_pressure", "instrument_reading", "error_value", "max_allowed_error", "uncertainty"].includes(key) ? (value === "" ? null : Number(value)) : value;
      rows[index] = row;
      return { ...prev, metrology_results: rows };
    });
  }

  function updateSensorRow(index: number, key: string, value: string) {
    setForm((prev) => {
      const rows = [...(prev.sensor_loop_results || [])];
      const row = { ...(rows[index] || { row_order: index + 1 }) } as any;
      row[key] = ["pressure_applied", "pattern_reading", "expected_signal", "measured_signal", "display_reading", "error_value", "max_allowed_error"].includes(key) ? (value === "" ? null : Number(value)) : value;
      rows[index] = row;
      return { ...prev, sensor_loop_results: rows };
    });
  }

  function updateRelief(key: string, value: string) {
    setForm((prev) => ({
      ...prev,
      relief_valve_result: {
        ...(prev.relief_valve_result || {}),
        [key]: ["set_pressure_required", "opening_pressure", "tolerance_percent", "reclosing_pressure", "leak_test_pressure"].includes(key) ? (value === "" ? null : Number(value)) : value,
      } as any,
    }));
  }

  function updateHydro(key: string, value: string | boolean) {
    setForm((prev) => ({
      ...prev,
      hydrostatic_result: {
        ...(prev.hydrostatic_result || {}),
        [key]: typeof value === "boolean" ? value : ["work_pressure", "test_pressure", "hold_minutes", "pressure_drop"].includes(key) ? (value === "" ? null : Number(value)) : value,
      } as any,
    }));
  }

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

    if (!selectedPatternId) {
      setError("Seleccioná un patrón aplicado.");
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
        document_type: normalizeText(form.document_type) || "Certificado de Calibración",
        template_type: normalizeText(form.template_type) || "general_pressure",
        md_required: isMdClient(form.client_id),
        requires_hydraulic_chart: effectiveRequiresHydraulicChart(String(form.template_type || "general_pressure"), Boolean(form.requires_hydraulic_chart)),
        responsible_name: normalizeText(form.responsible_name),
        responsible_license: normalizeText(form.responsible_license),
        asset_unit_code: normalizeText(form.asset_unit_code),
        seal_number: normalizeText(form.seal_number),
        test_medium: normalizeText(form.test_medium),
        ambient_temperature: normalizeText(form.ambient_temperature),
        element: normalizeText(form.element),
        type_model: normalizeText(form.type_model),
        brand: normalizeText(form.brand),
        serial_number: normalizeText(form.serial_number),
        range_value: normalizeText(form.range_value),
        unit: normalizeText(form.unit),
        size_value: normalizeText(form.size_value),
        test_type: normalizeText(form.test_type),
        measurement_unit: normalizeText(form.measurement_unit),
        pattern_usages: selectedPatternId ? [{ pattern_id: selectedPatternId }] : [],
      };
      await saveNewCatalogSuggestions(payload);
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
    <Modal open={open} title={modalTitle} onClose={onClose} wide>
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

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Tipo de documento y plantilla técnica</h3>
            <p className="text-xs text-slate-500">Esto ajusta el método, la frecuencia y las tablas requeridas según el tipo de elemento certificado.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Plantilla técnica">
              <select className={inputClass} value={form.template_type || "general_pressure"} onChange={(e) => applyTemplate(e.target.value)}>
                {templates.length === 0 ? <option value="general_pressure">Ensayo general</option> : null}
                {templates.map((template) => (
                  <option key={template.code} value={template.code}>{template.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Nombre del documento">
              <input className={inputClass} value={form.document_type || ""} onChange={(e) => update("document_type", e.target.value)} />
            </Field>
            <Field label="Gráfico / carta hidráulica">
              <label className={`flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm ${templateForcesHydraulicChart(String(form.template_type || "general_pressure")) ? "bg-slate-100 text-slate-500" : "bg-white"}`}>
                <input
                  type="checkbox"
                  checked={effectiveRequiresHydraulicChart()}
                  disabled={templateForcesHydraulicChart(String(form.template_type || "general_pressure"))}
                  onChange={(e) => update("requires_hydraulic_chart", e.target.checked)}
                />
                <span>{templateForcesHydraulicChart(String(form.template_type || "general_pressure")) ? "Obligatorio por plantilla" : "Requerir Anexo A"}</span>
              </label>
            </Field>
          </div>
          {(() => {
            const info = getAutomaticRequirementInfo();
            const messages: string[] = [];
            if (info.chartForced) messages.push("Esta plantilla requiere gráfico/carta de prueba hidráulica antes de aprobar.");
            if (!info.chartForced && info.chartRequired) messages.push("Este certificado se emitirá con ANEXO A: gráfico/carta de prueba hidráulica como adjunto técnico obligatorio.");
            if (form.template_type && TEMPLATE_HELP[String(form.template_type)]) messages.push(TEMPLATE_HELP[String(form.template_type)]);
            return messages.length > 0 ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                {messages.map((message) => (
                  <div key={message}>{message}</div>
                ))}
              </div>
            ) : null;
          })()}
        </section>

        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Cliente">
              <select
                className={requiredInputClass(form.client_id)}
                value={form.client_id}
                onChange={(e) => {
                  const clientId = e.target.value;
                  const automatic = buildAutomaticRequirementPatch(clientId, String(form.template_type || "general_pressure"));
                  setForm((prev) => ({ ...prev, client_id: clientId, ...automatic }));
                }}
                required
              >
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
              <select className={requiredInputClass(selectedPatternId)} value={selectedPatternId} onChange={(e) => setSelectedPatternId(e.target.value)}>
                {patterns.length === 0 ? <option value="">Sin patrón disponible</option> : null}
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
              <CatalogAutocomplete
                value={form.element || ""}
                suggestions={elementSuggestions}
                onDeleteSuggestion={handleDeleteSuggestion}
                onChange={(value) => setForm((prev) => ({ ...prev, element: value, type_model: prev.element && !sameText(prev.element, value) ? "" : prev.type_model }))}
              />
            </Field>
            <Field label="Tipo / Modelo">
              <CatalogAutocomplete
                value={form.type_model || ""}
                suggestions={typeModelSuggestions}
                onDeleteSuggestion={handleDeleteSuggestion}
                onChange={(value) => update("type_model", value)}
              />
            </Field>
            <Field label="Marca">
              <CatalogAutocomplete
                value={form.brand || ""}
                suggestions={brandSuggestions}
                onChange={(value) => update("brand", value)}
                placeholder="Escribir"
              />
            </Field>
            <Field label="Serie"><input className={inputClass} value={form.serial_number || ""} onChange={(e) => update("serial_number", e.target.value)} /></Field>
            <Field label="Rango"><input className={inputClass} value={form.range_value || ""} onChange={(e) => update("range_value", e.target.value)} /></Field>
            <Field label="Unidad rango">
              <CatalogAutocomplete
                value={form.unit || ""}
                suggestions={unitSuggestions}
                onDeleteSuggestion={handleDeleteSuggestion}
                onChange={(value) => update("unit", value)}
              />
            </Field>
            <Field label="Size">
              <CatalogAutocomplete
                value={form.size_value || ""}
                suggestions={sizeSuggestions}
                onDeleteSuggestion={handleDeleteSuggestion}
                onChange={(value) => update("size_value", value)}
              />
            </Field>
            <Field label="Unidad ensayo">
              <CatalogAutocomplete
                value={form.measurement_unit || ""}
                suggestions={unitSuggestions}
                onDeleteSuggestion={handleDeleteSuggestion}
                onChange={(value) => update("measurement_unit", value)}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Trazabilidad y datos requeridos</h3>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Unidad / equipo MD"><input className={inputClass} value={form.asset_unit_code || ""} onChange={(e) => update("asset_unit_code", e.target.value)} placeholder="Ej. U.506 / Equipo 508" /></Field>
            <Field label="Responsable"><input className={requiredInputClass(form.responsible_name)} value={form.responsible_name || ""} onChange={(e) => update("responsible_name", e.target.value)} /></Field>
            <Field label="Matrícula / aclaración"><input className={requiredInputClass(form.responsible_license)} value={form.responsible_license || ""} onChange={(e) => update("responsible_license", e.target.value)} /></Field>
            <Field label="Nº precinto"><input className={inputClass} value={form.seal_number || ""} onChange={(e) => { update("seal_number", e.target.value); updateRelief("seal_number", e.target.value); }} /></Field>
            <Field label="Medio de prueba"><input className={inputClass} value={form.test_medium || ""} onChange={(e) => { update("test_medium", e.target.value); updateRelief("test_medium", e.target.value); updateHydro("test_medium", e.target.value); }} placeholder="Agua / Aire / Aceite" /></Field>
            <Field label="Temperatura ambiente"><input className={requiredInputClass(form.ambient_temperature)} value={form.ambient_temperature || ""} onChange={(e) => { update("ambient_temperature", e.target.value); updateRelief("ambient_temperature", e.target.value); }} /></Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Ensayo y resultado</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tipo de prueba">
              <CatalogAutocomplete
                value={form.test_type || ""}
                suggestions={testTypeSuggestions}
                onDeleteSuggestion={handleDeleteSuggestion}
                onChange={(value) => update("test_type", value)}
              />
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
                    <td className="p-2">
                      <CatalogAutocomplete
                        value={row.pressure_label}
                        suggestions={pressureLabelSuggestions}
                        onDeleteSuggestion={handleDeleteSuggestion}
                        onChange={(value) => updateTestRow(index, "pressure_label", value)}
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <input className={inputClass} type="number" value={row.range_value ?? ""} onChange={(e) => updateTestRow(index, "range_value", e.target.value)} />
                        <div className="w-32 shrink-0">
                          <CatalogAutocomplete
                            value={row.unit || ""}
                            suggestions={unitSuggestions}
                            onDeleteSuggestion={handleDeleteSuggestion}
                            onChange={(value) => updateTestRow(index, "unit", value)}
                          />
                        </div>
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

        {form.template_type === "pressure_gauge" ? (
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Tabla metrológica - Patrón vs instrumento MD</h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Punto</th><th className="p-3">Dir.</th><th className="p-3">Patrón</th><th className="p-3">Instrumento MD</th><th className="p-3">Error</th><th className="p-3">Error adm.</th><th className="p-3">Incert.</th><th className="p-3">Unidad</th><th className="p-3">Resultado</th></tr></thead>
                <tbody>{(form.metrology_results || []).map((row, index) => <tr key={index} className="border-t border-slate-100"><td className="p-2"><input className={inputClass} value={row.point_label || ""} onChange={(e) => updateMetrologyRow(index,"point_label",e.target.value)} /></td><td className="p-2"><select className={inputClass} value={row.direction || "unico"} onChange={(e) => updateMetrologyRow(index,"direction",e.target.value)}><option value="unico">Único</option><option value="ascendente">Ascendente</option><option value="descendente">Descendente</option></select></td><td className="p-2"><input className={inputClass} type="number" value={row.pattern_pressure ?? ""} onChange={(e) => updateMetrologyRow(index,"pattern_pressure",e.target.value)} /></td><td className="p-2"><input className={inputClass} type="number" value={row.instrument_reading ?? ""} onChange={(e) => updateMetrologyRow(index,"instrument_reading",e.target.value)} /></td><td className="p-2"><input className={inputClass} type="number" value={row.error_value ?? ""} onChange={(e) => updateMetrologyRow(index,"error_value",e.target.value)} /></td><td className="p-2"><input className={inputClass} type="number" value={row.max_allowed_error ?? ""} onChange={(e) => updateMetrologyRow(index,"max_allowed_error",e.target.value)} /></td><td className="p-2"><input className={inputClass} type="number" value={row.uncertainty ?? ""} onChange={(e) => updateMetrologyRow(index,"uncertainty",e.target.value)} /></td><td className="p-2"><input className={inputClass} value={row.unit || form.unit || "PSI"} onChange={(e) => updateMetrologyRow(index,"unit",e.target.value)} /></td><td className="p-2"><input className={inputClass} value={row.result || ""} onChange={(e) => updateMetrologyRow(index,"result",e.target.value)} /></td></tr>)}</tbody>
              </table>
            </div>
          </section>
        ) : null}

        {form.template_type === "pressure_head_sensor" ? (
          <section className="space-y-4"><h3 className="text-sm font-bold text-slate-900">Tabla de lazo eléctrico</h3><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[980px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Presión</th><th className="p-3">Patrón</th><th className="p-3">Señal esperada</th><th className="p-3">Señal medida</th><th className="p-3">Unidad señal</th><th className="p-3">Lectura pantalla</th><th className="p-3">Error</th><th className="p-3">Resultado</th></tr></thead><tbody>{(form.sensor_loop_results || []).map((row, index) => <tr key={index} className="border-t border-slate-100"><td className="p-2"><input className={inputClass} type="number" value={row.pressure_applied ?? ""} onChange={(e) => updateSensorRow(index,"pressure_applied",e.target.value)} /></td><td className="p-2"><input className={inputClass} type="number" value={row.pattern_reading ?? ""} onChange={(e) => updateSensorRow(index,"pattern_reading",e.target.value)} /></td><td className="p-2"><input className={inputClass} type="number" value={row.expected_signal ?? ""} onChange={(e) => updateSensorRow(index,"expected_signal",e.target.value)} /></td><td className="p-2"><input className={inputClass} type="number" value={row.measured_signal ?? ""} onChange={(e) => updateSensorRow(index,"measured_signal",e.target.value)} /></td><td className="p-2"><input className={inputClass} value={row.signal_unit || "mA"} onChange={(e) => updateSensorRow(index,"signal_unit",e.target.value)} /></td><td className="p-2"><input className={inputClass} type="number" value={row.display_reading ?? ""} onChange={(e) => updateSensorRow(index,"display_reading",e.target.value)} /></td><td className="p-2"><input className={inputClass} type="number" value={row.error_value ?? ""} onChange={(e) => updateSensorRow(index,"error_value",e.target.value)} /></td><td className="p-2"><input className={inputClass} value={row.result || ""} onChange={(e) => updateSensorRow(index,"result",e.target.value)} /></td></tr>)}</tbody></table></div></section>
        ) : null}

        {form.template_type === "relief_valve_set" ? (
          <section className="space-y-4"><h3 className="text-sm font-bold text-slate-900">Ensayo de apertura / seteo de válvula</h3><div className="grid gap-4 md:grid-cols-4"><Field label="Presión seteo requerida"><input className={inputClass} type="number" value={form.relief_valve_result?.set_pressure_required ?? ""} onChange={(e)=>updateRelief("set_pressure_required",e.target.value)} /></Field><Field label="Presión apertura real"><input className={inputClass} type="number" value={form.relief_valve_result?.opening_pressure ?? ""} onChange={(e)=>updateRelief("opening_pressure",e.target.value)} /></Field><Field label="Reasentamiento / cierre"><input className={inputClass} type="number" value={form.relief_valve_result?.reclosing_pressure ?? ""} onChange={(e)=>updateRelief("reclosing_pressure",e.target.value)} /></Field><Field label="Hermeticidad asiento"><input className={inputClass} type="number" value={form.relief_valve_result?.leak_test_pressure ?? ""} onChange={(e)=>updateRelief("leak_test_pressure",e.target.value)} /></Field><Field label="Resultado hermeticidad"><input className={inputClass} value={form.relief_valve_result?.leak_test_result || ""} onChange={(e)=>updateRelief("leak_test_result",e.target.value)} /></Field><Field label="Resultado final"><input className={inputClass} value={form.relief_valve_result?.result || "APTO"} onChange={(e)=>updateRelief("result",e.target.value)} /></Field><Field label="Observaciones"><input className={inputClass} value={form.relief_valve_result?.observations || ""} onChange={(e)=>updateRelief("observations",e.target.value)} /></Field></div></section>
        ) : null}

        {form.template_type === "hydrostatic_line" ? (
          <section className="space-y-4"><h3 className="text-sm font-bold text-slate-900">Ensayo hidrostático</h3><div className="grid gap-4 md:grid-cols-4"><Field label="Presión trabajo"><input className={inputClass} type="number" value={form.hydrostatic_result?.work_pressure ?? ""} onChange={(e)=>updateHydro("work_pressure",e.target.value)} /></Field><Field label="Presión prueba"><input className={inputClass} type="number" value={form.hydrostatic_result?.test_pressure ?? ""} onChange={(e)=>updateHydro("test_pressure",e.target.value)} /></Field><Field label="Minutos sostenimiento"><input className={inputClass} type="number" value={form.hydrostatic_result?.hold_minutes ?? 15} onChange={(e)=>updateHydro("hold_minutes",e.target.value)} /></Field><Field label="Caída presión"><input className={inputClass} type="number" value={form.hydrostatic_result?.pressure_drop ?? ""} onChange={(e)=>updateHydro("pressure_drop",e.target.value)} /></Field><Field label="Control espesores"><label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3"><input type="checkbox" checked={Boolean(form.hydrostatic_result?.thickness_control)} onChange={(e)=>updateHydro("thickness_control",e.target.checked)} /> Realizado</label></Field><Field label="Método espesores"><input className={inputClass} value={form.hydrostatic_result?.thickness_method || ""} onChange={(e)=>updateHydro("thickness_method",e.target.value)} /></Field><Field label="Valores espesores"><input className={inputClass} value={form.hydrostatic_result?.thickness_values || ""} onChange={(e)=>updateHydro("thickness_values",e.target.value)} /></Field><Field label="Resultado"><input className={inputClass} value={form.hydrostatic_result?.result || "APTO"} onChange={(e)=>updateHydro("result",e.target.value)} /></Field></div></section>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-slate-500">
            Los campos con sugerencias permiten escribir valores nuevos. Al guardar, si no existen, se agregan al catálogo para la próxima carga. El certificado queda en <strong>pendiente de aprobación</strong>.
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
