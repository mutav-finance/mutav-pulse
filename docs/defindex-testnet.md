# DeFindex testnet vault

`adapter-defindex` needs a DeFindex vault address (single USDC asset). Two ways:

1. **Create one via the DeFindex factory** (preferred, self-contained). Resolve the
   current testnet factory id from https://docs.defindex.io and call
   `create_defindex_vault` with: assets = [USDC], an underlying DeFindex strategy
   for USDC, manager = our admin, emergency_manager/fee_receiver = our admin. Record
   the returned vault id and export it as `DEFINDEX_VAULT`.
2. **Use an existing public testnet USDC vault** if DeFindex publishes one — export
   its id as `DEFINDEX_VAULT`.

If neither is available at demo time, set `DEFINDEX_VAULT` empty and the bootstrap
wires `mock-strategy` instead (the adapter + its tests still ship). The adapter is
vault-agnostic — only `set_vault` changes.
