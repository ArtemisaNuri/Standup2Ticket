import { z } from "zod";
import { createLinearIssues } from "@/lib/integrations/linear";
import { createNotionSummary } from "@/lib/integrations/notion";
import { draftTicketSchema, prioritySchema } from "@/lib/types";

export const runtime = "nodejs";

const bodySchema = z.object({
  meetingTitle: z.string().min(1),
  summary: z.string(),
  decisions: z.array(z.string()),
  tickets: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string(),
      priority: prioritySchema,
      priorityReasoning: z.string().default(""),
      labels: z.array(z.string()),
    })
  ),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const data = bodySchema.parse(json);

    const ticketsForCreate = data.tickets.map((t) =>
      draftTicketSchema.parse({
        ...t,
        id: crypto.randomUUID(),
        approved: true,
      })
    );

    const linearTickets = await createLinearIssues(ticketsForCreate);

    const notionPageUrl = await createNotionSummary({
      meetingTitle: data.meetingTitle,
      summary: data.summary,
      decisions: data.decisions,
      draftTickets: ticketsForCreate,
      createdTickets: linearTickets,
    });

    return Response.json({
      linearTickets,
      notionPageUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Creation failed";
    const status = err instanceof z.ZodError ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
