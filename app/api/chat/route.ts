import { z } from "zod";
import { retrieve } from "@/lib/rag/store";
import { togetherFetch, TOGETHER_MODELS } from "@/lib/together/client";

export const runtime = "nodejs";

const bodySchema = z.object({
  message: z.string().min(1),
});

type ChatCompletionResponse = {
  choices: {
    message: {
      role: string;
      content: string;
    };
  }[];
};

export async function POST(req: Request) {
  const json = await req.json();
  const { message } = bodySchema.parse(json);

  const retrieved = await retrieve(message, 4);

  const context = retrieved
    .map(
      (r, idx) =>
        `[Source ${idx + 1}] (${r.c.title} | ${r.c.id})\n${r.c.text}`
    )
    .join("\n\n");

  const systemPrompt = `You are a helpful assistant.
Answer using ONLY the provided sources.
If the sources do not contain the answer, say: "I don't have enough information in the provided documents."
When you use a source, cite it like [Source 1], [Source 2], etc.`;

  const userPrompt = `SOURCES:
${context}

USER QUESTION:
${message}`;

  const response = await togetherFetch<ChatCompletionResponse>(
    "/chat/completions",
    {
      model: TOGETHER_MODELS.chat,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }
  );

  const text = response.choices[0]?.message?.content || "";

  return Response.json({
    text,
    sources: retrieved.map((r, i) => ({
      label: `Source ${i + 1}`,
      title: r.c.title,
      chunkId: r.c.id,
      score: r.score,
      text: r.c.text,
    })),
  });
}
