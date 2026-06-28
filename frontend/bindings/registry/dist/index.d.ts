import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, Result } from "@stellar/stellar-sdk/contract";
import type { u32, u64, i128 } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CDPTEOLZ5B253IZCBWASVEGBOZA3KK2QVIBRT7SBVR6BTBKXC4KMLGIY";
    };
};
export type DataKey = {
    tag: "Admin";
    values: void;
} | {
    tag: "Writer";
    values: void;
} | {
    tag: "NextId";
    values: void;
} | {
    tag: "ActiveIds";
    values: void;
} | {
    tag: "Guarantee";
    values: readonly [u32];
} | {
    tag: "SchemaVersion";
    values: void;
} | {
    tag: "RawCoverage";
    values: void;
};
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
export declare const RegistryError: {
    /**
     * No guarantee is stored under the requested id (previously a host trap
     * from `Option::unwrap` on missing storage).
     */
    200: {
        message: string;
    };
    /**
     * Caller supplied a guarantee id outside the issued range (>= NextId). The
     * registry derives ids from its own monotonic counter; a writer must never
     * fabricate the primary key, nor overwrite a not-yet-issued slot (CWE-840).
     * ADDITIVE: new discriminant; `GuaranteeNotFound = 200` is unchanged so the
     * `#[contracterror]` ABI stays stable for in-place `upgrade()`.
     */
    201: {
        message: string;
    };
    /**
     * The Writer role was read before it was set. The constructor now defaults
     * Writer=admin, so this is defense-in-depth: it converts the host trap that
     * an older (pre-default) upgraded-in instance would hit into a stable typed
     * error. ADDITIVE.
     */
    202: {
        message: string;
    };
    /**
     * `upgrade` was called against an on-chain schema version this binary does
     * not expect (stale / layout-incompatible storage). Distinct from `InvalidId`
     * so a refused stale-layout upgrade is distinguishable from a put id error in
     * logs. Layout-changing edits must redeploy + re-wire via `bootstrap.sh`, not
     * `upgrade()`. ADDITIVE.
     */
    203: {
        message: string;
    };
};
export interface Client {
    /**
     * Construct and simulate a get transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get: ({ id }: {
        id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<Guarantee>>>;
    /**
     * Construct and simulate a put transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    put: ({ g }: {
        g: Guarantee;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;
    /**
     * Construct and simulate a writer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    writer: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;
    /**
     * Construct and simulate a next_id transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    next_id: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>;
    /**
     * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    upgrade: ({ new_wasm_hash }: {
        new_wasm_hash: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a reconcile transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Admin drift true-up: recompute `RawCoverage` once from the active set and
     * overwrite the stored scalar. The `put` delta keeps the aggregate exact at
     * every write, but this is the safety valve (and `ActiveIds`' remaining
     * consumer) should any drift ever creep in.
     */
    reconcile: (options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_admin: ({ new_admin }: {
        new_admin: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a active_ids transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    active_ids: (options?: MethodOptions) => Promise<AssembledTransaction<Array<u32>>>;
    /**
     * Construct and simulate a set_writer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_writer: ({ writer }: {
        writer: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a raw_coverage transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * O(1) coverage aggregate (Σ contribution over active guarantees), maintained
     * incrementally by the `put` delta. PURE read — NO require_auth, NO extend_ttl
     * (mirrors the H2 re-audit decision that `get` is side-effect-free, so a
     * solvency "view" never does storage writes). `unwrap_or(0)` is belt-and-
     * suspenders alongside the constructor init.
     */
    raw_coverage: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a schema_version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * On-chain storage schema version. `0` for a pre-versioning instance upgraded
     * in before this binary (the upgrade guard treats that as a mismatch).
     */
    schema_version: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { admin }: {
        admin: string;
    }, 
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions & Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
    }): Promise<AssembledTransaction<T>>;
    constructor(options: ContractClientOptions);
    readonly fromJSON: {
        get: (json: string) => AssembledTransaction<Result<Guarantee, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        put: (json: string) => AssembledTransaction<null>;
        admin: (json: string) => AssembledTransaction<string>;
        writer: (json: string) => AssembledTransaction<string>;
        next_id: (json: string) => AssembledTransaction<number>;
        upgrade: (json: string) => AssembledTransaction<null>;
        reconcile: (json: string) => AssembledTransaction<null>;
        set_admin: (json: string) => AssembledTransaction<null>;
        active_ids: (json: string) => AssembledTransaction<number[]>;
        set_writer: (json: string) => AssembledTransaction<null>;
        raw_coverage: (json: string) => AssembledTransaction<bigint>;
        schema_version: (json: string) => AssembledTransaction<number>;
    };
}
