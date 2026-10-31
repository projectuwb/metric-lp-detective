# Functional visual MVP

Built from main f43614a (PR #2). Next.js/React frontend and server-side API.
**Not publicly deployed. Stage 1B remains PARTIAL.** No live bulk trace scan,
wallet connection, signing or blockchain writes were performed.

## View locally

Node.js 24+:

```sh
npm ci --ignore-scripts
npm run dev
```

Open the address printed by Next.js and click **Try the verified sample**.
First startup prepares and verifies saved evidence. The frozen demo requires no
RPC key and makes no browser-to-RPC requests.

Production locally:

```sh
npm run build
npm run check:client
npm start
```

After explicit owner approval, import the pushed feature branch or merged main
into Vercel or another managed Next.js host. Use Node 24, install command
`npm ci --ignore-scripts`, build command `npm run build`, and default Next.js
output. Static export is unsupported: Node API routes are required. The fixed
index needs no database, paid service or RPC secret. Research/acquisition commands
still require the existing server-only BNB_RPC_URL. API output tracing was checked:
all 209 generated data files are included. No hosting settings were changed.

## Supported behavior and truthfulness

- Wallet lookup discovers 236 provider/salt positions in this one pool's indexed
  coverage, from deployment through fixed block 130841348. Only the independently
  reconciled sample has replay enabled. Other positions are explicitly indexed-only;
  unsupported manager ownership is not inferred. Empty results do not imply
  lifetime absence or no later activity.
- Replay has 26,282 actual rows: 26,202 attributable swaps, 3 own liquidity events,
  and 77 entitlement-rounding adjustments from other LP liquidity changes.
  Adjustments are labelled, never presented as trades.
- Every row retains block/log/transaction evidence, exact base-unit before/after
  inventory and deltas, and touched-bin LP/total share changes. BscScan links are
  preserved. All independent historical withdrawal checkpoints and final inventory
  agree exactly; the build fails if generated balances do not reconcile.
- Play/pause, previous/next, speed, reset, scrub and chart selection use real event
  indices. Only three 128-row pages remain cached in-browser. The overview contains
  400 actual samples. Event order is explicitly distinct from elapsed wall time.
- Blue execution references appear only for real trace witnesses (2,146 events).
  Missing execution data stays missing. Historical endpoint reference marks are
  separately labelled and never substituted into gaps. Native pool exchange ratios
  are whole-swap averages, distinct from the LP allocation and reference.
- Value and cashflow PnL are labelled at their fixed endpoint using historical
  block-end provider-reference marks. USDT-equivalent is distinct from verified USD.
  Absolute PnL differs from the same-funded-token/same-token-withdrawal holding
  benchmark. Gas and original pre-funding-wallet outcomes are excluded; fees are
  already inside inventory and are never counted twice.
- Errors, timeouts and retry have terminal states; requests time out after 15 seconds.
  Desktop/mobile, keyboard operation and reduced motion were exercised.

## Server and privacy

`scripts/prepare-web.ts` verifies source evidence and derives ignored `.web-data`.
No pool replay or chain scan runs during a web request. Runtime routes are:

| API | Contract |
|---|---|
| POST /api/positions | Address validated, body capped at 1 KB, no-store response |
| GET /api/replay | Fixed sample metadata, chart samples and source/confidence |
| GET /api/replay/[id]/events?page=N | At most 128 rows; bounded page; unsupported position is 409 |

The server-only module boundary protects filesystem access. No browser component
or web route imports the research RPC transport. A public-asset scan rejects
private variable names, provider hostnames and actual credential values.
No queries are intentionally logged or persisted; public pool events are retained.
Hosting infrastructure may retain ordinary request metadata. Best-effort per-instance
rate limiting uses bounded, short-lived hashed-IP counters, not a search-history
or account database; it is not distributed rate limiting.

## Verification

- `npm run check`: 54 tests pass, including all original reconciliation tests,
  generated event continuity, independent checkpoint agreement, API errors and
  recovery circuit-breaking; typecheck and original fixture/history/oracle/
  performance verification and credential scan pass.
- `npm run build` and `npm run check:client`: pass.
- `npm run test:e2e`: 4 production Chromium tests pass, covering sample swaps,
  pause, endpoint scrub, transaction links, wallet/salt selection, indexed-only
  and empty results, mobile layout, failures and successful retries.

For browser tests use an installed Chromium with
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e`, or install the
matching browser with `npx playwright install --with-deps chromium` first.
CI now runs the production build, public-asset scan and browser tests as well as
the original checks. Generated screenshots/traces are not committed chain evidence.

## Stage 1B recovery design

No bulk trace recovery was launched. The worker now defaults to one worker,
at least one second between request reservations and **50 attempts per invocation**.
The hard budget is 1..100; concurrency is 1..2. Retries consume budget. A rate
response opens a circuit so queued calls cannot keep making remote requests.
A later explicit invocation resumes from local caches or committed witnesses.
Mechanical unit tests verify these limits without claiming extra on-chain results.
Existing coverage stays 2,014 transactions / 2,146 swaps; 23,177 transactions remain
unverified. Review provider quotas before any further acquisition. No higher plan,
paid worker or unrestricted scheduled recovery job was created.
