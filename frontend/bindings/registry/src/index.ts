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
    contractId: "CDPTEOLZ5B253IZCBWASVEGBOZA3KK2QVIBRT7SBVR6BTBKXC4KMLGIY",
  }
} as const

export type DataKey = {tag: "Admin", values: void} | {tag: "Writer", values: void} | {tag: "NextId", values: void} | {tag: "ActiveIds", values: void} | {tag: "Guarantee", values: readonly [u32]} | {tag: "SchemaVersion", values: void} | {tag: "RawCoverage", values: void};



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
  200: {message:"GuaranteeNotFound"},
  /**
   * Caller supplied a guarantee id outside the issued range (>= NextId). The
   * registry derives ids from its own monotonic counter; a writer must never
   * fabricate the primary key, nor overwrite a not-yet-issued slot (CWE-840).
   * ADDITIVE: new discriminant; `GuaranteeNotFound = 200` is unchanged so the
   * `#[contracterror]` ABI stays stable for in-place `upgrade()`.
   */
  201: {message:"InvalidId"},
  /**
   * The Writer role was read before it was set. The constructor now defaults
   * Writer=admin, so this is defense-in-depth: it converts the host trap that
   * an older (pre-default) upgraded-in instance would hit into a stable typed
   * error. ADDITIVE.
   */
  202: {message:"WriterNotSet"},
  /**
   * `upgrade` was called against an on-chain schema version this binary does
   * not expect (stale / layout-incompatible storage). Distinct from `InvalidId`
   * so a refused stale-layout upgrade is distinguishable from a put id error in
   * logs. Layout-changing edits must redeploy + re-wire via `bootstrap.sh`, not
   * `upgrade()`. ADDITIVE.
   */
  203: {message:"VersionMismatch"}
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
   * Construct and simulate a reconcile transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin drift true-up: recompute `RawCoverage` once from the active set and
   * overwrite the stored scalar. The `put` delta keeps the aggregate exact at
   * every write, but this is the safety valve (and `ActiveIds`' remaining
   * consumer) should any drift ever creep in.
   */
  reconcile: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

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

  /**
   * Construct and simulate a raw_coverage transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * O(1) coverage aggregate (Σ contribution over active guarantees), maintained
   * incrementally by the `put` delta. PURE read — NO require_auth, NO extend_ttl
   * (mirrors the H2 re-audit decision that `get` is side-effect-free, so a
   * solvency "view" never does storage writes). `unwrap_or(0)` is belt-and-
   * suspenders alongside the constructor init.
   */
  raw_coverage: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a schema_version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * On-chain storage schema version. `0` for a pre-versioning instance upgraded
   * in before this binary (the upgrade guard treats that as a mismatch).
   */
  schema_version: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

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
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABwAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAGV3JpdGVyAAAAAAAAAAAAAAAAAAZOZXh0SWQAAAAAAAAAAAAAAAAACUFjdGl2ZUlkcwAAAAAAAAEAAAAAAAAACUd1YXJhbnRlZQAAAAAAAAEAAAAEAAAAAAAAAAAAAAANU2NoZW1hVmVyc2lvbgAAAAAAAAAAAAAAAAAAC1Jhd0NvdmVyYWdlAA==",
        "AAAAAAAAAAAAAAAGd3JpdGVyAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAHbmV4dF9pZAAAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA",
        "AAAABQAAAJFFbWl0dGVkIGJ5IGB1cGdyYWRlYCBhZnRlciB0aGUgd2FzbSBzd2FwIGlzIGNvbW1pdHRlZC4gTWlycm9ycyB0aGUgdmF1bHQncyBiYXJlCmAjW2NvbnRyYWN0ZXZlbnRdYCBpZGlvbSAoYXV0byBzbmFrZV9jYXNlIG5hbWUgdG9waWMgYHVwZ3JhZGVkYCkuAAAAAAAAAAAAAAhVcGdyYWRlZAAAAAEAAAAIdXBncmFkZWQAAAADAAAAAAAAAAVhZG1pbgAAAAAAABMAAAABAAAAAAAAAAd2ZXJzaW9uAAAAAAQAAAAAAAAAAAAAAAl3YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAAAAAAC",
        "AAAAAAAAAQNBZG1pbiBkcmlmdCB0cnVlLXVwOiByZWNvbXB1dGUgYFJhd0NvdmVyYWdlYCBvbmNlIGZyb20gdGhlIGFjdGl2ZSBzZXQgYW5kCm92ZXJ3cml0ZSB0aGUgc3RvcmVkIHNjYWxhci4gVGhlIGBwdXRgIGRlbHRhIGtlZXBzIHRoZSBhZ2dyZWdhdGUgZXhhY3QgYXQKZXZlcnkgd3JpdGUsIGJ1dCB0aGlzIGlzIHRoZSBzYWZldHkgdmFsdmUgKGFuZCBgQWN0aXZlSWRzYCcgcmVtYWluaW5nCmNvbnN1bWVyKSBzaG91bGQgYW55IGRyaWZ0IGV2ZXIgY3JlZXAgaW4uAAAAAAlyZWNvbmNpbGUAAAAAAAAAAAAAAA==",
        "AAAAAAAAAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAKYWN0aXZlX2lkcwAAAAAAAAAAAAEAAAPqAAAABA==",
        "AAAAAAAAAAAAAAAKc2V0X3dyaXRlcgAAAAAAAQAAAAAAAAAGd3JpdGVyAAAAAAATAAAAAA==",
        "AAAAAAAAAVVPKDEpIGNvdmVyYWdlIGFnZ3JlZ2F0ZSAozqMgY29udHJpYnV0aW9uIG92ZXIgYWN0aXZlIGd1YXJhbnRlZXMpLCBtYWludGFpbmVkCmluY3JlbWVudGFsbHkgYnkgdGhlIGBwdXRgIGRlbHRhLiBQVVJFIHJlYWQg4oCUIE5PIHJlcXVpcmVfYXV0aCwgTk8gZXh0ZW5kX3R0bAoobWlycm9ycyB0aGUgSDIgcmUtYXVkaXQgZGVjaXNpb24gdGhhdCBgZ2V0YCBpcyBzaWRlLWVmZmVjdC1mcmVlLCBzbyBhCnNvbHZlbmN5ICJ2aWV3IiBuZXZlciBkb2VzIHN0b3JhZ2Ugd3JpdGVzKS4gYHVud3JhcF9vcigwKWAgaXMgYmVsdC1hbmQtCnN1c3BlbmRlcnMgYWxvbmdzaWRlIHRoZSBjb25zdHJ1Y3RvciBpbml0LgAAAAAAAAxyYXdfY292ZXJhZ2UAAAAAAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAJBPbi1jaGFpbiBzdG9yYWdlIHNjaGVtYSB2ZXJzaW9uLiBgMGAgZm9yIGEgcHJlLXZlcnNpb25pbmcgaW5zdGFuY2UgdXBncmFkZWQKaW4gYmVmb3JlIHRoaXMgYmluYXJ5ICh0aGUgdXBncmFkZSBndWFyZCB0cmVhdHMgdGhhdCBhcyBhIG1pc21hdGNoKS4AAAAOc2NoZW1hX3ZlcnNpb24AAAAAAAAAAAABAAAABA==",
        "AAAAAQAABABTdGFibGUgY29yZSBvZiBhIGd1YXJhbnRlZS4gTW9kZWwtc3BlY2lmaWMgZXh0cmFzIGxpdmUgaW4gdGhlIHBvbGljeSdzIG93bgpzdG9yYWdlLCBrZXllZCBieSBpZCDigJQgbmV2ZXIgaGVyZS4KClRXTy1MRUcgQ09WRVJBR0UgTU9ERUwgKGZpYW7Dp2EsIG5vdCBpbnN1cmFuY2UpLiBUaGUgb2JsaWdhdGlvbiBhIGZpYWRvciBiYWNrcwpoYXMgdHdvIGxlZ3MsIGVhY2ggcmVzZXJ2ZWQgYXQgc2lnbmluZyBhbmQgZHJhd24gaW5kZXBlbmRlbnRseToKCi0gREVGQVVMVCAocmVudC1hcnJlYXJzKSBsZWcg4oCUIGBtb250aHNfY292ZXJlZGAgLyBgbW9udGhzX3VzZWRgLiBUaGUgc2hvcnQKcmVudC1hcnJlYXJzIHdpbmRvdzsgcGlsb3QgYG1vbnRoc19jb3ZlcmVkID0gM2AuIERyYXduIG9uZSBtb250aCBwZXIgY2FsbCB2aWEKYFBvbGljeTo6Y292ZXJfZGVmYXVsdGAgKGBtb250aHNfdXNlZCArPSAxYCwgY2FwcGVkIGF0IGBtb250aHNfY292ZXJlZGApLiBJdHMKcmVtYWluaW5nIGNvbnRyaWJ1dGlvbiBpcyBgbW9udGhseV9hbW91bnQgKiAobW9udGhzX2NvdmVyZWQgLSBtb250aHNfdXNlZClgLgotIEVYSVQgKHByb3BlcnR5LXJlY292ZXJ5L3Jlc3RvcmF0aW9uKSBsZWcg4oCUIGBleGl0X21vbnRoc2AgLyBgZXhpdF91c2VkYC4gVGhlCmNvc3Qgb2YgcmVjb3ZlcmluZyBhbmQgcmVzdG9yaW5nIHRoZSBwcm9wZXJ0eSAoZXZpY3Rpb24sIGRhbWFnZXMsIHJlc3RvcmF0aW9uKTsKcGlsb3QgYGV4aXRfbW9udGhzID0gNmAuIERyYXduIGluIGFyYml0cmFyeSBwYXJ0aWFsIGFtb3VudHMgdmlhIGBQb2xpY3k6OmNvdmVyX2V4aXRgCnVwIHRvIHRoZSBjYXAgYG1vbnRobHlfYW1vdW50ICogZXhpdF9tb250aHNgLiBJdHMgcmVtYWluaW5nIGNvbnRyaWJ1dGlvbiBpcwpgbW9udGhseV9hbW91bnQgKiBleGl0X21vbnRocyAtIGV4aXRfdXNlZGAuCgpNYXggZXhlY3V0YWJsZSBvYmxpZ2F0aW9uIHBlciBndWFyYW50ZWUgPSBgbW9udGhseV9hbW91bnQgKiAobW9udGhzX2NvdmVyZWQgKwpleGl0X21vbnRocylgAAAAAAAAAAlHdWFyYW50ZWUAAAAAAAALAAAAAAAAAAZhY3RpdmUAAAAAAAEAAACPRVhJVCBsZWcgdGVybSBhcyBhIG11bHRpcGxlIG9mIG1vbnRobHkgcmVudCAocGlsb3QgPSA2KS4gUmVzZXJ2ZXMKYG1vbnRobHlfYW1vdW50ICogZXhpdF9tb250aHNgIG9mIGNvdmVyYWdlIGZvciBwcm9wZXJ0eSByZWNvdmVyeS9yZXN0b3JhdGlvbi4AAAAAC2V4aXRfbW9udGhzAAAAAAQAAADZQ3VtdWxhdGl2ZSB1bmRlcmx5aW5nIGRyYXduIHZpYSBgY292ZXJfZXhpdGAuIFN0YXJ0cyAwLCBvbmx5IGdyb3dzIChjYXBwZWQgYXQKYG1vbnRobHlfYW1vdW50ICogZXhpdF9tb250aHNgKS4gYGkxMjhgIHRvIG1hdGNoIGBtb250aGx5X2Ftb3VudGAgc28gdGhlIGNhcAphbmQgZXhpdC10ZXJtIGFyaXRobWV0aWMgc3RheSBwdXJlIGBpMTI4YCB3aXRoIG5vIGxvc3N5IGNhc3RzLgAAAAAAAAlleGl0X3VzZWQAAAAAAAALAAAAAAAAAAdmZWVfYnBzAAAAAAQAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAhsYW5kbG9yZAAAABMAAAAAAAAADm1vbnRobHlfYW1vdW50AAAAAAALAAAAAAAAAA5tb250aHNfY292ZXJlZAAAAAAABAAAAAAAAAALbW9udGhzX3VzZWQAAAAABAAAAAAAAAAKcGFpZF91bnRpbAAAAAAABgAAAAAAAAALcGVyaW9kX3NlY3MAAAAABg==",
        "AAAABAAAAU5FcnJvcnMgc3VyZmFjZWQgYWNyb3NzIHRoZSByZWdpc3RyeSBib3VuZGFyeS4gRGVmaW5lZCBoZXJlIChub3QgaW4gdGhlCmByZWdpc3RyeWAgY3JhdGUpIGJlY2F1c2UgdGhlIGBSZWdpc3RyeWAgdHJhaXQncyByZXR1cm4gdHlwZSByZWZlcmVuY2VzIGl0LApzbyBldmVyeSBjb25zdW1lciBvZiB0aGUgZ2VuZXJhdGVkIGBSZWdpc3RyeUNsaWVudGAgc2VlcyB0aGUgc2FtZSBzdGFibGUKYCNbY29udHJhY3RlcnJvcl1gIGNvZGVzLiBOdW1iZXJlZCBpbiB0aGUgYDJ4eGAgYmFuZCB0byBzdGF5IGNsZWFyIG9mIHRoZQpgNHh4YCBzdHJhdGVneSBjb2RlcyBpbiBgZGVmaW5kZXgtaG9kbGAuAAAAAAAAAAAADVJlZ2lzdHJ5RXJyb3IAAAAAAAAEAAAAcE5vIGd1YXJhbnRlZSBpcyBzdG9yZWQgdW5kZXIgdGhlIHJlcXVlc3RlZCBpZCAocHJldmlvdXNseSBhIGhvc3QgdHJhcApmcm9tIGBPcHRpb246OnVud3JhcGAgb24gbWlzc2luZyBzdG9yYWdlKS4AAAARR3VhcmFudGVlTm90Rm91bmQAAAAAAADIAAABY0NhbGxlciBzdXBwbGllZCBhIGd1YXJhbnRlZSBpZCBvdXRzaWRlIHRoZSBpc3N1ZWQgcmFuZ2UgKD49IE5leHRJZCkuIFRoZQpyZWdpc3RyeSBkZXJpdmVzIGlkcyBmcm9tIGl0cyBvd24gbW9ub3RvbmljIGNvdW50ZXI7IGEgd3JpdGVyIG11c3QgbmV2ZXIKZmFicmljYXRlIHRoZSBwcmltYXJ5IGtleSwgbm9yIG92ZXJ3cml0ZSBhIG5vdC15ZXQtaXNzdWVkIHNsb3QgKENXRS04NDApLgpBRERJVElWRTogbmV3IGRpc2NyaW1pbmFudDsgYEd1YXJhbnRlZU5vdEZvdW5kID0gMjAwYCBpcyB1bmNoYW5nZWQgc28gdGhlCmAjW2NvbnRyYWN0ZXJyb3JdYCBBQkkgc3RheXMgc3RhYmxlIGZvciBpbi1wbGFjZSBgdXBncmFkZSgpYC4AAAAACUludmFsaWRJZAAAAAAAAMkAAADtVGhlIFdyaXRlciByb2xlIHdhcyByZWFkIGJlZm9yZSBpdCB3YXMgc2V0LiBUaGUgY29uc3RydWN0b3Igbm93IGRlZmF1bHRzCldyaXRlcj1hZG1pbiwgc28gdGhpcyBpcyBkZWZlbnNlLWluLWRlcHRoOiBpdCBjb252ZXJ0cyB0aGUgaG9zdCB0cmFwIHRoYXQKYW4gb2xkZXIgKHByZS1kZWZhdWx0KSB1cGdyYWRlZC1pbiBpbnN0YW5jZSB3b3VsZCBoaXQgaW50byBhIHN0YWJsZSB0eXBlZAplcnJvci4gQURESVRJVkUuAAAAAAAADFdyaXRlck5vdFNldAAAAMoAAAFDYHVwZ3JhZGVgIHdhcyBjYWxsZWQgYWdhaW5zdCBhbiBvbi1jaGFpbiBzY2hlbWEgdmVyc2lvbiB0aGlzIGJpbmFyeSBkb2VzCm5vdCBleHBlY3QgKHN0YWxlIC8gbGF5b3V0LWluY29tcGF0aWJsZSBzdG9yYWdlKS4gRGlzdGluY3QgZnJvbSBgSW52YWxpZElkYApzbyBhIHJlZnVzZWQgc3RhbGUtbGF5b3V0IHVwZ3JhZGUgaXMgZGlzdGluZ3Vpc2hhYmxlIGZyb20gYSBwdXQgaWQgZXJyb3IgaW4KbG9ncy4gTGF5b3V0LWNoYW5naW5nIGVkaXRzIG11c3QgcmVkZXBsb3kgKyByZS13aXJlIHZpYSBgYm9vdHN0cmFwLnNoYCwgbm90CmB1cGdyYWRlKClgLiBBRERJVElWRS4AAAAAD1ZlcnNpb25NaXNtYXRjaAAAAADL" ]),
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
        reconcile: this.txFromJSON<null>,
        set_admin: this.txFromJSON<null>,
        active_ids: this.txFromJSON<Array<u32>>,
        set_writer: this.txFromJSON<null>,
        raw_coverage: this.txFromJSON<i128>,
        schema_version: this.txFromJSON<u32>
  }
}