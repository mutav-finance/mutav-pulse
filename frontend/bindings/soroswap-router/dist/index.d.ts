import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, Result } from "@stellar/stellar-sdk/contract";
import type { u64, i128 } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD";
    };
};
export interface InitializedEvent {
    factory: string;
}
export interface AddLiquidityEvent {
    amount_a: i128;
    amount_b: i128;
    liquidity: i128;
    pair: string;
    to: string;
    token_a: string;
    token_b: string;
}
export interface RemoveLiquidityEvent {
    amount_a: i128;
    amount_b: i128;
    liquidity: i128;
    pair: string;
    to: string;
    token_a: string;
    token_b: string;
}
export interface SwapEvent {
    amounts: Array<i128>;
    path: Array<string>;
    to: string;
}
export declare const SoroswapRouterError: {
    /**
     * SoroswapRouter: not yet initialized
     */
    401: {
        message: string;
    };
    /**
     * SoroswapRouter: negative amount is not allowed
     */
    402: {
        message: string;
    };
    /**
     * SoroswapRouter: deadline expired
     */
    403: {
        message: string;
    };
    /**
     * SoroswapRouter: already initialized
     */
    404: {
        message: string;
    };
    /**
     * SoroswapRouter: insufficient a amount
     */
    405: {
        message: string;
    };
    /**
     * SoroswapRouter: insufficient b amount
     */
    406: {
        message: string;
    };
    /**
     * SoroswapRouter: insufficient output amount
     */
    407: {
        message: string;
    };
    /**
     * SoroswapRouter: excessive input amount
     */
    408: {
        message: string;
    };
    /**
     * SoroswapRouter: pair does not exist
     */
    409: {
        message: string;
    };
};
export declare const CombinedRouterError: {
    501: {
        message: string;
    };
    502: {
        message: string;
    };
    503: {
        message: string;
    };
    504: {
        message: string;
    };
    505: {
        message: string;
    };
    506: {
        message: string;
    };
    507: {
        message: string;
    };
    508: {
        message: string;
    };
    509: {
        message: string;
    };
    510: {
        message: string;
    };
    511: {
        message: string;
    };
    512: {
        message: string;
    };
    513: {
        message: string;
    };
    514: {
        message: string;
    };
    515: {
        message: string;
    };
};
export declare const SoroswapLibraryError: {
    /**
     * SoroswapLibrary: insufficient amount
     */
    301: {
        message: string;
    };
    /**
     * SoroswapLibrary: insufficient liquidity
     */
    302: {
        message: string;
    };
    /**
     * SoroswapLibrary: insufficient input amount
     */
    303: {
        message: string;
    };
    /**
     * SoroswapLibrary: insufficient output amount
     */
    304: {
        message: string;
    };
    /**
     * SoroswapLibrary: invalid path
     */
    305: {
        message: string;
    };
    /**
     * SoroswapLibrary: token_a and token_b have identical addresses
     */
    306: {
        message: string;
    };
};
export interface Client {
    /**
     * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Initializes the contract and sets the factory address
     */
    initialize: ({ factory }: {
        factory: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a add_liquidity transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Adds liquidity to a token pair's pool, creating it if it doesn't exist. Ensures that exactly the desired amounts
     * of both tokens are added, subject to minimum requirements.
     * This function is responsible for transferring tokens from the user to the pool and minting liquidity tokens in return.
     * # Arguments
     * * `token_a` - The address of the first token to add liquidity for.
     * * `token_b` - The address of the second token to add liquidity for.
     * * `amount_a_desired` - The desired amount of the first token to add.
     * * `amount_b_desired` - The desired amount of the second token to add.
     * * `amount_a_min` - The minimum required amount of the first token to add.
     * * `amount_b_min` - The minimum required amount of the second token to add.
     * * `to` - The address where the liquidity tokens will be minted and sent.
     * * `deadline` - The deadline for executing the operation.
     * # Returns
     * A tuple containing: amounts of token A and B added to the pool.
     * plus the amount of liquidity tokens minted.
     */
    add_liquidity: ({ token_a, token_b, amount_a_desired, amount_b_desired, amount_a_min, amount_b_min, to, deadline }: {
        token_a: string;
        token_b: string;
        amount_a_desired: i128;
        amount_b_desired: i128;
        amount_a_min: i128;
        amount_b_min: i128;
        to: string;
        deadline: u64;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<readonly [i128, i128, i128]>>>;
    /**
     * Construct and simulate a remove_liquidity transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Removes liquidity from a token pair's pool.
     *
     * This function facilitates the removal of liquidity from a Soroswap Liquidity Pool by burning a specified amount
     * of Liquidity Pool tokens (`liquidity`) owned by the caller. In return, it transfers back the corresponding
     * amounts of the paired tokens (`token_a` and `token_b`) to the caller's specified address (`to`).
     *
     * # Arguments
     * * `token_a` - The address of the first token in the Liquidity Pool.
     * * `token_b` - The address of the second token in the Liquidity Pool.
     * * `liquidity` - The desired amount of Liquidity Pool tokens to be burned.
     * * `amount_a_min` - The minimum required amount of the first token to receive.
     * * `amount_b_min` - The minimum required amount of the second token to receive.
     * * `to` - The address where the paired tokens will be sent to, and from where the LP tokens will be taken.
     * * `deadline` - The deadline for executing the operation.
     *
     * # Returns
     * A tuple containing the amounts of `token_a` and `token_b` withdrawn from the pool.
     */
    remove_liquidity: ({ token_a, token_b, liquidity, amount_a_min, amount_b_min, to, deadline }: {
        token_a: string;
        token_b: string;
        liquidity: i128;
        amount_a_min: i128;
        amount_b_min: i128;
        to: string;
        deadline: u64;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<readonly [i128, i128]>>>;
    /**
     * Construct and simulate a swap_exact_tokens_for_tokens transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Swaps an exact amount of input tokens for as many output tokens as possible
     * along the specified trading route. The route is determined by the `path` vector,
     * where the first element is the input token, the last is the output token,
     * and any intermediate elements represent pairs to trade through if a direct pair does not exist.
     *
     * # Arguments
     * * `amount_in` - The exact amount of input tokens to be swapped.
     * * `amount_out_min` - The minimum required amount of output tokens to receive.
     * * `path` - A vector representing the trading route, where the first element is the input token
     * and the last is the output token. Intermediate elements represent pairs to trade through.
     * * `to` - The address where the output tokens will be sent to.
     * * `deadline` - The deadline for executing the operation.
     *
     * # Returns
     * A vector containing the amounts of tokens received at each step of the trading route.
     */
    swap_exact_tokens_for_tokens: ({ amount_in, amount_out_min, path, to, deadline }: {
        amount_in: i128;
        amount_out_min: i128;
        path: Array<string>;
        to: string;
        deadline: u64;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<i128>>>>;
    /**
     * Construct and simulate a swap_tokens_for_exact_tokens transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Swaps tokens for an exact amount of output token, following the specified trading route.
     * The route is determined by the `path` vector, where the first element is the input token,
     * the last is the output token, and any intermediate elements represent pairs to trade through.
     *
     * # Arguments
     * * `amount_out` - The exact amount of output token to be received.
     * * `amount_in_max` - The maximum allowed amount of input tokens to be swapped.
     * * `path` - A vector representing the trading route, where the first element is the input token
     * and the last is the output token. Intermediate elements represent pairs to trade through.
     * * `to` - The address where the output tokens will be sent to.
     * * `deadline` - The deadline for executing the operation.
     *
     * # Returns
     * A vector containing the amounts of tokens used at each step of the trading route.
     */
    swap_tokens_for_exact_tokens: ({ amount_out, amount_in_max, path, to, deadline }: {
        amount_out: i128;
        amount_in_max: i128;
        path: Array<string>;
        to: string;
        deadline: u64;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<i128>>>>;
    /**
     * Construct and simulate a get_factory transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * This function retrieves the factory contract's address associated with the provided environment.
     * It also checks if the factory has been initialized and raises an assertion error if not.
     * If the factory is not initialized, this code will raise an assertion error with the message "SoroswapRouter: not yet initialized".
     * https://github.com/benjaminsalon/malicious_sorochat
     * # Arguments
     * * `e` - The contract environment (`Env`) in which the contract is executing.
     */
    get_factory: (options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>;
    /**
     * Construct and simulate a router_pair_for transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Calculates the deterministic address for a pair without making any external calls.
     * check <https://github.com/paltalabs/deterministic-address-soroban>
     *
     * # Arguments
     *
     * * `e` - The environment.
     * * `token_a` - The address of the first token.
     * * `token_b` - The address of the second token.
     *
     * # Returns
     *
     * Returns `Result<Address, SoroswapLibraryError>` where `Ok` contains the deterministic address for the pair, and `Err` indicates an error such as identical tokens or an issue with sorting.
     */
    router_pair_for: ({ token_a, token_b }: {
        token_a: string;
        token_b: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>;
    /**
     * Construct and simulate a router_quote transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Given some amount of an asset and pair reserves, returns an equivalent amount of the other asset.
     *
     * # Arguments
     *
     * * `amount_a` - The amount of the first asset.
     * * `reserve_a` - Reserves of the first asset in the pair.
     * * `reserve_b` - Reserves of the second asset in the pair.
     *
     * # Returns
     *
     * Returns `Result<i128, SoroswapLibraryError>` where `Ok` contains the calculated equivalent amount, and `Err` indicates an error such as insufficient amount or liquidity
     */
    router_quote: ({ amount_a, reserve_a, reserve_b }: {
        amount_a: i128;
        reserve_a: i128;
        reserve_b: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>;
    /**
     * Construct and simulate a router_get_amount_out transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset.
     *
     * # Arguments
     *
     * * `amount_in` - The input amount of the asset.
     * * `reserve_in` - Reserves of the input asset in the pair.
     * * `reserve_out` - Reserves of the output asset in the pair.
     *
     * # Returns
     *
     * Returns `Result<i128, SoroswapLibraryError>` where `Ok` contains the calculated maximum output amount, and `Err` indicates an error such as insufficient input amount or liquidity.
     */
    router_get_amount_out: ({ amount_in, reserve_in, reserve_out }: {
        amount_in: i128;
        reserve_in: i128;
        reserve_out: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>;
    /**
     * Construct and simulate a router_get_amount_in transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Given an output amount of an asset and pair reserves, returns a required input amount of the other asset.
     *
     * # Arguments
     *
     * * `amount_out` - The output amount of the asset.
     * * `reserve_in` - Reserves of the input asset in the pair.
     * * `reserve_out` - Reserves of the output asset in the pair.
     *
     * # Returns
     *
     * Returns `Result<i128, SoroswapLibraryError>` where `Ok` contains the required input amount, and `Err` indicates an error such as insufficient output amount or liquidity.
     */
    router_get_amount_in: ({ amount_out, reserve_in, reserve_out }: {
        amount_out: i128;
        reserve_in: i128;
        reserve_out: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>;
    /**
     * Construct and simulate a router_get_amounts_out transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Performs chained get_amount_out calculations on any number of pairs.
     *
     * # Arguments
     *
     * * `e` - The environment.
     * * `amount_in` - The input amount.
     * * `path` - Vector of token addresses representing the path.
     *
     * # Returns
     *
     * Returns `Result<Vec<i128>, SoroswapLibraryError>` where `Ok` contains a vector of calculated amounts, and `Err` indicates an error such as an invalid path.
     */
    router_get_amounts_out: ({ amount_in, path }: {
        amount_in: i128;
        path: Array<string>;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<i128>>>>;
    /**
     * Construct and simulate a router_get_amounts_in transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Performs chained get_amount_in calculations on any number of pairs.
     *
     * # Arguments
     *
     * * `e` - The environment.
     * * `amount_out` - The output amount.
     * * `path` - Vector of token addresses representing the path.
     *
     * # Returns
     *
     * Returns `Result<Vec<i128>, SoroswapLibraryError>` where `Ok` contains a vector of calculated amounts, and `Err` indicates an error such as an invalid path.
     */
    router_get_amounts_in: ({ amount_out, path }: {
        amount_out: i128;
        path: Array<string>;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<i128>>>>;
    /**
     * Construct and simulate a sort_tokens transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Sorts two token addresses in a consistent order.
     *
     * # Arguments
     *
     * * `token_a` - The address of the first token.
     * * `token_b` - The address of the second token.
     *
     * # Returns
     *
     * Returns `Result<(Address, Address), SoroswapLibraryError>` where `Ok` contains a tuple with the sorted token addresses, and `Err` indicates an error such as identical tokens.
     */
    sort_tokens: ({ token_a, token_b }: {
        token_a: string;
        token_b: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<readonly [string, string]>>>;
    /**
     * Construct and simulate a pair_for transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Calculates the deterministic address for a pair without making any external calls.
     * check <https://github.com/paltalabs/deterministic-address-soroban>
     *
     * # Arguments
     *
     * * `e` - The environment.
     * * `factory` - The factory address.
     * * `token_a` - The address of the first token.
     * * `token_b` - The address of the second token.
     *
     * # Returns
     *
     * Returns `Result<Address, SoroswapLibraryError>` where `Ok` contains the deterministic address for the pair, and `Err` indicates an error such as identical tokens or an issue with sorting.
     */
    pair_for: ({ factory, token_a, token_b }: {
        factory: string;
        token_a: string;
        token_b: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>;
    /**
     * Construct and simulate a get_reserves transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Fetches and sorts the reserves for a pair of tokens.
     *
     * # Arguments
     *
     * * `e` - The environment.
     * * `factory` - The factory address.
     * * `token_a` - The address of the first token.
     * * `token_b` - The address of the second token.
     *
     * # Returns
     *
     * Returns `Result<(i128, i128), SoroswapLibraryError>` where `Ok` contains a tuple of sorted reserves, and `Err` indicates an error such as identical tokens or an issue with sorting.
     */
    get_reserves: ({ factory, token_a, token_b }: {
        factory: string;
        token_a: string;
        token_b: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<readonly [i128, i128]>>>;
    /**
     * Construct and simulate a quote transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Given some amount of an asset and pair reserves, returns an equivalent amount of the other asset.
     *
     * # Arguments
     *
     * * `amount_a` - The amount of the first asset.
     * * `reserve_a` - Reserves of the first asset in the pair.
     * * `reserve_b` - Reserves of the second asset in the pair.
     *
     * # Returns
     *
     * Returns `Result<i128, SoroswapLibraryError>` where `Ok` contains the calculated equivalent amount, and `Err` indicates an error such as insufficient amount or liquidity
     */
    quote: ({ amount_a, reserve_a, reserve_b }: {
        amount_a: i128;
        reserve_a: i128;
        reserve_b: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>;
    /**
     * Construct and simulate a get_amount_out transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset.
     *
     * # Arguments
     *
     * * `amount_in` - The input amount of the asset.
     * * `reserve_in` - Reserves of the input asset in the pair.
     * * `reserve_out` - Reserves of the output asset in the pair.
     *
     * # Returns
     *
     * Returns `Result<i128, SoroswapLibraryError>` where `Ok` contains the calculated maximum output amount, and `Err` indicates an error such as insufficient input amount or liquidity.
     */
    get_amount_out: ({ amount_in, reserve_in, reserve_out }: {
        amount_in: i128;
        reserve_in: i128;
        reserve_out: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>;
    /**
     * Construct and simulate a get_amount_in transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Given an output amount of an asset and pair reserves, returns a required input amount of the other asset.
     *
     * # Arguments
     *
     * * `amount_out` - The output amount of the asset.
     * * `reserve_in` - Reserves of the input asset in the pair.
     * * `reserve_out` - Reserves of the output asset in the pair.
     *
     * # Returns
     *
     * Returns `Result<i128, SoroswapLibraryError>` where `Ok` contains the required input amount, and `Err` indicates an error such as insufficient output amount or liquidity.
     */
    get_amount_in: ({ amount_out, reserve_in, reserve_out }: {
        amount_out: i128;
        reserve_in: i128;
        reserve_out: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>;
    /**
     * Construct and simulate a get_amounts_out transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Performs chained get_amount_out calculations on any number of pairs.
     *
     * # Arguments
     *
     * * `e` - The environment.
     * * `factory` - The factory address.
     * * `amount_in` - The input amount.
     * * `path` - Vector of token addresses representing the path.
     *
     * # Returns
     *
     * Returns `Result<Vec<i128>, SoroswapLibraryError>` where `Ok` contains a vector of calculated amounts, and `Err` indicates an error such as an invalid path.
     */
    get_amounts_out: ({ factory, amount_in, path }: {
        factory: string;
        amount_in: i128;
        path: Array<string>;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<i128>>>>;
    /**
     * Construct and simulate a get_amounts_in transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Performs chained get_amount_in calculations on any number of pairs.
     *
     * # Arguments
     *
     * * `e` - The environment.
     * * `factory` - The factory address.
     * * `amount_out` - The output amount.
     * * `path` - Vector of token addresses representing the path.
     *
     * # Returns
     *
     * Returns `Result<Vec<i128>, SoroswapLibraryError>` where `Ok` contains a vector of calculated amounts, and `Err` indicates an error such as an invalid path.
     */
    get_amounts_in: ({ factory, amount_out, path }: {
        factory: string;
        amount_out: i128;
        path: Array<string>;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<Array<i128>>>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
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
        initialize: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        add_liquidity: (json: string) => AssembledTransaction<Result<readonly [bigint, bigint, bigint], import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        remove_liquidity: (json: string) => AssembledTransaction<Result<readonly [bigint, bigint], import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        swap_exact_tokens_for_tokens: (json: string) => AssembledTransaction<Result<bigint[], import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        swap_tokens_for_exact_tokens: (json: string) => AssembledTransaction<Result<bigint[], import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_factory: (json: string) => AssembledTransaction<Result<string, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        router_pair_for: (json: string) => AssembledTransaction<Result<string, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        router_quote: (json: string) => AssembledTransaction<Result<bigint, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        router_get_amount_out: (json: string) => AssembledTransaction<Result<bigint, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        router_get_amount_in: (json: string) => AssembledTransaction<Result<bigint, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        router_get_amounts_out: (json: string) => AssembledTransaction<Result<bigint[], import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        router_get_amounts_in: (json: string) => AssembledTransaction<Result<bigint[], import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        sort_tokens: (json: string) => AssembledTransaction<Result<readonly [string, string], import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        pair_for: (json: string) => AssembledTransaction<Result<string, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_reserves: (json: string) => AssembledTransaction<Result<readonly [bigint, bigint], import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        quote: (json: string) => AssembledTransaction<Result<bigint, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_amount_out: (json: string) => AssembledTransaction<Result<bigint, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_amount_in: (json: string) => AssembledTransaction<Result<bigint, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_amounts_out: (json: string) => AssembledTransaction<Result<bigint[], import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_amounts_in: (json: string) => AssembledTransaction<Result<bigint[], import("@stellar/stellar-sdk/contract").ErrorMessage>>;
    };
}
