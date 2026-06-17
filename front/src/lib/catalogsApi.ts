import { apiFetch } from "./api";

export type CatalogCode =
  | "units"
  | "test-types"
  | "elements"
  | "element-models"
  | "sizes"
  | "frequencies"
  | "pressure-rows"
  | "payment-terms"
  | "pricing";

export type CatalogDefinition = {
  code: CatalogCode;
  label: string;
  fields: string[];
};

export type CatalogItem = {
  id: string;
  name?: string | null;
  element_name?: string | null;
  default_frequency_months?: number | null;
  part_1?: string | null;
  part_2?: string | null;
  part_3?: string | null;
  full_name?: string | null;
  months?: number | null;
  row_order?: number | null;
  type_name?: string | null;
  price?: number | null;
  estimated_minutes?: number | null;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export async function getCatalogDefinitions() {
  return apiFetch<CatalogDefinition[]>("/catalogs");
}

export async function getCatalogItems(catalog: CatalogCode, params?: { q?: string; active?: boolean }) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (typeof params?.active === "boolean") search.set("active", String(params.active));
  const query = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<CatalogItem[]>(`/catalogs/${catalog}${query}`);
}

export async function createCatalogItem(catalog: CatalogCode, payload: Partial<CatalogItem>) {
  return apiFetch<CatalogItem>(`/catalogs/${catalog}`, {
    method: "POST",
    body: JSON.stringify(cleanPayload(payload)),
  });
}

export async function updateCatalogItem(catalog: CatalogCode, id: string, payload: Partial<CatalogItem>) {
  return apiFetch<CatalogItem>(`/catalogs/${catalog}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(cleanPayload(payload)),
  });
}

export async function deleteCatalogItem(catalog: CatalogCode, id: string, hard = false) {
  const query = hard ? "?hard=true" : "";
  return apiFetch<{ ok: boolean }>(`/catalogs/${catalog}/${id}${query}`, { method: "DELETE" });
}

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
