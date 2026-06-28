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
        contractId: "CDKJQP5M34SBLT47CHRBGOAUFONG6JUN5URWSGCSGTGAS5JBM2NYGZ33",
    }
};
export class Client extends ContractClient {
    options;
    static async deploy(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { underlying }, 
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options) {
        return ContractClient.deploy({ underlying }, options);
    }
    constructor(options) {
        super(new ContractSpec(["AAAAAAAAAEtUZXN0L2RlbW8gaGVscGVyOiBtaW50IGV4dHJhIHVuZGVybHlpbmcgdG8gdGhpcyBjb250cmFjdCB0byBzaW11bGF0ZSB5aWVsZC4AAAAABmFjY3J1ZQAAAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
            "AAAAAAAAAAAAAAAGZGl2ZXN0AAAAAAACAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAnRvAAAAAAATAAAAAQAAAAs=",
            "AAAAAAAAAAAAAAAGaW52ZXN0AAAAAAABAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
            "AAAAAAAAAAAAAAAHYmFsYW5jZQAAAAAAAAAAAQAAAAs=",
            "AAAAAAAAAAAAAAAKdW5kZXJseWluZwAAAAAAAAAAAAEAAAAT",
            "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAACnVuZGVybHlpbmcAAAAAABMAAAAA"]), options);
        this.options = options;
    }
    fromJSON = {
        accrue: (this.txFromJSON),
        divest: (this.txFromJSON),
        invest: (this.txFromJSON),
        balance: (this.txFromJSON),
        underlying: (this.txFromJSON)
    };
}
