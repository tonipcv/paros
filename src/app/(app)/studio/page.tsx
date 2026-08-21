"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Check, Copy, Download, Expand, Heart, ImagePlus, Loader2,
  RefreshCw, Search, SlidersHorizontal, Sparkles, Trash2, Upload, Wand2, X,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";
import { IMAGE_MODELS, IMAGE_STYLES } from "@/lib/models";
import { EmptyState, PageContainer, PageHeader } from "@/components/ui";

type Img = {
  id: string; prompt: string; url: string; style: string; model: string;
  width: number; height: number; aspectRatio: string; quality: string;
  negativePrompt?: string | null; seed?: number | null; favorite: boolean; createdAt: string;
};

const ASPECTS = [
  { id: "1:1", label: "Square" }, { id: "4:5", label: "Portrait" },
  { id: "3:4", label: "Classic" }, { id: "16:9", label: "Wide" },
  { id: "9:16", label: "Story" }, { id: "4:3", label: "Landscape" },
];
const QUALITIES = [
  { id: "fast", label: "Fast", detail: "Quick draft" },
  { id: "standard", label: "Standard", detail: "Balanced" },
  { id: "max", label: "Max", detail: "Best detail" },
];

export default function StudioPage() {
  const { load } = useAppStore();
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [style, setStyle] = useState("photorealistic");
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<Img[]>([]);
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [modelId, setModelId] = useState(IMAGE_MODELS[0]?.id || "");
  const [safeMode, setSafeMode] = useState(true);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [quality, setQuality] = useState("standard");
  const [quantity, setQuantity] = useState(1);
  const [seed, setSeed] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [selected, setSelected] = useState<Img | null>(null);
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedModel = IMAGE_MODELS.find((m) => m.id === modelId) || IMAGE_MODELS[0];
  const visibleImages = useMemo(() => images.filter((image) => {
    const matchesSearch = !search.trim() || image.prompt.toLowerCase().includes(search.toLowerCase()) || image.model.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (!favoritesOnly || image.favorite);
  }), [images, search, favoritesOnly]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/images", { cache: "no-store" });
    if (res.ok) setImages((await res.json()).images);
  }, []);

  useEffect(() => {
    refresh();
    try { setSafeMode(localStorage.getItem("image_safe_mode") !== "off"); } catch {}
  }, [refresh]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") generate();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function loadReference(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Choose a PNG, JPEG or WebP image.");
    if (file.size > 12 * 1024 * 1024) return toast.error("Image must be smaller than 12 MB.");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setInputImage(dataUrl);
    const editingModel = IMAGE_MODELS.find((model) => model.supportsEditing);
    if (!selectedModel?.supportsEditing && editingModel) setModelId(editingModel.id);
  }

  async function generate() {
    if (!prompt.trim() || loading) return;
    if (inputImage && !selectedModel?.supportsEditing) return toast.error("Choose a model that supports image editing.");
    setLoading(true);
    try {
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt, negativePrompt, style, model: modelId, inputImage: inputImage || undefined,
          aspectRatio, quality, quantity, seed: seed === "" ? undefined : Number(seed), safeMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      const created: Img[] = data.images || [data.image];
      setImages((current) => [...created, ...current]);
      load();
      toast.success(`${created.length} ${inputImage ? "edit" : "image"}${created.length > 1 ? "s" : ""} created`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function toggleFavorite(image: Img) {
    const favorite = !image.favorite;
    setImages((all) => all.map((item) => item.id === image.id ? { ...item, favorite } : item));
    setSelected((current) => current?.id === image.id ? { ...current, favorite } : current);
    const res = await fetch(`/api/images/${image.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favorite }) });
    if (!res.ok) { refresh(); toast.error("Could not update favorite"); }
  }

  async function remove(image: Img) {
    if (!window.confirm("Delete this image from your history?")) return;
    const res = await fetch(`/api/images/${image.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Could not delete image");
    setImages((all) => all.filter((item) => item.id !== image.id));
    setSelected(null);
    toast.success("Image deleted");
  }

  function reuse(image: Img, edit = false) {
    setPrompt(image.prompt); setStyle(image.style); setAspectRatio(image.aspectRatio || "1:1");
    setQuality(image.quality || "standard"); setNegativePrompt(image.negativePrompt || "");
    setSeed(image.seed == null ? "" : String(image.seed)); setSelected(null);
    if (edit) { setInputImage(image.url); const model = IMAGE_MODELS.find((item) => item.supportsEditing); if (model) setModelId(model.id); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function copyPrompt(image: Img) {
    navigator.clipboard.writeText(image.prompt).then(() => toast.success("Prompt copied"));
  }

  const unitCost = (selectedModel?.credits || 5) + (inputImage ? 1 : 0);
  const totalCost = unitCost * quantity;

  return (
    <PageContainer width="wide" className="pb-20">
      <PageHeader title="Image Studio" description="Create, refine and organize production-ready visuals." actions={
        <div className="flex items-center gap-2 text-[11px] text-muted"><Sparkles size={14} className="text-highlight" /> Private creative workspace</div>
      } />

      <div className="grid gap-8 xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="h-fit rounded-card border border-borderDefault bg-surface p-5 xl:sticky xl:top-6">
          <div className="mb-5 flex items-center justify-between"><h2 className="text-[15px] font-semibold text-primary">Create</h2><span className="text-[11px] text-muted">⌘ Enter</span></div>

          <label className="label" htmlFor="studio-prompt">{inputImage ? "Edit instruction" : "Describe your image"}</label>
          <textarea id="studio-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} maxLength={8000}
            placeholder={inputImage ? "Describe exactly what should change…" : "A cinematic portrait with soft window light…"}
            className="input min-h-[120px] resize-y py-3" />
          <div className="mt-1 flex justify-between text-[10px] text-muted"><span>Be specific about subject, light and composition.</span><span>{prompt.length}/8000</span></div>

          <label className="label mt-5">Reference image</label>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => loadReference(e.target.files?.[0])} />
          {inputImage ? <div className="relative overflow-hidden rounded-lg border border-borderDefault bg-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}<img src={inputImage} alt="Reference" className="h-36 w-full object-contain" />
            <button onClick={() => setInputImage(null)} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white" aria-label="Remove reference"><X size={14} /></button>
          </div> : <button onClick={() => fileRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); loadReference(e.dataTransfer.files[0]); }}
            className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-5 text-[12px] transition ${dragging ? "border-highlight bg-highlight/5 text-primary" : "border-borderDefault text-muted hover:border-borderHover hover:text-primary"}`}>
            <Upload size={18} /><span>Drop an image or browse</span><span className="text-[10px]">PNG, JPEG or WebP · 12 MB max</span>
          </button>}

          <label className="label mt-5">Aspect ratio</label>
          <div className="grid grid-cols-3 gap-1.5">{ASPECTS.map((item) => <button key={item.id} onClick={() => setAspectRatio(item.id)} className={`rounded-btn border px-2 py-2 text-left transition ${aspectRatio === item.id ? "border-highlight bg-highlight text-bg" : "border-borderDefault text-secondary hover:border-borderHover"}`}><span className="block text-[12px] font-semibold">{item.id}</span><span className="text-[9px] opacity-70">{item.label}</span></button>)}</div>

          <label className="label mt-5">Style</label>
          <div className="flex flex-wrap gap-1.5">{IMAGE_STYLES.map((item) => <button key={item.id} onClick={() => setStyle(item.id)} className={`rounded-full border px-3 py-1.5 text-[11px] transition ${style === item.id ? "border-highlight bg-highlight text-bg" : "border-borderDefault text-secondary hover:border-borderHover"}`}>{item.name}</button>)}</div>

          <label className="label mt-5">Model</label>
          <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="input h-11 w-full">
            {IMAGE_MODELS.filter((model) => !inputImage || model.supportsEditing).map((model) => <option key={model.id} value={model.id}>{model.name} · {model.credits} cr{model.supportsEditing ? " · edit" : ""}</option>)}
          </select>

          <button onClick={() => setAdvanced((value) => !value)} className="mt-5 flex w-full items-center justify-between border-t border-borderDefault pt-4 text-[12px] font-medium text-secondary hover:text-primary"><span className="flex items-center gap-2"><SlidersHorizontal size={14} /> Advanced controls</span><span>{advanced ? "−" : "+"}</span></button>
          {advanced && <div className="mt-4 space-y-4">
            <div><label className="label">Quality</label><div className="grid grid-cols-3 gap-1">{QUALITIES.map((item) => <button key={item.id} onClick={() => setQuality(item.id)} className={`rounded-btn border px-2 py-2 text-[10px] ${quality === item.id ? "border-highlight bg-highlight/10 text-primary" : "border-borderDefault text-muted"}`}><span className="block font-semibold">{item.label}</span><span>{item.detail}</span></button>)}</div></div>
            <div><label className="label" htmlFor="negative-prompt">Avoid</label><textarea id="negative-prompt" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} rows={2} maxLength={2000} placeholder="Blur, artifacts, extra fingers…" className="input resize-y py-2" /></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="seed">Seed</label><input id="seed" type="number" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Random" className="input" /></div><div><label className="label">Variations</label><div className="flex h-9 overflow-hidden rounded-btn border border-borderDefault">{[1,2,3,4].map((number) => <button key={number} onClick={() => setQuantity(number)} className={`flex-1 text-[12px] ${quantity === number ? "bg-highlight text-bg" : "text-secondary hover:bg-bgHover"}`}>{number}</button>)}</div></div></div>
            {selectedModel?.provider === "fal" ? <div className="flex items-center justify-between rounded-lg border border-borderDefault bg-bg px-3 py-2.5"><div><p className="text-[12px] font-medium text-primary">Safety filter</p><p className="text-[10px] text-muted">Applied directly by Fal</p></div><button onClick={() => { const next = !safeMode; setSafeMode(next); try { localStorage.setItem("image_safe_mode", next ? "on" : "off"); } catch {} }} className={`grid h-7 w-12 place-items-center rounded-full border transition ${safeMode ? "border-success/40 bg-success/20 text-success" : "border-warning/40 bg-warning/10 text-warning"}`}>{safeMode ? <Check size={13}/> : <AlertTriangle size={13}/>}</button></div> : <div className="rounded-lg border border-borderDefault bg-bg px-3 py-2.5"><p className="text-[12px] font-medium text-primary">Provider safety policy</p><p className="text-[10px] text-muted">This model uses its provider-managed safety controls.</p></div>}
          </div>}

          <button onClick={generate} disabled={loading || !prompt.trim()} className="btn-primary mt-6 h-12 w-full text-[13px]">
            {loading ? <Loader2 size={17} className="animate-spin" /> : <Wand2 size={17} />}{loading ? "Creating…" : inputImage ? `Edit · ${totalCost} credits` : `Generate ${quantity > 1 ? `${quantity} images` : "image"} · ${totalCost} credits`}
          </button>
        </aside>

        <section className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-[17px] font-semibold text-primary">Your creations</h2><p className="text-[11px] text-muted">{images.length} saved image{images.length === 1 ? "" : "s"}</p></div>
            <div className="flex items-center gap-2"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search prompts" className="input w-44 pl-9 sm:w-56" /></div><button onClick={() => setFavoritesOnly((value) => !value)} className={`grid h-9 w-9 place-items-center rounded-btn border ${favoritesOnly ? "border-pink-500/50 bg-pink-500/10 text-pink-400" : "border-borderDefault text-muted"}`} title="Favorites"><Heart size={15} fill={favoritesOnly ? "currentColor" : "none"}/></button><button onClick={refresh} className="grid h-9 w-9 place-items-center rounded-btn border border-borderDefault text-muted hover:text-primary" title="Refresh"><RefreshCw size={14}/></button></div>
          </div>
          {loading && <div className="mb-5 overflow-hidden rounded-card border border-highlight/30 bg-highlight/5 p-5"><div className="flex items-center gap-3"><Loader2 className="animate-spin text-highlight" size={20}/><div><p className="text-[13px] font-medium text-primary">Creating your image{quantity > 1 ? "s" : ""}</p><p className="text-[11px] text-muted">You can keep browsing your previous work.</p></div></div><div className="mt-4 h-1 overflow-hidden rounded-full bg-bgActive"><div className="h-full w-1/2 animate-pulse rounded-full bg-highlight"/></div></div>}
          {visibleImages.length === 0 ? <EmptyState icon={ImagePlus} title={images.length ? "No matches" : "No images yet"} description={images.length ? "Try a different search or filter." : "Your creations will appear here."} /> :
            <div className="columns-2 gap-3 md:columns-3 2xl:columns-4">{visibleImages.map((image) => <article key={image.id} className="group relative mb-3 break-inside-avoid overflow-hidden rounded-card border border-borderDefault bg-surface transition hover:border-borderHover">
              <button onClick={() => setSelected(image)} className="block w-full text-left"><div className="relative overflow-hidden bg-bg" style={{ aspectRatio: image.aspectRatio?.replace(":", "/") || `${image.width}/${image.height}` }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={image.url} alt={image.prompt} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"/><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition group-hover:opacity-100"/><Expand size={16} className="absolute bottom-3 right-3 text-white opacity-0 transition group-hover:opacity-100"/></div></button>
              <div className="p-3"><p className="line-clamp-2 text-[11px] leading-4 text-secondary">{image.prompt}</p><div className="mt-2 flex items-center justify-between"><span className="truncate text-[9px] text-muted">{image.aspectRatio} · {image.quality}</span><div className="flex gap-1"><button onClick={() => toggleFavorite(image)} className={`grid h-7 w-7 place-items-center rounded-full hover:bg-bgHover ${image.favorite ? "text-pink-400" : "text-muted"}`} aria-label="Favorite"><Heart size={13} fill={image.favorite ? "currentColor" : "none"}/></button><a href={image.url} download={`image-${image.id}.png`} target="_blank" rel="noreferrer" className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-bgHover hover:text-primary" aria-label="Download"><Download size={13}/></a></div></div></div>
            </article>)}</div>}
        </section>
      </div>

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
        <button onClick={() => setSelected(null)} className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Close"><X size={20}/></button>
        <div className="grid max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-card border border-white/10 bg-[#0a0a0a] lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-h-[45vh] items-center justify-center overflow-auto bg-black p-3">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={selected.url} alt={selected.prompt} className="max-h-[84vh] max-w-full object-contain"/></div>
          <aside className="overflow-y-auto border-l border-white/10 p-5 text-white"><div className="flex items-center justify-between"><span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px]">{selected.aspectRatio} · {selected.quality}</span><button onClick={() => toggleFavorite(selected)} className={selected.favorite ? "text-pink-400" : "text-white/50"}><Heart size={18} fill={selected.favorite ? "currentColor" : "none"}/></button></div><h3 className="mt-5 text-[11px] uppercase tracking-wider text-white/40">Prompt</h3><p className="mt-2 text-[13px] leading-6 text-white/85">{selected.prompt}</p>{selected.negativePrompt && <><h3 className="mt-5 text-[11px] uppercase tracking-wider text-white/40">Avoid</h3><p className="mt-2 text-[12px] leading-5 text-white/60">{selected.negativePrompt}</p></>}<div className="mt-5 space-y-2 border-t border-white/10 pt-5 text-[11px] text-white/50"><p>{selected.model}</p><p>{selected.width} × {selected.height}{selected.seed != null ? ` · Seed ${selected.seed}` : ""}</p><p>{new Date(selected.createdAt).toLocaleString()}</p></div>
            <div className="mt-6 grid grid-cols-2 gap-2"><button onClick={() => reuse(selected, true)} className="flex h-9 items-center justify-center gap-2 rounded-btn bg-white text-[11px] font-semibold text-black"><ImagePlus size={14}/> Edit</button><button onClick={() => reuse(selected)} className="flex h-9 items-center justify-center gap-2 rounded-btn border border-white/20 text-[11px]"><RefreshCw size={13}/> Reuse</button><button onClick={() => copyPrompt(selected)} className="flex h-9 items-center justify-center gap-2 rounded-btn border border-white/20 text-[11px]"><Copy size={13}/> Copy prompt</button><a href={selected.url} download={`image-${selected.id}.png`} target="_blank" rel="noreferrer" className="flex h-9 items-center justify-center gap-2 rounded-btn border border-white/20 text-[11px]"><Download size={13}/> Download</a><button onClick={() => remove(selected)} className="col-span-2 flex h-9 items-center justify-center gap-2 rounded-btn text-[11px] text-red-400 hover:bg-red-500/10"><Trash2 size={13}/> Delete image</button></div>
          </aside>
        </div>
      </div>}
    </PageContainer>
  );
}
