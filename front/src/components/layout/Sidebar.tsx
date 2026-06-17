"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/src/context/AuthContext";

const items = [
  { href: "/", label: "Panel", roles: ["admin", "certificador", "aprobador", "cliente"] },
  { href: "/certificados", label: "Certificados", roles: ["admin", "certificador", "aprobador", "cliente"] },
  { href: "/clientes", label: "Clientes", roles: ["admin", "certificador", "aprobador"] },
  { href: "/equipos", label: "Equipos", roles: ["admin", "certificador", "aprobador", "cliente"] },
  { href: "/patrones", label: "Patrones", roles: ["admin", "certificador", "aprobador"] },
  { href: "/usuarios", label: "Usuarios", roles: ["admin"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-slate-200 bg-slate-950 text-white lg:block">
      <div className="flex h-full flex-col">
        <div className="border-b border-white/10 p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">SIP</div>
          <div className="mt-2 text-xl font-bold">Certificados</div>
          <p className="mt-2 text-sm leading-5 text-slate-400">Gestión digital, aprobación y trazabilidad técnica.</p>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {items
            .filter((item) => user && item.roles.includes(user.role_code))
            .map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    active ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
        </nav>
        <div className="border-t border-white/10 p-4 text-xs text-slate-500">Backend: conectado a API Render</div>
      </div>
    </aside>
  );
}
