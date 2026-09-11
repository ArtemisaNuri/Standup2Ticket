# Sift

Turns messy meeting transcripts into structured, reviewed tickets — created directly in Linear, with a summary written to Notion.

## What it does

Meeting notes, standups, and Slack threads are usually where real work gets lost: action items are buried, ownership is unclear, and half of it never makes it into a tracker. Sift takes that raw, unstructured text and:

1. Extracts candidate tasks using an LLM with a strict output schema (title, description, priority, owner, confidence)
2. Surfaces them in an editable review UI — nothing is created until a human approves it
3. On approval, creates the corresponding issues in Linear and a linked summary page in Notion, via their MCP servers

The goal isn't just "AI writes text" — it's a full pipeline from unstructured input to real, tracked work, with a human checkpoint before anything touches production systems.

## Why it's built this way

- **Structured output over free text.** The extraction step forces the model into a typed schema (via Zod), so downstream steps can rely on the shape of the data instead of parsing prose.
- **Human-in-the-loop by design.** The agent proposes; a person approves or edits before anything is written to Linear/Notion. This is deliberate — it's the difference between an assistant and an unsupervised agent acting on production systems.
- **MCP instead of custom integrations.** Linear and Notion are both called through their MCP servers rather than bespoke API wrappers. Same protocol, same tool-calling pattern — reusable for any other MCP-compatible tool later.
- **Ambiguity is preserved, not hidden.** Vague ownership, unclear scope, or low-confidence extractions are flagged rather than silently guessed at.

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js (App Router) |
| Agent / LLM orchestration | Vercel AI SDK (`generateObject`, `streamText`) |
| Tool execution | MCP (Linear MCP server, Notion MCP server) |
| Validation | Zod |
| Storage | Postgres / Vercel KV (run history) |

## Extraction schema

```ts
const Ticket = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(["urgent", "high", "medium", "low"]),
  priority_reasoning: z.string(), // forces justification, catches bad guesses
  owner: z.string().nullable(),   // null when not stated — never invented
  needs_clarification: z.boolean(),
  is_duplicate_of_known_issue: z.boolean(),
});
```

## Flow

```
Raw transcript
   → generateObject() extracts candidate tickets (Zod-validated)
   → Review UI: edit / merge / discard, before anything is sent anywhere
   → On approve: MCP tool calls
        - Linear MCP  → create issue per ticket
        - Notion MCP  → create linked summary page
   → Run persisted to history (input, output, what was created, links)
```



## Possible next steps

- Detect duplicate/recurring items against existing open Linear issues, not just within a single transcript
- Add retry/partial-failure handling when one MCP call succeeds and another fails
- Multi-transcript history view with search
