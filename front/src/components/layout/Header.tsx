"use client";

import { useAuth } from "@/src/context/AuthContext";
import { Button } from "@/src/components/ui/Button";

export function Header({ title, description }: { title: string; description?: string }) {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur md:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-950">{title}</h1>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right md:block">
            <div className="text-sm font-semibold text-slate-900">{user?.full_name}</div>
            <div className="text-xs text-slate-500">{user?.role_name}</div>
          </div>
          <Button variant="secondary" onClick={logout}>Salir</Button>
        </div>
      </div>
    </header>
  );
}
