import { SERVICE_LIMITS } from './types';
export function replayEligibility(counts: { swaps: number; checkpoints: number; traces: number; fundingTransactions: number }, remote = false) {
  if (Object.values(counts).some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error('Invalid replay counts');
  const maxRequests = 4 + counts.checkpoints * 5 + counts.traces + counts.fundingTransactions;
  const eligible = counts.swaps <= SERVICE_LIMITS.maxSwaps && (!remote || counts.swaps < 100) && counts.checkpoints <= SERVICE_LIMITS.maxCheckpoints && counts.traces <= SERVICE_LIMITS.maxTraceTransactions && maxRequests <= SERVICE_LIMITS.jobRequests;
  return { ...counts, maxRequests, mode: eligible ? 'OWNER_PILOT' as const : 'STAGED_OWNER_REVIEW' as const,
    reason: eligible ? 'Within the conservative count limits. Historical ownership, complete marks and independent checkpoint reconciliation still need verification.' : `Exceeds this pilot: ${counts.swaps} swaps, ${counts.checkpoints} checkpoints, ${counts.traces} traces, at most ${maxRequests} reads. No RPC started. Needs a staged, quota-approved owner plan; not permanently unsupported.`,
  };
}
