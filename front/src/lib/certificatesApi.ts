import { apiFetch, publicFetch } from "./api";
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

export type CertificateCreatePayload = {
  certificate_number: string;
  certificate_code?: string;
  certificate_revision?: string;
  certificate_validity?: string;
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

export async function createCertificate(payload: CertificateCreatePayload) {
  return apiFetch<CertificateDetail>("/certificates", {
    method: "POST",
    body: JSON.stringify(cleanPayload(payload)),
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

export async function validateCertificate(hash: string) {
  return publicFetch<PublicCertificateValidation>(`/public/validate/${hash}`);
}
