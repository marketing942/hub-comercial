import ConfiguracoesSubnav from "@/components/ConfiguracoesSubnav";
import { ANO_LETIVO } from "@/lib/colegioMatriculas";
import ColegioClient from "./colegio-client";

export const dynamic = "force-dynamic";

export default function ColegioPage() {
  return (
    <div className="space-y-4">
      <ConfiguracoesSubnav />
      <div>
        <h1 className="text-2xl font-bold">Matriculas {ANO_LETIVO} — Colegio</h1>
        <p className="text-sm text-white/50">
          Informe sempre o total ate o momento, por serie. O que voce salvar aqui aparece no painel do Colegio.
        </p>
      </div>
      <ColegioClient />
    </div>
  );
}
