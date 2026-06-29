import { apiFetch, publicFetch } from "./api";
import type { Certificate, CertificateDetail, PublicCertificateValidation } from "@/src/types";

function cleanPayload<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cleanPayload(item)) as T;
  if (value instanceof FormData) return value;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => [k, v === "" ? undefined : cleanPayload(v)])
        .filter(([, v]) => v !== undefined)
    ) as T;
  }
  return value;
}

export type CertificateTemplate = {
  code: string;
  name: string;
  document_type?: string | null;
  default_method?: string | null;
  default_frequency_months?: number | null;
  requires_hydraulic_chart?: boolean | null;
  active?: boolean;
};

export type CertificateCreatePayload = {
  certificate_number: string;
  certificate_code?: string;
  certificate_revision?: string;
  certificate_validity?: string;
  document_type?: string | null;
  template_type?: string | null;
  md_required?: boolean | null;
  requires_hydraulic_chart?: boolean | null;
  previous_certificate_id?: string | null;
  previous_certificate_number?: string | null;
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
  metrology_results?: Array<any>;
  sensor_loop_results?: Array<any>;
  relief_valve_result?: any | null;
  hydrostatic_result?: any | null;
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
  return apiFetch<{ ok: boolean; deleted_id?: string; id?: string }>(`/certificates/${id}${query}`, {
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


export type HydraulicTestChartResponse = {
  file_url?: string | null;
  file_type?: string | null;
  filename?: string | null;
  ok?: boolean;
};

export async function getHydraulicTestChart(id: string) {
  return apiFetch<HydraulicTestChartResponse>(`/certificates/${id}/hydraulic-test-chart`);
}

export async function uploadHydraulicTestChart(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<HydraulicTestChartResponse>(`/certificates/${id}/hydraulic-test-chart`, {
    method: "POST",
    body: formData,
  });
}

export async function deleteHydraulicTestChart(id: string) {
  return apiFetch<HydraulicTestChartResponse>(`/certificates/${id}/hydraulic-test-chart`, {
    method: "DELETE",
  });
}

// Alias viejo: algunas pantallas históricas usaban /hydraulic-chart.
// Lo dejamos apuntando al endpoint nuevo para no romper imports existentes.
export async function uploadHydraulicChart(id: string, file: File) {
  return uploadHydraulicTestChart(id, file);
}

export async function validateCertificate(hash: string) {
  return publicFetch<PublicCertificateValidation>(`/public/validate/${hash}`);
}
