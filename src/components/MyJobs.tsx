import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import Avatar from "boring-avatars";
import { useJobHistory } from "~/hooks/useJobHistory";
import { useNetwork } from "~/hooks/useNetwork";
import { formatSol, timeAgo, truncateKey } from "~/lib/format";
import { track } from "~/lib/analytics";
import { HireAgentModal } from "./HireAgentModal";
import type { StoredJob } from "~/lib/jobHistory";

const AVATAR_COLORS = ["#0a0a0a", "#e5e5e5", "#f87171", "#93c5fd", "#a3a3a3"];

function StatusBadge({ status }: { status: StoredJob["status"] }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-50 text-amber-600",
    paid: "bg-blue-50 text-blue-600",
    completed: "bg-emerald-50 text-emerald-600",
    error: "bg-red-50 text-red-600",
  };
  const labels: Record<string, string> = {
    pending: "Pending",
    paid: "Awaiting result",
    completed: "Completed",
    error: "Error",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[status] ?? styles.pending}`}>
      {labels[status] ?? status}
    </span>
  );
}

function JobCard({
  job,
  onRemove,
  onClick,
}: {
  job: StoredJob;
  onRemove: () => void;
  onClick: () => void;
}) {
  const { network } = useNetwork();
  const solscanBase = "https://solscan.io/tx/";
  const solscanSuffix = network === "mainnet" ? "" : "?cluster=devnet";

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">
            <Avatar size={32} name={job.agentPubkey} variant="beam" colors={AVATAR_COLORS} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900 truncate">{job.agentName}</p>
              <StatusBadge status={job.status} />
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-gray-400">{job.capability}</span>
              <span className="text-[11px] text-gray-300">&middot;</span>
              <span className="text-[11px] text-gray-400">{timeAgo(job.createdAt)}</span>
              {job.paymentAmount != null && job.paymentAmount > 0 && (
                <>
                  <span className="text-[11px] text-gray-300">&middot;</span>
                  <span className="text-[11px] font-medium text-violet-600">{formatSol(job.paymentAmount)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="shrink-0 rounded-full p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-500 transition-colors"
          title="Remove from history"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Input preview */}
      <p className="mt-2 text-xs text-gray-500 line-clamp-2">{job.input}</p>

      {/* Tx link */}
      {job.txSignature && (
        <div className="mt-2">
          <a
            href={`${solscanBase}${job.txSignature}${solscanSuffix}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-700 transition-colors"
          >
            {truncateKey(job.txSignature)} &#8599;
          </a>
        </div>
      )}

      {/* Waiting indicator for paid jobs */}
      {job.status === "paid" && (
        <div className="mt-3 flex items-center gap-2">
          <svg className="h-3 w-3 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-[11px] text-gray-400">Listening for result...</span>
        </div>
      )}

    </div>
  );
}

export function MyJobs() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { jobs, removeJob } = useJobHistory();
  const [openJob, setOpenJob] = useState<StoredJob | null>(null);

  if (!connected) {
    return (
      <section id="my-jobs" className="bg-gray-50/50 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-bold text-gray-900">My Jobs</h2>
          <p className="mt-1 text-sm text-gray-500">Connect your wallet to view job history.</p>
          <button
            type="button"
            onClick={() => setVisible(true)}
            className="mt-4 rounded-lg bg-gray-900 px-5 py-2 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </section>
    );
  }

  if (jobs.length === 0) {
    return (
      <section id="my-jobs" className="bg-gray-50/50 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-bold text-gray-900">My Jobs</h2>
          <p className="mt-4 text-sm text-gray-400">No jobs yet. Hire an agent to get started.</p>
        </div>
      </section>
    );
  }

  const pending = jobs.filter((j) => j.status === "paid" || j.status === "pending");
  const completed = jobs.filter((j) => j.status === "completed");
  const other = jobs.filter((j) => j.status === "error");
  const sorted = [...pending, ...completed, ...other];

  return (
    <section id="my-jobs" className="bg-gray-50/50 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            My Jobs
            <span className="ml-2 text-base font-normal text-gray-400">{jobs.length}</span>
          </h2>
          {pending.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs text-gray-500">{pending.length} awaiting result</span>
            </div>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Your job history, stored locally in this browser.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((job) => (
            <JobCard
              key={job.jobEventId}
              job={job}
              onRemove={() => removeJob(job.jobEventId)}
              onClick={() => { track("my-jobs-open", { status: job.status }); setOpenJob(job); }}
            />
          ))}
        </div>
      </div>

      {openJob && (
        <HireAgentModal
          storedJob={openJob}
          onClose={() => setOpenJob(null)}
        />
      )}
    </section>
  );
}
