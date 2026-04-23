import { getNumericEnv } from './validation.js';

function hexFromBuffer(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function signValue(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return hexFromBuffer(signature);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

function getReplayProtectionStore(env) {
  return env?.RATE_LIMIT_KV || env?.JOBS_KV || null;
}

export async function verifyCallbackRequest({ body, signatureHeader, timestampHeader, secret, env, jobId }) {
  if (!signatureHeader || !timestampHeader || !secret) {
    return { ok: false, status: 401, error: 'Missing callback authentication headers.' };
  }

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, status: 401, error: 'Invalid callback timestamp.' };
  }

  const now = Math.floor(Date.now() / 1000);
  const maxAgeSeconds = getNumericEnv(env, 'CALLBACK_MAX_AGE_SECONDS', 300);
  const futureSkewSeconds = getNumericEnv(env, 'CALLBACK_FUTURE_SKEW_SECONDS', 60);

  if (timestamp > now + futureSkewSeconds) {
    return { ok: false, status: 401, error: 'Callback timestamp is too far in the future.' };
  }

  if (now - timestamp > maxAgeSeconds) {
    return { ok: false, status: 401, error: 'Callback timestamp is stale.' };
  }

  const expected = `sha256=${await signValue(secret, `${timestamp}.${body}`)}`;
  if (!timingSafeEqual(expected, signatureHeader)) {
    return { ok: false, status: 401, error: 'Invalid callback signature.' };
  }

  const store = getReplayProtectionStore(env);
  if (!store) {
    return { ok: false, status: 500, error: 'Replay-protection KV binding is missing.' };
  }

  const replayKey = `cb:${jobId}:${timestamp}:${expected}`;
  const existing = await store.get(replayKey);
  if (existing) {
    return { ok: false, status: 409, error: 'Replay callback rejected.' };
  }

  await store.put(replayKey, '1', { expirationTtl: maxAgeSeconds + futureSkewSeconds + 60 });
  return { ok: true };
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export async function enforceRateLimit(request, env) {
  if (!env?.RATE_LIMIT_KV) return;

  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const windowSeconds = getNumericEnv(env, 'RATE_LIMIT_WINDOW_SECONDS', 3600);
  const maxRequests = getNumericEnv(env, 'RATE_LIMIT_MAX_REQUESTS', 10);
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `rl:${ip}:${bucket}`;
  const currentValue = Number((await env.RATE_LIMIT_KV.get(key)) || 0);

  if (currentValue >= maxRequests) {
    throw new Error(`Rate limit exceeded. Try again later.`);
  }

  await env.RATE_LIMIT_KV.put(key, String(currentValue + 1), { expirationTtl: windowSeconds + 30 });
}
