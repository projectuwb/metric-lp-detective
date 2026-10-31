import { isAddress } from 'viem';
import { positionsFor, getMeta } from '../../../lib/server/replay';
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
    const meta = getMeta();
    return Response.json({ positions: positionsFor(body.wallet), from: meta.from, through: meta.through, message: 'Discovery covers this pool only through the indexed block. Manager ownership paths are not inferred.' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: 'Enter a valid wallet request.' }, { status: 400 });
    return Response.json({ error: 'The verified index is temporarily unavailable. Retry shortly.' }, { status: 503 });
  }
}
