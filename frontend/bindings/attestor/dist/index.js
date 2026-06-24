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
        contractId: "CBYXNYYZRD5SOBU3HP5GWV7I64GISOF5H4SWN2UTXZ7FIF6LSVII36MT",
    }
};
/**
 * Attestor errors.
 */
export const AttestError = {
    0: { message: "InvalidProof" },
    1: { message: "MalformedPublicInputs" },
    2: { message: "MalformedProof" },
    /**
     * `now - nonce > WINDOW_SECS` — attestation too old.
     */
    3: { message: "StaleProof" },
    /**
     * `nonce > now` — attestation "from the future".
     */
    4: { message: "ProofFromFuture" },
    /**
     * registry/vault/oracle have not been set yet.
     */
    5: { message: "NotConfigured" },
    /**
     * `ratio_bps < MIN_RATIO_BPS` — band below the coverage floor (100%).
     */
    6: { message: "RatioTooLow" }
};
/**
 * Groth16 verification errors.
 */
export const Groth16Error = {
    0: { message: "InvalidProof" },
    1: { message: "MalformedPublicInputs" },
    2: { message: "MalformedProof" }
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
        super(new ContractSpec(["AAAAAQAAAI9BICJsdXogdmVyZGUiIGdyYXZhZGEgb24tY2hhaW4uIGBzb2x2ZW50YCDDqSBzZW1wcmUgdHJ1ZSBxdWFuZG8gZ3JhdmFkYSAodW1hCnByb3ZhIGludsOhbGlkYSByZXZlcnRlKTsgbyBmcm9udCBsw6ogbyBmcmVzY29yIHBvciBgbGVkZ2VyYC9gdHNgLgAAAAAAAAAAC0F0dGVzdGF0aW9uAAAAAAQAAAAAAAAABmxlZGdlcgAAAAAABAAAAAAAAAAJcmF0aW9fYnBzAAAAAAAABAAAAAAAAAAHc29sdmVudAAAAAABAAAAAAAAAAJ0cwAAAAAABg==",
            "AAAABAAAABJFcnJvcyBkbyBhdHRlc3Rvci4AAAAAAAAAAAALQXR0ZXN0RXJyb3IAAAAABwAAAAAAAAAMSW52YWxpZFByb29mAAAAAAAAAAAAAAAVTWFsZm9ybWVkUHVibGljSW5wdXRzAAAAAAAAAQAAAAAAAAAOTWFsZm9ybWVkUHJvb2YAAAAAAAIAAAA5YG5vdyAtIG5vbmNlID4gV0lORE9XX1NFQ1NgIOKAlCBhdGVzdGHDp8OjbyB2ZWxoYSBkZW1haXMuAAAAAAAAClN0YWxlUHJvb2YAAAAAAAMAAAAqYG5vbmNlID4gbm93YCDigJQgYXRlc3Rhw6fDo28gImRvIGZ1dHVybyIuAAAAAAAPUHJvb2ZGcm9tRnV0dXJlAAAAAAQAAAAxcmVnaXN0cnkvdmF1bHQvb3LDoWN1bG8gYWluZGEgbsOjbyBmb3JhbSBzZXRhZG9zLgAAAAAAAA1Ob3RDb25maWd1cmVkAAAAAAAABQAAAElgcmF0aW9fYnBzIDwgTUlOX1JBVElPX0JQU2Ag4oCUIGZhaXhhIGFiYWl4byBkbyBwaXNvIGRlIGNvYmVydHVyYSAoMTAwJSkuAAAAAAAAC1JhdGlvVG9vTG93AAAAAAY=",
            "AAAABAAAAB9FcnJvcyBkZSB2ZXJpZmljYcOnw6NvIEdyb3RoMTYuAAAAAAAAAAAMR3JvdGgxNkVycm9yAAAAAwAAAAAAAAAMSW52YWxpZFByb29mAAAAAAAAAAAAAAAVTWFsZm9ybWVkUHVibGljSW5wdXRzAAAAAAAAAQAAAAAAAAAOTWFsZm9ybWVkUHJvb2YAAAAAAAI=",
            "AAAAAQAAAD9Qcm92YSBHcm90aDE2ID0gcG9udG9zIEEsIEIsIEMuIEIgKEcyKSBlbSBvcmRlbSBTb3JvYmFuIGMxfHxjMC4AAAAAAAAAAAxHcm90aDE2UHJvb2YAAAADAAAAAAAAAAFhAAAAAAAD7gAAAGAAAAAAAAAAAWIAAAAAAAPuAAAAwAAAAAAAAAABYwAAAAAAA+4AAABg",
            "AAAAAAAAAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAABM=",
            "AAAAAAAAAOJWZXJpZmljYSBhIHByb3ZhIGNvbnRyYSBvIGVzdGFkbyBvbi1jaGFpbiBhbyB2aXZvIGUgZ3JhdmEgYSBhdGVzdGHDp8Ojby4KUMO6YmxpY29zIHJlY29uc3RydcOtZG9zIGRvIGVzdGFkbyByZWFsOiBwcm92YSBmZWl0YSBwLyBvdXRybyBlc3RhZG8gbsOjbyB2ZXJpZmljYS4KYG5vbmNlYCA9IHRpbWVzdGFtcCBhc3NpbmFkbyBwZWxvIG9yw6FjdWxvIChmcmVzY29yKS4gUEVSTUlTU0lPTkxFU1MuAAAAAAAGYXR0ZXN0AAAAAAADAAAAAAAAAAVwcm9vZgAAAAAAAA4AAAAAAAAACXJhdGlvX2JwcwAAAAAAAAQAAAAAAAAABW5vbmNlAAAAAAAABgAAAAEAAAPpAAAAAgAAB9AAAAALQXR0ZXN0RXJyb3IA",
            "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA",
            "AAAAAAAAAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
            "AAAAAAAAAAAAAAAJc2V0X3ZhdWx0AAAAAAAAAQAAAAAAAAAEYWRkcgAAABMAAAAA",
            "AAAAAAAAAKJGaXhhIGEgcHVia2V5IEVkRFNBIGRvIG9yw6FjdWxvLWJhbmNvIChjb29yZHMgQXgvQXkgY29tbyBmaWVsZCBlbGVtZW50cyBCRSkuClNlbSBpc3RvLCBhIHBlw6dhIEEgc2VyaWEgZm9yasOhdmVsIChxdWFscXVlciBwcm92ZXIgYXNzaW5hcmlhIGNvbSBhIHByw7NwcmlhIGNoYXZlKS4AAAAAAApzZXRfb3JhY2xlAAAAAAACAAAAAAAAAAJheAAAAAAD7gAAACAAAAAAAAAAAmF5AAAAAAPuAAAAIAAAAAA=",
            "AAAAAAAAAAAAAAAMc2V0X3JlZ2lzdHJ5AAAAAQAAAAAAAAAEYWRkcgAAABMAAAAA",
            "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
            "AAAAAAAAAE/Dmmx0aW1hIGF0ZXN0YcOnw6NvIGdyYXZhZGEgKE5vbmUgc2UgbnVuY2EgaG91dmUpLiBMZWl0dXJhIHDDumJsaWNhIHAvIG8gZnJvbnQuAAAAABBsYXN0X2F0dGVzdGF0aW9uAAAAAAAAAAEAAAPoAAAH0AAAAAtBdHRlc3RhdGlvbgA=",
            "AAAAAQAAAG9TdGFibGUgY29yZSBvZiBhIGd1YXJhbnRlZS4gTW9kZWwtc3BlY2lmaWMgZXh0cmFzIGxpdmUgaW4gdGhlIHBvbGljeSdzIG93bgpzdG9yYWdlLCBrZXllZCBieSBpZCDigJQgbmV2ZXIgaGVyZS4AAAAAAAAAAAlHdWFyYW50ZWUAAAAAAAAJAAAAAAAAAAZhY3RpdmUAAAAAAAEAAAAAAAAAB2ZlZV9icHMAAAAABAAAAAAAAAACaWQAAAAAAAQAAAAAAAAACGxhbmRsb3JkAAAAEwAAAAAAAAAObW9udGhseV9hbW91bnQAAAAAAAsAAAAAAAAADm1vbnRoc19jb3ZlcmVkAAAAAAAEAAAAAAAAAAttb250aHNfdXNlZAAAAAAEAAAAAAAAAApwYWlkX3VudGlsAAAAAAAGAAAAAAAAAAtwZXJpb2Rfc2VjcwAAAAAG"]), options);
        this.options = options;
    }
    fromJSON = {
        admin: (this.txFromJSON),
        attest: (this.txFromJSON),
        upgrade: (this.txFromJSON),
        set_admin: (this.txFromJSON),
        set_vault: (this.txFromJSON),
        set_oracle: (this.txFromJSON),
        set_registry: (this.txFromJSON),
        last_attestation: (this.txFromJSON)
    };
}
