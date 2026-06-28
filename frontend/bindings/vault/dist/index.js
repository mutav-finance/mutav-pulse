import { Buffer } from "buffer";
import { Client as ContractClient, Spec as ContractSpec, } from "@stellar/stellar-sdk/contract";
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
        contractId: "CCZATYOP5OCTKI4QA2THW5LACWIMIGGOOMQGVQFVQ2TESOS3ARFSJLIE",
    }
};
/**
 * Vault-side errors surfaced as stable `#[contracterror]` codes. Numbered in the
 * `6xx` band to stay clear of the interfaces `2xx`, policy `3xx`, strategy `4xx`,
 * and adapter `5xx` codes. Mirrors the adapter-defindex `AdapterError` pattern:
 * a money-path revert that carries a diagnosable code instead of an opaque host
 * trap. Code-only (not a storage entry) so it is layout-safe for in-place
 * `upgrade()`.
 */
export const VaultError = {
    /**
     * #34 / code-review H1: a money path (`disburse` / `process_redemptions`)
     * asked `ensure_liquidity` for more underlying than the strategies could
     * realize (e.g. a lossy/slippage adapter that reports `balance()` above what
     * `divest()` actually delivers). Yearn-v3 stance: revert rather than realize
     * an incorrect loss — the whole tx rolls back atomically.
     */
    600: { message: "InsufficientLiquidity" }
};
export const SorobanFixedPointError = {
    /**
     * Arithmetic overflow occurred
     */
    1500: { message: "Overflow" },
    /**
     * Division by zero
     */
    1501: { message: "DivisionByZero" }
};
export const FungibleTokenError = {
    /**
     * Indicates an error related to the current balance of account from which
     * tokens are expected to be transferred.
     */
    100: { message: "InsufficientBalance" },
    /**
     * Indicates a failure with the allowance mechanism when a given spender
     * doesn't have enough allowance.
     */
    101: { message: "InsufficientAllowance" },
    /**
     * Indicates an invalid value for `live_until_ledger` when setting an
     * allowance.
     */
    102: { message: "InvalidLiveUntilLedger" },
    /**
     * Indicates an error when an input that must be >= 0
     */
    103: { message: "LessThanZero" },
    /**
     * Indicates overflow when adding two values
     */
    104: { message: "MathOverflow" },
    /**
     * Indicates access to uninitialized metadata
     */
    105: { message: "UnsetMetadata" },
    /**
     * Indicates that the operation would have caused `total_supply` to exceed
     * the `cap`.
     */
    106: { message: "ExceededCap" },
    /**
     * Indicates the supplied `cap` is not a valid cap value.
     */
    107: { message: "InvalidCap" },
    /**
     * Indicates the Cap was not set.
     */
    108: { message: "CapNotSet" },
    /**
     * Indicates the SAC address was not set.
     */
    109: { message: "SACNotSet" },
    /**
     * Indicates a SAC address different than expected.
     */
    110: { message: "SACAddressMismatch" },
    /**
     * Indicates a missing function parameter in the SAC contract context.
     */
    111: { message: "SACMissingFnParam" },
    /**
     * Indicates an invalid function parameter in the SAC contract context.
     */
    112: { message: "SACInvalidFnParam" },
    /**
     * The user is not allowed to perform this operation
     */
    113: { message: "UserNotAllowed" },
    /**
     * The user is blocked and cannot perform this operation
     */
    114: { message: "UserBlocked" }
};
export class Client extends ContractClient {
    options;
    static async deploy(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { admin, underlying, name, symbol }, 
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options) {
        return ContractClient.deploy({ admin, underlying, name, symbol }, options);
    }
    constructor(options) {
        super(new ContractSpec(["AAAAAAAAAIRTRVAtMDA1NiBtaW50OiBtaW50IGV4YWN0bHkgYHNoYXJlc2AgdG8gYHJlY2VpdmVyYCwgcHVsbGluZyB0aGUgcmVxdWlyZWQKKGNlaWwtcm91bmRlZCkgYXNzZXRzIGZyb20gYGZyb21gLiBSZXR1cm5zIGFzc2V0cyBjb25zdW1lZC4AAAAEbWludAAAAAQAAAAAAAAABnNoYXJlcwAAAAAACwAAAAAAAAAIcmVjZWl2ZXIAAAATAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAIb3BlcmF0b3IAAAATAAAAAQAAAAs=",
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
            "AAAAAAAAAAAAAAAIZGlzYnVyc2UAAAADAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAA5jb3ZlcmFnZV9hZnRlcgAAAAAACwAAAAA=",
            "AAAAAAAAAAAAAAAIbWF4X21pbnQAAAABAAAAAAAAAAhyZWNlaXZlcgAAABMAAAABAAAACw==",
            "AAAAAAAAAi5UcmFuc2ZlcnMgYGFtb3VudGAgb2YgdG9rZW5zIGZyb20gYGZyb21gIHRvIGB0b2AuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgZnJvbWAgLSBUaGUgYWRkcmVzcyBob2xkaW5nIHRoZSB0b2tlbnMuCiogYHRvYCAtIFRoZSBhZGRyZXNzIHJlY2VpdmluZyB0aGUgdHJhbnNmZXJyZWQgdG9rZW5zLgoqIGBhbW91bnRgIC0gVGhlIGFtb3VudCBvZiB0b2tlbnMgdG8gYmUgdHJhbnNmZXJyZWQuCgojIEVycm9ycwoKKiBbYEZ1bmdpYmxlVG9rZW5FcnJvcjo6SW5zdWZmaWNpZW50QmFsYW5jZWBdIC0gV2hlbiBhdHRlbXB0aW5nIHRvCnRyYW5zZmVyIG1vcmUgdG9rZW5zIHRoYW4gYGZyb21gIGN1cnJlbnQgYmFsYW5jZS4KKiBbYEZ1bmdpYmxlVG9rZW5FcnJvcjo6TGVzc1RoYW5aZXJvYF0gLSBXaGVuIGBhbW91bnQgPCAwYC4KCiMgRXZlbnRzCgoqIHRvcGljcyAtIGBbInRyYW5zZmVyIiwgZnJvbTogQWRkcmVzcywgdG86IEFkZHJlc3NdYAoqIGRhdGEgLSBgW3RvX211eGVkX2lkOiBPcHRpb248dTY0PiwgYW1vdW50OiBpMTI4XWAAAAAAAAh0cmFuc2ZlcgAAAAMAAAAAAAAABGZyb20AAAATAAAAAAAAAAJ0bwAAAAAAFAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
            "AAAAAAAAAEFTRVAtMDA1NiB3aXRoZHJhdyDigJQgRElTQUJMRUQgKEQyKS4gUmVkZWVtIHZpYSBgcmVxdWVzdF9yZWRlZW1gLgAAAAAAAAh3aXRoZHJhdwAAAAQAAAAAAAAABmFzc2V0cwAAAAAACwAAAAAAAAAIcmVjZWl2ZXIAAAATAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAEAAAAL",
            "AAAABQAAAOpTRVAtMDA1NiBgRGVwb3NpdGAgZXZlbnQg4oCUIHRvcGljcyBgWyJkZXBvc2l0Iiwgb3BlcmF0b3IsIGZyb20sIHJlY2VpdmVyXWAsCmRhdGEgYFthc3NldHMsIHNoYXJlc11gLiBFbWl0dGVkIGJ5IGBkZXBvc2l0YCBhbmQgYG1pbnRgLiAoVGhlIFNFUCBgV2l0aGRyYXdgCmV2ZW50IGhhcyBubyBlbWl0dGVyOiBzeW5jaHJvbm91cyBgd2l0aGRyYXdgL2ByZWRlZW1gIGFyZSBkaXNhYmxlZCDigJQgc2VlIEQyLikAAAAAAAAAAAAHRGVwb3NpdAAAAAABAAAAB2RlcG9zaXQAAAAABQAAAAAAAAAIb3BlcmF0b3IAAAATAAAAAQAAAAAAAAAEZnJvbQAAABMAAAABAAAAAAAAAAhyZWNlaXZlcgAAABMAAAABAAAAAAAAAAZhc3NldHMAAAAAAAsAAAAAAAAAAAAAAAZzaGFyZXMAAAAAAAsAAAAAAAAAAg==",
            "AAAAAAAAAPBSZXR1cm5zIHRoZSBhbW91bnQgb2YgdG9rZW5zIGEgYHNwZW5kZXJgIGlzIGFsbG93ZWQgdG8gc3BlbmQgb24gYmVoYWxmCm9mIGFuIGBvd25lcmAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgb3duZXJgIC0gVGhlIGFkZHJlc3MgaG9sZGluZyB0aGUgdG9rZW5zLgoqIGBzcGVuZGVyYCAtIFRoZSBhZGRyZXNzIGF1dGhvcml6ZWQgdG8gc3BlbmQgdGhlIHRva2Vucy4AAAAJYWxsb3dhbmNlAAAAAAAAAgAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAdzcGVuZGVyAAAAABMAAAABAAAACw==",
            "AAAAAAAABABSZWJhbGFuY2Ugc3RyYXRlZ3kgYWxsb2NhdGlvbnMgdG93YXJkIHRhcmdldCDigJQgaWRlbXBvdGVudCBhbmQgYmlkaXJlY3Rpb25hbC4KCktlZXBzIGB0YXJnZXRfaWRsZWAgKGEgZnJhY3Rpb24gb2YgVE9UQUwgYXNzZXRzLCBzZWUgYG1pbl9saXF1aWRfYnVmZmVyX2Jwc2ApCmFzIGEgbGlxdWlkIGNhc2ggYnVmZmVyIGFuZCBzcHJlYWRzIHRoZSBzdXJwbHVzIGFjcm9zcyBzdHJhdGVnaWVzIGJ5IHdlaWdodCwKZWFjaCBjbGFtcGVkIHRvIGl0cyBgc3RyYXRlZ3lfbWF4X2RlYnRfYnBzYCBjYXAuIEVhY2ggc3RyYXRlZ3kncyBvbi1jaGFpbgpiYWxhbmNlIGlzIG1vdmVkIHRvd2FyZCB0aGF0IHRhcmdldDogcHVsbGVkIGJhY2sgd2hlbiBvdmVyLCBkZXBsb3llZCB3aGVuCnVuZGVyLiBUYXJnZXRzIGFyZSBjb21wdXRlZCBvbmNlIG9mZiBhIHNuYXBzaG90LCBzbyBjYWxsaW5nIGF0LXRhcmdldCBpcyBhCm5vLW9wIOKAlCB0aGUgYnVmZmVyIGhvbGRzIGluc3RlYWQgb2YgZHJhaW5pbmcgYWNyb3NzIHJlcGVhdGVkIGNhbGxzLgoKTElRVUlESVRZLW9ubHk6IG5ldmVyIHJlYWRzIGBjb3ZlcmFnZV9yZXF1aXJlZGAgKHNvbHZlbmN5IHN0YXlzIGVuZm9yY2VkIGJ5CnRoZSBgZnJlZV9jYXBpdGFsYCByZWRlbXB0aW9uIGdhdGUgKyBkaXNidXJzZSBvcmRlcmluZykuIENhcHBlZCBvdmVyZmxvdwpzaW1wbHkgcmVtYWlucyBpZGxlIGFib3ZlIGB0YXJnZXRfaWRsZWAuIERpdmVzdCBwYXNzIHJ1bnMgYmVmb3JlIGludmVzdCBzbwpwdWxsZWQtYmFjayBmdW5kcyBhcmUgYXZhaWxhYmxlIHRvIGZ1bmQgdGhlIGRlcGxveXMuCgpVbmRlciBhIExPU1NZIGRpdmVzdCAoYSBzbGlwcGFnZS9mZWUgYWRhcHRlciB0aGF0IGRlbGl2ZXJzIGxlc3MgdW5kZXJseWluZwp0aGFuIGl0cyByZXBvcnRlZCBiYWxhbmNlIGltcGxpZXMpLCB0aGUgaW52ZXN0IHBhc3MgaXMgY2xhbXBlZCB0byB0aGUKcmVhbGl6ZWQgbGl2ZSBpZGxlLCBzbyBmdWxsIGNvbnZlcmdlbmNlIHRvIHRhcmdldCBtYXkgdGFrZSBhbiBBRERJVElPTkFMAAAACXJlYmFsYW5jZQAAAAAAAAAAAAAA",
            "AAAAAAAAAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
            "AAAAAAAAAAAAAAAKZmVlX2luY29tZQAAAAAAAAAAAAEAAAAL",
            "AAAAAAAAAEYwIOKAlCBzeW5jaHJvbm91cyB3aXRoZHJhd2FscyBhcmUgZGlzYWJsZWQ7IHJlZGVlbSB2aWEgdGhlIHF1ZXVlIChEMikuAAAAAAAKbWF4X3JlZGVlbQAAAAAAAQAAAAAAAAAFb3duZXIAAAAAAAATAAAAAQAAAAs=",
            "AAAAAAAAAAAAAAAKc2V0X3BvbGljeQAAAAAAAQAAAAAAAAAGcG9saWN5AAAAAAATAAAAAA==",
            "AAAAAAAAAAAAAAAKc3RyYXRlZ2llcwAAAAAAAAAAAAEAAAPqAAAH0AAAAA1TdHJhdGVneUFsbG9jAAAA",
            "AAAABAAAAY9WYXVsdC1zaWRlIGVycm9ycyBzdXJmYWNlZCBhcyBzdGFibGUgYCNbY29udHJhY3RlcnJvcl1gIGNvZGVzLiBOdW1iZXJlZCBpbiB0aGUKYDZ4eGAgYmFuZCB0byBzdGF5IGNsZWFyIG9mIHRoZSBpbnRlcmZhY2VzIGAyeHhgLCBwb2xpY3kgYDN4eGAsIHN0cmF0ZWd5IGA0eHhgLAphbmQgYWRhcHRlciBgNXh4YCBjb2Rlcy4gTWlycm9ycyB0aGUgYWRhcHRlci1kZWZpbmRleCBgQWRhcHRlckVycm9yYCBwYXR0ZXJuOgphIG1vbmV5LXBhdGggcmV2ZXJ0IHRoYXQgY2FycmllcyBhIGRpYWdub3NhYmxlIGNvZGUgaW5zdGVhZCBvZiBhbiBvcGFxdWUgaG9zdAp0cmFwLiBDb2RlLW9ubHkgKG5vdCBhIHN0b3JhZ2UgZW50cnkpIHNvIGl0IGlzIGxheW91dC1zYWZlIGZvciBpbi1wbGFjZQpgdXBncmFkZSgpYC4AAAAAAAAAAApWYXVsdEVycm9yAAAAAAABAAABXiMzNCAvIGNvZGUtcmV2aWV3IEgxOiBhIG1vbmV5IHBhdGggKGBkaXNidXJzZWAgLyBgcHJvY2Vzc19yZWRlbXB0aW9uc2ApCmFza2VkIGBlbnN1cmVfbGlxdWlkaXR5YCBmb3IgbW9yZSB1bmRlcmx5aW5nIHRoYW4gdGhlIHN0cmF0ZWdpZXMgY291bGQKcmVhbGl6ZSAoZS5nLiBhIGxvc3N5L3NsaXBwYWdlIGFkYXB0ZXIgdGhhdCByZXBvcnRzIGBiYWxhbmNlKClgIGFib3ZlIHdoYXQKYGRpdmVzdCgpYCBhY3R1YWxseSBkZWxpdmVycykuIFllYXJuLXYzIHN0YW5jZTogcmV2ZXJ0IHJhdGhlciB0aGFuIHJlYWxpemUKYW4gaW5jb3JyZWN0IGxvc3Mg4oCUIHRoZSB3aG9sZSB0eCByb2xscyBiYWNrIGF0b21pY2FsbHkuAAAAAAAVSW5zdWZmaWNpZW50TGlxdWlkaXR5AAAAAAACWA==",
            "AAAAAAAAAAAAAAALY29sbGVjdF9mZWUAAAAAAgAAAAAAAAAEZnJvbQAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
            "AAAAAAAAAAAAAAALbWF4X2RlcG9zaXQAAAAAAQAAAAAAAAAIcmVjZWl2ZXIAAAATAAAAAQAAAAs=",
            "AAAAAAAAADxTRVAtMDA1NjogYWRkcmVzcyBvZiB0aGUgdW5kZXJseWluZyBhc3NldCB0aGUgdmF1bHQgbWFuYWdlcy4AAAALcXVlcnlfYXNzZXQAAAAAAAAAAAEAAAAT",
            "AAAAAAAAAIxUYXJnZXQgaWRsZSBjYXNoIHJldGFpbmVkIGFzIHRoZSBsaXF1aWQgYnVmZmVyOiBgdG90YWxfYXNzZXRzIMOXIGJwc2AuClRoZSBzdXJwbHVzIGFib3ZlIHRoaXMgaXMgd2hhdCBgcmViYWxhbmNlYCBkZXBsb3lzIGFjcm9zcyBzdHJhdGVnaWVzLgAAAAt0YXJnZXRfaWRsZQAAAAAAAAAAAQAAAAs=",
            "AAAAAAAAAAAAAAAMYWRkX3N0cmF0ZWd5AAAAAwAAAAAAAAAHYWRkcmVzcwAAAAATAAAAAAAAAAp3ZWlnaHRfYnBzAAAAAAAEAAAAAAAAAAh2b2xhdGlsZQAAAAEAAAAA",
            "AAAAAAAAAAAAAAAMZnJlZV9jYXBpdGFsAAAAAAAAAAEAAAAL",
            "AAAAAAAAAEYwIOKAlCBzeW5jaHJvbm91cyB3aXRoZHJhd2FscyBhcmUgZGlzYWJsZWQ7IHJlZGVlbSB2aWEgdGhlIHF1ZXVlIChEMikuAAAAAAAMbWF4X3dpdGhkcmF3AAAAAQAAAAAAAAAFb3duZXIAAAAAAAATAAAAAQAAAAs=",
            "AAAAAAAAAAAAAAAMcHJldmlld19taW50AAAAAQAAAAAAAAAGc2hhcmVzAAAAAAALAAAAAQAAAAs=",
            "AAAAAAAAAAAAAAAMdG90YWxfYXNzZXRzAAAAAAAAAAEAAAAL",
            "AAAAAAAAAGtSZXR1cm5zIHRoZSB0b3RhbCBhbW91bnQgb2YgdG9rZW5zIGluIGNpcmN1bGF0aW9uLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgAAAAAMdG90YWxfc3VwcGx5AAAAAAAAAAEAAAAL",
            "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAQAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAKdW5kZXJseWluZwAAAAAAEwAAAAAAAAAEbmFtZQAAABAAAAAAAAAABnN5bWJvbAAAAAAAEAAAAAA=",
            "AAAAAAAAAEBSZXR1cm5zIGVzY3Jvd2VkIHNoYXJlcyBmb3IgYW4gdW5mdWxmaWxsZWQgcmVxdWVzdCBhbmQgZHJvcHMgaXQuAAAADWNhbmNlbF9yZWRlZW0AAAAAAAABAAAAAAAAAAJpZAAAAAAABAAAAAA=",
            "AAAAAAAAAAAAAAANbmF2X3Blcl9zaGFyZQAAAAAAAAAAAAABAAAACw==",
            "AAAAAAAAAAAAAAANc3RhYmxlX2Fzc2V0cwAAAAAAAAAAAAABAAAACw==",
            "AAAAAAAAA2dUcmFuc2ZlcnMgYGFtb3VudGAgb2YgdG9rZW5zIGZyb20gYGZyb21gIHRvIGB0b2AgdXNpbmcgdGhlCmFsbG93YW5jZSBtZWNoYW5pc20uIGBhbW91bnRgIGlzIHRoZW4gZGVkdWN0ZWQgZnJvbSBgc3BlbmRlcmAKYWxsb3dhbmNlLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHNwZW5kZXJgIC0gVGhlIGFkZHJlc3MgYXV0aG9yaXppbmcgdGhlIHRyYW5zZmVyLCBhbmQgaGF2aW5nIGl0cwphbGxvd2FuY2UgY29uc3VtZWQgZHVyaW5nIHRoZSB0cmFuc2Zlci4KKiBgZnJvbWAgLSBUaGUgYWRkcmVzcyBob2xkaW5nIHRoZSB0b2tlbnMgd2hpY2ggd2lsbCBiZSB0cmFuc2ZlcnJlZC4KKiBgdG9gIC0gVGhlIGFkZHJlc3MgcmVjZWl2aW5nIHRoZSB0cmFuc2ZlcnJlZCB0b2tlbnMuCiogYGFtb3VudGAgLSBUaGUgYW1vdW50IG9mIHRva2VucyB0byBiZSB0cmFuc2ZlcnJlZC4KCiMgRXJyb3JzCgoqIFtgRnVuZ2libGVUb2tlbkVycm9yOjpJbnN1ZmZpY2llbnRCYWxhbmNlYF0gLSBXaGVuIGF0dGVtcHRpbmcgdG8KdHJhbnNmZXIgbW9yZSB0b2tlbnMgdGhhbiBgZnJvbWAgY3VycmVudCBiYWxhbmNlLgoqIFtgRnVuZ2libGVUb2tlbkVycm9yOjpMZXNzVGhhblplcm9gXSAtIFdoZW4gYGFtb3VudCA8IDBgLgoqIFtgRnVuZ2libGVUb2tlbkVycm9yOjpJbnN1ZmZpY2llbnRBbGxvd2FuY2VgXSAtIFdoZW4gYXR0ZW1wdGluZyB0bwp0cmFuc2ZlciBtb3JlIHRva2VucyB0aGFuIGBzcGVuZGVyYCBjdXJyZW50IGFsbG93YW5jZS4KCiMgRXZlbnRzCgoqIHRvcGljcyAtIGBbInRyYW5zZmVyIiwgZnJvbTogQWRkcmVzcywgdG86IEFkZHJlc3NdYAoqIGRhdGEgLSBgW2Ftb3VudDogaTEyOF1gAAAAAA10cmFuc2Zlcl9mcm9tAAAAAAAABAAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAAAAAARmcm9tAAAAEwAAAAAAAAACdG8AAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
            "AAAAAAAAAAAAAAAOYXZhaWxhYmxlX2hlbGQAAAAAAAAAAAABAAAACw==",
            "AAAAAAAAAAAAAAAOcHJldmlld19yZWRlZW0AAAAAAAEAAAAAAAAABnNoYXJlcwAAAAAACwAAAAEAAAAL",
            "AAAAAAAAAAAAAAAOcmVxdWVzdF9yZWRlZW0AAAAAAAIAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAGc2hhcmVzAAAAAAALAAAAAQAAAAQ=",
            "AAAAAAAAAAAAAAAPcHJldmlld19kZXBvc2l0AAAAAAEAAAAAAAAABmFzc2V0cwAAAAAACwAAAAEAAAAL",
            "AAAAAAAAAAAAAAAPcmVtb3ZlX3N0cmF0ZWd5AAAAAAEAAAAAAAAAB2FkZHJlc3MAAAAAEwAAAAA=",
            "AAAAAAAAAAAAAAAQcGVuZGluZ19yZXF1ZXN0cwAAAAAAAAABAAAD6gAAAAQ=",
            "AAAAAAAAAAAAAAAQcHJldmlld193aXRoZHJhdwAAAAEAAAAAAAAABmFzc2V0cwAAAAAACwAAAAEAAAAL",
            "AAAAAAAAAAAAAAARY29udmVydF90b19hc3NldHMAAAAAAAABAAAAAAAAAAZzaGFyZXMAAAAAAAsAAAABAAAACw==",
            "AAAAAAAAAAAAAAARY29udmVydF90b19zaGFyZXMAAAAAAAABAAAAAAAAAAZhc3NldHMAAAAAAAsAAAABAAAACw==",
            "AAAAAAAAAQFBZG1pbi1nYXRlZCByZS1sYWJlbCBvZiB0aGUgc2hhcmUgdG9rZW4gKG5hbWUgKyBzeW1ib2wpLiBEZWNpbWFscyBhcmUKZml4ZWQgYXQgNy4gTGV0cyBhIGRlcGxveWVkIHJlc2VydmUgYWRvcHQgaXRzIHBlci1jdXJyZW5jeSBzeW1ib2wKKE1VU0QgLyBNQlJMIC8gTUFSUykgdmlhIGB1cGdyYWRlKClgIGluc3RlYWQgb2YgYSBkZXN0cnVjdGl2ZSByZWRlcGxveSDigJQKYmFsYW5jZXMsIE5BViwgYW5kIHNlZWRlZCBzdGF0ZSBhcmUgcHJlc2VydmVkLgAAAAAAABJzZXRfdG9rZW5fbWV0YWRhdGEAAAAAAAIAAAAAAAAABG5hbWUAAAAQAAAAAAAAAAZzeW1ib2wAAAAAABAAAAAA",
            "AAAAAAAAAAAAAAATcHJvY2Vzc19yZWRlbXB0aW9ucwAAAAABAAAAAAAAAAltYXhfYmF0Y2gAAAAAAAAEAAAAAA==",
            "AAAAAAAAAVRGcmFjdGlvbiBvZiBUT1RBTCBhc3NldHMgKGluIGJwcykgdGhlIHZhdWx0IHJldGFpbnMgYXMgYSBsaXF1aWQgY2FzaApidWZmZXI7IGByZWJhbGFuY2VgIGRlcGxveXMgdGhlIHN1cnBsdXMgYWJvdmUgaXQgYW5kIGRpdmVzdHMgYmFjayBpbnRvIGl0LgowID0gZGVwbG95IGV2ZXJ5dGhpbmcuIFNldCBwZXIgcmVzZXJ2ZS4gVGhpcyBpcyBhIExJUVVJRElUWSBvcHRpbWl6YXRpb24KKGF2b2lkIG9uLWRlbWFuZCBkaXZlc3QgY29zdHMpLCBOT1QgYSBzb2x2ZW5jeSByZXNlcnZlIOKAlCBzb2x2ZW5jeSBzdGF5cwplbmZvcmNlZCBieSBgZnJlZV9jYXBpdGFsYCAvIGBjb3ZlcmFnZV9yZXF1aXJlZGAuAAAAFW1pbl9saXF1aWRfYnVmZmVyX2JwcwAAAAAAAAAAAAABAAAABA==",
            "AAAAAAAAAJJQZXItc3RyYXRlZ3kgY29uY2VudHJhdGlvbiBjYXAsIGluIGJwcyBvZiBUT1RBTCBhc3NldHMuIERlZmF1bHRzIHRvIDEwMCUKKHVuY2FwcGVkKSB3aGVuIHVuc2V0LiBgcmViYWxhbmNlYCB3aWxsIG5vdCBkZXBsb3kgYSBzdHJhdGVneSBhYm92ZSB0aGlzLgAAAAAAFXN0cmF0ZWd5X21heF9kZWJ0X2JwcwAAAAAAAAEAAAAAAAAACHN0cmF0ZWd5AAAAEwAAAAEAAAAE",
            "AAAAAAAAAAAAAAAZc2V0X21pbl9saXF1aWRfYnVmZmVyX2JwcwAAAAAAAAEAAAAAAAAAA2JwcwAAAAAEAAAAAA==",
            "AAAAAAAAAAAAAAAZc2V0X3N0cmF0ZWd5X21heF9kZWJ0X2JwcwAAAAAAAAIAAAAAAAAACHN0cmF0ZWd5AAAAEwAAAAAAAAADYnBzAAAAAAQAAAAA",
            "AAAAAQAAAAAAAAAAAAAADVJlZGVlbVJlcXVlc3QAAAAAAAAGAAAAAAAAAAljbGFpbWFibGUAAAAAAAALAAAAAAAAAAdjbGFpbWVkAAAAAAEAAAAAAAAACWZ1bGZpbGxlZAAAAAAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABnNoYXJlcwAAAAAACw==",
            "AAAAAQAAAAAAAAAAAAAADVN0cmF0ZWd5QWxsb2MAAAAAAAADAAAAAAAAAAdhZGRyZXNzAAAAABMAAAAAAAAACHZvbGF0aWxlAAAAAQAAAAAAAAAKd2VpZ2h0X2JwcwAAAAAABA==",
            "AAAABAAAAAAAAAAAAAAAFlNvcm9iYW5GaXhlZFBvaW50RXJyb3IAAAAAAAIAAAAcQXJpdGhtZXRpYyBvdmVyZmxvdyBvY2N1cnJlZAAAAAhPdmVyZmxvdwAABdwAAAAQRGl2aXNpb24gYnkgemVybwAAAA5EaXZpc2lvbkJ5WmVybwAAAAAF3Q==",
            "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gdG9rZW5zIGFyZSBtaW50ZWQuAAAAAAAAAAAAAARNaW50AAAAAQAAAARtaW50AAAAAgAAAAAAAAACdG8AAAAAABMAAAABAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAg==",
            "AAAABQAAACxFdmVudCBlbWl0dGVkIHdoZW4gYW4gYWxsb3dhbmNlIGlzIGFwcHJvdmVkLgAAAAAAAAAHQXBwcm92ZQAAAAABAAAAB2FwcHJvdmUAAAAABAAAAAAAAAAFb3duZXIAAAAAAAATAAAAAQAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAARbGl2ZV91bnRpbF9sZWRnZXIAAAAAAAAEAAAAAAAAAAI=",
            "AAAABQAAASFFdmVudCBlbWl0dGVkIHdoZW4gdG9rZW5zIGFyZSB0cmFuc2ZlcnJlZCBiZXR3ZWVuIGFkZHJlc3NlcyB3aXRob3V0IGEKbXV4ZWQgZGVzdGluYXRpb24uCgpQZXIgU0VQLTQxLCB0aGUgZXZlbnQgZGF0YSBpcyBhIGJhcmUgYGkxMjhgIHdoZW4gbm8gbXV4ZWQgYWRkcmVzcyBpcwppbnZvbHZlZC4gVGhlIGBkYXRhX2Zvcm1hdCA9ICJzaW5nbGUtdmFsdWUiYCBhdHRyaWJ1dGUgZW5zdXJlcyB0aGUKYGFtb3VudGAgZmllbGQgaXMgc2VyaWFsaXplZCBhcyBhIGJhcmUgdmFsdWUgcmF0aGVyIHRoYW4gYSBtYXAuAAAAAAAAAAAAAAhUcmFuc2ZlcgAAAAEAAAAIdHJhbnNmZXIAAAADAAAAAAAAAARmcm9tAAAAEwAAAAEAAAAAAAAAAnRvAAAAAAATAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAA=",
            "AAAABQAAAZdFdmVudCBlbWl0dGVkIHdoZW4gdG9rZW5zIGFyZSB0cmFuc2ZlcnJlZCB0byBhIG11eGVkIGFkZHJlc3MuCgpQZXIgU0VQLTQxLCB3aGVuIHRoZSBkZXN0aW5hdGlvbiBpcyBhIFtgTXV4ZWRBZGRyZXNzYF0gdGhlIGV2ZW50IGRhdGEKY2FycmllcyBib3RoIHRoZSBhbW91bnQgYW5kIHRoZSBtdXhlZCBpZGVudGlmaWVyIHNvIHRoYXQgb2ZmLWNoYWluCmNvbnN1bWVycyBjYW4gYXR0cmlidXRlIHRoZSB0cmFuc2ZlciB0byB0aGUgY29ycmVjdCBzdWItYWNjb3VudC4KClVzZXMgYHRvcGljcyA9IFsidHJhbnNmZXIiXWAgc28gdGhhdCBib3RoIFtgVHJhbnNmZXJgXSBhbmQKW2BNdXhlZFRyYW5zZmVyYF0gc2hhcmUgdGhlIHNhbWUgYCJ0cmFuc2ZlciJgIGV2ZW50IHN5bWJvbCwgYXMgcmVxdWlyZWQKYnkgU0VQLTQxLgAAAAAAAAAADU11eGVkVHJhbnNmZXIAAAAAAAABAAAACHRyYW5zZmVyAAAABAAAAAAAAAAEZnJvbQAAABMAAAABAAAAAAAAAAJ0bwAAAAAAEwAAAAEAAAAAAAAAC3RvX211eGVkX2lkAAAAA+gAAAAGAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=",
            "AAAABAAAAAAAAAAAAAAAEkZ1bmdpYmxlVG9rZW5FcnJvcgAAAAAADwAAAG5JbmRpY2F0ZXMgYW4gZXJyb3IgcmVsYXRlZCB0byB0aGUgY3VycmVudCBiYWxhbmNlIG9mIGFjY291bnQgZnJvbSB3aGljaAp0b2tlbnMgYXJlIGV4cGVjdGVkIHRvIGJlIHRyYW5zZmVycmVkLgAAAAAAE0luc3VmZmljaWVudEJhbGFuY2UAAAAAZAAAAGRJbmRpY2F0ZXMgYSBmYWlsdXJlIHdpdGggdGhlIGFsbG93YW5jZSBtZWNoYW5pc20gd2hlbiBhIGdpdmVuIHNwZW5kZXIKZG9lc24ndCBoYXZlIGVub3VnaCBhbGxvd2FuY2UuAAAAFUluc3VmZmljaWVudEFsbG93YW5jZQAAAAAAAGUAAABNSW5kaWNhdGVzIGFuIGludmFsaWQgdmFsdWUgZm9yIGBsaXZlX3VudGlsX2xlZGdlcmAgd2hlbiBzZXR0aW5nIGFuCmFsbG93YW5jZS4AAAAAAAAWSW52YWxpZExpdmVVbnRpbExlZGdlcgAAAAAAZgAAADJJbmRpY2F0ZXMgYW4gZXJyb3Igd2hlbiBhbiBpbnB1dCB0aGF0IG11c3QgYmUgPj0gMAAAAAAADExlc3NUaGFuWmVybwAAAGcAAAApSW5kaWNhdGVzIG92ZXJmbG93IHdoZW4gYWRkaW5nIHR3byB2YWx1ZXMAAAAAAAAMTWF0aE92ZXJmbG93AAAAaAAAACpJbmRpY2F0ZXMgYWNjZXNzIHRvIHVuaW5pdGlhbGl6ZWQgbWV0YWRhdGEAAAAAAA1VbnNldE1ldGFkYXRhAAAAAAAAaQAAAFJJbmRpY2F0ZXMgdGhhdCB0aGUgb3BlcmF0aW9uIHdvdWxkIGhhdmUgY2F1c2VkIGB0b3RhbF9zdXBwbHlgIHRvIGV4Y2VlZAp0aGUgYGNhcGAuAAAAAAALRXhjZWVkZWRDYXAAAAAAagAAADZJbmRpY2F0ZXMgdGhlIHN1cHBsaWVkIGBjYXBgIGlzIG5vdCBhIHZhbGlkIGNhcCB2YWx1ZS4AAAAAAApJbnZhbGlkQ2FwAAAAAABrAAAAHkluZGljYXRlcyB0aGUgQ2FwIHdhcyBub3Qgc2V0LgAAAAAACUNhcE5vdFNldAAAAAAAAGwAAAAmSW5kaWNhdGVzIHRoZSBTQUMgYWRkcmVzcyB3YXMgbm90IHNldC4AAAAAAAlTQUNOb3RTZXQAAAAAAABtAAAAMEluZGljYXRlcyBhIFNBQyBhZGRyZXNzIGRpZmZlcmVudCB0aGFuIGV4cGVjdGVkLgAAABJTQUNBZGRyZXNzTWlzbWF0Y2gAAAAAAG4AAABDSW5kaWNhdGVzIGEgbWlzc2luZyBmdW5jdGlvbiBwYXJhbWV0ZXIgaW4gdGhlIFNBQyBjb250cmFjdCBjb250ZXh0LgAAAAARU0FDTWlzc2luZ0ZuUGFyYW0AAAAAAABvAAAAREluZGljYXRlcyBhbiBpbnZhbGlkIGZ1bmN0aW9uIHBhcmFtZXRlciBpbiB0aGUgU0FDIGNvbnRyYWN0IGNvbnRleHQuAAAAEVNBQ0ludmFsaWRGblBhcmFtAAAAAAAAcAAAADFUaGUgdXNlciBpcyBub3QgYWxsb3dlZCB0byBwZXJmb3JtIHRoaXMgb3BlcmF0aW9uAAAAAAAADlVzZXJOb3RBbGxvd2VkAAAAAABxAAAANVRoZSB1c2VyIGlzIGJsb2NrZWQgYW5kIGNhbm5vdCBwZXJmb3JtIHRoaXMgb3BlcmF0aW9uAAAAAAAAC1VzZXJCbG9ja2VkAAAAAHI="]), options);
        this.options = options;
    }
    fromJSON = {
        mint: (this.txFromJSON),
        name: (this.txFromJSON),
        admin: (this.txFromJSON),
        claim: (this.txFromJSON),
        policy: (this.txFromJSON),
        redeem: (this.txFromJSON),
        symbol: (this.txFromJSON),
        approve: (this.txFromJSON),
        balance: (this.txFromJSON),
        deposit: (this.txFromJSON),
        request: (this.txFromJSON),
        upgrade: (this.txFromJSON),
        decimals: (this.txFromJSON),
        disburse: (this.txFromJSON),
        max_mint: (this.txFromJSON),
        transfer: (this.txFromJSON),
        withdraw: (this.txFromJSON),
        allowance: (this.txFromJSON),
        rebalance: (this.txFromJSON),
        set_admin: (this.txFromJSON),
        fee_income: (this.txFromJSON),
        max_redeem: (this.txFromJSON),
        set_policy: (this.txFromJSON),
        strategies: (this.txFromJSON),
        collect_fee: (this.txFromJSON),
        max_deposit: (this.txFromJSON),
        query_asset: (this.txFromJSON),
        target_idle: (this.txFromJSON),
        add_strategy: (this.txFromJSON),
        free_capital: (this.txFromJSON),
        max_withdraw: (this.txFromJSON),
        preview_mint: (this.txFromJSON),
        total_assets: (this.txFromJSON),
        total_supply: (this.txFromJSON),
        cancel_redeem: (this.txFromJSON),
        nav_per_share: (this.txFromJSON),
        stable_assets: (this.txFromJSON),
        transfer_from: (this.txFromJSON),
        available_held: (this.txFromJSON),
        preview_redeem: (this.txFromJSON),
        request_redeem: (this.txFromJSON),
        preview_deposit: (this.txFromJSON),
        remove_strategy: (this.txFromJSON),
        pending_requests: (this.txFromJSON),
        preview_withdraw: (this.txFromJSON),
        convert_to_assets: (this.txFromJSON),
        convert_to_shares: (this.txFromJSON),
        set_token_metadata: (this.txFromJSON),
        process_redemptions: (this.txFromJSON),
        min_liquid_buffer_bps: (this.txFromJSON),
        strategy_max_debt_bps: (this.txFromJSON),
        set_min_liquid_buffer_bps: (this.txFromJSON),
        set_strategy_max_debt_bps: (this.txFromJSON)
    };
}
