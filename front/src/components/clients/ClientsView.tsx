"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/src/components/layout/AppShell";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Field, inputClass } from "@/src/components/ui/Field";
import { Modal } from "@/src/components/ui/Modal";
import { createClient, deactivateClient, deleteClient, getClients, updateClient } from "@/src/lib/resourcesApi";
import { useAuth } from "@/src/context/AuthContext";
import type { Client } from "@/src/types";

const emptyClientForm = {
  name: "",
  legal_name: "",
  cuit: "",
  email: "",
  phone: "",
  address: "",
  city: "Rincón de los Sauces",
  province: "Neuquén",
  country: "Argentina",
  notes: "",
  active: true,
};

export default function ClientsView() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = user?.role_code === "admin" || user?.role_code === "certificador";
  const canDelete = user?.role_code === "admin";

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setClients(await getClients(q));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar clientes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    setOpen(true);
  }

  async function toggleActive(client: Client) {
    try {
      setError(null);
      if (client.active === false) {
        await updateClient(client.id, { active: true });
      } else {
        const ok = window.confirm(`¿Querés desactivar ${client.name}? No se borra el historial.`);
        if (!ok) return;
        await deactivateClient(client.id);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el estado del cliente");
    }
  }

  return (
    <AppShell title="Clientes" description="Alta, edición y consulta de empresas asociadas a certificados.">
      <Card>
        <CardHeader
          title="Clientes"
          description="Base de clientes importada desde el sistema anterior y editable desde la app."
          action={canManage ? <Button onClick={openNew}>Nuevo cliente</Button> : null}
        />
        <CardContent>
          <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto]">
            <Field label="Buscar">
              <input
                className={inputClass}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nombre, CUIT o email"
              />
            </Field>
            <div className="flex items-end">
              <Button variant="secondary" onClick={load}>Buscar</Button>
            </div>
          </div>

          {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
          {loading ? <div className="text-sm text-slate-500">Cargando...</div> : null}
          {!loading && clients.length === 0 ? <EmptyState title="No hay clientes" /> : null}

          {clients.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-4">Cliente</th>
                    <th className="p-4">CUIT</th>
                    <th className="p-4">Contacto</th>
                    <th className="p-4">Ubicación</th>
                    <th className="p-4">Notas</th>
                    <th className="p-4">Estado</th>
                    {canManage ? <th className="p-4 text-right">Acciones</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="p-4 font-bold">{c.name}</td>
                      <td className="p-4">{c.cuit || "—"}</td>
                      <td className="p-4">{c.email || c.phone || "—"}</td>
                      <td className="p-4">{[c.city, c.province].filter(Boolean).join(", ") || "—"}</td>
                      <td className="max-w-[260px] truncate p-4">{c.notes || "—"}</td>
                      <td className="p-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${c.active === false ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>
                          {c.active === false ? "Inactivo" : "Activo"}
                        </span>
                      </td>
                      {canManage ? (
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="secondary" onClick={() => openEdit(c)}>Editar</Button>
                            {canDelete ? (
                              <Button
                                type="button"
                                variant={c.active === false ? "secondary" : "danger"}
                                onClick={() => toggleActive(c)}
                              >
                                {c.active === false ? "Activar" : "Desactivar"}
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ClientModal
        open={open}
        client={editing}
        canDelete={canDelete}
        onClose={() => setOpen(false)}
        onSaved={load}
      />
    </AppShell>
  );
}

function ClientModal({
  open,
  client,
  canDelete,
  onClose,
  onSaved,
}: {
  open: boolean;
  client: Client | null;
  canDelete: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(emptyClientForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...emptyClientForm,
      name: client?.name || "",
      legal_name: client?.legal_name || "",
      cuit: client?.cuit || "",
      email: client?.email || "",
      phone: client?.phone || "",
      address: client?.address || "",
      city: client?.city || "Rincón de los Sauces",
      province: client?.province || "Neuquén",
      country: client?.country || "Argentina",
      notes: client?.notes || "",
      active: client?.active ?? true,
    });
    setError(null);
  }, [open, client]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      if (client?.id) await updateClient(client.id, form);
      else await createClient(form);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function removeFromEdit() {
    if (!client?.id) return;
    const text = window.prompt(
      `Para eliminar definitivamente ${client.name}, escribí ELIMINAR.\n\nEsto borra el cliente y sus datos asociados.`
    );
    if (text !== "ELIMINAR") return;

    try {
      setSaving(true);
      setError(null);
      await deleteClient(client.id);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el cliente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={client ? "Editar cliente" : "Nuevo cliente"}>
      <form onSubmit={submit} className="space-y-4">
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre"><input className={inputClass} value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required /></Field>
          <Field label="Razón social"><input className={inputClass} value={form.legal_name} onChange={(e)=>setForm({...form,legal_name:e.target.value})} /></Field>
          <Field label="CUIT"><input className={inputClass} value={form.cuit} onChange={(e)=>setForm({...form,cuit:e.target.value})} /></Field>
          <Field label="Email"><input className={inputClass} value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} /></Field>
          <Field label="Teléfono"><input className={inputClass} value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} /></Field>
          <Field label="Dirección"><input className={inputClass} value={form.address} onChange={(e)=>setForm({...form,address:e.target.value})} /></Field>
          <Field label="Ciudad"><input className={inputClass} value={form.city} onChange={(e)=>setForm({...form,city:e.target.value})} /></Field>
          <Field label="Provincia"><input className={inputClass} value={form.province} onChange={(e)=>setForm({...form,province:e.target.value})} /></Field>
          <Field label="País"><input className={inputClass} value={form.country} onChange={(e)=>setForm({...form,country:e.target.value})} /></Field>
          <label className="flex items-center gap-2 pt-7 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={form.active} onChange={(e)=>setForm({...form,active:e.target.checked})} /> Activo
          </label>
        </div>

        <Field label="Notas"><textarea className={inputClass} rows={3} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} /></Field>

        <div className="border-t border-slate-100 pt-4">
          {client?.id && canDelete ? (
            <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4">
              <div className="text-sm font-bold text-red-900">Zona de eliminación definitiva</div>
              <p className="mt-1 text-xs leading-5 text-red-700">
                Esta opción elimina el cliente de la base. Usala solo si fue cargado por error. Para ocultarlo del uso normal, usá Desactivar desde la tabla.
              </p>
              <Button
                type="button"
                variant="danger"
                onClick={removeFromEdit}
                disabled={saving}
                className="mt-3"
              >
                Eliminar cliente definitivamente
              </Button>
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
