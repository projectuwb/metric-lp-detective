import 'server-only';
import { createHash } from 'node:crypto';
// Best-effort per-instance bound, not a distributed or persistent user database.
const buckets = new Map<string, { until: number; count: number }>();
export function limited(request: Request, scope: string, maximum: number) {
  const now = Date.now();
  for (const [key, value] of buckets) if (value.until <= now) buckets.delete(key);
  if (buckets.size >= 10000) return true;
  const ip = (request.headers.get('x-forwarded-for') ?? 'local').split(',')[0].slice(0, 128);
  const key = `${scope}:${createHash('sha256').update(ip).digest('hex')}`;
  const bucket = buckets.get(key) ?? { until: now + 60000, count: 0 };
  bucket.count++; buckets.set(key, bucket);
  return bucket.count > maximum;
}
