import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readAssignmentDraftInput} from '../assignments/assignment-input.ts';
import {prepareCheckpointDraft} from '../checkpoints/checkpoint-input.ts';
import {contextSlotCodes,readContextPreparationInput,type ContextPreparationInput,type ContextSourceSelection} from '../context/context-input.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
function fail():never{throw Error('TRANSFER_PREPARATION_INPUT_INVALID');}
const text=(v:unknown):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=20000&&v.isWellFormed()&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v);
function safe(v:unknown):void{if(typeof v==='string'){assertKnowledgeTextSafe(v);if(/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/.test(v))fail();}else if(v&&typeof v==='object')for(const value of Object.values(v))safe(value);}
function refs(v:unknown){return arrayV1(v,200)&&v.every(refV1)&&new Set(v.map(canonicalJson)).size===v.length;}
function bodyRef(v:unknown){return recordV1(v,['artifactId','bytes','contentHash','mediaType'])&&uuidV1(v.artifactId)&&Number.isSafeInteger(v.bytes)&&v.bytes>=0&&v.bytes<=2*1024*1024&&hashV1(v.contentHash)&&['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(v.mediaType);}
function flagless(v:any){return v.ready===false&&v.executionAuthorized===false&&v.dispatchPerformed===false;}
/** 내부 합성 분석만 반환한다. prepareTransfer 연산·영속 manifest·동결·현재 권한/안전 판정이 아니다. */
export function analyzeTransferPreparation(raw:unknown){
 try{
  if(!recordV1(raw,['transport','projectId','assignment','context','checkpointInput','roleRef','oldBindingRef','target','reason'])||raw.transport!=='SYNTHETIC_ONLY'||!uuidV1(raw.projectId)||!text(raw.reason)||Buffer.byteLength(canonicalJson(raw))>2*1024*1024)fail();
  const v=cloneV1(raw),a=v.assignment;safe(v);
  if(!recordV1(a,['projectId','ref','snapshot','observedAt'])||a.projectId!==v.projectId||!refV1(a.ref)||!isoV1(a.observedAt)||hash(a.snapshot)!==a.ref.contentHash)fail();
  const s=a.snapshot;if(!recordV1(s,['draftRef','definition','reviewRefs','reason','confirmedBy','confirmedAt','contentConfirmed','readinessIssues','ready','executionAuthorized','dispatchPerformed'])||!refV1(s.draftRef)||!refs(s.reviewRefs)||!s.reviewRefs.length||!text(s.reason)||!recordV1(s.confirmedBy,['kind','userId'])||s.confirmedBy.kind!=='HUMAN'||!uuidV1(s.confirmedBy.userId)||!isoV1(s.confirmedAt)||s.confirmedAt>a.observedAt||s.contentConfirmed!==true||!arrayV1(s.readinessIssues,200)||!flagless(s))fail();
  const definition=readAssignmentDraftInput({baseRef:null,definition:s.definition,reason:s.reason}).input.definition;
  if(v.roleRef!==null&&!refV1(v.roleRef)||v.oldBindingRef!==null&&!refV1(v.oldBindingRef))fail();
  if(v.target!==null&&(!recordV1(v.target,['connectionRef','support','reason'])||!refV1(v.target.connectionRef)||!['UNVERIFIED','UNSUPPORTED'].includes(v.target.support)||!text(v.target.reason)))fail();
  const gaps=['STOP_UNVERIFIED','WRITER_RECLAIM_UNVERIFIED','SOURCE_DIFFS_UNCOLLECTED','RECORD_DURABILITY_UNVERIFIED','SOURCE_AUTHORIZATION_UNVERIFIED','TARGET_CAPABILITIES_UNVERIFIED','UNDERSTANDING_UNREVIEWED','TRANSFER_CONFIRMATION_UNVERIFIED'];
  if(!v.roleRef)gaps.push('ROLE_NOT_SELECTED');if(!v.oldBindingRef)gaps.push('OLD_BINDING_NOT_COLLECTED');
  if(!v.target)gaps.push('TARGET_NOT_SELECTED');else if(v.target.support==='UNSUPPORTED')gaps.push('TARGET_UNSUPPORTED');
  type Required={code:string;state:string;sourceRefs:unknown[];missingItemIds:string[];excludedItemIds:string[]};
  let requiredContext:Required[]=contextSlotCodes.map(code=>({code,state:'NOT_COLLECTED',sourceRefs:[],missingItemIds:[],excludedItemIds:[]}));
  if(v.context===null)gaps.push('CONTEXT_NOT_COLLECTED');
  else{
   const c=v.context,m=c?.manifest;
   if(!recordV1(c,['projectId','ref','manifest','currentCheck','ready','executionAuthorized','dispatchPerformed','observedAt'])||c.projectId!==v.projectId||!refV1(c.ref)||c.ref.version!==1||!isoV1(c.observedAt)||!flagless(c)||hash(m)!==c.ref.contentHash||!recordV1(c.currentCheck,['state','issues'])||!['MATCHED_METADATA','CHANGED','UNAVAILABLE'].includes(c.currentCheck.state)||!arrayV1(c.currentCheck.issues,200)||!c.currentCheck.issues.every(text))fail();
   if(!recordV1(m,['id','projectId','version','preparationInput','assignmentRef','baselineRefs','purposeRef','constitutionRef','latestInstructionRefs','currentPositionRef','items','sourceBindings','missingRequired','excluded','deliveryPlan','budgetRef','unverified','sourceAuthorizationVerified','budgetVerified','ready','executionAuthorized','dispatchPerformed'])||m.id!==c.ref.id||m.projectId!==v.projectId||m.version!==1||!same(m.assignmentRef,a.ref)||!refs(m.baselineRefs)||!arrayV1(m.items,207)||!arrayV1(m.sourceBindings,207)||m.items.length!==m.sourceBindings.length||!arrayV1(m.missingRequired,207)||!arrayV1(m.excluded,207)||!arrayV1(m.unverified,200)||!m.unverified.every(text)||!flagless(m)||m.sourceAuthorizationVerified!==false||m.budgetVerified!==false)fail();
   const input=readContextPreparationInput(m.preparationInput);if(!same(input.assignmentRef,a.ref)||!same(input.budgetRef,m.budgetRef)||!same(m.baselineRefs,definition.baselineRefs)||!same(m.budgetRef,definition.budgetRef))fail();
   const expected=input.slots.flatMap<{id:string;slot:ContextPreparationInput['slots'][number];selection:ContextSourceSelection|null}>(slot=>slot.sources.length?slot.sources.map((selection,index)=>({id:slot.code+'_'+(index+1),slot,selection})):[{id:slot.code,slot,selection:null}]);
   if(expected.length!==m.items.length||new Set(m.items.map((i:any)=>i?.itemId)).size!==m.items.length||!recordV1(m.deliveryPlan,['state','parts','multipartRequired','limits'])||m.deliveryPlan.state!=='PREPARATION_ONLY'||!same(m.deliveryPlan.limits,input.limits)||!arrayV1(m.deliveryPlan.parts,input.limits.maxParts)||m.deliveryPlan.multipartRequired!==(m.deliveryPlan.parts.length>1))fail();
   let usedParts=0;
   for(const [index,e] of expected.entries()){
    const item=m.items[index],binding=m.sourceBindings[index],source=e.selection===null?null:e.selection.kind==='USER_INSTRUCTION'?e.selection.messageRef:e.selection.versionRef;
    if(!recordV1(item,['itemId','category','required','sourceRef','sourceHash','reason','includedState','deliveryParts','issue'])||item.itemId!==e.id||item.category!==e.slot.code||item.required!==true||!same(item.sourceRef,source)||item.sourceHash!==(source?.contentHash??null)||item.reason!==e.slot.reason||!['INCLUDED','MISSING','REDACTED','EXCLUDED'].includes(item.includedState)||!arrayV1(item.deliveryParts,input.limits.maxParts)||item.issue!==null&&!text(item.issue)||!recordV1(binding,['itemId','selection','bodyRef','sourceState'])||binding.itemId!==item.itemId||!same(binding.selection,e.selection)||!text(binding.sourceState)||binding.bodyRef!==null&&!bodyRef(binding.bodyRef))fail();
    if(item.includedState==='INCLUDED'&&(!source||!binding.bodyRef||item.issue!==null||!item.deliveryParts.length)||item.includedState!=='INCLUDED'&&item.deliveryParts.length)fail();
    let offset=0;
    for(const [local,partId] of item.deliveryParts.entries()){
     const p=m.deliveryPlan.parts[usedParts];if(!recordV1(p,['partId','itemId','sourceRef','bodyRef','order','byteOffset','utf8Bytes','contentHash'])||p.partId!==partId||partId!==item.itemId+':'+(local+1)||p.itemId!==item.itemId||!same(p.sourceRef,source)||!same(p.bodyRef,binding.bodyRef)||p.order!==usedParts+1||p.byteOffset!==offset||!Number.isSafeInteger(p.utf8Bytes)||p.utf8Bytes<1||p.utf8Bytes>input.limits.maxPartBytes||!hashV1(p.contentHash))fail();
     offset+=p.utf8Bytes;usedParts++;
    }
    if(item.includedState==='INCLUDED'&&offset!==(binding.bodyRef as any).bytes)fail();
   }
   if(usedParts!==m.deliveryPlan.parts.length||!same(m.missingRequired,m.items.filter((i:any)=>i.includedState!=='INCLUDED').map((i:any)=>i.itemId))||!same(m.excluded,m.items.filter((i:any)=>i.includedState==='EXCLUDED').map((i:any)=>i.itemId)))fail();
   requiredContext=contextSlotCodes.map(code=>{const items=m.items.filter((i:any)=>i.category===code),missing=items.filter((i:any)=>i.includedState!=='INCLUDED'),excluded=items.filter((i:any)=>i.includedState==='EXCLUDED');return{code,state:missing.length?'MISSING_OR_EXCLUDED':'METADATA_ONLY',sourceRefs:items.filter((i:any)=>i.sourceRef!==null).map((i:any)=>cloneV1(i.sourceRef)),missingItemIds:missing.map((i:any)=>i.itemId),excludedItemIds:excluded.map((i:any)=>i.itemId)};});
   for(const r of requiredContext)if(r.missingItemIds.length)gaps.push('CONTEXT_REQUIRED_MISSING:'+r.code);
   if(m.excluded.length)gaps.push('CONTEXT_EXCLUDED_SOURCES');if(m.items.some((i:any)=>i.includedState==='REDACTED'))gaps.push('CONTEXT_REDACTED_SOURCES');
   if(c.currentCheck.state!=='MATCHED_METADATA'||c.currentCheck.issues.length)gaps.push('CONTEXT_CURRENTNESS_UNVERIFIED');
   gaps.push('CONTEXT_ORIGINALS_UNCOLLECTED',...m.unverified);
  }
  let checkpointClaims=null;
  if(v.checkpointInput===null)gaps.push('CHECKPOINT_NOT_COLLECTED');
  else{const p=prepareCheckpointDraft(a,v.checkpointInput);checkpointClaims={...p.input.state,sourceAssurance:'CALLER_DECLARED_STATE_NOT_VERIFIED' as const};gaps.push(...p.gaps);}
  return{analysisKind:'UNSAVED_SYNTHETIC_TRANSFER_PREPARATION' as const,transport:'SYNTHETIC_ONLY' as const,projectId:v.projectId,assignmentRef:cloneV1(a.ref),contextRef:v.context?cloneV1(v.context.ref):null,roleRef:cloneV1(v.roleRef),oldBindingRef:cloneV1(v.oldBindingRef),target:cloneV1(v.target),baselineRefs:cloneV1(definition.baselineRefs),requiredContext,checkpointClaims,gaps:[...new Set(gaps)],sourceAssurance:'CALLER_INPUT_HASH_NOT_AUTHORITY' as const,ready:false as const,manifestStored:false as const,bindingFrozen:false as const,sourceAuthorizationVerified:false as const,writerReleaseVerified:false as const,resumeAuthorized:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
 }catch(error){if(error instanceof Error&&/^TRANSFER_PREPARATION_[A-Z_]+$/.test(error.message))throw error;return fail();}
}
