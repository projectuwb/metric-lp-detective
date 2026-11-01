import 'server-only';
import { ownerLocal, context, workerOnline } from '../analysis/store';
import { SERVICE_LIMITS } from '../analysis/types';
import { OWNER_WORKFLOW } from '../domain/remoteWorkflow';
export function localAccessReason(request: Request, mutation = false) {
  if (!ownerLocal()) return 'DISABLED';
  const url = new URL(request.url);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return 'HOST';
  // Next normalizes its internal URL to localhost; authenticate the browser's
  // actual Host separately, requiring a loopback name and this same bound port.
  let actual: URL;
  try { actual = new URL(url.protocol + '//' + (request.headers.get('host') ?? url.host)); }
  catch { return 'HOST'; }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(actual.hostname) || actual.port !== url.port || actual.username || actual.password) return 'HOST';
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded && forwarded.split(',').some(ip => !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip.trim()))) return 'FORWARDED_CLIENT';
  const host = request.headers.get('x-forwarded-host');
  if (host) { try { if (new URL(url.protocol + '//' + host).origin !== actual.origin) return 'FORWARDED_HOST'; } catch { return 'FORWARDED_HOST'; } }
  if (mutation && request.headers.get('origin') !== actual.origin) return 'ORIGIN';
  if (mutation && !/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) return 'CONTENT_TYPE';
  return null;
}
export const localAccess = (request: Request, mutation = false) => localAccessReason(request, mutation) === null;
export function capabilities(request: Request) {
  const enabled = localAccess(request);
  return { mode: enabled ? 'OWNER_LOCAL' : 'PUBLIC_OWNER_HANDOFF', queueAvailable: enabled, accessReason: localAccessReason(request), workerOnline: enabled && workerOnline(), durable: enabled,
    context: context(), limits: SERVICE_LIMITS, ownerWorkflow: OWNER_WORKFLOW,
    message: enabled ? 'Owner-local disk queue. Processing continues after the browser closes while the owner worker and its disk remain available.' : 'Owner authorization required in GitHub. Nothing is queued or saved here. GitHub reports setup and actual remote progress; this site does not check secret configuration or claim that a job has started.' };
}
export async function boundedJson(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > 1024) throw new Error('Request too large');
  const reader = request.body?.getReader(); if (!reader) throw new Error('Missing request');
  let size = 0, result = ''; const decoder = new TextDecoder();
  for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > 1024) { await reader.cancel(); throw new Error('Request too large'); } result += decoder.decode(next.value, { stream: true }); }
  return JSON.parse(result + decoder.decode());
}
