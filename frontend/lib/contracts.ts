import { Client as VaultClient, type RedeemRequest, type StrategyAlloc } from "vault";
import { Client as PolicyClient, type Guarantee } from "policy";
import { Client as RegistryClient } from "registry";
import { Client as AttestorClient, type Attestation } from "attestor";
import { config } from "./config";

export type { Attestation } from "attestor";

function vaultClient(): VaultClient {
  return new VaultClient({
    rpcUrl: config.rpcUrl,
    contractId: config.contracts.vault,
    networkPassphrase: config.networkPassphrase,
  });
}

function policyClient(): PolicyClient {
  return new PolicyClient({
    rpcUrl: config.rpcUrl,
    contractId: config.contracts.policy,
    networkPassphrase: config.networkPassphrase,
  });
}

function registryClient(): RegistryClient {
  return new RegistryClient({
    rpcUrl: config.rpcUrl,
    contractId: config.contracts.registry,
    networkPassphrase: config.networkPassphrase,
  });
}

function attestorClient(): AttestorClient {
  return new AttestorClient({
    rpcUrl: config.rpcUrl,
    contractId: config.contracts.attestor,
    networkPassphrase: config.networkPassphrase,
  });
}

export const reads = {
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

  /** Selo de solvência ZK: última atestação gravada on-chain (null se nunca houve).
   *  `solvent` só é true p/ cobertura >= 100% (piso MIN_RATIO_BPS no attestor); o
   *  frescor vem de `ts`/`ledger`. Leitura pública, sem carteira. */
  async solvencyAttestation(): Promise<Attestation | null> {
    const tx = await attestorClient().last_attestation();
    return tx.result ?? null;
  },
};
