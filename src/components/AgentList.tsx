import { useMemo } from "react";
import Avatar from "boring-avatars";
import { useAgents } from "~/hooks/useAgents";
import { useJobs } from "~/hooks/useJobs";
import { truncateKey, timeAgo, formatSol } from "~/lib/format";

const AVATAR_COLORS = ["#0a0a0a", "#e5e5e5", "#f87171", "#93c5fd", "#a3a3a3"];

export function AgentList() {
  const { data: agents, isLoading, error } = useAgents();
  const { data: jobs } = useJobs();

  // Build a map of agent pubkey → total earned (lamports)
  const earningsByAgent = useMemo(() => {
    const map = new Map<string, number>();
    if (!jobs) return map;
    for (const job of jobs) {
      if (job.agentPubkey && job.amount && job.amount > 0) {
        map.set(job.agentPubkey, (map.get(job.agentPubkey) ?? 0) + job.amount);
      }
    }
    return map;
  }, [jobs]);

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
            {agents.map((agent) => (
              <a
                key={agent.eventId}
                href={`https://njump.me/${agent.npub}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
              >
                <div className="min-w-0">
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
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    {agent.card.capabilities.slice(0, 3).map((cap) => (
                      <span
                        key={cap}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500"
                      >
                        {cap}
                      </span>
                    ))}
                    {agent.card.capabilities.length > 3 && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-400">
                        +{agent.card.capabilities.length - 3}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {(earningsByAgent.get(agent.pubkey) ?? 0) > 0 && (
                      <span className="text-[11px] font-medium text-emerald-600">
                        {formatSol(earningsByAgent.get(agent.pubkey)!)}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-400">
                      {timeAgo(agent.lastSeen)}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
