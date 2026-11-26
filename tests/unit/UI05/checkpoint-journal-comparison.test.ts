import test from 'node:test';import assert from 'node:assert/strict';import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {contentHash} from '../../../contracts/canonical.ts';
import {criteriaFixture,criteriaHash as hash,criteriaRef} from '../FN12/result-criteria-fixture.ts';import {prepareCheckpointDraft} from '../../../apps/server/modules/checkpoints/checkpoint-input.ts';import {resultFixture} from './result-view-fixture.ts';import {observationJournalFor} from './observation-journal-fixture.ts';
import {createCheckpointRecord} from '../../../apps/server/modules/checkpoints/checkpoint-record.ts';
import {stopHistoryFor} from './stop-request-history-fixture.ts';
const mod:any=await import('../../../apps/web/src/features/session-detail/checkpoint-journal-comparison.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function fixture(){const f=criteriaFixture(),result=resultFixture().entry;result.snapshot.scope.projectId=f.assignment.projectId;result.snapshot.scope.assignmentRef=f.assignment.ref;result.snapshot.manifest.assignmentRef=f.assignment.ref;result.snapshot.manifestHash=hash(result.snapshot.manifest);result.ref.contentHash=hash(result.snapshot);const journal=observationJournalFor(result),state:any={assignmentRef:f.assignment.ref,executionRefs:[result.snapshot.scope.executionRef],baselineRefs:f.d.baselineRefs,currentPosition:{taskRef:f.d.taskRef,description:'관측대조'},completedItems:[],inProgress:[],remaining:[],sourceSnapshotRefs:[],changedFiles:[],verificationRefs:[],errorFingerprints:[],attemptCounts:[],lastLocalSequence:3,lastServerAck:{sequence:0,batchRef:journal.ack.ref},untransmittedRefs:[],pendingDecisions:[],nextAction:'차이를 확인한다',forbiddenActions:['자동재개'],recordFileRef:null},input={baseRef:null,state,reason:'사용자 선택 파일 대조'},build=()=>({fileSource:'USER_SELECTED_BYTES_ONLY',authenticityVerified:false,prepared:{projectId:f.assignment.projectId,assignmentRef:f.assignment.ref,sourceState:'FIXED_ASSIGNMENT_REFERENCE_ONLY',...prepareCheckpointDraft(f.assignment,input)}});return{...f,result,journal,input,build};}
function changeFixture(){
 const f=fixture(),scope={sourceRootRef:criteriaRef(80),mappingRef:null,observationRef:criteriaRef(81),baselineRef:f.d.baselineRefs[0],targets:['src/common.ts','src/local.ts'].map(relativePath=>({relativePath,kind:'FILE',access:'READ',recursive:false}))};
 f.d.allowedScopes=[scope];f.assignment.ref.contentHash=hash(f.assignment.snapshot);f.input.state.assignmentRef=structuredClone(f.assignment.ref);f.input.state.sourceSnapshotRefs=[scope.observationRef];f.input.state.changedFiles=['src/common.ts','src/local.ts'].map(relativePath=>({sourceRootRef:scope.sourceRootRef,relativePath,kind:'MODIFIED',beforeHash:'a'.repeat(64),afterHash:'b'.repeat(64),diffRef:null}));f.result.snapshot.scope.assignmentRef=f.assignment.ref;f.result.snapshot.manifest.assignmentRef=f.assignment.ref;
 Object.assign(f.result.snapshot.manifest,{changes:[{path:'src/common.ts',kind:'MODIFIED',beforeHash:'a'.repeat(64),afterHash:'b'.repeat(64),diffRef:null},{path:'src/report.ts',kind:'ADDED',beforeHash:null,afterHash:'c'.repeat(64),diffRef:null}]});
 f.result.snapshot.manifestHash=hash(f.result.snapshot.manifest);f.result.ref.contentHash=hash(f.result.snapshot);Object.assign(f.journal,observationJournalFor(f.result));f.input.state.lastServerAck.batchRef=f.journal.ack.ref;return f;
}

test('UI05 현황에만 있는 변경과 제출에만 있는 변경을 드러내고 경로·hash 일치를 실제파일 인증으로 승격하지 않는다',async()=>{
 const f=changeFixture(),file=f.build(),original=structuredClone(file),v=await mod.compareCheckpointJournal(new ApiClient(async()=>Response.json(f.journal)),file,f.result,()=>true);assert(v.changeComparison);assert.deepEqual(v.changeComparison.rows.map((r:any)=>[r.path,r.state]),[['src/common.ts','DECLARED_FIELDS_EQUAL'],['src/local.ts','FILE_ONLY'],['src/report.ts','RESULT_ONLY']]);assert.equal(v.changeComparison.sourceRootVerified,false);assert.equal(v.changeComparison.currentFilesObserved,false);assert.deepEqual(v.changeComparison.rows[0].fileEntries,f.input.state.changedFiles.slice(0,1));assert.equal(v.readyForResume,false);assert.deepEqual(file,original);
});

test('UI05 변경의 미상hash·중복경로·불일치를 구분하고 한쪽 diff 참조 누락도 같음으로 감추지 않는다',async()=>{
 const run=async(change:(f:ReturnType<typeof changeFixture>)=>void)=>{const f=changeFixture();change(f);f.result.snapshot.manifestHash=hash(f.result.snapshot.manifest);f.result.ref.contentHash=hash(f.result.snapshot);Object.assign(f.journal,observationJournalFor(f.result));return mod.compareCheckpointJournal(new ApiClient(async()=>Response.json(f.journal)),f.build(),f.result,()=>true);};
 const a=await run(f=>{f.input.state.changedFiles[0].diffRef=criteriaRef(88);});assert.equal(a.changeComparison.rows[0].state,'REFERENCE_UNKNOWN');
 const b=await run(f=>{Object.assign(f.result.snapshot.manifest.changes[0]!,{afterHash:null});});assert.equal(b.changeComparison.rows[0].state,'HASH_UNKNOWN');
 const c=await run(f=>{Object.assign(f.result.snapshot.manifest.changes[0]!,{afterHash:'d'.repeat(64)});});assert.equal(c.changeComparison.rows[0].state,'RECORDS_DIFFER');assert.deepEqual(c.changeComparison.rows[0].different,['afterHash']);
 const d=await run(f=>{f.result.snapshot.manifest.changes.push(structuredClone(f.result.snapshot.manifest.changes[0]!));});assert.equal(d.changeComparison.rows[0].state,'AMBIGUOUS_PATH');
 for(const v of [a,b,c,d]){assert.equal(v.currentFactsVerified,false);assert.equal(v.readyForResume,false);}
});

test('UI05 현황 쪽 필수hash가 미상인 재결박 기록도 필드 일치로 승격하지 않는다',async()=>{
 const f=changeFixture(),file=f.build(),p:any=file.prepared;p.input.state.changedFiles[0].afterHash=null;p.snapshot.input=structuredClone(p.input);p.contentHash=hash(p.snapshot);const prefix=p.recordText.slice(0,p.recordText.indexOf('{'));p.recordText=prefix+JSON.stringify(p.snapshot,null,2)+'\n';p.recordFile.bytes=Buffer.byteLength(p.recordText);p.recordFile.contentHash=contentHash(p.recordText);
 const v=await mod.compareCheckpointJournal(new ApiClient(async()=>Response.json(f.journal)),file,f.result,()=>true);assert.equal(v.changeComparison.rows[0].state,'HASH_UNKNOWN');assert.equal(v.currentFactsVerified,false);assert.equal(v.readyForResume,false);
});

test('UI05 파일선언/새보관ACK를같은임무/실행에만묶어0+ref·로컬앞섬/공백을비교하고재개는불가',async()=>{assert.equal(typeof mod.compareCheckpointJournal,'function');const f=fixture(),file=f.build(),before=structuredClone(file),requests:string[]=[],v=await mod.compareCheckpointJournal(new ApiClient(async(url,init)=>{requests.push(String(url));assert.equal(init?.method??'GET','GET');return Response.json(f.journal);}),file,f.result,()=>true);assert.equal(requests.length,1);assert.equal(v.executionMatched,true);assert.equal(v.declaredLocalSequence,3);assert.equal(v.serverHighestContiguous,0);assert.equal(v.ackReferenceComparison,'SAME_REF_AND_SEQUENCE');assert.equal(v.localComparison,'DECLARED_LOCAL_AHEAD');assert.equal(v.declaredContiguousAckDistance,3);assert.deepEqual(v.serverGaps,[{from:1,to:1}]);for(const k of ['currentFactsVerified','checkpointStored','writerReleaseVerified','readyForResume','executionAuthorized','dispatchPerformed'])assert.equal(v[k],false);assert.deepEqual(file,before);});
test('UI05 검산된 서버 체크포인트는 원 저장 ref/hash를 보존해 선택 결과·ACK와 대조하고 로컬 미저장으로 표시하지 않는다',async()=>{
 const f=fixture(),by={kind:'HUMAN',userId:criteriaRef(91).id,clientId:criteriaRef(92).id},at='2026-10-20T00:01:00.000Z',prepared=prepareCheckpointDraft(f.assignment,f.input),record=createCheckpointRecord(prepared,by,at),storedRef={id:criteriaRef(93).id,version:1,contentHash:hash(record.snapshot)};(f.result.snapshot.manifest as any).checkpointRef=storedRef;f.result.snapshot.manifestHash=hash(f.result.snapshot.manifest);f.result.ref.contentHash=hash(f.result.snapshot);Object.assign(f.journal,observationJournalFor(f.result));const stored={projectId:f.assignment.projectId,ref:storedRef,...record,serverSequence:7,observedAt:at},before=structuredClone(stored),requests:string[]=[];
 const v=await mod.compareCheckpointJournal(new ApiClient(async(url,init)=>{requests.push(String(url));assert.equal(init?.method??'GET','GET');return Response.json(f.journal);}),{source:'SERVER_STORED_CHECKPOINT',value:stored},f.result,()=>true);
 assert.equal(requests.length,1);assert.equal(v.sourceState,'STORED_CHECKPOINT_VS_STORED_SYNTHETIC_LEDGER_ONLY');assert.deepEqual(v.checkpointRef,storedRef);assert.equal(v.checkpointReferenceComparison,'SAME_STORED_REF');assert.equal(v.recordBodyHash,record.snapshot.recordFile.contentHash);assert.equal(v.localFileHash,null);assert.equal(v.fileDeclarationHash,record.snapshot.preparedHash);assert.equal(v.checkpointStored,true);assert.equal(v.recordFileStored,false);assert(!v.gaps.includes('CHECKPOINT_NOT_STORED'));assert(!v.gaps.includes('FILE_SOURCE_AUTHENTICITY_UNVERIFIED'));assert.equal(v.currentFactsVerified,false);assert.equal(v.readyForResume,false);assert.deepEqual(stored,before);
});
test('UI05 서버 체크포인트가 결과 manifest의 동일 fullref가 아니면 ACK GET 없이 불일치를 드러낸다',async()=>{
 const f=fixture(),by={kind:'HUMAN',userId:criteriaRef(91).id,clientId:criteriaRef(92).id},at='2026-10-20T00:01:00.000Z',prepared=prepareCheckpointDraft(f.assignment,f.input),record=createCheckpointRecord(prepared,by,at),storedRef={id:criteriaRef(93).id,version:1,contentHash:hash(record.snapshot)},stored={projectId:f.assignment.projectId,ref:storedRef,...record,serverSequence:7,observedAt:at};let calls=0;
 const v=await mod.compareCheckpointJournal(new ApiClient(async()=>{calls++;return Response.json(f.journal);}),{source:'SERVER_STORED_CHECKPOINT',value:stored},f.result,()=>true);
 assert.equal(calls,0);assert.equal(v.checkpointReferenceComparison,'RESULT_CHECKPOINT_NOT_REFERENCED');assert.equal(v.serverRead,false);assert(v.gaps.includes('RESULT_CHECKPOINT_REFERENCE_MISMATCH'));assert.equal(v.readyForResume,false);
 const other=structuredClone(f.result);(other.snapshot.manifest as any).checkpointRef=criteriaRef(94);other.snapshot.manifestHash=hash(other.snapshot.manifest);other.ref.contentHash=hash(other.snapshot);
 const different=await mod.compareCheckpointJournal(new ApiClient(async()=>{calls++;return Response.json(f.journal);}),{source:'SERVER_STORED_CHECKPOINT',value:stored},other,()=>true);
 assert.equal(calls,0);assert.equal(different.checkpointReferenceComparison,'DIFFERENT_STORED_REF');assert.equal(different.serverRead,false);assert(different.gaps.includes('RESULT_CHECKPOINT_REFERENCE_MISMATCH'));assert.equal(different.readyForResume,false);
});
test('UI05 미연결실행은숫자대조/GET0·미확인순번/ACK는0으로대체하지않음',async()=>{assert.equal(typeof mod.compareCheckpointJournal,'function');const f=fixture();f.input.state.executionRefs=[];let calls=0;const client=new ApiClient(async()=>{calls++;return Response.json(f.journal);});let v=await mod.compareCheckpointJournal(client,f.build(),f.result,()=>true);assert.equal(calls,0);assert.equal(v.executionMatched,false);assert.equal(v.localComparison,'NOT_COMPARED');assert.equal(v.serverHighestContiguous,null);f.input.state.executionRefs=[f.result.snapshot.scope.executionRef];f.input.state.lastLocalSequence=null;f.input.state.lastServerAck=null;v=await mod.compareCheckpointJournal(client,f.build(),f.result,()=>true);assert.equal(calls,1);assert.equal(v.declaredLocalSequence,null);assert.equal(v.localComparison,'LOCAL_SEQUENCE_UNKNOWN');assert.equal(v.ackReferenceComparison,'FILE_ACK_UNKNOWN');f.journal.ack=null as any;f.journal.items=[];f.journal.storedCount=0;v=await mod.compareCheckpointJournal(client,f.build(),f.result,()=>true);assert.equal(v.serverHighestContiguous,null);assert.equal(v.ackReferenceComparison,'SERVER_ACK_NOT_RECORDED');});
test('UI05 같은순번다른ACKref/파일앞선ACK는불일치로보존하며같음으로승격하지않음',async()=>{assert.equal(typeof mod.compareCheckpointJournal,'function');const f=fixture();f.input.state.lastServerAck.batchRef=criteriaRef(99);let v=await mod.compareCheckpointJournal(new ApiClient(async()=>Response.json(f.journal)),f.build(),f.result,()=>true);assert.equal(v.ackReferenceComparison,'DIFFERENT_REF_OR_SEQUENCE');f.input.state.lastServerAck.sequence=1;v=await mod.compareCheckpointJournal(new ApiClient(async()=>Response.json(f.journal)),f.build(),f.result,()=>true);assert.equal(v.ackReferenceComparison,'DIFFERENT_REF_OR_SEQUENCE');assert.equal(v.declaredAckSequence,1);assert.equal(v.serverHighestContiguous,0);assert.equal(v.readyForResume,false);});
test('UI05 변형파일/다른임무는GET0·서버회수/승격거절·늦은결과회수',async()=>{assert.equal(typeof mod.compareCheckpointJournal,'function');const f=fixture();let calls=0;const client=new ApiClient(async()=>{calls++;return Response.json(f.journal);});for(const change of [(v:any)=>v.prepared.recordText+='변형',(v:any)=>v.prepared.snapshot.writerReleaseVerified=true,(v:any)=>v.prepared.assignmentRef.id=criteriaRef(98).id,(v:any)=>v.authenticityVerified=true]){const file=structuredClone(f.build());change(file);await assert.rejects(mod.compareCheckpointJournal(client,file,f.result,()=>true));}assert.equal(calls,0);await assert.rejects(mod.compareCheckpointJournal(new ApiClient(async()=>Response.json({code:'ACCESS_DENIED'},{status:403})),f.build(),f.result,()=>true),(e:any)=>e.status===403);let active=true;assert.equal(await mod.compareCheckpointJournal(new ApiClient(async()=>{active=false;return Response.json(f.journal);}),f.build(),f.result,()=>active),null);const bad=structuredClone(f.journal);bad.writerReleaseVerified=true;await assert.rejects(mod.compareCheckpointJournal(new ApiClient(async()=>Response.json(bad)),f.build(),f.result,()=>true));});

function resumeFixture(executionMatched=true){
 const f=fixture(),by={kind:'HUMAN',userId:criteriaRef(91).id,clientId:criteriaRef(92).id},at='2026-10-20T00:01:00.000Z';
 if(!executionMatched)f.input.state.executionRefs=[];
 const record=createCheckpointRecord(prepareCheckpointDraft(f.assignment,f.input),by,at);
 const stored={...record,projectId:f.assignment.projectId,ref:{...criteriaRef(93),contentHash:hash(record.snapshot)},serverSequence:7,observedAt:at};
 (f.result.snapshot.manifest as any).checkpointRef=stored.ref;
 f.result.snapshot.manifestHash=hash(f.result.snapshot.manifest);f.result.ref.contentHash=hash(f.result.snapshot);
 const journal=observationJournalFor(f.result);
 const item=journal.items[0]!;
 item.snapshot.event.type='STOPPED';item.ref.contentHash=hash(item.snapshot);
 return {...f,stored,journal,stop:stopHistoryFor(f.result),source:{source:'SERVER_STORED_CHECKPOINT' as const,value:stored}};
}

test('서버 원본 비교 뒤에만 명시 읽기가 제한된 STOP 관측·공백과 저장 의도를 반환한다',async()=>{
 const f=resumeFixture(),calls:string[]=[];
 const c=new ApiClient(async(input,options)=>{
  const path=String(input);assert.equal(options?.method,'GET');calls.push(path.split('/').at(-1)!);
  return Response.json(path.endsWith('/observation-journal')?f.journal:f.stop);
 });
 const proof=await mod.compareCheckpointJournal(c,f.source,f.result,()=>true);
 assert.deepEqual(calls,['observation-journal']);
 assert.equal(typeof mod.readCheckpointResumeEvidence,'function');
 const evidence=await mod.readCheckpointResumeEvidence(c,proof,f.stored,f.result,()=>true);
 assert.deepEqual(calls,['observation-journal','observation-journal','stop-requests']);
 assert.deepEqual(evidence.stopRequests.items,f.stop.items);
 assert.deepEqual(evidence.observations.items.map((item:any)=>item.snapshot.event.type),['STOPPED']);
 assert.deepEqual(evidence.observations.gaps,[{from:1,to:1}]);
 for(const flag of ['readyForResume','writerReleaseVerified','executionAuthorized','dispatchPerformed'])assert.equal(evidence[flag],false);
});

test('로컬·미일치·다른 스코프나 복사한 비교로 중지·관측 조회를 열지 않는다',async()=>{
 for(const mode of ['LOCAL','UNLINKED','NO_REF','WRONG_REF','CLONED_PROOF','REPLACED_RESULT','REPLACED_STORE','REPLACED_PORT']){
  const f=resumeFixture(mode!=='UNLINKED'),calls:string[]=[];
  const transport:typeof fetch=async path=>{calls.push(String(path));return Response.json(f.journal);};
  const c=new ApiClient(transport),r=f.result;
  if(mode==='NO_REF'||mode==='WRONG_REF'){
   (r.snapshot.manifest as any).checkpointRef=mode==='NO_REF'?null:criteriaRef(77);
   r.snapshot.manifestHash=hash(r.snapshot.manifest);r.ref.contentHash=hash(r.snapshot);
  }
  const compared=await mod.compareCheckpointJournal(c,mode==='LOCAL'?f.build():f.source,r,()=>true);
  const count=calls.length;
  const ready=['CLONED_PROOF','REPLACED_RESULT','REPLACED_STORE','REPLACED_PORT'].includes(mode);
  assert.equal(mod.isCheckpointResumeComparison(compared),ready);
  const candidate=mode==='REPLACED_RESULT'?{...r,ref:{...r.ref,version:2}}:r;
  const stored=mode==='REPLACED_STORE'?{...f.stored,ref:{...f.stored.ref,version:2}}:f.stored;
  const proof=mode==='CLONED_PROOF'?structuredClone(compared):compared;
  if(mode==='REPLACED_PORT'){
   c.transport=async()=>assert.fail('교체 transport GET 금지');
   assert.equal(await mod.readCheckpointResumeEvidence(c,proof,stored,candidate,()=>true),null);
  }else await assert.rejects(mod.readCheckpointResumeEvidence(c,proof,stored,candidate,()=>true),mode);
  assert.equal(calls.length,count,mode);
 }
});

test('보호 관측의 교차 자료·인증 만료·이탈은 후속 중지 GET 0, 현재 중지 권한 오류는 보존한다',async()=>{
 for(const mode of ['WRONG_EXECUTION','WRONG_REPORT','EXPIRED','LEFT','STOP401','STOP403','STOP404','STOP_LEFT']){
  const f=resumeFixture(),calls:string[]=[];let active=true;
  const c=new ApiClient(async path=>{
   calls.push(String(path));
   if(calls.length===1)return Response.json(f.journal);
   if(calls.length===2){
    if(mode==='EXPIRED')return Response.json({code:'AUTH_REQUIRED'},{status:401});
    if(mode==='LEFT'){active=false;return Response.json({code:'AUTH_REQUIRED'},{status:401});}
    const broken=structuredClone(f.journal);
    if(mode==='WRONG_EXECUTION')broken.executionRef.version++;
    if(mode==='WRONG_REPORT')broken.resultRef.contentHash='0'.repeat(64);
    return Response.json(broken);
   }
   if(mode==='STOP_LEFT'){active=false;return Response.json({code:'AUTH_REQUIRED'},{status:401});}
   const status=Number(mode.slice(4));return Response.json({code:status===401?'AUTH_REQUIRED':status===403?'PROJECT_OPERATION_DENIED':'NOT_FOUND'},{status});
  });
  const proof=await mod.compareCheckpointJournal(c,f.source,f.result,()=>active);
  const read=mod.readCheckpointResumeEvidence(c,proof,f.stored,f.result,()=>active);
  if(mode==='LEFT'||mode==='STOP_LEFT')assert.equal(await read,null);
  else if(mode.startsWith('STOP')||mode==='EXPIRED')await assert.rejects(read,(e:any)=>e.status===(mode==='EXPIRED'?401:Number(mode.slice(4))));
  else await assert.rejects(read,{code:'RESULT_OBSERVATION_RESPONSE_INVALID'});
  assert.equal(calls.filter(path=>path.endsWith('/stop-requests')).length,mode.startsWith('STOP')?1:0);
 }
});

test('빈 원장과 최근 20건 제한을 구분하고 두 조회 시각을 각각 보존한다',async()=>{
 for(const mode of ['EMPTY','BOUNDED']){
  const f=resumeFixture(),calls:string[]=[];
  const journal:any=structuredClone(f.journal),{contentHash:_,...stops}=structuredClone(f.stop);
  if(mode==='EMPTY'){
   journal.items=[];journal.storedCount=0;journal.ack=null;stops.items=[];
  }else{
   const template=journal.items[0],top=23;
   journal.items=Array.from({length:20},(_,i)=>{
    const seq=top-i;
    const snapshot=structuredClone(template.snapshot);
    snapshot.event={...snapshot.event,sequence:seq,eventId:criteriaRef(200+seq).id,type:i===0?'STOP_UNCONFIRMED':'UNKNOWN'};
    return {ref:{...criteriaRef(400+seq),contentHash:hash(snapshot)},snapshot};
   });
   journal.storedCount=22;journal.hasMore=true;
   const q=journal.ack.snapshot;
   Object.assign(q,{highestContiguous:1,maxSequence:top,storedCount:22,gaps:[{from:2,to:2}]});
   journal.ack.ref.contentHash=hash(q);
   const intent=stops.items[0]!;
   stops.items=Array.from({length:20},(_,i)=>({...intent,ref:criteriaRef(620-i)}));stops.hasMore=true;
  }
  stops.observedAt=new Date(Date.parse(journal.observedAt)+1000).toISOString();
  const c=new ApiClient(async path=>{
   calls.push(String(path).split('/').at(-1)!);
   return Response.json(String(path).endsWith('/observation-journal')?journal:{...stops,contentHash:hash(stops)});
  });
  const proof=await mod.compareCheckpointJournal(c,f.source,f.result,()=>true);
  const v=await mod.readCheckpointResumeEvidence(c,proof,f.stored,f.result,()=>true);
  assert.deepEqual(calls,['observation-journal','observation-journal','stop-requests']);
  assert.equal(v.stopRequests.items.length,mode==='EMPTY'?0:20);
  assert.equal(v.observations.displayedCount,mode==='EMPTY'?0:20);
  assert.equal(v.stopRequests.hasMore,mode==='BOUNDED');assert.equal(v.observations.hasMore,mode==='BOUNDED');
  assert.equal(v.observations.items.length,mode==='EMPTY'?0:1);
  assert.equal(v.observations.highestContiguous,mode==='EMPTY'?null:1);
  assert.equal(v.observations.observedAt,journal.observedAt);
  assert.equal(v.stopRequests.observedAt,stops.observedAt);
 }
});
