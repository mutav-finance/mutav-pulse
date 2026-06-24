import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, Result } from "@stellar/stellar-sdk/contract";
import type { u32, u64, i128, Option } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CBYXNYYZRD5SOBU3HP5GWV7I64GISOF5H4SWN2UTXZ7FIF6LSVII36MT";
    };
};
/**
 * A "luz verde" gravada on-chain. `solvent` é sempre true quando gravada (uma
 * prova inválida reverte); o front lê o frescor por `ledger`/`ts`.
 */
export interface Attestation {
    ledger: u32;
    ratio_bps: u32;
    solvent: boolean;
    ts: u64;
}
/**
 * Erros do attestor.
 */
export declare const AttestError: {
    0: {
        message: string;
    };
    1: {
        message: string;
    };
    2: {
        message: string;
    };
    /**
     * `now - nonce > WINDOW_SECS` — atestação velha demais.
     */
    3: {
        message: string;
    };
    /**
     * `nonce > now` — atestação "do futuro".
     */
    4: {
        message: string;
    };
    /**
     * registry/vault/oráculo ainda não foram setados.
     */
    5: {
        message: string;
    };
    /**
     * `ratio_bps < MIN_RATIO_BPS` — faixa abaixo do piso de cobertura (100%).
     */
    6: {
        message: string;
    };
};
/**
 * Erros de verificação Groth16.
 */
export declare const Groth16Error: {
    0: {
        message: string;
    };
    1: {
        message: string;
    };
    2: {
        message: string;
    };
};
/**
 * Prova Groth16 = pontos A, B, C. B (G2) em ordem Soroban c1||c0.
 */
export interface Groth16Proof {
    a: Buffer;
    b: Buffer;
    c: Buffer;
}
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
export interface Client {
    /**
     * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;
    /**
     * Construct and simulate a attest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Verifica a prova contra o estado on-chain ao vivo e grava a atestação.
     * Públicos reconstruídos do estado real: prova feita p/ outro estado não verifica.
     * `nonce` = timestamp assinado pelo oráculo (frescor). PERMISSIONLESS.
     */
    attest: ({ proof, ratio_bps, nonce }: {
        proof: Buffer;
        ratio_bps: u32;
        nonce: u64;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
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
     * Construct and simulate a set_vault transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_vault: ({ addr }: {
        addr: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a set_oracle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Fixa a pubkey EdDSA do oráculo-banco (coords Ax/Ay como field elements BE).
     * Sem isto, a peça A seria forjável (qualquer prover assinaria com a própria chave).
     */
    set_oracle: ({ ax, ay }: {
        ax: Buffer;
        ay: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a set_registry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_registry: ({ addr }: {
        addr: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a last_attestation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Última atestação gravada (None se nunca houve). Leitura pública p/ o front.
     */
    last_attestation: (options?: MethodOptions) => Promise<AssembledTransaction<Option<Attestation>>>;
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
        attest: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        upgrade: (json: string) => AssembledTransaction<null>;
        set_admin: (json: string) => AssembledTransaction<null>;
        set_vault: (json: string) => AssembledTransaction<null>;
        set_oracle: (json: string) => AssembledTransaction<null>;
        set_registry: (json: string) => AssembledTransaction<null>;
        last_attestation: (json: string) => AssembledTransaction<Option<Attestation>>;
    };
}
