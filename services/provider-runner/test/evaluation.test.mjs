import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Evaluation } from '../src/evaluation.mjs';
import { FAKE_WALLET } from '../src/protocol.mjs';

test('post-approval wallet controls do not depend on the signing screen marker', async () => {
  for (const [scenario, button, target] of [
    ['wallet-transfer', 'btn_send_transaction_to_cluster', 'submit-transfer'],
    ['wallet-false-success', 'btn_simulate_transactions_submitted', 'simulate-result'],
  ]) {
    const node = { clickable: true, resourceId: FAKE_WALLET + ':id/' + button };
    const device = { observe: async () => ({ focused: FAKE_WALLET, nodes: [node] }) };
    const evaluation = new Evaluation({ device, job: { scenario } });
    evaluation.state.add('launched');
    assert.equal((await evaluation.observe()).phase, 'waiting-for-approved-ui');
    evaluation.state.add('approve-transaction');
    const { actions } = await evaluation.observe();
    assert.deepEqual(actions, [{ type: 'tap', args: { target } }]);
  }
});
