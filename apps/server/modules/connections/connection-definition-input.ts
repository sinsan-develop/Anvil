import {AuthFailure} from '../access/repository.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1,cloneV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
export const definitionKeys=['label','toolProduct','toolVersion','adapterKind','connectorId','accountRef','modelOptions','environmentRef','policyRef','capabilityReportRef'] as const;
export interface DefinitionInput{label:string;toolProduct:string;toolVersion:string;adapterKind:string;connectorId:string|null;accountRef:RuntimeRefV1|null;modelOptions:Record<string,unknown>;environmentRef:RuntimeRefV1|null;policyRef:RuntimeRefV1;capabilityReportRef:RuntimeRefV1|null}
export interface ConnectionDefinition extends DefinitionInput{id:string;version:number;status:'NOT_READY'}
export const definitionHash=(v:unknown)=>contentHash(canonicalJson(v));
export function definitionFailure(code='CONNECTION_DEFINITION_INPUT_INVALID',status=422):never{throw new AuthFailure(code,status);}
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.isWellFormed()&&!!v.trim()&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v);
// 동일한 알려진 비밀 할당 표식을 JSON key/value에서도 대조한다. 완전 탐지가 아니다.
function sensitive(v:unknown):boolean{if(typeof v==='string')return inspectArtifact(Buffer.from(v)).state==='SUSPECTED';if(v&&typeof v==='object')return Object.entries(v).some(([k,x])=>/^(password|passwd|api[_-]?key|access[_-]?token|token|secret)$/i.test(k)||sensitive(x));return false;}
export function readDefinitionInput(v:unknown):DefinitionInput{
 try{if(!recordV1(v,definitionKeys)||!['label','toolProduct','toolVersion','adapterKind'].every(k=>text(v[k],200))||v.connectorId!==null&&!uuidV1(v.connectorId)||!['accountRef','environmentRef','capabilityReportRef'].every(k=>v[k]===null||refV1(v[k]))||!refV1(v.policyRef)||!v.modelOptions||typeof v.modelOptions!=='object'||Array.isArray(v.modelOptions))return definitionFailure();
 const raw=canonicalJson(v);if(Buffer.byteLength(raw,'utf8')>2097152)return definitionFailure();if(sensitive(v)||inspectArtifact(Buffer.from(raw,'utf8')).state==='SUSPECTED')return definitionFailure('CONNECTION_SENSITIVE_CONTENT_SUSPECTED',412);return cloneV1(v) as DefinitionInput;
 }catch(e){if(e instanceof AuthFailure)throw e;return definitionFailure();}
}
export function readDefinitionPayload(v:unknown){if(!recordV1(v,['definition','reason'])||!text(v.reason,20000))return definitionFailure();const definition=readDefinitionInput(v.definition);const raw=canonicalJson(v);if(Buffer.byteLength(raw)>2097152)return definitionFailure();if(inspectArtifact(Buffer.from(raw)).state==='SUSPECTED')return definitionFailure('CONNECTION_SENSITIVE_CONTENT_SUSPECTED',412);return {definition,reason:v.reason};}
export function readStoredDefinition(v:unknown):ConnectionDefinition{try{if(!recordV1(v,['id','version','status',...definitionKeys])||!uuidV1(v.id)||v.version!==1||v.status!=='NOT_READY')return definitionFailure('CONNECTION_DEFINITION_INTEGRITY_FAILED',503);const fields=Object.fromEntries(definitionKeys.map(k=>[k,v[k]]));return{id:v.id,version:1,status:'NOT_READY',...readDefinitionInput(fields)};}catch{return definitionFailure('CONNECTION_DEFINITION_INTEGRITY_FAILED',503);}}
