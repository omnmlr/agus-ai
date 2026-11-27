import { createServer } from "node:http";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { connection, localRpc, startWindow } from "../src/chain";
import { publicKey } from "../src/contracts";

export const fixtureRecipient = Keypair.fromSeed(Buffer.alloc(32, 85)).publicKey;
export const fixtureLamports = 1_000_000;

async function serve() {
  const isDevnet = process.env.AGUS_TEST_CHAIN === "devnet";
  const expected = process.env.AGUS_TEST_LOCAL_GENESIS;
  const network = isDevnet ? { cluster: "devnet" as const } : { cluster: "localnet" as const, genesis: publicKey.parse(expected) };
  const rpc = isDevnet ? connection(network) : new Connection(localRpc, "confirmed");
  const { genesis } = await startWindow(rpc, network);
  const allowedPayer = isDevnet ? publicKey.parse(process.env.AGUS_TEST_DEVNET_PAYER) : null;
  const recipient = isDevnet ? new PublicKey(publicKey.parse(process.env.AGUS_TEST_DEVNET_RECIPIENT)) : fixtureRecipient;
  if (allowedPayer === recipient.toBase58()) throw new Error("Devnet payer and recipient must differ");
  async function fund(payer: PublicKey) {
    if (await rpc.getBalance(payer, "confirmed") >= 10_000_000) return;
    const blockhash = await rpc.getLatestBlockhash("confirmed");
    const signature = await rpc.requestAirdrop(payer, 50_000_000);
    const result = await rpc.confirmTransaction({ ...blockhash, signature }, "confirmed");
    if (result.value.err) throw new Error("Local fixture faucet failed");
  }
  if (!isDevnet) await fund(recipient);

  const server = createServer(async (request, response) => {
    const input = /^\/prepare\/([1-9A-HJ-NP-Za-km-z]+)$/.exec(request.url ?? "");
    const payer = publicKey.safeParse(input?.[1]);
    if (request.method !== "GET" || !payer.success || (payer.data === recipient.toBase58() || (allowedPayer !== null && payer.data !== allowedPayer))) {
      response.writeHead(400).end();
      return;
    }
    try {
      const source = new PublicKey(payer.data);
      if (isDevnet) {
        const balance = await rpc.getBalance(source, "confirmed");
        if (balance < fixtureLamports + 5_000) { response.writeHead(409).end(); return; }
      } else {
        await fund(source);
      }
      const { blockhash } = await rpc.getLatestBlockhash("confirmed");
      const transaction = new Transaction({ feePayer: source, recentBlockhash: blockhash })
        .add(SystemProgram.transfer({ fromPubkey: source, toPubkey: recipient, lamports: fixtureLamports }));
      response.writeHead(200, { "Content-Type": "text/plain", "Cache-Control": "no-store" })
        .end(transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"));
    } catch { response.writeHead(503).end(); }
  });
  server.listen(8898, "127.0.0.1", () => console.log(JSON.stringify({
    genesis, recipient: recipient.toBase58(), lamports: fixtureLamports,
  })));
}

serve().catch((error) => { console.error(error.message); process.exitCode = 1; });
