# HTPS.io

Private, uncensored, multi-model generative AI. A privacy-first alternative to mainstream AI apps: chat with many models, generate and edit images, use your voice, and attach documents — with conversations that stay on your device by default.

## Highlights

- **Multi-model chat** — Llama, Claude, DeepSeek, GPT, Qwen, Gemini and uncensored models via OpenRouter, with streaming and markdown.
- **Privacy-first**
  - **Local-first storage**: conversations live in your browser (IndexedDB) by default — the server never stores them.
  - **Zero-retention inference**: prompts are processed and discarded; routing prefers providers that do not retain or train on data.
  - **End-to-end encrypted sync** (optional): AES-256-GCM with a passphrase only you hold; the server stores ciphertext only.
  - **Temporary chats**: not saved anywhere.
- **Vision** — attach images to vision-capable models.
- **Voice** — text-to-speech and speech-to-text.
- **Documents** — attach PDF, DOCX, TXT, CSV, code; parsed in memory for context, not persisted.
- **Image Studio** — text-to-image and image editing, stored on Cloudflare R2.
- **Characters** — custom AI personalities.
- **OpenAI-compatible API** — drop-in `/api/v1` with API keys, rate limiting and docs.
- **Billing** — Stripe subscriptions with a credits system.

## Privacy modes

Every chat picks one of four inference modes (selector in the chat header). TEE-backed
modes **fail closed**: if the enclave's attestation can't be verified, the request is
refused — we never silently downgrade to a plaintext proxy.

| Mode | Guarantee | How |
|------|-----------|-----|
| **Anonymous** | Identity hidden; provider may retain | Proxied to frontier models |
| **Private** (default) | Zero-retention by contract | OpenRouter with `data_collection: deny`; nothing stored |
| **TEE** | GPU host cannot read prompts | Server relays to an *attested* Phala enclave (verified before sending) |
| **E2EE** | Our server never sees the prompt, even in transit | Browser connects **directly** to the attested enclave; server only mints the session after verifying attestation |

- **Attestation** (`src/lib/attestation.ts`): fetches the enclave's TDX/SGX quote and
  verifies it through an attestation verifier before any prompt is sent. Cached briefly,
  fails closed. Status is surfaced in the UI (`GET /api/attestation`).
- **E2EE envelope** (`src/lib/e2e.ts` → `sealToEnclave`): ephemeral ECDH (P-256) + AES-256-GCM
  to the enclave's attested public key.
- **Local-first storage**: conversations live in your browser (IndexedDB) by default.
- **Encrypted sync** (optional): AES-256-GCM with a passphrase only you hold; server stores ciphertext only.

Set `PHALA_TEE_API_KEY` / `PHALA_E2EE_API_KEY` (+ endpoints) to enable TEE/E2EE. Without
them, those modes are disabled in the UI. `TEE_ATTESTATION_DISABLED=true` is a dev-only escape hatch.

## Tech stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS (dark/light via `prefers-color-scheme`)
- Prisma + PostgreSQL
- OpenRouter (chat/image), OpenAI (voice)
- Cloudflare R2 (image storage) + Turnstile (bot protection)
- Stripe (billing)

## Getting started

```bash
npm install
cp .env.example .env   # fill in your keys
npx prisma db push
npm run dev            # http://localhost:3012
```

## Environment

See `.env.example` for all variables. Core: `DATABASE_URL`, `OPENROUTER_API_KEY`. Optional but recommended: `OPENAI_API_KEY` (voice), Cloudflare `R2_*` (image storage), `TURNSTILE_*` (bot protection), `STRIPE_*` (billing), Google OAuth.

## Scripts

- `npm run dev` — dev server on port 3012
- `npm run build` / `npm start`
- `npm run typecheck` / `npm run lint`
- `npm run db:push` / `npm run db:studio` / `npm run db:seed`

## License

Proprietary. All rights reserved.
