import type { Certificate, VisibleCertificateStatus } from "@/types";

export function formatDate(date: string): string {
  if (!date) return "-";
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
}

export function daysUntil(date: string): number {
  const target = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function isExpired(certificate: Certificate): boolean {
  return certificate.status === "APROBADO" && daysUntil(certificate.expirationDate) < 0;
}

export function isNearExpiration(certificate: Certificate): boolean {
  const remaining = daysUntil(certificate.expirationDate);
  return certificate.status === "APROBADO" && remaining >= 0 && remaining <= 60;
}

export function getVisibleStatus(certificate: Certificate): VisibleCertificateStatus {
  if (isExpired(certificate)) return "VENCIDO";
  if (isNearExpiration(certificate)) return "POR_VENCER";
  return certificate.status;
}

export function statusLabel(status: VisibleCertificateStatus): string {
  const labels: Record<VisibleCertificateStatus, string> = {
    BORRADOR: "Borrador",
    PENDIENTE_APROBACION: "Pendiente aprobación",
    APROBADO: "Vigente",
    RECHAZADO: "Rechazado",
    ANULADO: "Anulado",
    VENCIDO: "Vencido",
    POR_VENCER: "Por vencer"
  };
  return labels[status];
}

export function moneyStatusLabel(status: Certificate["paymentStatus"]): string {
  const labels: Record<Certificate["paymentStatus"], string> = {
    PENDIENTE: "Pendiente de pago",
    PAGADO: "Pagado",
    NO_APLICA: "No aplica"
  };
  return labels[status];
}

export function makeValidationUrl(hash: string): string {
  return `/validar/${hash}`;
}
