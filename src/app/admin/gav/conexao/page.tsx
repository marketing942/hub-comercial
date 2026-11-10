import ConexaoClient from "@/components/gav/ConexaoClient";
import { ultimoSync } from "@/lib/ca/sync";

export const dynamic = "force-dynamic";

export default async function ConexaoPage() {
  // A porta de admin esta no layout de /admin/gav.
  const ultimo = await ultimoSync().catch(() => null);
  return (
    <ConexaoClient
      configurada={!!process.env.JARVIS_PONTE_SECRET}
      ultimo={ultimo as { concluido_em?: string | null; erro?: string | null; lidos?: number | null } | null}
    />
  );
}
