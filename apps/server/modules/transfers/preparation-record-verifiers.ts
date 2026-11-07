import{PreparationRecordSourceAdapter}from'./preparation-record-source-adapter.ts';
import type{PoolClient}from'pg';import type{AuthenticatedIdentity}from'../access/repository.ts';import{AuthFailure}from'../access/repository.ts';
import{cloneV1,recordV1,refV1,uuidV1,type RuntimeRefV1}from'../../../../contracts/runtime/validation-v1.ts';
import{canonicalJson}from'../../../../contracts/canonical.ts';
import{analyzeTransferPreparation}from'./preparation-analysis.ts';
import{readAssignmentDraftInput}from'../assignments/assignment-input.ts';
import{contextSlotCodes}from'../context/context-input.ts';
import{permanentGaps,preparationFailure,preparationHash,readPreparationSource,type PreparationPayload,type PreparationSource}from'./preparation-record-input.ts';
type Scope={db:PoolClient;actor:AuthenticatedIdentity;projectId:string};
export interface SyntheticPreparationPorts{
 transport:'SYNTHETIC_ONLY';commandLock:(s:Scope,commandId:string)=>Promise<void>;lock:(s:Scope,parents:readonly{kind:string;id:string}[])=>Promise<void>;
 assignment:(s:Scope,ref:RuntimeRefV1,options?:{fresh:boolean;payload:PreparationPayload})=>Promise<any>;context?:(s:Scope,ref:RuntimeRefV1)=>Promise<any>;
 role?:(s:Scope,ref:RuntimeRefV1,options?:{fresh:boolean;payload:PreparationPayload})=>Promise<{projectId:string;ref:RuntimeRefV1;assignmentRef:RuntimeRefV1}>;
 binding?:(s:Scope,ref:RuntimeRefV1)=>Promise<{projectId:string;ref:RuntimeRefV1;assignmentRef:RuntimeRefV1;roleRef:RuntimeRefV1}>;
 target?:(s:Scope,ref:RuntimeRefV1)=>Promise<{projectId:string;ref:RuntimeRefV1;kind:'REGISTERED_CONNECTION';support:'UNVERIFIED'|'UNSUPPORTED'}>;
 source?:(s:Scope,source:PreparationSource)=>Promise<{projectId:string;source:PreparationSource}>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function failure(error:unknown):never{
 if(error instanceof AuthFailure){const code=error.message;if(code==='SOURCE_VERIFIER_NOT_CONNECTED')return preparationFailure(code,412);if(error.statusCode===404||['ARTIFACT_QUARANTINED','KNOWLEDGE_SENSITIVE_CONTENT_SUSPECTED','ARTIFACT_SENSITIVE_CONTENT_SUSPECTED','FORBIDDEN','PROJECT_OPERATION_DENIED'].includes(code))return preparationFailure('NOT_FOUND',404);if(code==='VERSION_CONFLICT'||code==='CONCURRENT_CHANGE')return preparationFailure(code,409);}
 return preparationFailure('PREPARATION_INTEGRITY_FAILED',503);
}
/** 합성 포트와 route의 실제 보호 클래스 adapter를 구분한다. 기본값은 닫혀 있다. */
export class PreparationRecordVerifiers{
 readonly mode:'NOT_CONNECTED'|'SYNTHETIC_ONLY'|'PROTECTED_SOURCE';readonly #ports:Readonly<SyntheticPreparationPorts>|null;readonly #adapter:PreparationRecordSourceAdapter|null;
 constructor(ports?:SyntheticPreparationPorts);
 constructor(ports:PreparationRecordSourceAdapter);
 constructor(ports?:SyntheticPreparationPorts|PreparationRecordSourceAdapter){this.#adapter=ports instanceof PreparationRecordSourceAdapter?ports:null;if(ports&&ports.transport!=='SYNTHETIC_ONLY')preparationFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);this.mode=this.#adapter?'PROTECTED_SOURCE':ports?'SYNTHETIC_ONLY':'NOT_CONNECTED';this.#ports=this.#adapter?this.#adapter:ports?Object.freeze(Object.fromEntries(Object.entries(ports).map(([k,v])=>[k,typeof v==='function'?v.bind(ports):v])) as unknown as SyntheticPreparationPorts):null;}
 connected(){if(!this.#ports||typeof this.#ports.commandLock!=='function'||typeof this.#ports.lock!=='function'||typeof this.#ports.assignment!=='function')preparationFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);}
 async #call(name:keyof SyntheticPreparationPorts,s:Scope,value:any,options?:{fresh:boolean;payload:PreparationPayload}):Promise<any>{this.connected();const fn=this.#ports![name];if(typeof fn!=='function')preparationFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);try{return cloneV1(await(fn as Function).call(this.#ports,s,cloneV1(value),options?cloneV1(options):undefined));}catch(e){return failure(e);}}
 async commandLock(s:Scope,id:string){this.connected();try{await this.#ports!.commandLock(s,id);}catch(e){return failure(e);}}
 #contextSources(c:any):PreparationSource[]{if(!c?.manifest||!Array.isArray(c.manifest.sourceBindings))return preparationFailure('PREPARATION_INTEGRITY_FAILED',503);const result:PreparationSource[]=[];for(const b of c.manifest.sourceBindings){const v=b?.selection;if(v===null)continue;const source=readPreparationSource(v?.kind==='USER_INSTRUCTION'?{kind:v.kind,ref:v.messageRef,conversationId:v.conversationId}:{kind:v?.kind,ref:v?.versionRef,conversationId:null});if(!result.some(x=>same(x,source)))result.push(source);}return result;}
 async lock(s:Scope,p:PreparationPayload){this.connected();const parents=[{kind:'ASSIGNMENT',id:p.assignmentRef.id},...(['contextRef','roleRef','oldBindingRef','targetConnectionRef'] as const).flatMap(k=>p[k]?[{kind:k,id:p[k]!.id,version:p[k]!.version}]:[])];if(p.contextRef){const c=this.#adapter?await this.#adapter.discoverContext(s,p.contextRef):await this.#call('context',s,p.contextRef);for(const source of this.#contextSources(c)){parents.push({kind:source.kind,id:source.ref.id});if(source.conversationId)parents.push({kind:'CONVERSATION',id:source.conversationId});}}const unique=[...new Map(parents.map(v=>[v.kind+':'+v.id,v])).values()].sort((a,b)=>(a.kind+':'+a.id).localeCompare(b.kind+':'+b.id));try{await this.#ports!.lock(s,Object.freeze(unique.map(v=>Object.freeze(v))));}catch(e){return failure(e);}}
 async derive(s:Scope,p:PreparationPayload,fresh:boolean){
  try{
   const a=await this.#call('assignment',s,p.assignmentRef,{fresh,payload:p});if(!a||a.projectId!==s.projectId)return preparationFailure('NOT_FOUND',404);if(!same(a.ref,p.assignmentRef)||preparationHash(a.snapshot)!==p.assignmentRef.contentHash)return preparationFailure('VERSION_CONFLICT',409);if(fresh&&(!refV1(a.currentDraftRef)||!same(a.currentDraftRef,a.snapshot?.draftRef)))return preparationFailure('VERSION_CONFLICT',409);
   const c=p.contextRef?await this.#call('context',s,p.contextRef):null;if(c&&(c.projectId!==s.projectId||!same(c.ref,p.contextRef)))return preparationFailure(c.projectId!==s.projectId?'NOT_FOUND':'VERSION_CONFLICT',c.projectId!==s.projectId?404:409);
   if(c&&(!same(c.manifest?.assignmentRef,p.assignmentRef)||!same(c.manifest?.baselineRefs,a.snapshot.definition.baselineRefs)||!same(c.manifest?.budgetRef,a.snapshot.definition.budgetRef)))return preparationFailure('VERSION_CONFLICT',409);
   const analysis=analyzeTransferPreparation({transport:'SYNTHETIC_ONLY',projectId:s.projectId,assignment:{projectId:a.projectId,ref:a.ref,snapshot:a.snapshot,observedAt:a.observedAt},context:c,checkpointInput:null,roleRef:null,oldBindingRef:null,target:null,reason:p.reason});
   const definition=readAssignmentDraftInput({baseRef:null,definition:a.snapshot.definition,reason:a.snapshot.reason}).input.definition;
   if(p.roleRef){const r=await this.#call('role',s,p.roleRef,{fresh,payload:p});if(r.projectId!==s.projectId)return preparationFailure('NOT_FOUND',404);if(!same(r.ref,p.roleRef)||!same(r.assignmentRef,p.assignmentRef))return preparationFailure('VERSION_CONFLICT',409);}
   if(p.oldBindingRef){const r=await this.#call('binding',s,p.oldBindingRef);if(r.projectId!==s.projectId)return preparationFailure('NOT_FOUND',404);if(!same(r.ref,p.oldBindingRef)||!same(r.assignmentRef,p.assignmentRef)||!same(r.roleRef,p.roleRef))return preparationFailure('VERSION_CONFLICT',409);}
   let unsupported=false;if(p.targetConnectionRef){const r=await this.#call('target',s,p.targetConnectionRef);if(r.projectId!==s.projectId)return preparationFailure('NOT_FOUND',404);if(!same(r.ref,p.targetConnectionRef))return preparationFailure('VERSION_CONFLICT',409);if(r.kind!=='REGISTERED_CONNECTION'||!['UNVERIFIED','UNSUPPORTED'].includes(r.support))return preparationFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);unsupported=r.support==='UNSUPPORTED';}
   const sourceRefs=c?this.#contextSources(c):[];for(const source of sourceRefs){const r=await this.#call('source',s,source);if(r.projectId!==s.projectId||!same(r.source,source))return preparationFailure('NOT_FOUND',404);}
   const requiredContext=contextSlotCodes.map((code,i)=>({code,state:analysis.requiredContext[i]!.state as 'NOT_COLLECTED'|'MISSING_OR_EXCLUDED'|'METADATA_ONLY'})),gaps:string[]=[...permanentGaps,'TARGET_CAPABILITIES_UNVERIFIED'];
   if(!p.roleRef)gaps.push('ROLE_NOT_SELECTED');if(!p.oldBindingRef)gaps.push('OLD_BINDING_NOT_COLLECTED');if(!p.targetConnectionRef)gaps.push('TARGET_NOT_SELECTED');if(unsupported)gaps.push('TARGET_UNSUPPORTED');
   if(!c)gaps.push('CONTEXT_NOT_COLLECTED');else{if(requiredContext.some(r=>r.state==='MISSING_OR_EXCLUDED'))gaps.push('CONTEXT_REQUIRED_MISSING');if(c.manifest.items.some((r:any)=>r.includedState==='EXCLUDED'))gaps.push('CONTEXT_EXCLUDED');if(c.manifest.items.some((r:any)=>r.includedState==='REDACTED'))gaps.push('CONTEXT_REDACTED');if(c.currentCheck.state!=='MATCHED_METADATA'||c.currentCheck.issues.length)gaps.push('CONTEXT_CURRENTNESS_UNVERIFIED');}
   return{baselineRefs:cloneV1(definition.baselineRefs),budgetRef:cloneV1(definition.budgetRef),sourceRefs,requiredContext,gaps};
  }catch(e){return failure(e);}
 }
}
