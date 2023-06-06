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

  it("should submit transaction", async () => {
    const serializedTx =
      "AkprMedJgLJLJOidn8pMh34OVTm5mlJ8Eyg/HcnglWTgW+6D5hbCuKXnJkynnbEAvTeIF0vkBAQ0WTvq8A5ZswH4CuLTefghZUYhFs3qn8F8BRt9N4NTKTBZlPDF16TIVhYfCuYS7Xg1xWmA2SSD+MAkxAWwp+1PnX8meWNxbdgCAgECBoSkRWuJ1ypmHp1WQrHA30W5Oupd1ztQaZvk1keZkJKcNCBR4JZvkL1taWv1dMoN7zHebVD+/Q6kwK/sEZhtg9EazEMbaBWVfibTfx2WztNsLvMh/BhZoTT/CdWM17ovjSK6OXk3PinQyLnATEPBKvbQNAdGbg+ktK0OHCxEww7LAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGp9UXGSxWjuCKhF9z0peIzwNcMUWyGrNE2AYuqUAAAOYgsNPaODt5FYk4lwMHRdjoS/pdnT06i6A259Zk3xikAgQDAwUBBAQAAAAEAgACDAIAAACAlpgAAAAAAA==";
    const tx = Transaction.from(Buffer.from(serializedTx, "base64"));
    // console.log(tx);
    const sz = tx.serialize({
      requireAllSignatures: true,
      verifySignatures: true,
    });
    const sig = await sendAndConfirmRawTransaction(solConn, sz, {
      commitment: "confirmed",
      //   skipPreflight: true,
    });
    console.log(sig);
  });
});
