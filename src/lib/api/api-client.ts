import type { ApiErrorShape } from '../../types/domain';

const environment = import.meta.env as unknown as Record<string, unknown>;
const API_URL =
  typeof environment.VITE_API_URL === 'string'
    ? environment.VITE_API_URL
    : 'http://localhost:3000/api/v1';
let csrfToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export class ApiError extends Error {
  constructor(readonly response: ApiErrorShape) {
    super(response.message);
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown; skipRefresh?: boolean };

const isMutation = (method: string) => !['GET', 'HEAD', 'OPTIONS'].includes(method);

async function obtainCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API_URL}/auth/csrf`, { credentials: 'include' });
  if (!response.ok) throw await toError(response);
  const body = (await response.json()) as { csrfToken: string };
  csrfToken = body.csrfToken;
  return body.csrfToken;
}

async function performRefresh(csrfRetried = false): Promise<boolean> {
  const token = await obtainCsrf();
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF-Token': token },
  });
  if (response.ok) return true;

  const error = await toError(response);
  if (error.response.code === 'CSRF_VALIDATION_FAILED' && !csrfRetried) {
    csrfToken = null;
    return performRefresh(true);
  }
  return false;
}

async function refresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        return await performRefresh();
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function toError(response: Response): Promise<ApiError> {
  const fallback: ApiErrorShape = {
    statusCode: response.status,
    code: `HTTP_${response.status}`,
    message:
      response.status >= 500
        ? 'The service is temporarily unavailable.'
        : 'The request could not be completed.',
    details: {},
    requestId: response.headers.get('x-request-id') ?? '',
  };
  try {
    return new ApiError({ ...fallback, ...((await response.json()) as Partial<ApiErrorShape>) });
  } catch {
    return new ApiError(fallback);
  }
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  refreshRetried = false,
  csrfRetried = false,
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (isMutation(method)) headers.set('X-CSRF-Token', await obtainCsrf());
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) body = options.body;
  else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    method,
    headers,
    body,
    credentials: 'include',
  });
  const requestError = response.ok ? null : await toError(response);
  if (
    requestError?.response.code === 'CSRF_VALIDATION_FAILED' &&
    isMutation(method) &&
    !csrfRetried
  ) {
    csrfToken = null;
    return request<T>(path, options, refreshRetried, true);
  }
  if (
    response.status === 401 &&
    !refreshRetried &&
    !options.skipRefresh &&
    path !== '/auth/refresh'
  ) {
    if (await refresh()) return request<T>(path, options, true, csrfRetried);
  }
  if (requestError) throw requestError;
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function requestStream<T>(
  path: string,
  body: unknown,
  onEvent: (event: T) => void,
  retried = false,
): Promise<void> {
  const token = await obtainCsrf();
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token,
      Accept: 'application/x-ndjson',
    },
    body: JSON.stringify(body),
  });
  if (response.status === 401 && !retried && !path.startsWith('/auth/')) {
    if (await refresh()) return requestStream(path, body, onEvent, true);
  }
  if (!response.ok) throw await toError(response);
  if (!response.body) throw new Error('The response stream is unavailable.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamErrorMessage: string | null = null;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as T;
    onEvent(event);
    if (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      event.type === 'error' &&
      'message' in event &&
      typeof event.message === 'string'
    ) {
      streamErrorMessage = event.message;
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) consume(line);
    if (done) break;
  }
  consume(buffer);
  if (streamErrorMessage) throw new Error(streamErrorMessage);
}

export const apiClient = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T = void>(path: string) => request<T>(path, { method: 'DELETE' }),
  form: <T>(path: string, fields: Record<string, string>, file?: File) => {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.append(key, value);
    if (file) body.append('file', file);
    return request<T>(path, { method: 'POST', body });
  },
  upload: <T>(path: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<T>(path, { method: 'POST', body });
  },
  stream: <T>(path: string, body: unknown, onEvent: (event: T) => void) =>
    requestStream(path, body, onEvent),
  clearCsrf: () => {
    csrfToken = null;
  },
};
