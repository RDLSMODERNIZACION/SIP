"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/src/components/layout/AppShell";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Field, inputClass } from "@/src/components/ui/Field";
import { Modal } from "@/src/components/ui/Modal";
import {
  createEquipment,
  deleteEquipment,
  getClients,
  getEquipment,
  updateEquipment,
  type EquipmentPayload,
} from "@/src/lib/resourcesApi";
import type { Client, Equipment } from "@/src/types";

type EquipmentFormState = {
  client_id: string;
  name: string;
  element: string;
  type_model: string;
  brand: string;
  serial_number: string;
  range_value: string;
  unit: string;
  size_value: string;
  internal_code: string;
  location: string;
  notes: string;
};

const emptyForm: EquipmentFormState = {
  client_id: "",
  name: "",
  element: "",
  type_model: "",
  brand: "",
  serial_number: "",
  range_value: "",
  unit: "",
  size_value: "",
  internal_code: "",
  location: "",
  notes: "",
};

function clean(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

function toForm(item: Equipment | null, fallbackClientId = ""): EquipmentFormState {
  if (!item) {
    return { ...emptyForm, client_id: fallbackClientId };
  }

  return {
    client_id: item.client_id || fallbackClientId,
    name: item.name || "",
    element: item.element || "",
    type_model: item.type_model || "",
    brand: item.brand || "",
    serial_number: item.serial_number || "",
    range_value: item.range_value || "",
    unit: item.unit || "",
    size_value: item.size_value || "",
    internal_code: item.internal_code || "",
    location: item.location || "",
    notes: item.notes || "",
  };
}

function toPayload(form: EquipmentFormState): EquipmentPayload {
  return {
    client_id: form.client_id,
    name: form.name.trim(),
    element: clean(form.element),
    type_model: clean(form.type_model),
    brand: clean(form.brand),
    serial_number: clean(form.serial_number),
    range_value: clean(form.range_value),
    unit: clean(form.unit),
    size_value: clean(form.size_value),
    internal_code: clean(form.internal_code),
    location: clean(form.location),
    notes: clean(form.notes),
  };
}

function equipmentLabel(equipment: Equipment) {
  const serial = equipment.serial_number ? ` - Serie ${equipment.serial_number}` : "";
  return `${equipment.name || equipment.element || "Equipo"}${serial}`;
}

export default function EquipmentView() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [equipment, clientsData] = await Promise.all([getEquipment({ q }), getClients()]);
      setItems(equipment);
      setClients(clientsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar equipos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setSelected(null);
    setOpen(true);
  }

  function openEdit(item: Equipment) {
    setSelected(item);
    setOpen(true);
  }

  async function handleDelete(item: Equipment) {
    const confirmed = window.confirm(
      `¿Eliminar definitivamente el equipo "${equipmentLabel(item)}"?\n\nEl certificado histórico conserva los datos cargados, pero el equipo dejará de aparecer en el listado.`
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      setError(null);
      await deleteEquipment(item.id, true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el equipo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="Equipos" description="Legajo digital de equipos certificados por cliente.">
      <Card>
        <CardHeader
          title="Equipos"
          description="Cada certificado puede quedar asociado a un equipo y su historial."
          action={<Button onClick={openCreate}>Nuevo equipo</Button>}
        />
        <CardContent>
          <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto]">
            <Field label="Buscar">
              <input
                className={inputClass}
                value={q}
                onChange={(event) => setQ(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") load();
                }}
                placeholder="Equipo, serie, marca..."
              />
            </Field>
            <div className="flex items-end">
              <Button variant="secondary" onClick={load}>
                Buscar
              </Button>
            </div>
          </div>

          {error ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {loading ? <div className="text-sm text-slate-500">Cargando...</div> : null}
          {!loading && items.length === 0 ? <EmptyState title="No hay equipos" /> : null}

          {items.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full min-w-[1050px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-4">Equipo</th>
                    <th className="p-4">Cliente</th>
                    <th className="p-4">Elemento</th>
                    <th className="p-4">Marca</th>
                    <th className="p-4">Serie</th>
                    <th className="p-4">Rango</th>
                    <th className="p-4">Ubicación</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="p-4 font-bold">{item.name}</td>
                      <td className="p-4">{item.client_name || "—"}</td>
                      <td className="p-4">{item.element || "—"}</td>
                      <td className="p-4">{item.brand || "—"}</td>
                      <td className="p-4">{item.serial_number || "—"}</td>
                      <td className="p-4">
                        {item.range_value || "—"} {item.unit || ""}
                      </td>
                      <td className="p-4">{item.location || "—"}</td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="secondary" onClick={() => openEdit(item)}>
                            Editar
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => handleDelete(item)}>
                            Eliminar
                          </Button>
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

      <EquipmentModal
        open={open}
        item={selected}
        onClose={() => setOpen(false)}
        onSaved={load}
        clients={clients}
      />
    </AppShell>
  );
}

function EquipmentModal({
  open,
  item,
  onClose,
  onSaved,
  clients,
}: {
  open: boolean;
  item: Equipment | null;
  onClose: () => void;
  onSaved: () => void;
  clients: Client[];
}) {
  const fallbackClientId = clients[0]?.id || "";
  const [form, setForm] = useState<EquipmentFormState>(() => toForm(item, fallbackClientId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(item?.id);
  const title = isEdit ? "Editar equipo" : "Nuevo equipo";

  useEffect(() => {
    if (open) {
      setForm(toForm(item, fallbackClientId));
      setError(null);
    }
  }, [open, item, fallbackClientId]);

  const selectedClientName = useMemo(() => {
    return clients.find((client) => client.id === form.client_id)?.name || "";
  }, [clients, form.client_id]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!form.client_id) {
      setError("Seleccioná un cliente.");
      return;
    }

    if (!form.name.trim()) {
      setError("El nombre del equipo es obligatorio.");
      return;
    }

    try {
      setSaving(true);
      const payload = toPayload(form);
      if (isEdit && item?.id) {
        await updateEquipment(item.id, payload);
      } else {
        await createEquipment(payload);
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el equipo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <form onSubmit={submit} className="space-y-5">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-4 text-sm font-bold text-slate-900">Datos principales</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Cliente">
              <select
                className={inputClass}
                value={form.client_id}
                onChange={(event) => setForm({ ...form, client_id: event.target.value })}
                required
              >
                <option value="">Seleccionar</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} {client.cuit ? `- ${client.cuit}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nombre del equipo">
              <input
                className={inputClass}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Ej. Compresor de aire Carter Seco"
                required
              />
            </Field>
          </div>
          {selectedClientName ? (
            <p className="mt-3 text-xs text-slate-500">Cliente seleccionado: {selectedClientName}</p>
          ) : null}
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Datos técnicos</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Elemento">
              <input className={inputClass} value={form.element} onChange={(event) => setForm({ ...form, element: event.target.value })} />
            </Field>
            <Field label="Tipo / Modelo">
              <input className={inputClass} value={form.type_model} onChange={(event) => setForm({ ...form, type_model: event.target.value })} />
            </Field>
            <Field label="Marca">
              <input className={inputClass} value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
            </Field>
            <Field label="Serie">
              <input className={inputClass} value={form.serial_number} onChange={(event) => setForm({ ...form, serial_number: event.target.value })} />
            </Field>
            <Field label="Rango">
              <input className={inputClass} value={form.range_value} onChange={(event) => setForm({ ...form, range_value: event.target.value })} />
            </Field>
            <Field label="Unidad">
              <input className={inputClass} value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} />
            </Field>
            <Field label="Size">
              <input className={inputClass} value={form.size_value} onChange={(event) => setForm({ ...form, size_value: event.target.value })} />
            </Field>
            <Field label="Código interno">
              <input className={inputClass} value={form.internal_code} onChange={(event) => setForm({ ...form, internal_code: event.target.value })} />
            </Field>
            <Field label="Ubicación">
              <input className={inputClass} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
            </Field>
          </div>
          <Field label="Notas">
            <textarea
              className={inputClass}
              rows={3}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </Field>
        </section>

        {isEdit ? (
          <section className="rounded-2xl border border-red-100 bg-red-50 p-4">
            <h3 className="text-sm font-bold text-red-900">Zona de eliminación</h3>
            <p className="mt-1 text-xs text-red-700">
              La eliminación se realiza desde la tabla de equipos para evitar borrar el registro por error mientras se edita.
            </p>
          </section>
        ) : null}

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar equipo"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
