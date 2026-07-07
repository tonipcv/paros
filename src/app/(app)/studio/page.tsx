"use client";

import { useEffect, useRef, useState } from "react";
import { Wand2, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";
import { IMAGE_STYLES } from "@/lib/models";

type Img = { id: string; prompt: string; url: string; style: string; createdAt: string };

export default function StudioPage() {
  const { load } = useAppStore();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("photorealistic");
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<Img[]>([]);
  const [inputImage, setInputImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const res = await fetch("/api/images");
    if (res.ok) setImages((await res.json()).images);
  }

  async function onFile(files: FileList | null) {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    setInputImage(dataUrl);
  }

  async function generate() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style, inputImage: inputImage || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setImages((imgs) => [data.image, ...imgs]);
      load();
      toast.success(inputImage ? "Image edited" : "Image generated");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-h1 text-grad-light">Image Studio</h1>
        <p className="mt-1 text-sm text-muted">Generate from text, or upload an image to edit it.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="card h-fit p-5">
          <label className="label">Base image (optional - for editing)</label>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files)} />
          {inputImage ? (
            <div className="relative mb-4 w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={inputImage} alt="base" className="h-28 w-28 rounded-lg border border-borderDefault object-cover" />
              <button
                onClick={() => setInputImage(null)}
                className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-bg text-muted hover:text-danger"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-btn border border-dashed border-borderDefault py-3 text-[12px] text-muted transition hover:border-borderHover hover:text-primary"
            >
              <Upload size={15} /> Upload image to edit
            </button>
          )}

          <label className="label">{inputImage ? "Edit instruction" : "Prompt"}</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="A serene mountain lake at sunrise…"
            className="input min-h-[100px] resize-y py-2"
          />

          <label className="label mt-4">Style</label>
          <div className="flex flex-wrap gap-1.5">
            {IMAGE_STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                className={`rounded-btn border px-2.5 py-1 text-[12px] font-medium transition ${
                  style === s.id
                    ? "border-highlight bg-highlight text-bg"
                    : "border-borderDefault text-secondary hover:border-borderHover hover:text-primary"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          <button
            onClick={generate}
            disabled={loading || !prompt.trim()}
            className="btn-primary mt-5 h-11 w-full"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {loading ? "Working…" : inputImage ? "Edit image (6 credits)" : "Generate (5 credits)"}
          </button>
        </div>

        <div>
          {images.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-card border border-dashed border-borderDefault text-center">
              <Wand2 size={24} className="mb-2 text-tertiary" />
              <p className="text-sm text-muted">Your generations will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((img) => (
                <div key={img.id} className="group overflow-hidden rounded-card border border-borderDefault bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.prompt} className="aspect-square w-full object-cover" />
                  <p className="truncate px-2.5 py-2 text-[11px] text-muted" title={img.prompt}>
                    {img.prompt}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
