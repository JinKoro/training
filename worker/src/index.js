import { DurableObject } from 'cloudflare:workers';

const ALLOWED_ORIGIN = 'https://jinkoro.github.io';
const VAPID_SUBJECT = 'https://jinkoro.github.io/training/';
const MAX_SECONDS = 1800;
const PUSH_TTL_SECONDS = 60;
const JWT_LIFETIME_SECONDS = 3600;

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

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

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    if (request.headers.get('Origin') !== ALLOWED_ORIGIN) return json({ error: 'forbidden' }, 403);

    const body = await request.json().catch(() => null);
    if (!isApplePushEndpoint(body?.endpoint)) return json({ error: 'invalid_endpoint' }, 400);

    const timer = env.REST_TIMER.get(env.REST_TIMER.idFromName(body.endpoint));
    const { pathname } = new URL(request.url);

    if (pathname === '/start') {
      const seconds = Number(body.seconds);
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > MAX_SECONDS) {
        return json({ error: 'invalid_seconds' }, 400);
      }
      await timer.start(body.endpoint, seconds);
      return json({ ok: true });
    }
    if (pathname === '/stop') {
      await timer.stop();
      return json({ ok: true });
    }
    if (pathname === '/status') return json(await timer.status());
    return json({ error: 'not_found' }, 404);
  },
};
