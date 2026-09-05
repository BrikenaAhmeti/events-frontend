import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const api = 'http://localhost:3000/api/v1';

export const server = setupServer(
  http.get(`${api}/auth/csrf`, () => HttpResponse.json({ csrfToken: 'test.csrf.token' })),
);
