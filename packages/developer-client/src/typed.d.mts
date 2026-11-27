import type { Client, ClientOptions } from 'openapi-fetch';
import type { paths, components } from './http.generated.js';

export type { paths, components } from './http.generated.js';
export type AgusTypes = components['schemas'];

export declare function createAgusClient(options?: {
  baseUrl?: string;
  getToken?: () => string | undefined | Promise<string | undefined>;
  fetch?: ClientOptions['fetch'];
}): Client<paths>;
