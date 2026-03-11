import { useState, useCallback, useRef } from "react";
import { generateSecretKey, getPublicKey, finalizeEvent } from "nostr-tools";
import * as nip17 from "nostr-tools/nip17";
import * as nip59 from "nostr-tools/nip59";
import type { Filter } from "nostr-tools";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { getPool } from "~/lib/nostr";
import {
  RELAYS,
  KIND_JOB_REQUEST,
  KIND_JOB_RESULT,
  KIND_JOB_FEEDBACK,
  PROTOCOL_FEE_BPS,
  PROTOCOL_TREASURY,
} from "~/lib/constants";
import { validatePaymentFee } from "~/lib/payment";
import type { Agent } from "~/types";

const KIND_GIFT_WRAP = 1059;

export type HireStep =
  | "idle"
  | "pinging"
  | "online"
  | "offline"
  | "submitting"
  | "payment-required"
  | "paying"
  | "waiting-result"
  | "success"
  | "error";

type FeedbackState = "idle" | "sending" | "sent";

export function useHireAgent() {
  const [step, setStep] = useState<HireStep>("idle");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [txSignature, setTxSignature] = useState("");
  const [feedbackState, setFeedbackState] = useState<FeedbackState>("idle");
  const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<string | null>(null);

  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const skRef = useRef<Uint8Array | null>(null);
  const jobEventIdRef = useRef("");
  const agentPubkeyRef = useRef("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const subsRef = useRef<{ close: () => void }[]>([]);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    for (const sub of subsRef.current) sub.close();
    subsRef.current = [];
  }, []);

  const ping = useCallback(async (agent: Agent) => {
    cleanup();
    setStep("pinging");
    setResult("");
    setError("");
    setTxSignature("");
    setFeedbackState("idle");
    setPaymentAmount(null);
    setPaymentRequest(null);
    agentPubkeyRef.current = agent.pubkey;

    try {
      const sk = generateSecretKey();
      skRef.current = sk;
      const pk = getPublicKey(sk);
      const pool = getPool();

      // Generate random nonce for ping/pong matching
      const nonce = crypto.getRandomValues(new Uint8Array(16))
        .reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");

      const pingPayload = JSON.stringify({ type: "elisym_ping", nonce });

      // Subscribe for pong BEFORE sending ping (NIP-17 gift wraps to our pk)
      let resolved = false;

      const sub = pool.subscribeMany(
        RELAYS,
        {
          kinds: [KIND_GIFT_WRAP],
          "#p": [pk],
        } satisfies Filter,
        {
          onevent(ev) {
            if (resolved) return;
            try {
              const rumor = nip59.unwrapEvent(ev, sk);
              const msg = JSON.parse(rumor.content);
              if (msg.type === "elisym_pong" && msg.nonce === nonce) {
                resolved = true;
                setStep("online");
                sub.close();
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
              }
            } catch {
              // not our message, skip
            }
          },
        },
      );
      subsRef.current.push(sub);

      // Send NIP-17 gift-wrapped ping
      const wrap = nip17.wrapEvent(sk, { publicKey: agent.pubkey }, pingPayload);
      await Promise.any(pool.publish(RELAYS, wrap));

      timeoutRef.current = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          sub.close();
          setStep("offline");
          setError("Agent did not respond within 15 seconds.");
        }
      }, 15_000);
    } catch (err) {
      setStep("error");
      setError(err instanceof Error ? err.message : "Failed to ping agent");
    }
  }, [cleanup]);

  const submitJob = useCallback(
    async (input: string, capability: string, agent: Agent) => {
      cleanup();
      setStep("submitting");
      agentPubkeyRef.current = agent.pubkey;

      try {
        const sk = skRef.current ?? generateSecretKey();
        skRef.current = sk;
        const pk = getPublicKey(sk);
        const pool = getPool();

        const jobEvent = finalizeEvent(
          {
            kind: KIND_JOB_REQUEST,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
              ["i", input, "text"],
              ["p", agent.pubkey],
              ["t", capability],
              ["t", "elisym"],
              ["output", "text/plain"],
            ],
            content: "",
          },
          sk,
        );

        await Promise.any(pool.publish(RELAYS, jobEvent));
        jobEventIdRef.current = jobEvent.id;

        // Stay on "submitting" until agent responds with either
        // payment-required or a direct result — avoids backward step jumps.

        const expectedProvider = agent.pubkey;
        const sub = pool.subscribeMany(
          RELAYS,
          {
            kinds: [KIND_JOB_FEEDBACK],
            "#e": [jobEvent.id],
            since: jobEvent.created_at,
          } satisfies Filter,
          {
            onevent(ev) {
              if (ev.pubkey !== expectedProvider) return;
              const statusTag = ev.tags.find((t) => t[0] === "status");
              if (statusTag?.[1] === "payment-required") {
                // NIP-90 amount tag: ["amount", lamports, payment_request_json, chain]
                const amtTag = ev.tags.find((t) => t[0] === "amount");
                if (amtTag?.[1]) setPaymentAmount(parseInt(amtTag[1], 10));
                if (amtTag?.[2]) setPaymentRequest(amtTag[2]);
                setStep("payment-required");
                sub.close();
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
              }
            },
          },
        );
        subsRef.current.push(sub);

        // Also listen for direct result (free agents)
        const sub2 = pool.subscribeMany(
          RELAYS,
          {
            kinds: [KIND_JOB_RESULT],
            "#e": [jobEvent.id],
            since: jobEvent.created_at,
          } satisfies Filter,
          {
            onevent(ev) {
              if (ev.pubkey !== expectedProvider) return;
              setResult(ev.content);
              setStep("success");
              sub.close();
              sub2.close();
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            },
          },
        );
        subsRef.current.push(sub2);

        const sub3 = pool.subscribeMany(
          RELAYS,
          {
            kinds: [KIND_JOB_RESULT],
            "#p": [pk],
            since: jobEvent.created_at,
          } satisfies Filter,
          {
            onevent(ev) {
              if (ev.pubkey !== expectedProvider) return;
              setResult(ev.content);
              setStep("success");
              sub.close();
              sub2.close();
              sub3.close();
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            },
          },
        );
        subsRef.current.push(sub3);

        timeoutRef.current = setTimeout(() => {
          sub.close();
          sub2.close();
          sub3.close();
          setStep("error");
          setError("Timed out waiting for response (120s).");
        }, 120_000);
      } catch (err) {
        setStep("error");
        setError(err instanceof Error ? err.message : "Failed to submit job");
      }
    },
    [cleanup],
  );

  const pay = useCallback(
    async (agent: Agent) => {
      if (!publicKey || !sendTransaction) {
        setStep("error");
        setError("Wallet not connected.");
        return;
      }

      if (!paymentRequest) {
        setStep("error");
        setError("No payment request received from agent.");
        return;
      }

      let prData: {
        recipient: string;
        amount: number;
        reference: string;
        fee_address?: string;
        fee_amount?: number;
      };
      try {
        prData = JSON.parse(paymentRequest);
      } catch {
        setStep("error");
        setError("Invalid payment request format.");
        return;
      }

      if (!prData.recipient || !prData.amount || !prData.reference) {
        setStep("error");
        setError("Payment request missing required fields.");
        return;
      }

      const expectedRecipient = agent.card.payment?.address;
      const feeError = validatePaymentFee(paymentRequest, expectedRecipient);
      if (feeError) {
        setStep("error");
        setError(feeError);
        return;
      }

      setStep("paying");

      try {
        const recipient = new PublicKey(prData.recipient);
        const reference = new PublicKey(prData.reference);
        const feeAddress = prData.fee_address ? new PublicKey(prData.fee_address) : null;
        const feeAmount = prData.fee_amount ?? 0;

        const providerAmount = feeAddress && feeAmount > 0
          ? prData.amount - feeAmount
          : prData.amount;

        // Provider transfer with reference key (for payment detection)
        const transferIx = SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipient,
          lamports: providerAmount,
        });
        // Append reference as read-only non-signer so provider can detect via getSignaturesForAddress
        transferIx.keys.push({
          pubkey: reference,
          isSigner: false,
          isWritable: false,
        });

        const tx = new Transaction().add(transferIx);

        // Fee transfer
        if (feeAddress && feeAmount > 0) {
          tx.add(
            SystemProgram.transfer({
              fromPubkey: publicKey,
              toPubkey: feeAddress,
              lamports: feeAmount,
            }),
          );
        }

        const signature = await sendTransaction(tx, connection);
        await connection.confirmTransaction(signature, "confirmed");
        setTxSignature(signature);

        // Publish payment-completed feedback with tx hash so the provider
        // (and any observer) can link the job to the on-chain transaction.
        try {
          const sk = skRef.current;
          if (sk) {
            const confirmEv = finalizeEvent(
              {
                kind: KIND_JOB_FEEDBACK,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                  ["e", jobEventIdRef.current],
                  ["p", agentPubkeyRef.current],
                  ["status", "payment-completed"],
                  ["tx", signature, "solana"],
                  ["t", "elisym"],
                ],
                content: "",
              },
              sk,
            );
            await Promise.any(pool.publish(RELAYS, confirmEv));
          }
        } catch {
          // Best-effort — don't block the flow if confirmation publish fails
        }

        // Now wait for the result
        setStep("waiting-result");

        const sk = skRef.current;
        const pk = sk ? getPublicKey(sk) : null;
        const pool = getPool();
        const jobId = jobEventIdRef.current;
        const since = Math.floor(Date.now() / 1000) - 30;

        const expectedProvider = agentPubkeyRef.current;
        const sub = pool.subscribeMany(
          RELAYS,
          {
            kinds: [KIND_JOB_RESULT],
            "#e": [jobId],
            since,
          } satisfies Filter,
          {
            onevent(ev) {
              if (expectedProvider && ev.pubkey !== expectedProvider) return;
              setResult(ev.content);
              setStep("success");
              sub.close();
              if (sub2) sub2.close();
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            },
          },
        );
        subsRef.current.push(sub);

        let sub2: { close: () => void } | null = null;
        if (pk) {
          sub2 = pool.subscribeMany(
            RELAYS,
            {
              kinds: [KIND_JOB_RESULT],
              "#p": [pk],
              since,
            } satisfies Filter,
            {
              onevent(ev) {
                if (expectedProvider && ev.pubkey !== expectedProvider) return;
                setResult(ev.content);
                setStep("success");
                sub.close();
                sub2!.close();
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
              },
            },
          );
          subsRef.current.push(sub2);
        }

        timeoutRef.current = setTimeout(() => {
          sub.close();
          if (sub2) sub2.close();
          setStep("error");
          setError("Payment sent but timed out waiting for result (120s).");
        }, 120_000);
      } catch (err) {
        setStep("error");
        setError(
          err instanceof Error ? err.message : "Transaction failed",
        );
      }
    },
    [publicKey, sendTransaction, connection, paymentRequest],
  );

  const sendFeedback = useCallback(
    async (positive: boolean) => {
      if (!skRef.current || !jobEventIdRef.current || !agentPubkeyRef.current)
        return;
      setFeedbackState("sending");
      try {
        const pool = getPool();
        const ev = finalizeEvent(
          {
            kind: KIND_JOB_FEEDBACK,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
              ["e", jobEventIdRef.current],
              ["p", agentPubkeyRef.current],
              ["status", "success"],
              ["rating", positive ? "1" : "0"],
              ["t", "elisym"],
            ],
            content: positive ? "Good result" : "Poor result",
          },
          skRef.current,
        );
        await Promise.any(pool.publish(RELAYS, ev));
        setFeedbackState("sent");
      } catch {
        setFeedbackState("idle");
      }
    },
    [],
  );

  const reset = useCallback(() => {
    cleanup();
    setStep("idle");
    setResult("");
    setError("");
    setTxSignature("");
    setFeedbackState("idle");
    setPaymentAmount(null);
    setPaymentRequest(null);
    skRef.current = null;
    jobEventIdRef.current = "";
    agentPubkeyRef.current = "";
  }, [cleanup]);

  return {
    step,
    result,
    error,
    txSignature,
    feedbackState,
    paymentAmount,
    ping,
    submitJob,
    pay,
    sendFeedback,
    reset,
  };
}
