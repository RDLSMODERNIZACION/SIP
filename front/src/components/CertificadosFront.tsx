"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { certificates as seedCertificates, clients, equipment, patternInstruments, users } from "@/data/mockData";
import type { Certificate, CertificateFormInput, CertificateStatus, Client, Equipment, PatternInstrument, Role, User, VisibleCertificateStatus } from "@/types";
import { daysUntil, formatDate, getVisibleStatus, isExpired, makeValidationUrl, moneyStatusLabel, statusLabel } from "@/lib/certificates";

type Section = "dashboard" | "certificados" | "aprobaciones" | "clientes" | "equipos" | "patrones" | "portal" | "validacion" | "reportes";

type RoleOption = {
  role: Role;
  title: string;
  subtitle: string;
};

const roleOptions: RoleOption[] = [
  { role: "admin", title: "Administrador", subtitle: "Control total" },
  { role: "certificador", title: "Trabajador", subtitle: "Carga certificados" },
  { role: "aprobador", title: "Aprobador", subtitle: "Revisa y aprueba" },
  { role: "cliente", title: "Cliente", subtitle: "Portal cliente" }
];

const sectionLabels: Record<Section, string> = {
  dashboard: "Dashboard",
  certificados: "Certificados",
  aprobaciones: "Aprobaciones",
  clientes: "Clientes",
  equipos: "Equipos",
  patrones: "Patrones",
  portal: "Portal cliente",
  validacion: "Validación QR",
  reportes: "Reportes"
};

const adminSections: Section[] = ["dashboard", "certificados", "aprobaciones", "clientes", "equipos", "patrones", "validacion", "reportes"];
const certificadorSections: Section[] = ["dashboard", "certificados", "clientes", "equipos", "patrones", "validacion"];
const aprobadorSections: Section[] = ["dashboard", "certificados", "aprobaciones", "clientes", "equipos", "patrones", "validacion", "reportes"];
const clientSections: Section[] = ["portal", "certificados", "equipos", "validacion"];

function sectionsByRole(role: Role): Section[] {
  if (role === "cliente") return clientSections;
  if (role === "certificador") return certificadorSections;
  if (role === "aprobador") return aprobadorSections;
  return adminSections;
}

function nowLabel() {
  return new Date().toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getRoleUser(role: Role): User {
  return users.find((user) => user.role === role) ?? users[0];
}

function slugifyCertificateNumber(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

function getClientName(clientId: string) {
  return clients.find((client) => client.id === clientId)?.name ?? "Sin cliente";
}

function getEquipmentName(equipmentId: string) {
  return equipment.find((item) => item.id === equipmentId)?.name ?? "Sin equipo";
}

function getUserName(userId?: string) {
  if (!userId) return "-";
  return users.find((user) => user.id === userId)?.name ?? "-";
}

function roleTitle(role: Role) {
  return roleOptions.find((option) => option.role === role)?.title ?? role;
}

export default function CertificadosFront() {
  const [role, setRole] = useState<Role>("admin");
  const [section, setSection] = useState<Section>("dashboard");
  const [certificates, setCertificates] = useState<Certificate[]>(seedCertificates);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState("");

  const currentUser = getRoleUser(role);
  const currentClientId = currentUser.clientId;

  const allowedSections = sectionsByRole(role);

  const visibleCertificates = useMemo(() => {
    let list = certificates;

    if (role === "cliente" && currentClientId) {
      list = list.filter((certificate) => certificate.clientId === currentClientId);
    }

    if (role === "certificador") {
      list = list.filter((certificate) => certificate.createdBy === currentUser.id);
    }

    if (search.trim()) {
      const normalized = search.toLowerCase().trim();
      list = list.filter((certificate) => {
        const client = getClientName(certificate.clientId).toLowerCase();
        const equipmentName = getEquipmentName(certificate.equipmentId).toLowerCase();
        return [
          certificate.certificateNumber,
          client,
          equipmentName,
          certificate.element,
          certificate.brand,
          certificate.serialNumber,
          certificate.status
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      });
    }

    return list;
  }, [certificates, currentClientId, currentUser.id, role, search]);

  const pendingApprovals = useMemo(
    () => certificates.filter((certificate) => certificate.status === "PENDIENTE_APROBACION"),
    [certificates]
  );

  const stats = useMemo(() => buildStats(visibleCertificates), [visibleCertificates]);
  const allStats = useMemo(() => buildStats(certificates), [certificates]);

  function handleRoleChange(nextRole: Role) {
    setRole(nextRole);
    setSection(nextRole === "cliente" ? "portal" : "dashboard");
    setSearch("");
  }

  function approveCertificate(id: string) {
    setCertificates((prev) =>
      prev.map((certificate) => {
        if (certificate.id !== id) return certificate;
        return {
          ...certificate,
          status: "APROBADO",
          approvedBy: currentUser.id,
          approvedAt: new Date().toISOString(),
          approvedResult: true,
          trialResult: "Aprobado",
          pdfUrl: "#",
          auditLog: [
            ...certificate.auditLog,
            {
              id: `audit-${Date.now()}`,
              userName: currentUser.name,
              action: "Aprobó el certificado",
              date: nowLabel()
            }
          ]
        };
      })
    );
    setSelectedCertificate(null);
  }

  function rejectCertificate(id: string, reason: string) {
    const safeReason = reason.trim() || "Rechazado para corrección de datos.";
    setCertificates((prev) =>
      prev.map((certificate) => {
        if (certificate.id !== id) return certificate;
        return {
          ...certificate,
          status: "RECHAZADO",
          rejectedAt: new Date().toISOString(),
          rejectionReason: safeReason,
          auditLog: [
            ...certificate.auditLog,
            {
              id: `audit-${Date.now()}`,
              userName: currentUser.name,
              action: "Rechazó el certificado",
              date: nowLabel(),
              notes: safeReason
            }
          ]
        };
      })
    );
    setSelectedCertificate(null);
  }

  function submitCertificate(id: string) {
    setCertificates((prev) =>
      prev.map((certificate) => {
        if (certificate.id !== id) return certificate;
        return {
          ...certificate,
          status: "PENDIENTE_APROBACION",
          submittedAt: new Date().toISOString(),
          auditLog: [
            ...certificate.auditLog,
            {
              id: `audit-${Date.now()}`,
              userName: currentUser.name,
              action: "Envió a aprobación",
              date: nowLabel()
            }
          ]
        };
      })
    );
  }

  function annulCertificate(id: string) {
    setCertificates((prev) =>
      prev.map((certificate) => {
        if (certificate.id !== id) return certificate;
        return {
          ...certificate,
          status: "ANULADO",
          auditLog: [
            ...certificate.auditLog,
            {
              id: `audit-${Date.now()}`,
              userName: currentUser.name,
              action: "Anuló el certificado",
              date: nowLabel(),
              notes: "Anulado desde frontend hardcodeado."
            }
          ]
        };
      })
    );
    setSelectedCertificate(null);
  }

  function createCertificate(input: CertificateFormInput, targetStatus: CertificateStatus) {
    const selectedEquipment = equipment.find((item) => item.id === input.equipmentId);
    const hash = slugifyCertificateNumber(input.certificateNumber) || `cert-${Date.now()}`;
    const newCertificate: Certificate = {
      id: `cert-${Date.now()}`,
      certificateNumber: input.certificateNumber,
      validationHash: hash,
      code: "CE-SIP-01",
      validity: "2024-10-01",
      revision: "5",
      clientId: input.clientId,
      equipmentId: input.equipmentId,
      purchaseOrder: "",
      calibrationDate: input.calibrationDate,
      expirationDate: input.expirationDate,
      element: input.element || selectedEquipment?.name || "Equipo sin definir",
      typeModel: input.typeModel || selectedEquipment?.typeModel || "",
      brand: input.brand || selectedEquipment?.brand || "",
      serialNumber: input.serialNumber || selectedEquipment?.serialNumber || "",
      rangeValue: input.rangeValue,
      unit: input.unit,
      size: input.size,
      testType: "Prueba / calibración",
      referenceMethod: input.referenceMethod,
      environmentalConditions: "Temperatura referencia 20 °C (± 1 °C). Presión atmosférica a registrar.",
      measurementUnit: input.unit,
      observations: input.observations || "SIN",
      conclusions: targetStatus === "PENDIENTE_APROBACION" ? "Pendiente de aprobación técnica." : "Borrador pendiente de completar.",
      trialResult: targetStatus === "PENDIENTE_APROBACION" ? "Pendiente" : "Borrador",
      trialFrequency: "12 meses",
      approvedResult: false,
      finalComments: input.finalComments,
      patternIds: patternInstruments.length ? [patternInstruments[0].id] : [],
      pressureTests: [
        {
          id: `pt-${Date.now()}-1`,
          testName: "Punto de prueba N°1",
          pressureValue: input.rangeValue ? Number(input.rangeValue.replace(/[^0-9.,]/g, "").replace(",", ".")) || null : null,
          unit: input.unit || "",
          acceptanceCriteria: "A definir",
          result: "Pendiente",
          observations: ""
        }
      ],
      createdBy: currentUser.id,
      status: targetStatus,
      submittedAt: targetStatus === "PENDIENTE_APROBACION" ? new Date().toISOString() : undefined,
      paymentStatus: "NO_APLICA",
      qrUrl: makeValidationUrl(hash),
      auditLog: [
        {
          id: `audit-${Date.now()}`,
          userName: currentUser.name,
          action: targetStatus === "PENDIENTE_APROBACION" ? "Creó y envió a aprobación" : "Creó borrador",
          date: nowLabel()
        }
      ]
    };

    setCertificates((prev) => [newCertificate, ...prev]);
    setShowCreateModal(false);
    setSection("certificados");
  }

  const pageTitle = role === "cliente" && section === "portal" ? "Portal del cliente" : sectionLabels[section];

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <aside className="no-print hidden w-72 shrink-0 border-r border-slate-200 bg-white p-5 lg:block">
          <BrandBlock />
          <nav className="mt-8 space-y-2">
            {allowedSections.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSection(item)}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                  section === item ? "bg-slate-950 text-white shadow-soft" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <span>{sectionLabels[item]}</span>
                {item === "aprobaciones" && pendingApprovals.length > 0 && (
                  <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs text-slate-950">{pendingApprovals.length}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Modo activo</p>
            <p className="mt-2 text-lg font-black">{roleTitle(role)}</p>
            <p className="mt-1 text-sm text-slate-500">{currentUser.name}</p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur xl:px-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">SIP Instrumentación</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">{pageTitle}</h1>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <RoleSwitcher role={role} onChange={handleRoleChange} />
                {(role === "admin" || role === "certificador") && (
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:-translate-y-0.5"
                  >
                    + Nuevo certificado
                  </button>
                )}
              </div>
            </div>
          </header>

          <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 xl:px-8">
            <MobileNav allowedSections={allowedSections} section={section} setSection={setSection} pending={pendingApprovals.length} />

            {section === "dashboard" && (
              <DashboardPanel
                stats={stats}
                allStats={allStats}
                certificates={visibleCertificates}
                pendingApprovals={pendingApprovals}
                onOpenCertificate={setSelectedCertificate}
                onSectionChange={setSection}
              />
            )}

            {section === "certificados" && (
              <CertificatesPanel
                title={role === "cliente" ? "Mis certificados" : "Listado de certificados"}
                certificates={visibleCertificates}
                search={search}
                setSearch={setSearch}
                onOpenCertificate={setSelectedCertificate}
                onSubmit={submitCertificate}
                canSubmit={role === "admin" || role === "certificador"}
              />
            )}

            {section === "aprobaciones" && (
              <ApprovalsPanel
                certificates={pendingApprovals}
                onOpenCertificate={setSelectedCertificate}
                onApprove={approveCertificate}
                onReject={rejectCertificate}
              />
            )}

            {section === "clientes" && <ClientsPanel certificates={certificates} />}
            {section === "equipos" && <EquipmentPanel role={role} currentClientId={currentClientId} certificates={certificates} />}
            {section === "patrones" && <PatternsPanel />}
            {section === "portal" && (
              <ClientPortalPanel
                certificates={visibleCertificates}
                currentUser={currentUser}
                onOpenCertificate={setSelectedCertificate}
                onSectionChange={setSection}
              />
            )}
            {section === "validacion" && <ValidationPanel certificates={visibleCertificates} onOpenCertificate={setSelectedCertificate} />}
            {section === "reportes" && <ReportsPanel certificates={certificates} />}
          </div>
        </section>
      </div>

      {selectedCertificate && (
        <CertificateDetailModal
          certificate={selectedCertificate}
          role={role}
          onClose={() => setSelectedCertificate(null)}
          onApprove={approveCertificate}
          onReject={rejectCertificate}
          onAnnul={annulCertificate}
          onSubmit={submitCertificate}
        />
      )}

      {showCreateModal && (
        <CreateCertificateModal
          currentUser={currentUser}
          onClose={() => setShowCreateModal(false)}
          onCreate={createCertificate}
        />
      )}
    </main>
  );
}

function buildStats(list: Certificate[]) {
  return {
    total: list.length,
    vigentes: list.filter((certificate) => getVisibleStatus(certificate) === "APROBADO").length,
    porVencer: list.filter((certificate) => getVisibleStatus(certificate) === "POR_VENCER").length,
    vencidos: list.filter((certificate) => getVisibleStatus(certificate) === "VENCIDO").length,
    pendientes: list.filter((certificate) => certificate.status === "PENDIENTE_APROBACION").length,
    borradores: list.filter((certificate) => certificate.status === "BORRADOR").length,
    rechazados: list.filter((certificate) => certificate.status === "RECHAZADO").length
  };
}

function BrandBlock() {
  return (
    <div className="rounded-3xl bg-slate-950 p-5 text-white shadow-soft">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-xl font-black text-red-600">SIP</div>
        <div>
          <p className="text-sm font-black leading-tight">Certificados Digitales</p>
          <p className="text-xs text-slate-300">Calibración · Ensayo · QR</p>
        </div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-slate-300">
        Front hardcodeado para validar roles, pantallas y flujo antes de conectar backend y base de datos.
      </p>
    </div>
  );
}

function RoleSwitcher({ role, onChange }: { role: Role; onChange: (role: Role) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-2 md:grid-cols-4">
      {roleOptions.map((option) => (
        <button
          key={option.role}
          type="button"
          onClick={() => onChange(option.role)}
          className={`rounded-2xl px-3 py-2 text-left transition ${
            role === option.role ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:bg-white/70"
          }`}
        >
          <div className="text-xs font-black">{option.title}</div>
          <div className="text-[11px]">{option.subtitle}</div>
        </button>
      ))}
    </div>
  );
}

function MobileNav({
  allowedSections,
  section,
  setSection,
  pending
}: {
  allowedSections: Section[];
  section: Section;
  setSection: (section: Section) => void;
  pending: number;
}) {
  return (
    <div className="no-print mb-5 flex gap-2 overflow-x-auto pb-2 lg:hidden">
      {allowedSections.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setSection(item)}
          className={`whitespace-nowrap rounded-2xl px-4 py-2 text-sm font-bold ${section === item ? "bg-slate-950 text-white" : "bg-white text-slate-600"}`}
        >
          {sectionLabels[item]}
          {item === "aprobaciones" && pending > 0 ? ` (${pending})` : ""}
        </button>
      ))}
    </div>
  );
}

function DashboardPanel({
  stats,
  allStats,
  certificates,
  pendingApprovals,
  onOpenCertificate,
  onSectionChange
}: {
  stats: ReturnType<typeof buildStats>;
  allStats: ReturnType<typeof buildStats>;
  certificates: Certificate[];
  pendingApprovals: Certificate[];
  onOpenCertificate: (certificate: Certificate) => void;
  onSectionChange: (section: Section) => void;
}) {
  const expiring = certificates
    .filter((certificate) => ["POR_VENCER", "VENCIDO"].includes(getVisibleStatus(certificate)))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total certificados" value={stats.total} helper="Visibles para el usuario" />
        <StatCard title="Vigentes" value={stats.vigentes} helper="Aprobados y no vencidos" tone="green" />
        <StatCard title="Por vencer" value={stats.porVencer} helper="Próximos 60 días" tone="amber" />
        <StatCard title="Vencidos" value={stats.vencidos} helper="Requieren renovación" tone="red" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black">Bandeja operativa</h2>
              <p className="text-sm text-slate-500">Certificados que requieren una acción rápida.</p>
            </div>
            <button type="button" onClick={() => onSectionChange("aprobaciones")} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold hover:bg-slate-50">
              Ir a aprobaciones
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <MiniMetric label="Pendientes de aprobación" value={pendingApprovals.length} />
            <MiniMetric label="Borradores" value={stats.borradores} />
            <MiniMetric label="Rechazados" value={stats.rechazados} />
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="p-4">Certificado</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Equipo</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Acción</th>
                </tr>
              </thead>
              <tbody>
                {[...pendingApprovals, ...expiring].slice(0, 6).map((certificate) => (
                  <tr key={`${certificate.id}-dash`} className="border-t border-slate-100">
                    <td className="p-4 font-black">{certificate.certificateNumber}</td>
                    <td className="p-4">{getClientName(certificate.clientId)}</td>
                    <td className="p-4">{certificate.element}</td>
                    <td className="p-4"><StatusPill status={getVisibleStatus(certificate)} /></td>
                    <td className="p-4">
                      <button type="button" onClick={() => onOpenCertificate(certificate)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white">Ver</button>
                    </td>
                  </tr>
                ))}
                {[...pendingApprovals, ...expiring].length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-sm text-slate-500">No hay acciones urgentes.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black">Valor agregado</h2>
          <div className="mt-4 space-y-3">
            <ValueItem title="QR público" text="Cada certificado aprobado tiene una página de validación para auditorías." />
            <ValueItem title="Legajo por equipo" text="El cliente puede ver historial técnico y vencimientos por serie." />
            <ValueItem title="Control de patrones" text="La empresa evita emitir certificados con patrones vencidos." />
            <ValueItem title="Renovaciones" text="Los vencimientos se convierten en oportunidades comerciales futuras." />
          </div>
          <div className="mt-5 rounded-3xl bg-slate-950 p-5 text-white">
            <p className="text-sm text-slate-300">Total global</p>
            <p className="mt-1 text-4xl font-black">{allStats.total}</p>
            <p className="mt-2 text-xs text-slate-300">certificados cargados en la demo.</p>
          </div>
        </Card>
      </section>
    </div>
  );
}

function CertificatesPanel({
  title,
  certificates,
  search,
  setSearch,
  onOpenCertificate,
  onSubmit,
  canSubmit
}: {
  title: string;
  certificates: Certificate[];
  search: string;
  setSearch: (value: string) => void;
  onOpenCertificate: (certificate: Certificate) => void;
  onSubmit: (id: string) => void;
  canSubmit: boolean;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black">{title}</h2>
          <p className="text-sm text-slate-500">Buscar por certificado, cliente, equipo, marca, serie o estado.</p>
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar certificado..."
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-slate-950/10 focus:ring-4 md:max-w-sm"
        />
      </div>
      <CertificateTable certificates={certificates} onOpenCertificate={onOpenCertificate} onSubmit={onSubmit} canSubmit={canSubmit} />
    </Card>
  );
}

function CertificateTable({
  certificates,
  onOpenCertificate,
  onSubmit,
  canSubmit
}: {
  certificates: Certificate[];
  onOpenCertificate: (certificate: Certificate) => void;
  onSubmit?: (id: string) => void;
  canSubmit?: boolean;
}) {
  return (
    <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-200">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="p-4">Certificado</th>
            <th className="p-4">Cliente</th>
            <th className="p-4">Equipo</th>
            <th className="p-4">Serie</th>
            <th className="p-4">Calibración</th>
            <th className="p-4">Vencimiento</th>
            <th className="p-4">Estado</th>
            <th className="p-4">Pago</th>
            <th className="p-4">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {certificates.map((certificate) => {
            const visibleStatus = getVisibleStatus(certificate);
            return (
              <tr key={certificate.id} className="border-t border-slate-100 bg-white hover:bg-slate-50/70">
                <td className="p-4">
                  <div className="font-black">{certificate.certificateNumber}</div>
                  <div className="text-xs text-slate-500">{certificate.code} · Rev. {certificate.revision}</div>
                </td>
                <td className="p-4">
                  <div className="font-semibold">{getClientName(certificate.clientId)}</div>
                  <div className="text-xs text-slate-500">CUIT {clients.find((client) => client.id === certificate.clientId)?.cuit}</div>
                </td>
                <td className="p-4">{certificate.element}</td>
                <td className="p-4 font-semibold">{certificate.serialNumber}</td>
                <td className="p-4">{formatDate(certificate.calibrationDate)}</td>
                <td className="p-4">
                  <div>{formatDate(certificate.expirationDate)}</div>
                  <div className="text-xs text-slate-500">{expirationHelper(certificate)}</div>
                </td>
                <td className="p-4"><StatusPill status={visibleStatus} /></td>
                <td className="p-4"><PaymentPill status={certificate.paymentStatus} /></td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => onOpenCertificate(certificate)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-white">
                      Ver
                    </button>
                    {canSubmit && certificate.status === "BORRADOR" && onSubmit && (
                      <button type="button" onClick={() => onSubmit(certificate.id)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white">
                        Enviar
                      </button>
                    )}
                    {certificate.status === "APROBADO" && (
                      <Link href={certificate.qrUrl} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">
                        QR
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {certificates.length === 0 && (
            <tr>
              <td colSpan={9} className="p-10 text-center text-sm text-slate-500">No hay certificados para mostrar.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function expirationHelper(certificate: Certificate) {
  if (certificate.status !== "APROBADO") return "No computa vencimiento";
  const days = daysUntil(certificate.expirationDate);
  if (days < 0) return `Vencido hace ${Math.abs(days)} días`;
  if (days === 0) return "Vence hoy";
  return `Faltan ${days} días`;
}

function ApprovalsPanel({
  certificates,
  onOpenCertificate,
  onApprove,
  onReject
}: {
  certificates: Certificate[];
  onOpenCertificate: (certificate: Certificate) => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}) {
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  return (
    <Card>
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-black">Bandeja de aprobación</h2>
          <p className="text-sm text-slate-500">El aprobador revisa los certificados cargados por el trabajador antes de emitir el PDF final.</p>
        </div>
        <div className="rounded-2xl bg-amber-100 px-4 py-2 text-sm font-black text-amber-800">{certificates.length} pendiente/s</div>
      </div>

      <div className="mt-6 grid gap-4">
        {certificates.map((certificate) => (
          <div key={certificate.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr] lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black">{certificate.certificateNumber}</h3>
                  <StatusPill status={getVisibleStatus(certificate)} />
                  <PaymentPill status={certificate.paymentStatus} />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <InfoBox label="Cliente" value={getClientName(certificate.clientId)} />
                  <InfoBox label="Equipo" value={certificate.element} />
                  <InfoBox label="Serie" value={certificate.serialNumber} />
                </div>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700">
                  <strong>Método:</strong> {certificate.referenceMethod}
                </div>
              </div>
              <div className="rounded-3xl bg-white p-4">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Motivo de rechazo</label>
                <textarea
                  value={reasonById[certificate.id] ?? ""}
                  onChange={(event) => setReasonById((prev) => ({ ...prev, [certificate.id]: event.target.value }))}
                  placeholder="Ej: corregir número de serie, revisar patrón utilizado, falta OC..."
                  className="mt-2 h-24 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none ring-slate-950/10 focus:ring-4"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => onOpenCertificate(certificate)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50">Ver detalle</button>
                  <button type="button" onClick={() => onApprove(certificate.id)} className="rounded-xl bg-green-700 px-3 py-2 text-xs font-bold text-white">Aprobar</button>
                  <button type="button" onClick={() => onReject(certificate.id, reasonById[certificate.id] ?? "")} className="rounded-xl bg-red-700 px-3 py-2 text-xs font-bold text-white">Rechazar</button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {certificates.length === 0 && <EmptyState title="No hay certificados pendientes" text="Cuando un trabajador envíe un certificado a revisión, aparecerá en esta bandeja." />}
      </div>
    </Card>
  );
}

function ClientsPanel({ certificates }: { certificates: Certificate[] }) {
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-xl font-black">Clientes</h2>
        <p className="mt-1 text-sm text-slate-500">Resumen comercial y técnico por cliente.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => {
            const list = certificates.filter((certificate) => certificate.clientId === client.id);
            const stats = buildStats(list);
            return (
              <div key={client.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-black">{client.name}</h3>
                    <p className="text-sm text-slate-500">CUIT {client.cuit}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{client.industry}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <MiniMetric label="Total" value={stats.total} compact />
                  <MiniMetric label="Vigentes" value={stats.vigentes} compact />
                  <MiniMetric label="Vencidos" value={stats.vencidos} compact />
                </div>
                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  <p>{client.email}</p>
                  <p>{client.phone}</p>
                  <p>{client.address}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function EquipmentPanel({ role, currentClientId, certificates }: { role: Role; currentClientId?: string; certificates: Certificate[] }) {
  const visibleEquipment = role === "cliente" && currentClientId ? equipment.filter((item) => item.clientId === currentClientId) : equipment;

  return (
    <Card>
      <h2 className="text-xl font-black">Legajo digital de equipos</h2>
      <p className="mt-1 text-sm text-slate-500">Cada serie puede tener su historial, certificados, vencimientos y observaciones.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleEquipment.map((item) => {
          const history = certificates.filter((certificate) => certificate.equipmentId === item.id);
          const lastCertificate = history[0];
          return (
            <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black">{item.name}</h3>
                  <p className="text-sm text-slate-500">{getClientName(item.clientId)}</p>
                </div>
                <CriticalityPill value={item.criticality} />
              </div>
              <div className="mt-4 grid gap-2 text-sm">
                <InfoLine label="Modelo" value={item.typeModel} />
                <InfoLine label="Marca" value={item.brand} />
                <InfoLine label="Serie" value={item.serialNumber} />
                <InfoLine label="Ubicación" value={item.location ?? "-"} />
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Historial</p>
                <p className="mt-1 text-2xl font-black">{history.length}</p>
                <p className="text-xs text-slate-500">certificado/s asociados</p>
                {lastCertificate && (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">Último: {lastCertificate.certificateNumber}</span>
                    <StatusPill status={getVisibleStatus(lastCertificate)} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PatternsPanel() {
  return (
    <Card>
      <h2 className="text-xl font-black">Patrones e instrumentos propios</h2>
      <p className="mt-1 text-sm text-slate-500">Control interno para evitar certificados emitidos con equipos patrón vencidos.</p>
      <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-200">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="p-4">Patrón</th>
              <th className="p-4">Serie</th>
              <th className="p-4">Certificado</th>
              <th className="p-4">Rango</th>
              <th className="p-4">Calibración</th>
              <th className="p-4">Recalibración</th>
              <th className="p-4">Estado</th>
            </tr>
          </thead>
          <tbody>
            {patternInstruments.map((pattern) => (
              <tr key={pattern.id} className="border-t border-slate-100">
                <td className="p-4 font-black">{pattern.name}</td>
                <td className="p-4">{pattern.serialNumber}</td>
                <td className="p-4">{pattern.certificateRef}</td>
                <td className="p-4">{pattern.rangeValue}</td>
                <td className="p-4">{formatDate(pattern.calibrationDate)}</td>
                <td className="p-4">{formatDate(pattern.recalibrationDate)}</td>
                <td className="p-4"><PatternPill status={pattern.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <strong>Regla futura:</strong> cuando conectemos backend, si un patrón está vencido el sistema debería advertir o bloquear la aprobación del certificado.
      </div>
    </Card>
  );
}

function ClientPortalPanel({
  certificates,
  currentUser,
  onOpenCertificate,
  onSectionChange
}: {
  certificates: Certificate[];
  currentUser: User;
  onOpenCertificate: (certificate: Certificate) => void;
  onSectionChange: (section: Section) => void;
}) {
  const stats = buildStats(certificates);
  const client = currentUser.clientId ? clients.find((item) => item.id === currentUser.clientId) : undefined;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-soft md:p-8">
        <div className="grid gap-6 md:grid-cols-[1fr_0.7fr] md:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Portal cliente</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">{client?.name ?? "Cliente"}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
              Panel para auditorías: certificados vigentes, vencidos, próximos vencimientos y legajo por equipo.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MiniMetric label="Vigentes" value={stats.vigentes} dark />
            <MiniMetric label="Vencidos" value={stats.vencidos} dark />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total" value={stats.total} helper="Certificados disponibles" />
        <StatCard title="Vigentes" value={stats.vigentes} helper="Listos para auditoría" tone="green" />
        <StatCard title="Por vencer" value={stats.porVencer} helper="Coordinar renovación" tone="amber" />
        <StatCard title="Vencidos" value={stats.vencidos} helper="Riesgo documental" tone="red" />
      </section>

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-black">Mis certificados</h3>
            <p className="text-sm text-slate-500">Consulta rápida de estado y validación.</p>
          </div>
          <button type="button" onClick={() => onSectionChange("equipos")} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold hover:bg-slate-50">
            Ver legajos de equipos
          </button>
        </div>
        <CertificateTable certificates={certificates} onOpenCertificate={onOpenCertificate} />
      </Card>
    </div>
  );
}

function ValidationPanel({ certificates, onOpenCertificate }: { certificates: Certificate[]; onOpenCertificate: (certificate: Certificate) => void }) {
  const approved = certificates.filter((certificate) => certificate.status === "APROBADO");
  const first = approved[0] ?? certificates[0];

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-xl font-black">Validación pública por QR</h2>
        <p className="mt-1 text-sm text-slate-500">El QR del PDF o del sticker físico debe llevar a una página pública que diga si el certificado es real, vigente o vencido.</p>

        {first ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.2fr]">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <FakeQr />
              <p className="mt-4 text-center text-sm font-bold">{first.certificateNumber}</p>
              <p className="text-center text-xs text-slate-500">{first.qrUrl}</p>
              <div className="mt-4 flex justify-center gap-2">
                <Link href={first.qrUrl} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">Abrir validación</Link>
                <button type="button" onClick={() => onOpenCertificate(first)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">Ver certificado</button>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-black">Qué debería mostrar al escanear</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <InfoBox label="Certificado" value={first.certificateNumber} />
                <InfoBox label="Estado" value={statusLabel(getVisibleStatus(first))} />
                <InfoBox label="Cliente" value={getClientName(first.clientId)} />
                <InfoBox label="Equipo" value={first.element} />
                <InfoBox label="Serie" value={first.serialNumber} />
                <InfoBox label="Vencimiento" value={formatDate(first.expirationDate)} />
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
                Esta vista no reemplaza el PDF: sirve para comprobar que el certificado no fue alterado y que el estado mostrado por la base de datos sigue siendo válido.
              </div>
            </div>
          </div>
        ) : (
          <EmptyState title="No hay certificados" text="Cuando existan certificados aprobados, se podrá ver una validación pública." />
        )}
      </Card>
    </div>
  );
}

function ReportsPanel({ certificates }: { certificates: Certificate[] }) {
  const byClient = clients.map((client) => ({ client, count: certificates.filter((certificate) => certificate.clientId === client.id).length }));
  const max = Math.max(...byClient.map((item) => item.count), 1);
  const stats = buildStats(certificates);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard title="Emitidos" value={stats.vigentes} helper="Aprobados vigentes" tone="green" />
        <StatCard title="Pendientes" value={stats.pendientes} helper="En revisión" tone="amber" />
        <StatCard title="Vencidos" value={stats.vencidos} helper="Para renovar" tone="red" />
        <StatCard title="Borradores" value={stats.borradores} helper="Sin enviar" />
      </section>

      <Card>
        <h2 className="text-xl font-black">Certificados por cliente</h2>
        <div className="mt-6 space-y-4">
          {byClient.map(({ client, count }) => (
            <div key={client.id}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold">{client.name}</span>
                <span className="text-slate-500">{count}</span>
              </div>
              <div className="mt-2 h-3 rounded-full bg-slate-100">
                <div className="h-3 rounded-full bg-slate-950" style={{ width: `${(count / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function CertificateDetailModal({
  certificate,
  role,
  onClose,
  onApprove,
  onReject,
  onAnnul,
  onSubmit
}: {
  certificate: Certificate;
  role: Role;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onAnnul: (id: string) => void;
  onSubmit: (id: string) => void;
}) {
  const [rejectReason, setRejectReason] = useState("");
  const canApprove = (role === "admin" || role === "aprobador") && certificate.status === "PENDIENTE_APROBACION";
  const canSubmit = (role === "admin" || role === "certificador") && certificate.status === "BORRADOR";
  const canAnnul = role === "admin" && certificate.status !== "ANULADO";
  const patterns = patternInstruments.filter((pattern) => certificate.patternIds.includes(pattern.id));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="no-print mx-auto my-6 max-w-6xl rounded-[2rem] bg-white p-5 shadow-soft md:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black">{certificate.certificateNumber}</h2>
              <StatusPill status={getVisibleStatus(certificate)} />
              <PaymentPill status={certificate.paymentStatus} />
            </div>
            <p className="mt-1 text-sm text-slate-500">{getClientName(certificate.clientId)} · {certificate.element} · Serie {certificate.serialNumber}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {certificate.status === "APROBADO" && (
              <Link href={certificate.qrUrl} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200">Abrir QR</Link>
            )}
            <button type="button" onClick={() => window.print()} className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">Imprimir vista</button>
            <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold hover:bg-slate-50">Cerrar</button>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <InfoBox label="Fecha calibración" value={formatDate(certificate.calibrationDate)} />
              <InfoBox label="Vencimiento" value={formatDate(certificate.expirationDate)} />
              <InfoBox label="Creado por" value={getUserName(certificate.createdBy)} />
              <InfoBox label="Aprobado por" value={getUserName(certificate.approvedBy)} />
            </div>

            <div className="rounded-3xl border border-slate-200 p-5">
              <h3 className="font-black">Acciones</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {canSubmit && <button type="button" onClick={() => onSubmit(certificate.id)} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">Enviar a aprobación</button>}
                {canApprove && <button type="button" onClick={() => onApprove(certificate.id)} className="rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white">Aprobar</button>}
                {canAnnul && <button type="button" onClick={() => onAnnul(certificate.id)} className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white">Anular</button>}
              </div>
              {canApprove && (
                <div className="mt-4">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Motivo de rechazo</label>
                  <textarea
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    className="mt-2 h-24 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none ring-slate-950/10 focus:ring-4"
                    placeholder="Detalle para que el trabajador corrija el certificado..."
                  />
                  <button type="button" onClick={() => onReject(certificate.id, rejectReason)} className="mt-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700">Rechazar con motivo</button>
                </div>
              )}
              {certificate.rejectionReason && (
                <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                  <strong>Motivo de rechazo:</strong> {certificate.rejectionReason}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 p-5">
              <h3 className="font-black">Auditoría</h3>
              <div className="mt-4 space-y-3">
                {certificate.auditLog.map((log) => (
                  <div key={log.id} className="rounded-2xl bg-slate-50 p-4 text-sm">
                    <p className="font-bold">{log.action}</p>
                    <p className="text-slate-500">{log.userName} · {log.date}</p>
                    {log.notes && <p className="mt-1 text-slate-600">{log.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 p-5">
              <h3 className="font-black">Datos técnicos</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <InfoLine label="Elemento" value={certificate.element} />
                <InfoLine label="Tipo / Modelo" value={certificate.typeModel} />
                <InfoLine label="Marca" value={certificate.brand} />
                <InfoLine label="Serie" value={certificate.serialNumber} />
                <InfoLine label="Rango" value={`${certificate.rangeValue} ${certificate.unit}`} />
                <InfoLine label="Size" value={certificate.size} />
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                <strong>Método aplicado:</strong> {certificate.referenceMethod}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 p-5">
              <h3 className="font-black">Pruebas</h3>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="p-3">Prueba</th>
                      <th className="p-3">Rango</th>
                      <th className="p-3">Criterio</th>
                      <th className="p-3">Resultado</th>
                      <th className="p-3">Obs.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certificate.pressureTests.map((test) => (
                      <tr key={test.id} className="border-t border-slate-100">
                        <td className="p-3 font-bold">{test.testName}</td>
                        <td className="p-3">{test.pressureValue ?? "-"} {test.unit}</td>
                        <td className="p-3">{test.acceptanceCriteria || "-"}</td>
                        <td className="p-3">{test.result || "-"}</td>
                        <td className="p-3">{test.observations || "-"}</td>
                      </tr>
                    ))}
                    {certificate.pressureTests.length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-slate-500">Sin pruebas cargadas.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 p-5">
              <h3 className="font-black">Patrones aplicados</h3>
              <div className="mt-4 grid gap-3">
                {patterns.map((pattern) => (
                  <div key={pattern.id} className="rounded-2xl bg-slate-50 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-black">{pattern.name}</p>
                      <PatternPill status={pattern.status} />
                    </div>
                    <p className="mt-1 text-slate-500">Serie {pattern.serialNumber} · {pattern.certificateRef} · {pattern.rangeValue}</p>
                    <p className="text-slate-500">Recalibración: {formatDate(pattern.recalibrationDate)}</p>
                  </div>
                ))}
                {patterns.length === 0 && <p className="text-sm text-slate-500">Sin patrones asociados.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CertificatePrintPreview certificate={certificate} patterns={patterns} />
    </div>
  );
}

function CertificatePrintPreview({ certificate, patterns }: { certificate: Certificate; patterns: PatternInstrument[] }) {
  const client = clients.find((item) => item.id === certificate.clientId);

  return (
    <div className="print-area mx-auto mb-10 hidden max-w-5xl bg-white p-0 text-slate-950">
      <div className="print-page mb-8 bg-white p-5 shadow-soft">
        <CertificateHeader certificate={certificate} />
        <table className="mt-6 w-full border-collapse text-xs">
          <tbody>
            <PrintRow label="CLIENTE" value={client?.name ?? ""} label2="EQUIPO" value2="" />
            <PrintRow label="CUIT" value={client?.cuit ?? ""} label2="ORDEN DE COMPRA" value2={certificate.purchaseOrder || ""} />
          </tbody>
        </table>
        <table className="mt-6 w-full border-collapse text-xs">
          <tbody>
            <PrintRow label="FECHA CALIBRACIÓN" value={formatDate(certificate.calibrationDate)} label2="VENCIMIENTO CALIBRACIÓN" value2={formatDate(certificate.expirationDate)} dark />
            <PrintRow label="ELEMENTO" value={certificate.element} label2="SERIE" value2={certificate.serialNumber} />
            <PrintRow label="TIPO / MODELO" value={certificate.typeModel} label2="MARCA" value2={certificate.brand} />
            <PrintRow label="RANGO" value={`${certificate.rangeValue} ${certificate.unit}`} label2="SIZE" value2={certificate.size} />
          </tbody>
        </table>
        <h3 className="mt-8 text-center text-xs font-black uppercase">Resultados de las pruebas realizadas</h3>
        <table className="mt-5 w-full border-collapse text-xs">
          <tbody>
            <PrintFullRow label="TIPO DE PRUEBA" value={certificate.testType} />
            <PrintFullRow label="MÉTODO DE REFERENCIA Y PROTOCOLO APLICADO" value={certificate.referenceMethod} tall />
            <PrintFullRow label="CONDICIONES AMBIENTALES" value={certificate.environmentalConditions} />
            <PrintFullRow label="UNIDAD DE MEDIDA UTILIZADA" value={certificate.measurementUnit} />
            <PrintFullRow label="OBSERVACIONES" value={certificate.observations} />
          </tbody>
        </table>
        <div className="mt-6 flex border border-slate-950 text-xs">
          <div className="w-40 border-r border-slate-950 bg-slate-200 p-3 font-black">CONCLUSIONES:</div>
          <div className="flex-1 p-3 text-center font-semibold uppercase">{certificate.conclusions}</div>
        </div>
        <h3 className="mt-8 text-center text-xs font-black uppercase">Datos equipos patrón aplicado</h3>
        <table className="mt-4 w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-slate-200">
              <PrintTh>BALANZA / PATRÓN</PrintTh>
              <PrintTh>CERTIFICADO</PrintTh>
              <PrintTh>RANGO</PrintTh>
              <PrintTh>FECHA CALIBRACIÓN</PrintTh>
              <PrintTh>FECHA RECALIBRACIÓN</PrintTh>
            </tr>
          </thead>
          <tbody>
            {patterns.map((pattern) => (
              <tr key={pattern.id}>
                <PrintTd>{pattern.name} Serie {pattern.serialNumber}</PrintTd>
                <PrintTd>{pattern.certificateRef}</PrintTd>
                <PrintTd>{pattern.rangeValue}</PrintTd>
                <PrintTd>{formatDate(pattern.calibrationDate)}</PrintTd>
                <PrintTd>{formatDate(pattern.recalibrationDate)}</PrintTd>
              </tr>
            ))}
          </tbody>
        </table>
        <SignatureBlocks certificate={certificate} />
        <div className="mt-8 border border-slate-950">
          <div className="bg-slate-200 p-2 text-[10px] font-black">OBSERVACIÓN</div>
          <div className="h-12 p-2 text-xs">{certificate.finalComments}</div>
        </div>
        <FooterText />
      </div>

      <div className="print-page bg-white p-5 shadow-soft">
        <CertificateHeader certificate={certificate} />
        <div className="mt-5 border border-slate-950 bg-slate-200 p-2 text-center text-xs font-black">REGISTRO DE ENSAYO</div>
        <table className="mt-4 w-full border-collapse text-xs">
          <tbody>
            <PrintRow label="ELEMENTO" value={certificate.element} label2="SERIE" value2={certificate.serialNumber} />
            <PrintRow label="RESULTADO DEL ENSAYO" value={certificate.trialResult} label2="APROBADO" value2={certificate.approvedResult ? "SI" : "NO"} />
            <PrintRow label="FRECUENCIA DEL ENSAYO" value={certificate.trialFrequency} label2="VENCIMIENTO" value2={formatDate(certificate.expirationDate)} dark />
          </tbody>
        </table>
        <table className="mt-5 w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-200">
              <PrintTh>PRESIÓN</PrintTh>
              <PrintTh>RANGO / UNIDAD</PrintTh>
              <PrintTh>CRITERIO DE ACEPTACIÓN</PrintTh>
              <PrintTh>RESULTADO</PrintTh>
              <PrintTh>OBSERVACIONES</PrintTh>
            </tr>
          </thead>
          <tbody>
            {certificate.pressureTests.map((test) => (
              <tr key={test.id}>
                <PrintTd>{test.testName}</PrintTd>
                <PrintTd>{test.pressureValue ?? ""} {test.unit}</PrintTd>
                <PrintTd>{test.acceptanceCriteria}</PrintTd>
                <PrintTd>{test.result}</PrintTd>
                <PrintTd>{test.observations}</PrintTd>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-6 border border-slate-950">
          <div className="bg-slate-200 p-2 text-center text-xs font-black">COMENTARIOS FINALES</div>
          <div className="h-16 p-2 text-xs">{certificate.finalComments}</div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-10">
          <div className="border border-slate-950">
            <div className="bg-slate-200 p-2 text-center text-xs font-black">GRÁFICO DE PRUEBA PRESIÓN VS TIEMPO</div>
            <PressureChart certificate={certificate} />
          </div>
          <div className="border border-slate-950 p-4">
            <p className="text-center text-xs font-black">Valida que el certificado no esté corrompido</p>
            <div className="mt-3 grid grid-cols-[1fr_110px] gap-3 text-[10px]">
              <p>
                El estado de este certificado es válido solo si la verificación es exitosa en la plataforma indicada. Cualquier modificación fuera del sistema autorizado será invalidada.
              </p>
              <FakeQr small />
            </div>
            <p className="mt-2 text-center text-[9px] text-blue-700">{certificate.qrUrl}</p>
          </div>
        </div>
        <SignatureBlocks certificate={certificate} />
        <FooterText />
      </div>
    </div>
  );
}

function CreateCertificateModal({
  currentUser,
  onClose,
  onCreate
}: {
  currentUser: User;
  onClose: () => void;
  onCreate: (input: CertificateFormInput, targetStatus: CertificateStatus) => void;
}) {
  const firstEquipment = equipment[0];
  const [input, setInput] = useState<CertificateFormInput>({
    certificateNumber: `SIP 26-${String(Math.floor(Math.random() * 90) + 100).slice(1)}`,
    clientId: firstEquipment.clientId,
    equipmentId: firstEquipment.id,
    calibrationDate: new Date().toISOString().slice(0, 10),
    expirationDate: addMonths(new Date(), 12),
    element: firstEquipment.name,
    typeModel: firstEquipment.typeModel,
    brand: firstEquipment.brand,
    serialNumber: firstEquipment.serialNumber,
    rangeValue: "185",
    unit: "PSI",
    size: "",
    referenceMethod: "Se aplica el método de ensayo según protocolo interno y se registran los resultados obtenidos.",
    observations: "SIN",
    finalComments: ""
  });

  function update<K extends keyof CertificateFormInput>(key: K, value: CertificateFormInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  function handleEquipmentChange(id: string) {
    const selected = equipment.find((item) => item.id === id);
    if (!selected) return;
    setInput((prev) => ({
      ...prev,
      equipmentId: selected.id,
      clientId: selected.clientId,
      element: selected.name,
      typeModel: selected.typeModel,
      brand: selected.brand,
      serialNumber: selected.serialNumber
    }));
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="mx-auto my-6 max-w-4xl rounded-[2rem] bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h2 className="text-2xl font-black">Nuevo certificado</h2>
            <p className="mt-1 text-sm text-slate-500">Carga inicial hardcodeada. Usuario: {currentUser.name}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold hover:bg-slate-50">Cerrar</button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <FormInput label="Número de certificado" value={input.certificateNumber} onChange={(value) => update("certificateNumber", value)} />
          <FormSelect label="Equipo / legajo" value={input.equipmentId} onChange={handleEquipmentChange} options={equipment.map((item) => ({ value: item.id, label: `${item.name} · Serie ${item.serialNumber} · ${getClientName(item.clientId)}` }))} />
          <FormInput label="Cliente" value={getClientName(input.clientId)} onChange={() => null} disabled />
          <FormInput label="Serie" value={input.serialNumber} onChange={(value) => update("serialNumber", value)} />
          <FormInput label="Elemento" value={input.element} onChange={(value) => update("element", value)} />
          <FormInput label="Tipo / modelo" value={input.typeModel} onChange={(value) => update("typeModel", value)} />
          <FormInput label="Marca" value={input.brand} onChange={(value) => update("brand", value)} />
          <FormInput label="Rango" value={input.rangeValue} onChange={(value) => update("rangeValue", value)} />
          <FormInput label="Unidad" value={input.unit} onChange={(value) => update("unit", value)} />
          <FormInput label="Size" value={input.size} onChange={(value) => update("size", value)} />
          <FormInput label="Fecha calibración" type="date" value={input.calibrationDate} onChange={(value) => update("calibrationDate", value)} />
          <FormInput label="Fecha vencimiento" type="date" value={input.expirationDate} onChange={(value) => update("expirationDate", value)} />
          <FormTextarea label="Método / protocolo aplicado" value={input.referenceMethod} onChange={(value) => update("referenceMethod", value)} />
          <FormTextarea label="Observaciones" value={input.observations} onChange={(value) => update("observations", value)} />
          <FormTextarea label="Comentarios finales" value={input.finalComments} onChange={(value) => update("finalComments", value)} full />
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
          <button type="button" onClick={() => onCreate(input, "BORRADOR")} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold hover:bg-slate-50">Guardar borrador</button>
          <button type="button" onClick={() => onCreate(input, "PENDIENTE_APROBACION")} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Crear y enviar a aprobación</button>
        </div>
      </div>
    </div>
  );
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next.toISOString().slice(0, 10);
}

function Card({ children }: { children: ReactNode }) {
  return <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">{children}</section>;
}

function StatCard({ title, value, helper, tone = "slate" }: { title: string; value: number; helper: string; tone?: "slate" | "green" | "amber" | "red" }) {
  const toneClasses = {
    slate: "bg-slate-950 text-white",
    green: "bg-green-700 text-white",
    amber: "bg-amber-400 text-slate-950",
    red: "bg-red-700 text-white"
  }[tone];

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`inline-flex rounded-2xl px-3 py-1 text-xs font-black ${toneClasses}`}>{title}</div>
      <div className="mt-4 text-4xl font-black tracking-tight">{value}</div>
      <p className="mt-1 text-sm text-slate-500">{helper}</p>
    </div>
  );
}

function MiniMetric({ label, value, dark, compact }: { label: string; value: number; dark?: boolean; compact?: boolean }) {
  const paddingClass = compact ? "p-3" : "p-4";
  return (
    <div className={`${dark ? "bg-white/10 text-white" : "bg-slate-50 text-slate-950"} ${paddingClass} rounded-2xl`}>
      <p className={`${dark ? "text-slate-300" : "text-slate-500"} text-xs font-bold uppercase tracking-wide`}>{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function ValueItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="font-black">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      <p className="text-lg font-black">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{text}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-950">{value || "-"}</p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
      <span className="text-sm font-bold text-slate-500">{label}</span>
      <span className="text-right text-sm font-bold text-slate-950">{value || "-"}</span>
    </div>
  );
}

function StatusPill({ status }: { status: VisibleCertificateStatus }) {
  const classes: Record<VisibleCertificateStatus, string> = {
    APROBADO: "bg-green-100 text-green-800 ring-green-200",
    POR_VENCER: "bg-amber-100 text-amber-800 ring-amber-200",
    VENCIDO: "bg-red-100 text-red-800 ring-red-200",
    PENDIENTE_APROBACION: "bg-yellow-100 text-yellow-800 ring-yellow-200",
    BORRADOR: "bg-slate-100 text-slate-700 ring-slate-200",
    RECHAZADO: "bg-red-100 text-red-800 ring-red-200",
    ANULADO: "bg-zinc-200 text-zinc-700 ring-zinc-300"
  };

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${classes[status]}`}>{statusLabel(status)}</span>;
}

function PaymentPill({ status }: { status: Certificate["paymentStatus"] }) {
  const classes = status === "PAGADO" ? "bg-green-100 text-green-800" : status === "PENDIENTE" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${classes}`}>{moneyStatusLabel(status)}</span>;
}

function PatternPill({ status }: { status: PatternInstrument["status"] }) {
  const classes = status === "VIGENTE" ? "bg-green-100 text-green-800" : status === "POR_VENCER" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${classes}`}>{status.replace("_", " ")}</span>;
}

function CriticalityPill({ value }: { value: Equipment["criticality"] }) {
  const classes = value === "Alta" ? "bg-red-100 text-red-800" : value === "Media" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800";
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${classes}`}>{value}</span>;
}

function FormInput({ label, value, onChange, type = "text", disabled }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type={type}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-slate-950/10 focus:ring-4 disabled:bg-slate-100 disabled:text-slate-500"
      />
    </label>
  );
}

function FormSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-slate-950/10 focus:ring-4">
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function FormTextarea({ label, value, onChange, full }: { label: string; value: string; onChange: (value: string) => void; full?: boolean }) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-slate-950/10 focus:ring-4"
      />
    </label>
  );
}

function CertificateHeader({ certificate }: { certificate: Certificate }) {
  return (
    <div className="grid grid-cols-[1.1fr_1.3fr_1fr] border border-slate-950 text-xs">
      <div className="flex items-center gap-3 border-r border-slate-950 p-4">
        <div className="text-4xl font-black italic text-red-600">SIP</div>
        <div className="text-[10px] leading-tight">
          <p className="font-black">Servicios Industriales Petroleros</p>
          <p>Mailen N° 986 · Rincón de los Sauces</p>
        </div>
      </div>
      <div className="grid place-items-center border-r border-slate-950 p-4 text-center text-lg font-black">CERTIFICADO DE CALIBRACIÓN</div>
      <div>
        <div className="grid grid-cols-2 border-b border-slate-950"><div className="border-r border-slate-950 p-1 text-center font-bold">Código:</div><div className="p-1 text-center">{certificate.code}</div></div>
        <div className="grid grid-cols-2 border-b border-slate-950"><div className="border-r border-slate-950 p-1 text-center font-bold">Vigencia:</div><div className="p-1 text-center">{formatDate(certificate.validity)}</div></div>
        <div className="grid grid-cols-2 border-b border-slate-950"><div className="border-r border-slate-950 p-1 text-center font-bold">Rev:</div><div className="p-1 text-center">{certificate.revision}</div></div>
        <div className="border-b border-slate-950 p-1 text-center text-[10px] font-black">CERTIFICADO NÚMERO</div>
        <div className="bg-slate-200 p-3 text-center text-lg font-black">{certificate.certificateNumber}</div>
      </div>
    </div>
  );
}

function PrintRow({ label, value, label2, value2, dark }: { label: string; value: string; label2: string; value2: string; dark?: boolean }) {
  return (
    <tr>
      <td className="w-36 border border-slate-950 bg-slate-200 p-2 text-center font-black">{label}</td>
      <td className={`border border-slate-950 p-2 text-center font-bold ${dark ? "bg-slate-950 text-white" : ""}`}>{value}</td>
      <td className="w-44 border border-slate-950 bg-slate-200 p-2 text-center font-black">{label2}</td>
      <td className={`w-44 border border-slate-950 p-2 text-center font-bold ${dark ? "bg-slate-950 text-white" : ""}`}>{value2}</td>
    </tr>
  );
}

function PrintFullRow({ label, value, tall }: { label: string; value: string; tall?: boolean }) {
  return (
    <tr>
      <td className="w-64 border border-slate-950 bg-slate-200 p-2 text-center font-black">{label}</td>
      <td className={`border border-slate-950 p-2 ${tall ? "h-16" : ""}`}>{value}</td>
    </tr>
  );
}

function PrintTh({ children }: { children: ReactNode }) {
  return <th className="border border-slate-950 p-2 text-center font-black">{children}</th>;
}

function PrintTd({ children }: { children: ReactNode }) {
  return <td className="border border-slate-950 p-2 text-center">{children}</td>;
}

function SignatureBlocks({ certificate }: { certificate: Certificate }) {
  return (
    <div className="mt-10">
      <div className="border border-slate-950 bg-slate-200 p-1 text-center text-xs font-black">RESPONSABLE DEL ENSAYO</div>
      <div className="mt-5 grid grid-cols-2 gap-16 px-14">
        <div className="h-32 border border-slate-950 text-center text-xs">
          <div className="bg-slate-200 p-2 font-black">SIP INSTRUMENTACIÓN</div>
          <div className="grid h-24 place-items-center text-slate-500">
            <div>
              <p className="font-black">CERTIFICADO N°</p>
              <p>{certificate.certificateNumber}</p>
              <p className="mt-2 font-semibold">{getUserName(certificate.createdBy)}</p>
            </div>
          </div>
        </div>
        <div className="h-32 border border-slate-950 text-center text-xs">
          <div className="bg-slate-200 p-2 font-black">SELLO</div>
          <div className="grid h-24 place-items-center text-red-400">
            <div className="rounded-full border-4 border-red-300 px-8 py-5 font-black">SIP<br />{certificate.certificateNumber}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FooterText() {
  return <p className="mt-6 text-center text-[10px]">Mailen N° 986, Zona Chacra, Rincón de los Sauces, Neuquén. Cel: 2995292190 · sipinstrumentacion@gmail.com</p>;
}

function FakeQr({ small }: { small?: boolean }) {
  const cells = [
    1, 1, 1, 0, 1, 0, 1, 1,
    1, 0, 0, 0, 1, 1, 0, 1,
    1, 0, 1, 0, 0, 1, 0, 1,
    0, 0, 1, 1, 1, 0, 1, 0,
    1, 1, 0, 1, 0, 1, 1, 1,
    0, 1, 1, 0, 1, 0, 0, 1,
    1, 0, 0, 1, 1, 1, 0, 0,
    1, 1, 1, 0, 0, 1, 1, 1
  ];
  return (
    <div className={`mx-auto grid ${small ? "h-24 w-24" : "h-44 w-44"} grid-cols-8 gap-1 rounded-2xl bg-white p-3 shadow-inner ring-1 ring-slate-200`}>
      {cells.map((cell, index) => <div key={index} className={`${cell ? "bg-slate-950" : "bg-white"} rounded-[2px]`} />)}
    </div>
  );
}

function PressureChart({ certificate }: { certificate: Certificate }) {
  const values = certificate.pressureTests.map((test) => test.pressureValue ?? 0).filter(Boolean);
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => {
    const x = 30 + index * (240 / Math.max(values.length - 1, 1));
    const y = 150 - (value / max) * 120;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 320 180" className="h-48 w-full bg-white p-4">
      <line x1="30" y1="150" x2="290" y2="150" stroke="currentColor" strokeWidth="1" />
      <line x1="30" y1="20" x2="30" y2="150" stroke="currentColor" strokeWidth="1" />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" />
      {points.split(" ").filter(Boolean).map((point, index) => {
        const [x, y] = point.split(",");
        return <circle key={index} cx={x} cy={y} r="4" fill="currentColor" />;
      })}
      <text x="145" y="172" fontSize="10">Tiempo</text>
      <text x="4" y="18" fontSize="10">Presión</text>
    </svg>
  );
}
