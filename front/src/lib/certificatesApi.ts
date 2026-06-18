import { apiFetch, publicFetch, getToken } from "./api";
import { API_BASE_URL } from "./config";
import type { Certificate, CertificateDetail, PublicCertificateValidation } from "@/src/types";

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

async function apiFormFetch<T>(path: string, formData: FormData, method = "POST"): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: formData,
    cache: "no-store",
  });

  if (response.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("sip_token");
    window.location.href = "/login";
  }

  if (!response.ok) {
    let details = "";
    try {
      const json = await response.json();
      details = typeof json.detail === "string" ? json.detail : JSON.stringify(json);
    } catch {
      details = await response.text();
    }
    throw new Error(details || `Error ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type CertificateCreatePayload = {
  certificate_number: string;
  certificate_code?: string;
  certificate_revision?: string;
  certificate_validity?: string;
  document_type?: string | null;
  template_type?: string | null;
  md_required?: boolean;
  requires_hydraulic_chart?: boolean;
  previous_certificate_id?: string | null;
  reissue_reason?: string | null;
  responsible_name?: string | null;
  responsible_license?: string | null;
  asset_unit_code?: string | null;
  seal_number?: string | null;
  test_medium?: string | null;
  ambient_temperature?: string | null;
  client_id: string;
  equipment_id?: string | null;
  purchase_order?: string | null;
  calibration_date?: string | null;
  expiration_date?: string | null;
  test_frequency_months?: number | null;
  element?: string | null;
  type_model?: string | null;
  brand?: string | null;
  serial_number?: string | null;
  range_value?: string | null;
  unit?: string | null;
  size_value?: string | null;
  test_type?: string | null;
  reference_method?: string | null;
  environmental_conditions?: string | null;
  measurement_unit?: string | null;
  observations?: string | null;
  conclusions?: string | null;
  trial_result?: string | null;
  approved_result?: boolean | null;
  final_comments?: string | null;
  is_paid?: boolean;
  payment_notes?: string | null;
  test_rows?: Array<{
    row_order: number;
    pressure_label: string;
    range_value?: number | null;
    unit?: string | null;
    acceptance_criteria?: string | null;
    result?: string | null;
    observations?: string | null;
  }>;
  pattern_usages?: Array<{ pattern_id: string }>;
  metrology_results?: Array<{
    row_order: number;
    point_label?: string | null;
    direction?: "ascendente" | "descendente" | "unico" | string | null;
    pattern_pressure?: number | null;
    instrument_reading?: number | null;
    error_value?: number | null;
    max_allowed_error?: number | null;
    uncertainty?: number | null;
    unit?: string | null;
    result?: string | null;
    observations?: string | null;
  }>;
  sensor_loop_results?: Array<{
    row_order: number;
    pressure_applied?: number | null;
    pattern_reading?: number | null;
    expected_signal?: number | null;
    measured_signal?: number | null;
    signal_unit?: string | null;
    display_reading?: number | null;
    error_value?: number | null;
    max_allowed_error?: number | null;
    result?: string | null;
    observations?: string | null;
  }>;
  relief_valve_result?: {
    set_pressure_required?: number | null;
    opening_pressure?: number | null;
    tolerance_percent?: number | null;
    reclosing_pressure?: number | null;
    leak_test_pressure?: number | null;
    leak_test_result?: string | null;
    seal_number?: string | null;
    test_medium?: string | null;
    ambient_temperature?: string | null;
    result?: string | null;
    observations?: string | null;
  } | null;
  hydrostatic_result?: {
    work_pressure?: number | null;
    test_pressure?: number | null;
    hold_minutes?: number | null;
    pressure_drop?: number | null;
    test_medium?: string | null;
    thickness_control?: boolean;
    thickness_method?: string | null;
    thickness_values?: string | null;
    result?: string | null;
    observations?: string | null;
  } | null;
};

export type CertificateTemplate = {
  code: string;
  name: string;
  document_type: string;
  description?: string | null;
  default_method?: string | null;
  default_frequency_months?: number | null;
  requires_hydraulic_chart?: boolean;
};

export type HydraulicTestChartResponse = {
  hydraulic_test_chart?: {
    id: string;
    certificate_id: string;
    file_type: string;
    file_name?: string | null;
    file_url: string;
    storage_path?: string | null;
    uploaded_by?: string | null;
    created_at?: string;
  } | null;
  file_url?: string;
  ok?: boolean;
  deleted?: boolean;
};

export async function getCertificates(params?: { status?: string; client_id?: string; q?: string }) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.client_id) search.set("client_id", params.client_id);
  if (params?.q) search.set("q", params.q);
  const query = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<Certificate[]>(`/certificates${query}`);
}

export async function getCertificateById(id: string) {
  return apiFetch<CertificateDetail>(`/certificates/${id}`);
}

export async function getCertificateTemplates() {
  return apiFetch<CertificateTemplate[]>("/certificates/templates");
}

export async function getNextCertificateNumber(params?: { prefix?: string; year?: number }) {
  const search = new URLSearchParams();
  if (params?.prefix) search.set("prefix", params.prefix);
  if (params?.year) search.set("year", String(params.year));
  const query = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<{ certificate_number: string; prefix: string; year_suffix: string; next_sequence: number }>(`/certificates/next-number${query}`);
}

export async function createCertificate(payload: CertificateCreatePayload) {
  return apiFetch<CertificateDetail>("/certificates", {
    method: "POST",
    body: JSON.stringify(cleanPayload(payload)),
  });
}

export async function createCertificatePending(payload: CertificateCreatePayload) {
  const created = await createCertificate(payload);
  return submitCertificate(created.certificate.id);
}

export async function updateCertificate(id: string, payload: Partial<CertificateCreatePayload>) {
  return apiFetch<CertificateDetail>(`/certificates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(cleanPayload(payload)),
  });
}

export async function deleteCertificate(id: string, hard = true) {
  const query = hard ? "?hard=true" : "";
  return apiFetch<{ ok: boolean; deleted_id: string }>(`/certificates/${id}${query}`, {
    method: "DELETE",
  });
}

export async function submitCertificate(id: string) {
  return apiFetch<CertificateDetail>(`/certificates/${id}/submit`, { method: "POST" });
}

export async function approveCertificate(id: string) {
  return apiFetch<CertificateDetail>(`/certificates/${id}/approve`, { method: "POST" });
}

export async function rejectCertificate(id: string, reason: string) {
  return apiFetch<CertificateDetail>(`/certificates/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function annulCertificate(id: string, reason: string) {
  return apiFetch<CertificateDetail>(`/certificates/${id}/annul`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function generateQr(id: string) {
  return apiFetch<{ qr_url: string }>(`/certificates/${id}/generate-qr`, { method: "POST" });
}

export async function generatePdf(id: string) {
  return apiFetch<{ pdf_url: string }>(`/certificates/${id}/generate-pdf`, { method: "POST" });
}

export async function getHydraulicTestChart(id: string) {
  return apiFetch<HydraulicTestChartResponse>(`/certificates/${id}/hydraulic-test-chart`);
}

export async function uploadHydraulicTestChart(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFormFetch<HydraulicTestChartResponse>(`/certificates/${id}/hydraulic-test-chart`, formData, "POST");
}

export async function deleteHydraulicTestChart(id: string) {
  return apiFetch<HydraulicTestChartResponse>(`/certificates/${id}/hydraulic-test-chart`, { method: "DELETE" });
}

export async function validateCertificate(hash: string) {
  return publicFetch<PublicCertificateValidation>(`/public/validate/${hash}`);
}
