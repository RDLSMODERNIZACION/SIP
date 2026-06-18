"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/src/components/layout/AppShell";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/src/components/ui/Card";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Field, inputClass } from "@/src/components/ui/Field";
import { Modal } from "@/src/components/ui/Modal";
import {
  activateUser,
  createUser,
  deactivateUser,
  deleteUser,
  getClients,
  getUsers,
  updateUser,
  type UserPayload,
} from "@/src/lib/resourcesApi";
import type { Client, RoleCode, User } from "@/src/types";

const ROLE_OPTIONS: Array<{ code: RoleCode; label: string }> = [
  { code: "admin", label: "Administrador" },
  { code: "certificador", label: "Trabajador / Certificador" },
  { code: "aprobador", label: "Aprobador" },
  { code: "cliente", label: "Cliente" },
];

type UserFormState = {
  email: string;
  full_name: string;
  phone: string;
  role_code: RoleCode;
  client_id: string;
  password: string;
  status: string;
};

const emptyUserForm: UserFormState = {
  email: "",
  full_name: "",
  phone: "",
  role_code: "cliente",
  client_id: "",
  password: "123456",
  status: "active",
};

function roleLabel(roleCode?: string, fallback?: string) {
  return ROLE_OPTIONS.find((role) => role.code === roleCode)?.label || fallback || roleCode || "—";
}

function statusLabel(status?: string) {
  if (status === "active") return "Activo";
  if (status === "disabled") return "Desactivado";
  return status || "—";
}

function buildUserPayload(form: UserFormState, mode: "create" | "edit"): UserPayload {
  const payload: UserPayload = {
    full_name: form.full_name.trim(),
    phone: form.phone.trim() || null,
    role_code: form.role_code,
    client_id: form.role_code === "cliente" ? form.client_id || null : null,
    status: form.status,
  };

  if (mode === "create") {
    payload.email = form.email.trim().toLowerCase();
    payload.password = form.password;
  }

  if (mode === "edit" && form.password.trim()) {
    payload.password = form.password.trim();
  }

  return payload;
}

export default function UsersView() {
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [loadedUsers, loadedClients] = await Promise.all([getUsers(), getClients()]);
      setUsers(loadedUsers);
      setClients(loadedClients);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) =>
      [user.full_name, user.email, user.role_name, user.role_code, user.client_name, user.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [search, users]);

  function openCreate() {
    setEditingUser(null);
    setOpen(true);
  }

  function openEdit(user: User) {
    setEditingUser(user);
    setOpen(true);
  }

  async function toggleStatus(user: User) {
    const isActive = user.status === "active";
    const confirmed = window.confirm(
      isActive
        ? `¿Desactivar el usuario "${user.full_name}"?`
        : `¿Activar el usuario "${user.full_name}"?`
    );
    if (!confirmed) return;

    try {
      setActionLoadingId(user.id);
      setError(null);
      if (isActive) await deactivateUser(user.id);
      else await activateUser(user.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el usuario");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function removeUser(user: User) {
    const confirmed = window.confirm(
      `¿Eliminar definitivamente el usuario "${user.full_name}"?\n\nEsta acción elimina el acceso del usuario. Los certificados históricos quedan guardados, pero se desvincula la referencia al usuario.`
    );
    if (!confirmed) return;

    try {
      setActionLoadingId(user.id);
      setError(null);
      await deleteUser(user.id, true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el usuario");
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <AppShell title="Usuarios" description="Administración de usuarios, roles y accesos por cliente.">
      <Card>
        <CardHeader
          title="Usuarios"
          description="El rol define qué secciones y acciones puede realizar cada usuario. Los usuarios cliente pueden asociarse a un cliente específico."
          action={<Button onClick={openCreate}>Nuevo usuario</Button>}
        />
        <CardContent>
          {error ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <div className="mb-5 flex flex-col gap-3 md:flex-row">
            <Field label="Buscar" className="flex-1">
              <input
                className={inputClass}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Usuario, email, rol, cliente..."
              />
            </Field>
          </div>

          {loading ? <div className="text-sm text-slate-500">Cargando...</div> : null}
          {!loading && filteredUsers.length === 0 ? <EmptyState title="No hay usuarios" /> : null}

          {filteredUsers.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full min-w-[1050px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-4">Usuario</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Rol</th>
                    <th className="p-4">Cliente asociado</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-t border-slate-100">
                      <td className="p-4 font-bold text-slate-900">{user.full_name}</td>
                      <td className="p-4">{user.email}</td>
                      <td className="p-4">{roleLabel(user.role_code, user.role_name)}</td>
                      <td className="p-4">{user.client_name || "—"}</td>
                      <td className="p-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            user.status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {statusLabel(user.status)}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="secondary" onClick={() => openEdit(user)}>
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => toggleStatus(user)}
                            disabled={actionLoadingId === user.id}
                          >
                            {user.status === "active" ? "Desactivar" : "Activar"}
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            onClick={() => removeUser(user)}
                            disabled={actionLoadingId === user.id}
                          >
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

      <UserModal
        open={open}
        mode={editingUser ? "edit" : "create"}
        user={editingUser}
        onClose={() => setOpen(false)}
        onSaved={load}
        clients={clients}
      />
    </AppShell>
  );
}

function UserModal({
  open,
  mode,
  user,
  onClose,
  onSaved,
  clients,
}: {
  open: boolean;
  mode: "create" | "edit";
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
  clients: Client[];
}) {
  const [form, setForm] = useState<UserFormState>(emptyUserForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setError(null);
    if (mode === "edit" && user) {
      setForm({
        email: user.email || "",
        full_name: user.full_name || "",
        phone: user.phone || "",
        role_code: user.role_code || "cliente",
        client_id: user.client_id || "",
        password: "",
        status: user.status || "active",
      });
    } else {
      setForm(emptyUserForm);
    }
  }, [open, mode, user]);

  const isClientRole = form.role_code === "cliente";

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (isClientRole && !form.client_id) {
      setError("Para usuarios cliente, seleccioná el cliente asociado.");
      return;
    }

    if (mode === "create" && !form.password.trim()) {
      setError("La contraseña es obligatoria para crear el usuario.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const payload = buildUserPayload(form, mode);
      if (mode === "edit" && user) {
        await updateUser(user.id, payload);
      } else {
        await createUser(payload);
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el usuario");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={mode === "edit" ? "Editar usuario" : "Nuevo usuario"}>
      <form onSubmit={submit} className="space-y-5">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre completo">
            <input
              className={inputClass}
              value={form.full_name}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              required
            />
          </Field>

          <Field label="Email">
            <input
              className={`${inputClass} ${mode === "edit" ? "cursor-not-allowed bg-slate-100 text-slate-500" : ""}`}
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              disabled={mode === "edit"}
              required
            />
          </Field>

          <Field label="Teléfono">
            <input
              className={inputClass}
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </Field>

          <Field label="Estado">
            <select
              className={inputClass}
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              <option value="active">Activo</option>
              <option value="disabled">Desactivado</option>
            </select>
          </Field>

          <Field label="Rol">
            <select
              className={inputClass}
              value={form.role_code}
              onChange={(event) => {
                const nextRole = event.target.value as RoleCode;
                setForm({
                  ...form,
                  role_code: nextRole,
                  client_id: nextRole === "cliente" ? form.client_id : "",
                });
              }}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Cliente asociado">
            <select
              className={`${inputClass} ${!isClientRole ? "bg-slate-100 text-slate-500" : ""}`}
              value={form.client_id}
              onChange={(event) => setForm({ ...form, client_id: event.target.value })}
              disabled={!isClientRole}
              required={isClientRole}
            >
              <option value="">{isClientRole ? "Seleccionar cliente" : "No aplica"}</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} {client.cuit ? `- ${client.cuit}` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label={mode === "edit" ? "Nueva contraseña (opcional)" : "Contraseña"}>
            <input
              className={inputClass}
              type="text"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder={mode === "edit" ? "Dejar vacío para no cambiar" : "Contraseña inicial"}
              required={mode === "create"}
            />
          </Field>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          Los usuarios con rol <strong>Cliente</strong> deben quedar asociados a un cliente para que solo puedan ver sus propios certificados y documentos.
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={saving}>{saving ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Guardar usuario"}</Button>
        </div>
      </form>
    </Modal>
  );
}
