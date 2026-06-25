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
    contractId: "CA7WWXTNBG2QCDBQMYL3SV7DRXBW7KALM5JGWPJJEAP34DWWUMLYGSKN",
  }
} as const


/**
 * Stable core of a guarantee. Model-specific extras live in the policy's own
 * storage, keyed by id — never here.
 */
export interface Guarantee {
  active: boolean;
  fee_bps: u32;
  id: u32;
  landlord: string;
  monthly_amount: i128;
  months_covered: u32;
  months_used: u32;
  paid_until: u64;
  period_secs: u64;
}

/**
 * Errors surfaced across the registry boundary. Defined here (not in the
 * `registry` crate) because the `Registry` trait's return type references it,
 * so every consumer of the generated `RegistryClient` sees the same stable
 * `#[contracterror]` codes. Numbered in the `2xx` band to stay clear of the
 * `4xx` strategy codes in `defindex-hodl`.
 */
export const RegistryError = {
  /**
   * No guarantee is stored under the requested id (previously a host trap
   * from `Option::unwrap` on missing storage).
   */
  200: {message:"GuaranteeNotFound"}
}

export interface Client {
  /**
   * Construct and simulate a get transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Guarantee>>>

  /**
   * Construct and simulate a put transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  put: ({g}: {g: Guarantee}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a writer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  writer: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a next_id transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  next_id: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a active_ids transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  active_ids: (options?: MethodOptions) => Promise<AssembledTransaction<Array<u32>>>

  /**
   * Construct and simulate a set_writer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_writer: ({writer}: {writer: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin}: {admin: string},
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
    return ContractClient.deploy({admin}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAAAAAAADZ2V0AAAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAQAAA+kAAAfQAAAACUd1YXJhbnRlZQAAAAAAB9AAAAANUmVnaXN0cnlFcnJvcgAAAA==",
        "AAAAAAAAAAAAAAADcHV0AAAAAAEAAAAAAAAAAWcAAAAAAAfQAAAACUd1YXJhbnRlZQAAAAAAAAA=",
        "AAAAAAAAAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAGd3JpdGVyAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAHbmV4dF9pZAAAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA",
        "AAAAAAAAAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAKYWN0aXZlX2lkcwAAAAAAAAAAAAEAAAPqAAAABA==",
        "AAAAAAAAAAAAAAAKc2V0X3dyaXRlcgAAAAAAAQAAAAAAAAAGd3JpdGVyAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
        "AAAAAQAAAG9TdGFibGUgY29yZSBvZiBhIGd1YXJhbnRlZS4gTW9kZWwtc3BlY2lmaWMgZXh0cmFzIGxpdmUgaW4gdGhlIHBvbGljeSdzIG93bgpzdG9yYWdlLCBrZXllZCBieSBpZCDigJQgbmV2ZXIgaGVyZS4AAAAAAAAAAAlHdWFyYW50ZWUAAAAAAAAJAAAAAAAAAAZhY3RpdmUAAAAAAAEAAAAAAAAAB2ZlZV9icHMAAAAABAAAAAAAAAACaWQAAAAAAAQAAAAAAAAACGxhbmRsb3JkAAAAEwAAAAAAAAAObW9udGhseV9hbW91bnQAAAAAAAsAAAAAAAAADm1vbnRoc19jb3ZlcmVkAAAAAAAEAAAAAAAAAAttb250aHNfdXNlZAAAAAAEAAAAAAAAAApwYWlkX3VudGlsAAAAAAAGAAAAAAAAAAtwZXJpb2Rfc2VjcwAAAAAG",
        "AAAABAAAAU5FcnJvcnMgc3VyZmFjZWQgYWNyb3NzIHRoZSByZWdpc3RyeSBib3VuZGFyeS4gRGVmaW5lZCBoZXJlIChub3QgaW4gdGhlCmByZWdpc3RyeWAgY3JhdGUpIGJlY2F1c2UgdGhlIGBSZWdpc3RyeWAgdHJhaXQncyByZXR1cm4gdHlwZSByZWZlcmVuY2VzIGl0LApzbyBldmVyeSBjb25zdW1lciBvZiB0aGUgZ2VuZXJhdGVkIGBSZWdpc3RyeUNsaWVudGAgc2VlcyB0aGUgc2FtZSBzdGFibGUKYCNbY29udHJhY3RlcnJvcl1gIGNvZGVzLiBOdW1iZXJlZCBpbiB0aGUgYDJ4eGAgYmFuZCB0byBzdGF5IGNsZWFyIG9mIHRoZQpgNHh4YCBzdHJhdGVneSBjb2RlcyBpbiBgZGVmaW5kZXgtaG9kbGAuAAAAAAAAAAAADVJlZ2lzdHJ5RXJyb3IAAAAAAAABAAAAcE5vIGd1YXJhbnRlZSBpcyBzdG9yZWQgdW5kZXIgdGhlIHJlcXVlc3RlZCBpZCAocHJldmlvdXNseSBhIGhvc3QgdHJhcApmcm9tIGBPcHRpb246OnVud3JhcGAgb24gbWlzc2luZyBzdG9yYWdlKS4AAAARR3VhcmFudGVlTm90Rm91bmQAAAAAAADI" ]),
      options
    )
  }
  public readonly fromJSON = {
    get: this.txFromJSON<Result<Guarantee>>,
        put: this.txFromJSON<null>,
        admin: this.txFromJSON<string>,
        writer: this.txFromJSON<string>,
        next_id: this.txFromJSON<u32>,
        upgrade: this.txFromJSON<null>,
        set_admin: this.txFromJSON<null>,
        active_ids: this.txFromJSON<Array<u32>>,
        set_writer: this.txFromJSON<null>
  }
}