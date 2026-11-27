import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAgusClient } from '../src/typed.mjs';

test('browser/client bearer follows session and encoded resource IDs', async () => {
  let current;
  const requests = [];
  const api = createAgusClient({
    baseUrl: 'https://preview.example.com',
    getToken: () => current,
    fetch: async (request) => {
      requests.push(request);
      return Response.json({ run: { id: 'fixture' } });
    },
  });
  await api.GET('/api/v1/runs/{runId}', { params: { path: { runId: 'literal / id' } } });
  current = 'fixture-session';
  await api.POST('/api/v1/me/sessions/{runId}/stop', { params: { path: { runId: 'fixture' } } });
  assert.equal(requests[0].url, 'https://preview.example.com/api/v1/runs/literal%20%2F%20id');
  assert.equal(requests[0].headers.has('authorization'), false);
  assert.equal(requests[1].headers.get('authorization'), 'Bearer fixture-session');
  assert.equal(requests[1].redirect, 'error');
});
