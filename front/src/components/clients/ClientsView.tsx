"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/src/components/layout/AppShell";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Field, inputClass } from "@/src/components/ui/Field";
import { Modal } from "@/src/components/ui/Modal";
import { createClient, getClients } from "@/src/lib/resourcesApi";
import type { Client } from "@/src/types";

export default function ClientsView() {
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => { load(); }, []);

  return (
    <AppShell title="Clientes" description="Alta y consulta de empresas asociadas a certificados.">
      <Card>
        <CardHeader title="Clientes" description="Base de clientes para vincular certificados y usuarios." action={<Button onClick={() => setOpen(true)}>Nuevo cliente</Button>} />
        <CardContent>
          <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto]">
            <Field label="Buscar"><input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, CUIT o email" /></Field>
            <div className="flex items-end"><Button variant="secondary" onClick={load}>Buscar</Button></div>
          </div>
          {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
          {loading ? <div className="text-sm text-slate-500">Cargando...</div> : null}
          {!loading && clients.length === 0 ? <EmptyState title="No hay clientes" /> : null}
          {clients.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-4">Cliente</th><th className="p-4">CUIT</th><th className="p-4">Contacto</th><th className="p-4">Ubicación</th><th className="p-4">Estado</th></tr></thead>
                <tbody>{clients.map((c) => <tr key={c.id} className="border-t border-slate-100"><td className="p-4 font-bold">{c.name}</td><td className="p-4">{c.cuit || "—"}</td><td className="p-4">{c.email || c.phone || "—"}</td><td className="p-4">{[c.city, c.province].filter(Boolean).join(", ") || "—"}</td><td className="p-4">{c.active === false ? "Inactivo" : "Activo"}</td></tr>)}</tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <ClientModal open={open} onClose={() => setOpen(false)} onSaved={load} />
    </AppShell>
  );
}

function ClientModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", legal_name: "", cuit: "", email: "", phone: "", city: "Rincón de los Sauces", province: "Neuquén", country: "Argentina" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      setSaving(true); setError(null);
      await createClient(form);
      onSaved(); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar"); }
    finally { setSaving(false); }
  }
  return <Modal open={open} onClose={onClose} title="Nuevo cliente"><form onSubmit={submit} className="space-y-4">{error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}<div className="grid gap-4 md:grid-cols-2"><Field label="Nombre"><input className={inputClass} value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required /></Field><Field label="Razón social"><input className={inputClass} value={form.legal_name} onChange={(e)=>setForm({...form,legal_name:e.target.value})} /></Field><Field label="CUIT"><input className={inputClass} value={form.cuit} onChange={(e)=>setForm({...form,cuit:e.target.value})} /></Field><Field label="Email"><input className={inputClass} value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} /></Field><Field label="Teléfono"><input className={inputClass} value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} /></Field><Field label="Ciudad"><input className={inputClass} value={form.city} onChange={(e)=>setForm({...form,city:e.target.value})} /></Field></div><div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button></div></form></Modal>;
}
