import {AuthFailure} from '../access/repository.ts';
export interface InstallationCatalogEntry{slotId:string;displayName:string;purpose:'BACKUP_TARGET'|'KEY_VAULT';absoluteRoot:string;expectedRootIdentity:Readonly<{device:string;inode:string}>;capacityBytes:number;profileVersion:number}
export interface InstallationCatalogOptions{installationId?:string;entries?:readonly InstallationCatalogEntry[]}
/** 안전 handle adapter는 미구현이다. 설정 문자열/realpath만으로 실사용 가능으로 판정하지 않는다. */
export class InstallationResourceCatalog{
 readonly #configured:boolean;#disposed:Promise<void>|null=null;
 constructor(options:InstallationCatalogOptions={}){this.#configured=!!options.installationId&&!!options.entries?.length;}
 list(kind:unknown){if(kind!=='TARGET'&&kind!=='ENCRYPTION_KEY')throw new AuthFailure('INPUT_INVALID',400);return {state:this.#configured&&!this.#disposed?'UNVERIFIED' as const:'UNCONFIGURED' as const,items:[]};}
 async prepareSlot(_slotId:string,_kind:unknown):Promise<never>{throw new AuthFailure('RESOURCE_UNVERIFIED',412);}
 dispose():Promise<void>{return this.#disposed??=Promise.resolve();}
}

/** 설치 service 내부 주입 경계. 실 safe handle 공급자는 아직 연결하지 않는다. */
export interface InstallationResourceCatalogPort{list(kind:'TARGET'|'ENCRYPTION_KEY'):any|Promise<any>;prepareSlot(slotId:string,kind:unknown):Promise<unknown>;dispose?():void|Promise<void>}

export interface InstallationFileIdentity{device:string;inode:string}
export interface InstallationRootInspection{identity:InstallationFileIdentity;kind:string;symlink:boolean;uid:number;gid:number;mode:string;availableBytes:number;availableInodes:number}
export interface InstallationProbeInspection{identity:InstallationFileIdentity;kind:string;symlink:boolean;uid:number;gid:number;mode:string;bytes:number}
export interface InstallationProbeHandle{sync():Promise<void>;read(maxBytes:number):Promise<Uint8Array>;stat():Promise<InstallationProbeInspection>;close():Promise<void>}
export interface InstallationRootHandle{inspect():Promise<InstallationRootInspection>;create(input:{fileId:string;bytes:Uint8Array;exclusive:true;noFollow:true;mode:number}):Promise<InstallationProbeHandle>;remove(file:InstallationProbeHandle,expected:InstallationFileIdentity):Promise<void>;fsyncParent():Promise<void>}
export interface PreparedInstallationSlot{slotId:string;installationId:string;profileRef:{id:string;version:number;contentHash:string};expectedRootIdentity:InstallationFileIdentity;ownerUid:number;rootHandle:InstallationRootHandle}
/** 실제 adapter를 제공하지 않는 불변 vault 내부 포트. publish는 기존 파일 교체를 허용하지 않는다. */
export interface InstallationVaultRootHandle extends InstallationRootHandle{publish(file:InstallationProbeHandle,expected:InstallationFileIdentity,input:{fileId:string;exclusive:true;noFollow:true}):Promise<void>;open(fileId:string,input:{noFollow:true}):Promise<InstallationProbeHandle>}
export interface PreparedInstallationKeySlot extends PreparedInstallationSlot{rootHandle:InstallationVaultRootHandle}
