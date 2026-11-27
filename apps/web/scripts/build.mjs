import { cp, mkdir } from 'node:fs/promises';

const source = new URL('../public/', import.meta.url);
const distribution = new URL('../dist/', import.meta.url);
await mkdir(distribution, { recursive: true });
await cp(source, distribution, { recursive: true });
console.log('Web assets built in apps/web/dist/');
