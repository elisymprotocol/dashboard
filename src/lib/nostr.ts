import { SimplePool, type Filter, type Event } from "nostr-tools";
import { nip19 } from "nostr-tools";
import {
  RELAYS,
  KIND_APP_HANDLER,
  KIND_JOB_REQUEST,
  KIND_JOB_RESULT,
  KIND_JOB_FEEDBACK,
} from "./constants";
import type { Agent, CapabilityCard, Job, JobStatus } from "~/types";
import type { Network } from "~/hooks/useNetwork";

let pool: SimplePool | null = null;

export function getPool(): SimplePool {
  if (!pool) {
    pool = new SimplePool();
  }
  return pool;
}

export async function fetchAgents(network: Network = "devnet"): Promise<Agent[]> {
  const p = getPool();
  const filter: Filter = {
    kinds: [KIND_APP_HANDLER],
    "#t": ["elisym"],
  };

  const events = await p.querySync(RELAYS, filter);

  const agentMap = new Map<string, Agent>();

  for (const event of events) {
    try {
      const card: CapabilityCard = JSON.parse(event.content);
      if (!card.name || !card.protocol_version?.startsWith("elisym/")) {
        continue;
      }

      // Filter by network from metadata (set by elisym-client agent.rs)
      // Agents without metadata default to devnet
      const agentNetwork = (card.metadata?.network as string) ?? "devnet";
      if (agentNetwork !== network) {
        continue;
      }

      const existing = agentMap.get(event.pubkey);
      if (existing && existing.lastSeen >= event.created_at) {
        continue;
      }

      const kTags = event.tags
        .filter((t) => t[0] === "k")
        .map((t) => parseInt(t[1], 10))
        .filter((k) => !isNaN(k));

      agentMap.set(event.pubkey, {
        pubkey: event.pubkey,
        npub: nip19.npubEncode(event.pubkey),
        card,
        eventId: event.id,
        supportedKinds: kTags,
        lastSeen: event.created_at,
      });
    } catch {
      // skip malformed events
    }
  }

  return Array.from(agentMap.values()).sort(
    (a, b) => b.lastSeen - a.lastSeen,
  );
}

export async function fetchRecentJobs(
  agentPubkeys?: Set<string>,
  limit = 50,
): Promise<Job[]> {
  const p = getPool();

  const [requests, results, feedbacks] = await Promise.all([
    p.querySync(RELAYS, {
      kinds: [KIND_JOB_REQUEST],
      "#t": ["elisym"],
      limit,
    } as Filter),
    p.querySync(RELAYS, {
      kinds: [KIND_JOB_RESULT],
      limit,
    } as Filter),
    p.querySync(RELAYS, {
      kinds: [KIND_JOB_FEEDBACK],
      limit,
    } as Filter),
  ]);

  // Index results and feedback by request ID
  const resultsByRequest = new Map<string, Event>();
  for (const r of results) {
    const reqId = resolveRequestId(r);
    if (reqId) resultsByRequest.set(reqId, r);
  }

  const feedbackByRequest = new Map<string, Event>();
  for (const f of feedbacks) {
    const reqId = resolveRequestId(f);
    if (reqId) feedbackByRequest.set(reqId, f);
  }

  const jobs: Job[] = [];
  for (const req of requests) {
    const result = resultsByRequest.get(req.id);
    const feedback = feedbackByRequest.get(req.id);

    // Determine agent pubkey from result or feedback
    const jobAgentPubkey = result?.pubkey ?? feedback?.pubkey;

    // Filter by network agents if provided
    // Jobs with a known agent must match; processing jobs (no agent yet) are shown
    if (agentPubkeys && agentPubkeys.size > 0 && jobAgentPubkey) {
      if (!agentPubkeys.has(jobAgentPubkey)) continue;
    }

    const capability = req.tags.find((t) => t[0] === "t")?.[1];
    const bid = req.tags.find((t) => t[0] === "bid")?.[1];

    let status: JobStatus | string = "processing";
    let amount: number | undefined;

    if (result) {
      status = "success";
      const amtTag = result.tags.find((t) => t[0] === "amount");
      if (amtTag) amount = parseInt(amtTag[1], 10);
    }

    if (feedback) {
      if (!result) {
        const statusTag = feedback.tags.find((t) => t[0] === "status");
        if (statusTag?.[1]) {
          // Ignore payment-required on free (no-bid) jobs
          if (statusTag[1] === "payment-required" && !bid) {
            // keep "processing"
          } else {
            status = statusTag[1] as JobStatus;
          }
        }
      }
      if (!amount) {
        const amtTag = feedback.tags.find((t) => t[0] === "amount");
        if (amtTag) amount = parseInt(amtTag[1], 10);
      }
    }

    jobs.push({
      eventId: req.id,
      customer: req.pubkey,
      agentPubkey: jobAgentPubkey,
      capability,
      bid: bid ? parseInt(bid, 10) : undefined,
      status,
      result: result?.content,
      amount,
      createdAt: req.created_at,
    });
  }

  return jobs.sort((a, b) => b.createdAt - a.createdAt);
}

function resolveRequestId(event: Event): string | undefined {
  // Try "request" tag first (contains stringified original event)
  const requestTag = event.tags.find((t) => t[0] === "request");
  if (requestTag?.[1]) {
    try {
      const parsed = JSON.parse(requestTag[1]);
      if (parsed.id) return parsed.id as string;
    } catch {
      // fall through
    }
  }
  // Fallback: first "e" tag
  const eTag = event.tags.find((t) => t[0] === "e");
  return eTag?.[1];
}

export function subscribeToEvents(
  kinds: number[],
  onEvent: (event: Event) => void,
): () => void {
  const p = getPool();
  const sub = p.subscribeMany(
    RELAYS,
    { kinds, since: Math.floor(Date.now() / 1000) } satisfies Filter,
    {
      onevent: onEvent,
    },
  );
  return () => sub.close();
}

export function makeNjumpUrl(eventId: string, relays: string[] = RELAYS): string {
  const nevent = nip19.neventEncode({
    id: eventId,
    relays: relays.slice(0, 2),
  });
  return `https://njump.me/${nevent}`;
}
