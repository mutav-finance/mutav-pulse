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
    contractId: "CBM23WHWBEO5AMTVFYSD73UDMXZKVZX6NGLKCJNTTSGRGB5F6HATP34Z",
  }
} as const


/**
 * Underwriting errors surfaced as stable `#[contracterror]` codes. Numbered in
 * the `3xx` band to stay clear of the registry `2xx` and strategy `4xx` codes.
 */
export const PolicyError = {
  /**
   * `fee_bps` exceeds 100% (10_000 bps). Previously accepted silently, which
   * let a guarantee charge a fee above its own monthly amount.
   */
  300: {message:"FeeTooHigh"}
}






/**
 * Stable core of a guarantee. Model-specific extras live in the policy's own
 * storage, keyed by id — never here.
 * 
 * TWO-LEG COVERAGE MODEL (fiança, not insurance). The obligation a fiador backs
 * has two legs, each reserved at signing and drawn independently:
 * 
 * - DEFAULT (rent-arrears) leg — `months_covered` / `months_used`. The short
 * rent-arrears window; pilot `months_covered = 3`. Drawn one month per call via
 * `Policy::cover_default` (`months_used += 1`, capped at `months_covered`). Its
 * remaining contribution is `monthly_amount * (months_covered - months_used)`.
 * - EXIT (property-recovery/restoration) leg — `exit_months` / `exit_used`. The
 * cost of recovering and restoring the property (eviction, damages, restoration);
 * pilot `exit_months = 6`. Drawn in arbitrary partial amounts via `Policy::cover_exit`
 * up to the cap `monthly_amount * exit_months`. Its remaining contribution is
 * `monthly_amount * exit_months - exit_used`.
 * 
 * Max executable obligation per guarantee = `monthly_amount * (months_covered +
 * exit_months)`
 */
export interface Guarantee {
  active: boolean;
  /**
 * EXIT leg term as a multiple of monthly rent (pilot = 6). Reserves
 * `monthly_amount * exit_months` of coverage for property recovery/restoration.
 */
exit_months: u32;
  /**
 * Cumulative underlying drawn via `cover_exit`. Starts 0, only grows (capped at
 * `monthly_amount * exit_months`). `i128` to match `monthly_amount` so the cap
 * and exit-term arithmetic stay pure `i128` with no lossy casts.
 */
exit_used: i128;
  fee_bps: u32;
  id: u32;
  landlord: string;
  monthly_amount: i128;
  months_covered: u32;
  months_used: u32;
  paid_until: u64;
  period_secs: u64;
}

export const SorobanFixedPointError = {
  /**
   * Arithmetic overflow occurred
   */
  1500: {message:"Overflow"},
  /**
   * Division by zero
   */
  1501: {message:"DivisionByZero"}
}

export interface Client {
  /**
   * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a pay_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  pay_fee: ({payer, id}: {payer: string, id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a guarantee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  guarantee: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Guarantee>>

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_vault transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_vault: ({addr}: {addr: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a cover_exit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * EXIT leg (property-recovery/restoration) — pay an exit cost up to the cap
   * `monthly_amount * exit_months` (6× rent at the pilot params), in arbitrary
   * partial/multiple draws (eviction, damages, restoration). Admin-gated, same
   * witness pattern as `cover_default`.
   */
  cover_exit: ({id, amount}: {id: u32, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a grace_secs transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Grace window (seconds) before a missed fee tips a guarantee into default.
   * Falls back to `DEFAULT_GRACE_SECS` for a pre-default upgraded-in instance.
   */
  grace_secs: (options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a is_current transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * `true` while the fee has NOT yet lapsed (`paid_until > now`). Fiança
   * semantics: a current guarantee is one the tenant is keeping paid; once
   * `paid_until <= now` the fee has lapsed and (past the grace window) the
   * guarantee is in default — `cover_default` is what then pays in.
   */
  is_current: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a monthly_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  monthly_fee: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a set_registry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_registry: ({addr}: {addr: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a cover_default transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cover_default: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_grace_secs transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_grace_secs: ({secs}: {secs: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a sign_guarantee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  sign_guarantee: ({landlord, monthly_amount, months_covered, exit_months, fee_bps, period_secs}: {landlord: string, monthly_amount: i128, months_covered: u32, exit_months: u32, fee_bps: u32, period_secs: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a settle_guarantee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  settle_guarantee: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a coverage_required transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  coverage_required: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a set_coverage_ratio_bps transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_coverage_ratio_bps: ({bps}: {bps: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

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
      new ContractSpec([ "AAAAAAAAAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAHcGF5X2ZlZQAAAAACAAAAAAAAAAVwYXllcgAAAAAAABMAAAAAAAAAAmlkAAAAAAAEAAAAAA==",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA",
        "AAAABQAAAHhFbWl0dGVkIGJ5IGBwYXlfZmVlYCBhZnRlciB0aGUgZmVlIGlzIHB1bGxlZCBpbnRvIHRoZSB2YXVsdCBhbmQgYHBhaWRfdW50aWxgCmlzIGV4dGVuZGVkLiBUb3BpY3M6IFtuYW1lLCBwYXllciwgaWRdICgzKS4AAAAAAAAAB0ZlZVBhaWQAAAAAAQAAAAhmZWVfcGFpZAAAAAQAAAAAAAAABXBheWVyAAAAAAAAEwAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAQAAAAAAAAADZmVlAAAAAAsAAAAAAAAAAAAAAApwYWlkX3VudGlsAAAAAAAGAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAAJZ3VhcmFudGVlAAAAAAAAAQAAAAAAAAACaWQAAAAAAAQAAAABAAAH0AAAAAlHdWFyYW50ZWUAAAA=",
        "AAAAAAAAAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAJc2V0X3ZhdWx0AAAAAAAAAQAAAAAAAAAEYWRkcgAAABMAAAAA",
        "AAAAAAAAAQZFWElUIGxlZyAocHJvcGVydHktcmVjb3ZlcnkvcmVzdG9yYXRpb24pIOKAlCBwYXkgYW4gZXhpdCBjb3N0IHVwIHRvIHRoZSBjYXAKYG1vbnRobHlfYW1vdW50ICogZXhpdF9tb250aHNgICg2w5cgcmVudCBhdCB0aGUgcGlsb3QgcGFyYW1zKSwgaW4gYXJiaXRyYXJ5CnBhcnRpYWwvbXVsdGlwbGUgZHJhd3MgKGV2aWN0aW9uLCBkYW1hZ2VzLCByZXN0b3JhdGlvbikuIEFkbWluLWdhdGVkLCBzYW1lCndpdG5lc3MgcGF0dGVybiBhcyBgY292ZXJfZGVmYXVsdGAuAAAAAAAKY292ZXJfZXhpdAAAAAAAAgAAAAAAAAACaWQAAAAAAAQAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAAJRHcmFjZSB3aW5kb3cgKHNlY29uZHMpIGJlZm9yZSBhIG1pc3NlZCBmZWUgdGlwcyBhIGd1YXJhbnRlZSBpbnRvIGRlZmF1bHQuCkZhbGxzIGJhY2sgdG8gYERFRkFVTFRfR1JBQ0VfU0VDU2AgZm9yIGEgcHJlLWRlZmF1bHQgdXBncmFkZWQtaW4gaW5zdGFuY2UuAAAACmdyYWNlX3NlY3MAAAAAAAAAAAABAAAABg==",
        "AAAAAAAAARVgdHJ1ZWAgd2hpbGUgdGhlIGZlZSBoYXMgTk9UIHlldCBsYXBzZWQgKGBwYWlkX3VudGlsID4gbm93YCkuIEZpYW7Dp2EKc2VtYW50aWNzOiBhIGN1cnJlbnQgZ3VhcmFudGVlIGlzIG9uZSB0aGUgdGVuYW50IGlzIGtlZXBpbmcgcGFpZDsgb25jZQpgcGFpZF91bnRpbCA8PSBub3dgIHRoZSBmZWUgaGFzIGxhcHNlZCBhbmQgKHBhc3QgdGhlIGdyYWNlIHdpbmRvdykgdGhlCmd1YXJhbnRlZSBpcyBpbiBkZWZhdWx0IOKAlCBgY292ZXJfZGVmYXVsdGAgaXMgd2hhdCB0aGVuIHBheXMgaW4uAAAAAAAACmlzX2N1cnJlbnQAAAAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAALbW9udGhseV9mZWUAAAAAAQAAAAAAAAACaWQAAAAAAAQAAAABAAAACw==",
        "AAAABAAAAJlVbmRlcndyaXRpbmcgZXJyb3JzIHN1cmZhY2VkIGFzIHN0YWJsZSBgI1tjb250cmFjdGVycm9yXWAgY29kZXMuIE51bWJlcmVkIGluCnRoZSBgM3h4YCBiYW5kIHRvIHN0YXkgY2xlYXIgb2YgdGhlIHJlZ2lzdHJ5IGAyeHhgIGFuZCBzdHJhdGVneSBgNHh4YCBjb2Rlcy4AAAAAAAAAAAAAC1BvbGljeUVycm9yAAAAAAEAAACDYGZlZV9icHNgIGV4Y2VlZHMgMTAwJSAoMTBfMDAwIGJwcykuIFByZXZpb3VzbHkgYWNjZXB0ZWQgc2lsZW50bHksIHdoaWNoCmxldCBhIGd1YXJhbnRlZSBjaGFyZ2UgYSBmZWUgYWJvdmUgaXRzIG93biBtb250aGx5IGFtb3VudC4AAAAACkZlZVRvb0hpZ2gAAAAAASw=",
        "AAAAAAAAAAAAAAAMc2V0X3JlZ2lzdHJ5AAAAAQAAAAAAAAAEYWRkcgAAABMAAAAA",
        "AAAABQAAAGNFbWl0dGVkIGJ5IGBjb3Zlcl9leGl0YCBvbmx5IGFmdGVyIGEgc3VjY2Vzc2Z1bCBgdmF1bHQuZGlzYnVyc2VgLgpUb3BpY3M6IFtuYW1lLCBpZCwgbGFuZGxvcmRdICgzKS4AAAAAAAAAAAtFeGl0Q292ZXJlZAAAAAABAAAADGV4aXRfY292ZXJlZAAAAAUAAAAAAAAAAmlkAAAAAAAEAAAAAQAAAAAAAAAIbGFuZGxvcmQAAAATAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAAJZXhpdF91c2VkAAAAAAAACwAAAAAAAAAAAAAADmV4aXRfcmVtYWluaW5nAAAAAAALAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAANY292ZXJfZGVmYXVsdAAAAAAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAA==",
        "AAAAAAAAAAAAAAAOc2V0X2dyYWNlX3NlY3MAAAAAAAEAAAAAAAAABHNlY3MAAAAGAAAAAA==",
        "AAAAAAAAAAAAAAAOc2lnbl9ndWFyYW50ZWUAAAAAAAYAAAAAAAAACGxhbmRsb3JkAAAAEwAAAAAAAAAObW9udGhseV9hbW91bnQAAAAAAAsAAAAAAAAADm1vbnRoc19jb3ZlcmVkAAAAAAAEAAAAAAAAAAtleGl0X21vbnRocwAAAAAEAAAAAAAAAAdmZWVfYnBzAAAAAAQAAAAAAAAAC3BlcmlvZF9zZWNzAAAAAAYAAAABAAAD6QAAAAQAAAfQAAAAC1BvbGljeUVycm9yAA==",
        "AAAABQAAAGZFbWl0dGVkIGJ5IGBjb3Zlcl9kZWZhdWx0YCBvbmx5IGFmdGVyIGEgc3VjY2Vzc2Z1bCBgdmF1bHQuZGlzYnVyc2VgLgpUb3BpY3M6IFtuYW1lLCBpZCwgbGFuZGxvcmRdICgzKS4AAAAAAAAAAAAORGVmYXVsdENvdmVyZWQAAAAAAAEAAAAPZGVmYXVsdF9jb3ZlcmVkAAAAAAUAAAAAAAAAAmlkAAAAAAAEAAAAAQAAAAAAAAAIbGFuZGxvcmQAAAATAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAALbW9udGhzX3VzZWQAAAAABAAAAAAAAAAAAAAAEG1vbnRoc19yZW1haW5pbmcAAAAEAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAAQc2V0dGxlX2d1YXJhbnRlZQAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAA==",
        "AAAABQAAAGtFbWl0dGVkIGJ5IGBzaWduX2d1YXJhbnRlZWAgYWZ0ZXIgdGhlIGd1YXJhbnRlZSBpcyBjb21taXR0ZWQgdG8gdGhlIHJlZ2lzdHJ5LgpUb3BpY3M6IFtuYW1lLCBsYW5kbG9yZF0gKDIpLgAAAAAAAAAAD0d1YXJhbnRlZVNpZ25lZAAAAAABAAAAEGd1YXJhbnRlZV9zaWduZWQAAAAHAAAAAAAAAAhsYW5kbG9yZAAAABMAAAABAAAAAAAAAAJpZAAAAAAABAAAAAAAAAAAAAAADm1vbnRobHlfYW1vdW50AAAAAAALAAAAAAAAAAAAAAAObW9udGhzX2NvdmVyZWQAAAAAAAQAAAAAAAAAAAAAAAtleGl0X21vbnRocwAAAAAEAAAAAAAAAAAAAAAHZmVlX2JwcwAAAAAEAAAAAAAAAAAAAAALcGVyaW9kX3NlY3MAAAAABgAAAAAAAAAC",
        "AAAAAAAAAAAAAAARY292ZXJhZ2VfcmVxdWlyZWQAAAAAAAAAAAAAAQAAAAs=",
        "AAAABQAAAFpFbWl0dGVkIGJ5IGBzZXR0bGVfZ3VhcmFudGVlYCBhZnRlciB0aGUgZGVhY3RpdmF0aW9uIGlzIGNvbW1pdHRlZC4KVG9waWNzOiBbbmFtZSwgaWRdICgyKS4AAAAAAAAAAAAQR3VhcmFudGVlU2V0dGxlZAAAAAEAAAARZ3VhcmFudGVlX3NldHRsZWQAAAAAAAABAAAAAAAAAAJpZAAAAAAABAAAAAEAAAAC",
        "AAAAAAAAAAAAAAAWc2V0X2NvdmVyYWdlX3JhdGlvX2JwcwAAAAAAAQAAAAAAAAADYnBzAAAAAAQAAAAA",
        "AAAAAQAABABTdGFibGUgY29yZSBvZiBhIGd1YXJhbnRlZS4gTW9kZWwtc3BlY2lmaWMgZXh0cmFzIGxpdmUgaW4gdGhlIHBvbGljeSdzIG93bgpzdG9yYWdlLCBrZXllZCBieSBpZCDigJQgbmV2ZXIgaGVyZS4KClRXTy1MRUcgQ09WRVJBR0UgTU9ERUwgKGZpYW7Dp2EsIG5vdCBpbnN1cmFuY2UpLiBUaGUgb2JsaWdhdGlvbiBhIGZpYWRvciBiYWNrcwpoYXMgdHdvIGxlZ3MsIGVhY2ggcmVzZXJ2ZWQgYXQgc2lnbmluZyBhbmQgZHJhd24gaW5kZXBlbmRlbnRseToKCi0gREVGQVVMVCAocmVudC1hcnJlYXJzKSBsZWcg4oCUIGBtb250aHNfY292ZXJlZGAgLyBgbW9udGhzX3VzZWRgLiBUaGUgc2hvcnQKcmVudC1hcnJlYXJzIHdpbmRvdzsgcGlsb3QgYG1vbnRoc19jb3ZlcmVkID0gM2AuIERyYXduIG9uZSBtb250aCBwZXIgY2FsbCB2aWEKYFBvbGljeTo6Y292ZXJfZGVmYXVsdGAgKGBtb250aHNfdXNlZCArPSAxYCwgY2FwcGVkIGF0IGBtb250aHNfY292ZXJlZGApLiBJdHMKcmVtYWluaW5nIGNvbnRyaWJ1dGlvbiBpcyBgbW9udGhseV9hbW91bnQgKiAobW9udGhzX2NvdmVyZWQgLSBtb250aHNfdXNlZClgLgotIEVYSVQgKHByb3BlcnR5LXJlY292ZXJ5L3Jlc3RvcmF0aW9uKSBsZWcg4oCUIGBleGl0X21vbnRoc2AgLyBgZXhpdF91c2VkYC4gVGhlCmNvc3Qgb2YgcmVjb3ZlcmluZyBhbmQgcmVzdG9yaW5nIHRoZSBwcm9wZXJ0eSAoZXZpY3Rpb24sIGRhbWFnZXMsIHJlc3RvcmF0aW9uKTsKcGlsb3QgYGV4aXRfbW9udGhzID0gNmAuIERyYXduIGluIGFyYml0cmFyeSBwYXJ0aWFsIGFtb3VudHMgdmlhIGBQb2xpY3k6OmNvdmVyX2V4aXRgCnVwIHRvIHRoZSBjYXAgYG1vbnRobHlfYW1vdW50ICogZXhpdF9tb250aHNgLiBJdHMgcmVtYWluaW5nIGNvbnRyaWJ1dGlvbiBpcwpgbW9udGhseV9hbW91bnQgKiBleGl0X21vbnRocyAtIGV4aXRfdXNlZGAuCgpNYXggZXhlY3V0YWJsZSBvYmxpZ2F0aW9uIHBlciBndWFyYW50ZWUgPSBgbW9udGhseV9hbW91bnQgKiAobW9udGhzX2NvdmVyZWQgKwpleGl0X21vbnRocylgAAAAAAAAAAlHdWFyYW50ZWUAAAAAAAALAAAAAAAAAAZhY3RpdmUAAAAAAAEAAACPRVhJVCBsZWcgdGVybSBhcyBhIG11bHRpcGxlIG9mIG1vbnRobHkgcmVudCAocGlsb3QgPSA2KS4gUmVzZXJ2ZXMKYG1vbnRobHlfYW1vdW50ICogZXhpdF9tb250aHNgIG9mIGNvdmVyYWdlIGZvciBwcm9wZXJ0eSByZWNvdmVyeS9yZXN0b3JhdGlvbi4AAAAAC2V4aXRfbW9udGhzAAAAAAQAAADZQ3VtdWxhdGl2ZSB1bmRlcmx5aW5nIGRyYXduIHZpYSBgY292ZXJfZXhpdGAuIFN0YXJ0cyAwLCBvbmx5IGdyb3dzIChjYXBwZWQgYXQKYG1vbnRobHlfYW1vdW50ICogZXhpdF9tb250aHNgKS4gYGkxMjhgIHRvIG1hdGNoIGBtb250aGx5X2Ftb3VudGAgc28gdGhlIGNhcAphbmQgZXhpdC10ZXJtIGFyaXRobWV0aWMgc3RheSBwdXJlIGBpMTI4YCB3aXRoIG5vIGxvc3N5IGNhc3RzLgAAAAAAAAlleGl0X3VzZWQAAAAAAAALAAAAAAAAAAdmZWVfYnBzAAAAAAQAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAhsYW5kbG9yZAAAABMAAAAAAAAADm1vbnRobHlfYW1vdW50AAAAAAALAAAAAAAAAA5tb250aHNfY292ZXJlZAAAAAAABAAAAAAAAAALbW9udGhzX3VzZWQAAAAABAAAAAAAAAAKcGFpZF91bnRpbAAAAAAABgAAAAAAAAALcGVyaW9kX3NlY3MAAAAABg==",
        "AAAABAAAAAAAAAAAAAAAFlNvcm9iYW5GaXhlZFBvaW50RXJyb3IAAAAAAAIAAAAcQXJpdGhtZXRpYyBvdmVyZmxvdyBvY2N1cnJlZAAAAAhPdmVyZmxvdwAABdwAAAAQRGl2aXNpb24gYnkgemVybwAAAA5EaXZpc2lvbkJ5WmVybwAAAAAF3Q==" ]),
      options
    )
  }
  public readonly fromJSON = {
    admin: this.txFromJSON<string>,
        pay_fee: this.txFromJSON<null>,
        upgrade: this.txFromJSON<null>,
        guarantee: this.txFromJSON<Guarantee>,
        set_admin: this.txFromJSON<null>,
        set_vault: this.txFromJSON<null>,
        cover_exit: this.txFromJSON<null>,
        grace_secs: this.txFromJSON<u64>,
        is_current: this.txFromJSON<boolean>,
        monthly_fee: this.txFromJSON<i128>,
        set_registry: this.txFromJSON<null>,
        cover_default: this.txFromJSON<null>,
        set_grace_secs: this.txFromJSON<null>,
        sign_guarantee: this.txFromJSON<Result<u32>>,
        settle_guarantee: this.txFromJSON<null>,
        coverage_required: this.txFromJSON<i128>,
        set_coverage_ratio_bps: this.txFromJSON<null>
  }
}