import { apiFetch } from "./api";
import type { Client, Equipment, Pattern, User } from "@/src/types";

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

function normalizeListParams<T extends Record<string, string | number | boolean | null | undefined>>(
  params?: string | T
): T | { q: string } | undefined {
  if (typeof params === "string") return params ? { q: params } : undefined;
  return params;
}

// =========================================================
// Clientes
// =========================================================

export type ClientListParams = { q?: string; active?: boolean };
export type ClientPayload = Partial<Client> & Record<string, unknown>;

export async function getClients(params?: string | ClientListParams): Promise<Client[]> {
  return apiFetch<Client[]>(`/clients${queryString(normalizeListParams(params))}`);
}

export const listClients = getClients;

export async function createClient(payload: ClientPayload): Promise<Client> {
  return apiFetch<Client>("/clients", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateClient(
  id: string,
  payload: ClientPayload
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

export type EquipmentListParams = {
  q?: string;
  client_id?: string;
  active?: boolean;
};
export type EquipmentPayload = Partial<Equipment> & Record<string, unknown>;

export async function getEquipment(params?: string | EquipmentListParams): Promise<Equipment[]> {
  return apiFetch<Equipment[]>(`/equipment${queryString(normalizeListParams(params))}`);
}

export const listEquipment = getEquipment;

export async function createEquipment(
  payload: EquipmentPayload
): Promise<Equipment> {
  return apiFetch<Equipment>("/equipment", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateEquipment(
  id: string,
  payload: EquipmentPayload
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

export type PatternListParams = {
  q?: string;
  status?: string;
  active?: boolean;
};
export type PatternPayload = Partial<Pattern> & Record<string, unknown>;

export async function getPatterns(params?: string | PatternListParams): Promise<Pattern[]> {
  return apiFetch<Pattern[]>(`/patterns${queryString(normalizeListParams(params))}`);
}

export const listPatterns = getPatterns;

export async function createPattern(
  payload: PatternPayload
): Promise<Pattern> {
  return apiFetch<Pattern>("/patterns", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePattern(
  id: string,
  payload: PatternPayload
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

export async function getPatternCertificate(id: string): Promise<Pattern> {
  return apiFetch<Pattern>(`/patterns/${id}/certificate-file`);
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

export type UserListParams = { q?: string; status?: string; active?: boolean };
export type UserPayload = Partial<User> & {
  password?: string;
  role_code?: string;
  client_id?: string | null;
  status?: string;
  [key: string]: unknown;
};

export async function getUsers(params?: string | UserListParams): Promise<User[]> {
  return apiFetch<User[]>(`/users${queryString(normalizeListParams(params))}`);
}

export const listUsers = getUsers;

export async function createUser(payload: UserPayload): Promise<User> {
  return apiFetch<User>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateUser(id: string, payload: UserPayload): Promise<User> {
  return apiFetch<User>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deactivateUser(id: string): Promise<User> {
  return updateUser(id, { status: "disabled" });
}

export async function activateUser(id: string): Promise<User> {
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
