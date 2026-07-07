export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  context: string;
  uncensored?: boolean;
  vision?: boolean;
  credits: number;
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
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    description: "Best-in-class writing and analysis.",
    context: "200K",
    vision: true,
    credits: 4,
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
    id: "qwen/qwen-2.5-72b-instruct",
    name: "Qwen 2.5 72B",
    provider: "Alibaba",
    description: "Multilingual powerhouse.",
    context: "128K",
    credits: 2,
  },
  {
    id: "google/gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    description: "Fast multimodal model.",
    context: "1M",
    vision: true,
    credits: 2,
  },
  {
    id: "cognitivecomputations/dolphin-mixtral-8x22b",
    name: "Dolphin Mixtral 8x22B",
    provider: "Cognitive",
    description: "Uncensored, unfiltered responses.",
    context: "16K",
    uncensored: true,
    credits: 3,
  },
  {
    id: "cognitivecomputations/dolphin3.0-mistral-24b:free",
    name: "Dolphin 3.0 Mistral 24B",
    provider: "Cognitive",
    description: "Steerable, uncensored assistant.",
    context: "32K",
    uncensored: true,
    credits: 2,
  },
  {
    id: "neversleep/llama-3.1-lumimaid-70b",
    name: "Lumimaid 70B",
    provider: "NeverSleep",
    description: "Uncensored roleplay & creative writing.",
    context: "16K",
    uncensored: true,
    credits: 4,
  },
  {
    id: "sao10k/l3.1-euryale-70b",
    name: "Euryale 70B",
    provider: "Sao10K",
    description: "Uncensored creative & narrative model.",
    context: "16K",
    uncensored: true,
    credits: 4,
  },
];

export function findChatModel(id: string) {
  return CHAT_MODELS.find((m) => m.id === id) || CHAT_MODELS[0];
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

export const IMAGE_MODELS = [
  { id: "google/gemini-2.5-flash-image", name: "Gemini 2.5 Flash Image", credits: 5 },
  { id: "google/gemini-3-pro-image", name: "Gemini 3 Pro Image", credits: 10 },
  { id: "openai/gpt-5-image-mini", name: "GPT Image Mini", credits: 8 },
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
