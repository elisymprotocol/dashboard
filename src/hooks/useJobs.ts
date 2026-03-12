import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { fetchRecentJobs, subscribeToEvents } from "~/lib/nostr";
import {
  KIND_JOB_REQUEST,
  KIND_JOB_RESULT,
  KIND_JOB_FEEDBACK,
} from "~/lib/constants";
import type { Job } from "~/types";

/** Module-level accumulated jobs — survives refetches. */
let allJobs = new Map<string, Job>();
let latestTimestamp = 0;
let initialFetchDone = false;

function mergeJobs(incoming: Job[]): Job[] {
  for (const job of incoming) {
    const existing = allJobs.get(job.eventId);
    // Incoming wins if it has a more resolved status or is newer
    if (!existing || job.status !== "processing" || !existing.status || existing.status === "processing") {
      allJobs.set(job.eventId, job);
    }
    if (job.createdAt > latestTimestamp) {
      latestTimestamp = job.createdAt;
    }
  }
  return [...allJobs.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function useJobs() {
  const query = useQuery<Job[]>({
    queryKey: ["jobs"],
    queryFn: async () => {
      if (!initialFetchDone) {
        // First fetch — get everything
        const jobs = await fetchRecentJobs();
        initialFetchDone = true;
        return mergeJobs(jobs);
      }
      // Subsequent fetches — only get new jobs since last timestamp
      const since = latestTimestamp > 0 ? latestTimestamp - 10 : undefined; // -10s overlap buffer
      const jobs = await fetchRecentJobs(undefined, undefined, since);
      return mergeJobs(jobs);
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    placeholderData: (prev: Job[] | undefined) => prev,
  });

  return query;
}

// Module-level dedup — shared, single subscription
const seenEvents = new Set<string>();

/** Call once in App to subscribe to live events + show toasts. */
export function useJobSubscription() {
  const queryClient = useQueryClient();
  const initialLoadDone = useRef(false);

  // Suppress toasts for a few seconds after mount to skip initial batch
  useEffect(() => {
    const timer = setTimeout(() => {
      initialLoadDone.current = true;
    }, 5_000);
    return () => clearTimeout(timer);
  }, []);

  const handleEvent = useCallback((event: { id: string; kind: number }) => {
    if (seenEvents.has(event.id)) return;
    seenEvents.add(event.id);

    if (seenEvents.size > 500) {
      const arr = [...seenEvents];
      arr.splice(0, 250).forEach((id) => seenEvents.delete(id));
    }

    queryClient.invalidateQueries({ queryKey: ["jobs"], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["agents"], refetchType: "all" });

    if (!initialLoadDone.current) return;

    if (event.kind === KIND_JOB_REQUEST) {
      toast("New job submitted", {
        description: "A new task appeared on the network",
        icon: "📋",
      });
    } else if (event.kind === KIND_JOB_RESULT) {
      toast("Job completed", {
        description: "An agent delivered a result",
        icon: "✓",
      });
    }
  }, [queryClient]);

  useEffect(() => {
    const unsub = subscribeToEvents(
      [KIND_JOB_REQUEST, KIND_JOB_RESULT, KIND_JOB_FEEDBACK],
      handleEvent,
    );
    return unsub;
  }, [handleEvent]);
}
