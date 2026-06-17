import { API_BASE_URL, resolveApiUrl } from "@/src/lib/config";
import { formatDate } from "@/src/lib/format";
import type { PublicCertificateValidation } from "@/src/types";

async function getValidation(hash: string): Promise<{ data?: PublicCertificateValidation; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/public/validate/${hash}`, { cache: "no-store" });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { error: json?.detail || "Certificado no encontrado" };
    }
    return { data: await res.json() };
  } catch {
    return { error: "No se pudo consultar la validación pública." };
  }
}

export default async function ValidatePage({ params }: { params: { hash: string } }) {
  const { data, error } = await getValidation(params.hash);
  const valid = Boolean(data?.valid);

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <section className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
        <div className={`p-8 text-white ${valid ? "bg-emerald-800" : "bg-red-800"}`}>
          <div className="text-xs font-semibold uppercase tracking-[0.25em] opacity-80">SIP Instrumentación</div>
          <h1 className="mt-4 text-3xl font-bold">{valid ? "Certificado válido" : "Certificado no válido"}</h1>
          <p className="mt-2 text-sm opacity-90">Validación pública por QR contra la base de datos autorizada.</p>
        </div>

        {error ? (
          <div className="p-8">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">{error}</div>
          </div>
        ) : null}

        {data ? (
          <div className="p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Certificado número</div>
                <div className="mt-1 text-3xl font-bold text-slate-950">{data.certificate_number}</div>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold uppercase text-slate-700">
                {data.visible_status.replaceAll("_", " ")}
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <Info label="Cliente" value={data.client_name} />
              <Info label="CUIT" value={data.client_cuit || "—"} />
              <Info label="Equipo" value={data.element || "—"} />
              <Info label="Marca" value={data.brand || "—"} />
              <Info label="Serie" value={data.serial_number || "—"} />
              <Info label="Resultado" value={data.trial_result || "—"} />
              <Info label="Fecha calibración" value={formatDate(data.calibration_date)} />
              <Info label="Vencimiento" value={formatDate(data.expiration_date)} />
              <Info label="Hash" value={data.validation_hash} />
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 p-5">
              <h2 className="font-bold text-slate-950">Patrones aplicados</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {data.patterns.length === 0 ? <p className="text-sm text-slate-500">Sin patrones informados.</p> : null}
                {data.patterns.map((p) => (
                  <div key={`${p.pattern_name}-${p.pattern_serial_number}`} className="rounded-xl bg-slate-50 p-4 text-sm">
                    <div className="font-semibold text-slate-950">{p.pattern_name || "Patrón"}</div>
                    <div className="mt-1 text-slate-500">Serie {p.pattern_serial_number || "—"} · Cert. {p.pattern_certificate_number || "—"}</div>
                    <div className="mt-1 text-slate-500">Recalibración: {formatDate(p.pattern_recalibration_date)}</div>
                  </div>
                ))}
              </div>
            </div>

            {data.pdf_url ? (
              <div className="mt-8">
                <a className="inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800" href={resolveApiUrl(data.pdf_url)} target="_blank">
                  Abrir certificado PDF
                </a>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}
