"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2, Loader2 } from "lucide-react";
import Avatar from "./Avatar";

const MAX_DIMENSION = 1024; // px (lado maior)
const TARGET_QUALITY = 0.85;
const ABS_MAX_INPUT = 25 * 1024 * 1024; // 25 MB de entrada (depois comprimimos)

async function compressImage(file: File): Promise<Blob> {
  // GIF mantemos como esta (canvas perde animacao).
  if (file.type === "image/gif") return file;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
    i.src = dataUrl;
  });

  let w = img.naturalWidth;
  let h = img.naturalHeight;
  const longer = Math.max(w, h);
  if (longer > MAX_DIMENSION) {
    const k = MAX_DIMENSION / longer;
    w = Math.round(w * k);
    h = Math.round(h * k);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), outType, TARGET_QUALITY)
  );
  if (!blob) throw new Error("Falha ao comprimir a imagem.");
  return blob;
}

export default function AvatarUploader({
  name,
  initialUrl,
  color,
}: {
  name: string;
  initialUrl?: string | null;
  color: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl || null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function pick() {
    inputRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    if (file.size > ABS_MAX_INPUT) {
      setErr("Arquivo muito grande. Use uma foto menor que 25MB.");
      return;
    }
    setBusy("upload");
    try {
      const blob = await compressImage(file);
      const ext =
        blob.type === "image/png"
          ? "png"
          : blob.type === "image/gif"
          ? "gif"
          : "jpg";
      const form = new FormData();
      form.append("file", blob, `avatar.${ext}`);
      const res = await fetch("/api/seller/avatar", { method: "POST", body: form });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Erro ao enviar foto.");
      }
      const j = await res.json();
      setUrl(j.url);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Erro ao processar a imagem.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!url) return;
    setBusy("remove");
    setErr(null);
    const res = await fetch("/api/seller/avatar", { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Erro ao remover foto.");
      return;
    }
    setUrl(null);
    router.refresh();
  }

  // Compacto (cabecalho do Meu Painel): so a foto, com a camera para trocar e a
  // lixeira para remover. A foto e reduzida/otimizada automaticamente no envio.
  return (
    <div className="relative shrink-0" title={err || undefined}>
      <Avatar name={name} url={url} color={color} size={44} />
      <button
        onClick={pick}
        disabled={busy !== null}
        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent text-black grid place-items-center shadow-lg hover:opacity-90 disabled:opacity-50"
        title="Trocar foto (pode mandar a imagem normal, a gente reduz)"
        aria-label="Trocar foto"
      >
        {busy === "upload" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
      </button>
      {url && (
        <button
          onClick={remove}
          disabled={busy !== null}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-panel2 border border-border text-white/60 grid place-items-center hover:text-danger disabled:opacity-50"
          title="Remover foto"
          aria-label="Remover foto"
        >
          {busy === "remove" ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
        </button>
      )}
      {err && <div className="absolute left-0 top-full mt-1 w-56 text-[11px] text-danger">{err}</div>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}
