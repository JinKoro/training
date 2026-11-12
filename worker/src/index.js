import { HttpError, corsHeaders, isAllowedOrigin, json } from './http.js';
import { handleTimer } from './timer.js';
import { handleApi } from './api.js';

export { RestTimer } from './timer.js';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request) });
    if (!isAllowedOrigin(request)) return json(request, { error: 'forbidden' }, 403);

    const { pathname } = new URL(request.url);
    try {
      if (pathname.startsWith('/api/')) return await handleApi(request, env, pathname.slice(4));
      if (request.method === 'POST' && ['/start', '/stop', '/status'].includes(pathname)) {
        return await handleTimer(request, env, pathname);
      }
      return json(request, { error: 'not_found' }, 404);
    } catch (error) {
      if (error instanceof HttpError) return json(request, { error: error.code, field: error.field }, error.status);
      console.error(error);
      return json(request, { error: 'server_error' }, 500);
    }
  },
};
