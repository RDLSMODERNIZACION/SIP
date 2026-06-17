"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/src/components/layout/AppShell";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Field, inputClass } from "@/src/components/ui/Field";
import { Modal } from "@/src/components/ui/Modal";
import {
  createCatalogItem,
  deleteCatalogItem,
  getCatalogDefinitions,
  getCatalogItems,
  updateCatalogItem,
  type CatalogCode,
  type CatalogDefinition,
  type CatalogItem,
} from "@/src/lib/catalogsApi";
import { useAuth } from "@/src/context/AuthContext";

const FALLBACK_DEFINITIONS: CatalogDefinition[] = [
  { code: "units", label: "Unidades", fields: ["name", "active"] },
  { code: "test-types", label: "Tipos de prueba", fields: ["name", "active"] },
  { code: "elements", label: "Elementos", fields: ["name", "default_frequency_months", "active"] },
  { code: "element-models", label: "Modelos", fields: ["element_name", "part_1", "part_2", "part_3", "full_name", "active"] },
  { code: "sizes", label: "Sizes", fields: ["name", "active"] },
  { code: "frequencies", label: "Frecuencias", fields: ["name", "months", "active"] },
  { code: "pressure-rows", label: "Filas presión", fields: ["name", "row_order", "active"] },
  { code: "payment-terms", label: "Condiciones pago", fields: ["name", "active"] },
  { code: "pricing", label: "Precios y tiempos", fields: ["element_name", "type_name", "price", "estimated_minutes", "active"] },
];

const labels: Record<string, string> = {
  name: "Nombre",
  element_name: "Elemento",
  default_frequency_months: "Frecuencia default",
  part_1: "Parte 1",
  part_2: "Parte 2",
  part_3: "Parte 3",
  full_name: "Nombre completo",
  months: "Meses",
  row_order: "Orden",
  type_name: "Tipo",
  price: "Precio",
  estimated_minutes: "Minutos estimados",
  active: "Activo",
};

const numericFields = new Set(["default_frequency_months", "months", "row_order", "price", "estimated_minutes"]);

function visibleValue(item: CatalogItem, field: string) {
  const value = item[field as keyof CatalogItem];
  if (typeof value === "boolean") return value ? "Activo" : "Inactivo";
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export default function CatalogsView() {
  const { user } = useAuth();
  const [definitions, setDefinitions] = useState<CatalogDefinition[]>(FALLBACK_DEFINITIONS);
  const [catalog, setCatalog] = useState<CatalogCode>("elements");
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [open, setOpen] = useState(false);

  const currentDefinition = useMemo(
    () => definitions.find((d) => d.code === catalog) || FALLBACK_DEFINITIONS[0],
    [definitions, catalog]
  );

  async function loadDefinitions() {
    try {
      setDefinitions(await getCatalogDefinitions());
    } catch {
      setDefinitions(FALLBACK_DEFINITIONS);
    }
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setItems(await getCatalogItems(catalog, { q, active: showInactive ? undefined : true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el catálogo");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDefinitions();
  }, []);

  useEffect(() => {
    load();
  }, [catalog, showInactive]);

  function newItem() {
    setEditing(null);
    setOpen(true);
  }

  function editItem(item: CatalogItem) {
    setEditing(item);
    setOpen(true);
  }

  async function removeItem(item: CatalogItem) {
    const name = item.name || item.full_name || item.type_name || item.element_name || "este registro";
    const ok = window.confirm(`¿Querés desactivar ${name}? No se borra definitivamente, queda inactivo.`);
    if (!ok) return;
    await deleteCatalogItem(catalog, item.id);
    await load();
  }

  if (user?.role_code !== "admin") {
    return (
      <AppShell title="Catálogos" description="Administración de datos maestros.">
        <Card>
          <CardContent>
            <EmptyState title="No tenés permisos" description="Solo el administrador puede editar los catálogos maestros." />
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Catálogos maestros" description="Datos del sistema anterior limpiados para acelerar la creación de certificados.">
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader title="Catálogos" description="Seleccioná qué base editar." />
          <CardContent className="space-y-2">
            {definitions.map((def) => (
              <button
                key={def.code}
                onClick={() => setCatalog(def.code)}
                className={`w-full rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                  catalog === def.code ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {def.label}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title={currentDefinition.label}
            description="Podés agregar, editar o desactivar valores. Estos datos se usan en los formularios de certificados."
            action={<Button onClick={newItem}>Nuevo registro</Button>}
          />
          <CardContent>
            <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <Field label="Buscar">
                <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en el catálogo" />
              </Field>
              <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-slate-600">
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                Ver inactivos
              </label>
              <div className="flex items-end">
                <Button variant="secondary" onClick={load}>Buscar</Button>
              </div>
            </div>

            {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
            {loading ? <div className="text-sm text-slate-500">Cargando...</div> : null}
            {!loading && items.length === 0 ? <EmptyState title="No hay registros" /> : null}

            {items.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      {currentDefinition.fields.map((field) => <th key={field} className="p-4">{labels[field] || field}</th>)}
                      <th className="p-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        {currentDefinition.fields.map((field) => (
                          <td key={field} className={`p-4 ${field === "name" || field === "full_name" ? "font-semibold" : ""}`}>
                            {visibleValue(item, field)}
                          </td>
                        ))}
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="secondary" onClick={() => editItem(item)}>Editar</Button>
                            {item.active !== false ? <Button type="button" variant="danger" onClick={() => removeItem(item)}>Desactivar</Button> : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <CatalogModal
        open={open}
        onClose={() => setOpen(false)}
        definition={currentDefinition}
        item={editing}
        onSaved={async () => {
          setOpen(false);
          await load();
        }}
      />
    </AppShell>
  );
}

function CatalogModal({
  open,
  onClose,
  definition,
  item,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  definition: CatalogDefinition;
  item: CatalogItem | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const initial: Record<string, any> = {};
    for (const field of definition.fields) {
      if (field === "active") initial[field] = item?.active ?? true;
      else initial[field] = (item as any)?.[field] ?? "";
    }
    setForm(initial);
    setError(null);
  }, [open, item, definition]);

  function update(field: string, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const payload: Record<string, any> = {};
      for (const field of definition.fields) {
        const value = form[field];
        if (field === "active") payload[field] = Boolean(value);
        else if (numericFields.has(field)) payload[field] = value === "" || value === null ? null : Number(value);
        else payload[field] = value;
      }
      if (item?.id) await updateCatalogItem(definition.code, item.id, payload);
      else await createCatalogItem(definition.code, payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el registro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={item ? "Editar registro" : "Nuevo registro"}>
      <form onSubmit={submit} className="space-y-4">
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
        <div className="grid gap-4 md:grid-cols-2">
          {definition.fields.map((field) => {
            if (field === "active") {
              return (
                <label key={field} className="flex items-center gap-2 pt-7 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={Boolean(form[field])} onChange={(e) => update(field, e.target.checked)} />
                  Activo
                </label>
              );
            }
            return (
              <Field key={field} label={labels[field] || field}>
                <input
                  className={inputClass}
                  type={numericFields.has(field) ? "number" : "text"}
                  step={field === "price" || field === "estimated_minutes" ? "0.01" : undefined}
                  value={form[field] ?? ""}
                  onChange={(e) => update(field, e.target.value)}
                  required={field === "name" || field === "full_name" || field === "element_name"}
                />
              </Field>
            );
          })}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
        </div>
      </form>
    </Modal>
  );
}
