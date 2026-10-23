import "./globals.css";
import type { Metadata } from "next";
import { Inter, Oxanium, Rajdhani } from "next/font/google";
import { Crosshair } from "@/components/crosshair";

const inter = Inter({ variable: "--font-body", subsets: ["latin"] });
const oxanium = Oxanium({ variable: "--font-display", subsets: ["latin"] });
const rajdhani = Rajdhani({ variable: "--font-ui", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Hub Comercial",
  description: "Hub temporario do comercial - metas, resultados e gamificacao.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${oxanium.variable} ${rajdhani.variable}`}>
      <body>
        {children}
        <Crosshair />
      </body>
    </html>
  );
}
