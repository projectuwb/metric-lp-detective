# Stage 4 — owner-authorized remote reconstruction

**Live gate update, 1 November 2026:** PR #12 has since published the actual
fourth-position Actions proof and merged to main. Its Vercel status is success
and playback was owner-verified. The NOT VERIFIED entries below describe the
earlier implementation receipt, not the current fourth-position state. See
[Stage 5](STAGE_5.md) for current evidence, coverage and owner workflow.

Started 1 November 2026 (Australia/Sydney), main `07fbef9` (PR #8).
Issue #9, AGENTS, original specification, Stage 3 report/architecture and the
owner-beta runbook were read in full. Stage 3 deployment is owner-confirmed;
this task makes no new public deployment claim.

## Decision and implementation

Reuse GitHub's existing authenticated owner UI and standard public-repo runner.
Vercel serves the static verified registry and provides a copy-ID/workflow link;
it receives no GitHub token or anonymous work endpoint. No OAuth relay, new account,
database, long serverless request, billable runner or provider upgrade is needed.
The [remote runbook](REMOTE_WORKER_RUNBOOK.md) describes code paths, limits,
permission rationale, failure recovery and the three browser-only setup steps.

The main-only owner workflow preflights the fixed window ending 130841348/hash
`0xd4b50c9afe0934057d61ccf2821e30c5b6dbf3553b6348ccb846e9f5a074ea7e`,
source `0x2c6c8e6f1f3175cca4e31d0231777255deb75132ddf1b1804d6cf28db08f8f51`
and existing accounting/ABI version. It reserves 100 attempts/day through a
confirmed non-force state-branch commit before RPC, reuses the exact collector /
independent verifier, checkpoints sanitized public inputs, exports actual runner
receipts only inside Actions, and tests before publishing an evidence branch/PR.
An explicit CI dispatch handles GITHUB_TOKEN event suppression. All repository
protections remain effective; write/PR/dispatch denial stops or reports accurately.

The primary nine-swap demo now opens at its full Exit Summary: Start / Payout /
Net, all contributions, actual received tokens and zero remaining inventory.
Initial-deposit navigation and playback remain available. Original and third
replays, exact cashflow arithmetic, hypothetical conversion labels and missing
reference states are retained. No new financial assumptions were introduced.

## Release gates

| Gate | Result | Evidence / dependency |
|---|---|---|
| Owner workflow and public browser handoff | IMPLEMENTED; offline checks recorded below | Manual main-only dispatch, no public token or fabricated queue |
| Durable budget / safe resume / redaction / authorization | Offline tests PASS | Real saved nine-swap fixture survives a runner-style restore; synthetic failures are labelled tests |
| Fourth real candidate | INDEXED / NOT INDEPENDENTLY VERIFIED | New provider `0xd85440db4b63cd61e0be731b5dcb36e2f36f9eba`, salt `880320313732695054146242`; one swap, seven checkpoints, <=43 reads; tx/log evidence in runbook |
| Actual remote Actions reconstruction | NOT VERIFIED | API egress Forbidden; Actions secret and write/dispatch/PR permissions not inspectable. Owner approval required before adding secret |
| Fourth raw fixture and independent reconciliation | NOT VERIFIED | Must come from real runner acquisition; no fixture/status fabricated |
| Main merge and Vercel publishes new replay | NOT VERIFIED | Observe actual merge, successful existing deployment and public wallet playback after runner evidence publication |
| Original Stage 1B execution quotes | PARTIAL | Existing 26,202-swap sample remains partly priced; no bulk trace scan |

Stage 4 is **PARTIAL**. A new public wallet cannot yet be promised a verified
remote replay. The feasible code is complete; the smallest next action is integrate
this branch, explicitly approve/add the existing endpoint as the Actions secret,
and run the browser-only pilot. No local installation is required for that path.

## Validation receipt

Final command outcomes, counts, commit/push and CI status are recorded in
DEVELOPMENT_LOG.md after execution. Independent blockchain checks retain zero
tolerance; production-browser tests exercise the existing three replays, default
exit, wallet lookup, mobile handoff, no anonymous dispatch, clipboard and failures.
No live fourth-wallet or remote-run result is inferred from these offline checks.
