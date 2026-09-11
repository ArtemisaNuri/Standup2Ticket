import { extractionResultSchema, type ExtractionResult } from "@/lib/types";
import { togetherFetch, TOGETHER_MODELS } from "@/lib/together/client";

type ChatCompletionResponse = {
  choices: {
    message: {
      content: string;
    };
  }[];
};

const SYSTEM_PROMPT = `You are an expert project manager assistant. Given messy meeting notes, voice memo transcripts, or brain dumps, you extract structured action items and a concise summary.

Return ONLY a JSON object (no markdown, no commentary) matching this schema:
{
  "meetingTitle": "short descriptive title for the session",
  "summary": "2-4 paragraph markdown summary of what was discussed",
  "decisions": ["list of key decisions made"],
  "tickets": [
    {
      "title": "clear, actionable ticket title (verb-first)",
      "description": "markdown description with context, acceptance criteria if inferable",
      "priority": "urgent | high | medium | low",
      "priorityReasoning": "one short sentence citing the concrete signal(s) that justify the priority",
      "labels": ["optional", "label", "names"]
    }
  ]
}

PRIORITY
"priority" must be exactly one of: "urgent", "high", "medium", "low".
Weigh these signals, with IMPACT as the dominant factor and DEADLINE as a strong secondary:
- Severity / impact (dominant): production outages, security issues, data loss, customers or users blocked, or revenue at risk → "urgent".
- Blocking others: work that blocks QA, a release, or other people's tasks → "urgent" if it blocks many or a ship, otherwise "high".
- Explicit urgency words: "ASAP", "critical", "drop everything", "now" → "urgent"; "important", "soon" → "high".
- Deadline proximity: due today / tomorrow / EOD → "high", and "urgent" when combined with real impact; due this week → "high" or "medium"; no deadline → judge on impact alone.
- Low-signal language: "eventually", "when we get a chance", "nice to have", "someday", "backlog" → "low".
- Default when no urgency, deadline, or impact signals are present → "medium".
When signals conflict, let the highest-impact signal win, then use the deadline to break ties or bump an item up one level.

"priorityReasoning" must state, in one sentence, the concrete evidence from the notes that drove the level (e.g. "urgent — prod checkout is down for customers", or "low — described as 'nice to have someday'"). If you cannot cite a concrete signal, the priority is "medium".

Do NOT base priority on any of these:
- Who said it or how senior they sound — a casual mention from anyone is not lower priority than a loud demand.
- Tone, emoji, sarcasm, or politeness — "very helpful 🙃" may be sarcasm, not urgency.
- Sentence length, repetition, or how much someone vented — complaining is not the same as severity.

Rules:
- Only create tickets for concrete action items, not vague discussion points
- Merge duplicate or overlapping items
- Keep titles under 80 characters
- If no action items exist, return an empty tickets array`;

function parseJsonFromContent(content: string): unknown {
  const trimmed = content.trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [
    fenced?.[1]?.trim(),
    trimmed,
    (() => {
      const start = trimmed.indexOf("{");
      const end = trimmed.lastIndexOf("}");
      return start !== -1 && end > start
        ? trimmed.slice(start, end + 1)
        : null;
    })(),
  ].filter(Boolean) as string[];

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to parse JSON from model response");
}

async function requestExtraction(
  brainDump: string,
  retryHint?: string
): Promise<string> {
  const userContent = retryHint
    ? `${retryHint}\n\nBrain dump:\n\n${brainDump}`
    : `Extract action items and summary from this brain dump:\n\n${brainDump}`;

  const response = await togetherFetch<ChatCompletionResponse>(
    "/chat/completions",
    {
      model: TOGETHER_MODELS.extract,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    }
  );

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Model returned empty response");
  }

  return content;
}

export async function extractFromBrainDump(
  brainDump: string
): Promise<ExtractionResult> {
  const attempts = [
    undefined,
    "Your previous reply was not valid JSON. Reply with ONLY a JSON object matching the schema.",
  ] as const;

  let lastError: unknown;

  for (const retryHint of attempts) {
    try {
      const content = await requestExtraction(brainDump, retryHint);
      const parsed = parseJsonFromContent(content);
      return extractionResultSchema.parse(parsed);
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Failed to parse extraction JSON from model response");
}
