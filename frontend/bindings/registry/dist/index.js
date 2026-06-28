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
        contractId: "CDPTEOLZ5B253IZCBWASVEGBOZA3KK2QVIBRT7SBVR6BTBKXC4KMLGIY",
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
    200: { message: "GuaranteeNotFound" },
    /**
     * Caller supplied a guarantee id outside the issued range (>= NextId). The
     * registry derives ids from its own monotonic counter; a writer must never
     * fabricate the primary key, nor overwrite a not-yet-issued slot (CWE-840).
     * ADDITIVE: new discriminant; `GuaranteeNotFound = 200` is unchanged so the
     * `#[contracterror]` ABI stays stable for in-place `upgrade()`.
     */
    201: { message: "InvalidId" },
    /**
     * The Writer role was read before it was set. The constructor now defaults
     * Writer=admin, so this is defense-in-depth: it converts the host trap that
     * an older (pre-default) upgraded-in instance would hit into a stable typed
     * error. ADDITIVE.
     */
    202: { message: "WriterNotSet" },
    /**
     * `upgrade` was called against an on-chain schema version this binary does
     * not expect (stale / layout-incompatible storage). Distinct from `InvalidId`
     * so a refused stale-layout upgrade is distinguishable from a put id error in
     * logs. Layout-changing edits must redeploy + re-wire via `bootstrap.sh`, not
     * `upgrade()`. ADDITIVE.
     */
    203: { message: "VersionMismatch" }
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
            "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABwAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAGV3JpdGVyAAAAAAAAAAAAAAAAAAZOZXh0SWQAAAAAAAAAAAAAAAAACUFjdGl2ZUlkcwAAAAAAAAEAAAAAAAAACUd1YXJhbnRlZQAAAAAAAAEAAAAEAAAAAAAAAAAAAAANU2NoZW1hVmVyc2lvbgAAAAAAAAAAAAAAAAAAC1Jhd0NvdmVyYWdlAA==",
            "AAAAAAAAAAAAAAAGd3JpdGVyAAAAAAAAAAAAAQAAABM=",
            "AAAAAAAAAAAAAAAHbmV4dF9pZAAAAAAAAAAAAQAAAAQ=",
            "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA",
            "AAAABQAAAJFFbWl0dGVkIGJ5IGB1cGdyYWRlYCBhZnRlciB0aGUgd2FzbSBzd2FwIGlzIGNvbW1pdHRlZC4gTWlycm9ycyB0aGUgdmF1bHQncyBiYXJlCmAjW2NvbnRyYWN0ZXZlbnRdYCBpZGlvbSAoYXV0byBzbmFrZV9jYXNlIG5hbWUgdG9waWMgYHVwZ3JhZGVkYCkuAAAAAAAAAAAAAAhVcGdyYWRlZAAAAAEAAAAIdXBncmFkZWQAAAADAAAAAAAAAAVhZG1pbgAAAAAAABMAAAABAAAAAAAAAAd2ZXJzaW9uAAAAAAQAAAAAAAAAAAAAAAl3YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAAAAAAC",
            "AAAAAAAAAQNBZG1pbiBkcmlmdCB0cnVlLXVwOiByZWNvbXB1dGUgYFJhd0NvdmVyYWdlYCBvbmNlIGZyb20gdGhlIGFjdGl2ZSBzZXQgYW5kCm92ZXJ3cml0ZSB0aGUgc3RvcmVkIHNjYWxhci4gVGhlIGBwdXRgIGRlbHRhIGtlZXBzIHRoZSBhZ2dyZWdhdGUgZXhhY3QgYXQKZXZlcnkgd3JpdGUsIGJ1dCB0aGlzIGlzIHRoZSBzYWZldHkgdmFsdmUgKGFuZCBgQWN0aXZlSWRzYCcgcmVtYWluaW5nCmNvbnN1bWVyKSBzaG91bGQgYW55IGRyaWZ0IGV2ZXIgY3JlZXAgaW4uAAAAAAlyZWNvbmNpbGUAAAAAAAAAAAAAAA==",
            "AAAAAAAAAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
            "AAAAAAAAAAAAAAAKYWN0aXZlX2lkcwAAAAAAAAAAAAEAAAPqAAAABA==",
            "AAAAAAAAAAAAAAAKc2V0X3dyaXRlcgAAAAAAAQAAAAAAAAAGd3JpdGVyAAAAAAATAAAAAA==",
            "AAAAAAAAAVVPKDEpIGNvdmVyYWdlIGFnZ3JlZ2F0ZSAozqMgY29udHJpYnV0aW9uIG92ZXIgYWN0aXZlIGd1YXJhbnRlZXMpLCBtYWludGFpbmVkCmluY3JlbWVudGFsbHkgYnkgdGhlIGBwdXRgIGRlbHRhLiBQVVJFIHJlYWQg4oCUIE5PIHJlcXVpcmVfYXV0aCwgTk8gZXh0ZW5kX3R0bAoobWlycm9ycyB0aGUgSDIgcmUtYXVkaXQgZGVjaXNpb24gdGhhdCBgZ2V0YCBpcyBzaWRlLWVmZmVjdC1mcmVlLCBzbyBhCnNvbHZlbmN5ICJ2aWV3IiBuZXZlciBkb2VzIHN0b3JhZ2Ugd3JpdGVzKS4gYHVud3JhcF9vcigwKWAgaXMgYmVsdC1hbmQtCnN1c3BlbmRlcnMgYWxvbmdzaWRlIHRoZSBjb25zdHJ1Y3RvciBpbml0LgAAAAAAAAxyYXdfY292ZXJhZ2UAAAAAAAAAAQAAAAs=",
            "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
            "AAAAAAAAAJBPbi1jaGFpbiBzdG9yYWdlIHNjaGVtYSB2ZXJzaW9uLiBgMGAgZm9yIGEgcHJlLXZlcnNpb25pbmcgaW5zdGFuY2UgdXBncmFkZWQKaW4gYmVmb3JlIHRoaXMgYmluYXJ5ICh0aGUgdXBncmFkZSBndWFyZCB0cmVhdHMgdGhhdCBhcyBhIG1pc21hdGNoKS4AAAAOc2NoZW1hX3ZlcnNpb24AAAAAAAAAAAABAAAABA==",
            "AAAAAQAABABTdGFibGUgY29yZSBvZiBhIGd1YXJhbnRlZS4gTW9kZWwtc3BlY2lmaWMgZXh0cmFzIGxpdmUgaW4gdGhlIHBvbGljeSdzIG93bgpzdG9yYWdlLCBrZXllZCBieSBpZCDigJQgbmV2ZXIgaGVyZS4KClRXTy1MRUcgQ09WRVJBR0UgTU9ERUwgKGZpYW7Dp2EsIG5vdCBpbnN1cmFuY2UpLiBUaGUgb2JsaWdhdGlvbiBhIGZpYWRvciBiYWNrcwpoYXMgdHdvIGxlZ3MsIGVhY2ggcmVzZXJ2ZWQgYXQgc2lnbmluZyBhbmQgZHJhd24gaW5kZXBlbmRlbnRseToKCi0gREVGQVVMVCAocmVudC1hcnJlYXJzKSBsZWcg4oCUIGBtb250aHNfY292ZXJlZGAgLyBgbW9udGhzX3VzZWRgLiBUaGUgc2hvcnQKcmVudC1hcnJlYXJzIHdpbmRvdzsgcGlsb3QgYG1vbnRoc19jb3ZlcmVkID0gM2AuIERyYXduIG9uZSBtb250aCBwZXIgY2FsbCB2aWEKYFBvbGljeTo6Y292ZXJfZGVmYXVsdGAgKGBtb250aHNfdXNlZCArPSAxYCwgY2FwcGVkIGF0IGBtb250aHNfY292ZXJlZGApLiBJdHMKcmVtYWluaW5nIGNvbnRyaWJ1dGlvbiBpcyBgbW9udGhseV9hbW91bnQgKiAobW9udGhzX2NvdmVyZWQgLSBtb250aHNfdXNlZClgLgotIEVYSVQgKHByb3BlcnR5LXJlY292ZXJ5L3Jlc3RvcmF0aW9uKSBsZWcg4oCUIGBleGl0X21vbnRoc2AgLyBgZXhpdF91c2VkYC4gVGhlCmNvc3Qgb2YgcmVjb3ZlcmluZyBhbmQgcmVzdG9yaW5nIHRoZSBwcm9wZXJ0eSAoZXZpY3Rpb24sIGRhbWFnZXMsIHJlc3RvcmF0aW9uKTsKcGlsb3QgYGV4aXRfbW9udGhzID0gNmAuIERyYXduIGluIGFyYml0cmFyeSBwYXJ0aWFsIGFtb3VudHMgdmlhIGBQb2xpY3k6OmNvdmVyX2V4aXRgCnVwIHRvIHRoZSBjYXAgYG1vbnRobHlfYW1vdW50ICogZXhpdF9tb250aHNgLiBJdHMgcmVtYWluaW5nIGNvbnRyaWJ1dGlvbiBpcwpgbW9udGhseV9hbW91bnQgKiBleGl0X21vbnRocyAtIGV4aXRfdXNlZGAuCgpNYXggZXhlY3V0YWJsZSBvYmxpZ2F0aW9uIHBlciBndWFyYW50ZWUgPSBgbW9udGhseV9hbW91bnQgKiAobW9udGhzX2NvdmVyZWQgKwpleGl0X21vbnRocylgAAAAAAAAAAlHdWFyYW50ZWUAAAAAAAALAAAAAAAAAAZhY3RpdmUAAAAAAAEAAACPRVhJVCBsZWcgdGVybSBhcyBhIG11bHRpcGxlIG9mIG1vbnRobHkgcmVudCAocGlsb3QgPSA2KS4gUmVzZXJ2ZXMKYG1vbnRobHlfYW1vdW50ICogZXhpdF9tb250aHNgIG9mIGNvdmVyYWdlIGZvciBwcm9wZXJ0eSByZWNvdmVyeS9yZXN0b3JhdGlvbi4AAAAAC2V4aXRfbW9udGhzAAAAAAQAAADZQ3VtdWxhdGl2ZSB1bmRlcmx5aW5nIGRyYXduIHZpYSBgY292ZXJfZXhpdGAuIFN0YXJ0cyAwLCBvbmx5IGdyb3dzIChjYXBwZWQgYXQKYG1vbnRobHlfYW1vdW50ICogZXhpdF9tb250aHNgKS4gYGkxMjhgIHRvIG1hdGNoIGBtb250aGx5X2Ftb3VudGAgc28gdGhlIGNhcAphbmQgZXhpdC10ZXJtIGFyaXRobWV0aWMgc3RheSBwdXJlIGBpMTI4YCB3aXRoIG5vIGxvc3N5IGNhc3RzLgAAAAAAAAlleGl0X3VzZWQAAAAAAAALAAAAAAAAAAdmZWVfYnBzAAAAAAQAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAhsYW5kbG9yZAAAABMAAAAAAAAADm1vbnRobHlfYW1vdW50AAAAAAALAAAAAAAAAA5tb250aHNfY292ZXJlZAAAAAAABAAAAAAAAAALbW9udGhzX3VzZWQAAAAABAAAAAAAAAAKcGFpZF91bnRpbAAAAAAABgAAAAAAAAALcGVyaW9kX3NlY3MAAAAABg==",
            "AAAABAAAAU5FcnJvcnMgc3VyZmFjZWQgYWNyb3NzIHRoZSByZWdpc3RyeSBib3VuZGFyeS4gRGVmaW5lZCBoZXJlIChub3QgaW4gdGhlCmByZWdpc3RyeWAgY3JhdGUpIGJlY2F1c2UgdGhlIGBSZWdpc3RyeWAgdHJhaXQncyByZXR1cm4gdHlwZSByZWZlcmVuY2VzIGl0LApzbyBldmVyeSBjb25zdW1lciBvZiB0aGUgZ2VuZXJhdGVkIGBSZWdpc3RyeUNsaWVudGAgc2VlcyB0aGUgc2FtZSBzdGFibGUKYCNbY29udHJhY3RlcnJvcl1gIGNvZGVzLiBOdW1iZXJlZCBpbiB0aGUgYDJ4eGAgYmFuZCB0byBzdGF5IGNsZWFyIG9mIHRoZQpgNHh4YCBzdHJhdGVneSBjb2RlcyBpbiBgZGVmaW5kZXgtaG9kbGAuAAAAAAAAAAAADVJlZ2lzdHJ5RXJyb3IAAAAAAAAEAAAAcE5vIGd1YXJhbnRlZSBpcyBzdG9yZWQgdW5kZXIgdGhlIHJlcXVlc3RlZCBpZCAocHJldmlvdXNseSBhIGhvc3QgdHJhcApmcm9tIGBPcHRpb246OnVud3JhcGAgb24gbWlzc2luZyBzdG9yYWdlKS4AAAARR3VhcmFudGVlTm90Rm91bmQAAAAAAADIAAABY0NhbGxlciBzdXBwbGllZCBhIGd1YXJhbnRlZSBpZCBvdXRzaWRlIHRoZSBpc3N1ZWQgcmFuZ2UgKD49IE5leHRJZCkuIFRoZQpyZWdpc3RyeSBkZXJpdmVzIGlkcyBmcm9tIGl0cyBvd24gbW9ub3RvbmljIGNvdW50ZXI7IGEgd3JpdGVyIG11c3QgbmV2ZXIKZmFicmljYXRlIHRoZSBwcmltYXJ5IGtleSwgbm9yIG92ZXJ3cml0ZSBhIG5vdC15ZXQtaXNzdWVkIHNsb3QgKENXRS04NDApLgpBRERJVElWRTogbmV3IGRpc2NyaW1pbmFudDsgYEd1YXJhbnRlZU5vdEZvdW5kID0gMjAwYCBpcyB1bmNoYW5nZWQgc28gdGhlCmAjW2NvbnRyYWN0ZXJyb3JdYCBBQkkgc3RheXMgc3RhYmxlIGZvciBpbi1wbGFjZSBgdXBncmFkZSgpYC4AAAAACUludmFsaWRJZAAAAAAAAMkAAADtVGhlIFdyaXRlciByb2xlIHdhcyByZWFkIGJlZm9yZSBpdCB3YXMgc2V0LiBUaGUgY29uc3RydWN0b3Igbm93IGRlZmF1bHRzCldyaXRlcj1hZG1pbiwgc28gdGhpcyBpcyBkZWZlbnNlLWluLWRlcHRoOiBpdCBjb252ZXJ0cyB0aGUgaG9zdCB0cmFwIHRoYXQKYW4gb2xkZXIgKHByZS1kZWZhdWx0KSB1cGdyYWRlZC1pbiBpbnN0YW5jZSB3b3VsZCBoaXQgaW50byBhIHN0YWJsZSB0eXBlZAplcnJvci4gQURESVRJVkUuAAAAAAAADFdyaXRlck5vdFNldAAAAMoAAAFDYHVwZ3JhZGVgIHdhcyBjYWxsZWQgYWdhaW5zdCBhbiBvbi1jaGFpbiBzY2hlbWEgdmVyc2lvbiB0aGlzIGJpbmFyeSBkb2VzCm5vdCBleHBlY3QgKHN0YWxlIC8gbGF5b3V0LWluY29tcGF0aWJsZSBzdG9yYWdlKS4gRGlzdGluY3QgZnJvbSBgSW52YWxpZElkYApzbyBhIHJlZnVzZWQgc3RhbGUtbGF5b3V0IHVwZ3JhZGUgaXMgZGlzdGluZ3Vpc2hhYmxlIGZyb20gYSBwdXQgaWQgZXJyb3IgaW4KbG9ncy4gTGF5b3V0LWNoYW5naW5nIGVkaXRzIG11c3QgcmVkZXBsb3kgKyByZS13aXJlIHZpYSBgYm9vdHN0cmFwLnNoYCwgbm90CmB1cGdyYWRlKClgLiBBRERJVElWRS4AAAAAD1ZlcnNpb25NaXNtYXRjaAAAAADL"]), options);
        this.options = options;
    }
    fromJSON = {
        get: (this.txFromJSON),
        put: (this.txFromJSON),
        admin: (this.txFromJSON),
        writer: (this.txFromJSON),
        next_id: (this.txFromJSON),
        upgrade: (this.txFromJSON),
        reconcile: (this.txFromJSON),
        set_admin: (this.txFromJSON),
        active_ids: (this.txFromJSON),
        set_writer: (this.txFromJSON),
        raw_coverage: (this.txFromJSON),
        schema_version: (this.txFromJSON)
    };
}
