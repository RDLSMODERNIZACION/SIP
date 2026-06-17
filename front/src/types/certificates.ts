export type Role = "admin" | "certificador" | "aprobador" | "cliente";

export type CertificateStatus =
  | "BORRADOR"
  | "PENDIENTE_APROBACION"
  | "APROBADO"
  | "RECHAZADO"
  | "ANULADO";

export type VisibleCertificateStatus = CertificateStatus | "VENCIDO" | "POR_VENCER";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  clientId?: string;
  active: boolean;
};

export type Client = {
  id: string;
  name: string;
  cuit: string;
  email: string;
  phone: string;
  address: string;
  industry: string;
};

export type Equipment = {
  id: string;
  clientId: string;
  name: string;
  typeModel: string;
  brand: string;
  serialNumber: string;
  internalCode?: string;
  location?: string;
  criticality: "Alta" | "Media" | "Baja";
};

export type PatternInstrument = {
  id: string;
  name: string;
  serialNumber: string;
  certificateRef: string;
  rangeValue: string;
  calibrationDate: string;
  recalibrationDate: string;
  certificateUrl?: string;
  status: "VIGENTE" | "POR_VENCER" | "VENCIDO";
};

export type PressureTest = {
  id: string;
  testName: string;
  pressureValue: number | null;
  unit: string;
  acceptanceCriteria: string;
  result: string;
  observations: string;
};

export type Certificate = {
  id: string;
  certificateNumber: string;
  validationHash: string;
  code: string;
  validity: string;
  revision: string;
  clientId: string;
  equipmentId: string;
  purchaseOrder: string;
  calibrationDate: string;
  expirationDate: string;
  element: string;
  typeModel: string;
  brand: string;
  serialNumber: string;
  rangeValue: string;
  unit: string;
  size: string;
  testType: string;
  referenceMethod: string;
  environmentalConditions: string;
  measurementUnit: string;
  observations: string;
  conclusions: string;
  trialResult: string;
  trialFrequency: string;
  approvedResult: boolean;
  finalComments: string;
  patternIds: string[];
  pressureTests: PressureTest[];
  createdBy: string;
  approvedBy?: string;
  status: CertificateStatus;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  paymentStatus: "PENDIENTE" | "PAGADO" | "NO_APLICA";
  pdfUrl?: string;
  qrUrl: string;
  auditLog: Array<{
    id: string;
    userName: string;
    action: string;
    date: string;
    notes?: string;
  }>;
};

export type CertificateFormInput = {
  certificateNumber: string;
  clientId: string;
  equipmentId: string;
  calibrationDate: string;
  expirationDate: string;
  element: string;
  typeModel: string;
  brand: string;
  serialNumber: string;
  rangeValue: string;
  unit: string;
  size: string;
  referenceMethod: string;
  observations: string;
  finalComments: string;
};
