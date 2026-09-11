import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const api = 'http://localhost:3000/api/v1';

export const server = setupServer(
  http.get(`${api}/auth/csrf`, () => HttpResponse.json({ csrfToken: 'test.csrf.token' })),
  http.post(`${api}/auth/refresh`, () =>
    HttpResponse.json(
      {
        statusCode: 401,
        code: 'SESSION_EXPIRED',
        message: 'Your session has expired.',
        details: {},
        requestId: 'test-refresh-request',
      },
      { status: 401 },
    ),
  ),
);
