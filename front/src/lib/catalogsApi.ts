import { apiFetch } from "./api";

export type CatalogCode =
  | "units"
  | "test-types"
  | "elements"
  | "element-models"
  | "sizes"
  | "brands"
  | "serial-numbers"
  | "ranges"
  | "frequencies"
  | "pressure-rows";

export type CatalogItem = {
  id: string;
  name?: string | null;
  code?: string | null;
  active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;

  // element-models
  element_id?: string | null;
  element_name?: string | null;
  part_1?: string | null;
  part_2?: string | null;
  part_3?: string | null;
  full_name?: string | null;

  // frequencies / pressure rows
  months?: number | null;
  row_order?: number | null;

  [key: string]: unknown;
};

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

export async function getCatalogItems(
  catalog: CatalogCode,
  params?: { active?: boolean; q?: string }
): Promise<CatalogItem[]> {
  return apiFetch<CatalogItem[]>(`/catalogs/${catalog}${queryString(params)}`);
}

export async function ensureCatalogItem(
  catalog: CatalogCode,
  payload: Record<string, unknown>
): Promise<CatalogItem> {
  return apiFetch<CatalogItem>(`/catalogs/${catalog}/ensure`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createCatalogItem(
  catalog: CatalogCode,
  payload: Record<string, unknown>
): Promise<CatalogItem> {
  return apiFetch<CatalogItem>(`/catalogs/${catalog}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCatalogItem(
  catalog: CatalogCode,
  id: string,
  payload: Record<string, unknown>
): Promise<CatalogItem> {
  return apiFetch<CatalogItem>(`/catalogs/${catalog}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteCatalogItem(
  catalog: CatalogCode,
  id: string,
  hard = false
): Promise<{ ok: boolean; deleted?: boolean; deactivated?: boolean }> {
  return apiFetch<{ ok: boolean; deleted?: boolean; deactivated?: boolean }>(
    `/catalogs/${catalog}/${id}${queryString({ hard })}`,
    { method: "DELETE" }
  );
}
