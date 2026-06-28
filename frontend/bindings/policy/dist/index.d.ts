import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, Result } from "@stellar/stellar-sdk/contract";
import type { u32, u64, i128 } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CBM23WHWBEO5AMTVFYSD73UDMXZKVZX6NGLKCJNTTSGRGB5F6HATP34Z";
    };
};
/**
 * Underwriting errors surfaced as stable `#[contracterror]` codes. Numbered in
 * the `3xx` band to stay clear of the registry `2xx` and strategy `4xx` codes.
 */
export declare const PolicyError: {
    /**
     * `fee_bps` exceeds 100% (10_000 bps). Previously accepted silently, which
     * let a guarantee charge a fee above its own monthly amount.
     */
    300: {
        message: string;
    };
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
export declare const SorobanFixedPointError: {
    /**
     * Arithmetic overflow occurred
     */
    1500: {
        message: string;
    };
    /**
     * Division by zero
     */
    1501: {
        message: string;
    };
};
export interface Client {
    /**
     * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;
    /**
     * Construct and simulate a pay_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    pay_fee: ({ payer, id }: {
        payer: string;
        id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    upgrade: ({ new_wasm_hash }: {
        new_wasm_hash: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a guarantee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    guarantee: ({ id }: {
        id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Guarantee>>;
    /**
     * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_admin: ({ new_admin }: {
        new_admin: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a set_vault transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_vault: ({ addr }: {
        addr: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a cover_exit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * EXIT leg (property-recovery/restoration) — pay an exit cost up to the cap
     * `monthly_amount * exit_months` (6× rent at the pilot params), in arbitrary
     * partial/multiple draws (eviction, damages, restoration). Admin-gated, same
     * witness pattern as `cover_default`.
     */
    cover_exit: ({ id, amount }: {
        id: u32;
        amount: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a grace_secs transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Grace window (seconds) before a missed fee tips a guarantee into default.
     * Falls back to `DEFAULT_GRACE_SECS` for a pre-default upgraded-in instance.
     */
    grace_secs: (options?: MethodOptions) => Promise<AssembledTransaction<u64>>;
    /**
     * Construct and simulate a is_current transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * `true` while the fee has NOT yet lapsed (`paid_until > now`). Fiança
     * semantics: a current guarantee is one the tenant is keeping paid; once
     * `paid_until <= now` the fee has lapsed and (past the grace window) the
     * guarantee is in default — `cover_default` is what then pays in.
     */
    is_current: ({ id }: {
        id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>;
    /**
     * Construct and simulate a monthly_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    monthly_fee: ({ id }: {
        id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a set_registry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_registry: ({ addr }: {
        addr: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a cover_default transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    cover_default: ({ id }: {
        id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a set_grace_secs transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_grace_secs: ({ secs }: {
        secs: u64;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a sign_guarantee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    sign_guarantee: ({ landlord, monthly_amount, months_covered, exit_months, fee_bps, period_secs }: {
        landlord: string;
        monthly_amount: i128;
        months_covered: u32;
        exit_months: u32;
        fee_bps: u32;
        period_secs: u64;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>;
    /**
     * Construct and simulate a settle_guarantee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    settle_guarantee: ({ id }: {
        id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a coverage_required transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    coverage_required: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a set_coverage_ratio_bps transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_coverage_ratio_bps: ({ bps }: {
        bps: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
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
        admin: (json: string) => AssembledTransaction<string>;
        pay_fee: (json: string) => AssembledTransaction<null>;
        upgrade: (json: string) => AssembledTransaction<null>;
        guarantee: (json: string) => AssembledTransaction<Guarantee>;
        set_admin: (json: string) => AssembledTransaction<null>;
        set_vault: (json: string) => AssembledTransaction<null>;
        cover_exit: (json: string) => AssembledTransaction<null>;
        grace_secs: (json: string) => AssembledTransaction<bigint>;
        is_current: (json: string) => AssembledTransaction<boolean>;
        monthly_fee: (json: string) => AssembledTransaction<bigint>;
        set_registry: (json: string) => AssembledTransaction<null>;
        cover_default: (json: string) => AssembledTransaction<null>;
        set_grace_secs: (json: string) => AssembledTransaction<null>;
        sign_guarantee: (json: string) => AssembledTransaction<Result<number, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        settle_guarantee: (json: string) => AssembledTransaction<null>;
        coverage_required: (json: string) => AssembledTransaction<bigint>;
        set_coverage_ratio_bps: (json: string) => AssembledTransaction<null>;
    };
}
