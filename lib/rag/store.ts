import { RAW_DOCS } from "@/lib/rag/docs";
import { chunkDocs, type Chunk } from "./chunk";
import { cosineSim } from "./vector";
import { embedText } from "../together/embeddings";

type EmbeddedChunk = Chunk & { embedding: number[] };

let MEMO: EmbeddedChunk[] | null = null;

/**
 * Build embeddings once per server cold-start.
 * For production: store embeddings in a DB instead.
 */
export async function getStore(): Promise<EmbeddedChunk[]> {
  if (MEMO) return MEMO;

  const chunks = chunkDocs(RAW_DOCS);
  const embedded: EmbeddedChunk[] = [];

  for (const c of chunks) {
    const e = await embedText(c.text);
    embedded.push({ ...c, embedding: e });
  }

  MEMO = embedded;
  return MEMO;
}

export async function retrieve(query: string, topK = 4) {
  const store = await getStore();
  const q = await embedText(query);

  const scored = store
    .map((c) => ({ c, score: cosineSim(q, c.embedding) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, topK);

  return scored;
}
