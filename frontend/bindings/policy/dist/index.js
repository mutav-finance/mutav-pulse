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
        contractId: "CCS7FPL7FRB3JPW2C3HEXCPKL24BXNXKY22KEAXVSRNCLXIDONDIPDJF",
    }
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
            "AAAAAAAAAAAAAAAMc2V0X3JlZ2lzdHJ5AAAAAQAAAAAAAAAEYWRkcgAAABMAAAAA",
            "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
            "AAAAAAAAAAAAAAANY292ZXJfZGVmYXVsdAAAAAAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAA==",
            "AAAAAAAAAAAAAAAOc2lnbl9ndWFyYW50ZWUAAAAAAAUAAAAAAAAACGxhbmRsb3JkAAAAEwAAAAAAAAAObW9udGhseV9hbW91bnQAAAAAAAsAAAAAAAAADm1vbnRoc19jb3ZlcmVkAAAAAAAEAAAAAAAAAAdmZWVfYnBzAAAAAAQAAAAAAAAAC3BlcmlvZF9zZWNzAAAAAAYAAAABAAAABA==",
            "AAAAAAAAAAAAAAAPbW9udGhseV9wcmVtaXVtAAAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAQAAAAs=",
            "AAAAAAAAAAAAAAAQc2V0dGxlX2d1YXJhbnRlZQAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAA==",
            "AAAAAAAAAAAAAAARY292ZXJhZ2VfcmVxdWlyZWQAAAAAAAAAAAAAAQAAAAs=",
            "AAAAAAAAAAAAAAAWc2V0X2NvdmVyYWdlX3JhdGlvX2JwcwAAAAAAAQAAAAAAAAADYnBzAAAAAAQAAAAA",
            "AAAAAQAAAG9TdGFibGUgY29yZSBvZiBhIGd1YXJhbnRlZS4gTW9kZWwtc3BlY2lmaWMgZXh0cmFzIGxpdmUgaW4gdGhlIHBvbGljeSdzIG93bgpzdG9yYWdlLCBrZXllZCBieSBpZCDigJQgbmV2ZXIgaGVyZS4AAAAAAAAAAAlHdWFyYW50ZWUAAAAAAAAJAAAAAAAAAAZhY3RpdmUAAAAAAAEAAAAAAAAAB2ZlZV9icHMAAAAABAAAAAAAAAACaWQAAAAAAAQAAAAAAAAACGxhbmRsb3JkAAAAEwAAAAAAAAAObW9udGhseV9hbW91bnQAAAAAAAsAAAAAAAAADm1vbnRoc19jb3ZlcmVkAAAAAAAEAAAAAAAAAAttb250aHNfdXNlZAAAAAAEAAAAAAAAAApwYWlkX3VudGlsAAAAAAAGAAAAAAAAAAtwZXJpb2Rfc2VjcwAAAAAG"]), options);
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
