import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary: "bg-slate-900 text-white hover:bg-slate-800 border-slate-900",
  secondary: "bg-white text-slate-800 hover:bg-slate-50 border-slate-200",
  danger: "bg-red-700 text-white hover:bg-red-800 border-red-700",
  success: "bg-emerald-700 text-white hover:bg-emerald-800 border-emerald-700",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100 border-transparent",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
    />
  );
}
