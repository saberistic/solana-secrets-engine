import {
  PublicKey,
  Connection,
  LAMPORTS_PER_SOL,
  Keypair,
  Transaction,
  SystemProgram,
  NonceAccount,
  sendAndConfirmRawTransaction,
  NONCE_ACCOUNT_LENGTH,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { readFileSync } from "fs";

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

describe("make a transaction", () => {

  const solConn = new Connection("https://api.devnet.solana.com", "confirmed");

  let nonce = Keypair.generate();
  const file = "/home/saber/.config/solana/id.json";
  const authority = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(readFileSync(file).toString()))
  );
  //   let authority = Keypair.generate();
  let fooPubKey = new PublicKey("9vn6htay59K9MRxJfysUG5jsPV73x46H4xC6MpU33GeF");
  let recipientPubKey = new PublicKey(
    "2ocFY4FUppAFoVnApmyxk8nh7Ft1dMuVwrJx5bqKKdEU"
  );

    it("should airdrop", async () => {
      let airdropSig = await solConn.requestAirdrop(
        fooPubKey,
        LAMPORTS_PER_SOL * 1
      );
      let blockInfo = await solConn.getLatestBlockhash("confirmed");
      await solConn.confirmTransaction(
        {
          signature: airdropSig,
          blockhash: blockInfo.blockhash,
          lastValidBlockHeight: blockInfo.lastValidBlockHeight,
        },
        "finalized"
      );
      console.log(`airdropped 1 SOL to ${fooPubKey.toBase58()}`);
    });
  it("should initialize nonce", async () => {
    let tx = new Transaction().add(
      // create nonce account
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: nonce.publicKey,
        lamports: await solConn.getMinimumBalanceForRentExemption(
          NONCE_ACCOUNT_LENGTH
        ),
        space: NONCE_ACCOUNT_LENGTH,
        programId: SystemProgram.programId,
      }),
      // init nonce account
      SystemProgram.nonceInitialize({
        noncePubkey: nonce.publicKey, // nonce account pubkey
        authorizedPubkey: authority.publicKey, // nonce account authority (for advance and close)
      })
    );
    console.log(
      `nonce init hash: ${await solConn.sendTransaction(tx, [
        authority,
        nonce,
      ])}`
    );
  });

  it("should create a transfer transaction", async () => {
    await wait(3000);
    console.log(nonce.publicKey.toBase58());
    let accountInfo = await solConn.getAccountInfo(nonce.publicKey, "confirmed");
    let nonceAccount = NonceAccount.fromAccountData(accountInfo.data);

    const tx = new Transaction().add(
      SystemProgram.nonceAdvance({
        authorizedPubkey: authority.publicKey,
        noncePubkey: nonce.publicKey,
      }),
      SystemProgram.transfer({
        fromPubkey: fooPubKey,
        toPubkey: recipientPubKey,
        lamports: LAMPORTS_PER_SOL / 100,
      })
    );
    tx.recentBlockhash = nonceAccount.nonce;
    tx.feePayer = fooPubKey;
    tx.partialSign(authority);

    console.log(
      "Base64 encoded transaction",
      tx
        .serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        })
        .toString("base64")
    );
  });
});
