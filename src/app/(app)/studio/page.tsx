"use client";

import { useEffect, useRef, useState } from "react";
import { Wand2, Loader2, Upload, X, Flame, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";
import { IMAGE_STYLES, IMAGE_MODELS } from "@/lib/models";
import { EmptyState, PageContainer, PageHeader } from "@/components/ui";

type Img = { id: string; prompt: string; url: string; style: string; createdAt: string };

export default function StudioPage() {
  const { load } = useAppStore();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("photorealistic");
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<Img[]>([]);
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [modelId, setModelId] = useState(IMAGE_MODELS[0]?.id || "");
  const [matureFilter, setMatureFilter] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refresh();
    try { setMatureFilter(localStorage.getItem("htps_mature") !== "on"); } catch {}
  }, []);

  const selectedModel = IMAGE_MODELS.find((m) => m.id === modelId) || IMAGE_MODELS[0];

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
        body: JSON.stringify({ prompt, style, model: modelId, inputImage: inputImage || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setImages((imgs) => [data.image, ...imgs]);
      load();
      const costLabel = inputImage ? `${data.image?.model || selectedModel.name} edit` : data.image?.model || selectedModel.name;
      toast.success(`${inputImage ? "Image edited" : "Image generated"} — ${costLabel}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  const cost = inputImage ? (selectedModel?.credits || 5) + 1 : (selectedModel?.credits || 5);

  return (
    <PageContainer width="wide">
      <PageHeader title="Image Studio" description="Generate from text, or upload an image to edit it." />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="h-fit border-t border-borderDefault pt-8">
          <label className="label" htmlFor="studio-file">Base image (optional)</label>
          <input ref={fileRef} id="studio-file" type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files)} />
          {inputImage ? (
            <div className="relative mb-4 w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={inputImage} alt="base" className="h-28 w-28 rounded-lg border border-borderDefault object-cover" />
              <button
                onClick={() => setInputImage(null)}
                aria-label="Remove base image"
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

          <label className="label" htmlFor="studio-prompt">{inputImage ? "Edit instruction" : "Prompt"}</label>
          <textarea
            id="studio-prompt"
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

          <label className="label mt-4">Model</label>
          <div className="flex flex-wrap gap-1.5">
            {IMAGE_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => setModelId(m.id)}
                className={`rounded-btn border px-2.5 py-1 text-[12px] font-medium transition ${
                  modelId === m.id
                    ? "border-highlight bg-highlight text-bg"
                    : "border-borderDefault text-secondary hover:border-borderHover hover:text-primary"
                }`}
              >
                <span className="flex items-center gap-1">
                  {m.name}
                  <span className="text-[10px] opacity-70">{m.credits}cr</span>
                  {"uncensored" in m && (m as any).uncensored && (
                    <Flame size={11} className="text-orange-400" />
                  )}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg border border-borderDefault bg-surface px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-primary">Mature filter</p>
              <p className="text-[11px] text-muted">
                {matureFilter ? "Filter active — safe mode" : "Disabled — full creative freedom"}
              </p>
            </div>
            <button
              onClick={() => {
                const next = !matureFilter;
                setMatureFilter(next);
                try { localStorage.setItem("htps_mature", next ? "on" : "off"); } catch {}
              }}
              title={matureFilter ? "Disable mature filter" : "Enable mature filter"}
              aria-label={matureFilter ? "Disable mature filter" : "Enable mature filter"}
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-btn border transition ${
                matureFilter
                  ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-500"
                  : "border-borderDefault text-secondary hover:border-borderHover hover:text-primary"
              }`}
            >
              <AlertTriangle size={13} />
            </button>
          </div>

          <button
            onClick={generate}
            disabled={loading || !prompt.trim()}
            className="btn-primary mt-5 h-11 w-full"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {loading ? "Generating…" : inputImage ? `Edit image (${cost} credits)` : `Generate (${cost} credits)`}
          </button>
        </div>

        <div>
          {images.length === 0 ? (
            <EmptyState icon={Wand2} title="No images yet" description="Your generations will appear here." />
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
    </PageContainer>
  );
}
