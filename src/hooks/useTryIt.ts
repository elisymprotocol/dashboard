import { useState, useCallback, useRef } from "react";
import { generateSecretKey, getPublicKey, finalizeEvent } from "nostr-tools";
import type { Filter } from "nostr-tools";
import { getPool } from "~/lib/nostr";
import { RELAYS, KIND_JOB_REQUEST, KIND_JOB_RESULT } from "~/lib/constants";

type TryItState = "idle" | "submitting" | "waiting" | "success" | "error";

export function useTryIt() {
  const [state, setState] = useState<TryItState>("idle");
  const [result, setResult] = useState<string>("");
  const [agentPubkey, setAgentPubkey] = useState<string>("");
  const [error, setError] = useState<string>("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const submit = useCallback(async (input: string, capability: string) => {
    setState("submitting");
    setResult("");
    setError("");

    try {
      const sk = generateSecretKey();
      const pk = getPublicKey(sk);
      const pool = getPool();

      const event = finalizeEvent(
        {
          kind: KIND_JOB_REQUEST,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ["i", input, "text"],
            ["t", capability],
            ["t", "elisym"],
            ["output", "text/plain"],
          ],
          content: "",
        },
        sk,
      );

      await Promise.any(pool.publish(RELAYS, event));
      setState("waiting");

      const sub = pool.subscribeMany(
        RELAYS,
        {
          kinds: [KIND_JOB_RESULT],
          "#e": [event.id],
          since: event.created_at,
        } satisfies Filter,
        {
          onevent(resultEvent) {
            if (resultEvent.tags.some((t) => t[0] === "e" && t[1] === event.id)) {
              setResult(resultEvent.content);
              setAgentPubkey(resultEvent.pubkey);
              setState("success");
              sub.close();
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }
          },
        },
      );

      const sub2 = pool.subscribeMany(
        RELAYS,
        {
          kinds: [KIND_JOB_RESULT],
          "#p": [pk],
          since: event.created_at,
        } satisfies Filter,
        {
          onevent(resultEvent) {
            setResult(resultEvent.content);
            setAgentPubkey(resultEvent.pubkey);
            setState("success");
            sub.close();
            sub2.close();
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
          },
        },
      );

      timeoutRef.current = setTimeout(() => {
        sub.close();
        sub2.close();
        setState("error");
        setError("Timed out waiting for result (60s). No agents may be online.");
      }, 60_000);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Failed to submit job");
    }
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setResult("");
    setError("");
    setAgentPubkey("");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return { state, result, error, agentPubkey, submit, reset };
}
