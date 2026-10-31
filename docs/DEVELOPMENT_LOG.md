# Development log

Dates use Australia/Sydney. Commits are recorded in a subsequent log update to
avoid circular self-hashes. Git history is authoritative for this file's own commit.

| Date | Milestone | Validation / status | Commit |
|---|---|---|---|
| 2026-10-31 | Original build specification on main | Project contract preserved unchanged | `baed2e9b24e16fa7cc6ee66489c0afd5438424bb` |
| 2026-10-31 | Stage 0 deployment/source/ABI audit, two genuine deposits, historical RPC/receipt evidence | Pool + linked library source matched; historical receipts verified | Preservation commit recorded in next entry |
| 2026-10-31 | Stage 1 individual-LP attribution A–D through checkpoint 126553642 | 42 tests, typecheck, fixture validation pass; 1,200 storage comparisons and 56 historical withdrawal eth_call results match; zero reconciliation tolerance | Preservation commit recorded in next entry |
| 2026-10-31 | Autonomous workflow | AGENTS.md, reusable credential scanner, combined check command and offline CI; feature branch `codex/preserve-stage0-stage1` | Preservation commit recorded in next entry |

Outstanding: Stage 1 is incomplete beyond the declared checkpoint. Execution-time
oracle references, later/current history and a real competing-removal example are
unverified. No dashboard, deployment, paid infrastructure or repository security
changes are authorized by this workflow task.

Git access: existing HTTPS Git proxy reads and push dry-run succeed. GitHub API
access is blocked by environment egress (`CONNECT HTTP 403` to `api.github.com`).
An additive allowlist draft was saved with existing domains preserved. Until it is
applied, repository API permissions, branch protections, PRs and merge checks cannot
be inspected. Never bypass that block by pushing substantial work directly to main.
Push and merge outcomes will be recorded once observed, not assumed from a dry-run.
