import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CD2M2FMZVHBXPESBY4E7ZKF2OBSIXZCROGUNUPNDYEVQSVMUG4XJT2RB",
  }
} as const


export interface Client {
  /**
   * Construct and simulate a drip transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Send the fixed drip amount to `to`. `to` must authorize (so you can only
   * fund yourself), must hold a trustline to the token, and must wait out the
   * per-address cooldown between drips.
   */
  drip: ({to}: {to: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  token: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a amount transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  amount: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a available transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Remaining USDC the faucet can dispense.
   */
  available: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {token, amount, cooldown_secs}: {token: string, amount: i128, cooldown_secs: u64},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({token, amount, cooldown_secs}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAALZTZW5kIHRoZSBmaXhlZCBkcmlwIGFtb3VudCB0byBgdG9gLiBgdG9gIG11c3QgYXV0aG9yaXplIChzbyB5b3UgY2FuIG9ubHkKZnVuZCB5b3Vyc2VsZiksIG11c3QgaG9sZCBhIHRydXN0bGluZSB0byB0aGUgdG9rZW4sIGFuZCBtdXN0IHdhaXQgb3V0IHRoZQpwZXItYWRkcmVzcyBjb29sZG93biBiZXR3ZWVuIGRyaXBzLgAAAAAABGRyaXAAAAABAAAAAAAAAAJ0bwAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAFdG9rZW4AAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAGYW1vdW50AAAAAAAAAAAAAQAAAAs=",
        "AAAAAAAAACdSZW1haW5pbmcgVVNEQyB0aGUgZmF1Y2V0IGNhbiBkaXNwZW5zZS4AAAAACWF2YWlsYWJsZQAAAAAAAAAAAAABAAAACw==",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAA1jb29sZG93bl9zZWNzAAAAAAAABgAAAAA=" ]),
      options
    )
  }
  public readonly fromJSON = {
    drip: this.txFromJSON<null>,
        token: this.txFromJSON<string>,
        amount: this.txFromJSON<i128>,
        available: this.txFromJSON<i128>
  }
}