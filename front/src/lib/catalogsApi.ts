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
  | "pressure-rows"
  | "payment-terms"
  | "pricing";

export type CatalogItem = {
  id: string;
  name?: string;
  code?: string;
  active?: boolean;
  created_at?: string;
  updated_at?: string;

  element_id?: string;
  element_name?: string;
  part_1?: string;
  part_2?: string;
  part_3?: string;
  full_name?: string;

  months?: number;
  row_order?: number;

  element_name_snapshot?: string;
  type_name?: string;
  price?: number;
  estimated_minutes?: number;

  [key: string]: any;
};

export type CatalogDefinition = {
  code: CatalogCode;
  label: string;
  fields: string[];
};

export const CATALOG_DEFINITIONS: CatalogDefinition[] = [
  { code: "units", label: "Unidades", fields: ["name", "active"] },
  { code: "test-types", label: "Tipos de prueba", fields: ["name", "active"] },
  { code: "elements", label: "Elementos", fields: ["name", "active"] },
  { code: "element-models", label: "Modelos", fields: ["element_name", "part_1", "part_2", "part_3", "full_name", "active"] },
  { code: "sizes", label: "Sizes", fields: ["name", "active"] },
  { code: "brands", label: "Marcas", fields: ["name", "active"] },
  { code: "serial-numbers", label: "Series", fields: ["name", "active"] },
  { code: "ranges", label: "Rangos", fields: ["name", "active"] },
  { code: "frequencies", label: "Frecuencias", fields: ["name", "months", "active"] },
  { code: "pressure-rows", label: "Filas presión", fields: ["name", "row_order", "active"] },
  { code: "payment-terms", label: "Condiciones pago", fields: ["name", "active"] },
  { code: "pricing", label: "Precios y tiempos", fields: ["element_name", "type_name", "price", "estimated_minutes", "active"] },
];

export function getCatalogDefinitions() {
  return CATALOG_DEFINITIONS;
}

export async function getCatalogItems(
  catalog: CatalogCode,
  params?: { active?: boolean; q?: string }
): Promise<CatalogItem[]> {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.active !== undefined) search.set("active", String(params.active));
  const query = search.toString();
  return apiFetch<CatalogItem[]>(`/catalogs/${catalog}${query ? `?${query}` : ""}`);
}

export async function createCatalogItem(
  catalog: CatalogCode,
  payload: Partial<CatalogItem>
): Promise<CatalogItem> {
  return apiFetch<CatalogItem>(`/catalogs/${catalog}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCatalogItem(
  catalog: CatalogCode,
  id: string,
  payload: Partial<CatalogItem>
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
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/catalogs/${catalog}/${id}${hard ? "?hard=true" : ""}`, {
    method: "DELETE",
  });
}

export async function ensureCatalogItem(
  catalog: CatalogCode,
  payload: Partial<CatalogItem>
): Promise<CatalogItem> {
  return apiFetch<CatalogItem>(`/catalogs/${catalog}/ensure`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
