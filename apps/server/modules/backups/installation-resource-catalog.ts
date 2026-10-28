import {AuthFailure} from '../access/repository.ts';
export interface InstallationCatalogEntry{slotId:string;displayName:string;purpose:'BACKUP_TARGET'|'KEY_VAULT';absoluteRoot:string;expectedRootIdentity:Readonly<{device:string;inode:string}>;capacityBytes:number;profileVersion:number}
export interface InstallationCatalogOptions{installationId?:string;entries?:readonly InstallationCatalogEntry[]}
/** 안전 handle adapter는 미구현이다. 설정 문자열/realpath만으로 실사용 가능으로 판정하지 않는다. */
export class InstallationResourceCatalog{
 readonly #configured:boolean;
 constructor(options:InstallationCatalogOptions={}){this.#configured=!!options.installationId&&!!options.entries?.length;}
 list(kind:unknown){if(kind!=='TARGET'&&kind!=='ENCRYPTION_KEY')throw new AuthFailure('INPUT_INVALID',400);return {state:this.#configured?'UNVERIFIED' as const:'UNCONFIGURED' as const,items:[]};}
 async prepareSlot(_slotId:string,_kind:unknown):Promise<never>{throw new AuthFailure('RESOURCE_UNVERIFIED',412);}
}
