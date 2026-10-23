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

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <Avatar name={name} url={url} color={color} size={56} />
        <button
          onClick={pick}
          disabled={busy !== null}
          className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-accent text-black grid place-items-center shadow-lg hover:opacity-90 disabled:opacity-50"
          title="Trocar foto"
        >
          {busy === "upload" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Camera className="w-3.5 h-3.5" />
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={onFile}
        />
      </div>
      <div className="text-xs text-white/60">
        <div className="text-white text-sm font-medium">Sua foto</div>
        <div className="leading-snug max-sm:hidden">
          A foto e redimensionada automaticamente. Pode mandar a sua imagem normal,
          a gente reduz e otimiza pra voce.
        </div>
        {url && (
          <button
            onClick={remove}
            disabled={busy !== null}
            className="mt-1 text-danger hover:underline inline-flex items-center gap-1"
          >
            {busy === "remove" ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
            Remover foto
          </button>
        )}
        {err && <div className="text-danger mt-1">{err}</div>}
      </div>
    </div>
  );
}
