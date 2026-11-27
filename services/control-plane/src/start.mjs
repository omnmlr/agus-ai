import { createControlPlane } from './server.mjs';

try {
  const { server, config, store } = await createControlPlane();
  server.listen(config.port, config.host, () => {
    const { address, port } = server.address();
    console.log(`Control plane listening at http://${address}:${port}`);
  });
  function close() {
    server.close(() => store.close());
  }
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
} catch (error) {
  const diagnostic = error.code ?? (error.message.startsWith('AGUS_') || error.message.startsWith('Configure ')
    ? error.message : error.name);
  console.error('Control-plane startup failed', diagnostic);
  process.exitCode = 1;
}
