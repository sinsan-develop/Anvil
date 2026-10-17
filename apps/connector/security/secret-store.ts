import {invokeProtectedHost} from '../runtime/windows-host.ts';
import type {ProtectedHostOptions} from '../runtime/windows-host.ts';
import {proofBytes} from '../../server/modules/connections/registration-proof.ts';
import type {HostProofPayload} from '../../server/modules/connections/registration-proof.ts';

interface PublicHostKey {keyId:string;publicKeySpki:string;fingerprint:string}
export class WindowsProtectedStore {
 readonly options:ProtectedHostOptions;
 constructor(options:ProtectedHostOptions){this.options={...options};}
 async createHostKey(keyId:string):Promise<PublicHostKey>{return this.#keyResult(await invokeProtectedHost(this.options,{operation:'CREATE_KEY',keyId}),keyId);}
 async publicHostKey(keyId:string):Promise<PublicHostKey>{return this.#keyResult(await invokeProtectedHost(this.options,{operation:'PUBLIC_KEY',keyId}),keyId);}
 async signHostProof(keyId:string,payload:HostProofPayload):Promise<{signature:string}>{proofBytes(payload);const value=await invokeProtectedHost(this.options,{operation:'SIGN_PROOF',keyId,payload});if(typeof value.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(value.signature))throw Error('PROTECTED_STORE_FAILED');return {signature:value.signature};}
 async verifyPublicProof(publicKeySpki:string,signature:string,payload:HostProofPayload):Promise<boolean>{proofBytes(payload);const value=await invokeProtectedHost(this.options,{operation:'VERIFY_PROOF',publicKeySpki,signature,payload});if(typeof value.valid!=='boolean')throw Error('PROTECTED_STORE_FAILED');return value.valid;}
 async storeCredential(credentialId:string,token:string):Promise<{credentialId:string;digest:string}>{const value=await invokeProtectedHost(this.options,{operation:'STORE_CREDENTIAL',credentialId,token});if(value.credentialId!==credentialId||typeof value.digest!=='string'||!/^[0-9a-f]{64}$/.test(value.digest))throw Error('PROTECTED_STORE_FAILED');return {credentialId,digest:value.digest};}
 async credentialMatches(credentialId:string,digest:string):Promise<boolean>{const value=await invokeProtectedHost(this.options,{operation:'CREDENTIAL_MATCHES',credentialId,digest});if(typeof value.matches!=='boolean')throw Error('PROTECTED_STORE_FAILED');return value.matches;}
 #keyResult(value:Record<string,unknown>,keyId:string):PublicHostKey{if(value.keyId!==keyId||typeof value.publicKeySpki!=='string'||typeof value.fingerprint!=='string'||!/^[0-9a-f]{64}$/.test(value.fingerprint))throw Error('PROTECTED_STORE_FAILED');return {keyId,publicKeySpki:value.publicKeySpki,fingerprint:value.fingerprint};}
}
