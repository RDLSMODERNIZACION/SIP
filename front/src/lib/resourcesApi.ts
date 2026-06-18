import { apiFetch } from "./api";
import type { Client, Equipment, Pattern } from "@/src/types";

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
