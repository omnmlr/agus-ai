import createClient from 'openapi-fetch';

export function createAgusClient({ baseUrl, getToken, fetch: fetchImpl = fetch } = {}) {
  const client = createClient({
    baseUrl,
    redirect: 'error',
    fetch: fetchImpl,
  });
  client.use({
    async onRequest({ request }) {
      const token = await getToken?.();
      if (token) request.headers.set('authorization', `Bearer ${token}`);
      return request;
    },
  });
  return client;
}
