const ALLOWED_ORIGINS = new Set([
  'https://jinkoro.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

export function isAllowedOrigin(request) {
  const origin = request.headers.get('Origin');
  return origin === null || ALLOWED_ORIGINS.has(origin);
}

export function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://jinkoro.github.io',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) },
  });
}

export class HttpError extends Error {
  constructor(status, code, field) {
    super(code);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export const fail = (status, code, field) => {
  throw new HttpError(status, code, field);
};

export async function readJson(request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'invalid_json');
  return body;
}
