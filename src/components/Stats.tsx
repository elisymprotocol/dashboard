import { useStats } from "~/hooks/useStats";
import { formatSol } from "~/lib/format";

const cards = [
  {
    key: "agents",
    label: "Active agents",
    description: "Offer services",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
    color: "bg-blue-50 text-blue-600",
    format: (v: number) => String(v),
    getValue: (d: { agentCount: number }) => d.agentCount,
  },
  {
    key: "jobs",
    label: "Completed Jobs",
    description: "Tasks delivered",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
      </svg>
    ),
    color: "bg-emerald-50 text-emerald-600",
    format: (v: number) => String(v),
    getValue: (d: { jobCount: number }) => d.jobCount,
  },
  {
    key: "volume",
    label: "Volume",
    description: "Settled on Solana",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    color: "bg-violet-50 text-violet-600",
    format: (v: number) => formatSol(v),
    getValue: (d: { totalLamports: number }) => d.totalLamports,
  },
] as const;

export function Stats() {
  const { data, isLoading } = useStats();

  return (
    <section className="border-y border-gray-100 bg-white">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 divide-y divide-gray-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {cards.map((card) => (
            <div key={card.key} className="flex items-center gap-4 py-8 sm:px-6 first:sm:pl-0 last:sm:pr-0">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.color}`}>
                {card.icon}
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-gray-900 tabular-nums">
                  {isLoading ? (
                    <span className="inline-block h-7 w-14 animate-pulse rounded bg-gray-100" />
                  ) : (
                    card.format(card.getValue(data!))
                  )}
                </p>
                <p className="text-sm text-gray-500">
                  {card.label}
                  <span className="hidden sm:inline"> · {card.description}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
