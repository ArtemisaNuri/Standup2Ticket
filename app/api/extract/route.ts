import { z } from "zod";
import { extractFromBrainDump } from "@/lib/agent/extract";

export const runtime = "nodejs";

const bodySchema = z.object({
  brainDump: z.string().min(10, "Paste at least a few sentences"),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { brainDump } = bodySchema.parse(json);
    const result = await extractFromBrainDump(brainDump);
    return Response.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Extraction failed";
    const status = err instanceof z.ZodError ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
