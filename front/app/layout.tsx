import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/src/context/AuthContext";

export const metadata: Metadata = {
  title: "SIP Instrumentación | Certificados",
  icons: {
    icon: "/sip-logo.png",
    shortcut: "/sip-logo.png",
    apple: "/sip-logo.png",
  },
  description: "Sistema de certificados digitales con aprobación y validación pública.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
