import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAgents } from "./useAgents";
import { useJobs } from "./useJobs";
import { fetchAllAgentCount } from "~/lib/nostr";
import type { NetworkStats } from "~/types";

export function useStats(): {
  data: NetworkStats | undefined;
  isLoading: boolean;
} {
  const agents = useAgents();
  const jobs = useJobs();

  const allAgents = useQuery<number>({
    queryKey: ["allAgentCount"],
    queryFn: fetchAllAgentCount,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const data = useMemo(() => {
    if (!agents.data || !jobs.data || allAgents.data == null) return undefined;

    const totalLamports = jobs.data.reduce(
      (sum, j) => sum + (j.amount ?? 0),
      0,
    );
    const completedJobs = jobs.data.filter((j) => j.status === "success");
    return {
      totalAgentCount: allAgents.data,
      agentCount: agents.data.length,
      jobCount: completedJobs.length,
      totalLamports,
    };
  }, [agents.data, jobs.data, allAgents.data]);

  return {
    data,
    isLoading: agents.isLoading || jobs.isLoading || allAgents.isLoading,
  };
}
