import { DurableObject } from 'cloudflare:workers';
import { json } from './http.js';

const VAPID_SUBJECT = 'https://jinkoro.github.io/training/';
const MAX_SECONDS = 1800;
const PUSH_TTL_SECONDS = 60;
const JWT_LIFETIME_SECONDS = 3600;

function isApplePushEndpoint(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.push.apple.com');
  } catch {
    return false;
  }
}

function base64Url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

async function vapidAuthorization(endpoint, env) {
  const encode = (value) => base64Url(new TextEncoder().encode(JSON.stringify(value)));
  const unsigned = `${encode({ typ: 'JWT', alg: 'ES256' })}.${encode({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + JWT_LIFETIME_SECONDS,
    sub: VAPID_SUBJECT,
  })}`;
  const key = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(env.VAPID_PRIVATE_JWK),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned),
  );
  return `vapid t=${unsigned}.${base64Url(signature)}, k=${env.VAPID_PUBLIC_KEY}`;
}

export class RestTimer extends DurableObject {
  async start(endpoint, seconds) {
    await this.ctx.storage.put('endpoint', endpoint);
    await this.ctx.storage.delete('lastResult');
    await this.ctx.storage.setAlarm(Date.now() + seconds * 1000);
  }

  async stop() {
    await this.ctx.storage.deleteAlarm();
  }

  async status() {
    return {
      scheduledAt: await this.ctx.storage.getAlarm(),
      lastResult: (await this.ctx.storage.get('lastResult')) ?? null,
    };
  }

  async alarm() {
    const endpoint = await this.ctx.storage.get('endpoint');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidAuthorization(endpoint, this.env),
        TTL: String(PUSH_TTL_SECONDS),
        Urgency: 'high',
        'Content-Length': '0',
      },
    });
    await this.ctx.storage.put('lastResult', {
      status: response.status,
      body: (await response.text()).slice(0, 300),
      at: Date.now(),
    });
  }
}

export async function handleTimer(request, env, pathname) {
  const body = await request.json().catch(() => null);
  if (!isApplePushEndpoint(body?.endpoint)) return json(request, { error: 'invalid_endpoint' }, 400);

  const timer = env.REST_TIMER.get(env.REST_TIMER.idFromName(body.endpoint));

  if (pathname === '/start') {
    const seconds = Number(body.seconds);
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > MAX_SECONDS) {
      return json(request, { error: 'invalid_seconds' }, 400);
    }
    await timer.start(body.endpoint, seconds);
    return json(request, { ok: true });
  }
  if (pathname === '/stop') {
    await timer.stop();
    return json(request, { ok: true });
  }
  return json(request, await timer.status());
}
