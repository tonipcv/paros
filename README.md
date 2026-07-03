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
