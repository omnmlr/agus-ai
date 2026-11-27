import { createControlPlane } from '../../services/control-plane/src/server.mjs';
import assets from 'agus-web-assets';
import { createNeonHandler } from './adapter.mjs';
import { neonRuntimeEnv } from './bindings.mjs';

export default createNeonHandler({
  assets,
  maintenance: process.env.AGUS_NEON_API_MAINTENANCE === '1',
  createService: () => createControlPlane({ env: neonRuntimeEnv(process.env) }),
  reportError: error => {
    if (error.name !== 'AbortError') console.error('AGUS AI control-plane request unavailable', error.name);
  },
});
