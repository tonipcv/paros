"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  ArrowUp,
  Trash2,
  ChevronDown,
  Square,
  Paperclip,
  Mic,
  Volume2,
  Settings2,
  MessageSquareOff,
  X,
  Loader2,
  Copy,
  Check,
  FileText,
  Lock,
  HardDrive,
  Cloud,
  ShieldCheck,
  EyeOff,
  ShieldClose,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";
import type { ChatModel } from "@/lib/models";
import { VOICES } from "@/lib/models";
import { Markdown } from "@/components/markdown";
import { encryptText, decryptText } from "@/lib/e2e";
import { sealChat, openChatReply } from "@/lib/e2e-seal";
import { phalaE2eeModel } from "@/lib/privacy-router";
import {
  listLocalConversations,
  getLocalConversation,
  putLocalConversation,
  deleteLocalConversation,
  newLocalId,
  type LocalConversation,
} from "@/lib/local-store";

type Attachment = { kind: "image"; url: string } | { kind: "file"; name: string };
type Msg = { id: string; role: string; content: string; attachments?: Attachment[] };
type Convo = { id: string; title: string; model: string; updatedAt: string | number; encrypted?: boolean; titleIv?: string | null; displayTitle?: string };
type DocFile = { name: string; text: string; chars: number };
type StorageMode = "local" | "cloud";
type PrivacyMode = "anonymous" | "private" | "tee" | "e2ee";

export default function ChatPage() {
  const { chatModels, loadModels, load, workspace, encKey, unlock } = useAppStore();
  const [storageMode, setStorageMode] = useState<StorageMode>("local");
  const [convos, setConvos] = useState<Convo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [documents, setDocuments] = useState<DocFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [temporary, setTemporary] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockPass, setUnlockPass] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>("private");
  const [teeStatus, setTeeStatus] = useState<Record<"tee" | "e2ee", { verified: boolean; reason?: string; measurement?: string } | undefined>>({ tee: undefined, e2ee: undefined });
  const [voice, setVoice] = useState("alloy");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadModels();
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("htps_storage")) as StorageMode | null;
    const mode: StorageMode = saved === "cloud" ? "cloud" : "local";
    setStorageMode(mode);
    refreshConvos(mode);
    fetch("/api/attestation")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.attestations) return;
        const next: typeof teeStatus = { tee: undefined, e2ee: undefined };
        for (const a of d.attestations) {
          if (a.mode === "tee" || a.mode === "e2ee") {
            next[a.mode as "tee" | "e2ee"] = { verified: a.verified, reason: a.reason, measurement: a.measurement };
          }
        }
        setTeeStatus(next);
      })
      .catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("character");
    if (cid) {
      startWithCharacter(cid);
      window.history.replaceState({}, "", "/chat");
    }
  }, []);

  useEffect(() => {
    if (!model && chatModels.length) setModel(chatModels[0].id);
  }, [chatModels, model]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const activeModel: ChatModel | undefined = chatModels.find((m) => m.id === model);

  // ---------- data layer (local vs cloud) ----------
  async function refreshConvos(mode: StorageMode = storageMode) {
    if (mode === "local") {
      const list = await listLocalConversations();
      setConvos(list.map((c) => ({ id: c.id, title: c.title, model: c.model, updatedAt: c.updatedAt, displayTitle: c.title })));
      return;
    }
    const res = await fetch("/api/conversations");
    if (!res.ok) return;
    const list: Convo[] = (await res.json()).conversations;
    const decorated = await Promise.all(
      list.map(async (c) => {
        if (c.encrypted && c.titleIv && encKey) {
          try {
            return { ...c, displayTitle: await decryptText(encKey, c.titleIv, c.title) };
          } catch {
            return { ...c, displayTitle: "Encrypted chat" };
          }
        }
        return { ...c, displayTitle: c.encrypted ? "Encrypted chat" : c.title };
      })
    );
    setConvos(decorated);
  }

  async function switchMode(mode: StorageMode) {
    if (mode === "cloud") {
      if (!workspace?.encEnabled) {
        toast.error("Enable end-to-end encryption in Settings to use encrypted cloud sync.");
        return;
      }
      if (!encKey) {
        setUnlockOpen(true);
        return;
      }
    }
    setStorageMode(mode);
    try {
      localStorage.setItem("htps_storage", mode);
    } catch {}
    newConvo();
    refreshConvos(mode);
  }

  async function openConvo(id: string) {
    setActiveId(id);
    setTemporary(false);
    if (storageMode === "local") {
      const c = await getLocalConversation(id);
      if (!c) return;
      setMessages(c.messages as Msg[]);
      if (c.model) setModel(c.model);
      setTemperature(c.temperature ?? 0.7);
      setSystemPrompt(c.systemPrompt || "");
      setCharacterId(c.characterId || null);
      return;
    }
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) return;
    const convo = (await res.json()).conversation;
    if (convo.model) setModel(convo.model);
    setTemperature(convo.temperature ?? 0.7);
    setSystemPrompt(convo.systemPrompt || "");
    if (convo.encrypted) {
      if (!encKey) {
        setMessages([]);
        setUnlockOpen(true);
        return;
      }
      const decrypted = await Promise.all(
        convo.messages.map(async (m: any) => {
          if (m.encrypted && m.iv) {
            try {
              const dec = await decryptText(encKey, m.iv, m.content);
              try {
                const p = JSON.parse(dec);
                if (p && typeof p.c === "string") return { ...m, content: p.c, attachments: p.a || [] };
              } catch {}
              return { ...m, content: dec };
            } catch {
              return { ...m, content: "[unable to decrypt]" };
            }
          }
          return m;
        })
      );
      setMessages(decrypted);
    } else {
      setMessages(convo.messages);
    }
  }

  function newConvo() {
    setActiveId(null);
    setMessages([]);
    setSystemPrompt("");
    setTemperature(0.7);
    setCharacterId(null);
  }

  async function deleteConvo(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (storageMode === "local") {
      await deleteLocalConversation(id);
    } else {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    }
    if (activeId === id) newConvo();
    refreshConvos();
  }

  async function startWithCharacter(cid: string) {
    const res = await fetch("/api/characters");
    if (!res.ok) return;
    const chars = (await res.json()).characters as any[];
    const c = chars.find((x) => x.id === cid);
    if (!c) return;
    newConvo();
    setCharacterId(c.id);
    setSystemPrompt(c.systemPrompt || "");
    if (c.model) setModel(c.model);
    if (c.greeting) setMessages([{ id: `g-${Date.now()}`, role: "assistant", content: c.greeting }]);
  }

  // ---------- attachments ----------
  async function onFiles(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files);
    const imgs = list.filter((f) => f.type.startsWith("image/"));
    const docs = list.filter((f) => !f.type.startsWith("image/"));

    if (imgs.length) {
      if (!activeModel?.vision) {
        toast.error(`${activeModel?.name} does not support images. Choose a vision-capable model.`);
      } else {
        const next: string[] = [];
        for (const file of imgs.slice(0, 4)) {
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          next.push(dataUrl);
        }
        setAttachments((a) => [...a, ...next].slice(0, 4));
      }
    }

    for (const file of docs.slice(0, 6)) {
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/files/parse", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setDocuments((d) => [...d, { name: data.name, text: data.text, chars: data.chars }].slice(0, 6));
        toast.success(`${data.name} attached${data.truncated ? " (truncated)" : ""}`);
      } catch (e: any) {
        toast.error(e.message || "Failed to read file");
      } finally {
        setUploading(false);
      }
    }
  }

  // ---------- send ----------
  async function send() {
    const content = input.trim();
    if ((!content && attachments.length === 0 && documents.length === 0) || streaming) return;

    if (storageMode === "cloud" && !encKey) {
      setUnlockOpen(true);
      return;
    }

    const sendingImages = attachments;
    const sendingDocs = documents;
    const sendingAttachments: Attachment[] = [
      ...sendingImages.map((url) => ({ kind: "image" as const, url })),
      ...sendingDocs.map((d) => ({ kind: "file" as const, name: d.name })),
    ];

    const priorHistory = messages.map((m) => ({ role: m.role, content: m.content }));

    setInput("");
    setAttachments([]);
    setDocuments([]);
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content, attachments: sendingAttachments };
    setMessages((m) => [...m, userMsg]);
    const assistantId = `a-${Date.now()}`;
    setMessages((m) => [...m, { id: assistantId, role: "assistant", content: "" }]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let acc = "";
    try {
      if (privacyMode === "e2ee") {
        // Real E2EE: seal every message to the attested enclave key in the
        // browser. Our server relays only ciphertext and never sees plaintext.
        const att = await fetch("/api/attestation?mode=e2ee").then((r) => r.json());
        if (!att?.verified || !att?.enclavePublicKey) {
          throw new Error(`Enclave attestation unavailable (${att?.reason || "unverified"})`);
        }
        const docContext = sendingDocs.length
          ? `The user attached the following document(s). Use them as context.\n\n${sendingDocs
              .map((d) => `## Attached file: ${d.name}\n${d.text}`)
              .join("\n\n---\n\n")}\n\n---\n\n`
          : "";
        const phalaModel = phalaE2eeModel(model);
        const outbound = [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          ...priorHistory.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: docContext + content },
        ];
        const sealed = await sealChat(att.enclavePublicKey, phalaModel, outbound);
        const res = await fetch("/api/chat/e2ee", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: phalaModel,
            creditModel: model,
            messages: sealed.messages,
            e2eeHeaders: sealed.headers,
          }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "E2EE request failed");
        acc = await openChatReply(sealed, data);
        setMessages((m) => m.map((msg) => (msg.id === assistantId ? { ...msg, content: acc } : msg)));
        if (!temporary) {
          await persistTurn(userMsg, { id: assistantId, role: "assistant", content: acc });
        }
        load();
        return;
      }
      // Inference is ALWAYS ephemeral: the server runs the model but never stores content.
      // For TEE/E2EE modes the server verifies enclave attestation (fail-closed) and
      // proxies to the attested enclave with a server-held key — the API key is never
      // exposed to the browser, and nothing is persisted server-side.
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: null,
          content,
          model,
          images: sendingImages,
          documents: sendingDocs.map((d) => ({ name: d.name, text: d.text })),
          ephemeral: true,
          privacyMode,
          temperature,
          systemPrompt,
          history: priorHistory,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Request failed");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => m.map((msg) => (msg.id === assistantId ? { ...msg, content: acc } : msg)));
      }

      if (!temporary) {
        await persistTurn(userMsg, { id: assistantId, role: "assistant", content: acc });
      }
      load();
    } catch (e: any) {
      if (e.name === "AbortError") {
        if (!temporary && acc) await persistTurn(userMsg, { id: assistantId, role: "assistant", content: acc });
        load();
      } else {
        toast.error(e.message);
        setMessages((m) => m.filter((msg) => msg.id !== assistantId));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  async function persistTurn(userMsg: Msg, assistantMsg: Msg) {
    if (storageMode === "local") {
      const now = Date.now();
      const existing = activeId ? await getLocalConversation(activeId) : undefined;
      const seededGreeting = messages.filter((m) => m.role === "assistant" && m.id.startsWith("g-")) as unknown as LocalConversation["messages"];
      const convo: LocalConversation = existing || {
        id: newLocalId(),
        title: content24(userMsg.content) || "New chat",
        model,
        systemPrompt,
        temperature,
        characterId: characterId || undefined,
        messages: seededGreeting,
        createdAt: now,
        updatedAt: now,
      };
      if (!existing) setActiveId(convo.id);
      convo.messages.push(userMsg as unknown as LocalConversation["messages"][number], assistantMsg as unknown as LocalConversation["messages"][number]);
      convo.model = model;
      convo.systemPrompt = systemPrompt;
      convo.temperature = temperature;
      convo.updatedAt = now;
      await putLocalConversation(convo);
      refreshConvos("local");
      return;
    }

    // cloud: encrypted server sync
    if (!encKey) return;
    let id = activeId;
    if (!id) {
      const titleText = (content24(userMsg.content) || "Encrypted chat").slice(0, 80);
      const t = await encryptText(encKey, titleText);
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, temperature, systemPrompt, encrypted: true, titleIv: t.iv, titleCt: t.ct }),
      });
      id = (await res.json()).conversation.id;
      setActiveId(id);
    }
    // Encrypt BOTH text and attachments (images/files) as a single blob — the server never sees them.
    const userPayload = JSON.stringify({ c: userMsg.content, a: userMsg.attachments || [] });
    const asstPayload = JSON.stringify({ c: assistantMsg.content, a: [] });
    const [u, a] = await Promise.all([encryptText(encKey, userPayload), encryptText(encKey, asstPayload)]);
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: id,
        items: [
          { role: "user", iv: u.iv, ct: u.ct },
          { role: "assistant", iv: a.iv, ct: a.ct, model },
        ],
      }),
    });
    refreshConvos("cloud");
  }

  function content24(s: string) {
    return s.trim().slice(0, 48);
  }

  function stop() {
    abortRef.current?.abort();
  }

  function copyMsg(m: Msg) {
    navigator.clipboard.writeText(m.content);
    setCopiedId(m.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  // ---------- voice ----------
  async function toggleRecord() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setTranscribing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const form = new FormData();
          form.append("file", blob, "audio.webm");
          const res = await fetch("/api/stt", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setInput((v) => (v ? v + " " : "") + data.text);
        } catch (e: any) {
          toast.error(e.message || "Transcription failed");
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  }

  async function speak(msg: Msg) {
    if (playingId === msg.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    try {
      setPlayingId(msg.id);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg.content, voice }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlayingId(null);
      audio.play();
      load();
    } catch (e: any) {
      toast.error(e.message || "TTS failed");
      setPlayingId(null);
    }
  }

  async function doUnlock() {
    const ok = await unlock(unlockPass);
    setUnlockPass("");
    if (ok) {
      setUnlockOpen(false);
      toast.success("Unlocked");
      refreshConvos();
    } else {
      toast.error("Wrong passphrase");
    }
  }

  return (
    <div className="flex h-full">
      <div className="hidden w-60 shrink-0 flex-col border-r border-borderDefault md:flex">
        <div className="space-y-2 p-3">
          <button onClick={newConvo} className="btn-secondary w-full">
            <Plus size={15} /> New chat
          </button>
          <div className="flex rounded-btn border border-borderDefault p-0.5 text-[11px]">
            <button
              onClick={() => switchMode("local")}
              className={`flex flex-1 items-center justify-center gap-1 rounded-[6px] py-1 transition ${
                storageMode === "local" ? "bg-bgActive text-primary" : "text-tertiary hover:text-primary"
              }`}
            >
              <HardDrive size={12} /> Device
            </button>
            <button
              onClick={() => switchMode("cloud")}
              className={`flex flex-1 items-center justify-center gap-1 rounded-[6px] py-1 transition ${
                storageMode === "cloud" ? "bg-bgActive text-primary" : "text-tertiary hover:text-primary"
              }`}
            >
              <Cloud size={12} /> Synced
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto px-2 pb-3">
          {convos.map((c) => (
            <button
              key={c.id}
              onClick={() => openConvo(c.id)}
              className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition ${
                activeId === c.id ? "bg-surface text-primary" : "text-sidebarText hover:bg-sidebarHover hover:text-primary"
              }`}
            >
              {c.encrypted && <Lock size={12} className="shrink-0 text-tertiary" />}
              <span className="min-w-0 flex-1 truncate">{c.displayTitle || c.title}</span>
              <Trash2
                size={13}
                onClick={(e) => deleteConvo(c.id, e)}
                className="shrink-0 text-tertiary opacity-0 transition hover:text-danger group-hover:opacity-100"
              />
            </button>
          ))}
          {convos.length === 0 && <p className="px-2.5 py-3 text-xs text-tertiary">No conversations yet</p>}
        </div>
        <div className="border-t border-borderDefault px-3 py-2 text-[10px] text-tertiary">
          {storageMode === "local"
            ? "Stored only on this device. Never sent to our servers."
            : "Encrypted sync — stored as ciphertext only."}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-borderDefault px-4">
          <div className="relative">
            <button
              onClick={() => setModelOpen((v) => !v)}
              className="flex items-center gap-2 rounded-btn border border-borderDefault bg-surface px-3 py-1.5 text-[13px] text-primary hover:border-borderHover"
            >
              <span className="font-medium">{activeModel?.name || "Select model"}</span>
              <ChevronDown size={14} className="text-muted" />
            </button>
            {modelOpen && (
              <div className="absolute left-0 top-full z-30 mt-2 max-h-96 w-72 overflow-auto rounded-card border border-borderDefault bg-surface p-1 shadow-card-hover">
                {chatModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setModel(m.id);
                      setModelOpen(false);
                    }}
                    className={`flex w-full flex-col rounded-lg px-3 py-2 text-left transition hover:bg-bgHover ${
                      model === m.id ? "bg-bgActive" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-primary">{m.name}</span>
                      <span className="text-[10px] text-tertiary">{m.credits} cr</span>
                    </div>
                    <span className="text-[11px] text-muted">{m.provider} · {m.description}</span>
                    {(m.vision || m.uncensored) && (
                      <span className="mt-1 flex gap-1.5 text-[10px] text-tertiary">
                        {m.vision && <span className="rounded bg-bgActive px-1.5 py-0.5">Vision</span>}
                        {m.uncensored && <span className="rounded bg-bgActive px-1.5 py-0.5">Uncensored</span>}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTemporary((v) => !v)}
              title="Temporary chat — not saved anywhere"
              className={`flex items-center gap-1.5 rounded-btn border px-2.5 py-1.5 text-[12px] font-medium transition ${
                temporary
                  ? "border-highlight bg-highlight text-bg"
                  : "border-borderDefault text-secondary hover:border-borderHover hover:text-primary"
              }`}
            >
              <MessageSquareOff size={14} /> Temporary
            </button>
            <div className="relative">
              <button
                onClick={() => { setPrivacyOpen((v) => !v); setModelOpen(false); setSettingsOpen(false); }}
                className={`flex items-center gap-1.5 rounded-btn border px-2.5 py-1.5 text-[12px] font-medium transition ${
                  privacyMode !== "private"
                    ? "border-highlight bg-highlight text-bg"
                    : "border-borderDefault text-secondary hover:border-borderHover hover:text-primary"
                }`}
              >
                {privacyMode === "anonymous" && <EyeOff size={14} />}
                {privacyMode === "private" && <ShieldCheck size={14} />}
                {privacyMode === "tee" && <Lock size={14} />}
                {privacyMode === "e2ee" && <ShieldClose size={14} />}
                {privacyMode.charAt(0).toUpperCase() + privacyMode.slice(1)}
                <ChevronDown size={12} className="text-muted" />
              </button>
              {privacyOpen && (
                <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-card border border-borderDefault bg-surface p-1.5 shadow-card-hover">
                  {(["anonymous", "private", "tee", "e2ee"] as PrivacyMode[]).map((m) => {
                    const labels: Record<PrivacyMode, { icon: any; desc: string }> = {
                      anonymous: { icon: EyeOff, desc: "Frontier models. Identity hidden. Provider may retain." },
                      private: { icon: ShieldCheck, desc: "Zero-retention by contract. Default." },
                      tee: { icon: Lock, desc: "Hardware-isolated GPU enclave (Phala), attested." },
                      e2ee: { icon: ShieldClose, desc: "Encrypted on your device to the attested enclave. Our server only relays ciphertext." },
                    };
                    const info = labels[m];
                    const Icon = info.icon;
                    const status = m === "tee" || m === "e2ee" ? teeStatus[m] : undefined;
                    // Fail-closed: TEE modes are only selectable once attestation is verified.
                    const disabled = (m === "tee" || m === "e2ee") && !status?.verified;
                    return (
                      <button
                        key={m}
                        onClick={() => {
                          if (disabled) return;
                          setPrivacyMode(m);
                          setPrivacyOpen(false);
                        }}
                        disabled={disabled}
                        className={`flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left transition ${
                          privacyMode === m ? "bg-bgActive" : "hover:bg-bgHover"
                        } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                      >
                        <Icon size={15} className={`mt-0.5 shrink-0 ${m === privacyMode ? "text-primary" : "text-tertiary"}`} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-[13px] font-medium text-primary capitalize">
                            {m}
                            {(m === "tee" || m === "e2ee") &&
                              (status?.verified ? (
                                <span className="flex items-center gap-0.5 rounded bg-bgActive px-1 py-0.5 text-[9px] font-normal text-highlight">
                                  <ShieldCheck size={9} /> attested
                                </span>
                              ) : (
                                <span className="flex items-center gap-0.5 rounded bg-bgActive px-1 py-0.5 text-[9px] font-normal text-tertiary">
                                  <ShieldAlert size={9} /> unavailable
                                </span>
                              ))}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-tight text-muted">
                            {(m === "tee" || m === "e2ee") && status && !status.verified && status.reason
                              ? status.reason
                              : info.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => setSettingsOpen((v) => !v)}
                className="grid h-8 w-8 place-items-center rounded-btn border border-borderDefault text-secondary hover:border-borderHover hover:text-primary"
              >
                <Settings2 size={15} />
              </button>
              {settingsOpen && (
                <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-card border border-borderDefault bg-surface p-4 shadow-card-hover">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-primary">Model settings</p>
                    <button onClick={() => setSettingsOpen(false)} className="text-muted hover:text-primary">
                      <X size={15} />
                    </button>
                  </div>
                  <label className="label">Temperature: {temperature.toFixed(2)}</label>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.05}
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className="w-full accent-highlight"
                  />
                  <label className="label mt-3">System prompt</label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={3}
                    placeholder="You are a helpful assistant…"
                    className="input min-h-[70px] resize-y py-2"
                  />
                  <label className="label mt-3">Voice (TTS)</label>
                  <select className="input" value={voice} onChange={(e) => setVoice(e.target.value)}>
                    {VOICES.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  <button onClick={() => setSettingsOpen(false)} className="btn-primary mt-4 w-full">Apply</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-auto">
          <div className="mx-auto max-w-3xl px-4 py-6">
            {temporary && (
              <div className="mb-4 flex items-center justify-center gap-2 rounded-btn border border-borderDefault bg-surface px-3 py-2 text-[12px] text-muted">
                <MessageSquareOff size={13} /> Temporary chat — this conversation will not be saved.
              </div>
            )}
            {!temporary && privacyMode !== "private" && (
              <div className="mb-4 flex items-center justify-center gap-2 rounded-btn border border-borderDefault bg-surface px-3 py-2 text-[12px] text-muted">
                {privacyMode === "anonymous" && <><EyeOff size={13} /> Anonymous mode — provider may retain prompts.</>}
                {privacyMode === "tee" && <><Lock size={13} /> TEE mode — attested hardware enclave; GPU host cannot read prompts.</>}
                {privacyMode === "e2ee" && <><ShieldClose size={13} /> E2EE mode — sealed on your device to the attested enclave (secp256k1); our server only relays ciphertext.</>}
              </div>
            )}
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-28 text-center">
                <h2 className="text-3xl font-medium text-primary">How can I help?</h2>
              </div>
            ) : (
              <div className="space-y-7">
                {messages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className="flex flex-col items-end gap-2">
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="flex flex-wrap justify-end gap-2">
                          {m.attachments.map((a, i) =>
                            a.kind === "image" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={i} src={a.url} alt="attachment" className="h-28 w-28 rounded-2xl border border-borderDefault object-cover" />
                            ) : (
                              <div key={i} className="flex items-center gap-2 rounded-xl border border-borderDefault bg-surface px-3 py-2 text-[12px] text-secondary">
                                <FileText size={15} className="text-tertiary" />
                                <span className="max-w-[160px] truncate">{a.name}</span>
                              </div>
                            )
                          )}
                        </div>
                      )}
                      {m.content && (
                        <div className="max-w-[80%] whitespace-pre-wrap rounded-3xl bg-bgActive px-4 py-2.5 text-[15px] leading-7 text-primary">
                          {m.content}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div key={m.id} className="group">
                      <div className="min-w-0 flex-1">
                        {m.content ? (
                          <Markdown content={m.content} />
                        ) : streaming ? (
                          <span className="inline-block h-4 w-4 animate-pulse rounded-full bg-borderHover" />
                        ) : null}
                        {m.content && (
                          <div className="mt-1.5 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                            <button
                              onClick={() => copyMsg(m)}
                              title="Copy"
                              className="grid h-7 w-7 place-items-center rounded-btn text-tertiary transition hover:bg-bgHover hover:text-primary"
                            >
                              {copiedId === m.id ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                            <button
                              onClick={() => speak(m)}
                              title="Read aloud"
                              className="grid h-7 w-7 place-items-center rounded-btn text-tertiary transition hover:bg-bgHover hover:text-primary"
                            >
                              <Volume2 size={14} className={playingId === m.id ? "text-highlight" : ""} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 px-4 pb-4">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-3xl border border-borderDefault bg-surface px-2.5 py-2 transition focus-within:border-borderHover">
              {(attachments.length > 0 || documents.length > 0 || uploading) && (
                <div className="flex flex-wrap gap-2 px-1 pb-2 pt-1">
                  {attachments.map((a, i) => (
                    <div key={`img-${i}`} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a} alt="preview" className="h-16 w-16 rounded-xl border border-borderDefault object-cover" />
                      <button
                        onClick={() => setAttachments((arr) => arr.filter((_, j) => j !== i))}
                        className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-bg text-muted hover:text-danger"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {documents.map((d, i) => (
                    <div key={`doc-${i}`} className="relative flex items-center gap-2 rounded-xl border border-borderDefault bg-bg px-3 py-2 text-[12px] text-secondary">
                      <FileText size={15} className="text-tertiary" />
                      <div className="min-w-0">
                        <p className="max-w-[140px] truncate text-primary">{d.name}</p>
                        <p className="text-[10px] text-tertiary">{(d.chars / 1000).toFixed(1)}k chars</p>
                      </div>
                      <button onClick={() => setDocuments((arr) => arr.filter((_, j) => j !== i))} className="text-muted hover:text-danger">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  {uploading && (
                    <div className="flex items-center gap-2 rounded-xl border border-borderDefault bg-bg px-3 py-2 text-[12px] text-muted">
                      <Loader2 size={14} className="animate-spin" /> Reading…
                    </div>
                  )}
                </div>
              )}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder={recording ? "Listening..." : "Message KRX..."}
                className="max-h-44 min-h-[28px] w-full resize-none bg-transparent px-2 py-2 text-[15px] text-primary outline-none placeholder:text-tertiary"
              />
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,.pdf,.docx,.txt,.md,.markdown,.csv,.json,.js,.ts,.tsx,.py,.html,.css,text/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      onFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    title="Attach image or document (PDF, DOCX, TXT…)"
                    className="grid h-8 w-8 place-items-center rounded-full text-secondary transition hover:bg-bgHover hover:text-primary"
                  >
                    <Paperclip size={18} />
                  </button>
                  <button
                    onClick={toggleRecord}
                    title="Dictate"
                    disabled={transcribing}
                    className={`grid h-8 w-8 place-items-center rounded-full transition ${
                      recording ? "bg-danger text-white" : "text-secondary hover:bg-bgHover hover:text-primary"
                    }`}
                  >
                    {transcribing ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
                  </button>
                </div>
                {streaming ? (
                  <button
                    onClick={stop}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-borderDefault bg-surface text-primary transition hover:border-borderHover"
                    aria-label="Stop"
                  >
                    <Square size={14} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    onClick={send}
                    disabled={!input.trim() && attachments.length === 0 && documents.length === 0}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-highlight text-bg transition hover:opacity-90 disabled:opacity-30"
                  >
                    <ArrowUp size={18} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-center text-[11px] text-tertiary">
              {activeModel?.name} · {storageMode === "local" ? "Private - stored on your device" : "Encrypted sync"} · KRX can make mistakes.
            </p>
          </div>
        </div>
      </div>

      {unlockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setUnlockOpen(false)}>
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-card border border-borderDefault bg-surface p-6" onClick={(e) => e.stopPropagation()}>
            <p className="flex items-center gap-2 text-h2 text-primary">
              <Lock size={16} /> Unlock encryption
            </p>
            <p className="mb-4 mt-1 text-xs text-muted">Enter your passphrase to read and write encrypted synced conversations.</p>
            <input
              type="password"
              className="input"
              value={unlockPass}
              autoFocus
              onChange={(e) => setUnlockPass(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doUnlock()}
              placeholder="Passphrase"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setUnlockOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={doUnlock} className="btn-primary">Unlock</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
