# Stage 3 processing decision — no new paid services

1 November 2026 (Australia/Sydney). Two realistic options only.

| Option | Durable state and execution | Cost / security / availability |
|---|---|---|
| Owner-local beta on an existing computer/cloud workspace | Local disk queue, one separate owner-started worker, immutable replay bundles; Git publishes approved public evidence | No new service or credentials. Bind to loopback and reject foreign origins/forwarded requests. Persists after a browser closes while the owner process/volume remain available. Not a public Vercel queue. |
| Existing GitHub Actions owner-dispatched worker | Authenticated workflow dispatch, Actions job state and limited-retention artifacts | Potentially within existing permitted free usage; actual quota is unverified. Requires a repository RPC secret and authenticated API/dispatch capability. Public anonymous submissions need an authenticated relay plus durable admission/quota control; do not expose GitHub tokens to browsers. |

## Decision

GO for a functioning owner-local beta and a downloadable public-site request that
can be imported by that owner worker. Implement and test this rather than inventing
Vercel background work. No new public service is opened. Results can be exported to
versioned repository evidence and published through the existing Git workflow.

NO-GO for claiming a durable public on-demand queue on Vercel alone: a stateless
request and ephemeral filesystem do not provide persistent queue/storage/worker
semantics. This runtime exposes only BNB_RPC_URL, no shared job-store binding.
Repository/GitHub Actions quota and any Actions RPC secret are not verified.
GitHub API repository read returns Forbidden and automatic dispatch cannot be
proved here. Do not infer current Vercel plan limits or new free allowances from
old marketing figures. This design does not depend on a long HTTP request limit.

## Conservative service bounds to implement

One worker, one pool/fixed index, EOA provider ownership only; at most 100 swaps,
20 checkpoints, 10 trace transactions and 100 RPC attempts per job. Reserve every
remote attempt before sending, including failures. A shared persistent ledger
caps all jobs at 100 RPC attempts/day (UTC) and two new jobs/day; tighter owner
limits may be used. No automatic bulk scan and no paid-plan fallback.

Idempotency includes chain/pool, provider/salt, indexed head hash, source-index
hash and accounting version. Persist checkpoints/cached read results; confirm
canonical block hashes before reuse. Never unlock playback until raw storage,
withdrawal execution, receipts and available execution witnesses independently
reconcile. Missing references remain unavailable. Serve immutable hash-checked
bundles only after an atomic promotion.

Job states must be real: QUEUED only after an atomic durable write; RUNNING with
actual checkpoint/request counts; VERIFIED only after independent reconciliation;
PARTIAL, FAILED, RATE_LIMITED and UNSUPPORTED are terminal unless the owner explicitly
retries within the remaining lifetime/day budgets. Closing a browser does not
cancel an owner worker. Stopping the worker pauses processing, with no turnaround
promise. Retain failed/request metadata for at most one day and completed beta
bundles for seven days unless explicitly published as public chain evidence.

The local API must be disabled on Vercel even if a mode flag is accidentally set.
Public mode must say no request was persisted, offer a request download, and give
owner-run instructions. Discovery queries are never a user-account/search-history
store; explicit reconstruction jobs necessarily retain the public position ID
for processing and bounded retention. Never store IP addresses or RPC endpoints
in job artifacts. Existing hosting/provider request metadata remains outside app
control.

## Smallest remaining production decision

Either keep the honest owner-run file-import/publish workflow, or approve one
specific durable authenticated relay/worker/store arrangement using existing free
allowances. The GitHub Actions option needs (1) confirmation of remaining free
usage, (2) a server-only Actions RPC secret, and (3) authenticated job admission
without exposing a write token in Vercel/browser code. No settings or secrets are
created by this task. A new public queue is not claimed by merely adding a workflow.

## Implementation and observed outcome

The owner-local option is now implemented and proved end to end in a local
production build. A new entered provider/salt (not a preset button) produced a
persisted job, continued after browser-context close/reopen, completed 86 bounded
RPC attempts, reconciled exactly and unlocked a twelve-event/ten-swap replay.
Immutable raw/observational evidence is committed under
`fixtures/positions/dcc159a95741b233/`. Other eligible positions use the same
pipeline; EOA/history/trace budgets still apply. No public API trigger executes a
pool replay or blockchain scan within a serverless request.

The public deployment path remains file handoff plus owner-controlled publication;
no durable Internet queue or GitHub dispatch is claimed. The local runner uses the
existing machine/volume and requires it to remain available. It is not appropriate
for untrusted shared hosts or public port forwarding. Actual TTL/access and cleanup
behavior, owner commands and remaining integration prerequisites are in
OWNER_BETA_RUNBOOK.md. The future main-based automated publish helper is guarded and
syntax-checked; this task used the equivalent validated feature-branch Git workflow.
No higher provider plan or additional paid service was created. Unknown provider,
Actions and Vercel allowances are not asserted as free capacity.
