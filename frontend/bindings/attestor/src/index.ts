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
    contractId: "CBYXNYYZRD5SOBU3HP5GWV7I64GISOF5H4SWN2UTXZ7FIF6LSVII36MT",
  }
} as const


/**
 * A "luz verde" gravada on-chain. `solvent` é sempre true quando gravada (uma
 * prova inválida reverte); o front lê o frescor por `ledger`/`ts`.
 */
export interface Attestation {
  ledger: u32;
  ratio_bps: u32;
  solvent: boolean;
  ts: u64;
}

/**
 * Erros do attestor.
 */
export const AttestError = {
  0: {message:"InvalidProof"},
  1: {message:"MalformedPublicInputs"},
  2: {message:"MalformedProof"},
  /**
   * `now - nonce > WINDOW_SECS` — atestação velha demais.
   */
  3: {message:"StaleProof"},
  /**
   * `nonce > now` — atestação "do futuro".
   */
  4: {message:"ProofFromFuture"},
  /**
   * registry/vault/oráculo ainda não foram setados.
   */
  5: {message:"NotConfigured"},
  /**
   * `ratio_bps < MIN_RATIO_BPS` — faixa abaixo do piso de cobertura (100%).
   */
  6: {message:"RatioTooLow"}
}

/**
 * Erros de verificação Groth16.
 */
export const Groth16Error = {
  0: {message:"InvalidProof"},
  1: {message:"MalformedPublicInputs"},
  2: {message:"MalformedProof"}
}


/**
 * Prova Groth16 = pontos A, B, C. B (G2) em ordem Soroban c1||c0.
 */
export interface Groth16Proof {
  a: Buffer;
  b: Buffer;
  c: Buffer;
}


/**
 * Stable core of a guarantee. Model-specific extras live in the policy's own
 * storage, keyed by id — never here.
 */
export interface Guarantee {
  active: boolean;
  fee_bps: u32;
  id: u32;
  landlord: string;
  monthly_amount: i128;
  months_covered: u32;
  months_used: u32;
  paid_until: u64;
  period_secs: u64;
}

export interface Client {
  /**
   * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a attest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Verifica a prova contra o estado on-chain ao vivo e grava a atestação.
   * Públicos reconstruídos do estado real: prova feita p/ outro estado não verifica.
   * `nonce` = timestamp assinado pelo oráculo (frescor). PERMISSIONLESS.
   */
  attest: ({proof, ratio_bps, nonce}: {proof: Buffer, ratio_bps: u32, nonce: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_vault transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_vault: ({addr}: {addr: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_oracle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Fixa a pubkey EdDSA do oráculo-banco (coords Ax/Ay como field elements BE).
   * Sem isto, a peça A seria forjável (qualquer prover assinaria com a própria chave).
   */
  set_oracle: ({ax, ay}: {ax: Buffer, ay: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_registry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_registry: ({addr}: {addr: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a last_attestation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Última atestação gravada (None se nunca houve). Leitura pública p/ o front.
   */
  last_attestation: (options?: MethodOptions) => Promise<AssembledTransaction<Option<Attestation>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin}: {admin: string},
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
    return ContractClient.deploy({admin}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAI9BICJsdXogdmVyZGUiIGdyYXZhZGEgb24tY2hhaW4uIGBzb2x2ZW50YCDDqSBzZW1wcmUgdHJ1ZSBxdWFuZG8gZ3JhdmFkYSAodW1hCnByb3ZhIGludsOhbGlkYSByZXZlcnRlKTsgbyBmcm9udCBsw6ogbyBmcmVzY29yIHBvciBgbGVkZ2VyYC9gdHNgLgAAAAAAAAAAC0F0dGVzdGF0aW9uAAAAAAQAAAAAAAAABmxlZGdlcgAAAAAABAAAAAAAAAAJcmF0aW9fYnBzAAAAAAAABAAAAAAAAAAHc29sdmVudAAAAAABAAAAAAAAAAJ0cwAAAAAABg==",
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
        "AAAAAQAAAG9TdGFibGUgY29yZSBvZiBhIGd1YXJhbnRlZS4gTW9kZWwtc3BlY2lmaWMgZXh0cmFzIGxpdmUgaW4gdGhlIHBvbGljeSdzIG93bgpzdG9yYWdlLCBrZXllZCBieSBpZCDigJQgbmV2ZXIgaGVyZS4AAAAAAAAAAAlHdWFyYW50ZWUAAAAAAAAJAAAAAAAAAAZhY3RpdmUAAAAAAAEAAAAAAAAAB2ZlZV9icHMAAAAABAAAAAAAAAACaWQAAAAAAAQAAAAAAAAACGxhbmRsb3JkAAAAEwAAAAAAAAAObW9udGhseV9hbW91bnQAAAAAAAsAAAAAAAAADm1vbnRoc19jb3ZlcmVkAAAAAAAEAAAAAAAAAAttb250aHNfdXNlZAAAAAAEAAAAAAAAAApwYWlkX3VudGlsAAAAAAAGAAAAAAAAAAtwZXJpb2Rfc2VjcwAAAAAG" ]),
      options
    )
  }
  public readonly fromJSON = {
    admin: this.txFromJSON<string>,
        attest: this.txFromJSON<Result<void>>,
        upgrade: this.txFromJSON<null>,
        set_admin: this.txFromJSON<null>,
        set_vault: this.txFromJSON<null>,
        set_oracle: this.txFromJSON<null>,
        set_registry: this.txFromJSON<null>,
        last_attestation: this.txFromJSON<Option<Attestation>>
  }
}