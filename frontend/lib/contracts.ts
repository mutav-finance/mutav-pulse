import { Client as VaultClient, type RedeemRequest, type StrategyAlloc } from "vault";
import { Client as PolicyClient, type Guarantee } from "policy";
import { Client as RegistryClient } from "registry";
import { Client as StrategyClient } from "strategy";
import { config } from "./config";

export interface ReserveContracts {
  vault: string;
  policy: string;
  registry: string;
}

/** Shared client options for any contract on this network — one rpc + passphrase. */
const clientOpts = (contractId: string) => ({
  rpcUrl: config.rpcUrl,
  contractId,
  networkPassphrase: config.networkPassphrase,
});

export function reserveReads(c: ReserveContracts) {
  const vaultClient = () => new VaultClient(clientOpts(c.vault));
  const policyClient = () => new PolicyClient(clientOpts(c.policy));
  const registryClient = () => new RegistryClient(clientOpts(c.registry));

  return {
    async vaultTotalAssets(): Promise<bigint> {
      const tx = await vaultClient().total_assets();
      return tx.result;
    },

    async vaultStableAssets(): Promise<bigint> {
      const tx = await vaultClient().stable_assets();
      return tx.result;
    },

    async vaultNavPerShare(): Promise<bigint> {
      const tx = await vaultClient().nav_per_share();
      return tx.result;
    },

    async vaultFreeCapital(): Promise<bigint> {
      const tx = await vaultClient().free_capital();
      return tx.result;
    },

    /**
     * Liquidity held by the vault itself (not deployed to any strategy). The
     * vault identity is `total_assets = available_held + Σ strategy balances`,
     * so `deployed = total_assets − available_held`. This is the honest, live
     * "deployed vs idle" split — distinct from the allocator's TARGET weights.
     */
    async vaultAvailableHeld(): Promise<bigint> {
      const tx = await vaultClient().available_held();
      return tx.result;
    },

    /**
     * Live balance a single strategy adapter holds for this vault (its own
     * `balance()` view, read via simulation — no signing). Lets the UI show the
     * real amount deployed per venue instead of the target weight.
     */
    async strategyBalance(address: string): Promise<bigint> {
      const tx = await new StrategyClient(clientOpts(address)).balance();
      return tx.result;
    },

    async vaultPremiumIncome(): Promise<bigint> {
      const tx = await vaultClient().premium_income();
      return tx.result;
    },

    async vaultTotalSupply(): Promise<bigint> {
      const tx = await vaultClient().total_supply();
      return tx.result;
    },

    async vaultBalance(addr: string): Promise<bigint> {
      const tx = await vaultClient().balance({ account: addr });
      return tx.result;
    },

    async vaultStrategies(): Promise<Array<StrategyAlloc>> {
      const tx = await vaultClient().strategies();
      return tx.result;
    },

    async vaultPendingRequests(): Promise<Array<number>> {
      const tx = await vaultClient().pending_requests();
      return tx.result;
    },

    async vaultRequest(id: bigint): Promise<RedeemRequest> {
      const tx = await vaultClient().request({ id: Number(id) });
      return tx.result;
    },

    async vaultAdmin(): Promise<string> {
      const tx = await vaultClient().admin();
      return tx.result;
    },

    async policyCoverageRequired(): Promise<bigint> {
      const tx = await policyClient().coverage_required();
      return tx.result;
    },

    async policyAdmin(): Promise<string> {
      const tx = await policyClient().admin();
      return tx.result;
    },

    async policyGuarantee(id: bigint): Promise<Guarantee> {
      const tx = await policyClient().guarantee({ id: Number(id) });
      return tx.result;
    },

    async policyIsCurrent(id: bigint): Promise<boolean> {
      const tx = await policyClient().is_current({ id: Number(id) });
      return tx.result;
    },

    async registryActiveIds(): Promise<Array<number>> {
      const tx = await registryClient().active_ids();
      return tx.result;
    },
  };
}

export type Reads = ReturnType<typeof reserveReads>;

/** Default reads bound to the primary (live) reserve. Existing call sites unchanged. */
export const reads: Reads = reserveReads({
  vault: config.contracts.vault,
  policy: config.contracts.policy,
  registry: config.contracts.registry,
});
