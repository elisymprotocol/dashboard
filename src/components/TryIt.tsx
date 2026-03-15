import { useState, useMemo } from "react";
import { nip19 } from "nostr-tools";
import { useTryIt } from "~/hooks/useTryIt";
import { useJobs } from "~/hooks/useJobs";
import { useAgents } from "~/hooks/useAgents";
import { useNetwork } from "~/hooks/useNetwork";
import { truncateKey, timeAgo, formatSol, statusColor } from "~/lib/format";
import { track } from "~/lib/analytics";
import { makeNjumpUrl } from "~/lib/nostr";
import { AgentAvatar } from "./AgentAvatar";

const CAPABILITIES = [
  "summarization",
  "translation",
  "code-review",
  "text-generation",
];

export function TryIt() {
  const [input, setInput] = useState("");
  const [capability, setCapability] = useState(CAPABILITIES[0]);
  const { state, result, error, agentPubkey, feedbackState, submit, reset, sendFeedback } = useTryIt();
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const { data: agents } = useAgents();
  const { network } = useNetwork();

  const agentPictures = useMemo(() => {
    const map = new Map<string, string>();
    if (agents) {
      for (const a of agents) {
        if (a.picture) map.set(a.pubkey, a.picture);
      }
    }
    return map;
  }, [agents]);
  const solscanBase = "https://solscan.io/tx/";
  const solscanSuffix = network === "mainnet" ? "" : "?cluster=devnet";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    track("try-it-submit", { capability });
    submit(input.trim(), capability);
  };

  return (
    <section id="try-it" className="bg-gray-50 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Left — Try it form */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Try it</h2>
            <p className="mt-1 text-sm text-gray-500">
              Your task is broadcast to the Nostr network — any online agent can pick it up
            </p>

            <div className="mt-6 h-[260px] flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden">
              {/* Capability selector strip */}
              <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/50 px-4 py-3 overflow-x-auto whitespace-nowrap">
                {CAPABILITIES.map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    disabled={state !== "idle"}
                    onClick={() => setCapability(cap)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      capability === cap
                        ? "bg-black text-white shadow-sm"
                        : "text-gray-500 hover:bg-gray-200/60 hover:text-gray-700"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {cap}
                  </button>
                ))}
              </div>

              {/* Textarea */}
              <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0">
                <textarea
                  id="input"
                  value={input}
                  onChange={(e) => {
                    const bytes = new TextEncoder().encode(e.target.value).length;
                    if (bytes <= 1024) setInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      if (state === "idle" && input.trim()) {
                        submit(input.trim(), capability);
                      }
                    }
                  }}
                  disabled={state !== "idle"}
                  placeholder="Describe what you'd like the agent to do..."
                  className="flex-1 resize-none border-0 bg-transparent px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none disabled:opacity-50"
                />

                {/* Bottom bar */}
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                  <span className="text-xs text-gray-400">
                    {input.length > 0 ? `${new TextEncoder().encode(input).length} / 1024 bytes` : "No wallet needed"}
                  </span>
                  <div className="flex gap-2">
                    {state !== "idle" && (
                      <button
                        type="button"
                        onClick={() => { reset(); setInput(""); }}
                        className="rounded-lg px-4 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={state !== "idle" || !input.trim()}
                      className="rounded-lg bg-black px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      {state === "submitting" ? (
                        "Submitting..."
                      ) : (
                        <span className="flex items-center gap-1.5">
                          Submit
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                          </svg>
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {state === "waiting" && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                    <svg className="h-4 w-4 text-amber-500 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Broadcasted to the network</p>
                    <p className="text-xs text-gray-500">Waiting for any agent to pick up your task...</p>
                  </div>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full animate-progress rounded-full bg-amber-400" />
                </div>
              </div>
            )}

            {state === "success" && result && (
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                    <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    Result received
                  </span>
                  {agentPubkey && (
                    <span className="text-sm text-gray-400">
                      from{" "}
                      <a
                        href={`https://jumble.social/users/${nip19.npubEncode(agentPubkey)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-500 hover:text-blue-600"
                      >
                        {truncateKey(agentPubkey)}
                      </a>
                    </span>
                  )}
                </div>
                <pre className="max-h-[300px] overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-gray-900 p-4 text-sm text-gray-300 font-mono">
                  {result}
                </pre>
                <div className="mt-3 flex items-center gap-3">
                  {feedbackState === "idle" && (
                    <>
                      <span className="text-xs text-gray-400">Rate this result:</span>
                      <button
                        type="button"
                        onClick={() => sendFeedback(true)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                      >
                        Good
                      </button>
                      <button
                        type="button"
                        onClick={() => sendFeedback(false)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors"
                      >
                        Poor
                      </button>
                    </>
                  )}
                  {feedbackState === "sending" && (
                    <span className="text-xs text-gray-400">Sending feedback...</span>
                  )}
                  {feedbackState === "sent" && (
                    <span className="text-xs text-emerald-600">Feedback sent — thank you!</span>
                  )}
                </div>
              </div>
            )}

            {state === "error" && error && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                {error}
              </div>
            )}
          </div>

          {/* Right — Live job feed, matches left column height */}
          <div id="jobs" className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-900">Recent Jobs</h2>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-soft-blink" />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Tasks submitted and processed by agents
            </p>

            {jobsLoading && (
              <div className="mt-6 h-[260px] space-y-px rounded-xl border border-gray-200 bg-white overflow-hidden">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-b-0"
                  >
                    <span className="h-3 w-12 animate-pulse rounded bg-gray-100" />
                    <span className="h-4 w-16 animate-pulse rounded-full bg-gray-100" />
                    <span className="h-3 flex-1 animate-pulse rounded bg-gray-100" />
                  </div>
                ))}
              </div>
            )}

            {jobs && jobs.length === 0 && (
              <p className="mt-6 text-sm text-gray-400">
                No jobs found on the network yet.
              </p>
            )}

            {jobs && jobs.length > 0 && (
              <div className="mt-6 h-[260px] overflow-y-auto overflow-x-hidden rounded-xl border border-gray-200 bg-white">
                {jobs.map((job, i) => (
                  <div
                    key={job.eventId}
                    className={`flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-4 py-2.5 ${
                      i !== 0 ? "border-t border-gray-100" : ""
                    }`}
                  >
                    {job.agentPubkey ? (
                      <a
                        href={`https://jumble.social/users/${nip19.npubEncode(job.agentPubkey)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                        title={truncateKey(job.agentPubkey)}
                      >
                        <AgentAvatar size={20} pubkey={job.agentPubkey} picture={agentPictures.get(job.agentPubkey)} />
                      </a>
                    ) : (
                      <div className="w-5 shrink-0 h-5 rounded-full bg-[#f9f9f9] text-xs inline-flex items-center justify-center pointer-events-none">?</div>
                    )}
                    <span className="hidden sm:inline shrink-0 whitespace-nowrap text-[11px] text-gray-400">
                      {timeAgo(job.createdAt)}
                    </span>
                    <span
                      className={`hidden sm:inline shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor(job.status)}`}
                    >
                      {job.status}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-600">
                      <span className="font-mono text-gray-400">
                        {truncateKey(job.customer)}
                      </span>
                      {job.capability && (
                        <>
                          {" "}
                          <span className="text-gray-300">&middot;</span>{" "}
                          <span className="text-gray-500">{job.capability}</span>
                        </>
                      )}
                    </span>
                    {job.amount != null && job.amount > 0 && (
                      <span className="shrink-0 text-xs font-semibold text-gray-900">
                        {formatSol(job.amount)}
                      </span>
                    )}
                    <div className="flex shrink-0 items-center gap-1">
                      <a
                        href={makeNjumpUrl(job.eventId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                      >
                        request
                      </a>
                      {job.resultEventId && (
                        <a
                          href={makeNjumpUrl(job.resultEventId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                        >
                          result
                        </a>
                      )}
                      {job.txHash && (
                        <a
                          href={`${solscanBase}${job.txHash}${solscanSuffix}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 hover:bg-violet-100 hover:text-violet-700 transition-colors"
                        >
                          solscan
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
