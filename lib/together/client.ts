import { getTogetherApiKey } from "@/lib/env";

export const TOGETHER_BASE_URL = "https://api.together.xyz/v1";

/** Serverless models verified for this Together account. */
export const TOGETHER_MODELS = {
  chat: "Qwen/Qwen2.5-7B-Instruct-Turbo",
  extract: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  embed: "intfloat/multilingual-e5-large-instruct",
} as const;

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRetryAfterMs(retryAfter: string | null) {
  if (!retryAfter) return null;

  const seconds = Number(retryAfter);
  if (!Number.isNaN(seconds)) return seconds * 1000;

  const date = Date.parse(retryAfter);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());

  return null;
}

export async function togetherFetch<T>(
  path: string,
  body: Record<string, unknown>,
  opts?: { retries?: number; timeoutMs?: number }
): Promise<T> {
  const retries = opts?.retries ?? 5;
  const timeoutMs = opts?.timeoutMs ?? 30_000;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${TOGETHER_BASE_URL}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getTogetherApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.ok) {
        return (await res.json()) as T;
      }

      const txt = await res.text();
      const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"));

      if (RETRYABLE_STATUSES.has(res.status) && attempt < retries) {
        const backoffBase = retryAfterMs ?? 400 * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 200);
        await sleep(backoffBase + jitter);
        continue;
      }

      throw new Error(`Together API error (${res.status}): ${txt}`);
    } catch (err) {
      clearTimeout(timer);
      lastError = err;

      if (attempt < retries) {
        const backoff = 400 * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 200);
        await sleep(backoff + jitter);
        continue;
      }

      break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
