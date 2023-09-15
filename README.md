# Spiral Safe

# Development purposes only, this has not been audited yet

Spiral Safe is a secrets engine plugin for [HashiCorp Vault](https://www.vaultproject.io/). It is meant to create and store solana accounts and sign transactions with them.

## Usage

All commands can be run using the provided [Makefile](./Makefile). However, it may be instructive to look at the commands to gain a greater understanding of how Vault registers plugins. Using the Makefile will result in running the Vault server in `dev` mode. Do not run Vault in `dev` mode in production. The `dev` server allows you to configure the plugin directory as a flag, and automatically registers plugin binaries in that directory. In production, plugin binaries must be manually registered.

This will build the plugin binary and start the Vault dev server:

```
# Build Spiral Safe plugin and start Vault dev server with plugin automatically registered
$ make
```

Now open a new terminal window and run the following commands:

```
# Enable the Solana secrets plugin
$ make enable
```

## Bussiness Plan
It could be found [here](https://github.com/spiral-safe/services/blob/main/BusinessPlan.md)
