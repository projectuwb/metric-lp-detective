export interface AnalysisContext { chainId: 56; pool: string; indexEnd: string; indexEndHash: string; sourceHash: string; accountingVersion: string }
export type AnalysisState = 'QUEUED' | 'RUNNING' | 'VERIFIED' | 'PARTIAL' | 'UNSUPPORTED' | 'FAILED' | 'RATE_LIMITED';
export interface AnalysisJob {
  key: string; id: string; slug: string; context: AnalysisContext; status: AnalysisState; phase: string;
  createdAt: string; updatedAt: string; expiresAt: string; attempts: number; requests: number;
  completedCheckpoints: number; totalCheckpoints: number; error?: string; method?: string;
  cancelled?: boolean; verification?: Record<string, unknown>;
  bundleHash?: string;
}
export const SERVICE_LIMITS = { maxSwaps: 100, maxCheckpoints: 20, maxTraceTransactions: 10, jobRequests: 100, dailyRequests: 100, dailyJobs: 2, attempts: 3 } as const;
