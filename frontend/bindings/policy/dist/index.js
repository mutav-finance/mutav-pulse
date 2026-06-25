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
        contractId: "CDAYVNXHJD2T4QO66ECBX6LNA2SD2HCP66H23FPYWW7VSUR74QJ2K2VK",
    }
};
/**
 * Underwriting errors surfaced as stable `#[contracterror]` codes. Numbered in
 * the `3xx` band to stay clear of the registry `2xx` and strategy `4xx` codes.
 */
export const PolicyError = {
    /**
     * `fee_bps` exceeds 100% (10_000 bps). Previously accepted silently, which
     * let a guarantee charge a premium above its own monthly amount.
     */
    300: { message: "FeeTooHigh" }
};
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
    200: { message: "GuaranteeNotFound" }
};
export class Client extends ContractClient {
    options;
    static async deploy(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { admin }, 
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options) {
        return ContractClient.deploy({ admin }, options);
    }
    constructor(options) {
        super(new ContractSpec(["AAAAAAAAAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAABM=",
            "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA",
            "AAAAAAAAAAAAAAAJZ3VhcmFudGVlAAAAAAAAAQAAAAAAAAACaWQAAAAAAAQAAAABAAAH0AAAAAlHdWFyYW50ZWUAAAA=",
            "AAAAAAAAAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
            "AAAAAAAAAAAAAAAJc2V0X3ZhdWx0AAAAAAAAAQAAAAAAAAAEYWRkcgAAABMAAAAA",
            "AAAAAAAAAAAAAAAKaXNfY3VycmVudAAAAAAAAQAAAAAAAAACaWQAAAAAAAQAAAABAAAAAQ==",
            "AAAAAAAAAAAAAAALcGF5X3ByZW1pdW0AAAAAAgAAAAAAAAAFcGF5ZXIAAAAAAAATAAAAAAAAAAJpZAAAAAAABAAAAAA=",
            "AAAABAAAAJlVbmRlcndyaXRpbmcgZXJyb3JzIHN1cmZhY2VkIGFzIHN0YWJsZSBgI1tjb250cmFjdGVycm9yXWAgY29kZXMuIE51bWJlcmVkIGluCnRoZSBgM3h4YCBiYW5kIHRvIHN0YXkgY2xlYXIgb2YgdGhlIHJlZ2lzdHJ5IGAyeHhgIGFuZCBzdHJhdGVneSBgNHh4YCBjb2Rlcy4AAAAAAAAAAAAAC1BvbGljeUVycm9yAAAAAAEAAACHYGZlZV9icHNgIGV4Y2VlZHMgMTAwJSAoMTBfMDAwIGJwcykuIFByZXZpb3VzbHkgYWNjZXB0ZWQgc2lsZW50bHksIHdoaWNoCmxldCBhIGd1YXJhbnRlZSBjaGFyZ2UgYSBwcmVtaXVtIGFib3ZlIGl0cyBvd24gbW9udGhseSBhbW91bnQuAAAAAApGZWVUb29IaWdoAAAAAAEs",
            "AAAAAAAAAAAAAAAMc2V0X3JlZ2lzdHJ5AAAAAQAAAAAAAAAEYWRkcgAAABMAAAAA",
            "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
            "AAAAAAAAAAAAAAANY292ZXJfZGVmYXVsdAAAAAAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAA==",
            "AAAAAAAAAAAAAAAOc2lnbl9ndWFyYW50ZWUAAAAAAAUAAAAAAAAACGxhbmRsb3JkAAAAEwAAAAAAAAAObW9udGhseV9hbW91bnQAAAAAAAsAAAAAAAAADm1vbnRoc19jb3ZlcmVkAAAAAAAEAAAAAAAAAAdmZWVfYnBzAAAAAAQAAAAAAAAAC3BlcmlvZF9zZWNzAAAAAAYAAAABAAAD6QAAAAQAAAfQAAAAC1BvbGljeUVycm9yAA==",
            "AAAAAAAAAAAAAAAPbW9udGhseV9wcmVtaXVtAAAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAQAAAAs=",
            "AAAAAAAAAAAAAAAQc2V0dGxlX2d1YXJhbnRlZQAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAA==",
            "AAAAAAAAAAAAAAARY292ZXJhZ2VfcmVxdWlyZWQAAAAAAAAAAAAAAQAAAAs=",
            "AAAAAAAAAAAAAAAWc2V0X2NvdmVyYWdlX3JhdGlvX2JwcwAAAAAAAQAAAAAAAAADYnBzAAAAAAQAAAAA",
            "AAAAAQAAAG9TdGFibGUgY29yZSBvZiBhIGd1YXJhbnRlZS4gTW9kZWwtc3BlY2lmaWMgZXh0cmFzIGxpdmUgaW4gdGhlIHBvbGljeSdzIG93bgpzdG9yYWdlLCBrZXllZCBieSBpZCDigJQgbmV2ZXIgaGVyZS4AAAAAAAAAAAlHdWFyYW50ZWUAAAAAAAAJAAAAAAAAAAZhY3RpdmUAAAAAAAEAAAAAAAAAB2ZlZV9icHMAAAAABAAAAAAAAAACaWQAAAAAAAQAAAAAAAAACGxhbmRsb3JkAAAAEwAAAAAAAAAObW9udGhseV9hbW91bnQAAAAAAAsAAAAAAAAADm1vbnRoc19jb3ZlcmVkAAAAAAAEAAAAAAAAAAttb250aHNfdXNlZAAAAAAEAAAAAAAAAApwYWlkX3VudGlsAAAAAAAGAAAAAAAAAAtwZXJpb2Rfc2VjcwAAAAAG",
            "AAAABAAAAU5FcnJvcnMgc3VyZmFjZWQgYWNyb3NzIHRoZSByZWdpc3RyeSBib3VuZGFyeS4gRGVmaW5lZCBoZXJlIChub3QgaW4gdGhlCmByZWdpc3RyeWAgY3JhdGUpIGJlY2F1c2UgdGhlIGBSZWdpc3RyeWAgdHJhaXQncyByZXR1cm4gdHlwZSByZWZlcmVuY2VzIGl0LApzbyBldmVyeSBjb25zdW1lciBvZiB0aGUgZ2VuZXJhdGVkIGBSZWdpc3RyeUNsaWVudGAgc2VlcyB0aGUgc2FtZSBzdGFibGUKYCNbY29udHJhY3RlcnJvcl1gIGNvZGVzLiBOdW1iZXJlZCBpbiB0aGUgYDJ4eGAgYmFuZCB0byBzdGF5IGNsZWFyIG9mIHRoZQpgNHh4YCBzdHJhdGVneSBjb2RlcyBpbiBgZGVmaW5kZXgtaG9kbGAuAAAAAAAAAAAADVJlZ2lzdHJ5RXJyb3IAAAAAAAABAAAAcE5vIGd1YXJhbnRlZSBpcyBzdG9yZWQgdW5kZXIgdGhlIHJlcXVlc3RlZCBpZCAocHJldmlvdXNseSBhIGhvc3QgdHJhcApmcm9tIGBPcHRpb246OnVud3JhcGAgb24gbWlzc2luZyBzdG9yYWdlKS4AAAARR3VhcmFudGVlTm90Rm91bmQAAAAAAADI"]), options);
        this.options = options;
    }
    fromJSON = {
        admin: (this.txFromJSON),
        upgrade: (this.txFromJSON),
        guarantee: (this.txFromJSON),
        set_admin: (this.txFromJSON),
        set_vault: (this.txFromJSON),
        is_current: (this.txFromJSON),
        pay_premium: (this.txFromJSON),
        set_registry: (this.txFromJSON),
        cover_default: (this.txFromJSON),
        sign_guarantee: (this.txFromJSON),
        monthly_premium: (this.txFromJSON),
        settle_guarantee: (this.txFromJSON),
        coverage_required: (this.txFromJSON),
        set_coverage_ratio_bps: (this.txFromJSON)
    };
}
