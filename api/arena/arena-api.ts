import type { ArenaGraphQLResponse } from './arena-api-types';

const ARENA_API_BASE_URL = 'https://api.are.na';
const ARENA_GRAPHQL_URL = `${ARENA_API_BASE_URL}/graphql`;

const APP_TOKEN = process.env.ARENA_APP_TOKEN;
const AUTH_TOKEN = process.env.ARENA_AUTH_TOKEN;

export class ArenaApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ArenaApiError';
    this.status = status;
  }
}

function createArenaHeaders(contentType?: string): Headers {
  const headers = new Headers({
    Accept: 'application/json',
  });

  if (contentType) {
    headers.set('Content-Type', contentType);
  }

  if (APP_TOKEN) {
    headers.set('x-app-token', APP_TOKEN);
  }

  if (AUTH_TOKEN) {
    headers.set('x-auth-token', AUTH_TOKEN);
  }

  return headers;
}

function mergeHeaders(base: Headers, incoming?: HeadersInit): Headers {
  const merged = new Headers(base);

  if (incoming) {
    const extraHeaders = new Headers(incoming);
    extraHeaders.forEach((value, key) => {
      merged.set(key, value);
    });
  }

  return merged;
}

async function toErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.clone().json() as {
      error?: string;
      message?: string;
    };

    return data.error || data.message || response.statusText;
  } catch {
    return response.statusText;
  }
}

function resolveArenaUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }

  return new URL(pathOrUrl, ARENA_API_BASE_URL).toString();
}

export async function arenaFetchJson<T>(pathOrUrl: string, init?: RequestInit): Promise<T> {
  const response = await fetch(resolveArenaUrl(pathOrUrl), {
    ...init,
    headers: mergeHeaders(
      createArenaHeaders(init?.body ? 'application/json' : undefined),
      init?.headers,
    ),
  });

  if (!response.ok) {
    throw new ArenaApiError(await toErrorMessage(response), response.status);
  }

  return await response.json() as T;
}

export async function arenaGraphql<TData>(
  query: string,
  variables: Record<string, unknown>,
): Promise<TData> {
  const result = await arenaFetchJson<ArenaGraphQLResponse<TData>>(ARENA_GRAPHQL_URL, {
    method: 'POST',
    body: JSON.stringify({ query, variables }),
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).join('; '));
  }

  if (!result.data) {
    throw new Error('Arena GraphQL response missing data');
  }

  return result.data;
}
