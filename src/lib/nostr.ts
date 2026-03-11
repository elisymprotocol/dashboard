import { SimplePool, type Filter, type Event } from "nostr-tools";
import { generateSecretKey, getPublicKey } from "nostr-tools";
import { nip19 } from "nostr-tools";
import * as nip17 from "nostr-tools/nip17";
import * as nip59 from "nostr-tools/nip59";
import {
  RELAYS,
  KIND_APP_HANDLER,
  KIND_JOB_REQUEST,
  KIND_JOB_RESULT,
  KIND_JOB_FEEDBACK,
} from "./constants";
import type { Agent, CapabilityCard, Job, JobStatus } from "~/types";
import type { Network } from "~/hooks/useNetwork";

const KIND_GIFT_WRAP = 1059;

let pool: SimplePool | null = null;

export function getPool(): SimplePool {
  if (!pool) {
    pool = new SimplePool();
  }
  return pool;
}

// Accumulate unique agent pubkeys across polls (relays return inconsistent subsets)
const allSeenAgents = new Set<string>();

/** Count all NIP-90 DVM agents (any kind:31990 with a "k" tag). */
export async function fetchAllAgentCount(): Promise<number> {
  const p = getPool();
  const events = await p.querySync(RELAYS, {
    kinds: [KIND_APP_HANDLER],
  } as Filter);

  for (const event of events) {
    if (event.tags.some((t) => t[0] === "k")) {
      allSeenAgents.add(event.pubkey);
    }
  }
  return allSeenAgents.size;
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
      if (!card.name) {
        continue;
      }

      // Filter by network from payment info (set by elisym-client agent.rs)
      // Agents without payment info default to devnet
      const agentNetwork = card.payment?.network ?? "devnet";
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
  limit?: number,
  since?: number,
): Promise<Job[]> {
  const p = getPool();

  // 1. Fetch requests first
  const reqFilter: Filter = {
    kinds: [KIND_JOB_REQUEST],
    ...(limit != null && { limit }),
    ...(since != null && { since }),
  };
  const requests = await p.querySync(RELAYS, reqFilter);

  // 2. Fetch results & feedbacks scoped to these request IDs
  const requestIds = requests.map((r) => r.id);

  let results: Event[] = [];
  let feedbacks: Event[] = [];

  if (requestIds.length > 0) {
    // Query in batches to avoid filter size limits
    const BATCH = 250;
    const resultBatches: Promise<Event[]>[] = [];
    const feedbackBatches: Promise<Event[]>[] = [];

    for (let i = 0; i < requestIds.length; i += BATCH) {
      const batch = requestIds.slice(i, i + BATCH);
      resultBatches.push(
        p.querySync(RELAYS, {
          kinds: [KIND_JOB_RESULT],
          "#e": batch,
        } as Filter),
      );
      feedbackBatches.push(
        p.querySync(RELAYS, {
          kinds: [KIND_JOB_FEEDBACK],
          "#e": batch,
        } as Filter),
      );
    }

    const [resultArrays, feedbackArrays] = await Promise.all([
      Promise.all(resultBatches),
      Promise.all(feedbackBatches),
    ]);
    results = resultArrays.flat();
    feedbacks = feedbackArrays.flat();
  }

  // Build a map of request ID → targeted agent pubkey (from #p tag)
  const targetedAgentByRequest = new Map<string, string>();
  for (const req of requests) {
    const pTag = req.tags.find((t) => t[0] === "p");
    if (pTag?.[1]) targetedAgentByRequest.set(req.id, pTag[1]);
  }

  // Index results and feedback by request ID, preferring targeted agent
  const resultsByRequest = new Map<string, Event>();
  for (const r of results) {
    const reqId = resolveRequestId(r);
    if (!reqId) continue;
    const existing = resultsByRequest.get(reqId);
    const targeted = targetedAgentByRequest.get(reqId);
    // Prefer result from the targeted agent
    if (!existing || (targeted && r.pubkey === targeted)) {
      resultsByRequest.set(reqId, r);
    }
  }

  const feedbackByRequest = new Map<string, Event>();
  for (const f of feedbacks) {
    const reqId = resolveRequestId(f);
    if (!reqId) continue;
    const existing = feedbackByRequest.get(reqId);
    const targeted = targetedAgentByRequest.get(reqId);
    // Prefer feedback from the targeted agent
    if (!existing || (targeted && f.pubkey === targeted)) {
      feedbackByRequest.set(reqId, f);
    }
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
    let txHash: string | undefined;

    if (result) {
      status = "success";
      const amtTag = result.tags.find((t) => t[0] === "amount");
      if (amtTag) amount = parseInt(amtTag[1], 10);
    }

    // Check all feedbacks for this request to find payment-completed with tx hash
    const allFeedbacksForReq = feedbacks.filter(
      (f) => resolveRequestId(f) === req.id,
    );
    for (const fb of allFeedbacksForReq) {
      const txTag = fb.tags.find((t) => t[0] === "tx");
      if (txTag?.[1]) {
        txHash = txTag[1];
        break;
      }
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
      txHash,
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
    { kinds, "#t": ["elisym"], since: Math.floor(Date.now() / 1000) } satisfies Filter,
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

/** Ping an agent via NIP-17 DM. Resolves true if online, false if offline. */
export function pingAgent(agentPubkey: string, timeoutMs = 15_000): Promise<boolean> {
  return new Promise((resolve) => {
    const sk = generateSecretKey();
    const pk = getPublicKey(sk);
    const p = getPool();

    const nonce = crypto.getRandomValues(new Uint8Array(16))
      .reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");

    let resolved = false;
    const done = (online: boolean) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      sub.close();
      resolve(online);
    };

    const sub = p.subscribeMany(
      RELAYS,
      { kinds: [KIND_GIFT_WRAP], "#p": [pk] } satisfies Filter,
      {
        onevent(ev) {
          try {
            const rumor = nip59.unwrapEvent(ev, sk);
            const msg = JSON.parse(rumor.content);
            if (msg.type === "elisym_pong" && msg.nonce === nonce) {
              done(true);
            }
          } catch { /* not our message */ }
        },
      },
    );

    const pingPayload = JSON.stringify({ type: "elisym_ping", nonce });
    const wrap = nip17.wrapEvent(sk, { publicKey: agentPubkey }, pingPayload);
    Promise.any(p.publish(RELAYS, wrap)).catch(() => done(false));

    const timer = setTimeout(() => done(false), timeoutMs);
  });
}
