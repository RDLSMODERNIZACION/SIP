"use client";

import { Button } from "./Button";

export function Modal({
  open,
  title,
  children,
  onClose,
  wide = false,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className={`max-h-[92vh] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ${wide ? "max-w-6xl" : "max-w-2xl"}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="font-bold text-slate-950">{title}</h3>
          <Button variant="ghost" onClick={onClose} className="px-3 py-1.5">Cerrar</Button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
