import express, { Request, Response } from 'express';
import cors from "cors";
import { AccountInfo, Connection, Keypair, LAMPORTS_PER_SOL, NONCE_ACCOUNT_LENGTH, NonceAccount, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { readFileSync } from "fs";

const app = express();
const port = 3000;

app.use(cors())
app.use(express.json());

const vaultAddress = process.env.VAULT_ADDRESS || 'http://127.0.0.1:8200';
const vaultToken = process.env.ROOT_TOKEN || 'root';
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
  const response = await fetch(`${vaultAddress}/v1/spiral-safe/users`, {
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

  const response = await fetch(`${vaultAddress}/v1/spiral-safe/users`, {
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
  let blockInfo = await solConn.getLatestBlockhash("confirmed");
  const tfTX = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fooPublicKey,
      toPubkey: new PublicKey("33wvmHvb3ZQy26QEyfjw5hMJKkFchctsQH2nG2XCbeVk"),
      lamports: LAMPORTS_PER_SOL / 10,
    })
  );
  tfTX.recentBlockhash = blockInfo.blockhash;
  tfTX.feePayer = fooPublicKey;

  const tfTX64 = tfTX
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

  const response = await fetch(`${vaultAddress}/v1/spiral-safe/auth`, {
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

  const response = await fetch(`${vaultAddress}/v1/spiral-safe/auth`, {
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
