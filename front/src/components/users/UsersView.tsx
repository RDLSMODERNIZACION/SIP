"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/src/components/layout/AppShell";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Field, inputClass } from "@/src/components/ui/Field";
import { Modal } from "@/src/components/ui/Modal";
import { createUser, getClients, getUsers } from "@/src/lib/resourcesApi";
import type { Client, User } from "@/src/types";

export default function UsersView() {
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function load() { try { setLoading(true); setError(null); const [u,c]=await Promise.all([getUsers(), getClients()]); setUsers(u); setClients(c); } catch(err){ setError(err instanceof Error ? err.message : "No se pudieron cargar usuarios"); } finally{ setLoading(false);} }
  useEffect(()=>{ load(); },[]);
  return <AppShell title="Usuarios" description="Administración de usuarios, roles y accesos por cliente."><Card><CardHeader title="Usuarios" description="El rol define qué secciones y acciones puede realizar cada usuario." action={<Button onClick={()=>setOpen(true)}>Nuevo usuario</Button>} /><CardContent>{error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}{loading ? <div className="text-sm text-slate-500">Cargando...</div> : null}{!loading && users.length===0 ? <EmptyState title="No hay usuarios" /> : null}{users.length>0 ? <div className="overflow-x-auto rounded-2xl border border-slate-100"><table className="w-full min-w-[850px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-4">Usuario</th><th className="p-4">Email</th><th className="p-4">Rol</th><th className="p-4">Cliente asociado</th><th className="p-4">Estado</th></tr></thead><tbody>{users.map((u)=><tr key={u.id} className="border-t border-slate-100"><td className="p-4 font-bold">{u.full_name}</td><td className="p-4">{u.email}</td><td className="p-4">{u.role_name}</td><td className="p-4">{u.client_name || "—"}</td><td className="p-4">{u.status}</td></tr>)}</tbody></table></div> : null}</CardContent></Card><UserModal open={open} onClose={()=>setOpen(false)} onSaved={load} clients={clients}/></AppShell>;
}

function UserModal({ open, onClose, onSaved, clients }: { open: boolean; onClose: () => void; onSaved: () => void; clients: Client[] }) {
  const [form, setForm] = useState({ email: "", full_name: "", phone: "", role_code: "cliente", client_id: "", password: "123456" });
  const [saving,setSaving]=useState(false); const [error,setError]=useState<string|null>(null);
  async function submit(e: FormEvent){ e.preventDefault(); try{ setSaving(true); setError(null); await createUser({...form, client_id: form.client_id || null}); onSaved(); onClose(); } catch(err){ setError(err instanceof Error ? err.message : "No se pudo guardar"); } finally{ setSaving(false);} }
  return <Modal open={open} onClose={onClose} title="Nuevo usuario"><form onSubmit={submit} className="space-y-4">{error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}<div className="grid gap-4 md:grid-cols-2"><Field label="Nombre completo"><input className={inputClass} value={form.full_name} onChange={(e)=>setForm({...form,full_name:e.target.value})} required /></Field><Field label="Email"><input className={inputClass} type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} required /></Field><Field label="Teléfono"><input className={inputClass} value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} /></Field><Field label="Rol"><select className={inputClass} value={form.role_code} onChange={(e)=>setForm({...form,role_code:e.target.value})}><option value="admin">Administrador</option><option value="certificador">Trabajador / Certificador</option><option value="aprobador">Aprobador</option><option value="cliente">Cliente</option></select></Field><Field label="Cliente asociado"><select className={inputClass} value={form.client_id} onChange={(e)=>setForm({...form,client_id:e.target.value})}><option value="">Sin cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Contraseña"><input className={inputClass} value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} required /></Field></div><div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button></div></form></Modal>;
}
