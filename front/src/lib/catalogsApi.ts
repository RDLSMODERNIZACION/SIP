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
  active?: boolean;
  created_at?: string;
  updated_at?: string;

  // Modelos por elemento
  element_id?: string | null;
  element_name?: string | null;
  part_1?: string | null;
  part_2?: string | null;
  part_3?: string | null;
  full_name?: string | null;

  // Frecuencias / filas
  months?: number | null;
  row_order?: number | null;

  [key: string]: unknown;
};

export type CatalogDefinition = {
  code: CatalogCode;
  label: string;
  fields: string[];
};

export type CatalogListParams = {
  active?: boolean;
  q?: string;
};

export const CATALOG_DEFINITIONS: CatalogDefinition[] = [
  { code: "units", label: "Unidades", fields: ["name", "active"] },
  { code: "test-types", label: "Tipos de prueba", fields: ["name", "active"] },
  { code: "elements", label: "Elementos", fields: ["name", "active"] },
  {
    code: "element-models",
    label: "Modelos",
    fields: ["element_name", "part_1", "part_2", "part_3", "full_name", "active"],
  },
  { code: "sizes", label: "Sizes", fields: ["name", "active"] },
  { code: "brands", label: "Marcas", fields: ["name", "active"] },
  { code: "serial-numbers", label: "Series", fields: ["name", "active"] },
  { code: "ranges", label: "Rangos", fields: ["name", "active"] },
  { code: "frequencies", label: "Frecuencias", fields: ["name", "months", "active"] },
  { code: "pressure-rows", label: "Filas de presión", fields: ["name", "row_order", "active"] },
];

export function getCatalogDefinitions(): CatalogDefinition[] {
  return CATALOG_DEFINITIONS;
}

function buildQuery(params?: CatalogListParams) {
  const search = new URLSearchParams();

  if (params?.active !== undefined) {
    search.set("active", String(params.active));
  }

  if (params?.q) {
    search.set("q", params.q);
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function getCatalogItems(
  catalog: CatalogCode,
  params?: CatalogListParams
): Promise<CatalogItem[]> {
  return apiFetch<CatalogItem[]>(`/catalogs/${catalog}${buildQuery(params)}`);
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

export async function ensureCatalogItem(
  catalog: CatalogCode,
  payload: Record<string, unknown>
): Promise<CatalogItem> {
  return apiFetch<CatalogItem>(`/catalogs/${catalog}/ensure`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCatalogItem(
  catalog: CatalogCode,
  itemId: string,
  payload: Record<string, unknown>
): Promise<CatalogItem> {
  return apiFetch<CatalogItem>(`/catalogs/${catalog}/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteCatalogItem(
  catalog: CatalogCode,
  itemId: string,
  hard = false
): Promise<{ ok: boolean; deleted_id?: string; deactivated_id?: string }> {
  return apiFetch<{ ok: boolean; deleted_id?: string; deactivated_id?: string }>(
    `/catalogs/${catalog}/${itemId}?hard=${hard ? "true" : "false"}`,
    { method: "DELETE" }
  );
}
