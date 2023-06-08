import express, { Request, Response } from 'express';
import fetch from 'node-fetch';

const app = express();
const port = 3000;

app.use(express.json());

app.get('/init', async(req: Request, res: Response)=>{
    const response = await fetch('http://localhost')
})

// Endpoint to store the WebAuthn credential in HashiCorp Vault
app.post('/store-credential', async (req: Request, res: Response) => {
  try {
    // Extract the WebAuthn credential data from the request body
    const credential = req.body;

    // Send the credential data to HashiCorp Vault for storage
    const response = await fetch('http://vault-server:8200/v1/secret/data/webauthn', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vault-Token': 'YOUR_VAULT_TOKEN' // Replace with your actual Vault token
      },
      body: JSON.stringify({
        data: credential
      })
    });

    // Handle the response from HashiCorp Vault
    if (response.ok) {
      res.sendStatus(200);
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
