import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, Result } from "@stellar/stellar-sdk/contract";
import type { u32, u64, i128 } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CA7WWXTNBG2QCDBQMYL3SV7DRXBW7KALM5JGWPJJEAP34DWWUMLYGSKN";
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
        set_admin: (json: string) => AssembledTransaction<null>;
        active_ids: (json: string) => AssembledTransaction<number[]>;
        set_writer: (json: string) => AssembledTransaction<null>;
    };
}
