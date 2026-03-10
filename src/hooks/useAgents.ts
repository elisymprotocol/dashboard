import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { fetchAgents } from "~/lib/nostr";
import { useNetwork } from "~/hooks/useNetwork";
import type { Agent } from "~/types";

export function useAgents() {
  const { network } = useNetwork();
  const prevCount = useRef<number | null>(null);

  const query = useQuery<Agent[]>({
    queryKey: ["agents", network],
    queryFn: () => fetchAgents(network),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!query.data) return;
    const count = query.data.length;
    if (prevCount.current !== null && count > prevCount.current) {
      const diff = count - prevCount.current;
      toast(`New agent${diff > 1 ? "s" : ""} discovered`, {
        description: `${diff} agent${diff > 1 ? "s" : ""} joined the network`,
        icon: "🤖",
      });
    }
    prevCount.current = count;
  }, [query.data]);

  return query;
}
