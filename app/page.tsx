"use client";

import { useState } from "react";
import {
  type CreateResult,
  type DraftTicket,
  type ExtractionResult,
  PRIORITY_LABELS,
} from "@/lib/types";

type Step = "input" | "preview" | "creating" | "done";

function newTicketId() {
  return crypto.randomUUID();
}

function toDraftTickets(
  extraction: ExtractionResult
): DraftTicket[] {
  return extraction.tickets.map((t) => ({
    ...t,
    id: newTicketId(),
    approved: true,
  }));
}

export default function Home() {
  const [step, setStep] = useState<Step>("input");
  const [brainDump, setBrainDump] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [decisions, setDecisions] = useState<string[]>([]);
  const [tickets, setTickets] = useState<DraftTicket[]>([]);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  async function handleExtract() {
    setError(null);
    setIsExtracting(true);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brainDump }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");

      const extraction = data as ExtractionResult;
      setMeetingTitle(extraction.meetingTitle);
      setSummary(extraction.summary);
      setDecisions(extraction.decisions);
      setTickets(toDraftTickets(extraction));
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleCreate() {
    const approved = tickets.filter((t) => t.approved);
    if (approved.length === 0) {
      setError("Select at least one ticket to create");
      return;
    }

    setError(null);
    setStep("creating");

    try {
      const res = await fetch("/api/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingTitle,
          summary,
          decisions,
          tickets: approved.map(
            ({ title, description, priority, priorityReasoning, labels }) => ({
              title,
              description,
              priority,
              priorityReasoning,
              labels,
            })
          ),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Creation failed");

      setResult(data as CreateResult);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStep("preview");
    }
  }

  function updateTicket(id: string, patch: Partial<DraftTicket>) {
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  }

  function removeTicket(id: string) {
    setTickets((prev) => prev.filter((t) => t.id !== id));
  }

  function addTicket() {
    setTickets((prev) => [
      ...prev,
      {
        id: newTicketId(),
        title: "",
        description: "",
        priority: "medium",
        priorityReasoning: "",
        labels: [],
        approved: true,
      },
    ]);
  }

  function reset() {
    setStep("input");
    setBrainDump("");
    setMeetingTitle("");
    setSummary("");
    setDecisions([]);
    setTickets([]);
    setResult(null);
    setError(null);
  }

  const approvedCount = tickets.filter((t) => t.approved).length;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <header className="mb-10">
          <p className="text-sm font-medium uppercase tracking-widest text-violet-400">
            Brain dump → tickets
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Turn messy notes into Linear tickets
          </h1>
          <p className="mt-3 text-zinc-400">
            Paste a meeting transcript, voice memo, or rambling notes. Review
            the extracted action items, then create real Linear tickets and a
            Notion summary.
          </p>
        </header>

        <StepIndicator current={step} />

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {step === "input" && (
          <section className="space-y-4">
            <textarea
              value={brainDump}
              onChange={(e) => setBrainDump(e.target.value)}
              placeholder={`Paste your brain dump here…

Example:
"ok so standup was weird today, sarah mentioned the auth bug is blocking QA, john needs to write up the API spec by friday ASAP, we decided to ship v2 without the dashboard redesign, someone should schedule a retro..."`}
              rows={14}
              className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <button
              onClick={handleExtract}
              disabled={brainDump.trim().length < 10 || isExtracting}
              className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isExtracting ? "Extracting action items…" : "Extract action items"}
            </button>
          </section>
        )}

        {step === "preview" && (
          <section className="space-y-8">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Meeting title
              </label>
              <input
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Notion summary preview
              </label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={6}
                className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm leading-relaxed focus:border-violet-500 focus:outline-none"
              />
            </div>

            {decisions.length > 0 && (
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Key decisions
                </label>
                <ul className="space-y-1 text-sm text-zinc-300">
                  {decisions.map((d, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-zinc-600">•</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
                  Tickets ({approvedCount} selected)
                </h2>
                <button
                  onClick={addTicket}
                  className="text-sm text-violet-400 hover:text-violet-300"
                >
                  + Add ticket
                </button>
              </div>

              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onChange={(patch) => updateTicket(ticket.id, patch)}
                    onRemove={() => removeTicket(ticket.id)}
                  />
                ))}
                {tickets.length === 0 && (
                  <p className="text-sm text-zinc-500">
                    No action items extracted. Add one manually or go back.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep("input")}
                className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-900"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={approvedCount === 0 || !meetingTitle.trim()}
                className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Create {approvedCount} Linear ticket
                {approvedCount !== 1 ? "s" : ""} + Notion doc
              </button>
            </div>
          </section>
        )}

        {step === "creating" && (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            <p className="text-zinc-400">
              Creating Linear tickets and Notion summary…
            </p>
          </div>
        )}

        {step === "done" && result && (
          <section className="space-y-6">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4">
              <p className="font-medium text-emerald-300">
                Done — {result.linearTickets.length} ticket
                {result.linearTickets.length !== 1 ? "s" : ""} created
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
                Linear tickets
              </h2>
              <ul className="space-y-2">
                {result.linearTickets.map((t) => (
                  <li key={t.id}>
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-violet-400 hover:text-violet-300"
                    >
                      {t.identifier}: {t.title} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
                Notion summary
              </h2>
              <a
                href={result.notionPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-violet-400 hover:text-violet-300"
              >
                Open Notion page ↗
              </a>
            </div>

            <button
              onClick={reset}
              className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-900"
            >
              Process another brain dump
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "input", label: "Paste" },
    { key: "preview", label: "Review" },
    { key: "creating", label: "Create" },
    { key: "done", label: "Done" },
  ];

  const currentIdx = steps.findIndex((s) => s.key === current);

  return (
    <ol className="mb-8 flex gap-2">
      {steps.map((s, i) => (
        <li
          key={s.key}
          className={`flex-1 rounded-md px-3 py-1.5 text-center text-xs font-medium ${
            i <= currentIdx
              ? "bg-violet-600/20 text-violet-300"
              : "bg-zinc-900 text-zinc-600"
          }`}
        >
          {s.label}
        </li>
      ))}
    </ol>
  );
}

function TicketCard({
  ticket,
  onChange,
  onRemove,
}: {
  ticket: DraftTicket;
  onChange: (patch: Partial<DraftTicket>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`rounded-xl border p-4 transition ${
        ticket.approved
          ? "border-zinc-700 bg-zinc-900"
          : "border-zinc-800 bg-zinc-900/50 opacity-60"
      }`}
    >
      <div className="mb-3 flex items-start gap-3">
        <input
          type="checkbox"
          checked={ticket.approved}
          onChange={(e) => onChange({ approved: e.target.checked })}
          className="mt-1 accent-violet-500"
        />
        <input
          value={ticket.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Ticket title"
          className="flex-1 bg-transparent text-sm font-medium focus:outline-none"
        />
        <select
          value={ticket.priority}
          onChange={(e) =>
            onChange({ priority: e.target.value as DraftTicket["priority"] })
          }
          className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs"
        >
          {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
        <button
          onClick={onRemove}
          className="text-xs text-zinc-500 hover:text-red-400"
          title="Remove"
        >
          ✕
        </button>
      </div>
      {ticket.priorityReasoning && (
        <p className="mb-2 pl-7 text-xs italic text-zinc-500">
          Why {PRIORITY_LABELS[ticket.priority].toLowerCase()}:{" "}
          {ticket.priorityReasoning}
        </p>
      )}
      <textarea
        value={ticket.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Description"
        rows={3}
        className="w-full resize-y bg-transparent pl-7 text-sm leading-relaxed text-zinc-400 focus:outline-none"
      />
    </div>
  );
}
