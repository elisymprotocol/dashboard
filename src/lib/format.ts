import { LAMPORTS_PER_SOL } from "./constants";

export function formatSol(lamports: number): string {
  const sol = lamports / LAMPORTS_PER_SOL;
  if (sol >= 1_000_000) return `${Math.floor(sol / 1_000_000)}m SOL`;
  if (sol >= 10_000) return `${Math.floor(sol / 1_000)}k SOL`;
  return `${compactSol(sol)} SOL`;
}

/** Format a SOL value to at most 4 visible digits (before + after dot). */
function compactSol(sol: number): string {
  if (sol === 0) return "0";
  const whole = Math.floor(sol);
  const wholeDigits = whole === 0 ? 1 : String(whole).length;
  if (wholeDigits >= 4) return String(whole);
  const fracDigits = 4 - wholeDigits;
  const formatted = sol.toFixed(fracDigits);
  // strip trailing zeros after dot, and the dot itself if empty
  return formatted.replace(/\.?0+$/, "") || "0";
}

export function timeAgo(unix: number): string {
  const seconds = Math.floor(Date.now() / 1000 - unix);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function truncateKey(hex: string, number = 6): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, number)}...${hex.slice(-number)}`;
}

export function statusColor(status: string): string {
  switch (status) {
    case "success":
      return "bg-emerald-100 text-emerald-600";
    case "processing":
      return "bg-amber-100 text-amber-600";
    case "error":
      return "bg-red-100 text-red-600";
    case "payment-required":
      return "bg-blue-100 text-blue-600";
    case "payment-completed":
      return "bg-teal-100 text-teal-600";
    case "partial":
      return "bg-amber-100 text-amber-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
}
