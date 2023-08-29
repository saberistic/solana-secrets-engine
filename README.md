# Vault Solana Secrets Plugin

# Development purposes only, this has not been audited yet

Solana Secrets is a secrets engine plugin for [HashiCorp Vault](https://www.vaultproject.io/). It is meant to create and store solana accounts and sign transactions with them.

## Usage

All commands can be run using the provided [Makefile](./Makefile). However, it may be instructive to look at the commands to gain a greater understanding of how Vault registers plugins. Using the Makefile will result in running the Vault server in `dev` mode. Do not run Vault in `dev` mode in production. The `dev` server allows you to configure the plugin directory as a flag, and automatically registers plugin binaries in that directory. In production, plugin binaries must be manually registered.

This will build the plugin binary and start the Vault dev server:

```
# Build Solana secrets plugin and start Vault dev server with plugin automatically registered
$ make
```

Now open a new terminal window and run the following commands:

```
# Open a new terminal window and export Vault dev server http address
$ export VAULT_ADDR='http://127.0.0.1:8200'

# Enable the Solana secrets plugin
$ make enable

# Write an account to the Solana secrets engine
$ vault write -f solana-secrets-engine/test
Key       Value
---       -----
pubKey    XXXXXX

# Retrieve a signed transaction from Solana secrets engine
$ vault read solana-secrets-engine/test tx=ZZZZZZ // base64 encoded transaction
Key          Value
---          -----
encodedTX    YYYYYY // base64 encoded signed transaction
pubKey       XXXXXX
```

## License
This project is based on Hashicorp Mock secrets plugin and free to use
