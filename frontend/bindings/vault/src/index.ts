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
    contractId: "CD6WEKU2UDDUJFSQAE6AMYUDC2Q5C6RA6J23WQMWRTBQVKTMTLDK45KX",
  }
} as const



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





export const FungibleTokenError = {
  /**
   * Indicates an error related to the current balance of account from which
   * tokens are expected to be transferred.
   */
  100: {message:"InsufficientBalance"},
  /**
   * Indicates a failure with the allowance mechanism when a given spender
   * doesn't have enough allowance.
   */
  101: {message:"InsufficientAllowance"},
  /**
   * Indicates an invalid value for `live_until_ledger` when setting an
   * allowance.
   */
  102: {message:"InvalidLiveUntilLedger"},
  /**
   * Indicates an error when an input that must be >= 0
   */
  103: {message:"LessThanZero"},
  /**
   * Indicates overflow when adding two values
   */
  104: {message:"MathOverflow"},
  /**
   * Indicates access to uninitialized metadata
   */
  105: {message:"UnsetMetadata"},
  /**
   * Indicates that the operation would have caused `total_supply` to exceed
   * the `cap`.
   */
  106: {message:"ExceededCap"},
  /**
   * Indicates the supplied `cap` is not a valid cap value.
   */
  107: {message:"InvalidCap"},
  /**
   * Indicates the Cap was not set.
   */
  108: {message:"CapNotSet"},
  /**
   * Indicates the SAC address was not set.
   */
  109: {message:"SACNotSet"},
  /**
   * Indicates a SAC address different than expected.
   */
  110: {message:"SACAddressMismatch"},
  /**
   * Indicates a missing function parameter in the SAC contract context.
   */
  111: {message:"SACMissingFnParam"},
  /**
   * Indicates an invalid function parameter in the SAC contract context.
   */
  112: {message:"SACInvalidFnParam"},
  /**
   * The user is not allowed to perform this operation
   */
  113: {message:"UserNotAllowed"},
  /**
   * The user is blocked and cannot perform this operation
   */
  114: {message:"UserBlocked"}
}

export interface Client {
  /**
   * Construct and simulate a mint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * SEP-0056 mint: mint exactly `shares` to `receiver`, pulling the required
   * (ceil-rounded) assets from `from`. Returns assets consumed.
   */
  mint: ({shares, receiver, from, operator}: {shares: i128, receiver: string, from: string, operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a name transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the name for this token.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   */
  name: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  claim: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  policy: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a redeem transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * SEP-0056 redeem — DISABLED (D2). Redeem via `request_redeem`.
   */
  redeem: ({shares, receiver, owner, operator}: {shares: i128, receiver: string, owner: string, operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a symbol transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the symbol for this token.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   */
  symbol: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

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
  approve: ({owner, spender, amount, live_until_ledger}: {owner: string, spender: string, amount: i128, live_until_ledger: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the amount of tokens held by `account`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `account` - The address for which the balance is being queried.
   */
  balance: ({account}: {account: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * SEP-0056 deposit: `from` provides `assets`, `receiver` gets the minted
   * shares, `operator` authorizes (allowance-delegated when `operator != from`).
   */
  deposit: ({assets, receiver, from, operator}: {assets: i128, receiver: string, from: string, operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a request transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  request: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<RedeemRequest>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a decimals transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the number of decimals used to represent amounts of this token.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   */
  decimals: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a disburse transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  disburse: ({to, amount}: {to: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a max_mint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  max_mint: ({receiver}: {receiver: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

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
  transfer: ({from, to, amount}: {from: string, to: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * SEP-0056 withdraw — DISABLED (D2). Redeem via `request_redeem`.
   */
  withdraw: ({assets, receiver, owner, operator}: {assets: i128, receiver: string, owner: string, operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

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
  allowance: ({owner, spender}: {owner: string, spender: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a rebalance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  rebalance: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a max_redeem transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * 0 — synchronous withdrawals are disabled; redeem via the queue (D2).
   */
  max_redeem: ({owner}: {owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a set_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_policy: ({policy}: {policy: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a strategies transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  strategies: (options?: MethodOptions) => Promise<AssembledTransaction<Array<StrategyAlloc>>>

  /**
   * Construct and simulate a max_deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  max_deposit: ({receiver}: {receiver: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a query_asset transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * SEP-0056: address of the underlying asset the vault manages.
   */
  query_asset: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a add_strategy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  add_strategy: ({address, weight_bps, volatile}: {address: string, weight_bps: u32, volatile: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a free_capital transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  free_capital: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a max_withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * 0 — synchronous withdrawals are disabled; redeem via the queue (D2).
   */
  max_withdraw: ({owner}: {owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a preview_mint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  preview_mint: ({shares}: {shares: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a total_assets transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  total_assets: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a total_supply transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the total amount of tokens in circulation.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   */
  total_supply: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a cancel_redeem transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns escrowed shares for an unfulfilled request and drops it.
   */
  cancel_redeem: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a nav_per_share transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  nav_per_share: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a stable_assets transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  stable_assets: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

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
  transfer_from: ({spender, from, to, amount}: {spender: string, from: string, to: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a available_held transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  available_held: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a premium_income transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  premium_income: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a preview_redeem transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  preview_redeem: ({shares}: {shares: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a request_redeem transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  request_redeem: ({owner, shares}: {owner: string, shares: i128}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a collect_premium transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  collect_premium: ({from, amount}: {from: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a preview_deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  preview_deposit: ({assets}: {assets: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a remove_strategy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  remove_strategy: ({address}: {address: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a pending_requests transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  pending_requests: (options?: MethodOptions) => Promise<AssembledTransaction<Array<u32>>>

  /**
   * Construct and simulate a preview_withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  preview_withdraw: ({assets}: {assets: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a convert_to_assets transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  convert_to_assets: ({shares}: {shares: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a convert_to_shares transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  convert_to_shares: ({assets}: {assets: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a process_redemptions transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  process_redemptions: ({max_batch}: {max_batch: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, underlying}: {admin: string, underlying: string},
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
    return ContractClient.deploy({admin, underlying}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAIRTRVAtMDA1NiBtaW50OiBtaW50IGV4YWN0bHkgYHNoYXJlc2AgdG8gYHJlY2VpdmVyYCwgcHVsbGluZyB0aGUgcmVxdWlyZWQKKGNlaWwtcm91bmRlZCkgYXNzZXRzIGZyb20gYGZyb21gLiBSZXR1cm5zIGFzc2V0cyBjb25zdW1lZC4AAAAEbWludAAAAAQAAAAAAAAABnNoYXJlcwAAAAAACwAAAAAAAAAIcmVjZWl2ZXIAAAATAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAIb3BlcmF0b3IAAAATAAAAAQAAAAs=",
        "AAAAAAAAAFVSZXR1cm5zIHRoZSBuYW1lIGZvciB0aGlzIHRva2VuLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuAAAAAAAABG5hbWUAAAAAAAAAAQAAABA=",
        "AAAAAAAAAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAFY2xhaW0AAAAAAAABAAAAAAAAAAJpZAAAAAAABAAAAAA=",
        "AAAAAAAAAAAAAAAGcG9saWN5AAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAD9TRVAtMDA1NiByZWRlZW0g4oCUIERJU0FCTEVEIChEMikuIFJlZGVlbSB2aWEgYHJlcXVlc3RfcmVkZWVtYC4AAAAABnJlZGVlbQAAAAAABAAAAAAAAAAGc2hhcmVzAAAAAAALAAAAAAAAAAhyZWNlaXZlcgAAABMAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAIb3BlcmF0b3IAAAATAAAAAQAAAAs=",
        "AAAAAAAAAFdSZXR1cm5zIHRoZSBzeW1ib2wgZm9yIHRoaXMgdG9rZW4uCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4AAAAABnN5bWJvbAAAAAAAAAAAAAEAAAAQ",
        "AAAAAAAAAyZTZXRzIHRoZSBhbW91bnQgb2YgdG9rZW5zIGEgYHNwZW5kZXJgIGlzIGFsbG93ZWQgdG8gc3BlbmQgb24gYmVoYWxmIG9mCmFuIGBvd25lcmAuIE92ZXJyaWRlcyBhbnkgZXhpc3RpbmcgYWxsb3dhbmNlIHNldCBiZXR3ZWVuIGBzcGVuZGVyYCBhbmQKYG93bmVyYC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoqIGBvd25lcmAgLSBUaGUgYWRkcmVzcyBob2xkaW5nIHRoZSB0b2tlbnMuCiogYHNwZW5kZXJgIC0gVGhlIGFkZHJlc3MgYXV0aG9yaXplZCB0byBzcGVuZCB0aGUgdG9rZW5zLgoqIGBhbW91bnRgIC0gVGhlIGFtb3VudCBvZiB0b2tlbnMgbWFkZSBhdmFpbGFibGUgdG8gYHNwZW5kZXJgLgoqIGBsaXZlX3VudGlsX2xlZGdlcmAgLSBUaGUgbGVkZ2VyIG51bWJlciBhdCB3aGljaCB0aGUgYWxsb3dhbmNlCmV4cGlyZXMuCgojIEVycm9ycwoKKiBbYEZ1bmdpYmxlVG9rZW5FcnJvcjo6SW52YWxpZExpdmVVbnRpbExlZGdlcmBdIC0gT2NjdXJzIHdoZW4KYXR0ZW1wdGluZyB0byBzZXQgYGxpdmVfdW50aWxfbGVkZ2VyYCB0aGF0IGlzIGxlc3MgdGhhbiB0aGUgY3VycmVudApsZWRnZXIgbnVtYmVyIGFuZCBncmVhdGVyIHRoYW4gYDBgLgoqIFtgRnVuZ2libGVUb2tlbkVycm9yOjpMZXNzVGhhblplcm9gXSAtIE9jY3VycyB3aGVuIGBhbW91bnQgPCAwYC4KCiMgRXZlbnRzCgoqIHRvcGljcyAtIGBbImFwcHJvdmUiLCBmcm9tOiBBZGRyZXNzLCBzcGVuZGVyOiBBZGRyZXNzXWAKKiBkYXRhIC0gYFthbW91bnQ6IGkxMjgsIGxpdmVfdW50aWxfbGVkZ2VyOiB1MzJdYAAAAAAAB2FwcHJvdmUAAAAABAAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAdzcGVuZGVyAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAARbGl2ZV91bnRpbF9sZWRnZXIAAAAAAAAEAAAAAA==",
        "AAAAAAAAAKpSZXR1cm5zIHRoZSBhbW91bnQgb2YgdG9rZW5zIGhlbGQgYnkgYGFjY291bnRgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGBhY2NvdW50YCAtIFRoZSBhZGRyZXNzIGZvciB3aGljaCB0aGUgYmFsYW5jZSBpcyBiZWluZyBxdWVyaWVkLgAAAAAAB2JhbGFuY2UAAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAs=",
        "AAAAAAAAAJNTRVAtMDA1NiBkZXBvc2l0OiBgZnJvbWAgcHJvdmlkZXMgYGFzc2V0c2AsIGByZWNlaXZlcmAgZ2V0cyB0aGUgbWludGVkCnNoYXJlcywgYG9wZXJhdG9yYCBhdXRob3JpemVzIChhbGxvd2FuY2UtZGVsZWdhdGVkIHdoZW4gYG9wZXJhdG9yICE9IGZyb21gKS4AAAAAB2RlcG9zaXQAAAAABAAAAAAAAAAGYXNzZXRzAAAAAAALAAAAAAAAAAhyZWNlaXZlcgAAABMAAAAAAAAABGZyb20AAAATAAAAAAAAAAhvcGVyYXRvcgAAABMAAAABAAAACw==",
        "AAAAAAAAAAAAAAAHcmVxdWVzdAAAAAABAAAAAAAAAAJpZAAAAAAABAAAAAEAAAfQAAAADVJlZGVlbVJlcXVlc3QAAAA=",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA",
        "AAAAAAAAAHxSZXR1cm5zIHRoZSBudW1iZXIgb2YgZGVjaW1hbHMgdXNlZCB0byByZXByZXNlbnQgYW1vdW50cyBvZiB0aGlzIHRva2VuLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuAAAACGRlY2ltYWxzAAAAAAAAAAEAAAAE",
        "AAAAAAAAAAAAAAAIZGlzYnVyc2UAAAACAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
        "AAAAAAAAAAAAAAAIbWF4X21pbnQAAAABAAAAAAAAAAhyZWNlaXZlcgAAABMAAAABAAAACw==",
        "AAAAAAAAAi5UcmFuc2ZlcnMgYGFtb3VudGAgb2YgdG9rZW5zIGZyb20gYGZyb21gIHRvIGB0b2AuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgZnJvbWAgLSBUaGUgYWRkcmVzcyBob2xkaW5nIHRoZSB0b2tlbnMuCiogYHRvYCAtIFRoZSBhZGRyZXNzIHJlY2VpdmluZyB0aGUgdHJhbnNmZXJyZWQgdG9rZW5zLgoqIGBhbW91bnRgIC0gVGhlIGFtb3VudCBvZiB0b2tlbnMgdG8gYmUgdHJhbnNmZXJyZWQuCgojIEVycm9ycwoKKiBbYEZ1bmdpYmxlVG9rZW5FcnJvcjo6SW5zdWZmaWNpZW50QmFsYW5jZWBdIC0gV2hlbiBhdHRlbXB0aW5nIHRvCnRyYW5zZmVyIG1vcmUgdG9rZW5zIHRoYW4gYGZyb21gIGN1cnJlbnQgYmFsYW5jZS4KKiBbYEZ1bmdpYmxlVG9rZW5FcnJvcjo6TGVzc1RoYW5aZXJvYF0gLSBXaGVuIGBhbW91bnQgPCAwYC4KCiMgRXZlbnRzCgoqIHRvcGljcyAtIGBbInRyYW5zZmVyIiwgZnJvbTogQWRkcmVzcywgdG86IEFkZHJlc3NdYAoqIGRhdGEgLSBgW3RvX211eGVkX2lkOiBPcHRpb248dTY0PiwgYW1vdW50OiBpMTI4XWAAAAAAAAh0cmFuc2ZlcgAAAAMAAAAAAAAABGZyb20AAAATAAAAAAAAAAJ0bwAAAAAAFAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
        "AAAAAAAAAEFTRVAtMDA1NiB3aXRoZHJhdyDigJQgRElTQUJMRUQgKEQyKS4gUmVkZWVtIHZpYSBgcmVxdWVzdF9yZWRlZW1gLgAAAAAAAAh3aXRoZHJhdwAAAAQAAAAAAAAABmFzc2V0cwAAAAAACwAAAAAAAAAIcmVjZWl2ZXIAAAATAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAEAAAAL",
        "AAAABQAAAOpTRVAtMDA1NiBgRGVwb3NpdGAgZXZlbnQg4oCUIHRvcGljcyBgWyJkZXBvc2l0Iiwgb3BlcmF0b3IsIGZyb20sIHJlY2VpdmVyXWAsCmRhdGEgYFthc3NldHMsIHNoYXJlc11gLiBFbWl0dGVkIGJ5IGBkZXBvc2l0YCBhbmQgYG1pbnRgLiAoVGhlIFNFUCBgV2l0aGRyYXdgCmV2ZW50IGhhcyBubyBlbWl0dGVyOiBzeW5jaHJvbm91cyBgd2l0aGRyYXdgL2ByZWRlZW1gIGFyZSBkaXNhYmxlZCDigJQgc2VlIEQyLikAAAAAAAAAAAAHRGVwb3NpdAAAAAABAAAAB2RlcG9zaXQAAAAABQAAAAAAAAAIb3BlcmF0b3IAAAATAAAAAQAAAAAAAAAEZnJvbQAAABMAAAABAAAAAAAAAAhyZWNlaXZlcgAAABMAAAABAAAAAAAAAAZhc3NldHMAAAAAAAsAAAAAAAAAAAAAAAZzaGFyZXMAAAAAAAsAAAAAAAAAAg==",
        "AAAAAAAAAPBSZXR1cm5zIHRoZSBhbW91bnQgb2YgdG9rZW5zIGEgYHNwZW5kZXJgIGlzIGFsbG93ZWQgdG8gc3BlbmQgb24gYmVoYWxmCm9mIGFuIGBvd25lcmAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgb3duZXJgIC0gVGhlIGFkZHJlc3MgaG9sZGluZyB0aGUgdG9rZW5zLgoqIGBzcGVuZGVyYCAtIFRoZSBhZGRyZXNzIGF1dGhvcml6ZWQgdG8gc3BlbmQgdGhlIHRva2Vucy4AAAAJYWxsb3dhbmNlAAAAAAAAAgAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAdzcGVuZGVyAAAAABMAAAABAAAACw==",
        "AAAAAAAAAAAAAAAJcmViYWxhbmNlAAAAAAAAAAAAAAA=",
        "AAAAAAAAAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAEYwIOKAlCBzeW5jaHJvbm91cyB3aXRoZHJhd2FscyBhcmUgZGlzYWJsZWQ7IHJlZGVlbSB2aWEgdGhlIHF1ZXVlIChEMikuAAAAAAAKbWF4X3JlZGVlbQAAAAAAAQAAAAAAAAAFb3duZXIAAAAAAAATAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAKc2V0X3BvbGljeQAAAAAAAQAAAAAAAAAGcG9saWN5AAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAKc3RyYXRlZ2llcwAAAAAAAAAAAAEAAAPqAAAH0AAAAA1TdHJhdGVneUFsbG9jAAAA",
        "AAAAAAAAAAAAAAALbWF4X2RlcG9zaXQAAAAAAQAAAAAAAAAIcmVjZWl2ZXIAAAATAAAAAQAAAAs=",
        "AAAAAAAAADxTRVAtMDA1NjogYWRkcmVzcyBvZiB0aGUgdW5kZXJseWluZyBhc3NldCB0aGUgdmF1bHQgbWFuYWdlcy4AAAALcXVlcnlfYXNzZXQAAAAAAAAAAAEAAAAT",
        "AAAAAAAAAAAAAAAMYWRkX3N0cmF0ZWd5AAAAAwAAAAAAAAAHYWRkcmVzcwAAAAATAAAAAAAAAAp3ZWlnaHRfYnBzAAAAAAAEAAAAAAAAAAh2b2xhdGlsZQAAAAEAAAAA",
        "AAAAAAAAAAAAAAAMZnJlZV9jYXBpdGFsAAAAAAAAAAEAAAAL",
        "AAAAAAAAAEYwIOKAlCBzeW5jaHJvbm91cyB3aXRoZHJhd2FscyBhcmUgZGlzYWJsZWQ7IHJlZGVlbSB2aWEgdGhlIHF1ZXVlIChEMikuAAAAAAAMbWF4X3dpdGhkcmF3AAAAAQAAAAAAAAAFb3duZXIAAAAAAAATAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAMcHJldmlld19taW50AAAAAQAAAAAAAAAGc2hhcmVzAAAAAAALAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAMdG90YWxfYXNzZXRzAAAAAAAAAAEAAAAL",
        "AAAAAAAAAGtSZXR1cm5zIHRoZSB0b3RhbCBhbW91bnQgb2YgdG9rZW5zIGluIGNpcmN1bGF0aW9uLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgAAAAAMdG90YWxfc3VwcGx5AAAAAAAAAAEAAAAL",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAKdW5kZXJseWluZwAAAAAAEwAAAAA=",
        "AAAAAAAAAEBSZXR1cm5zIGVzY3Jvd2VkIHNoYXJlcyBmb3IgYW4gdW5mdWxmaWxsZWQgcmVxdWVzdCBhbmQgZHJvcHMgaXQuAAAADWNhbmNlbF9yZWRlZW0AAAAAAAABAAAAAAAAAAJpZAAAAAAABAAAAAA=",
        "AAAAAAAAAAAAAAANbmF2X3Blcl9zaGFyZQAAAAAAAAAAAAABAAAACw==",
        "AAAAAAAAAAAAAAANc3RhYmxlX2Fzc2V0cwAAAAAAAAAAAAABAAAACw==",
        "AAAAAAAAA2dUcmFuc2ZlcnMgYGFtb3VudGAgb2YgdG9rZW5zIGZyb20gYGZyb21gIHRvIGB0b2AgdXNpbmcgdGhlCmFsbG93YW5jZSBtZWNoYW5pc20uIGBhbW91bnRgIGlzIHRoZW4gZGVkdWN0ZWQgZnJvbSBgc3BlbmRlcmAKYWxsb3dhbmNlLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHNwZW5kZXJgIC0gVGhlIGFkZHJlc3MgYXV0aG9yaXppbmcgdGhlIHRyYW5zZmVyLCBhbmQgaGF2aW5nIGl0cwphbGxvd2FuY2UgY29uc3VtZWQgZHVyaW5nIHRoZSB0cmFuc2Zlci4KKiBgZnJvbWAgLSBUaGUgYWRkcmVzcyBob2xkaW5nIHRoZSB0b2tlbnMgd2hpY2ggd2lsbCBiZSB0cmFuc2ZlcnJlZC4KKiBgdG9gIC0gVGhlIGFkZHJlc3MgcmVjZWl2aW5nIHRoZSB0cmFuc2ZlcnJlZCB0b2tlbnMuCiogYGFtb3VudGAgLSBUaGUgYW1vdW50IG9mIHRva2VucyB0byBiZSB0cmFuc2ZlcnJlZC4KCiMgRXJyb3JzCgoqIFtgRnVuZ2libGVUb2tlbkVycm9yOjpJbnN1ZmZpY2llbnRCYWxhbmNlYF0gLSBXaGVuIGF0dGVtcHRpbmcgdG8KdHJhbnNmZXIgbW9yZSB0b2tlbnMgdGhhbiBgZnJvbWAgY3VycmVudCBiYWxhbmNlLgoqIFtgRnVuZ2libGVUb2tlbkVycm9yOjpMZXNzVGhhblplcm9gXSAtIFdoZW4gYGFtb3VudCA8IDBgLgoqIFtgRnVuZ2libGVUb2tlbkVycm9yOjpJbnN1ZmZpY2llbnRBbGxvd2FuY2VgXSAtIFdoZW4gYXR0ZW1wdGluZyB0bwp0cmFuc2ZlciBtb3JlIHRva2VucyB0aGFuIGBzcGVuZGVyYCBjdXJyZW50IGFsbG93YW5jZS4KCiMgRXZlbnRzCgoqIHRvcGljcyAtIGBbInRyYW5zZmVyIiwgZnJvbTogQWRkcmVzcywgdG86IEFkZHJlc3NdYAoqIGRhdGEgLSBgW2Ftb3VudDogaTEyOF1gAAAAAA10cmFuc2Zlcl9mcm9tAAAAAAAABAAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAAAAAARmcm9tAAAAEwAAAAAAAAACdG8AAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAAAAAAAAOYXZhaWxhYmxlX2hlbGQAAAAAAAAAAAABAAAACw==",
        "AAAAAAAAAAAAAAAOcHJlbWl1bV9pbmNvbWUAAAAAAAAAAAABAAAACw==",
        "AAAAAAAAAAAAAAAOcHJldmlld19yZWRlZW0AAAAAAAEAAAAAAAAABnNoYXJlcwAAAAAACwAAAAEAAAAL",
        "AAAAAAAAAAAAAAAOcmVxdWVzdF9yZWRlZW0AAAAAAAIAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAGc2hhcmVzAAAAAAALAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAPY29sbGVjdF9wcmVtaXVtAAAAAAIAAAAAAAAABGZyb20AAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAAAAAAAAAAAAAPcHJldmlld19kZXBvc2l0AAAAAAEAAAAAAAAABmFzc2V0cwAAAAAACwAAAAEAAAAL",
        "AAAAAAAAAAAAAAAPcmVtb3ZlX3N0cmF0ZWd5AAAAAAEAAAAAAAAAB2FkZHJlc3MAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAQcGVuZGluZ19yZXF1ZXN0cwAAAAAAAAABAAAD6gAAAAQ=",
        "AAAAAAAAAAAAAAAQcHJldmlld193aXRoZHJhdwAAAAEAAAAAAAAABmFzc2V0cwAAAAAACwAAAAEAAAAL",
        "AAAAAAAAAAAAAAARY29udmVydF90b19hc3NldHMAAAAAAAABAAAAAAAAAAZzaGFyZXMAAAAAAAsAAAABAAAACw==",
        "AAAAAAAAAAAAAAARY29udmVydF90b19zaGFyZXMAAAAAAAABAAAAAAAAAAZhc3NldHMAAAAAAAsAAAABAAAACw==",
        "AAAAAAAAAAAAAAATcHJvY2Vzc19yZWRlbXB0aW9ucwAAAAABAAAAAAAAAAltYXhfYmF0Y2gAAAAAAAAEAAAAAA==",
        "AAAAAQAAAAAAAAAAAAAADVJlZGVlbVJlcXVlc3QAAAAAAAAGAAAAAAAAAAljbGFpbWFibGUAAAAAAAALAAAAAAAAAAdjbGFpbWVkAAAAAAEAAAAAAAAACWZ1bGZpbGxlZAAAAAAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABnNoYXJlcwAAAAAACw==",
        "AAAAAQAAAAAAAAAAAAAADVN0cmF0ZWd5QWxsb2MAAAAAAAADAAAAAAAAAAdhZGRyZXNzAAAAABMAAAAAAAAACHZvbGF0aWxlAAAAAQAAAAAAAAAKd2VpZ2h0X2JwcwAAAAAABA==",
        "AAAABAAAAAAAAAAAAAAAFlNvcm9iYW5GaXhlZFBvaW50RXJyb3IAAAAAAAIAAAAcQXJpdGhtZXRpYyBvdmVyZmxvdyBvY2N1cnJlZAAAAAhPdmVyZmxvdwAABdwAAAAQRGl2aXNpb24gYnkgemVybwAAAA5EaXZpc2lvbkJ5WmVybwAAAAAF3Q==",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gdG9rZW5zIGFyZSBtaW50ZWQuAAAAAAAAAAAAAARNaW50AAAAAQAAAARtaW50AAAAAgAAAAAAAAACdG8AAAAAABMAAAABAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAg==",
        "AAAABQAAACxFdmVudCBlbWl0dGVkIHdoZW4gYW4gYWxsb3dhbmNlIGlzIGFwcHJvdmVkLgAAAAAAAAAHQXBwcm92ZQAAAAABAAAAB2FwcHJvdmUAAAAABAAAAAAAAAAFb3duZXIAAAAAAAATAAAAAQAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAARbGl2ZV91bnRpbF9sZWRnZXIAAAAAAAAEAAAAAAAAAAI=",
        "AAAABQAAASFFdmVudCBlbWl0dGVkIHdoZW4gdG9rZW5zIGFyZSB0cmFuc2ZlcnJlZCBiZXR3ZWVuIGFkZHJlc3NlcyB3aXRob3V0IGEKbXV4ZWQgZGVzdGluYXRpb24uCgpQZXIgU0VQLTQxLCB0aGUgZXZlbnQgZGF0YSBpcyBhIGJhcmUgYGkxMjhgIHdoZW4gbm8gbXV4ZWQgYWRkcmVzcyBpcwppbnZvbHZlZC4gVGhlIGBkYXRhX2Zvcm1hdCA9ICJzaW5nbGUtdmFsdWUiYCBhdHRyaWJ1dGUgZW5zdXJlcyB0aGUKYGFtb3VudGAgZmllbGQgaXMgc2VyaWFsaXplZCBhcyBhIGJhcmUgdmFsdWUgcmF0aGVyIHRoYW4gYSBtYXAuAAAAAAAAAAAAAAhUcmFuc2ZlcgAAAAEAAAAIdHJhbnNmZXIAAAADAAAAAAAAAARmcm9tAAAAEwAAAAEAAAAAAAAAAnRvAAAAAAATAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAA=",
        "AAAABQAAAZdFdmVudCBlbWl0dGVkIHdoZW4gdG9rZW5zIGFyZSB0cmFuc2ZlcnJlZCB0byBhIG11eGVkIGFkZHJlc3MuCgpQZXIgU0VQLTQxLCB3aGVuIHRoZSBkZXN0aW5hdGlvbiBpcyBhIFtgTXV4ZWRBZGRyZXNzYF0gdGhlIGV2ZW50IGRhdGEKY2FycmllcyBib3RoIHRoZSBhbW91bnQgYW5kIHRoZSBtdXhlZCBpZGVudGlmaWVyIHNvIHRoYXQgb2ZmLWNoYWluCmNvbnN1bWVycyBjYW4gYXR0cmlidXRlIHRoZSB0cmFuc2ZlciB0byB0aGUgY29ycmVjdCBzdWItYWNjb3VudC4KClVzZXMgYHRvcGljcyA9IFsidHJhbnNmZXIiXWAgc28gdGhhdCBib3RoIFtgVHJhbnNmZXJgXSBhbmQKW2BNdXhlZFRyYW5zZmVyYF0gc2hhcmUgdGhlIHNhbWUgYCJ0cmFuc2ZlciJgIGV2ZW50IHN5bWJvbCwgYXMgcmVxdWlyZWQKYnkgU0VQLTQxLgAAAAAAAAAADU11eGVkVHJhbnNmZXIAAAAAAAABAAAACHRyYW5zZmVyAAAABAAAAAAAAAAEZnJvbQAAABMAAAABAAAAAAAAAAJ0bwAAAAAAEwAAAAEAAAAAAAAAC3RvX211eGVkX2lkAAAAA+gAAAAGAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=",
        "AAAABAAAAAAAAAAAAAAAEkZ1bmdpYmxlVG9rZW5FcnJvcgAAAAAADwAAAG5JbmRpY2F0ZXMgYW4gZXJyb3IgcmVsYXRlZCB0byB0aGUgY3VycmVudCBiYWxhbmNlIG9mIGFjY291bnQgZnJvbSB3aGljaAp0b2tlbnMgYXJlIGV4cGVjdGVkIHRvIGJlIHRyYW5zZmVycmVkLgAAAAAAE0luc3VmZmljaWVudEJhbGFuY2UAAAAAZAAAAGRJbmRpY2F0ZXMgYSBmYWlsdXJlIHdpdGggdGhlIGFsbG93YW5jZSBtZWNoYW5pc20gd2hlbiBhIGdpdmVuIHNwZW5kZXIKZG9lc24ndCBoYXZlIGVub3VnaCBhbGxvd2FuY2UuAAAAFUluc3VmZmljaWVudEFsbG93YW5jZQAAAAAAAGUAAABNSW5kaWNhdGVzIGFuIGludmFsaWQgdmFsdWUgZm9yIGBsaXZlX3VudGlsX2xlZGdlcmAgd2hlbiBzZXR0aW5nIGFuCmFsbG93YW5jZS4AAAAAAAAWSW52YWxpZExpdmVVbnRpbExlZGdlcgAAAAAAZgAAADJJbmRpY2F0ZXMgYW4gZXJyb3Igd2hlbiBhbiBpbnB1dCB0aGF0IG11c3QgYmUgPj0gMAAAAAAADExlc3NUaGFuWmVybwAAAGcAAAApSW5kaWNhdGVzIG92ZXJmbG93IHdoZW4gYWRkaW5nIHR3byB2YWx1ZXMAAAAAAAAMTWF0aE92ZXJmbG93AAAAaAAAACpJbmRpY2F0ZXMgYWNjZXNzIHRvIHVuaW5pdGlhbGl6ZWQgbWV0YWRhdGEAAAAAAA1VbnNldE1ldGFkYXRhAAAAAAAAaQAAAFJJbmRpY2F0ZXMgdGhhdCB0aGUgb3BlcmF0aW9uIHdvdWxkIGhhdmUgY2F1c2VkIGB0b3RhbF9zdXBwbHlgIHRvIGV4Y2VlZAp0aGUgYGNhcGAuAAAAAAALRXhjZWVkZWRDYXAAAAAAagAAADZJbmRpY2F0ZXMgdGhlIHN1cHBsaWVkIGBjYXBgIGlzIG5vdCBhIHZhbGlkIGNhcCB2YWx1ZS4AAAAAAApJbnZhbGlkQ2FwAAAAAABrAAAAHkluZGljYXRlcyB0aGUgQ2FwIHdhcyBub3Qgc2V0LgAAAAAACUNhcE5vdFNldAAAAAAAAGwAAAAmSW5kaWNhdGVzIHRoZSBTQUMgYWRkcmVzcyB3YXMgbm90IHNldC4AAAAAAAlTQUNOb3RTZXQAAAAAAABtAAAAMEluZGljYXRlcyBhIFNBQyBhZGRyZXNzIGRpZmZlcmVudCB0aGFuIGV4cGVjdGVkLgAAABJTQUNBZGRyZXNzTWlzbWF0Y2gAAAAAAG4AAABDSW5kaWNhdGVzIGEgbWlzc2luZyBmdW5jdGlvbiBwYXJhbWV0ZXIgaW4gdGhlIFNBQyBjb250cmFjdCBjb250ZXh0LgAAAAARU0FDTWlzc2luZ0ZuUGFyYW0AAAAAAABvAAAAREluZGljYXRlcyBhbiBpbnZhbGlkIGZ1bmN0aW9uIHBhcmFtZXRlciBpbiB0aGUgU0FDIGNvbnRyYWN0IGNvbnRleHQuAAAAEVNBQ0ludmFsaWRGblBhcmFtAAAAAAAAcAAAADFUaGUgdXNlciBpcyBub3QgYWxsb3dlZCB0byBwZXJmb3JtIHRoaXMgb3BlcmF0aW9uAAAAAAAADlVzZXJOb3RBbGxvd2VkAAAAAABxAAAANVRoZSB1c2VyIGlzIGJsb2NrZWQgYW5kIGNhbm5vdCBwZXJmb3JtIHRoaXMgb3BlcmF0aW9uAAAAAAAAC1VzZXJCbG9ja2VkAAAAAHI=" ]),
      options
    )
  }
  public readonly fromJSON = {
    mint: this.txFromJSON<i128>,
        name: this.txFromJSON<string>,
        admin: this.txFromJSON<string>,
        claim: this.txFromJSON<null>,
        policy: this.txFromJSON<string>,
        redeem: this.txFromJSON<i128>,
        symbol: this.txFromJSON<string>,
        approve: this.txFromJSON<null>,
        balance: this.txFromJSON<i128>,
        deposit: this.txFromJSON<i128>,
        request: this.txFromJSON<RedeemRequest>,
        upgrade: this.txFromJSON<null>,
        decimals: this.txFromJSON<u32>,
        disburse: this.txFromJSON<null>,
        max_mint: this.txFromJSON<i128>,
        transfer: this.txFromJSON<null>,
        withdraw: this.txFromJSON<i128>,
        allowance: this.txFromJSON<i128>,
        rebalance: this.txFromJSON<null>,
        set_admin: this.txFromJSON<null>,
        max_redeem: this.txFromJSON<i128>,
        set_policy: this.txFromJSON<null>,
        strategies: this.txFromJSON<Array<StrategyAlloc>>,
        max_deposit: this.txFromJSON<i128>,
        query_asset: this.txFromJSON<string>,
        add_strategy: this.txFromJSON<null>,
        free_capital: this.txFromJSON<i128>,
        max_withdraw: this.txFromJSON<i128>,
        preview_mint: this.txFromJSON<i128>,
        total_assets: this.txFromJSON<i128>,
        total_supply: this.txFromJSON<i128>,
        cancel_redeem: this.txFromJSON<null>,
        nav_per_share: this.txFromJSON<i128>,
        stable_assets: this.txFromJSON<i128>,
        transfer_from: this.txFromJSON<null>,
        available_held: this.txFromJSON<i128>,
        premium_income: this.txFromJSON<i128>,
        preview_redeem: this.txFromJSON<i128>,
        request_redeem: this.txFromJSON<u32>,
        collect_premium: this.txFromJSON<null>,
        preview_deposit: this.txFromJSON<i128>,
        remove_strategy: this.txFromJSON<null>,
        pending_requests: this.txFromJSON<Array<u32>>,
        preview_withdraw: this.txFromJSON<i128>,
        convert_to_assets: this.txFromJSON<i128>,
        convert_to_shares: this.txFromJSON<i128>,
        process_redemptions: this.txFromJSON<null>
  }
}