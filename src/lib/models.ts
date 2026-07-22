export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  context: string;
  uncensored?: boolean;
  vision?: boolean;
  reasoning?: boolean;
  credits: number;
  maxOutput?: number;
};

export const CHAT_MODELS: ChatModel[] = [
  {
    id: "meta-llama/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B",
    provider: "Meta",
    description: "Open-source flagship, great all-rounder.",
    context: "128K",
    credits: 1,
  },
  {
    id: "deepseek/deepseek-chat",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    description: "Strong reasoning and coding at low cost.",
    context: "64K",
    credits: 1,
  },
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    description: "Chain-of-thought reasoning. Shows thinking.",
    context: "128K",
    reasoning: true,
    credits: 2,
  },
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "Anthropic",
    description: "Best-in-class writing and analysis.",
    context: "1M",
    vision: true,
    credits: 4,
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    description: "Flagship multimodal model.",
    context: "128K",
    vision: true,
    credits: 5,
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o mini",
    provider: "OpenAI",
    description: "Fast, cheap, multimodal.",
    context: "128K",
    vision: true,
    credits: 2,
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "Google",
    description: "Fast multimodal model, 1M context.",
    context: "1M",
    vision: true,
    credits: 2,
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    description: "Advanced reasoning, 1M context.",
    context: "1M",
    vision: true,
    reasoning: true,
    credits: 5,
  },
  {
    id: "qwen/qwen-2.5-72b-instruct",
    name: "Qwen 2.5 72B",
    provider: "Alibaba",
    description: "Multilingual powerhouse.",
    context: "128K",
    credits: 2,
  },
  {
    id: "qwen/qwen3-235b-a22b",
    name: "Qwen 3 235B",
    provider: "Alibaba",
    description: "MoE reasoning with thinking traces.",
    context: "128K",
    reasoning: true,
    credits: 3,
  },
  {
    id: "meta-llama/llama-4-maverick",
    name: "Llama 4 Maverick",
    provider: "Meta",
    description: "Latest open-source with native multimodality.",
    context: "128K",
    vision: true,
    credits: 3,
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "Anthropic",
    description: "Fast, cost-effective reasoning.",
    context: "200K",
    vision: true,
    credits: 2,
  },
  {
    id: "microsoft/wizardlm-2-8x22b",
    name: "WizardLM 2 8x22B",
    provider: "Microsoft",
    description: "Powerful uncensored MoE model.",
    context: "64K",
    uncensored: true,
    credits: 3,
  },
  {
    id: "sao10k/l3.3-euryale-70b",
    name: "Euryale 70B v3.3",
    provider: "Sao10K",
    description: "Uncensored creative & narrative model.",
    context: "131K",
    uncensored: true,
    credits: 4,
  },
  {
    id: "nousresearch/hermes-4-70b",
    name: "Hermes 4 70B",
    provider: "Nous Research",
    description: "Latest uncensored, steerable model.",
    context: "131K",
    uncensored: true,
    credits: 3,
  },
  {
    id: "nousresearch/hermes-3-llama-3.1-405b",
    name: "Hermes 3 405B",
    provider: "Nous Research",
    description: "Uncensored, largest open model.",
    context: "131K",
    uncensored: true,
    credits: 6,
  },
  {
    id: "nousresearch/hermes-3-llama-3.1-70b",
    name: "Hermes 3 70B",
    provider: "Nous Research",
    description: "Uncensored, smaller/faster option.",
    context: "131K",
    uncensored: true,
    credits: 2,
  },
  {
    id: "cognitivecomputations/dolphin-vision-72b",
    name: "Dolphin Vision 72B",
    provider: "Cognitive Computations",
    description: "Uncensored multimodal (text + image).",
    context: "131K",
    uncensored: true,
    vision: true,
    credits: 4,
  },
  {
    id: "anthropic/claude-fable-5",
    name: "Claude Fable 5",
    provider: "Anthropic",
    description: "Flagship model for creative writing & reasoning.",
    context: "1M",
    vision: true,
    credits: 10,
  },
  {
    id: "anthropic/claude-sonnet-5",
    name: "Claude Sonnet 5",
    provider: "Anthropic",
    description: "Latest Sonnet — fast, high-quality reasoning.",
    context: "1M",
    vision: true,
    credits: 6,
  },
  {
    id: "anthropic/claude-opus-4.8",
    name: "Claude Opus 4.8",
    provider: "Anthropic",
    description: "Top-tier reasoning for complex tasks.",
    context: "1M",
    vision: true,
    reasoning: true,
    credits: 10,
  },
  {
    id: "google/gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    provider: "Google",
    description: "Latest fast multimodal, 1M context.",
    context: "1M",
    vision: true,
    credits: 3,
  },
  {
    id: "google/gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "Google",
    description: "Balanced speed & intelligence, 1M context.",
    context: "1M",
    vision: true,
    credits: 3,
  },
  {
    id: "google/gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    provider: "Google",
    description: "Top Google model for deep reasoning, 1M context.",
    context: "1M",
    vision: true,
    reasoning: true,
    credits: 5,
  },
  {
    id: "x-ai/grok-4.20",
    name: "Grok 4.20",
    provider: "xAI",
    description: "Massive 2M context, latest Grok generation.",
    context: "2M",
    vision: true,
    credits: 3,
  },
  {
    id: "x-ai/grok-4.20-multi-agent",
    name: "Grok 4.20 Multi-Agent",
    provider: "xAI",
    description: "Multi-agent variant with 2M context.",
    context: "2M",
    vision: true,
    credits: 4,
  },
  {
    id: "x-ai/grok-4.5",
    name: "Grok 4.5",
    provider: "xAI",
    description: "Vision-capable Grok with strong reasoning.",
    context: "500K",
    vision: true,
    credits: 4,
  },
  {
    id: "x-ai/grok-4.3",
    name: "Grok 4.3",
    provider: "xAI",
    description: "Fast, cheaper Grok with vision.",
    context: "1M",
    vision: true,
    credits: 2,
  },
  {
    id: "x-ai/grok-build-0.1",
    name: "Grok Build 0.1",
    provider: "xAI",
    description: "Code-optimized Grok variant.",
    context: "256K",
    vision: true,
    credits: 2,
  },
  {
    id: "moonshotai/kimi-k3",
    name: "Kimi K3",
    provider: "Moonshot",
    description: "Latest Kimi, strong reasoning at scale.",
    context: "1M",
    vision: true,
    credits: 4,
  },
  {
    id: "moonshotai/kimi-k2.6",
    name: "Kimi K2.6",
    provider: "Moonshot",
    description: "Cost-efficient reasoning with vision.",
    context: "256K",
    vision: true,
    credits: 2,
  },
  {
    id: "mistralai/mistral-small-2603",
    name: "Mistral Small 4",
    provider: "Mistral",
    description: "Latest efficient multimodal Mistral.",
    context: "256K",
    vision: true,
    credits: 1,
  },
  {
    id: "minimax/minimax-m3",
    name: "MiniMax M3",
    provider: "MiniMax",
    description: "1M context, strong multilingual model.",
    context: "1M",
    vision: true,
    credits: 1,
  },
  {
    id: "deepseek/deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    provider: "DeepSeek",
    description: "Blazing fast DeepSeek at minimal cost.",
    context: "1M",
    credits: 1,
  },
  {
    id: "deepseek/deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    provider: "DeepSeek",
    description: "Flagship DeepSeek, top-tier reasoning.",
    context: "1M",
    reasoning: true,
    credits: 5,
  },
  {
    id: "z-ai/glm-5.2",
    name: "GLM 5.2",
    provider: "Zhipu AI",
    description: "Latest GLM with 1M context.",
    context: "1M",
    credits: 1,
  },
  {
    id: "z-ai/glm-5v-turbo",
    name: "GLM 5V Turbo",
    provider: "Zhipu AI",
    description: "Vision-capable GLM with video understanding.",
    context: "202K",
    vision: true,
    credits: 2,
  },
  {
    id: "xiaomi/mimo-v2.5",
    name: "MiMo V2.5",
    provider: "Xiaomi",
    description: "Multimodal (text, image, audio, video) at low cost.",
    context: "1M",
    vision: true,
    credits: 1,
  },
];

export function findChatModel(id: string) {
  const found = CHAT_MODELS.find((m) => m.id === id);
  if (found) return found;
  if (!CHAT_MODELS.length) throw new Error("No chat models configured");
  return CHAT_MODELS[0];
}

// ── Per-plan resource limits (prevent cost overruns) ──

export type PlanLimits = {
  maxInputChars: number;       // hard character limit before request
  maxOutputTokens: number;     // max_tokens sent to upstream
  maxChatsPerDay: number;      // daily request cap
  maxImagesPerDay: number;     // daily image cap
  dailySpendLimitUsd: number;  // hard daily USD ceiling
  maxConcurrency: number;      // simultaneous in-flight requests
};

const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  FREE: {
    maxInputChars: 16000,
    maxOutputTokens: 2000,
    maxChatsPerDay: 30,
    maxImagesPerDay: 3,
    dailySpendLimitUsd: 0.10,
    maxConcurrency: 1,
  },
  STARTER: {
    maxInputChars: 64000,
    maxOutputTokens: 4000,
    maxChatsPerDay: 200,
    maxImagesPerDay: 15,
    dailySpendLimitUsd: 1.00,
    maxConcurrency: 2,
  },
  PRO: {
    maxInputChars: 128000,
    maxOutputTokens: 8000,
    maxChatsPerDay: 400,
    maxImagesPerDay: 30,
    dailySpendLimitUsd: 5.00,
    maxConcurrency: 4,
  },
  MAX: {
    maxInputChars: 256000,
    maxOutputTokens: 16000,
    maxChatsPerDay: 1000,
    maxImagesPerDay: 60,
    dailySpendLimitUsd: 20.00,
    maxConcurrency: 8,
  },
};

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as PlanId] || PLAN_LIMITS.FREE;
}

export type ImageStyle = { id: string; name: string; prompt: string };

export const IMAGE_STYLES: ImageStyle[] = [
  { id: "none", name: "None", prompt: "" },
  { id: "photorealistic", name: "Photorealistic", prompt: "photorealistic, ultra detailed, 8k, sharp focus" },
  { id: "cinematic", name: "Cinematic", prompt: "cinematic lighting, dramatic, film grain, anamorphic" },
  { id: "anime", name: "Anime", prompt: "anime style, vibrant colors, cel shading, studio quality" },
  { id: "digital-art", name: "Digital Art", prompt: "digital art, concept art, trending on artstation, detailed" },
  { id: "3d-render", name: "3D Render", prompt: "3d render, octane, ray tracing, physically based" },
  { id: "watercolor", name: "Watercolor", prompt: "watercolor painting, soft washes, textured paper" },
  { id: "neon", name: "Neon", prompt: "neon punk, cyberpunk, glowing lights, vaporwave" },
  { id: "minimal", name: "Minimal", prompt: "minimalist, clean, flat design, negative space" },
];

export const VOICES = [
  { id: "alloy", name: "Alloy" },
  { id: "echo", name: "Echo" },
  { id: "fable", name: "Fable" },
  { id: "onyx", name: "Onyx" },
  { id: "nova", name: "Nova" },
  { id: "shimmer", name: "Shimmer" },
];

export const CREDITS = { tts: 1, stt: 1, imageEdit: 3 };

export type ImageModel = {
  id: string;
  name: string;
  credits: number;
  uncensored?: boolean;
  provider?: "openrouter" | "fal";
};

export const IMAGE_MODELS: ImageModel[] = [
  { id: "google/gemini-2.5-flash-image", name: "Gemini 2.5 Flash Image", credits: 5, provider: "openrouter" },
  { id: "google/gemini-3-pro-image", name: "Gemini 3 Pro Image", credits: 10, provider: "openrouter" },
  { id: "openai/gpt-5-image-mini", name: "GPT Image Mini", credits: 8, provider: "openrouter" },
  { id: "black-forest-labs/flux-1.1-pro", name: "Flux 1.1 Pro", credits: 6, uncensored: true, provider: "openrouter" },
  { id: "stabilityai/stable-diffusion-3.5-large", name: "SD 3.5 Large", credits: 4, uncensored: true, provider: "openrouter" },
  { id: "fal-ai/flux/dev", name: "Flux Dev", credits: 4, uncensored: true, provider: "fal" },
  { id: "fal-ai/fast-sdxl", name: "Fast SDXL", credits: 3, uncensored: true, provider: "fal" },
];

export const YEARLY_DISCOUNT = 0.9;

export type BillingCycle = "monthly" | "yearly";
export type PlanId = "FREE" | "STARTER" | "PRO" | "MAX";
export type PlanConfig = {
  id: PlanId;
  name: string;
  price: number;
  credits: number;
  priceEnv?: string;
  priceEnvYearly?: string;
  features: string[];
};

export function formatCredits(value: number) {
  return value.toLocaleString("en-US");
}

export function formatPrice(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function annualPlanPrice(price: number) {
  return Math.round(price * 12 * YEARLY_DISCOUNT * 100) / 100;
}

export function annualMonthlyEquivalent(price: number) {
  return annualPlanPrice(price) / 12;
}

export const PLANS: PlanConfig[] = [
  { id: "FREE", name: "Free", price: 0, credits: 10, features: [`${formatCredits(10)} credits/mo`, "Base chat models", "Local storage only"] },
  { id: "STARTER", name: "Pro", price: 18, credits: 100, priceEnv: "STRIPE_PRICE_STARTER", priceEnvYearly: "STRIPE_PRICE_STARTER_YEARLY", features: [`${formatCredits(100)} credits/mo`, "All chat models", "Image generation", "API access"] },
  { id: "PRO", name: "Pro+", price: 68, credits: 500, priceEnv: "STRIPE_PRICE_PRO", priceEnvYearly: "STRIPE_PRICE_PRO_YEARLY", features: [`${formatCredits(500)} credits/mo`, "Priority inference", "Uncensored models", "Higher rate limits"] },
  { id: "MAX", name: "Max", price: 200, credits: 2500, priceEnv: "STRIPE_PRICE_MAX", priceEnvYearly: "STRIPE_PRICE_MAX_YEARLY", features: [`${formatCredits(2500)} credits/mo`, "Dedicated throughput", "Early access models", "Priority support"] },
];

export function paidPlans() {
  return PLANS.filter((plan) => plan.priceEnv);
}

export function findPlan(id: string | null | undefined) {
  return PLANS.find((plan) => plan.id === id);
}
