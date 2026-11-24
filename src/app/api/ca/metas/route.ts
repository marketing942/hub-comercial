import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth";
import { montarMetasLinha } from "@/lib/ca/metasLinha";
import { supabaseAdmin } from "@/lib/supabase";
import { ALL_BUS, type BU } from "@/lib/products";

export const dynamic = "force-dynamic";

function parametros(sp: URLSearchParams) {
  const bu = sp.get("bu") as BU;
  const year = Number(sp.get("year"));
  const month = Number(sp.get("month"));
  if (!ALL_BUS.includes(bu) || !Number.isInteger(year) || year < 2024 || year > 2100 || !(month >= 1 && month <= 12)) return null;
  return { bu, year, month };
}

/** GET /api/ca/metas?bu=&year=&month= -> categorias do Conta Azul da BU com realizado e metas. So admin. */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "Apenas admin." }, { status: 403 });
  const p = parametros(req.nextUrl.searchParams);
  if (!p) return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });
  return NextResponse.json(await montarMetasLinha(p.bu, p.year, p.month), { headers: { "Cache-Control": "no-store" } });
}

/** POST { bu, year, month, metas: [{categoria_id, valor_meta, quantidade_meta}] } — grava as linhas da BU/mes. */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "Apenas admin." }, { status: 403 });
  const b = (await req.json().catch(() => null)) as {
    bu?: string;
    year?: number;
    month?: number;
    metas?: { categoria_id: string; valor_meta: number; quantidade_meta: number }[];
  } | null;
  const sp = new URLSearchParams({ bu: String(b?.bu ?? ""), year: String(b?.year ?? ""), month: String(b?.month ?? "") });
  const p = parametros(sp);
  if (!p || !Array.isArray(b?.metas)) return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });

  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const linhas = b!.metas!
    .filter((m) => typeof m.categoria_id === "string" && m.categoria_id)
    .map((m) => ({
      bu: p.bu,
      year: p.year,
      month: p.month,
      categoria_id: m.categoria_id,
      valor_meta: Math.round(num(m.valor_meta) * 100) / 100,
      quantidade_meta: Math.round(num(m.quantidade_meta)),
      updated_at: new Date().toISOString(),
    }));
  if (linhas.length === 0) return NextResponse.json({ ok: true, gravadas: 0 });

  const { error } = await supabaseAdmin.from("ca_metas_linha").upsert(linhas, { onConflict: "bu,year,month,categoria_id" });
  if (error) {
    const faltaTabela = /ca_metas_linha|schema cache|does not exist/i.test(error.message);
    return NextResponse.json(
      { error: faltaTabela ? "A tabela ca_metas_linha ainda nao existe: rode supabase/ca-04-metas-linha.sql." : error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, gravadas: linhas.length });
}
