import { http, HttpResponse } from 'msw';
import { apiClient } from './api-client';
import { server } from '../../test/server';
import { MAX_FUNCTION_UPLOAD_BYTES } from './upload-limits';

const api = 'http://localhost:3000/api/v1';

describe('apiClient CSRF recovery', () => {
  beforeEach(() => apiClient.clearCsrf());

  it('obtains a fresh token and retries once when the CSRF cookie is stale', async () => {
    let csrfRequests = 0;
    let loginRequests = 0;
    server.use(
      http.get(`${api}/auth/csrf`, () => {
        csrfRequests += 1;
        return HttpResponse.json({ csrfToken: `csrf-token-${csrfRequests}` });
      }),
      http.post(`${api}/auth/login`, ({ request }) => {
        loginRequests += 1;
        if (loginRequests === 1) {
          expect(request.headers.get('x-csrf-token')).toBe('csrf-token-1');
          return HttpResponse.json(
            {
              statusCode: 403,
              code: 'CSRF_VALIDATION_FAILED',
              message: 'Security token validation failed.',
              details: {},
              requestId: 'request-1',
            },
            { status: 403 },
          );
        }
        expect(request.headers.get('x-csrf-token')).toBe('csrf-token-2');
        return HttpResponse.json({ userId: 'user-1' });
      }),
    );

    await expect(
      apiClient.post<{ userId: string }>(
        '/auth/login',
        { email: 'admin@example.test', password: 'password123' },
        { skipRefresh: true },
      ),
    ).resolves.toEqual({ userId: 'user-1' });
    expect(csrfRequests).toBe(2);
    expect(loginRequests).toBe(2);
  });

  it('refreshes an expired access token for auth/me and retries stale CSRF once', async () => {
    let csrfRequests = 0;
    let refreshRequests = 0;
    let meRequests = 0;
    server.use(
      http.get(`${api}/auth/csrf`, () => {
        csrfRequests += 1;
        return HttpResponse.json({ csrfToken: `refresh-csrf-${csrfRequests}` });
      }),
      http.post(`${api}/auth/refresh`, ({ request }) => {
        refreshRequests += 1;
        if (refreshRequests === 1) {
          expect(request.headers.get('x-csrf-token')).toBe('refresh-csrf-1');
          return HttpResponse.json(
            {
              statusCode: 403,
              code: 'CSRF_VALIDATION_FAILED',
              message: 'Security token validation failed.',
              details: {},
              requestId: 'request-refresh-1',
            },
            { status: 403 },
          );
        }
        expect(request.headers.get('x-csrf-token')).toBe('refresh-csrf-2');
        return new HttpResponse(null, { status: 204 });
      }),
      http.get(`${api}/auth/me`, () => {
        meRequests += 1;
        if (meRequests === 1) {
          return HttpResponse.json(
            {
              statusCode: 401,
              code: 'UNAUTHENTICATED',
              message: 'Authentication is required.',
              details: {},
              requestId: 'request-me-1',
            },
            { status: 401 },
          );
        }
        return HttpResponse.json({ userId: 'user-1' });
      }),
    );

    await expect(apiClient.get<{ userId: string }>('/auth/me')).resolves.toEqual({
      userId: 'user-1',
    });
    expect(csrfRequests).toBe(2);
    expect(refreshRequests).toBe(2);
    expect(meRequests).toBe(2);
  });
});

describe('apiClient upload limits', () => {
  it('rejects oversized multipart files before requesting CSRF or sending a request', () => {
    const file = new File([new Uint8Array(MAX_FUNCTION_UPLOAD_BYTES + 1)], 'brief.docx');
    expect(() => apiClient.upload('/events/event-a/documents', file)).toThrow('This file needs a secure direct upload.');
    expect(() => apiClient.form('/events/setup/analyze', { sessionId: 'setup-a' }, file)).toThrow('This file needs a secure direct upload.');
  });
});
