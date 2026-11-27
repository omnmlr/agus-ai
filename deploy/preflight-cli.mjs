import { validateDeployment } from './preflight.mjs';

try {
  validateDeployment(process.env);
} catch (error) {
  console.error(`AGUS AI deployment preflight failed. ${error.message}`);
  process.exitCode = 1;
}
