import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import Avatar from "boring-avatars";
import { useHireAgent, type HireStep } from "~/hooks/useHireAgent";
import { truncateKey, formatSol } from "~/lib/format";
import type { Agent } from "~/types";
import { useNetwork } from "~/hooks/useNetwork";

const AVATAR_COLORS = ["#0a0a0a", "#e5e5e5", "#f87171", "#93c5fd", "#a3a3a3"];

interface Props {
  agent: Agent;
  onClose: () => void;
}

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

export function HireAgentModal({ agent, onClose }: Props) {
  const [input, setInput] = useState("");
  const [capability, setCapability] = useState(agent.card.capabilities[0] ?? "");
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { network } = useNetwork();
  const {
    step,
    result,
    error,
    txSignature,
    feedbackState,
    paymentAmount,
    submitJob,
    pay,
    sendFeedback,
    reset,
  } = useHireAgent();

  const price = paymentAmount ?? agent.card.payment?.job_price;
  const isPaid = price != null && price > 0;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = () => {
    if (!input.trim()) return;
    submitJob(input.trim(), capability, agent);
  };
  const handlePay = () => {
    if (!connected) { setVisible(true); return; }
    pay(agent);
  };
  const handleReset = () => { reset(); setInput(""); };

  const currentStepIdx = ALL_STEPS.findIndex((s) => s.key === step);
  const currentLabel = ALL_STEPS[currentStepIdx]?.label ?? step;
  const solscanBase = "https://solscan.io/tx/";
  const solscanSuffix = network === "mainnet" ? "" : "?cluster=devnet";

  const isProcessing = step !== "idle" && step !== "online" && step !== "error" && step !== "offline";
  const isSpinning = step === "submitting" || step === "paying" || step === "waiting-result";
  const isInput = step === "idle" || step === "online";

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
            <Avatar size={36} name={agent.pubkey} variant="beam" colors={AVATAR_COLORS} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900 truncate">{agent.card.name}</p>
                {isPaid && (
                  <span className="shrink-0 rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-600">
                    {formatSol(price)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 font-mono">{truncateKey(agent.pubkey)}</p>
            </div>
          </div>

          {/* Capabilities */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {agent.card.capabilities.map((cap) => (
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
              onChange={(e) => setInput(e.target.value)}
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
              {txSignature && (
                <div className="mb-3 flex justify-end">
                  <a
                    href={`${solscanBase}${txSignature}${solscanSuffix}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-100 transition-colors"
                  >
                    Solscan &#8599;
                  </a>
                </div>
              )}
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
            {!isInput && step !== "error" && (
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
              >
                Reset
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

            {step === "payment-required" && (
              <button
                type="button"
                onClick={handlePay}
                className="rounded-lg bg-violet-500 px-5 py-2 text-xs font-medium text-white hover:bg-violet-600 transition-colors"
              >
                {connected ? `Pay ${formatSol(price ?? 0)}` : "Connect Wallet"}
              </button>
            )}

            {step === "error" && (
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
