"use client";

/**
 * A tela de classificação: categoria/item → linha de receita, e vendedor do
 * Conta Azul → vendedor do Hub.
 *
 * ## Pendente primeiro, e com o valor ao lado
 *
 * Pendência é dinheiro invisível: enquanto a linha não está classificada, ela
 * não vira faturamento em lugar nenhum. A lista ordena por não-classificado e,
 * dentro disso, por quanto movimenta — classificar na ordem da tela é
 * classificar na ordem do impacto.
 *
 * ## A sugestão é sugestão
 *
 * Em item sem classificação, mostramos a categoria dominante que o MESMO item
 * teve em outras vendas, com o número de ocorrências. Um clique aceita. O
 * sistema não aplica sozinho: votação por maioria rodando para sempre muda de
 * resposta no dia em que alguém lançar um lote errado, e muda em silêncio.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Sparkles } from "lucide-react";

import { COLOR } from "@/lib/brand";
import type { LinhaMapa, VendedorMapa } from "@/lib/ca/mapa";
import { palpitarCategoria, palpitarVendedor } from "@/lib/ca/sugestao";
import {
  PRODUCT_LINES_COLEGIO,
  PRODUCT_LINES_CPPEM,
  PRODUCT_LINES_UNICIVE,
} from "@/lib/products";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const LINHAS_POR_BU: Record<string, readonly { id: string; label: string }[]> = {
  cppem: PRODUCT_LINES_CPPEM,
  unicive: PRODUCT_LINES_UNICIVE,
  colegio_cppem: PRODUCT_LINES_COLEGIO,
};

const BU_NOME: Record<string, string> = { cppem: "CPPEM", unicive: "UNICIVE", colegio_cppem: "Colégio" };



export default function MapaClient({
  categorias,
  itens,
  vendedores,
  sellers,
}: {
  categorias: LinhaMapa[];
  itens: LinhaMapa[];
  vendedores: VendedorMapa[];
  sellers: { id: string; name: string; bu: string }[];
}) {
  const [aba, setAba] = useState<"categorias" | "itens" | "vendedores">("categorias");
  const pendentesCat = categorias.filter((c) => !c.product_line && !c.ignorar).length;
  /**
   * Só conta como pendente o item que MUDA alguma coisa — os que aparecem em
   * venda sem categoria. A primeira versão desta tela anunciava "109 pendentes"
   * sobre 126 itens, quando 7 importavam. Número que não se pode zerar deixa de
   * ser tarefa e vira ruído.
   */
  const pendentesItem = itens.filter((c) => c.relevante && !c.product_line && !c.ignorar).length;
  const pendentesVend = vendedores.filter((v) => v.destino === "pendente").length;

  const abas = [
    { id: "categorias" as const, label: "Categorias", n: pendentesCat, total: categorias.length },
    { id: "itens" as const, label: "Itens", n: pendentesItem, total: itens.filter((i) => i.relevante).length },
    { id: "vendedores" as const, label: "Vendedores", n: pendentesVend, total: vendedores.length },
  ];

  return (
    <div className="flex flex-col gap-4">
      <section className="panel p-4">
        <h2 className="eyebrow-label mb-2">Classificação</h2>
        <p className="mb-3 max-w-3xl text-xs leading-relaxed text-white/50">
          A <strong>categoria</strong> da venda resolve quase tudo e é o que separa matrícula de
          mensalidade. O <strong>item</strong> entra em dois casos: venda que nasce no site e chega
          sem categoria nenhuma, e matrícula do Colégio, onde a série só aparece no nome do item.
          Quando os dois existem, o item tem a palavra final.
        </p>
        <div className="inline-flex rounded-xl border border-border bg-panel p-1">
          {abas.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                aba === a.id ? "bg-accent text-black" : "text-white/60 hover:text-white"
              }`}
            >
              {a.label}
              <span className="ml-1.5 opacity-70">
                {a.n > 0 ? `${a.n} pendente${a.n > 1 ? "s" : ""}` : `${a.total}`}
              </span>
            </button>
          ))}
        </div>
      </section>

      {aba === "vendedores" ? (
        <TabelaVendedores vendedores={vendedores} sellers={sellers} />
      ) : aba === "categorias" ? (
        <TabelaLinhas linhas={categorias} tipo="categoria" />
      ) : (
        <TabelaItens itens={itens} />
      )}
    </div>
  );
}

/**
 * Itens, com os irrelevantes escondidos por padrão.
 *
 * A categoria da venda resolve a linha de receita em quase todo caso. O item só
 * é necessário quando a venda chegou SEM categoria — o que acontece em toda
 * venda que nasce no site. Mostrar os outros é pedir trabalho que não produz
 * nada, e foi o que inviabilizou a primeira versão desta tela.
 */
function TabelaItens({ itens }: { itens: LinhaMapa[] }) {
  const [verTodos, setVerTodos] = useState(false);
  const relevantes = itens.filter((i) => i.relevante);
  const resto = itens.length - relevantes.length;

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-3xl text-xs leading-relaxed text-white/50">
        Aparecem aqui só os itens que vieram em <strong>venda sem categoria</strong> — são os
        únicos em que classificar muda alguma coisa. Nos demais, a categoria da venda já resolve a
        linha de receita.
      </p>
      <TabelaLinhas linhas={verTodos ? itens : relevantes} tipo="item" />
      {resto > 0 ? (
        <button
          type="button"
          onClick={() => setVerTodos((v) => !v)}
          className="self-start text-xs text-white/40 underline underline-offset-4 hover:text-white/70"
        >
          {verTodos ? `Esconder os ${resto} itens que não precisam` : `Ver também os ${resto} itens que não precisam`}
        </button>
      ) : null}
    </div>
  );
}

function TabelaLinhas({ linhas, tipo }: { linhas: LinhaMapa[]; tipo: "categoria" | "item" }) {
  return (
    <section className="panel overflow-hidden p-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="font-ui text-[11px] uppercase tracking-[.14em] text-white/40">
              <th scope="col" className="pb-2 text-left font-semibold">{tipo === "categoria" ? "Categoria" : "Item"}</th>
              <th scope="col" className="pb-2 text-right font-semibold">Movimentou</th>
              <th scope="col" className="pb-2 text-left font-semibold">BU</th>
              <th scope="col" className="pb-2 text-left font-semibold">Linha de receita</th>
              <th scope="col" className="pb-2 text-center font-semibold">Conta p/ vendedor</th>
              <th scope="col" className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <LinhaEditavel key={`${l.ca_tipo}:${l.ca_id}`} linha={l} />
            ))}
          </tbody>
        </table>
      </div>
      {linhas.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/40">
          Nada aqui ainda — rode uma sincronização na aba <strong>Conexão e sync</strong>.
        </p>
      ) : null}
    </section>
  );
}

function LinhaEditavel({ linha }: { linha: LinhaMapa }) {
  const router = useRouter();
  const [salvando, startTransition] = useTransition();
  // Só sugere o que ainda não foi classificado — palpite nunca sobrescreve gente.
  const jaFeito = !!linha.product_line || linha.ignorar;
  const sug = jaFeito || linha.ca_tipo !== "categoria" ? null : palpitarCategoria(linha.ca_nome);
  const [bu, setBu] = useState(linha.bu ?? sug?.bu ?? "");
  const [pl, setPl] = useState(linha.product_line ?? sug?.product_line ?? "");
  const [conta, setConta] = useState(linha.conta_vendedor || (sug?.conta_vendedor ?? false));
  const [ignorar, setIgnorar] = useState(linha.ignorar || (sug?.ignorar ?? false));
  const [erro, setErro] = useState<string | null>(null);

  const pendente = !linha.product_line && !linha.ignorar;

  async function salvar() {
    setErro(null);
    const res = await fetch("/api/ca/mapa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ca_tipo: linha.ca_tipo,
        ca_id: linha.ca_id,
        bu: bu || null,
        product_line: ignorar ? null : pl || null,
        conta_vendedor: conta,
        ignorar,
      }),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) {
      setErro(j.error ?? "Falhou.");
      return;
    }
    startTransition(() => router.refresh());
  }

  const opcoes = LINHAS_POR_BU[bu] ?? [];

  return (
    <tr className="border-t border-[var(--hair)]">
      <td className="py-2 pr-3 align-top">
        {linha.ca_nome ? (
          <p className={pendente ? "font-medium" : "text-white/60"}>{linha.ca_nome}</p>
        ) : (
          <p className="font-medium text-white/40">
            sem nome ainda
            <span className="ml-1.5 font-mono text-[10px] text-white/25">{linha.ca_id.slice(0, 8)}</span>
          </p>
        )}
        {sug ? (
          <p className="mt-0.5 inline-flex items-center gap-1 text-[11px]" style={{ color: COLOR.gold }}>
            <Sparkles className="h-3 w-3" />
            sugerido: {sug.porque}
          </p>
        ) : null}
        {linha.sugestao ? (
          <p className="mt-0.5 inline-flex items-center gap-1 text-[11px]" style={{ color: COLOR.gold }}>
            <Sparkles className="h-3 w-3" />
            parece {linha.sugestao.nome} ({linha.sugestao.ocorrencias}× no histórico)
          </p>
        ) : null}
        {erro ? (
          <p className="mt-0.5 text-[11px]" style={{ color: COLOR.danger }}>
            {erro}
          </p>
        ) : null}
      </td>
      <td className="py-2 pr-3 text-right align-top tabular-nums text-white/60">
        {brl(linha.valor)}
        <span className="block text-[11px] text-white/30">{linha.vendas} vendas</span>
      </td>
      <td className="py-2 pr-3 align-top">
        <select
          className="input !py-1 text-xs"
          value={bu}
          onChange={(e) => {
            setBu(e.target.value);
            setPl("");
          }}
          disabled={ignorar}
        >
          <option value="">—</option>
          {Object.entries(BU_NOME).map(([id, nome]) => (
            <option key={id} value={id}>
              {nome}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-3 align-top">
        <select className="input !py-1 text-xs" value={pl} onChange={(e) => setPl(e.target.value)} disabled={ignorar || !bu}>
          <option value="">—</option>
          {opcoes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-3 text-center align-top">
        <input
          type="checkbox"
          checked={conta}
          onChange={(e) => setConta(e.target.checked)}
          disabled={ignorar}
          aria-label="Conta para o vendedor"
        />
      </td>
      <td className="py-2 align-top">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-white/50">
            <input type="checkbox" checked={ignorar} onChange={(e) => setIgnorar(e.target.checked)} />
            ignorar
          </label>
          <button type="button" onClick={salvar} disabled={salvando} className="btn btn-ghost !px-2 !py-1">
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function TabelaVendedores({ vendedores, sellers }: { vendedores: VendedorMapa[]; sellers: { id: string; name: string; bu: string }[] }) {
  return (
    <section className="panel overflow-hidden p-4">
      <p className="mb-3 max-w-3xl text-xs leading-relaxed text-white/50">
        <strong>Vendedor</strong> credita a venda a alguém no Hub. <strong>Canal direto</strong> é
        venda de site, sem dono. <strong>Grupo</strong> é diretoria, administrativo e quem saiu — a
        receita entra no faturamento do grupo e de ninguém. O padrão é{" "}
        <strong>pendente</strong>: cadastro novo no Conta Azul não credita ninguém até alguém dizer
        o que ele é.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="font-ui text-[11px] uppercase tracking-[.14em] text-white/40">
              <th scope="col" className="pb-2 text-left font-semibold">Cadastro no Conta Azul</th>
              <th scope="col" className="pb-2 text-right font-semibold">Movimentou</th>
              <th scope="col" className="pb-2 text-left font-semibold">Destino</th>
              <th scope="col" className="pb-2 text-left font-semibold">Vendedor do Hub</th>
              <th scope="col" className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {vendedores.map((v) => (
              <VendedorEditavel key={v.ca_vendedor_id} v={v} sellers={sellers} />
            ))}
          </tbody>
        </table>
      </div>
      {vendedores.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/40">
          Nada aqui ainda — rode uma sincronização na aba <strong>Conexão e sync</strong>.
        </p>
      ) : null}
    </section>
  );
}

function VendedorEditavel({ v, sellers }: { v: VendedorMapa; sellers: { id: string; name: string; bu: string }[] }) {
  const router = useRouter();
  const [salvando, startTransition] = useTransition();
  // Palpite só enquanto está pendente — nunca sobrescreve o que já foi decidido.
  const sug = v.destino === "pendente" ? palpitarVendedor(v.ca_nome, sellers) : null;
  const [destino, setDestino] = useState(sug?.destino ?? v.destino);
  const [sellerId, setSellerId] = useState(v.seller_id ?? sug?.sellerId ?? "");
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    const res = await fetch("/api/ca/vendedores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ca_vendedor_id: v.ca_vendedor_id, destino, seller_id: sellerId || null }),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) {
      setErro(j.error ?? "Falhou.");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <tr className="border-t border-[var(--hair)]">
      <td className="py-2 pr-3 align-top">
        <p className={v.destino === "pendente" ? "font-medium" : "text-white/60"}>{v.ca_nome || v.ca_vendedor_id}</p>
        <p className="text-[11px] text-white/25">{v.ca_vendedor_id.slice(0, 8)}</p>
        {sug ? (
          <p className="mt-0.5 inline-flex items-center gap-1 text-[11px]" style={{ color: COLOR.gold }}>
            <Sparkles className="h-3 w-3" />
            sugerido: {sug.porque}
          </p>
        ) : null}
        {erro ? (
          <p className="mt-0.5 text-[11px]" style={{ color: COLOR.danger }}>
            {erro}
          </p>
        ) : null}
      </td>
      <td className="py-2 pr-3 text-right align-top tabular-nums text-white/60">
        {brl(v.valor)}
        <span className="block text-[11px] text-white/30">{v.vendas} vendas</span>
      </td>
      <td className="py-2 pr-3 align-top">
        <select
          className="input !py-1 text-xs"
          value={destino}
          onChange={(e) => setDestino(e.target.value as VendedorMapa["destino"])}
        >
          <option value="pendente">Pendente</option>
          <option value="vendedor">Vendedor</option>
          <option value="canal_direto">Canal direto</option>
          <option value="grupo">Grupo</option>
        </select>
      </td>
      <td className="py-2 pr-3 align-top">
        <select
          className="input !py-1 text-xs"
          value={sellerId}
          onChange={(e) => setSellerId(e.target.value)}
          disabled={destino !== "vendedor"}
        >
          <option value="">—</option>
          {sellers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 align-top">
        <button type="button" onClick={salvar} disabled={salvando} className="btn btn-ghost !px-2 !py-1">
          <Check className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}
