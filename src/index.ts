import express, { Request, Response } from 'express';
import cors from "cors";
import { AccountInfo, Connection, Keypair, LAMPORTS_PER_SOL, NONCE_ACCOUNT_LENGTH, NonceAccount, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { readFileSync } from "fs";

const app = express();
const port = 3000;

app.use(cors())
app.use(express.json());

const vaultAddress = 'http://127.0.0.1:8200'
const vaultToken = 'root'
const solConn = new Connection("https://api.devnet.solana.com", "confirmed");

function retryWithExponentialBackoff(fn, maxAttempts = 5, baseDelayMs = 1000) {
  let attempt = 1

  const execute = async () => {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error
      }
      console.error(error);
      const delayMs = baseDelayMs * 2 ** attempt
      console.log(`Retry attempt ${attempt} after ${delayMs}ms`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))

      attempt++
      return execute()
    }
  }

  return execute()
}

app.post('/init', async (req: Request, res: Response) => {
  const response = await fetch(`${vaultAddress}/v1/solana-secrets-engine/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Vault-Token': vaultToken
    },
    body: JSON.stringify({
      email: req.body.email
    })
  });
  const json = await response.json();
  if (response.ok) {
    res.send({ ...json?.data });
  } else {
    console.error(response.status, json);
    res.sendStatus(500);
  }
})

app.post('/create', async (req: Request, res: Response) => {
  const credResponse = req.body.credential;
  console.log(req.body);

  const response = await fetch(`${vaultAddress}/v1/solana-secrets-engine/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Vault-Token': vaultToken
    },
    body: JSON.stringify({
      email: req.body.email,
      credential: credResponse
    })
  });
  const json = await response.json();
  console.log(JSON.stringify(json));

  if (response.ok) {
    res.send(json);
  } else {
    console.error(response.status, json);
    res.sendStatus(500);
  }
});

app.post('/transaction', async (req: Request, res: Response) => {
  const fooPublicKey = new PublicKey(req.body.pubKey);
  try {
    let airdropSig = await solConn.requestAirdrop(
      fooPublicKey,
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
  } catch (err) { }
  console.log("after airdrop");
  const file = "/home/saber/.config/solana/id.json";
  const authority = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(readFileSync(file).toString()))
  );
  let nonce = Keypair.generate();
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
  console.log("nonce tx after");
  console.log(
    `nonce init hash: ${await solConn.sendTransaction(tx, [
      authority,
      nonce,
    ])}`
  );

  let tfTX64 = "";
  // await retryWithExponentialBackoff(async ()=>{
  let nonceAccount: NonceAccount;
  while (!nonceAccount) {
    try {
      const accountInfo = await solConn.getAccountInfo(nonce.publicKey, {
        commitment: "singleGossip",
      });
      nonceAccount = NonceAccount.fromAccountData(accountInfo.data);
    } catch (err) {
      console.log(err);
    }
  }

  const tfTX = new Transaction().add(
    SystemProgram.nonceAdvance({
      authorizedPubkey: authority.publicKey,
      noncePubkey: nonce.publicKey,
    }),
    SystemProgram.transfer({
      fromPubkey: fooPublicKey,
      toPubkey: new PublicKey("JxjdksqyhRp7ggk7AffwwuMDQay8HyNsE2Df7kQxic2"),
      lamports: LAMPORTS_PER_SOL / 10,
    })
  );
  tfTX.recentBlockhash = nonceAccount.nonce;
  tfTX.feePayer = fooPublicKey;
  tfTX.partialSign(authority);

  tfTX64 = tfTX
    .serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    })
    .toString("base64");
  console.log(
    "Base64 encoded transaction",
    tfTX64
  );
  return res.send({ rawTx: tfTX64 })
});

app.post('/signin', async (req: Request, res: Response) => {
  console.log("signin");

  const response = await fetch(`${vaultAddress}/v1/solana-secrets-engine/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Vault-Token': vaultToken
    },
    body: JSON.stringify({
      email: req.body.email,
      tx: req.body.rawTx,
    })
  });
  const json = await response.json();
  if (response.ok) {
    res.send({ ...json?.data });
  } else {
    console.error(response.status, json);
    res.sendStatus(500);
  }
});

app.post('/complete', async (req: Request, res: Response) => {
  const credResponse = req.body.credential;
  console.log(req.body);

  const response = await fetch(`${vaultAddress}/v1/solana-secrets-engine/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Vault-Token': vaultToken
    },
    body: JSON.stringify({
      email: req.body.email,
      credential: credResponse
    })
  });
  const json = await response.json();
  if (response.ok) {
    res.send({ ...json?.data });
  } else {
    console.error(response.status, json);
    res.sendStatus(500);
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
