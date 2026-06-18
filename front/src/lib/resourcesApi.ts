import { apiFetch } from "./api";
import type { Client, Equipment, Pattern, User } from "@/src/types";

export type ClientPayload = Partial<Client> & {
  name?: string;
  legal_name?: string | null;
  cuit?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  notes?: string | null;
  active?: boolean;
};

export type EquipmentPayload = Partial<Equipment> & {
  client_id: string;
  name: string;
  element?: string | null;
  type_model?: string | null;
  brand?: string | null;
  serial_number?: string | null;
  range_value?: string | null;
  unit?: string | null;
  size_value?: string | null;
  internal_code?: string | null;
  location?: string | null;
  notes?: string | null;
  active?: boolean;
};

export type UserPayload = Partial<User> & {
  email?: string;
  full_name?: string;
  phone?: string | null;
  role_code?: string;
  client_id?: string | null;
  password?: string;
  status?: string;
};

function buildQuery(params: Record<string, string | number | boolean | null | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export async function getClients() {
  return apiFetch<Client[]>("/clients");
}

export async function createClient(payload: ClientPayload) {
  return apiFetch<Client>("/clients", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateClient(clientId: string, payload: ClientPayload) {
  return apiFetch<Client>(`/clients/${clientId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deactivateClient(clientId: string) {
  return updateClient(clientId, { active: false });
}

export async function activateClient(clientId: string) {
  return updateClient(clientId, { active: true });
}

export async function deleteClient(clientId: string, hard = true) {
  return apiFetch<{ ok: boolean }>(`/clients/${clientId}?hard=${hard ? "true" : "false"}`, {
    method: "DELETE",
  });
}

export async function getEquipment(params: { q?: string; client_id?: string } = {}) {
  return apiFetch<Equipment[]>(`/equipment${buildQuery(params)}`);
}

export async function createEquipment(payload: EquipmentPayload) {
  return apiFetch<Equipment>("/equipment", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateEquipment(equipmentId: string, payload: Partial<EquipmentPayload>) {
  return apiFetch<Equipment>(`/equipment/${equipmentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deactivateEquipment(equipmentId: string) {
  return updateEquipment(equipmentId, { active: false });
}

export async function activateEquipment(equipmentId: string) {
  return updateEquipment(equipmentId, { active: true });
}

export async function deleteEquipment(equipmentId: string, hard = true) {
  return apiFetch<{ ok: boolean }>(`/equipment/${equipmentId}?hard=${hard ? "true" : "false"}`, {
    method: "DELETE",
  });
}

export async function getPatterns() {
  return apiFetch<Pattern[]>("/patterns");
}

export async function createPattern(payload: Partial<Pattern>) {
  return apiFetch<Pattern>("/patterns", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePattern(patternId: string, payload: Partial<Pattern>) {
  return apiFetch<Pattern>(`/patterns/${patternId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function uploadPatternCertificate(patternId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetch<Pattern>(`/patterns/${patternId}/certificate-file`, {
    method: "POST",
    body: formData,
    headers: {},
  });
}

export async function deletePatternCertificate(patternId: string) {
  return apiFetch<Pattern>(`/patterns/${patternId}/certificate-file`, {
    method: "DELETE",
  });
}

export async function getUsers() {
  return apiFetch<User[]>("/users");
}

export async function createUser(payload: UserPayload) {
  return apiFetch<User>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateUser(userId: string, payload: UserPayload) {
  return apiFetch<User>(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deactivateUser(userId: string) {
  return updateUser(userId, { status: "disabled" });
}

export async function activateUser(userId: string) {
  return updateUser(userId, { status: "active" });
}

export async function deleteUser(userId: string, hard = true) {
  return apiFetch<{ ok: boolean }>(`/users/${userId}?hard=${hard ? "true" : "false"}`, {
    method: "DELETE",
  });
}
