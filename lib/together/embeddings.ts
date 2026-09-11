import { togetherFetch, TOGETHER_MODELS } from "./client";

type TogetherEmbeddingsResponse = {
  data: Array<{ embedding: number[] }>;
};

export async function embedText(text: string): Promise<number[]> {
  const out = await togetherFetch<TogetherEmbeddingsResponse>("/embeddings", {
    model: TOGETHER_MODELS.embed,
    input: text,
  });
  return out.data[0].embedding;
}
