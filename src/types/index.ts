export interface PaymentInfo {
  chain: string;
  network: string;
  address: string;
  job_price?: number;
}

export interface CapabilityCard {
  name: string;
  description: string;
  capabilities: string[];
  payment?: PaymentInfo;
}

export interface Agent {
  pubkey: string;
  npub: string;
  card: CapabilityCard;
  eventId: string;
  supportedKinds: number[];
  lastSeen: number;
}

export type JobStatus =
  | "payment-required"
  | "processing"
  | "error"
  | "success"
  | "partial";

export interface Job {
  eventId: string;
  customer: string;
  agentPubkey?: string;
  capability?: string;
  bid?: number;
  status: JobStatus | string;
  result?: string;
  amount?: number;
  createdAt: number;
}

export interface NetworkStats {
  totalAgentCount: number;
  agentCount: number;
  jobCount: number;
  totalLamports: number;
}
