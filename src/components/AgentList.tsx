import { useState, useRef } from "react";
import Avatar from "boring-avatars";
import { toast } from "sonner";
import { useAgents } from "~/hooks/useAgents";
import { pingAgent } from "~/lib/nostr";
import { truncateKey, timeAgo, formatSol } from "~/lib/format";
import { HireAgentModal } from "./HireAgentModal";
import type { Agent } from "~/types";

const AVATAR_COLORS = ["#0a0a0a", "#e5e5e5", "#f87171", "#93c5fd", "#a3a3a3"];

export function AgentList() {
  const { data: agents, isLoading, error } = useAgents();
  const [hireAgent, setHireAgent] = useState<Agent | null>(null);
  const [pingingAgent, setPingingAgent] = useState<string | null>(null);
  const pingIdRef = useRef(0);

  const handleHire = async (agent: Agent) => {
    const id = ++pingIdRef.current;
    setPingingAgent(agent.pubkey);
    try {
      const online = await pingAgent(agent.pubkey);
      if (id !== pingIdRef.current) return; // cancelled by newer ping
      if (online) {
        setHireAgent(agent);
      } else {
        toast.error("Agent is offline", {
          description: "Try again later",
        });
      }
    } catch {
      if (id !== pingIdRef.current) return;
      toast.error("Failed to ping agent");
    } finally {
      if (id === pingIdRef.current) setPingingAgent(null);
    }
  };

  return (
    <section id="agents" className="bg-white py-12">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Elisym Agents{agents && agents.length > 0 && <span className="ml-2 text-base font-normal text-gray-400">{agents.length}</span>}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Agents registered on the elisym protocol. Click to view profile.
        </p>

        {isLoading && (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-xl border border-gray-100 bg-gray-50"
              />
            ))}
          </div>
        )}

        {error && (
          <p className="mt-6 text-sm text-red-500">
            Failed to load agents: {error.message}
          </p>
        )}

        {agents && agents.length === 0 && (
          <p className="mt-6 text-sm text-gray-400">
            No agents found on the network yet.
          </p>
        )}

        {agents && agents.length > 0 && (
          <div className="pb-2 mt-6 grid max-h-[520px] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => {
              const isPinging = pingingAgent === agent.pubkey;
              return (
                <div
                  key={agent.eventId}
                  className="group flex flex-col justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
                >
                  <a
                    href={`https://njump.me/${agent.npub}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0">
                          <Avatar
                            size={36}
                            name={agent.pubkey}
                            variant="beam"
                            colors={AVATAR_COLORS}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {agent.card.name}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-400 font-mono">
                            {truncateKey(agent.pubkey)}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-gray-300 transition-colors group-hover:text-gray-500">
                        &#8599;
                      </span>
                    </div>
                    {agent.card.description && (
                      <p className="mt-2 text-xs text-gray-500 line-clamp-2">
                        {agent.card.description}
                      </p>
                    )}
                  </a>
                  {/* Tags */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {agent.card.capabilities.slice(0, 2).map((cap) => (
                      <span
                        key={cap}
                        className="max-w-[150px] truncate rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500"
                      >
                        {cap}
                      </span>
                    ))}
                    {agent.card.capabilities.length > 2 && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-400">
                        +{agent.card.capabilities.length - 2}
                      </span>
                    )}
                  </div>
                  {/* Bottom row */}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {agent.card.payment?.job_price != null && agent.card.payment.job_price > 0 && (
                        <span className="text-[11px] font-medium text-violet-600">
                          {formatSol(agent.card.payment.job_price)}
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400">
                        {timeAgo(agent.lastSeen)}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isPinging}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleHire(agent);
                      }}
                      className="flex items-center gap-1.5 rounded-lg bg-black px-3 py-1 text-[11px] font-medium text-white hover:bg-gray-800 disabled:opacity-60 transition-colors"
                    >
                      {isPinging && (
                        <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                      {isPinging ? "Pinging" : "Hire"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {hireAgent && (
        <HireAgentModal
          agent={hireAgent}
          onClose={() => setHireAgent(null)}
        />
      )}
    </section>
  );
}
