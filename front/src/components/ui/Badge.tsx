import { normalizeStatusLabel } from "@/src/lib/format";

export function StatusBadge({ status }: { status?: string | null }) {
  const key = status || "";
  const styles: Record<string, string> = {
    vigente: "border-emerald-200 bg-emerald-50 text-emerald-800",
    approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
    por_vencer_30_dias: "border-amber-200 bg-amber-50 text-amber-800",
    por_vencer_60_dias: "border-amber-200 bg-amber-50 text-amber-800",
    vencido: "border-red-200 bg-red-50 text-red-800",
    rejected: "border-red-200 bg-red-50 text-red-800",
    rechazado: "border-red-200 bg-red-50 text-red-800",
    pending: "border-yellow-200 bg-yellow-50 text-yellow-800",
    pendiente_aprobacion: "border-yellow-200 bg-yellow-50 text-yellow-800",
    submitted: "border-yellow-200 bg-yellow-50 text-yellow-800",
    borrador: "border-slate-200 bg-slate-50 text-slate-700",
    draft: "border-slate-200 bg-slate-50 text-slate-700",
    anulado: "border-zinc-300 bg-zinc-100 text-zinc-700",
    annulled: "border-zinc-300 bg-zinc-100 text-zinc-700",
    inactivo: "border-zinc-300 bg-zinc-100 text-zinc-700",
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[key] || "border-slate-200 bg-slate-50 text-slate-700"}`}>
      {normalizeStatusLabel(key)}
    </span>
  );
}
