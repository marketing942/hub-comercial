import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (s?.role !== "admin") return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  const body = await req.json();
  const patch: Record<string, any> = {};
  if (typeof body.bu === "string" && ["cppem", "unicive", "colegio_cppem"].includes(body.bu)) {
    patch.bu = body.bu;
  }
  if (Array.isArray(body.bus)) {
    const clean = body.bus.filter(
      (x: any) => x === "cppem" || x === "unicive" || x === "colegio_cppem"
    );
    if (clean.length > 0) {
      patch.bus = Array.from(new Set(clean));
      // BU primaria = a atual do vendedor se ainda estiver no conjunto,
      // senao a primeira do array. Evita perder o "principal" quando
      // o admin so adiciona uma nova BU.
      if (typeof body.primary_bu === "string" && patch.bus.includes(body.primary_bu)) {
        patch.bu = body.primary_bu;
      } else if (typeof body.bu === "string" && patch.bus.includes(body.bu)) {
        patch.bu = body.bu;
      } else {
        patch.bu = patch.bus[0];
      }
    }
  }
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.avatar_color === "string") patch.avatar_color = body.avatar_color;
  const { error } = await supabaseAdmin.from("sellers").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/admin/sellers");
  return NextResponse.json({ ok: true });
}

// Sem DELETE (26/11/2026): o vendedor vem do Conta Azul; para tirar, mude o destino ou inative.
