import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions } from "@stellar/stellar-sdk/contract";
import type { u32, i128 } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CCZATYOP5OCTKI4QA2THW5LACWIMIGGOOMQGVQFVQ2TESOS3ARFSJLIE";
    };
};
/**
 * Vault-side errors surfaced as stable `#[contracterror]` codes. Numbered in the
 * `6xx` band to stay clear of the interfaces `2xx`, policy `3xx`, strategy `4xx`,
 * and adapter `5xx` codes. Mirrors the adapter-defindex `AdapterError` pattern:
 * a money-path revert that carries a diagnosable code instead of an opaque host
 * trap. Code-only (not a storage entry) so it is layout-safe for in-place
 * `upgrade()`.
 */
export declare const VaultError: {
    /**
     * #34 / code-review H1: a money path (`disburse` / `process_redemptions`)
     * asked `ensure_liquidity` for more underlying than the strategies could
     * realize (e.g. a lossy/slippage adapter that reports `balance()` above what
     * `divest()` actually delivers). Yearn-v3 stance: revert rather than realize
     * an incorrect loss — the whole tx rolls back atomically.
     */
    600: {
        message: string;
    };
};
export interface RedeemRequest {
    claimable: i128;
    claimed: boolean;
    fulfilled: boolean;
    id: u32;
    owner: string;
    shares: i128;
}
export interface StrategyAlloc {
    address: string;
    volatile: boolean;
    weight_bps: u32;
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
export declare const FungibleTokenError: {
    /**
     * Indicates an error related to the current balance of account from which
     * tokens are expected to be transferred.
     */
    100: {
        message: string;
    };
    /**
     * Indicates a failure with the allowance mechanism when a given spender
     * doesn't have enough allowance.
     */
    101: {
        message: string;
    };
    /**
     * Indicates an invalid value for `live_until_ledger` when setting an
     * allowance.
     */
    102: {
        message: string;
    };
    /**
     * Indicates an error when an input that must be >= 0
     */
    103: {
        message: string;
    };
    /**
     * Indicates overflow when adding two values
     */
    104: {
        message: string;
    };
    /**
     * Indicates access to uninitialized metadata
     */
    105: {
        message: string;
    };
    /**
     * Indicates that the operation would have caused `total_supply` to exceed
     * the `cap`.
     */
    106: {
        message: string;
    };
    /**
     * Indicates the supplied `cap` is not a valid cap value.
     */
    107: {
        message: string;
    };
    /**
     * Indicates the Cap was not set.
     */
    108: {
        message: string;
    };
    /**
     * Indicates the SAC address was not set.
     */
    109: {
        message: string;
    };
    /**
     * Indicates a SAC address different than expected.
     */
    110: {
        message: string;
    };
    /**
     * Indicates a missing function parameter in the SAC contract context.
     */
    111: {
        message: string;
    };
    /**
     * Indicates an invalid function parameter in the SAC contract context.
     */
    112: {
        message: string;
    };
    /**
     * The user is not allowed to perform this operation
     */
    113: {
        message: string;
    };
    /**
     * The user is blocked and cannot perform this operation
     */
    114: {
        message: string;
    };
};
export interface Client {
    /**
     * Construct and simulate a mint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * SEP-0056 mint: mint exactly `shares` to `receiver`, pulling the required
     * (ceil-rounded) assets from `from`. Returns assets consumed.
     */
    mint: ({ shares, receiver, from, operator }: {
        shares: i128;
        receiver: string;
        from: string;
        operator: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a name transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Returns the name for this token.
     *
     * # Arguments
     *
     * * `e` - Access to Soroban environment.
     */
    name: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;
    /**
     * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;
    /**
     * Construct and simulate a claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    claim: ({ id }: {
        id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    policy: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;
    /**
     * Construct and simulate a redeem transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * SEP-0056 redeem — DISABLED (D2). Redeem via `request_redeem`.
     */
    redeem: ({ shares, receiver, owner, operator }: {
        shares: i128;
        receiver: string;
        owner: string;
        operator: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a symbol transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Returns the symbol for this token.
     *
     * # Arguments
     *
     * * `e` - Access to Soroban environment.
     */
    symbol: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;
    /**
     * Construct and simulate a approve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Sets the amount of tokens a `spender` is allowed to spend on behalf of
     * an `owner`. Overrides any existing allowance set between `spender` and
     * `owner`.
     *
     * # Arguments
     *
     * * `e` - Access to Soroban environment.
     * * `owner` - The address holding the tokens.
     * * `spender` - The address authorized to spend the tokens.
     * * `amount` - The amount of tokens made available to `spender`.
     * * `live_until_ledger` - The ledger number at which the allowance
     * expires.
     *
     * # Errors
     *
     * * [`FungibleTokenError::InvalidLiveUntilLedger`] - Occurs when
     * attempting to set `live_until_ledger` that is less than the current
     * ledger number and greater than `0`.
     * * [`FungibleTokenError::LessThanZero`] - Occurs when `amount < 0`.
     *
     * # Events
     *
     * * topics - `["approve", from: Address, spender: Address]`
     * * data - `[amount: i128, live_until_ledger: u32]`
     */
    approve: ({ owner, spender, amount, live_until_ledger }: {
        owner: string;
        spender: string;
        amount: i128;
        live_until_ledger: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Returns the amount of tokens held by `account`.
     *
     * # Arguments
     *
     * * `e` - Access to the Soroban environment.
     * * `account` - The address for which the balance is being queried.
     */
    balance: ({ account }: {
        account: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * SEP-0056 deposit: `from` provides `assets`, `receiver` gets the minted
     * shares, `operator` authorizes (allowance-delegated when `operator != from`).
     */
    deposit: ({ assets, receiver, from, operator }: {
        assets: i128;
        receiver: string;
        from: string;
        operator: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a request transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    request: ({ id }: {
        id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<RedeemRequest>>;
    /**
     * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    upgrade: ({ new_wasm_hash }: {
        new_wasm_hash: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a decimals transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Returns the number of decimals used to represent amounts of this token.
     *
     * # Arguments
     *
     * * `e` - Access to Soroban environment.
     */
    decimals: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>;
    /**
     * Construct and simulate a disburse transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    disburse: ({ to, amount, coverage_after }: {
        to: string;
        amount: i128;
        coverage_after: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a max_mint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    max_mint: ({ receiver }: {
        receiver: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Transfers `amount` of tokens from `from` to `to`.
     *
     * # Arguments
     *
     * * `e` - Access to Soroban environment.
     * * `from` - The address holding the tokens.
     * * `to` - The address receiving the transferred tokens.
     * * `amount` - The amount of tokens to be transferred.
     *
     * # Errors
     *
     * * [`FungibleTokenError::InsufficientBalance`] - When attempting to
     * transfer more tokens than `from` current balance.
     * * [`FungibleTokenError::LessThanZero`] - When `amount < 0`.
     *
     * # Events
     *
     * * topics - `["transfer", from: Address, to: Address]`
     * * data - `[to_muxed_id: Option<u64>, amount: i128]`
     */
    transfer: ({ from, to, amount }: {
        from: string;
        to: string;
        amount: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * SEP-0056 withdraw — DISABLED (D2). Redeem via `request_redeem`.
     */
    withdraw: ({ assets, receiver, owner, operator }: {
        assets: i128;
        receiver: string;
        owner: string;
        operator: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a allowance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Returns the amount of tokens a `spender` is allowed to spend on behalf
     * of an `owner`.
     *
     * # Arguments
     *
     * * `e` - Access to Soroban environment.
     * * `owner` - The address holding the tokens.
     * * `spender` - The address authorized to spend the tokens.
     */
    allowance: ({ owner, spender }: {
        owner: string;
        spender: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a rebalance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Rebalance strategy allocations toward target — idempotent and bidirectional.
     *
     * Keeps `target_idle` (a fraction of TOTAL assets, see `min_liquid_buffer_bps`)
     * as a liquid cash buffer and spreads the surplus across strategies by weight,
     * each clamped to its `strategy_max_debt_bps` cap. Each strategy's on-chain
     * balance is moved toward that target: pulled back when over, deployed when
     * under. Targets are computed once off a snapshot, so calling at-target is a
     * no-op — the buffer holds instead of draining across repeated calls.
     *
     * LIQUIDITY-only: never reads `coverage_required` (solvency stays enforced by
     * the `free_capital` redemption gate + disburse ordering). Capped overflow
     * simply remains idle above `target_idle`. Divest pass runs before invest so
     * pulled-back funds are available to fund the deploys.
     *
     * Under a LOSSY divest (a slippage/fee adapter that delivers less underlying
     * than its reported balance implies), the invest pass is clamped to the
     * realized live idle, so full convergence to target may take an ADDITIONAL
     */
    rebalance: (options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_admin: ({ new_admin }: {
        new_admin: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a fee_income transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    fee_income: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a max_redeem transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * 0 — synchronous withdrawals are disabled; redeem via the queue (D2).
     */
    max_redeem: ({ owner }: {
        owner: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a set_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_policy: ({ policy }: {
        policy: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a strategies transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    strategies: (options?: MethodOptions) => Promise<AssembledTransaction<Array<StrategyAlloc>>>;
    /**
     * Construct and simulate a collect_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    collect_fee: ({ from, amount }: {
        from: string;
        amount: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a max_deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    max_deposit: ({ receiver }: {
        receiver: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a query_asset transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * SEP-0056: address of the underlying asset the vault manages.
     */
    query_asset: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;
    /**
     * Construct and simulate a target_idle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Target idle cash retained as the liquid buffer: `total_assets × bps`.
     * The surplus above this is what `rebalance` deploys across strategies.
     */
    target_idle: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a add_strategy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    add_strategy: ({ address, weight_bps, volatile }: {
        address: string;
        weight_bps: u32;
        volatile: boolean;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a free_capital transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    free_capital: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a max_withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * 0 — synchronous withdrawals are disabled; redeem via the queue (D2).
     */
    max_withdraw: ({ owner }: {
        owner: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a preview_mint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    preview_mint: ({ shares }: {
        shares: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a total_assets transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    total_assets: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a total_supply transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Returns the total amount of tokens in circulation.
     *
     * # Arguments
     *
     * * `e` - Access to the Soroban environment.
     */
    total_supply: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a cancel_redeem transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Returns escrowed shares for an unfulfilled request and drops it.
     */
    cancel_redeem: ({ id }: {
        id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a nav_per_share transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    nav_per_share: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a stable_assets transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    stable_assets: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a transfer_from transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Transfers `amount` of tokens from `from` to `to` using the
     * allowance mechanism. `amount` is then deducted from `spender`
     * allowance.
     *
     * # Arguments
     *
     * * `e` - Access to Soroban environment.
     * * `spender` - The address authorizing the transfer, and having its
     * allowance consumed during the transfer.
     * * `from` - The address holding the tokens which will be transferred.
     * * `to` - The address receiving the transferred tokens.
     * * `amount` - The amount of tokens to be transferred.
     *
     * # Errors
     *
     * * [`FungibleTokenError::InsufficientBalance`] - When attempting to
     * transfer more tokens than `from` current balance.
     * * [`FungibleTokenError::LessThanZero`] - When `amount < 0`.
     * * [`FungibleTokenError::InsufficientAllowance`] - When attempting to
     * transfer more tokens than `spender` current allowance.
     *
     * # Events
     *
     * * topics - `["transfer", from: Address, to: Address]`
     * * data - `[amount: i128]`
     */
    transfer_from: ({ spender, from, to, amount }: {
        spender: string;
        from: string;
        to: string;
        amount: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a available_held transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    available_held: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a preview_redeem transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    preview_redeem: ({ shares }: {
        shares: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a request_redeem transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    request_redeem: ({ owner, shares }: {
        owner: string;
        shares: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<u32>>;
    /**
     * Construct and simulate a preview_deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    preview_deposit: ({ assets }: {
        assets: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a remove_strategy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    remove_strategy: ({ address }: {
        address: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a pending_requests transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    pending_requests: (options?: MethodOptions) => Promise<AssembledTransaction<Array<u32>>>;
    /**
     * Construct and simulate a preview_withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    preview_withdraw: ({ assets }: {
        assets: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a convert_to_assets transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    convert_to_assets: ({ shares }: {
        shares: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a convert_to_shares transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    convert_to_shares: ({ assets }: {
        assets: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a set_token_metadata transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Admin-gated re-label of the share token (name + symbol). Decimals are
     * fixed at 7. Lets a deployed reserve adopt its per-currency symbol
     * (MUSD / MBRL / MARS) via `upgrade()` instead of a destructive redeploy —
     * balances, NAV, and seeded state are preserved.
     */
    set_token_metadata: ({ name, symbol }: {
        name: string;
        symbol: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a process_redemptions transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    process_redemptions: ({ max_batch }: {
        max_batch: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a min_liquid_buffer_bps transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Fraction of TOTAL assets (in bps) the vault retains as a liquid cash
     * buffer; `rebalance` deploys the surplus above it and divests back into it.
     * 0 = deploy everything. Set per reserve. This is a LIQUIDITY optimization
     * (avoid on-demand divest costs), NOT a solvency reserve — solvency stays
     * enforced by `free_capital` / `coverage_required`.
     */
    min_liquid_buffer_bps: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>;
    /**
     * Construct and simulate a strategy_max_debt_bps transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Per-strategy concentration cap, in bps of TOTAL assets. Defaults to 100%
     * (uncapped) when unset. `rebalance` will not deploy a strategy above this.
     */
    strategy_max_debt_bps: ({ strategy }: {
        strategy: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<u32>>;
    /**
     * Construct and simulate a set_min_liquid_buffer_bps transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_min_liquid_buffer_bps: ({ bps }: {
        bps: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a set_strategy_max_debt_bps transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_strategy_max_debt_bps: ({ strategy, bps }: {
        strategy: string;
        bps: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { admin, underlying, name, symbol }: {
        admin: string;
        underlying: string;
        name: string;
        symbol: string;
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
        mint: (json: string) => AssembledTransaction<bigint>;
        name: (json: string) => AssembledTransaction<string>;
        admin: (json: string) => AssembledTransaction<string>;
        claim: (json: string) => AssembledTransaction<null>;
        policy: (json: string) => AssembledTransaction<string>;
        redeem: (json: string) => AssembledTransaction<bigint>;
        symbol: (json: string) => AssembledTransaction<string>;
        approve: (json: string) => AssembledTransaction<null>;
        balance: (json: string) => AssembledTransaction<bigint>;
        deposit: (json: string) => AssembledTransaction<bigint>;
        request: (json: string) => AssembledTransaction<RedeemRequest>;
        upgrade: (json: string) => AssembledTransaction<null>;
        decimals: (json: string) => AssembledTransaction<number>;
        disburse: (json: string) => AssembledTransaction<null>;
        max_mint: (json: string) => AssembledTransaction<bigint>;
        transfer: (json: string) => AssembledTransaction<null>;
        withdraw: (json: string) => AssembledTransaction<bigint>;
        allowance: (json: string) => AssembledTransaction<bigint>;
        rebalance: (json: string) => AssembledTransaction<null>;
        set_admin: (json: string) => AssembledTransaction<null>;
        fee_income: (json: string) => AssembledTransaction<bigint>;
        max_redeem: (json: string) => AssembledTransaction<bigint>;
        set_policy: (json: string) => AssembledTransaction<null>;
        strategies: (json: string) => AssembledTransaction<StrategyAlloc[]>;
        collect_fee: (json: string) => AssembledTransaction<null>;
        max_deposit: (json: string) => AssembledTransaction<bigint>;
        query_asset: (json: string) => AssembledTransaction<string>;
        target_idle: (json: string) => AssembledTransaction<bigint>;
        add_strategy: (json: string) => AssembledTransaction<null>;
        free_capital: (json: string) => AssembledTransaction<bigint>;
        max_withdraw: (json: string) => AssembledTransaction<bigint>;
        preview_mint: (json: string) => AssembledTransaction<bigint>;
        total_assets: (json: string) => AssembledTransaction<bigint>;
        total_supply: (json: string) => AssembledTransaction<bigint>;
        cancel_redeem: (json: string) => AssembledTransaction<null>;
        nav_per_share: (json: string) => AssembledTransaction<bigint>;
        stable_assets: (json: string) => AssembledTransaction<bigint>;
        transfer_from: (json: string) => AssembledTransaction<null>;
        available_held: (json: string) => AssembledTransaction<bigint>;
        preview_redeem: (json: string) => AssembledTransaction<bigint>;
        request_redeem: (json: string) => AssembledTransaction<number>;
        preview_deposit: (json: string) => AssembledTransaction<bigint>;
        remove_strategy: (json: string) => AssembledTransaction<null>;
        pending_requests: (json: string) => AssembledTransaction<number[]>;
        preview_withdraw: (json: string) => AssembledTransaction<bigint>;
        convert_to_assets: (json: string) => AssembledTransaction<bigint>;
        convert_to_shares: (json: string) => AssembledTransaction<bigint>;
        set_token_metadata: (json: string) => AssembledTransaction<null>;
        process_redemptions: (json: string) => AssembledTransaction<null>;
        min_liquid_buffer_bps: (json: string) => AssembledTransaction<number>;
        strategy_max_debt_bps: (json: string) => AssembledTransaction<number>;
        set_min_liquid_buffer_bps: (json: string) => AssembledTransaction<null>;
        set_strategy_max_debt_bps: (json: string) => AssembledTransaction<null>;
    };
}
