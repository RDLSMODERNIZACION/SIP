"use client";

import { FormEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/src/components/ui/Modal";
import { Button } from "@/src/components/ui/Button";
import { Field, inputClass } from "@/src/components/ui/Field";
import {
  createCertificatePending,
  getNextCertificateNumber,
  type CertificateCreatePayload,
} from "@/src/lib/certificatesApi";
import { createEquipment, getClients, getEquipment, getPatterns } from "@/src/lib/resourcesApi";
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
const DEFAULT_FREQUENCY_MONTHS = 60;

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
      return;
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

function uniqueEquipment(items: Equipment[]) {
  const result: Equipment[] = [];
  items.forEach((item) => {
    if (!item?.id) return;
    if (!result.some((current) => current.id === item.id)) result.push(item);
  });
  return result;
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
    const canDeleteCatalog = Boolean(item.id && item.catalog);
    if (!canDeleteCatalog || !onDeleteSuggestion) return;
    const confirmed = window.confirm(`¿Eliminar "${item.label}" de las sugerencias?`);
    if (!confirmed) return;

    try {
      setDeletingId(item.id || item.label);
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
            const deleteKey = item.id || item.label;
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
                    disabled={deletingId === deleteKey}
                  >
                    {deletingId === deleteKey ? "…" : "×"}
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
  const [brands, setBrands] = useState<CatalogItem[]>([]);
  const [serialNumbers, setSerialNumbers] = useState<CatalogItem[]>([]);
  const [ranges, setRanges] = useState<CatalogItem[]>([]);
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
    const [
      c,
      e,
      p,
      next,
      catUnits,
      catTestTypes,
      catElements,
      catElementModels,
      catSizes,
      catBrands,
      catSerialNumbers,
      catRanges,
      catFrequencies,
      catPressureRows,
    ] = await Promise.all([
      getClients(),
      getEquipment(),
      getPatterns(),
      getNextCertificateNumber({ prefix: "SIP" }),
      getCatalogItems("units", { active: true }),
      getCatalogItems("test-types", { active: true }),
      getCatalogItems("elements", { active: true }),
      getCatalogItems("element-models", { active: true }),
      getCatalogItems("sizes", { active: true }),
      getCatalogItems("brands", { active: true }),
      getCatalogItems("serial-numbers", { active: true }),
      getCatalogItems("ranges", { active: true }),
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
    setBrands(catBrands);
    setSerialNumbers(catSerialNumbers);
    setRanges(catRanges);
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

  const elementSuggestions = useMemo(
    () => uniqueSuggestionItems([
      ...elements.map((item) => ({ label: textValue(item), id: item.id, catalog: "elements" as CatalogCode })),
      { label: form.element || "" },
    ]),
    [elements, form.element]
  );

  const typeModelSuggestions = useMemo(
    () => uniqueSuggestionItems([
      ...filteredElementModels.map((item) => ({ label: textValue(item, "full_name"), id: item.id, catalog: "element-models" as CatalogCode })),
      { label: form.type_model || "" },
    ]),
    [filteredElementModels, form.type_model]
  );

  const unitSuggestions = useMemo(
    () => uniqueSuggestionItems([
      ...units.map((item) => ({ label: textValue(item), id: item.id, catalog: "units" as CatalogCode })),
      { label: form.unit || "" },
      { label: form.measurement_unit || "" },
    ]),
    [units, form.unit, form.measurement_unit]
  );

  const sizeSuggestions = useMemo(
    () => uniqueSuggestionItems([
      ...sizes.map((item) => ({ label: textValue(item), id: item.id, catalog: "sizes" as CatalogCode })),
      { label: form.size_value || "" },
    ]),
    [sizes, form.size_value]
  );

  const brandSuggestions = useMemo(
    () =>
      uniqueSuggestionItems([
        ...brands.map((item) => ({ label: textValue(item), id: item.id, catalog: "brands" as CatalogCode })),
        { label: form.brand || "" },
      ]),
    [brands, form.brand]
  );

  const serialSuggestions = useMemo(
    () =>
      uniqueSuggestionItems([
        ...serialNumbers.map((item) => ({ label: textValue(item), id: item.id, catalog: "serial-numbers" as CatalogCode })),
        { label: form.serial_number || "" },
      ]),
    [serialNumbers, form.serial_number]
  );

  const rangeSuggestions = useMemo(
    () =>
      uniqueSuggestionItems([
        ...ranges.map((item) => ({ label: textValue(item), id: item.id, catalog: "ranges" as CatalogCode })),
        { label: form.range_value || "" },
      ]),
    [ranges, form.range_value]
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
    setError(null);
    try {
      if (item.catalog && item.id) {
        await deleteCatalogItem(item.catalog, item.id, false);
        if (item.catalog === "elements") setElements((prev) => prev.filter((current) => current.id !== item.id));
        if (item.catalog === "element-models") setElementModels((prev) => prev.filter((current) => current.id !== item.id));
        if (item.catalog === "units") setUnits((prev) => prev.filter((current) => current.id !== item.id));
        if (item.catalog === "sizes") setSizes((prev) => prev.filter((current) => current.id !== item.id));
        if (item.catalog === "brands") setBrands((prev) => prev.filter((current) => current.id !== item.id));
        if (item.catalog === "serial-numbers") setSerialNumbers((prev) => prev.filter((current) => current.id !== item.id));
        if (item.catalog === "ranges") setRanges((prev) => prev.filter((current) => current.id !== item.id));
        if (item.catalog === "test-types") setTestTypes((prev) => prev.filter((current) => current.id !== item.id));
        if (item.catalog === "pressure-rows") setPressureRows((prev) => prev.filter((current) => current.id !== item.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la sugerencia");
      throw err;
    }
  }

  function buildEquipmentName(payload: CertificateCreatePayload) {
    const parts = [
      normalizeText(payload.element),
      normalizeText(payload.type_model),
      normalizeText(payload.brand),
    ].filter(Boolean);

    const baseName = parts.length > 0 ? parts.join(" ") : "Equipo sin nombre";
    const serial = normalizeText(payload.serial_number);
    return serial ? `${baseName} - Serie ${serial}` : baseName;
  }

  function findExistingEquipmentReference(payload: CertificateCreatePayload) {
    const serial = normalizeText(payload.serial_number);
    const element = normalizeText(payload.element);
    const typeModel = normalizeText(payload.type_model);
    const brand = normalizeText(payload.brand);
    const range = normalizeText(payload.range_value);
    const unit = normalizeText(payload.unit);
    const size = normalizeText(payload.size_value);

    if (payload.equipment_id) {
      return equipment.find((item) => item.id === payload.equipment_id) || null;
    }

    if (serial) {
      const bySerial = equipment.find(
        (item) => item.client_id === payload.client_id && sameText(item.serial_number, serial)
      );
      if (bySerial) return bySerial;
    }

    return (
      equipment.find(
        (item) =>
          item.client_id === payload.client_id &&
          sameText(item.element, element) &&
          sameText(item.type_model, typeModel) &&
          sameText(item.brand, brand) &&
          sameText(item.range_value, range) &&
          sameText(item.unit, unit) &&
          sameText(item.size_value, size)
      ) || null
    );
  }

  async function saveEquipmentReference(payload: CertificateCreatePayload) {
    const hasUsefulEquipmentData = [
      payload.element,
      payload.type_model,
      payload.brand,
      payload.serial_number,
      payload.range_value,
      payload.unit,
      payload.size_value,
    ].some((value) => normalizeText(value));

    if (!payload.client_id || !hasUsefulEquipmentData) return payload;

    const existing = findExistingEquipmentReference(payload);
    if (existing) {
      return { ...payload, equipment_id: existing.id };
    }

    try {
      const created = await createEquipment({
        client_id: payload.client_id,
        name: buildEquipmentName(payload),
        element: normalizeText(payload.element),
        type_model: normalizeText(payload.type_model),
        brand: normalizeText(payload.brand),
        serial_number: normalizeText(payload.serial_number),
        range_value: normalizeText(payload.range_value),
        unit: normalizeText(payload.unit),
        size_value: normalizeText(payload.size_value),
        active: true,
      });

      setEquipment((prev) => uniqueEquipment([...prev, created]));
      return { ...payload, equipment_id: created.id };
    } catch (err) {
      console.warn("No se pudo guardar el equipo como referencia. Se crea el certificado igual.", err);
      return payload;
    }
  }

  async function saveNewCatalogSuggestions(payload: CertificateCreatePayload) {
    const tasks: Array<Promise<unknown>> = [];
    const element = normalizeText(payload.element);
    const typeModel = normalizeText(payload.type_model);
    const unit = normalizeText(payload.unit);
    const measurementUnit = normalizeText(payload.measurement_unit);
    const size = normalizeText(payload.size_value);
    const brand = normalizeText(payload.brand);
    const serialNumber = normalizeText(payload.serial_number);
    const range = normalizeText(payload.range_value);
    const testType = normalizeText(payload.test_type);

    if (element) tasks.push(ensureCatalogItem("elements", { name: element }));
    if (typeModel && element) {
      tasks.push(ensureCatalogItem("element-models", { element_name: element, full_name: typeModel }));
    }
    if (unit) tasks.push(ensureCatalogItem("units", { name: unit }));
    if (measurementUnit && !sameText(measurementUnit, unit)) tasks.push(ensureCatalogItem("units", { name: measurementUnit }));
    if (size) tasks.push(ensureCatalogItem("sizes", { name: size }));
    if (brand) tasks.push(ensureCatalogItem("brands", { name: brand }));
    if (serialNumber) tasks.push(ensureCatalogItem("serial-numbers", { name: serialNumber }));
    if (range) tasks.push(ensureCatalogItem("ranges", { name: range }));
    if (testType) tasks.push(ensureCatalogItem("test-types", { name: testType }));

    (payload.test_rows || []).forEach((row, index) => {
      const label = normalizeText(row.pressure_label);
      if (label) tasks.push(ensureCatalogItem("pressure-rows", { name: label, row_order: row.row_order || index + 1 }));
      const rowUnit = normalizeText(row.unit);
      if (rowUnit) tasks.push(ensureCatalogItem("units", { name: rowUnit }));
    });

    await settleCatalogSaves(tasks);
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

    try {
      setLoading(true);
      const payload = {
        ...form,
        certificate_number: form.certificate_number.trim().toUpperCase(),
        certificate_code: form.certificate_code || FIXED_CERTIFICATE_CODE,
        certificate_revision: form.certificate_revision || FIXED_CERTIFICATE_REVISION,
        certificate_validity: form.certificate_validity || FIXED_CERTIFICATE_VALIDITY,
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
      const payloadWithEquipment = await saveEquipmentReference(payload);
      await createCertificatePending(payloadWithEquipment);
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
                onDeleteSuggestion={handleDeleteSuggestion}
                onChange={(value) => update("brand", value)}
                placeholder="Escribir"
              />
            </Field>
            <Field label="Serie">
              <CatalogAutocomplete
                value={form.serial_number || ""}
                suggestions={serialSuggestions}
                onDeleteSuggestion={handleDeleteSuggestion}
                onChange={(value) => update("serial_number", value)}
                placeholder="Escribir"
              />
            </Field>
            <Field label="Rango">
              <CatalogAutocomplete
                value={form.range_value || ""}
                suggestions={rangeSuggestions}
                onDeleteSuggestion={handleDeleteSuggestion}
                onChange={(value) => update("range_value", value)}
                placeholder="Escribir"
              />
            </Field>
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
