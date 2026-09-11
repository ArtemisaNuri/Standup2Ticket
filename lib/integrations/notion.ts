import { Client } from "@notionhq/client";
import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";
import { getNotionConfig } from "@/lib/env";
import type { CreatedTicket, DraftTicket } from "@/lib/types";

function getClient() {
  return new Client({ auth: getNotionConfig().apiKey });
}

function richText(content: string) {
  return [{ type: "text" as const, text: { content: content.slice(0, 2000) } }];
}

function markdownToBlocks(text: string): BlockObjectRequest[] {
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  return paragraphs.map((p) => ({
    object: "block" as const,
    type: "paragraph" as const,
    paragraph: { rich_text: richText(p.replace(/\n/g, " ")) },
  }));
}

function ticketBlocks(tickets: CreatedTicket[]): BlockObjectRequest[] {
  return tickets.flatMap((t) => [
    {
      object: "block" as const,
      type: "bulleted_list_item" as const,
      bulleted_list_item: {
        rich_text: richText(`${t.identifier}: ${t.title}`),
      },
    },
    {
      object: "block" as const,
      type: "paragraph" as const,
      paragraph: {
        rich_text: [
          {
            type: "text" as const,
            text: { content: "→ " },
          },
          {
            type: "text" as const,
            text: { content: t.url, link: { url: t.url } },
          },
        ],
      },
    },
  ]);
}

export async function createNotionSummary(params: {
  meetingTitle: string;
  summary: string;
  decisions: string[];
  draftTickets: DraftTicket[];
  createdTickets: CreatedTicket[];
}): Promise<string> {
  const { parentPageId } = getNotionConfig();
  const notion = getClient();

  const children: BlockObjectRequest[] = [
    {
      object: "block",
      type: "heading_2",
      heading_2: { rich_text: richText("Summary") },
    },
    ...markdownToBlocks(params.summary),
  ];

  if (params.decisions.length > 0) {
    children.push({
      object: "block",
      type: "heading_2",
      heading_2: { rich_text: richText("Key Decisions") },
    });
    children.push(
      ...params.decisions.map((d) => ({
        object: "block" as const,
        type: "bulleted_list_item" as const,
        bulleted_list_item: { rich_text: richText(d) },
      }))
    );
  }

  children.push({
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: richText("Action Items (Linear)") },
  });

  if (params.createdTickets.length > 0) {
    children.push(...ticketBlocks(params.createdTickets));
  } else {
    children.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: richText("No tickets created.") },
    });
  }

  const page = await notion.pages.create({
    parent: { page_id: parentPageId },
    properties: {
      title: {
        title: richText(params.meetingTitle),
      },
    },
    children: children.slice(0, 100),
  });

  if ("url" in page && page.url) {
    return page.url;
  }

  const pageId = page.id.replace(/-/g, "");
  return `https://www.notion.so/${pageId}`;
}
