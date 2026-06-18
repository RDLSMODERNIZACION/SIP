import { apiFetch } from "./api";
import type { Client, Equipment, Pattern } from "@/src/types";

function queryString(params?: Record<string, string | number | boolean | null | undefined>) {
  if (!params) return "";
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// =========================================================
// Clientes
// =========================================================

export async function getClients(params?: { q?: string; active?: boolean }): Promise<Client[]> {
  return apiFetch<Client[]>(`/clients${queryString(params)}`);
}

export const listClients = getClients;

export async function createClient(payload: Partial<Client> & Record<string, unknown>): Promise<Client> {
  return apiFetch<Client>("/clients", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateClient(
  id: string,
  payload: Partial<Client> & Record<string, unknown>
): Promise<Client> {
  return apiFetch<Client>(`/clients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deactivateClient(id: string): Promise<Client> {
  return updateClient(id, { active: false });
}

export async function activateClient(id: string): Promise<Client> {
  return updateClient(id, { active: true });
}

export async function deleteClient(id: string, hard = true): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/clients/${id}${queryString({ hard })}`, {
    method: "DELETE",
  });
}

// =========================================================
// Equipos
// =========================================================

export async function getEquipment(params?: {
  q?: string;
  client_id?: string;
  active?: boolean;
}): Promise<Equipment[]> {
  return apiFetch<Equipment[]>(`/equipment${queryString(params)}`);
}

export const listEquipment = getEquipment;

export async function createEquipment(
  payload: Partial<Equipment> & Record<string, unknown>
): Promise<Equipment> {
  return apiFetch<Equipment>("/equipment", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateEquipment(
  id: string,
  payload: Partial<Equipment> & Record<string, unknown>
): Promise<Equipment> {
  return apiFetch<Equipment>(`/equipment/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteEquipment(id: string, hard = true): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/equipment/${id}${queryString({ hard })}`, {
    method: "DELETE",
  });
}

// =========================================================
// Patrones
// =========================================================

export async function getPatterns(params?: { q?: string; active?: boolean }): Promise<Pattern[]> {
  return apiFetch<Pattern[]>(`/patterns${queryString(params)}`);
}

export const listPatterns = getPatterns;

export async function createPattern(
  payload: Partial<Pattern> & Record<string, unknown>
): Promise<Pattern> {
  return apiFetch<Pattern>("/patterns", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePattern(
  id: string,
  payload: Partial<Pattern> & Record<string, unknown>
): Promise<Pattern> {
  return apiFetch<Pattern>(`/patterns/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deletePattern(id: string, hard = false): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/patterns/${id}${queryString({ hard })}`, {
    method: "DELETE",
  });
}

export async function uploadPatternCertificate(id: string, file: File): Promise<Pattern> {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetch<Pattern>(`/patterns/${id}/certificate-file`, {
    method: "POST",
    body: formData,
    headers: {},
  });
}

export async function deletePatternCertificate(id: string): Promise<Pattern> {
  return apiFetch<Pattern>(`/patterns/${id}/certificate-file`, {
    method: "DELETE",
  });
}

// Alias por compatibilidad con versiones anteriores
export const replacePatternCertificate = uploadPatternCertificate;
export const removePatternCertificate = deletePatternCertificate;

// =========================================================
// Usuarios
// =========================================================

export type UserResource = {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  role_id?: string | null;
  role_code?: string | null;
  role_name?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  status?: string | null;
  active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export async function getUsers(params?: { q?: string; status?: string }): Promise<UserResource[]> {
  return apiFetch<UserResource[]>(`/users${queryString(params)}`);
}

export const listUsers = getUsers;

export async function createUser(payload: Record<string, unknown>): Promise<UserResource> {
  return apiFetch<UserResource>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateUser(id: string, payload: Record<string, unknown>): Promise<UserResource> {
  return apiFetch<UserResource>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deactivateUser(id: string): Promise<UserResource> {
  return updateUser(id, { status: "disabled" });
}

export async function activateUser(id: string): Promise<UserResource> {
  return updateUser(id, { status: "active" });
}

export async function deleteUser(id: string, hard = true): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/users/${id}${queryString({ hard })}`, {
    method: "DELETE",
  });
}

// =========================================================
// Roles
// =========================================================

export type RoleResource = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
};

export async function getRoles(): Promise<RoleResource[]> {
  return apiFetch<RoleResource[]>("/roles");
}

export const listRoles = getRoles;
