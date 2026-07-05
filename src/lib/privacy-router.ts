export type PrivacyMode = "anonymous" | "private" | "tee" | "e2ee";

export const DEFAULT_MODE: PrivacyMode = "private";

const MODE_CONFIG: Record<
  PrivacyMode,
  {
    label: string;
    description: string;
    endpoint: string | null;
    phalaOnly?: boolean;
  }
> = {
  anonymous: {
    label: "Anonymous",
    description: "Proxy to frontier providers. Identity hidden, but provider may retain.",
    endpoint: null, // uses OpenRouter (default)
  },
  private: {
    label: "Private",
    description: "Zero-retention by contract. No prompt or response stored.",
    endpoint: null, // uses OpenRouter with data_collection: deny
  },
  tee: {
    label: "TEE",
    description: "Hardware-isolated enclave (Phala). GPU host cannot see prompts.",
    // Phala Confidential AI — OpenAI-compatible, served through attested gateway
    endpoint: process.env.PHALA_TEE_ENDPOINT || "https://inference.phala.com/v1",
    phalaOnly: true,
  },
  e2ee: {
    label: "E2EE",
    description: "Encrypted on device; only decrypted inside a verified TEE.",
    // Same Phala TEE endpoint — E2EE = client encrypt + TEE decrypt
    endpoint: process.env.PHALA_E2EE_ENDPOINT || "https://inference.phala.com/v1",
    phalaOnly: true,
  },
};

export function modeConfig(mode: PrivacyMode) {
  return MODE_CONFIG[mode] || MODE_CONFIG.private;
}

export function isTeeOrE2ee(mode: PrivacyMode) {
  return mode === "tee" || mode === "e2ee";
}

export function requiresPhalaKey(mode: PrivacyMode) {
  return Boolean(MODE_CONFIG[mode]?.phalaOnly);
}

export function hasTeeProvider() {
  return Boolean(process.env.PHALA_TEE_API_KEY || process.env.PHALA_E2EE_API_KEY);
}

export function preferredModels(): string[] {
  // Models known to work well on Phala TEE (available via their API)
  // Keep OpenRouter models for Anonymous/Private.
  // For TEE/E2EE, the server will validate against Phala's model list.
  return ["deepseek/deepseek-chat", "meta-llama/llama-3.3-70b-instruct", "qwen/qwen-2.5-72b-instruct"];
}

export function endpoints(): Record<PrivacyMode, { baseUrl: string; apiKey: string } | null> {
  return {
    anonymous: null,
    private: null,
    tee: hasTeeProvider()
      ? {
          baseUrl: MODE_CONFIG.tee.endpoint!,
          apiKey: (process.env.PHALA_TEE_API_KEY || process.env.PHALA_E2EE_API_KEY)!,
        }
      : null,
    e2ee: hasTeeProvider()
      ? {
          baseUrl: MODE_CONFIG.e2ee.endpoint!,
          apiKey: (process.env.PHALA_E2EE_API_KEY || process.env.PHALA_TEE_API_KEY)!,
        }
      : null,
  };
}
