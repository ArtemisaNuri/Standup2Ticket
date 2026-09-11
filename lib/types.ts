import { z } from "zod";

export const PRIORITY_LEVELS = ["urgent", "high", "medium", "low"] as const;

export const prioritySchema = z.enum(PRIORITY_LEVELS);
export type Priority = z.infer<typeof prioritySchema>;

/**
 * Normalizes loose model output (case, common synonyms, Linear-style numbers)
 * into one of our four priority levels before validation.
 */
export const loosePrioritySchema = z.preprocess((val) => {
  if (typeof val === "number") {
    // Linear integers: 1=Urgent, 2=High, 3=Normal, 4=Low, 0=None
    return { 0: "low", 1: "urgent", 2: "high", 3: "medium", 4: "low" }[val] ?? val;
  }
  if (typeof val !== "string") return val;
  const v = val.trim().toLowerCase();
  const synonyms: Record<string, Priority> = {
    urgent: "urgent",
    critical: "urgent",
    p1: "urgent",
    high: "high",
    p2: "high",
    medium: "medium",
    normal: "medium",
    moderate: "medium",
    p3: "medium",
    low: "low",
    none: "low",
    backlog: "low",
    p0: "low",
    p4: "low",
  };
  return synonyms[v] ?? v;
}, prioritySchema);

/** Linear's IssueCreateInput.priority is an integer, not a string. */
export const PRIORITY_TO_LINEAR: Record<Priority, number> = {
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const draftTicketSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string(),
  priority: prioritySchema,
  priorityReasoning: z.string(),
  labels: z.array(z.string()),
  approved: z.boolean(),
});

export const extractionResultSchema = z.object({
  meetingTitle: z.string(),
  summary: z.string(),
  decisions: z.array(z.string()),
  tickets: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string(),
      priority: loosePrioritySchema,
      priorityReasoning: z.string().default(""),
      labels: z.array(z.string()),
    })
  ),
});

export type DraftTicket = z.infer<typeof draftTicketSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

export type CreatedTicket = {
  id: string;
  identifier: string;
  title: string;
  url: string;
};

export type CreateResult = {
  linearTickets: CreatedTicket[];
  notionPageUrl: string;
};
