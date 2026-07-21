const MAX_REPETITION_RATIO = 0.6;
const MIN_REPETITION_LENGTH = 20;
const MAX_SPECIAL_CHAR_RATIO = 0.4;

const JAILBREAK_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?prior\s+(instructions|directions|prompts)/i,
  /you\s+(are\s+)?(now|are\s+free)\s+(to\s+)?(ignore|bypass|break|act)/i,
  /\bDAN\b/i,
  /\bjail\s*break\b/i,
  /do\s+anything\s+now/i,
  /you\s+(don'?t|do\s+not)\s+have\s+(any\s+)?(restrictions|limits|boundaries|rules)/i,
  /output\s+format\s*:\s*[a-f0-9]{6,}/i,
  /format\s*:\s*[a-f0-9]{6,}/i,
];

const SAFETY_OVERRIDE_PATTERNS: RegExp[] = [
  /sem\s+restrição/i,
  /sem\s+censura/i,
  /no\s+(filter|restrictions|limits|censorship)/i,
  /uncensored/i,
  /nsfw/i,
];

function repetitionRatio(text: string): number {
  const words = text.split(/\s+/);
  if (words.length < 4) return 0;
  const seen = new Set<string>();
  let repeats = 0;
  for (const w of words) {
    const key = w.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (key.length < 3) continue;
    if (seen.has(key)) repeats++;
    seen.add(key);
  }
  return repeats / words.length;
}

function specialCharRatio(text: string): number {
  if (text.length < 10) return 0;
  const special = (text.match(/[\\{}[\]()|`~!@#$%^&*+=:;",?<>]/g) || []).length;
  return special / text.length;
}

function longestRepeatedPhrase(text: string): number {
  const lines = text.split(/\n+/).filter((l) => l.trim().length > MIN_REPETITION_LENGTH);
  if (lines.length < 3) return 0;
  const trimmed = lines.map((l) => l.trim().toLowerCase().replace(/[^a-z0-9\s]/g, ""));
  let maxCount = 0;
  for (let i = 0; i < trimmed.length; i++) {
    if (!trimmed[i]) continue;
    let count = 1;
    for (let j = i + 1; j < trimmed.length; j++) {
      if (trimmed[j] === trimmed[i]) count++;
      else break;
    }
    maxCount = Math.max(maxCount, count);
  }
  return maxCount;
}

export interface InjectionResult {
  detected: boolean;
  reason?: string;
}

export function detectPromptInjection(text: string): InjectionResult {
  const normal = text.normalize("NFC");

  for (const p of JAILBREAK_PATTERNS) {
    if (p.test(normal)) {
      return { detected: true, reason: `Jailbreak pattern: ${p.source}` };
    }
  }

  const repeatedSafety = SAFETY_OVERRIDE_PATTERNS.filter((p) => p.test(normal)).length;
  if (repeatedSafety >= 2) {
    return { detected: true, reason: "Multiple safety override keywords" };
  }

  const repetition = repetitionRatio(normal);
  if (repetition > MAX_REPETITION_RATIO) {
    return { detected: true, reason: "Excessive word repetition" };
  }

  const special = specialCharRatio(normal);
  if (special > MAX_SPECIAL_CHAR_RATIO) {
    return { detected: true, reason: "Excessive special characters" };
  }

  const repeatedPhrases = longestRepeatedPhrase(normal);
  if (repeatedPhrases >= 3) {
    return { detected: true, reason: "Repeated phrase blocks" };
  }

  return { detected: false };
}
