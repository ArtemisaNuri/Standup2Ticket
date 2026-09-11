import { getLinearConfig } from "@/lib/env";
import {
  PRIORITY_TO_LINEAR,
  type CreatedTicket,
  type DraftTicket,
} from "@/lib/types";

const LINEAR_API = "https://api.linear.app/graphql";

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

async function linearGraphQL<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const { apiKey } = getLinearConfig();

  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Linear API error (${res.status}): ${text}`);
  }

  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors?.length) {
    throw new Error(
      `Linear GraphQL error: ${json.errors.map((e) => e.message).join(", ")}`
    );
  }
  if (!json.data) {
    throw new Error("Linear API returned no data");
  }

  return json.data;
}

const ISSUE_CREATE = `
  mutation IssueCreate($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue {
        id
        identifier
        title
        url
      }
    }
  }
`;

export async function createLinearIssue(
  ticket: DraftTicket
): Promise<CreatedTicket> {
  const { teamId } = getLinearConfig();

  const data = await linearGraphQL<{
    issueCreate: {
      success: boolean;
      issue: CreatedTicket | null;
    };
  }>(ISSUE_CREATE, {
    input: {
      teamId,
      title: ticket.title,
      description: ticket.description,
      priority: PRIORITY_TO_LINEAR[ticket.priority],
      labelIds: [],
    },
  });

  if (!data.issueCreate.success || !data.issueCreate.issue) {
    throw new Error(`Failed to create Linear issue: ${ticket.title}`);
  }

  return data.issueCreate.issue;
}

export async function createLinearIssues(
  tickets: DraftTicket[]
): Promise<CreatedTicket[]> {
  const results: CreatedTicket[] = [];
  for (const ticket of tickets) {
    results.push(await createLinearIssue(ticket));
  }
  return results;
}
