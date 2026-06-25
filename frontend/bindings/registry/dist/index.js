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
        contractId: "CA7WWXTNBG2QCDBQMYL3SV7DRXBW7KALM5JGWPJJEAP34DWWUMLYGSKN",
    }
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
        super(new ContractSpec(["AAAAAAAAAAAAAAADZ2V0AAAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAQAAA+kAAAfQAAAACUd1YXJhbnRlZQAAAAAAB9AAAAANUmVnaXN0cnlFcnJvcgAAAA==",
            "AAAAAAAAAAAAAAADcHV0AAAAAAEAAAAAAAAAAWcAAAAAAAfQAAAACUd1YXJhbnRlZQAAAAAAAAA=",
            "AAAAAAAAAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAABM=",
            "AAAAAAAAAAAAAAAGd3JpdGVyAAAAAAAAAAAAAQAAABM=",
            "AAAAAAAAAAAAAAAHbmV4dF9pZAAAAAAAAAAAAQAAAAQ=",
            "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA",
            "AAAAAAAAAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
            "AAAAAAAAAAAAAAAKYWN0aXZlX2lkcwAAAAAAAAAAAAEAAAPqAAAABA==",
            "AAAAAAAAAAAAAAAKc2V0X3dyaXRlcgAAAAAAAQAAAAAAAAAGd3JpdGVyAAAAAAATAAAAAA==",
            "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
            "AAAAAQAAAG9TdGFibGUgY29yZSBvZiBhIGd1YXJhbnRlZS4gTW9kZWwtc3BlY2lmaWMgZXh0cmFzIGxpdmUgaW4gdGhlIHBvbGljeSdzIG93bgpzdG9yYWdlLCBrZXllZCBieSBpZCDigJQgbmV2ZXIgaGVyZS4AAAAAAAAAAAlHdWFyYW50ZWUAAAAAAAAJAAAAAAAAAAZhY3RpdmUAAAAAAAEAAAAAAAAAB2ZlZV9icHMAAAAABAAAAAAAAAACaWQAAAAAAAQAAAAAAAAACGxhbmRsb3JkAAAAEwAAAAAAAAAObW9udGhseV9hbW91bnQAAAAAAAsAAAAAAAAADm1vbnRoc19jb3ZlcmVkAAAAAAAEAAAAAAAAAAttb250aHNfdXNlZAAAAAAEAAAAAAAAAApwYWlkX3VudGlsAAAAAAAGAAAAAAAAAAtwZXJpb2Rfc2VjcwAAAAAG",
            "AAAABAAAAU5FcnJvcnMgc3VyZmFjZWQgYWNyb3NzIHRoZSByZWdpc3RyeSBib3VuZGFyeS4gRGVmaW5lZCBoZXJlIChub3QgaW4gdGhlCmByZWdpc3RyeWAgY3JhdGUpIGJlY2F1c2UgdGhlIGBSZWdpc3RyeWAgdHJhaXQncyByZXR1cm4gdHlwZSByZWZlcmVuY2VzIGl0LApzbyBldmVyeSBjb25zdW1lciBvZiB0aGUgZ2VuZXJhdGVkIGBSZWdpc3RyeUNsaWVudGAgc2VlcyB0aGUgc2FtZSBzdGFibGUKYCNbY29udHJhY3RlcnJvcl1gIGNvZGVzLiBOdW1iZXJlZCBpbiB0aGUgYDJ4eGAgYmFuZCB0byBzdGF5IGNsZWFyIG9mIHRoZQpgNHh4YCBzdHJhdGVneSBjb2RlcyBpbiBgZGVmaW5kZXgtaG9kbGAuAAAAAAAAAAAADVJlZ2lzdHJ5RXJyb3IAAAAAAAABAAAAcE5vIGd1YXJhbnRlZSBpcyBzdG9yZWQgdW5kZXIgdGhlIHJlcXVlc3RlZCBpZCAocHJldmlvdXNseSBhIGhvc3QgdHJhcApmcm9tIGBPcHRpb246OnVud3JhcGAgb24gbWlzc2luZyBzdG9yYWdlKS4AAAARR3VhcmFudGVlTm90Rm91bmQAAAAAAADI"]), options);
        this.options = options;
    }
    fromJSON = {
        get: (this.txFromJSON),
        put: (this.txFromJSON),
        admin: (this.txFromJSON),
        writer: (this.txFromJSON),
        next_id: (this.txFromJSON),
        upgrade: (this.txFromJSON),
        set_admin: (this.txFromJSON),
        active_ids: (this.txFromJSON),
        set_writer: (this.txFromJSON)
    };
}
