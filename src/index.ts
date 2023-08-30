import express, { Request, Response } from 'express';
import cors from "cors";

const app = express();
const port = 3000;

app.use(cors())
app.use(express.json());

app.post('/init', async (req: Request, res: Response) => {
  const response = await fetch(`http://127.0.0.1:8200/v1/solana-secrets-engine/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Vault-Token': 'root' // Replace with your actual Vault token
    },
    body: JSON.stringify({
      email: req.body.email
    })
  });
  const json = await response.json();
  console.log(response.status, json);
  return res.send({ ...json?.data });
})

// Endpoint to store the WebAuthn credential in HashiCorp Vault
app.post('/create', async (req: Request, res: Response) => {
  try {
    // Extract the WebAuthn credential data from the request body
    const credResponse = req.body.credential;
    console.log(req.body);

    // Send the credential data to HashiCorp Vault for storage
    const response = await fetch('http://127.0.0.1:8200/v1/solana-secrets-engine/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vault-Token': 'root' // Replace with your actual Vault token
      },
      body: JSON.stringify({
        email: req.body.email,
        credential: credResponse
      })
    });
    const json = await response.json();
    console.log(JSON.stringify(json));

    // Handle the response from HashiCorp Vault
    if (response.ok) {
      res.send(json);
    } else {
      res.sendStatus(500);
    }
  } catch (error) {
    console.error('Error storing WebAuthn credential:', error);
    res.sendStatus(500);
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
