"use client";

// Local-first storage: conversations live in the browser (IndexedDB).
// The server never receives conversation history in this mode.

export type LocalAttachment = { kind: "image"; url: string } | { kind: "file"; name: string };
export type LocalMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: LocalAttachment[];
  model?: string;
};
export type LocalConversation = {
  id: string;
  title: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  characterId?: string;
  messages: LocalMessage[];
  createdAt: number;
  updatedAt: number;
};

const DB_NAME = "htps-local";
const STORE = "conversations";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export async function listLocalConversations(): Promise<LocalConversation[]> {
  const all = await tx<LocalConversation[]>("readonly", (s) => s.getAll());
  return (all || []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getLocalConversation(id: string): Promise<LocalConversation | undefined> {
  return tx<LocalConversation | undefined>("readonly", (s) => s.get(id));
}

export async function putLocalConversation(convo: LocalConversation): Promise<void> {
  await tx("readwrite", (s) => s.put(convo));
}

export async function deleteLocalConversation(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}

export async function clearLocalConversations(): Promise<void> {
  await tx("readwrite", (s) => s.clear());
}

export function newLocalId() {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
