import Link from "next/link";

const appName = "KRX";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3012";

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-auto rounded-btn border border-borderDefault bg-surface p-4 text-[12px] leading-relaxed text-silver">
      {children}
    </pre>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-bg text-silver">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={appName} className="brand-logo h-8 w-8 rounded-btn" />
          <span className="text-[15px] font-semibold text-grad-light">{appName} API</span>
        </Link>
        <Link href="/keys" className="btn-secondary">Get API key</Link>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-24">
        <h1 className="text-3xl font-semibold text-grad-light">API Reference</h1>
        <p className="mt-2 text-sm text-muted">
          {appName} exposes an OpenAI-compatible API. Point any OpenAI SDK at our base URL and use your{" "}
          <Link href="/keys" className="text-primary underline">API key</Link>.
        </p>

        <section className="mt-8">
          <h2 className="text-h2 text-primary">Base URL</h2>
          <Code>{`${appUrl}/api/v1`}</Code>
          <p className="mt-2 text-[12px] text-muted">Rate limit: 60 requests/minute per key (burst 60).</p>
        </section>

        <section className="mt-8">
          <h2 className="text-h2 text-primary">Authentication</h2>
          <Code>{`Authorization: Bearer nb-your-key`}</Code>
        </section>

        <section className="mt-8">
          <h2 className="text-h2 text-primary">Chat completions</h2>
          <Code>{`curl ${appUrl}/api/v1/chat/completions \\
  -H "Authorization: Bearer nb-..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "meta-llama/llama-3.3-70b-instruct",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'`}</Code>
        </section>

        <section className="mt-8">
          <h2 className="text-h2 text-primary">Python (OpenAI SDK)</h2>
          <Code>{`from openai import OpenAI

client = OpenAI(
    base_url="${appUrl}/api/v1",
    api_key="nb-...",
)

resp = client.chat.completions.create(
    model="anthropic/claude-3.5-sonnet",
    messages=[{"role": "user", "content": "Write a haiku"}],
)
print(resp.choices[0].message.content)`}</Code>
        </section>

        <section className="mt-8">
          <h2 className="text-h2 text-primary">Image generation</h2>
          <Code>{`curl ${appUrl}/api/v1/images/generations \\
  -H "Authorization: Bearer nb-..." \\
  -H "Content-Type: application/json" \\
  -d '{"model": "google/gemini-2.5-flash-image", "prompt": "a red panda"}'`}</Code>
        </section>

        <section className="mt-8">
          <h2 className="text-h2 text-primary">List models</h2>
          <Code>{`curl ${appUrl}/api/v1/models -H "Authorization: Bearer nb-..."`}</Code>
        </section>

        <section className="mt-8">
          <h2 className="text-h2 text-primary">OpenCode provider</h2>
          <p className="mb-3 text-[12px] text-muted">
            Add KRX as an OpenAI-compatible provider in <code>opencode.json</code>. Keep the key in an environment variable.
          </p>
          <Code>{`{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "krx": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "KRX",
      "options": {
        "baseURL": "${appUrl}/api/v1",
        "apiKey": "{env:KRX_API_KEY}"
      },
      "models": {
        "meta-llama/llama-3.3-70b-instruct": {
          "name": "Llama 3.3 70B",
          "limit": { "context": 131072, "output": 8192 }
        }
      }
    }
  }
}`}</Code>
        </section>

        <section className="mt-8">
          <h2 className="text-h2 text-primary">OpenCode MCP (local)</h2>
          <p className="mb-3 text-[12px] text-muted">
            From this repository, run the MCP server over stdio. Its chat, image and speech tools use the same API key and credits.
          </p>
          <Code>{`{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "krx": {
      "type": "local",
      "command": ["npm", "run", "mcp"],
      "environment": {
        "KRX_API_KEY": "{env:KRX_API_KEY}",
        "KRX_BASE_URL": "${appUrl}"
      },
      "enabled": true,
      "timeout": 10000
    }
  }
}`}</Code>
        </section>

        <section className="mt-8">
          <h2 className="text-h2 text-primary">OpenCode MCP (remote)</h2>
          <p className="mb-3 text-[12px] text-muted">No local process is required. OpenCode connects to the hosted Streamable HTTP endpoint.</p>
          <Code>{`{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "krx": {
      "type": "remote",
      "url": "${appUrl}/api/mcp",
      "oauth": false,
      "headers": {
        "Authorization": "Bearer {env:KRX_API_KEY}"
      },
      "enabled": true,
      "timeout": 10000
    }
  }
}`}</Code>
        </section>

        <section className="mt-8">
          <h2 className="text-h2 text-primary">Text to speech</h2>
          <Code>{`curl ${appUrl}/api/v1/audio/speech \\
  -H "Authorization: Bearer nb-..." \\
  -H "Content-Type: application/json" \\
  -d '{"input":"Hello from KRX","voice":"alloy"}' \\
  --output speech.mp3`}</Code>
        </section>

        <section className="mt-8">
          <h2 className="text-h2 text-primary">Embeddings</h2>
          <Code>{`curl ${appUrl}/api/v1/embeddings \\
  -H "Authorization: Bearer nb-..." \\
  -H "Content-Type: application/json" \\
  -d '{"model":"openai/text-embedding-3-small","input":["first document","second document"]}'`}</Code>
        </section>

        <section className="mt-8">
          <h2 className="text-h2 text-primary">Audio transcription</h2>
          <Code>{`curl ${appUrl}/api/v1/audio/transcriptions \\
  -H "Authorization: Bearer nb-..." \\
  -F "file=@audio.mp3" \\
  -F "model=openai/gpt-4o-mini-transcribe"`}</Code>
        </section>

        <section className="mt-8">
          <h2 className="text-h2 text-primary">Asynchronous media jobs</h2>
          <p className="mb-3 text-[12px] text-muted">Video, music, upscale and inpainting return HTTP 202. Use the Location header or returned job ID to read progress or cancel.</p>
          <Code>{`curl ${appUrl}/api/v1/generations \\
  -H "Authorization: Bearer nb-..." \\
  -H "Idempotency-Key: your-unique-request-id" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model":"fal-ai/your-video-model",
    "operation":"text-to-video",
    "input":{"prompt":"a cinematic ocean at sunrise"}
  }'

curl ${appUrl}/api/v1/generations/JOB_ID \\
  -H "Authorization: Bearer nb-..."`}</Code>
        </section>
      </main>
    </div>
  );
}
