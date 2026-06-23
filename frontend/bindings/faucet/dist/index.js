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
        contractId: "CD2M2FMZVHBXPESBY4E7ZKF2OBSIXZCROGUNUPNDYEVQSVMUG4XJT2RB",
    }
};
export class Client extends ContractClient {
    options;
    static async deploy(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { token, amount, cooldown_secs }, 
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options) {
        return ContractClient.deploy({ token, amount, cooldown_secs }, options);
    }
    constructor(options) {
        super(new ContractSpec(["AAAAAAAAALZTZW5kIHRoZSBmaXhlZCBkcmlwIGFtb3VudCB0byBgdG9gLiBgdG9gIG11c3QgYXV0aG9yaXplIChzbyB5b3UgY2FuIG9ubHkKZnVuZCB5b3Vyc2VsZiksIG11c3QgaG9sZCBhIHRydXN0bGluZSB0byB0aGUgdG9rZW4sIGFuZCBtdXN0IHdhaXQgb3V0IHRoZQpwZXItYWRkcmVzcyBjb29sZG93biBiZXR3ZWVuIGRyaXBzLgAAAAAABGRyaXAAAAABAAAAAAAAAAJ0bwAAAAAAEwAAAAA=",
            "AAAAAAAAAAAAAAAFdG9rZW4AAAAAAAAAAAAAAQAAABM=",
            "AAAAAAAAAAAAAAAGYW1vdW50AAAAAAAAAAAAAQAAAAs=",
            "AAAAAAAAACdSZW1haW5pbmcgVVNEQyB0aGUgZmF1Y2V0IGNhbiBkaXNwZW5zZS4AAAAACWF2YWlsYWJsZQAAAAAAAAAAAAABAAAACw==",
            "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAA1jb29sZG93bl9zZWNzAAAAAAAABgAAAAA="]), options);
        this.options = options;
    }
    fromJSON = {
        drip: (this.txFromJSON),
        token: (this.txFromJSON),
        amount: (this.txFromJSON),
        available: (this.txFromJSON)
    };
}
