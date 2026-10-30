import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {prepareCheckpointDraft} from './checkpoint-input.ts';
type Prepared=ReturnType<typeof prepareCheckpointDraft>;
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
function fail():never{throw Error('CHECKPOINT_RECORD_INVALID');}
/** 저장 transaction이 사용할 불변 원문을 구성한다. 이 순수 함수 자체는 저장 증거가 아니다. */
export function createCheckpointRecord(prepared:Prepared,rawBy:unknown,at:string){
 const by=cloneV1(rawBy),p=cloneV1(prepared);
 if(!recordV1(by,['kind','userId','clientId'])||by.kind!=='HUMAN'||!uuidV1(by.userId)||!uuidV1(by.clientId)||!isoV1(at)||p.contentHash!==hash(p.snapshot)||!same(p.input,p.snapshot.input)||p.snapshot.sourceAssurance!=='CALLER_DECLARED_STATE_NOT_VERIFIED'||p.recordFile.bytes!==Buffer.byteLength(p.recordText)||p.recordFile.contentHash!==contentHash(p.recordText)||p.recordFile.mediaType!=='text/plain;charset=utf-8'||['checkpointStored','recordFileStored','currentFactsVerified','writerReleaseVerified','resumeAuthorized','completionAccepted','executionAuthorized','dispatchPerformed'].some(k=>(p as any)[k]!==false||(p.snapshot as any)[k]!==false))fail();
 const snapshot={schemaVersion:1 as const,projectId:p.snapshot.projectId,input:p.input,preparedHash:p.contentHash,recordFile:p.recordFile,recordedBy:by as {kind:'HUMAN';userId:string;clientId:string},recordedAt:at,sourceAssurance:'HUMAN_RECORDED_CLAIMS_NOT_VERIFIED' as const,gaps:p.gaps,checkpointStored:true as const,recordFileStored:false as const,currentFactsVerified:false as const,writerReleaseVerified:false as const,resumeAuthorized:false as const,completionAccepted:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
 if(Buffer.byteLength(canonicalJson(snapshot))+Buffer.byteLength(p.recordText)>2*1024*1024)fail();return{snapshot,recordText:p.recordText};
}
/** 보관 원문·고정 임무·기록 바이트를 대조한다. 현재 파일/실행/재개 권한을 확인하지 않는다. */
export function readCheckpointRecord(rawAssignment:unknown,raw:unknown,observedAt:string){
 try{const v=cloneV1(raw);if(!recordV1(v,['ref','snapshot','recordText'])||!refV1(v.ref)||v.ref.version!==1||!isoV1(observedAt)||!recordV1(v.snapshot,['schemaVersion','projectId','input','preparedHash','recordFile','recordedBy','recordedAt','sourceAssurance','gaps','checkpointStored','recordFileStored','currentFactsVerified','writerReleaseVerified','resumeAuthorized','completionAccepted','executionAuthorized','dispatchPerformed'])||!isoV1(v.snapshot.recordedAt)||Date.parse(v.snapshot.recordedAt)>Date.parse(observedAt))fail();
  const prepared=prepareCheckpointDraft(rawAssignment,v.snapshot.input),expected=createCheckpointRecord(prepared,v.snapshot.recordedBy,v.snapshot.recordedAt);if(!same(v.snapshot,expected.snapshot)||v.recordText!==expected.recordText||v.ref.contentHash!==hash(v.snapshot))fail();return{ref:v.ref,...expected,observedAt};
 }catch{return fail();}
}
