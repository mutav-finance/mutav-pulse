import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, Result } from "@stellar/stellar-sdk/contract";
import type { u32, u64, i128 } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CDAYVNXHJD2T4QO66ECBX6LNA2SD2HCP66H23FPYWW7VSUR74QJ2K2VK";
    };
};
/**
 * Underwriting errors surfaced as stable `#[contracterror]` codes. Numbered in
 * the `3xx` band to stay clear of the registry `2xx` and strategy `4xx` codes.
 */
export declare const PolicyError: {
    /**
     * `fee_bps` exceeds 100% (10_000 bps). Previously accepted silently, which
     * let a guarantee charge a premium above its own monthly amount.
     */
    300: {
        message: string;
    };
};
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
export declare const RegistryError: {
    /**
     * No guarantee is stored under the requested id (previously a host trap
     * from `Option::unwrap` on missing storage).
     */
    200: {
        message: string;
    };
};
export interface Client {
    /**
     * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;
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
     * Construct and simulate a is_current transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    is_current: ({ id }: {
        id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>;
    /**
     * Construct and simulate a pay_premium transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    pay_premium: ({ payer, id }: {
        payer: string;
        id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
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
     * Construct and simulate a sign_guarantee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    sign_guarantee: ({ landlord, monthly_amount, months_covered, fee_bps, period_secs }: {
        landlord: string;
        monthly_amount: i128;
        months_covered: u32;
        fee_bps: u32;
        period_secs: u64;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>;
    /**
     * Construct and simulate a monthly_premium transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    monthly_premium: ({ id }: {
        id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
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
        upgrade: (json: string) => AssembledTransaction<null>;
        guarantee: (json: string) => AssembledTransaction<Guarantee>;
        set_admin: (json: string) => AssembledTransaction<null>;
        set_vault: (json: string) => AssembledTransaction<null>;
        is_current: (json: string) => AssembledTransaction<boolean>;
        pay_premium: (json: string) => AssembledTransaction<null>;
        set_registry: (json: string) => AssembledTransaction<null>;
        cover_default: (json: string) => AssembledTransaction<null>;
        sign_guarantee: (json: string) => AssembledTransaction<Result<number, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        monthly_premium: (json: string) => AssembledTransaction<bigint>;
        settle_guarantee: (json: string) => AssembledTransaction<null>;
        coverage_required: (json: string) => AssembledTransaction<bigint>;
        set_coverage_ratio_bps: (json: string) => AssembledTransaction<null>;
    };
}
