// Public links only. No token, endpoint, queue or implicit dispatch.
export const OWNER_WORKFLOW = {
  url: 'https://github.com/projectuwb/metric-lp-detective/actions/workflows/owner-analysis.yml',
  runs: 'https://github.com/projectuwb/metric-lp-detective/actions?query=workflow%3A%22Owner+LP+reconstruction%22',
  runbook: 'https://github.com/projectuwb/metric-lp-detective/blob/main/docs/REMOTE_WORKER_RUNBOOK.md',
  readiness: 'EXTERNAL_STATUS_ONLY',
} as const;
