import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {copyCommonSetupData,readCommonSetupDefinition,setupRecord,setupRef,setupText,setupUuid,type CommonSetupKind,type CommonSetupDefinition,type SetupRef} from '../../../../contracts/runtime/user-common-setup-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
export type CommonSetupCommand={schemaVersion:1;commandId:string;clientId:string;operation:'saveCommonSetupDefinition'|'revokeCommonSetupDefinition';targetId:string|null;expectedVersion:number;payload:any};
export const commonSetupHash=(value:unknown)=>contentHash(canonicalJson(value));
export function assertCommonSetupSafe(value:unknown){
 const raw=canonicalJson(value);if(Buffer.byteLength(raw)>2097152)throw new AuthFailure('COMMON_SETUP_INPUT_INVALID',422);
 const sensitive=(v:any):boolean=>typeof v==='string'?inspectArtifact(Buffer.from(v,'utf8')).state==='SUSPECTED':!!v&&typeof v==='object'&&Object.entries(v).some(([k,x])=>/^(password|passwd|api[_-]?key|access[_-]?token|token|secret)$/i.test(k)||sensitive(x));
 if(sensitive(value)||inspectArtifact(Buffer.from(raw,'utf8')).state==='SUSPECTED')throw new AuthFailure('COMMON_SETUP_SENSITIVE_CONTENT_SUSPECTED',412);
}
export function readCommonSetupCommand(raw:unknown):CommonSetupCommand{
 try{const v=copyCommonSetupData(raw);if(!setupRecord(v,['schemaVersion','commandId','clientId','operation','targetId','expectedVersion','payload'])||v.schemaVersion!==1||!setupUuid(v.commandId)||!setupUuid(v.clientId)||v.targetId!==null&&!setupUuid(v.targetId)||!Number.isSafeInteger(v.expectedVersion)||v.expectedVersion<0||v.expectedVersion>=Number.MAX_SAFE_INTEGER)throw Error();
 if(v.operation==='saveCommonSetupDefinition'){if(!setupRecord(v.payload,['kind','definition','reason'])||!setupText(v.payload.reason,20000)||v.targetId===null&&v.expectedVersion!==0||v.targetId!==null&&v.expectedVersion<1)throw Error();v.payload.definition=readCommonSetupDefinition(v.payload.kind,v.payload.definition);}
 else if(v.operation==='revokeCommonSetupDefinition'){if(!setupRecord(v.payload,['targetRef','reason'])||!setupRef(v.payload.targetRef)||!setupText(v.payload.reason,20000)||v.targetId!==v.payload.targetRef.id||v.expectedVersion!==v.payload.targetRef.version)throw Error();}
 else throw Error();assertCommonSetupSafe(v);return v as unknown as CommonSetupCommand;
 }catch(error){if(error instanceof AuthFailure)throw error;throw new AuthFailure('COMMON_SETUP_INPUT_INVALID',422);}
}
