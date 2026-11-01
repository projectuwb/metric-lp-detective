import { isAddress } from 'viem';
import { positionsFor, getDiscoveryCoverage } from '../../../lib/server/replay';
import { discoveryResult } from '../../../lib/domain/discovery';
import { limited } from '../../../lib/server/limit';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (limited(request, 'lookup', 60)) return Response.json({ error: 'Too many lookups. Wait a minute and retry.' }, { status: 429, headers: { 'Retry-After': '60' } });
  if (Number(request.headers.get('content-length') ?? 0) > 1024) return Response.json({ error: 'Request is too large.' }, { status: 413 });
  try {
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: 'Enter a wallet address.' }, { status: 400 });
    let text = '', size = 0;
    const decoder = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 1024) { await reader.cancel(); return Response.json({ error: 'Request is too large.' }, { status: 413 }); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const body = JSON.parse(text);
    if (typeof body?.wallet !== 'string' || !isAddress(body.wallet, { strict: false })) return Response.json({ error: 'Enter a valid public 0x wallet address.' }, { status: 400 });
    let range;
    if (body.fromBlock !== undefined || body.throughBlock !== undefined) {
      if (![body.fromBlock, body.throughBlock].every(n => typeof n === 'string' && /^\d{1,20}$/.test(n)) || BigInt(body.fromBlock) > BigInt(body.throughBlock)) return Response.json({ error: 'Supply an ordered fromBlock and throughBlock as decimal strings.' }, { status: 400 });
      range = { from: body.fromBlock, through: body.throughBlock };
    }
    const coverage = getDiscoveryCoverage();
    // The published index is a deployment-origin snapshot, not a per-block search service.
    if (range && (range.from !== coverage.from || range.through !== coverage.through) && BigInt(range.from) >= BigInt(coverage.from) && BigInt(range.through) <= BigInt(coverage.through)) return Response.json({ error: 'Use the complete published window; narrower event searches are not offered.' }, { status: 400 });
    const result = discoveryResult(positionsFor(body.wallet), coverage, range);
    return Response.json(result, { status: result.status === 'NOT_CHECKED_YET' ? 409 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: 'Enter a valid wallet request.' }, { status: 400 });
    return Response.json({ error: 'The verified index is temporarily unavailable. Retry shortly.' }, { status: 503 });
  }
}
