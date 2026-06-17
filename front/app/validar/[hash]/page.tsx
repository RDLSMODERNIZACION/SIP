import Link from "next/link";
import { certificates, clients, equipment } from "@/data/mockData";
import { daysUntil, formatDate, getVisibleStatus, statusLabel } from "@/lib/certificates";
import type { Certificate, VisibleCertificateStatus } from "@/types";

type PageProps = {
  params: {
    hash: string;
  };
};

export default function PublicValidationPage({ params }: PageProps) {
  const certificate = certificates.find((item) => item.validationHash === params.hash);

  if (!certificate) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
        <section className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 text-center shadow-soft">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-red-100 text-3xl">!</div>
          <h1 className="mt-5 text-3xl font-black">Certificado no encontrado</h1>
          <p className="mt-3 text-slate-500">El código de validación no existe en esta demo hardcodeada.</p>
          <Link href="/" className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Volver al panel</Link>
        </section>
      </main>
    );
  }

  return <ValidationCard certificate={certificate} />;
}

function ValidationCard({ certificate }: { certificate: Certificate }) {
  const client = clients.find((item) => item.id === certificate.clientId);
  const eq = equipment.find((item) => item.id === certificate.equipmentId);
  const visibleStatus = getVisibleStatus(certificate);
  const days = daysUntil(certificate.expirationDate);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
      <section className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-soft">
        <div className="bg-slate-950 p-8 text-white">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Validación pública</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight">{certificate.certificateNumber}</h1>
              <p className="mt-2 text-slate-300">SIP Instrumentación · Certificado digital verificable</p>
            </div>
            <PublicStatus status={visibleStatus} />
          </div>
        </div>

        <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[1fr_0.8fr]">
          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 p-5">
              <h2 className="text-xl font-black">Resultado de validación</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Este certificado figura en la plataforma con estado <strong>{statusLabel(visibleStatus)}</strong>. La validez documental depende del estado mostrado aquí y de la fecha de vencimiento registrada.
              </p>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                {certificate.status === "APROBADO" && days >= 0 && <p>Vence en {days} día/s.</p>}
                {certificate.status === "APROBADO" && days < 0 && <p>El certificado venció hace {Math.abs(days)} día/s.</p>}
                {certificate.status !== "APROBADO" && <p>El certificado todavía no está aprobado para uso final.</p>}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Info label="Cliente" value={client?.name ?? "-"} />
              <Info label="CUIT" value={client?.cuit ?? "-"} />
              <Info label="Equipo" value={certificate.element} />
              <Info label="Serie" value={certificate.serialNumber} />
              <Info label="Marca" value={certificate.brand} />
              <Info label="Modelo" value={certificate.typeModel} />
              <Info label="Fecha calibración" value={formatDate(certificate.calibrationDate)} />
              <Info label="Vencimiento" value={formatDate(certificate.expirationDate)} />
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="mx-auto grid h-44 w-44 grid-cols-8 gap-1 rounded-3xl bg-white p-4 shadow-inner ring-1 ring-slate-200">
              {Array.from({ length: 64 }).map((_, index) => (
                <div key={index} className={`${qrCell(index) ? "bg-slate-950" : "bg-white"} rounded-[2px]`} />
              ))}
            </div>
            <div className="mt-6 space-y-3 text-sm">
              <InfoLine label="Hash" value={certificate.validationHash} />
              <InfoLine label="Código" value={certificate.code} />
              <InfoLine label="Revisión" value={certificate.revision} />
              <InfoLine label="Legajo equipo" value={eq?.internalCode ?? "-"} />
            </div>
            <div className="mt-6 rounded-2xl bg-white p-4 text-xs leading-relaxed text-slate-500">
              Cualquier modificación manual del PDF fuera del sistema no cambia esta página de validación. En producción, esta vista debería consultar la base de datos real.
            </div>
            <Link href="/" className="mt-5 inline-flex w-full justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Volver al panel</Link>
          </aside>
        </div>
      </section>
    </main>
  );
}

function PublicStatus({ status }: { status: VisibleCertificateStatus }) {
  const classes: Record<VisibleCertificateStatus, string> = {
    APROBADO: "bg-green-400 text-green-950",
    POR_VENCER: "bg-amber-300 text-amber-950",
    VENCIDO: "bg-red-400 text-red-950",
    PENDIENTE_APROBACION: "bg-yellow-300 text-yellow-950",
    BORRADOR: "bg-slate-200 text-slate-950",
    RECHAZADO: "bg-red-300 text-red-950",
    ANULADO: "bg-zinc-300 text-zinc-950"
  };
  return <div className={`rounded-3xl px-5 py-3 text-lg font-black ${classes[status]}`}>{statusLabel(status)}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 font-black">{value}</p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-white px-4 py-3">
      <span className="font-bold text-slate-500">{label}</span>
      <span className="max-w-[180px] break-words text-right font-bold text-slate-950">{value}</span>
    </div>
  );
}

function qrCell(index: number) {
  const fixed = [0, 1, 2, 5, 6, 7, 8, 15, 16, 18, 21, 23, 24, 31, 32, 33, 35, 37, 38, 39, 41, 42, 44, 47, 48, 51, 52, 53, 56, 57, 58, 61, 62, 63];
  return fixed.includes(index) || index % 7 === 0 || index % 11 === 0;
}
