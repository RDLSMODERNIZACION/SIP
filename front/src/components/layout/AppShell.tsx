"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/src/context/AuthContext";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AppShell({ children, title, description }: { children: React.ReactNode; title: string; description?: string }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && pathname !== "/login") router.replace("/login");
  }, [loading, user, pathname, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-soft">
          <div className="text-sm font-semibold text-slate-700">Cargando sistema...</div>
        </div>
      </main>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <Sidebar />
      <div className="lg:pl-72">
        <Header title={title} description={description} />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
