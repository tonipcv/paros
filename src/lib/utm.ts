const UTM_KEY = "krx_utm";

export type UtmParams = {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
};

export function captureUtm(): UtmParams {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const utm: UtmParams = {};
  for (const key of ["source", "medium", "campaign", "term", "content"] as const) {
    const value = params.get(`utm_${key}`);
    if (value) utm[key] = value.slice(0, 200);
  }
  if (Object.keys(utm).length > 0) {
    try {
      const merged = { ...readUtm(), ...utm };
      localStorage.setItem(UTM_KEY, JSON.stringify(merged));
    } catch {
      // storage unavailable (private mode)
    }
  }
  return utm;
}

export function readUtm(): UtmParams {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(UTM_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as UtmParams;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function utmQueryString(params: UtmParams = readUtm()): string {
  const entries = Object.entries(params).filter(([, value]) => Boolean(value));
  if (entries.length === 0) return "";
  return `?${entries.map(([key, value]) => `utm_${key}=${encodeURIComponent(String(value))}`).join("&")}`;
}
