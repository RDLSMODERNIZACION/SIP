import { apiFetch, getToken, ApiError } from "./api";
import { API_BASE_URL } from "./config";
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

export async function getEquipment() {
  return apiFetch<Equipment[]>("/equipment");
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

export async function getPatterns(params?: { q?: string; status?: string }) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.status) search.set("status", params.status);
  const qs = search.toString();
  return apiFetch<Pattern[]>(`/patterns${qs ? `?${qs}` : ""}`);
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


async function multipartFetch<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
    cache: "no-store",
  });

  if (!response.ok) {
    let details = "";
    try {
      const json = await response.json();
      details = typeof json.detail === "string" ? json.detail : JSON.stringify(json);
    } catch {
      details = await response.text();
    }
    throw new ApiError(response.status, details);
  }

  return response.json() as Promise<T>;
}

export async function uploadPatternCertificate(patternId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return multipartFetch<Pattern>(`/patterns/${patternId}/certificate`, formData);
}

export async function getPatternCertificate(patternId: string) {
  return apiFetch<{
    id: string;
    certificate_url: string;
    certificate_file_name?: string | null;
    certificate_storage_path?: string | null;
    certificate_uploaded_at?: string | null;
  }>(`/patterns/${patternId}/certificate`);
}

export async function deletePatternCertificate(patternId: string) {
  return apiFetch<Pattern>(`/patterns/${patternId}/certificate`, {
    method: "DELETE",
  });
}
