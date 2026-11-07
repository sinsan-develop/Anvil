import {AuthFailure} from '../access/repository.ts';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {readSourceDeclaration,type SourceDeclaration} from '../projects/source-declaration.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
export const sourceRootOperations=['saveSourceRoot','reviseSourceRoot','revokeSourceRoot'] as const;
export type SourceRootOperation=typeof sourceRootOperations[number];
export interface RootDeclaration extends SourceDeclaration{connectorId:string|null}
export interface SourceRootInput{operation:SourceRootOperation;baseRef:VersionRef|null;reason:string;declaration?:RootDeclaration}
export interface SourceRootSnapshot{declaration:RootDeclaration;status:'DECLARED'|'REVOKED';authority:'USER_DECLARED';readiness:'UNVERIFIED';reason:string}
const exact=(v:unknown,keys:string):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
const reason=(v:unknown):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=20000&&v.isWellFormed()&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
export function readRootDeclaration(value:unknown):RootDeclaration{
 if(!exact(value,'hostLabel,displayName,pathHint,reason,connectorId')||value.connectorId!==null&&!isVersionRef({id:value.connectorId,version:1,contentHash:'0'.repeat(64)})||!reason(value.reason))throw new AuthFailure('SOURCE_ROOT_INPUT_INVALID',422);
 const {connectorId,...decl}=value;return{...readSourceDeclaration(decl),connectorId:connectorId as string|null};
}
export function readSourceRootInput(operation:string,value:unknown):SourceRootInput{
 try{canonicalJson(value);}catch{throw new AuthFailure('SOURCE_ROOT_INPUT_INVALID',422);}
 const revoke=operation==='revokeSourceRoot';
 if(!(sourceRootOperations as readonly string[]).includes(operation)||!exact(value,revoke?'baseRef,reason':'baseRef,reason,declaration')||!reason(value.reason)||(operation==='saveSourceRoot'?value.baseRef!==null:!isVersionRef(value.baseRef)))throw new AuthFailure('SOURCE_ROOT_INPUT_INVALID',422);
 if(inspectArtifact(Buffer.from(value.reason,'utf8')).state==='SUSPECTED')throw new AuthFailure('SOURCE_ROOT_SENSITIVE_CONTENT_SUSPECTED',412);
 return{operation:operation as SourceRootOperation,baseRef:value.baseRef===null?null:structuredClone(value.baseRef) as VersionRef,reason:value.reason,...(revoke?{}:{declaration:readRootDeclaration(value.declaration)})};
}
export function sourceRootSnapshot(input:SourceRootInput,oldDeclaration?:RootDeclaration):SourceRootSnapshot{
 const declaration=input.operation==='revokeSourceRoot'?oldDeclaration:input.declaration;
 if(!declaration)throw new AuthFailure('SOURCE_ROOT_BASE_REQUIRED',409);
 return{declaration:readRootDeclaration(declaration),status:input.operation==='revokeSourceRoot'?'REVOKED':'DECLARED',authority:'USER_DECLARED',readiness:'UNVERIFIED',reason:input.reason};
}
