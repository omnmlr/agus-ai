import { open, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { assertDevnet, assertSignature, connectDevnet, createFundingTransaction, readKeypair, sendRpc, signTransfer } from './chain.mjs';

const [file, ...flags] = process.argv.slice(2);
if (!file || flags.length !== 1 || flags[0] !== '--broadcast') {
  console.error('Usage: npm run fund:devnet -- quote.json --broadcast');
  process.exit(2);
}

async function fund() {
  const saved = JSON.parse(await readFile(file, 'utf8'));
  const quote = saved.payment?.quote ?? saved.quote ?? saved;
  if (!/^[0-9a-f-]{36}$/.test(quote.reference)) throw new Error('Invalid payment reference');
  const journalPath = join(dirname(resolve(file)), `.${quote.reference}.devnet-funding.json`);
  const recover = async () => {
    const journal = await readFile(journalPath, 'utf8').catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (journal === null) return false;
    const { signature, lastValidBlockHeight } = JSON.parse(journal);
    assertSignature(signature);
    if (!Number.isSafeInteger(lastValidBlockHeight)) throw new Error('Invalid saved funding lifetime');
    console.log(JSON.stringify({ signature, lastValidBlockHeight, state: 'reconcile_saved_signature' }));
    return true;
  };
  if (await recover()) return;

  const developer = await readKeypair(process.env.AGUS_FUNDING_KEYPAIR_FILE);
  if (developer.address !== quote.developerWallet) {
    throw new Error('The keypair does not match the quoted developer wallet.');
  }
  const rpc = connectDevnet(process.env.AGUS_SETTLEMENT_RPC_URL);
  await assertDevnet(rpc);
  const { value: lifetime } = await sendRpc(rpc.getLatestBlockhash({ commitment: 'finalized' }));
  const transaction = await createFundingTransaction(quote, lifetime, developer);
  const { signature, signedTransaction } = await signTransfer(transaction);

  const entry = { signature, lastValidBlockHeight: Number(lifetime.lastValidBlockHeight) };
  const journal = await open(journalPath, 'wx', 0o600).catch((error) => {
    if (error.code === 'EEXIST') return null;
    throw error;
  });
  if (!journal) {
    if (!await recover()) throw new Error('The funding journal disappeared');
    return;
  }
  try {
    await journal.writeFile(JSON.stringify(entry) + '\n', 'utf8');
    await journal.sync();
  } finally {
    await journal.close();
  }

  console.log(JSON.stringify({ ...entry, state: 'prepared' }));
  try {
    const reported = await sendRpc(rpc.sendTransaction(signedTransaction, {
      encoding: 'base64', maxRetries: 0n, preflightCommitment: 'finalized', skipPreflight: false,
    }));
    if (reported !== signature) throw new Error('Signature mismatch');
    console.log(JSON.stringify({ state: 'submitted', signature }));
  } catch {
    console.error('Funding submission is unresolved. Check the printed signature before signing another transaction.');
    process.exitCode = 1;
  }
}

try {
  await fund();
} catch (error) {
  console.error(error.code === 'QUOTE_EXPIRED' ? error.message : 'Could not prepare the Devnet funding transaction. Check the quote, any existing funding journal, matching disposable keypair and Devnet RPC.');
  process.exitCode = 1;
}
