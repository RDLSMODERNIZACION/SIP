export type RoleCode = "admin" | "certificador" | "aprobador" | "cliente";

export type User = {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  status?: string;
  client_id?: string | null;
  client_name?: string | null;
  client_cuit?: string | null;
  role_id?: string;
  role_code: RoleCode;
  role_name: string;
  created_at?: string;
  updated_at?: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export type Client = {
  id: string;
  name: string;
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
  created_at?: string;
  updated_at?: string;
};

export type Equipment = {
  id: string;
  client_id: string;
  client_name?: string;
  client_cuit?: string;
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

export type Pattern = {
  id: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  serial_number: string;
  certificate_number?: string | null;
  range_value?: string | null;
  unit?: string | null;
  calibration_date?: string | null;
  recalibration_date?: string | null;
  certificate_url?: string | null;
  active?: boolean;
  visible_status?: string;
};

export type CertificateStatus = "draft" | "submitted" | "approved" | "rejected" | "annulled";

export type CertificateVisibleStatus =
  | "vigente"
  | "vencido"
  | "por_vencer_30_dias"
  | "por_vencer_60_dias"
  | "pendiente_aprobacion"
  | "borrador"
  | "rechazado"
  | "anulado"
  | "sin_estado";

export type Certificate = {
  id: string;
  certificate_number: string;
  certificate_code?: string | null;
  certificate_revision?: string | null;
  certificate_validity?: string | null;
  status: CertificateStatus;
  visible_status: CertificateVisibleStatus;
  client_id: string;
  client_name: string;
  client_cuit?: string | null;
  equipment_id?: string | null;
  element?: string | null;
  type_model?: string | null;
  brand?: string | null;
  serial_number?: string | null;
  range_value?: string | null;
  unit?: string | null;
  size_value?: string | null;
  calibration_date?: string | null;
  expiration_date?: string | null;
  test_frequency_months?: number | null;
  test_type?: string | null;
  reference_method?: string | null;
  environmental_conditions?: string | null;
  measurement_unit?: string | null;
  observations?: string | null;
  conclusions?: string | null;
  trial_result?: string | null;
  approved_result?: boolean | null;
  final_comments?: string | null;
  validation_hash?: string | null;
  public_validation_url?: string | null;
  qr_url?: string | null;
  pdf_url?: string | null;
  is_paid?: boolean;
  created_by_name?: string | null;
  approved_by_name?: string | null;
  created_at?: string;
  submitted_at?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  annulment_reason?: string | null;
};

export type CertificateTestRow = {
  id?: string;
  row_order: number;
  pressure_label: string;
  range_value?: number | null;
  unit?: string | null;
  acceptance_criteria?: string | null;
  result?: string | null;
  observations?: string | null;
};

export type CertificatePatternUsage = {
  id?: string;
  pattern_id?: string;
  pattern_name?: string | null;
  pattern_serial_number?: string | null;
  pattern_certificate_number?: string | null;
  pattern_range_value?: string | null;
  pattern_unit?: string | null;
  pattern_calibration_date?: string | null;
  pattern_recalibration_date?: string | null;
  pattern_certificate_url?: string | null;
};

export type CertificateDetail = {
  certificate: Certificate;
  test_rows: CertificateTestRow[];
  patterns: CertificatePatternUsage[];
  comments: any[];
  audit: any[];
  files: any[];
};

export type CertificateSummary = {
  client_id?: string;
  client_name?: string;
  client_cuit?: string;
  total_certificates: number;
  vigentes: number;
  vencidos: number;
  por_vencer: number;
  por_vencer_30_dias?: number;
  por_vencer_60_dias?: number;
  pendientes: number;
  borradores?: number;
  rechazados: number;
  anulados: number;
};

export type PublicCertificateValidation = {
  valid: boolean;
  certificate_number: string;
  visible_status: string;
  status: string;
  client_name: string;
  client_cuit?: string | null;
  element?: string | null;
  brand?: string | null;
  serial_number?: string | null;
  calibration_date?: string | null;
  expiration_date?: string | null;
  trial_result?: string | null;
  approved_result?: boolean | null;
  pdf_url?: string | null;
  qr_url?: string | null;
  validation_hash: string;
  patterns: CertificatePatternUsage[];
};
