import type {PoolClient} from 'pg';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {cloneV1,recordV1,refV1,uuidV1,hashV1} from '../../../../contracts/runtime/validation-v1.ts';
import {validateProviderSessionClaim} from '../../../../contracts/runtime/provider-session-claim-v1.ts';
import {AccessRepository,AuthFailure} from '../access/repository.ts';
import {readOwnershipInstructionHistory} from './ownership-instruction-history.ts';
import {readOwnershipPreparationReceiptBasis} from './ownership-preparation-receipt.ts';
import {SyntheticPgInstructionQueueStore} from './execution-instruction-store.ts';
import {BoundPgProviderClaimHistoryStore} from './provider-session-claim-history-store.ts';
import {SyntheticProviderClaimHistory,type ProviderClaimReceiptQuery} from './provider-session-claim-history.ts';
import {SyntheticPgProviderClaimJournal} from './provider-session-claim-journal.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=():never=>{throw new AuthFailure('OWNERSHIP_PARENT_THREAD_HISTORY_UNAVAILABLE',412);};
/** 동일 caller 인증 transaction의 원 parent 역사 조회. 실제 raw THREAD/handle을
 * 반환하지 않으며 현재 parent/실행/OS·binding 발급 권위를 부여하지 않는다. */
export async function readOwnershipParentThreadHistory(db:PoolClient,access:AccessRepository,token:string,csrf:string,rawScope:unknown,rawPreparationRef:unknown,rawSelection:unknown){
 try{
  const scope=cloneV1(rawScope),preparationRef=cloneV1(rawPreparationRef),selection=cloneV1(rawSelection);
  if(!recordV1(selection,['instruction','parentQuery','parentRef'])||!refV1(selection.parentRef)||selection.parentRef.version!==1)return fail();
  const q=selection.parentQuery;
  if(!recordV1(q,['projectId','agentSessionId','executionId','generation','commandId','kind','requestIdDigest','claimHash'])||!['projectId','agentSessionId','executionId','commandId'].every(k=>uuidV1(q[k]))||!Number.isSafeInteger(q.generation)||q.generation<1||q.kind!=='THREAD'||!hashV1(q.requestIdDigest)||q.claimHash!==selection.parentRef.contentHash)return fail();
  const first=await readOwnershipInstructionHistory(db,access,token,csrf,scope,preparationRef,selection.instruction);
  if(q.projectId!==first.scope.projectId||q.executionId!==first.scope.executionId||q.generation!==first.scope.executionGeneration)return fail();
  const actor=await access.authenticateInTransaction(db,token,csrf),commands=new SyntheticPgInstructionQueueStore({transport:'SYNTHETIC_ONLY',current:async()=>fail(),claim:async()=>fail()});
  const record=await commands.read(db,actor,{projectId:q.projectId,executionId:q.executionId,executionGeneration:q.generation},first.commandRef),e=record.snapshot.envelope,f=record.snapshot.currentBinding.fact;
  if(e.envelopeHash!==first.envelopeHash||q.agentSessionId!==f.agentSession.sessionRef.id)return fail();
  const query=cloneV1(q) as unknown as ProviderClaimReceiptQuery,store=new BoundPgProviderClaimHistoryStore(db,actor),history=await new SyntheticProviderClaimHistory(store).read(query);
  if(!history.result.found||!same(history.result.receipt?.claimRef,selection.parentRef))return fail();
  // 같은 잠금 안의 불변 원문을 다시 읽어 receipt만으로 볼 수 없는 SEND scope를 대조한다.
  const entry=await new SyntheticPgProviderClaimJournal().read(db,query);
  if(!entry||!same(entry.receipt,history.result.receipt))return fail();const parent=validateProviderSessionClaim(entry.claim),c=parent.claim;
  if(!same(parent.ref,selection.parentRef)||c.kind!=='THREAD'||!same(c.agentSessionRef,f.agentSession.sessionRef)||!same(c.responsibleBindingRef,f.agentSession.roleBindingRef)||!same(c.assignmentRef,f.intent.assignmentRef)||!same(c.connectionRef,e.context.connectionRef)||!same(c.environmentRef,e.context.environmentRef)||!same(c.executorRegistrationRef,first.registrationRef)||Date.parse(c.capturedAt)>Date.parse(e.issuedAt)||Date.parse(c.usableBefore)<=Date.parse(e.issuedAt))return fail();
  const originalScope=entry.scope,sendScope=selection.instruction.permitScope;
  if(!same(originalScope,sendScope))return fail();
  const last=await readOwnershipPreparationReceiptBasis(db,access,token,csrf,scope,preparationRef);
  for(const k of ['scope','subject','preparationRef','registrationRef'] as const)if(!same(first[k],last[k]))return fail();
  const expiresAt=new Date(Math.min(Date.parse(first.expiresAt),Date.parse(last.expiresAt),Date.parse(store.responseValidUntil()))).toISOString();
  if(Date.parse(last.checkedAt)<Date.parse(first.checkedAt)||Date.parse(last.checkedAt)>=Date.parse(expiresAt))return fail();
  return{purpose:'OWNERSHIP_PARENT_THREAD_HISTORY_ONLY' as const,scope:cloneV1(last.scope),preparationRef:cloneV1(preparationRef),commandRef:cloneV1(first.commandRef),permitRef:cloneV1(first.permitRef),parentThreadClaimRef:cloneV1(parent.ref),agentSessionRef:cloneV1(c.agentSessionRef),parentReceiptRecordedAt:entry.receipt.recordedAt,parentUsableBefore:c.usableBefore,checkedAt:last.checkedAt,expiresAt,currentParentVerified:false as const,bindingAuthorized:false as const,writerState:'UNKNOWN' as const,executionAuthorized:false as const,dispatchPerformed:false as const,missingEvidence:[...first.missingEvidence,'CURRENT_PARENT_AUTHORITY','ACTUAL_LOCAL_ATTEMPT_JOURNAL','OS_OWNERSHIP','BINDING_EVENT_AND_HEAD_CAS'] as const};
 }catch{return fail();}
}
