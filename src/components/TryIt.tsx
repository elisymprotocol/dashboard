import { useState } from "react";
import { nip19 } from "nostr-tools";
import { useTryIt } from "~/hooks/useTryIt";
import { useJobs } from "~/hooks/useJobs";
import { truncateKey, timeAgo, formatSol, statusColor } from "~/lib/format";
import { makeNjumpUrl } from "~/lib/nostr";

const CAPABILITIES = [
  "summarization",
  "translation",
  "code-review",
  "text-generation",
];

export function TryIt() {
  const [input, setInput] = useState("");
  const [capability, setCapability] = useState(CAPABILITIES[0]);
  const { state, result, error, agentPubkey, submit, reset } = useTryIt();
  const { data: jobs, isLoading: jobsLoading } = useJobs();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
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
              Send a task to an AI agent and see the result in real time
            </p>

            <div className="mt-6 h-[260px] flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden">
              {/* Capability selector strip */}
              <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/50 px-4 py-3">
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
                  onChange={(e) => setInput(e.target.value)}
                  disabled={state !== "idle"}
                  placeholder="Describe what you'd like the agent to do..."
                  className="flex-1 resize-none border-0 bg-transparent px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none disabled:opacity-50"
                />

                {/* Bottom bar */}
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                  <span className="text-xs text-gray-400">
                    {input.length > 0 ? `${input.length} chars` : "No wallet needed"}
                  </span>
                  <div className="flex gap-2">
                    {state !== "idle" && (
                      <button
                        type="button"
                        onClick={reset}
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
                      {state === "idle" ? (
                        <span className="flex items-center gap-1.5">
                          Submit
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                          </svg>
                        </span>
                      ) : (
                        "Submitting..."
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {state === "waiting" && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <svg className="h-4 w-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Waiting for an agent to pick up the job...
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
                        href={`https://njump.me/${nip19.npubEncode(agentPubkey)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-500 hover:text-blue-600"
                      >
                        {truncateKey(agentPubkey)}
                      </a>
                    </span>
                  )}
                </div>
                <pre className="overflow-x-auto rounded-xl bg-gray-900 p-4 text-sm text-gray-300 font-mono">
                  {result}
                </pre>
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
              <div className="mt-6 h-[260px] overflow-y-auto rounded-xl border border-gray-200 bg-white">
                {jobs.map((job, i) => (
                  <a
                    key={job.eventId}
                    href={makeNjumpUrl(job.eventId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-gray-50 ${
                      i !== 0 ? "border-t border-gray-100" : ""
                    }`}
                  >
                    <span className="w-14 shrink-0 text-[11px] text-gray-400">
                      {timeAgo(job.createdAt)}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor(job.status)}`}
                    >
                      {job.status}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-600">
                      <span className="font-mono text-gray-400">
                        {truncateKey(job.customer)}
                      </span>
                      {job.capability && (
                        <>
                          {" · "}
                          <span className="text-gray-500">{job.capability}</span>
                        </>
                      )}
                    </span>
                    {job.amount != null && job.amount > 0 && (
                      <span className="shrink-0 text-sm font-medium text-gray-900">
                        {formatSol(job.amount)}
                      </span>
                    )}
                    <span className="shrink-0 text-gray-300 transition-colors group-hover:text-gray-500">
                      &#8599;
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
