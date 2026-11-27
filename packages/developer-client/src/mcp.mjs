import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { actions, modes, scenarios } from './api.mjs';

const runId = z.uuid();
const idempotencyKey = z.string().regex(/^[\w.-]{1,128}$/).optional();
const expectedTransaction = z.object({
  network: z.enum(['devnet', 'localnet']),
  recipient: z.string().min(32).max(44),
  payer: z.string().min(32).max(44).optional(),
  lamports: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

export async function serveMcp(client) {
  const server = new McpServer({ name: 'agus-developer', version: '0.1.0' });
  const add = (name, description, inputSchema, readOnlyHint, run) => server.registerTool(name, {
    description, inputSchema, annotations: { readOnlyHint, openWorldHint: true },
  }, async (input) => {
    try {
      const value = await run(input);
      return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value };
    } catch (error) {
      return { content: [{ type: 'text', text: error.message }], isError: true };
    }
  });
  add('list_devices', 'List dedicated Android devices and supported scenarios visible to this account.', {}, true,
    () => client.devices());
  add('list_projects', 'List projects owned by the authenticated developer.', {}, true,
    () => client.projects());
  add('list_builds', 'List registered APK builds and their checksums.', {}, true,
    () => client.builds());
  add('list_runs', 'List runs belonging to the authenticated developer.', {}, true,
    () => client.runs());
  add('start_run', 'Queue a supported scenario on a dedicated device. Wallet scenarios may use disposable test funds.', {
    projectId: z.uuid(), buildId: z.uuid(), scenario: z.enum(scenarios), mode: z.enum(modes),
    deviceId: z.string().max(120).optional(), expectedTransaction: expectedTransaction.optional(),
    idempotencyKey,
  }, false, ({ idempotencyKey, ...input }) => client.createRun(input, idempotencyKey));
  add('list_private_requests', 'List private invitations involving this account.', {}, true,
    () => client.invitations());
  add('request_private_device', 'Request an unpaid private test on a known dedicated device. The provider must explicitly review and accept.', {
    projectId: z.uuid(), buildId: z.uuid(), deviceId: z.string().min(1).max(120),
    scenario: z.enum(scenarios), mode: z.enum(modes),
    expectedTransaction: expectedTransaction.optional(), idempotencyKey,
  }, false, async ({ idempotencyKey, ...input }) => {
    const { invitation } = await client.createInvitation({ ...input, kind: 'developer_request' }, idempotencyKey);
    return { invitation };
  });
  add('get_run', 'Read status, runner-signed evidence, and independent chain status for one run.', { runId }, true,
    ({ runId }) => client.run(runId));
  add('list_run_events', 'Inspect recent ordered events and look for evidence or recovery states.', { runId }, true,
    ({ runId }) => client.events(runId));
  add('list_agent_actions', 'Observe the agent action queue and completed action results.', { runId }, true,
    ({ runId }) => client.agentActions(runId));
  add('agent_action', 'Queue one bounded semantic action in an authorized live agent run. Tap targets must come from its scenario.', {
    runId, type: z.enum(actions),
    args: z.object({ target: z.string().max(100).optional(), ms: z.number().int().min(0).max(5_000).optional() }).optional(),
  }, false, ({ runId, type, args }) => client.act(runId, { type, args }));
  add('cancel_run', 'Request a safe stop of the developer’s run and inspect its final state.', { runId }, false,
    ({ runId }) => client.cancel(runId));
  await server.connect(new StdioServerTransport());
}
