const CORS_ORIGINS = new Set([
  'https://henry.ink',
  'http://127.0.0.1:3003',
  'http://localhost:3003',
]);

export function getCorsHeaders(origin?: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && CORS_ORIGINS.has(origin) ? origin : '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export function optionsResponse(req: Request): Response {
  const origin = req.headers.get('Origin') || '';
  return new Response(null, {
    status: 204,
    headers: {
      ...getCorsHeaders(origin),
      'Access-Control-Max-Age': '86400',
    },
  });
}
