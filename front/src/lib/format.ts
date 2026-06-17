export function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR").format(date);
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function normalizeStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    vigente: "Vigente",
    vencido: "Vencido",
    por_vencer_30_dias: "Por vencer 30 días",
    por_vencer_60_dias: "Por vencer 60 días",
    pendiente_aprobacion: "Pendiente aprobación",
    borrador: "Borrador",
    rechazado: "Rechazado",
    anulado: "Anulado",
    draft: "Borrador",
    submitted: "Pendiente aprobación",
    approved: "Aprobado",
    rejected: "Rechazado",
    annulled: "Anulado",
    inactivo: "Inactivo",
  };
  return labels[status || ""] || status || "—";
}

export function downloadName(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
