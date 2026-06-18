import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ProvexEvaluate - Panel de Decisión del CFO",
  description: "Plataforma empresarial para evaluar rentabilidad, riesgo contractual y flujo de caja para decidir la firma de contratos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`px-theme px-topline ${inter.className}`}>
        {children}
      </body>
    </html>
  );
}
