import { apiFetch } from "./api";
import type { Client, Equipment, Pattern, User, CertificateSummary } from "@/src/types";

function cleanPayload<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cleanPayload(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => [k, v === "" ? undefined : cleanPayload(v)])
        .filter(([, v]) => v !== undefined)
    ) as T;
  }
  return value;
}

export async function getClients(q?: string) {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiFetch<Client[]>(`/clients${query}`);
}

export async function createClient(payload: Partial<Client>) {
  return apiFetch<Client>("/clients", { method: "POST", body: JSON.stringify(cleanPayload(payload)) });
}

export async function getClientSummary(clientId: string) {
  return apiFetch<CertificateSummary>(`/clients/${clientId}/summary`);
}

export async function getEquipment(params?: { client_id?: string; q?: string }) {
  const search = new URLSearchParams();
  if (params?.client_id) search.set("client_id", params.client_id);
  if (params?.q) search.set("q", params.q);
  const query = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<Equipment[]>(`/equipment${query}`);
}

export async function createEquipment(payload: Partial<Equipment>) {
  return apiFetch<Equipment>("/equipment", { method: "POST", body: JSON.stringify(cleanPayload(payload)) });
}

export async function getPatterns(params?: { q?: string; status?: string }) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.status) search.set("status", params.status);
  const query = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<Pattern[]>(`/patterns${query}`);
}

export async function createPattern(payload: Partial<Pattern>) {
  return apiFetch<Pattern>("/patterns", { method: "POST", body: JSON.stringify(cleanPayload(payload)) });
}

export async function getUsers() {
  return apiFetch<User[]>("/users");
}

export async function createUser(payload: {
  email: string;
  full_name: string;
  phone?: string;
  role_code: string;
  client_id?: string | null;
  password: string;
}) {
  return apiFetch<User>("/users", { method: "POST", body: JSON.stringify(cleanPayload(payload)) });
}
