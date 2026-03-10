import { useMemo } from "react";
import { useAgents } from "./useAgents";
import { useJobs } from "./useJobs";
import type { NetworkStats } from "~/types";

export function useStats(): {
  data: NetworkStats | undefined;
  isLoading: boolean;
} {
  const agents = useAgents();
  const jobs = useJobs();

  const data = useMemo(() => {
    if (!agents.data || !jobs.data) return undefined;

    // Build set of agent pubkeys for current network
    const agentPubkeys = new Set(agents.data.map((a) => a.pubkey));

    // Only count jobs where customer or a known agent is involved
    const networkJobs = agentPubkeys.size > 0
      ? jobs.data.filter((j) => agentPubkeys.has(j.customer))
      : jobs.data;

    const totalLamports = networkJobs.reduce(
      (sum, j) => sum + (j.amount ?? 0),
      0,
    );
    return {
      agentCount: agents.data.length,
      jobCount: networkJobs.length,
      totalLamports,
    };
  }, [agents.data, jobs.data]);

  return {
    data,
    isLoading: agents.isLoading || jobs.isLoading,
  };
}
