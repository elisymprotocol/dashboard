import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { generateSecretKey, finalizeEvent, nip19 } from "nostr-tools";
import { AgentAvatar } from "./AgentAvatar";
import { useHireAgent, type HireStep, type HireJobCallbacks } from "~/hooks/useHireAgent";
import { useJobHistory } from "~/hooks/useJobHistory";
import { getPool, makeNjumpUrl } from "~/lib/nostr";
import { RELAYS, KIND_JOB_FEEDBACK } from "~/lib/constants";
import { truncateKey, formatSol } from "~/lib/format";
import type { Agent } from "~/types";
import type { StoredJob } from "~/lib/jobHistory";
import { useNetwork } from "~/hooks/useNetwork";
import { track } from "~/lib/analytics";

interface HireProps {
  agent: Agent;
  sessionSk?: Uint8Array | null;
  storedJob?: undefined;
  onClose: () => void;
}

interface ResumeProps {
  agent?: undefined;
  storedJob: StoredJob;
  onClose: () => void;
}

type Props = HireProps | ResumeProps;

const ALL_STEPS: { key: HireStep; label: string }[] = [
  { key: "submitting", label: "Submitting job" },
  { key: "payment-required", label: "Payment required" },
  { key: "paying", label: "Confirming transaction" },
  { key: "waiting-result", label: "Waiting for result" },
  { key: "success", label: "Result received" },
];

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className ?? "h-4 w-4"}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function HireAgentModal(props: Props) {
  const { onClose } = props;
  const isResume = !!props.storedJob;

  // In resume mode, track the stored job reactively via useJobHistory
  const { jobs, saveJob, updateJob } = useJobHistory();
  const resumeJob = isResume
    ? jobs.find((j) => j.jobEventId === props.storedJob!.jobEventId) ?? props.storedJob!
    : null;

  // Derive agent info from whichever source
  const agentPubkey = props.agent?.pubkey ?? resumeJob!.agentPubkey;
  const agentName = props.agent?.card.name ?? resumeJob!.agentName;
  const agentPicture = props.agent?.picture ?? resumeJob!.agentPicture;
  const capabilities = props.agent?.card.capabilities ?? [resumeJob!.capability];

  const [input, setInput] = useState(resumeJob?.input ?? "");
  const [capability, setCapability] = useState(
    resumeJob?.capability ?? (props.agent?.card.capabilities[0] ?? ""),
  );
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { network } = useNetwork();

  const paymentAmountRef = useRef<number>(0);

  const callbacks = useMemo<HireJobCallbacks>(() => ({
    onPaymentRequired(_jobEventId, amount) {
      paymentAmountRef.current = amount;
    },
    onPaymentCompleted(jobEventId, txSig) {
      saveJob({
        jobEventId,
        agentPubkey: props.agent!.pubkey,
        agentName: props.agent!.card.name,
        agentPicture: props.agent!.picture,
        capability,
        input: input.trim(),
        status: "paid",
        txSignature: txSig,
        paymentAmount: paymentAmountRef.current || undefined,
        createdAt: Math.floor(Date.now() / 1000),
      });
    },
    onResultReceived(jobEventId, res, resultEvId) {
      updateJob(jobEventId, {
        status: "completed",
        result: res,
        resultEventId: resultEvId,
        completedAt: Math.floor(Date.now() / 1000),
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [props.agent, capability, input, saveJob, updateJob]);

  const sessionSk = "sessionSk" in props ? props.sessionSk : undefined;
  const hire = useHireAgent(isResume ? undefined : callbacks, sessionSk);

  // In resume mode, map storedJob status to HireStep
  const resumeStep: HireStep | null = resumeJob
    ? resumeJob.status === "completed" ? "success"
    : resumeJob.status === "paid" ? "waiting-result"
    : "idle"
    : null;

  const step = isResume ? resumeStep! : hire.step;
  const result = isResume ? (resumeJob!.result ?? "") : hire.result;
  const txSignature = isResume ? (resumeJob!.txSignature ?? "") : hire.txSignature;
  const error = isResume ? "" : hire.error;
  const resultEventId = isResume ? (resumeJob!.resultEventId ?? "") : hire.resultEventId;
  const jobEventId = isResume ? resumeJob!.jobEventId : hire.jobEventId;

  // Feedback state — in resume mode we manage it locally
  const [resumeFeedback, setResumeFeedback] = useState<"idle" | "sending" | "sent">("idle");
  const feedbackState = isResume ? resumeFeedback : hire.feedbackState;

  const sendFeedback = useCallback(async (positive: boolean) => {
    track("job-feedback", { rating: positive ? "good" : "poor", agent: agentName });
    if (isResume) {
      if (!resumeJob) return;
      setResumeFeedback("sending");
      try {
        const sk = generateSecretKey();
        const pool = getPool();
        const ev = finalizeEvent(
          {
            kind: KIND_JOB_FEEDBACK,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
              ["e", resumeJob.jobEventId],
              ["p", resumeJob.agentPubkey],
              ["status", "success"],
              ["rating", positive ? "1" : "0"],
              ["t", "elisym"],
            ],
            content: positive ? "Good result" : "Poor result",
          },
          sk,
        );
        await Promise.any(pool.publish(RELAYS, ev));
        setResumeFeedback("sent");
      } catch {
        setResumeFeedback("idle");
      }
    } else {
      hire.sendFeedback(positive);
    }
  }, [isResume, resumeJob, hire]);

  const price = isResume
    ? (resumeJob!.paymentAmount ?? 0)
    : (hire.paymentAmount ?? props.agent?.card.payment?.job_price);
  const isPaid = price != null && price > 0;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = () => {
    if (isResume || !input.trim()) return;
    track("job-submit", { agent: agentName, capability });
    hire.submitJob(input.trim(), capability, props.agent!);
  };
  const handlePay = () => {
    if (isResume) return;
    if (!connected) { setVisible(true); return; }
    track("job-pay", { agent: agentName });
    hire.pay(props.agent!);
  };
  const handleReset = () => {
    if (isResume) return;
    hire.reset();
    setInput("");
  };

  const currentStepIdx = ALL_STEPS.findIndex((s) => s.key === step);
  const currentLabel = ALL_STEPS[currentStepIdx]?.label ?? step;
  const solscanBase = "https://solscan.io/tx/";
  const solscanSuffix = network === "mainnet" ? "" : "?cluster=devnet";

  const isProcessing = step !== "idle" && step !== "online" && step !== "error" && step !== "offline";
  const isSpinning = step === "submitting" || step === "paying" || step === "waiting-result";
  const isInput = !isResume && (step === "idle" || step === "online");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-500 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3 pr-6">
            <a
              href={`https://jumble.social/users/${nip19.npubEncode(agentPubkey)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 min-w-0 group"
            >
              <AgentAvatar size={36} pubkey={agentPubkey} picture={agentPicture} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-gray-500 transition-colors">{agentName}</p>
                <p className="text-[11px] text-gray-400 font-mono">{truncateKey(agentPubkey)}</p>
              </div>
            </a>
            {isPaid && (
              <span className="shrink-0 rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-600">
                {formatSol(price)}
              </span>
            )}
          </div>

          {/* Capabilities */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {capabilities.map((cap) => (
              <button
                key={cap}
                type="button"
                disabled={!isInput}
                onClick={() => setCapability(cap)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                  capability === cap
                    ? "bg-gray-900 text-white"
                    : "bg-gray-50 text-gray-500 hover:bg-gray-100 ring-1 ring-gray-200"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {cap}
              </button>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        {isProcessing && (
          <div className="mx-5 mb-4 rounded-xl bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-1">
              {ALL_STEPS.map((s, i) => (
                <div key={s.key} className="flex-1">
                  <div
                    className={`h-1 rounded-full transition-all duration-500 ${
                      i < currentStepIdx ? "bg-emerald-400" :
                      i === currentStepIdx ? (s.key === "success" ? "bg-emerald-400" : "bg-amber-400") :
                      "bg-gray-200"
                    }`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              {isSpinning && <Spinner className="h-3 w-3 text-amber-500" />}
              {step === "success" && (
                <svg className="h-3 w-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              )}
              {step === "payment-required" && (
                <svg className="h-3 w-3 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              )}
              <span className="text-[11px] font-medium text-gray-500">{currentLabel}</span>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="max-h-[50vh] overflow-y-auto px-5 pb-4">
          {/* Input */}
          {step !== "success" && (
            <textarea
              value={input}
              onChange={(e) => {
                const bytes = new TextEncoder().encode(e.target.value).length;
                if (bytes <= 1024) setInput(e.target.value);
              }}
              disabled={!isInput}
              placeholder="Describe what you'd like the agent to do..."
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
              }}
              className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-gray-400 focus:ring-0 focus:outline-none disabled:opacity-40 transition-colors"
            />
          )}

          {/* Error */}
          {step === "error" && error && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              {error}
            </div>
          )}

          {/* Result */}
          {step === "success" && result && (
            <div>
              <div className="mb-3 flex justify-end gap-1.5">
                {jobEventId && (
                  <a
                    href={makeNjumpUrl(jobEventId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                  >
                    request
                  </a>
                )}
                {resultEventId && (
                  <a
                    href={makeNjumpUrl(resultEventId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                  >
                    result
                  </a>
                )}
                {txSignature && (
                  <a
                    href={`${solscanBase}${txSignature}${solscanSuffix}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600 hover:bg-violet-100 hover:text-violet-700 transition-colors"
                  >
                    solscan
                  </a>
                )}
              </div>
              <pre className="overflow-x-auto rounded-xl bg-gray-950 p-4 text-[13px] leading-relaxed text-gray-300 font-mono whitespace-pre-wrap">
                {result}
              </pre>
              <div className="mt-3 flex items-center gap-2">
                {feedbackState === "idle" && (
                  <>
                    <span className="text-[11px] text-gray-400">Rate this result:</span>
                    <button
                      type="button"
                      onClick={() => sendFeedback(true)}
                      className="rounded-lg border border-gray-200 px-3 py-1 text-[11px] font-medium text-gray-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                    >
                      Good
                    </button>
                    <button
                      type="button"
                      onClick={() => sendFeedback(false)}
                      className="rounded-lg border border-gray-200 px-3 py-1 text-[11px] font-medium text-gray-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors"
                    >
                      Poor
                    </button>
                  </>
                )}
                {feedbackState === "sending" && (
                  <span className="text-[11px] text-gray-400">Sending...</span>
                )}
                {feedbackState === "sent" && (
                  <span className="text-[11px] text-emerald-600">Feedback sent</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
          <div>
            {!isResume && !isInput && step !== "error" && (
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
              >
                Reset
              </button>
            )}
            {isResume && (
              <button
                type="button"
                onClick={onClose}
                className="text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
              >
                Close
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {isInput && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!input.trim()}
                className="rounded-lg bg-gray-900 px-5 py-2 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
              >
                {isPaid ? `Submit & Pay ${formatSol(price)}` : "Submit"}
              </button>
            )}

            {!isResume && step === "payment-required" && (
              <button
                type="button"
                onClick={handlePay}
                className="rounded-lg bg-violet-500 px-5 py-2 text-xs font-medium text-white hover:bg-violet-600 transition-colors"
              >
                {connected ? `Pay ${formatSol(price ?? 0)}` : "Connect Wallet"}
              </button>
            )}

            {!isResume && step === "error" && (
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg bg-gray-900 px-5 py-2 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
