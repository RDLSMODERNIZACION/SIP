"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/src/components/layout/AppShell";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Field, inputClass } from "@/src/components/ui/Field";
import { Modal } from "@/src/components/ui/Modal";
import { createEquipment, getClients, getEquipment } from "@/src/lib/resourcesApi";
import type { Client, Equipment } from "@/src/types";

export default function EquipmentView() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    try { setLoading(true); setError(null); const [e, c] = await Promise.all([getEquipment({ q }), getClients()]); setItems(e); setClients(c); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudieron cargar equipos"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  return <AppShell title="Equipos" description="Legajo digital de equipos certificados por cliente."><Card><CardHeader title="Equipos" description="Cada certificado puede quedar asociado a un equipo y su historial." action={<Button onClick={() => setOpen(true)}>Nuevo equipo</Button>} /><CardContent><div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto]"><Field label="Buscar"><input className={inputClass} value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Equipo, serie, marca..." /></Field><div className="flex items-end"><Button variant="secondary" onClick={load}>Buscar</Button></div></div>{error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}{loading ? <div className="text-sm text-slate-500">Cargando...</div> : null}{!loading && items.length===0 ? <EmptyState title="No hay equipos" /> : null}{items.length>0 ? <div className="overflow-x-auto rounded-2xl border border-slate-100"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-4">Equipo</th><th className="p-4">Cliente</th><th className="p-4">Elemento</th><th className="p-4">Marca</th><th className="p-4">Serie</th><th className="p-4">Rango</th><th className="p-4">Ubicación</th></tr></thead><tbody>{items.map((e)=><tr key={e.id} className="border-t border-slate-100"><td className="p-4 font-bold">{e.name}</td><td className="p-4">{e.client_name || "—"}</td><td className="p-4">{e.element || "—"}</td><td className="p-4">{e.brand || "—"}</td><td className="p-4">{e.serial_number || "—"}</td><td className="p-4">{e.range_value || "—"} {e.unit || ""}</td><td className="p-4">{e.location || "—"}</td></tr>)}</tbody></table></div> : null}</CardContent></Card><EquipmentModal open={open} onClose={()=>setOpen(false)} onSaved={load} clients={clients}/></AppShell>;
}

function EquipmentModal({ open, onClose, onSaved, clients }: { open: boolean; onClose: () => void; onSaved: () => void; clients: Client[] }) {
  const [form, setForm] = useState({ client_id: "", name: "", element: "", type_model: "", brand: "", serial_number: "", range_value: "", unit: "", size_value: "", location: "" });
  const [saving, setSaving] = useState(false); const [error,setError]=useState<string|null>(null);
  useEffect(()=>{ if(open && !form.client_id && clients[0]) setForm((f)=>({...f, client_id: clients[0].id})); },[open,clients]);
  async function submit(e: FormEvent){e.preventDefault(); try{setSaving(true); setError(null); await createEquipment(form); onSaved(); onClose();}catch(err){setError(err instanceof Error ? err.message : "No se pudo guardar");}finally{setSaving(false);}}
  return <Modal open={open} onClose={onClose} title="Nuevo equipo"><form onSubmit={submit} className="space-y-4">{error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}<div className="grid gap-4 md:grid-cols-2"><Field label="Cliente"><select className={inputClass} value={form.client_id} onChange={(e)=>setForm({...form,client_id:e.target.value})} required>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Nombre"><input className={inputClass} value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required /></Field><Field label="Elemento"><input className={inputClass} value={form.element} onChange={(e)=>setForm({...form,element:e.target.value})} /></Field><Field label="Modelo"><input className={inputClass} value={form.type_model} onChange={(e)=>setForm({...form,type_model:e.target.value})} /></Field><Field label="Marca"><input className={inputClass} value={form.brand} onChange={(e)=>setForm({...form,brand:e.target.value})} /></Field><Field label="Serie"><input className={inputClass} value={form.serial_number} onChange={(e)=>setForm({...form,serial_number:e.target.value})} /></Field><Field label="Rango"><input className={inputClass} value={form.range_value} onChange={(e)=>setForm({...form,range_value:e.target.value})} /></Field><Field label="Unidad"><input className={inputClass} value={form.unit} onChange={(e)=>setForm({...form,unit:e.target.value})} /></Field></div><div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button></div></form></Modal>;
}
