export type Chunk = {
  id: string;
  docId: string;
  title: string;
  text: string;
};

export function chunkDocs(
  docs: { id: string; title: string; text: string }[],
  chunkSize = 350
): Chunk[] {
  const chunks: Chunk[] = [];
  for (const doc of docs) {
    const cleaned = doc.text.trim().replace(/\s+/g, " ");
    for (let i = 0; i < cleaned.length; i += chunkSize) {
      const slice = cleaned.slice(i, i + chunkSize);
      chunks.push({
        id: `${doc.id}_chunk_${Math.floor(i / chunkSize)}`,
        docId: doc.id,
        title: doc.title,
        text: slice,
      });
    }
  }
  return chunks;
}
