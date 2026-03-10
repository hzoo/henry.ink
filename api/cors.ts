const CORS_ORIGINS = new Set([
  'https://henry.ink',
  'http://127.0.0.1:3003',
  'http://localhost:3003',
]);

export function getCorsHeaders(origin?: string): Record<string, string> {
  // Only allow known origins — omit header for unknown origins (browser blocks the response)
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (origin && CORS_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
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
