import { existsSync, readFileSync } from 'node:fs';
import { keccak256 } from 'viem';
import { historyInputs } from './reconstruct-history';
import { accountingVersion } from '../lib/analysis/version';
import { verifyAccountingIndex } from '../lib/chain/accountingIndex';
export function verifyPublishedAccountingCandidate() {
  const file = 'fixtures/accounting/candidate.json';
  if (!existsSync(file)) return { status: 'NOT_CAPTURED', publishedReplayThrough: '130841348' };
  const h = historyInputs();
  const base = { chainId: 56 as const, pool: h.logs[0].address, from: h.acquisition.from, through: h.acquisition.to, headHash: h.acquisition.endHash, sourceHash: keccak256(readFileSync('fixtures/history/pool-logs.json.gz')), accountingVersion: accountingVersion() };
  const verified = verifyAccountingIndex(JSON.parse(readFileSync(file, 'utf8')), base, h.logs, h.abi);
  return { status: verified.verification?.status ?? 'NO_COMPLETE_PAGES', through: verified.through, verification: verified.verification, perPositionProofsRequired: true };
}
if (process.argv[1]?.endsWith('verify-accounting-index.ts')) console.log(JSON.stringify(verifyPublishedAccountingCandidate()));
