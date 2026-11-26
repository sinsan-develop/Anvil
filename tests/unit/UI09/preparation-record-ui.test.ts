import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {prepareCheckpointDraft} from '../../../apps/server/modules/checkpoints/checkpoint-input.ts';
import {createCheckpointRecord} from '../../../apps/server/modules/checkpoints/checkpoint-record.ts';

function checkpointHistoryFixture(empty=false){
 const f=transferFixture(),input={baseRef:null,reason:'당시 인계 진행 기록',state:{assignmentRef:f.confirmed.ref,executionRefs:[],baselineRefs:f.confirmed.snapshot.definition.baselineRefs,currentPosition:{taskRef:f.confirmed.snapshot.definition.taskRef,description:'저장 화면 검수 중'},completedItems:empty?[]:[{itemId:'done',description:'저장 화면 구현 주장',evidenceRefs:[f.confirmed.ref]}],inProgress:empty?[]:[{itemId:'doing',description:'합성 검수 진행',evidenceRefs:[]}],remaining:empty?[]:[{itemId:'todo',description:'실제 환경 검수 필요',evidenceRefs:[]}],sourceSnapshotRefs:[],changedFiles:[],verificationRefs:[],errorFingerprints:[],attemptCounts:[],lastLocalSequence:3,lastServerAck:{sequence:0,batchRef:null},untransmittedRefs:[],pendingDecisions:[],nextAction:'사람의 검수 결과 확인',forbiddenActions:['자동 재개'],recordFileRef:null}};
 const record=createCheckpointRecord(prepareCheckpointDraft(f.confirmed,input),{kind:'HUMAN',userId:pid,clientId:id(2)},at),ref={id:id(91),version:1,contentHash:hash(record.snapshot)},value={projectId:pid,ref,...record,observedAt:new Date().toISOString(),serverSequence:9};
 const path='/api/v1/projects/'+pid+'/checkpoints',page={items:[{ref,assignmentRef:f.confirmed.ref,previousRef:null,recordedAt:at,serverSequence:9}],hasMore:false,nextCursor:null,observedAt:value.observedAt};
 return{value,page,path,recordPath:path+'/'+ref.id};
}
async function openCheckpoint(f:Awaited<ReturnType<typeof host>>,c:ReturnType<typeof checkpointHistoryFixture>){await f.click('이전 작업현황 목록 조회');await f.settle(()=>f.buttons('작업현황 원문 '+c.value.ref.id).length===1);await f.click('작업현황 원문 '+c.value.ref.id);await f.settle(()=>f.nodes().some(n=>n.getAttribute('aria-label')==='이전 작업현황 고정 원문'));}
test('보관 작업현황 요약 · 명시 고정 조회 뒤 당시 상태만 구조화하고 원문·감사를 보존한다',async()=>{
 const c=checkpointHistoryFixture(),f=await host({empty:true,historicalGet:p=>p===c.path?Response.json(c.page):p===c.recordPath?Response.json(c.value):undefined});
 try{assert.equal(f.calls.filter(v=>v.path.startsWith(c.path)).length,0);await openCheckpoint(f,c);
  const summary=f.nodes().find(n=>n.getAttribute('aria-label')==='기록 당시 작업 상태');assert(summary,'구조화된 당시 상태');
  for(const text of ['기록 당시 위치','저장 화면 검수 중','완료 주장','저장 화면 구현 주장','진행 중','합성 검수 진행','남은 일','실제 환경 검수 필요','다음 행동','사람의 검수 결과 확인','자동 재개'])assert(summary.textContent.includes(text),text);
  assert(f.nodes().some(n=>n.tagName==='PRE'&&n.textContent===c.value.recordText));assert(f.text().includes('공유 감사 순번 9'));assert(f.text().includes('COMPLETED_ITEM_EVIDENCE_UNVERIFIED'));
  assert.equal(f.calls.filter(v=>v.path.startsWith(c.path)).length,2);assert(f.calls.every(v=>v.method==='GET'));assert.deepEqual(f.buffers,{});
 }finally{await f.close();}
});
for(const malformed of [false,true])test('보관 작업현황 요약 · '+(malformed?'비정상 형상':'빈 항목')+'을 완료로 표시하지 않는다',async()=>{
 const c=checkpointHistoryFixture(!malformed);
 if(malformed){
  // 정상 서버 생산물이 아닌 방어용 wire: hash 일치만으로 표시 형상이 보장되지 않음을 확인한다.
  const s:any=c.value.snapshot.input.state;s.currentPosition.description={bad:true};s.completedItems[0].description={bad:true};s.inProgress=[{itemId:'bad-ref',description:'잘못된 참조는 요약 미표시',evidenceRefs:[{id:'-'.repeat(36),version:1,contentHash:'a'.repeat(64)}]}];delete s.remaining;s.nextAction={bad:true};s.pendingDecisions=null;s.forbiddenActions=[{bad:true}];
  const flags={checkpointStored:false,recordFileStored:false,currentFactsVerified:false,writerReleaseVerified:false,resumeAuthorized:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false};
  const prepared={schemaVersion:1,projectId:pid,input:c.value.snapshot.input,sourceAssurance:'CALLER_DECLARED_STATE_NOT_VERIFIED',gaps:c.value.snapshot.gaps,...flags};
  c.value.recordText='# Anvil 작업현황 · 기록 초안\n\n이 기록은 수행자 선언이며 실제 파일/중지/회수·완료/재개를 인증하지 않습니다.\n\n'+JSON.stringify(prepared,null,2)+'\n';
  c.value.snapshot.preparedHash=hash(prepared);c.value.snapshot.recordFile.bytes=Buffer.byteLength(c.value.recordText);c.value.snapshot.recordFile.contentHash=contentHash(c.value.recordText);c.value.ref.contentHash=hash(c.value.snapshot);
 }
 const f=await host({empty:true,historicalGet:p=>p===c.path?Response.json(c.page):p===c.recordPath?Response.json(c.value):undefined});
 try{await openCheckpoint(f,c);const summary=f.nodes().find(n=>n.getAttribute('aria-label')==='기록 당시 작업 상태');assert(summary);
  assert(summary.textContent.includes(malformed?'미확인 · 항목 형상 또는 기록 없음':'당시 기재 항목 없음 · 완료나 작업 없음 판정 아님'));
  if(malformed){assert(summary.textContent.includes('미확인 · 다음 행동 기록 없음'));assert(summary.textContent.includes('미확인 · 위치 기록 없음'));assert.doesNotMatch(summary.textContent,/\[object Object\]|잘못된 참조는 요약 미표시/);}
  assert(f.calls.every(v=>v.method==='GET'));assert.deepEqual(f.buffers,{});
 }finally{await f.close();}
});
for(const status of [401,403,404])test('보관 작업현황 요약 · 현재 '+status+'는 상태 원문을 표시하지 않는다',async()=>{
 const c=checkpointHistoryFixture(),f=await host({empty:true,historicalGet:p=>p===c.path?Response.json(c.page):p===c.recordPath?Response.json({code:'ACCESS_DENIED'},{status}):undefined});
 try{await f.click('이전 작업현황 목록 조회');await f.settle(()=>f.buttons('작업현황 원문 '+c.value.ref.id).length===1);await f.click('작업현황 원문 '+c.value.ref.id);await f.settle(()=>f.text().includes('ACCESS_DENIED'));
  assert(!f.nodes().some(n=>n.getAttribute('aria-label')==='기록 당시 작업 상태'));assert.equal(f.lost(),status===401?1:0);assert(f.calls.every(v=>v.method==='GET'));
 }finally{await f.close();}
});
for(const mode of ['다시조회','주체ABA','프로젝트','transport'] as const)for(const status of [200,401])test('보관 작업현황 요약 · '+mode+' 뒤 늦은 '+status+'를 표시하지 않는다',async()=>{
 const c=checkpointHistoryFixture();let release=()=>{},waiting=false;
 const f=await host({empty:true,historicalGet:p=>{if(p===c.path)return Response.json(c.page);if(p!==c.recordPath)return;
  const r=Response.json(status===200?c.value:{code:'AUTH_REQUIRED'},{status}),json=r.json.bind(r);r.json=async()=>{await new Promise<void>(resolve=>{release=resolve;waiting=true;});return json();};return r;
 }});
 try{await f.click('이전 작업현황 목록 조회');await f.settle(()=>f.buttons('작업현황 원문 '+c.value.ref.id).length===1);await f.click('작업현황 원문 '+c.value.ref.id);await f.settle(()=>waiting);
  if(mode==='다시조회')await f.click('인계 기록 다시 조회');
  else if(mode==='주체ABA'){const p=f.props();await f.render({...p,session:{...p.session,clientId:id(99)}});await f.render(p);}
  else if(mode==='프로젝트')await f.render({...f.props(),projectId:id(99)});
  else{const transport=f.client.transport;f.client.transport=(...args:any[])=>transport(...args);await f.render();}
  await ui.React.act(async()=>{release();await new Promise(resolve=>setImmediate(resolve));});assert.equal(f.lost(),0);assert(!f.nodes().some(n=>n.getAttribute('aria-label')==='기록 당시 작업 상태'));assert.doesNotMatch(f.text(),/AUTH_REQUIRED/);assert(f.calls.every(v=>v.method==='GET'));assert.deepEqual(f.buffers,{});
 }finally{release();await f.close();}
});

const targetButton='당시 대상 연결 정의 열기';
const selectHistoricalTargetButton='당시 대상 연결을 현재 새 준비기록에 선택';
const responsibilityButton='당시 역할·책임 결박 원문 열기';
function historicalResponsibility(kind:'binding'|'role'|'none'='binding'){
 const f=seed();return receipt({commandId:id(92),payload:{assignmentRef:f.confirmed.ref,contextRef:null,roleRef:kind==='none'?null:f.stage.ref,oldBindingRef:kind==='binding'?f.binding.ref:null,targetConnectionRef:null,intentExpiresAt:new Date(Date.now()+600000).toISOString(),reason:'당시 책임 관계 보관'}}).data;
}
test('당시 책임 원문 · 고정 역할/결박 명시 조회만 수행하고 null·외부 버퍼를 보존한다',async()=>{
 for(const kind of ['binding','role','none'] as const){
  const data=historicalResponsibility(kind),f=await host({empty:true,knownRecord:{data}});
  try{await queryKnown(f,data.ref);await f.settle(()=>hasOriginal(f));const before=f.calls.length;
   if(kind==='none'){assert.equal(f.buttons(responsibilityButton).length,0);assert.match(f.text(),/당시 역할 미기록/);}
   else{await f.click(responsibilityButton);await f.settle(()=>f.nodes().some(n=>n.getAttribute('aria-label')==='당시 책임 관계 고정 원문'));
    assert.equal(f.calls.length-before,kind==='binding'?2:1);
    assert.match(f.text(),/고정 총괄 역할/);
    if(kind==='binding'){assert.match(f.text(),/당시 예약 세대 1/);assert.ok(f.text().includes(f.f.binding.snapshot.sessionRef.contentHash));assert.ok(f.text().includes(f.f.binding.snapshot.connectionRef.contentHash));}
    else assert.match(f.text(),/당시 기존 책임 결박 미기록/);
   }
   assert.deepEqual(f.buffers,{});assert.ok(f.calls.every(v=>v.method==='GET'));
  }finally{await f.close();}
 }
});
for(const mode of ['roleHash','bindingHash','assignment','401','403'] as const)test('당시 책임 원문 · '+mode+'는 관계 본문을 채택하지 않는다',async()=>{
 const data=historicalResponsibility(),basis=seed(),rolePath=`/api/v1/projects/${pid}/project-roles/${basis.stage.ref.id}/versions/1`,bindingPath=`/api/v1/projects/${pid}/role-bindings/${basis.binding.ref.id}/versions/1`;
 const f=await host({knownRecord:{data},historicalGet:path=>{
  if(path===rolePath){if(mode==='401'||mode==='403')return Response.json({code:'ACCESS_DENIED'},{status:Number(mode)});const value=structuredClone(basis.stage);if(mode==='roleHash'){value.snapshot.reason='다른 유효 역할 본문';value.ref.contentHash=hash(value.snapshot);}return Response.json(value);}
  if(path===bindingPath){const value=structuredClone(basis.binding);if(mode==='bindingHash')value.snapshot.reason='다른 유효 결박 본문';if(mode==='assignment')value.snapshot.assignmentRef={...value.snapshot.assignmentRef,contentHash:'f'.repeat(64)};value.ref.contentHash=hash(value.snapshot);return Response.json(value);}
 }});
 try{await queryKnown(f,data.ref);await f.settle(()=>hasOriginal(f));const before=f.buffer(),calls=f.calls.length;await f.click(responsibilityButton);await f.settle(()=>!f.button(responsibilityButton).disabled);
  assert.ok(!f.nodes().some(n=>n.getAttribute('aria-label')==='당시 책임 관계 고정 원문'));assert.match(f.text(),/TRANSFER_PREPARATION_.*MISMATCH|ACCESS_DENIED/);
  assert.equal(f.calls.slice(calls).filter(v=>v.path===bindingPath).length,['roleHash','401','403'].includes(mode)?0:1);assert.equal(f.lost(),mode==='401'?1:0);assert.equal(f.buffer(),before);assert.ok(f.calls.every(v=>v.method==='GET'));
 }finally{await f.close();}
});
for(const [phase,change] of [['role','닫기'],['role','기록ABA'],['binding','주체ABA'],['binding','transport']] as const)for(const status of [200,401])test(`당시 책임 원문 · ${phase}/${change} 뒤 늦은 ${status} 폐기`,async()=>{
 const data=historicalResponsibility(),basis=seed(),rolePath=`/api/v1/projects/${pid}/project-roles/${basis.stage.ref.id}/versions/1`,bindingPath=`/api/v1/projects/${pid}/role-bindings/${basis.binding.ref.id}/versions/1`;
 let delayed=false,waiting=false,release=()=>{};
 const f=await host({knownRecord:{data},historicalGet:path=>{
  if(path!==rolePath&&path!==bindingPath)return;const value=path===rolePath?basis.stage:basis.binding;
  if(!delayed&&path===(phase==='role'?rolePath:bindingPath)){delayed=true;const response=Response.json(status===200?value:{code:'AUTH_REQUIRED'},{status}),json=response.json.bind(response);response.json=async()=>{await new Promise<void>(resolve=>{release=resolve;waiting=true;});return json();};return response;}
  return Response.json(value);
 }});
 try{await queryKnown(f,data.ref);await f.settle(()=>hasOriginal(f));const before=f.buffer(),calls=f.calls.length,button=f.button(responsibilityButton),props=Object.keys(button).find(k=>k.startsWith('__reactProps'))!;
  await ui.React.act(async()=>{(button as any)[props].onClick();(button as any)[props].onClick();});await f.settle(()=>waiting);
  assert.equal(f.calls.slice(calls).filter(v=>v.path===rolePath).length,1);
  if(change==='닫기')await f.click('준비기록 원문 닫기');
  else if(change==='기록ABA'){await f.click('준비기록 원문 닫기');await queryKnown(f,data.ref);await f.settle(()=>hasOriginal(f));}
  else if(change==='주체ABA'){const p=f.props();await f.render({...p,session:{...p.session,csrfToken:'d'.repeat(43)}});await f.render(p);}
  else{const transport=f.client.transport;f.client.transport=(...args:any[])=>transport(...args);await f.render();f.client.transport=transport;await f.render();}
  await ui.React.act(async()=>{release();await new Promise(r=>setImmediate(r));});
  assert.equal(f.lost(),0);assert.doesNotMatch(f.text(),/AUTH_REQUIRED/);assert.ok(!f.nodes().some(n=>n.getAttribute('aria-label')==='당시 책임 관계 고정 원문'));assert.equal(f.buffers[before.key],before);
  if(phase==='role')assert.equal(f.calls.slice(calls).filter(v=>v.path===bindingPath).length,0);assert.ok(f.calls.every(v=>v.method==='GET'));
 }finally{release();await f.close();}
});
const selectHistoricalContextButton='당시 맥락을 현재 새 준비기록에 선택';
for(const mode of ['401','403','hash','assignment'] as const){
 test('보관 맥락 재사용 · '+mode+' 재검산 실패는 초안과 원 기록을 보존한다',async()=>{
  const context=historicalContext(),data=recordWithContext(context.ref),path='/api/v1/projects/'+pid+'/context/'+context.ref.id+'/versions/1';let reads=0;
  const f=await host({knownRecord:{data},historicalGet:p=>{
   if(p!==path)return;reads++;if(reads===1)return Response.json(context);
   if(mode==='401'||mode==='403')return Response.json({code:'ACCESS_DENIED'},{status:Number(mode)});
   const value=structuredClone(context);if(mode==='hash')value.ref.contentHash='f'.repeat(64);
   else{value.manifest.assignmentRef={...value.manifest.assignmentRef,contentHash:'f'.repeat(64)};value.ref.contentHash=hash(value.manifest);}
   return Response.json(value);
  }});
  try{await openHistoricalContext(f,data);const before=f.buffer();await f.click(selectHistoricalContextButton);
   await f.settle(()=>!f.button(selectHistoricalContextButton).disabled);assert.equal(f.buffer(),before);assert(hasOriginal(f));assert.equal(f.lost(),mode==='401'?1:0);assert.equal(reads,2);assert(f.calls.every(c=>c.method==='GET'));
  }finally{await f.close();}
 });
}

for(const mode of ['닫기','기록재조회','맥락재조회','버퍼ABA','주체ABA','transport'] as const){
 for(const status of [200,401])test('보관 맥락 재사용 · '+mode+' 뒤 늦은 '+status+'는 새 초안을 바꾸지 않는다',async()=>{
  const context=historicalContext(),data=recordWithContext(context.ref),path='/api/v1/projects/'+pid+'/context/'+context.ref.id+'/versions/1';let reads=0,release=()=>{},waiting=false;
  const f=await host({knownRecord:{data},historicalGet:p=>{
   if(p!==path)return;reads++;if(reads!==2)return Response.json(context);
   const response=Response.json(status===200?context:{code:'AUTH_REQUIRED'},{status}),json=response.json.bind(response);
   response.json=async()=>{await new Promise<void>(resolve=>{release=resolve;waiting=true;});return json();};return response;
  }});
  try{await openHistoricalContext(f,data);const before=f.buffer(),button=f.button(selectHistoricalContextButton),propsKey=Object.keys(button).find(k=>k.startsWith('__reactProps'))!,lookup=f.button('알려진 준비기록 고정 조회'),lookupProps=Object.keys(lookup).find(k=>k.startsWith('__reactProps'))!;
   await ui.React.act(async()=>{(button as any)[propsKey].onClick();(button as any)[propsKey].onClick();if(mode==='기록재조회')(lookup as any)[lookupProps].onClick();});await f.settle(()=>waiting);assert.equal(reads,2);
   if(mode==='닫기')await f.click('준비기록 원문 닫기');
   else if(mode==='기록재조회'||mode==='맥락재조회'){await f.settle(()=>hasOriginal(f));await f.click(contextButton);await f.settle(()=>reads===3&&f.nodes().some(n=>n.getAttribute('aria-label')==='당시 맥락 고정 원문'));}
   else if(mode==='버퍼ABA'){f.buffers[before.key]=ui.api.editPreparation(before,{reason:'새 초안 편집'});await f.render();f.buffers[before.key]=before;await f.render();}
   else if(mode==='주체ABA'){const original=f.props();await f.render({...original,session:{...original.session,clientId:id(98)}});await f.render(original);}
   else{const original=f.client.transport;f.client.transport=(...args:any[])=>original(...args);await f.render();f.client.transport=original;await f.render();}
   await ui.React.act(async()=>{release();await new Promise(resolve=>setImmediate(resolve));});
   if(mode==='닫기'||mode==='기록재조회'||mode==='맥락재조회'||mode==='버퍼ABA')await f.settle(()=>!f.button('준비기록 원명령 준비').disabled);
   assert.equal(f.buffers[before.key],before);assert.equal(f.lost(),0);assert.doesNotMatch(f.text(),/AUTH_REQUIRED/);assert(f.calls.every(c=>c.method==='GET'));
   if(mode==='닫기'||mode==='기록재조회'||mode==='맥락재조회'||mode==='버퍼ABA')assert.equal(f.button('준비기록 원명령 준비').disabled,false);
  }finally{release();await f.close();}
 });
}

test('보관 맥락 재사용 · PREPARED와 UNKNOWN 원명령에는 선택 동작이 없다',async()=>{
 const context=historicalContext(),data=recordWithContext(context.ref),path='/api/v1/projects/'+pid+'/context/'+context.ref.id+'/versions/1';
 const f=await host({knownRecord:{data},historicalGet:p=>p===path?Response.json(context):undefined});
 try{await prepared(f);for(const unknown of [false,true]){
  if(unknown){const old=f.buffer();f.buffers[old.key]=ui.api.markPreparationDispatch(old);await f.render();}
  const before=f.buffer();await openHistoricalContext(f,data);assert.equal(f.buttons(selectHistoricalContextButton).length,0);assert.equal(f.buffer(),before);
 }assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});
test('보관 맥락 재사용 · 최근 목록 밖 exact 맥락을 명시 선택하고 원명령 준비에서 다시 검산한다',async()=>{
 const context=historicalContext(),data=recordWithContext(context.ref),path='/api/v1/projects/'+pid+'/context/'+context.ref.id+'/versions/1';
 const f=await host({knownRecord:{data},historicalGet:p=>p===path?Response.json(context):undefined});
 try{
  await chooseNull(f);const before=f.buffer(),record=canonicalJson(data);
  assert.equal(f.buttons('맥락 '+context.ref.id+' 고정 선택').length,0);
  await openHistoricalContext(f,data);assert.equal(f.buffer(),before);
  assert.equal(f.calls.filter(c=>c.path===path).length,1);
  await f.click(selectHistoricalContextButton);await f.settle(()=>f.buffer()!==before);
  assert.deepEqual(f.buffer().contextRef,context.ref);assert.equal(f.buffer().contextSelected,true);assert.equal(f.buffer().pending,null);
  assert.equal(f.buffer().reason,before.reason);assert.equal(canonicalJson(data),record);assert(hasOriginal(f));
  assert.equal(f.calls.filter(c=>c.path===path).length,2);
  await f.click('준비기록 원명령 준비');await f.settle(()=>f.buffer().pending?.state==='PREPARED');
  assert.deepEqual(f.buffer().pending.command.payload.contextRef,context.ref);
  assert.equal(f.calls.filter(c=>c.path===path).length,3);assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});
test('과거 대상 연결 · 같은 참조 재조회가 배치되어도 이전 표시를 폐기한다',async()=>{
 const target=historicalTarget(),data=recordWithTarget(target.ref),path='/api/v1/projects/'+pid+'/connections/'+target.ref.id+'/versions/2';
 const f=await host({empty:true,knownRecord:{data},historicalGet:p=>p===path?Response.json(target):undefined});
 try{
  await queryKnown(f,data.ref);await f.settle(()=>hasOriginal(f));await f.click(targetButton);
  await f.settle(()=>f.text().includes(target.definition.label));
  const button=f.button('알려진 준비기록 고정 조회'),propsKey=Object.keys(button).find(k=>k.startsWith('__reactProps'))!;
  await ui.React.act(async()=>{(button as any)[propsKey].onClick();await new Promise(resolve=>setTimeout(resolve,30));});
  assert.ok(hasOriginal(f));assert.doesNotMatch(f.text(),/저장된 원 대상 정의/);
  assert.equal(f.calls.filter(c=>c.path===path).length,1);
  await f.click(targetButton);await f.settle(()=>f.text().includes(target.definition.label));
  assert.equal(f.calls.filter(c=>c.path===path).length,2);assert.ok(f.calls.every(c=>c.method==='GET'));assert.deepEqual(f.buffers,{});
 }finally{await f.close();}
});

for(const mode of ['hash','body','project','state','403','401'] as const){
 test('과거 대상 연결 · '+mode+' 거절은 정의 본문·POST를 만들지 않는다',async()=>{
  const target=historicalTarget(),data=recordWithTarget(target.ref),path='/api/v1/projects/'+pid+'/connections/'+target.ref.id+'/versions/2';
  const f=await host({empty:true,knownRecord:{data},historicalGet:p=>{
   if(p!==path)return;
   if(mode==='401'||mode==='403')return Response.json({code:'ACCESS_DENIED'},{status:Number(mode)});
   const response=structuredClone(target);
   if(mode==='hash')response.ref.contentHash='a'.repeat(64);
   if(mode==='body')response.definition.label='변조된 대상 정의';
   if(mode==='project')response.projectId=id(98);
   if(mode==='state')Object.assign(response.currentStatus,{support:'READY',executionAuthorized:true});
   return Response.json(response);
  }});
  try{
   await queryKnown(f,data.ref);await f.settle(()=>hasOriginal(f));await f.click(targetButton);
   await f.settle(()=>f.text().includes(mode==='401'||mode==='403'?'ACCESS_DENIED':'CONNECTION_RESPONSE_INVALID'));
   assert.doesNotMatch(f.text(),/저장된 원 대상 정의|변조된 대상 정의/);
   assert.equal(f.calls.filter(c=>c.path===path).length,1);assert.equal(f.lost(),mode==='401'?1:0);
   assert.ok(f.calls.every(c=>c.method==='GET'));assert.deepEqual(f.buffers,{});
  }finally{await f.close();}
 });
}
for(const mode of ['닫기','재조회','기록교체','기록ABA','주체교체'] as const){
 test('과거 대상 연결 · '+mode+' 후 늦은 응답과 인증 콜백을 폐기한다',async()=>{
  const target=historicalTarget(),a=recordWithTarget(target.ref),b=recordWithTarget(null,id(22));
  const path='/api/v1/projects/'+pid+'/connections/'+target.ref.id+'/versions/2';
  let release!:()=>void,reading=false;const gate=new Promise<void>(done=>release=done);
  const lateAuth=mode==='기록ABA'||mode==='주체교체';
  const f=await host({empty:true,knownRecord:{data:a},historicalGet:p=>{
   if(p.endsWith('/transfer-preparations/'+b.ref.id+'/versions/1'))return recordResponse(b);
   if(p!==path)return;
   const response=Response.json(lateAuth?{code:'AUTH_REQUIRED'}:target,{status:lateAuth?401:200}),parse=response.json.bind(response);
   response.json=async()=>{reading=true;await gate;return parse();};return response;
  }});
  try{
   await queryKnown(f,a.ref);await f.settle(()=>hasOriginal(f));
   const button=f.button(targetButton);
   const propsKey=Object.keys(button).find(k=>k.startsWith('__reactProps'))!;
   await ui.React.act(async()=>{(button as any)[propsKey].onClick();(button as any)[propsKey].onClick();});
   await f.settle(()=>reading);assert.equal(f.button(targetButton).disabled,true);
   if(mode==='닫기')await f.click('준비기록 원문 닫기');
   else if(mode==='재조회'){
    await f.click('알려진 준비기록 고정 조회');await f.settle(()=>hasOriginal(f)&&!f.button(targetButton).disabled);
   }else if(mode==='주체교체'){
    const props=f.props();await f.render({...props,session:{...session,user:{id:id(99)}}});await f.render(props);
   }else{
    await queryKnown(f,b.ref);await f.settle(()=>hasOriginal(f)&&f.text().includes('대상 연결 참조 없음'));
    if(mode==='기록ABA'){await queryKnown(f,a.ref);await f.settle(()=>f.buttons(targetButton).length===1);}
   }
   await ui.React.act(async()=>{release();await new Promise(resolve=>setImmediate(resolve));});
   assert.doesNotMatch(f.text(),/저장된 원 대상 정의|AUTH_REQUIRED/);assert.equal(f.lost(),0);
   assert.equal(f.calls.filter(c=>c.path===path).length,1);assert.ok(f.calls.every(c=>c.method==='GET'));assert.deepEqual(f.buffers,{});
  }finally{release();await f.close();}
 });
}

function historicalTarget(label='저장된 원 대상 정의'){
 const definition={id:id(81),version:2,status:'NOT_READY',label,toolProduct:'Claude',toolVersion:'0.3.224',adapterKind:'SDK',
  connectorId:null,accountRef:null,modelOptions:{model:'saved-model'},environmentRef:null,policyRef:{id:id(82),version:1,contentHash:'e'.repeat(64)},capabilityReportRef:null};
 return{projectId:pid,ref:{id:definition.id,version:definition.version,contentHash:hash(definition)},definition,observedAt:at,
  currentStatus:{headVersion:3,configurationCurrent:false,support:'UNVERIFIED',executionAuthorized:false}};
}
function recordWithTarget(targetConnectionRef:ReturnType<typeof historicalTarget>['ref']|null,recordId=id(20)){
 const initial=recordWithBudget(null,recordId).record;
 const record=readPreparationSnapshot({...initial,targetConnectionRef,gaps:targetConnectionRef?initial.gaps.filter(g=>g!=='TARGET_NOT_SELECTED'):initial.gaps});
 return{ref:{id:recordId,version:1,contentHash:hash(record)},record};
}
async function openHistoricalTarget(f:Awaited<ReturnType<typeof host>>,data:ReturnType<typeof recordWithTarget>,target:ReturnType<typeof historicalTarget>){
 await queryKnown(f,data.ref);await f.settle(()=>hasOriginal(f));
 assert.equal(f.buttons(selectHistoricalTargetButton).length,0);
 await f.click(targetButton);await f.settle(()=>f.text().includes(target.definition.label));
}
test('보관 대상은 원문 조회 뒤 명시 재검산으로 선택하고 별도 저장 요청에 정확한 참조만 보낸다',async()=>{
 const target=historicalTarget(),data=recordWithTarget(target.ref,id(96)),path=`/api/v1/projects/${pid}/connections/${target.ref.id}/versions/2`;
 const f=await host({knownRecord:{data},historicalGet:p=>p===path?Response.json(target):undefined});
 try{
  await chooseNull(f);
  const before=f.buffer(),original=canonicalJson(data);
  await openHistoricalTarget(f,data,target);
  assert.equal(f.buffer(),before);
  assert.equal(f.calls.filter(c=>c.path===path).length,1);
  await f.click(selectHistoricalTargetButton);
  await f.settle(()=>f.buffer()?.targetConnectionRef?.id===target.ref.id);
  assert.deepEqual(f.buffer().targetConnectionRef,target.ref);
  assert.equal(f.buffer().targetSelected,true);
  assert.equal(f.buffer().reason,before.reason);
  assert.equal(f.buffer().pending,null);
  assert.equal(canonicalJson(data),original);
  assert(hasOriginal(f));
  assert.equal(f.calls.filter(c=>c.path===path).length,2);
  assert(f.calls.every(c=>c.method==='GET'));
  await f.click('준비기록 원명령 준비');
  await f.settle(()=>f.buffer().pending?.state==='PREPARED');
  assert.deepEqual(f.buffer().pending.command.payload.targetConnectionRef,target.ref);
  assert(f.calls.every(c=>c.method==='GET'));
  await f.click('같은 준비기록 명령 저장·재확인');
  await f.settle(()=>f.buffer()?.pending?.state==='STORED'&&hasOriginal(f));
  const writes=f.calls.filter(c=>c.method==='POST');
  assert.equal(writes.length,1);
  const {operation,payload}=JSON.parse(writes[0]!.body!);
  assert.equal(operation,'createTransferPreparationRecord');
  assert.deepEqual(payload.targetConnectionRef,target.ref);
  assert.deepEqual(Object.keys(payload).sort(),['assignmentRef','contextRef','intentExpiresAt','oldBindingRef','reason','roleRef','targetConnectionRef']);
  assert.equal(canonicalJson(data),original);
 }finally{await f.close();}
});

for(const mode of ['401','403','404','hash'] as const)test('보관 대상 선택 · '+mode+' 이후에도 현재 초안과 보관 원문을 보존한다',async()=>{
 const target=historicalTarget(),data=recordWithTarget(target.ref),path=`/api/v1/projects/${pid}/connections/${target.ref.id}/versions/2`;
 let reads=0;
 const f=await host({knownRecord:{data},historicalGet:p=>{
  if(p!==path)return;
  if(++reads===1)return Response.json(target);
  if(mode!=='hash')return Response.json({code:'ACCESS_DENIED'},{status:Number(mode)});
  const corrupt=structuredClone(target);
  corrupt.definition.label='다른 정의';
  corrupt.ref.contentHash=hash(corrupt.definition);
  return Response.json(corrupt);
 }});
 try{
  await openHistoricalTarget(f,data,target);
  const before=f.buffer();
  await f.click(selectHistoricalTargetButton);
  await f.settle(()=>!f.button(selectHistoricalTargetButton).disabled);
  assert.equal(reads,2);
  assert.equal(f.buffer(),before);
  assert(hasOriginal(f));assert.match(f.text(),/저장된 원 대상 정의/);
  assert.match(f.text(),/ACCESS_DENIED|CONNECTION_.*INVALID/);
  assert.equal(f.lost(),mode==='401'?1:0);
  assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});

for(const replacement of ['close','reload','manual','draftABA','locked','actorABA','transportABA'] as const){
 for(const status of [200,401])test(`보관 대상 선택 · ${replacement} 뒤 지연 ${status}와 연속 선택은 반영하지 않는다`,async()=>{
  const target=historicalTarget(),data=recordWithTarget(target.ref),path=`/api/v1/projects/${pid}/connections/${target.ref.id}/versions/2`;
  let reads=0,waiting=false,release=()=>{};
  const f=await host({knownRecord:{data},historicalGet:p=>{
   if(p!==path)return;
   if(++reads!==2)return Response.json(target);
   const response=Response.json(status===200?target:{code:'AUTH_REQUIRED'},{status}),json=response.json.bind(response);
   response.json=async()=>{await new Promise<void>(resolve=>{release=resolve;waiting=true;});return json();};
   return response;
  }});
  try{
   await chooseNull(f);
   await openHistoricalTarget(f,data,target);
   const before=f.buffer(),button=f.button(selectHistoricalTargetButton),manual=f.button('등록 대상 보호 조회·선택'),prepare=f.button('준비기록 원명령 준비');
   const reason=f.nodes().find(n=>n.getAttribute('aria-label')==='준비기록 이유')!;
   const editReason=(reason as any)[Object.keys(reason).find(k=>k.startsWith('__reactProps'))!].onChange;
   const invoke=(n:MemoryNode)=>(n as any)[Object.keys(n).find(k=>k.startsWith('__reactProps'))!].onClick();
   await ui.React.act(async()=>{invoke(button);invoke(button);invoke(manual);invoke(prepare);});
   await f.settle(()=>waiting);assert.equal(reads,2);
   if(replacement==='close'){
    await f.click('준비기록 원문 닫기');
   }else if(replacement==='reload'){
    await f.click(targetButton);await f.settle(()=>reads===3&&f.text().includes(target.definition.label));
   }else if(replacement==='manual'){
    // 잠금 렌더 전에 수집된 편집 이벤트가 적용되면 대기 중 선택이 그 초안을 덮을 수 없다.
    await ui.React.act(async()=>editReason({target:{value:'대기 중 수기 입력'}}));
    assert.equal(f.buffer().reason,'대기 중 수기 입력');
   }else if(replacement==='draftABA'){
    f.buffers[before.key]=ui.api.editPreparation(before,{reason:'교체 임시 초안'});await f.render();
    f.buffers[before.key]=before;await f.render();
   }else if(replacement==='locked'){
    // 동일 초안이 저장 잠금을 획득한 경우의 상위 저장소 교체를 모사한다.
    f.buffers[before.key]=await ui.api.prepareRecord(f.client,session,f.f.confirmed,before,()=>true);await f.render();
    assert.equal(f.buttons(selectHistoricalTargetButton).length,0);
   }else if(replacement==='actorABA'){
    const original=f.props();await f.render({...original,session:{...session,clientId:id(98)}});await f.render(original);
   }else{
    const original=f.client.transport;
    f.client.transport=(...args:any[])=>original(...args);await f.render();f.client.transport=original;await f.render();
   }
   const expected=f.buffers[before.key];
   await ui.React.act(async()=>{release();await new Promise(resolve=>setImmediate(resolve));});
   assert.equal(f.buffers[before.key],expected);
   assert.equal(expected.targetConnectionRef,null);
   assert.equal(f.lost(),0);
   assert.doesNotMatch(f.text(),/AUTH_REQUIRED/);
   assert(f.calls.every(c=>c.method==='GET'));
  }finally{release();await f.close();}
 });
}
test('과거 대상 연결 · 명시 클릭 1GET과 참조 부재 GET0',async()=>{
 for(const missing of [false,true]){
  const target=historicalTarget(),data=recordWithTarget(missing?null:target.ref);
  const path='/api/v1/projects/'+pid+'/connections/'+target.ref.id+'/versions/2';
  const f=await host({empty:true,knownRecord:{data},historicalGet:p=>p===path?Response.json(target):undefined});
  try{
   await queryKnown(f,data.ref);await f.settle(()=>hasOriginal(f));
   assert.equal(f.calls.filter(c=>c.path.includes('/connections/')).length,0);
   if(missing)assert.equal(f.buttons(targetButton).length,0);
   else{
    await f.click(targetButton);await f.settle(()=>f.text().includes(target.definition.label));
    assert.deepEqual(f.calls.filter(c=>c.path.includes('/connections/')).map(c=>[c.method,c.path]),[['GET',path]]);
    assert.ok(f.text().includes('NOT_READY'));assert.ok(f.text().includes('UNVERIFIED'));assert.ok(f.text().includes(target.ref.contentHash));
   }
   assert.deepEqual(f.buffers,{});assert.ok(f.calls.every(c=>c.method==='GET'));
  }finally{await f.close();}
 }
});

import {fileURLToPath} from 'node:url';
import {transferFixture,pid,at} from './transfer-fixture.ts';
import {originalFixture} from './transfer-original-fixture.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readCandidateInput,candidateReadiness,candidateCapabilities} from '../../../apps/server/modules/connections/candidate-input.ts';
import {readPreparationSnapshot,readPreparationReceipt,readPreparationGet,permanentGaps} from '../../../apps/server/modules/transfers/preparation-record-input.ts';

/** 실제 ReactDOM의 요소/이벤트/effect를 실행하는 최소 메모리 DOM. 레이아웃·브라우저 보안·시각 검증은 아니다. */
class MemoryNode{
 nodeType:number;nodeName:string;tagName:string;localName:string;namespaceURI='http://www.w3.org/1999/xhtml';parentNode:MemoryNode|null=null;childNodes:MemoryNode[]=[];ownerDocument:any;attributes=new Map<string,string>();style:Record<string,unknown>={};listeners=new Map<string,Function[]>();value='';checked=false;disabled=false;data='';
 constructor(name:string,type=1,owner?:any){this.nodeType=type;this.nodeName=type===1?name.toUpperCase():name;this.tagName=this.nodeName;this.localName=name;this.ownerDocument=owner;}
 get options():MemoryNode[]{return this.childNodes.flatMap(n=>n.tagName==='OPTION'?[n]:n.options);}
 get firstChild():MemoryNode|null{return this.childNodes[0]??null;}get lastChild():MemoryNode|null{return this.childNodes.at(-1)??null;}get nextSibling():MemoryNode|null{const a=this.parentNode?.childNodes;return a?.[a.indexOf(this)+1]??null;}
 get nodeValue():string|null{return this.nodeType===3?this.data:null;}set nodeValue(v:string|null){if(this.nodeType===3)this.data=v??'';}
 get textContent():string{return this.nodeType===3?this.data:this.childNodes.map(n=>n.textContent).join('');}
 set textContent(v:string){if(this.nodeType===3){this.data=String(v);return;}for(const n of this.childNodes)n.parentNode=null;this.childNodes=[];if(v)this.appendChild(this.ownerDocument.createTextNode(String(v)));}
 appendChild(n:MemoryNode){if(n.parentNode)n.parentNode.removeChild(n);n.parentNode=this;this.childNodes.push(n);return n;}
 insertBefore(n:MemoryNode,b:MemoryNode){if(n.parentNode)n.parentNode.removeChild(n);n.parentNode=this;const i=this.childNodes.indexOf(b);assert(i>=0);this.childNodes.splice(i,0,n);return n;}
 removeChild(n:MemoryNode){const i=this.childNodes.indexOf(n);assert(i>=0);this.childNodes.splice(i,1);n.parentNode=null;return n;}
 setAttribute(k:string,v:unknown){this.attributes.set(k,String(v));if(k==='disabled')this.disabled=true;}removeAttribute(k:string){this.attributes.delete(k);if(k==='disabled')this.disabled=false;}getAttribute(k:string){return this.attributes.get(k)??null;}
 addEventListener(k:string,f:Function){this.listeners.set(k,[...(this.listeners.get(k)??[]),f]);}removeEventListener(k:string,f:Function){this.listeners.set(k,(this.listeners.get(k)??[]).filter(v=>v!==f));}
 contains(n:MemoryNode|null):boolean{return !!n&&(n===this||this.childNodes.some(c=>c.contains(n)));}focus(){this.ownerDocument.activeElement=this;}
 dispatchEvent(e:any){e.target=this;e.preventDefault??=()=>{e.defaultPrevented=true;};e.stopPropagation??=()=>{e.cancelBubble=true;};const chain:MemoryNode[]=[];for(let n:MemoryNode|null=this;n;n=n.parentNode)chain.push(n);for(const n of chain)for(const f of n.listeners.get(e.type)??[])f(e);return !e.defaultPrevented;}
}
const document:any=new MemoryNode('#document',9);document.ownerDocument=document;document.createElement=(n:string)=>new MemoryNode(n,1,document);document.createElementNS=(_ns:string,n:string)=>document.createElement(n);document.createTextNode=(s:string)=>{const n=new MemoryNode('#text',3,document);n.data=s;return n;};document.documentElement=document.createElement('html');document.body=document.createElement('body');document.documentElement.appendChild(document.body);document.activeElement=document.body;
const saved=new Map<string,PropertyDescriptor|undefined>();let ui:any;
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/transfers/TransferPreparationPage.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:history-decision',name:'HistoryDecisionTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'history-memory-entry',resolveId(id){if(id.endsWith('virtual:history-decision'))return '\0history-decision';},load(id){if(id==='\0history-decision')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{TransferPreparationPage}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import * as api from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/transfers/preparation-record-api.ts',import.meta.url)))};import * as harness from${JSON.stringify(fileURLToPath(new URL('../../../tests/browser/UI09/preparation-record-dom-harness.tsx',import.meta.url)))};export{React,createRoot,TransferPreparationPage,ApiClient,api,harness};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const [key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return HistoryDecisionTest;')();
});
after(()=>{for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});


/** 실제 Page→기존 decoder→명시 합성 GET까지만 검증한다. native 입력·실API·App route 종단은 아니다. */
test('고정 확정임무를 실제 조회한 Page에서 사용자가 새 준비기록을 명시 작성할 수 있다',async()=>{
 const f=transferFixture(),calls:{path:string;method:string}[]=[],client=new ui.ApiClient(async(url:any,options:any)=>{
  const method=options?.method??'GET',path=new URL(String(url),'https://anvil.invalid').pathname;calls.push({path,method});assert.equal(method,'GET');
  const value=f.responses[path.slice(('/api/v1/projects/'+pid+'/').length)];assert(value,'미모델 요청 '+path);return Response.json(value);
 });
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);let lost=0,buffer:any=null;
 const props:any={client,projectId:pid,assignmentRef:f.draft.ref,session:{user:{id:pid},clientId:'44444444-4444-4444-8444-444444444444',csrfToken:'c'.repeat(43)},buffer,onAuthenticationLost:()=>{lost++;}};
 props.preparation={buffers:{},onChange:(expected:any,next:any)=>{if(buffer!==expected)return false;buffer=next;props.preparation.buffers[next.key]=next;root.render(ui.React.createElement(ui.TransferPreparationPage,props));return true;}};
 const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))];
 const button=(label:string)=>{const found=nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent===label);assert.equal(found.length,1,label+' 버튼');return found[0]!;};
 const click=async(label:string)=>{const node=button(label);assert(!node.disabled);await ui.React.act(async()=>node.dispatchEvent({type:'click',button:0,bubbles:true}));};
 try{
  await ui.React.act(async()=>root.render(ui.React.createElement(ui.TransferPreparationPage,props)));assert.equal(calls.length,0);
  await click('기존 인계 기록 조회');const end=Date.now()+2000;while(calls.length<5&&!container.textContent.includes('TRANSFER_')&&Date.now()<end)await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,2));});
  await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
  assert.equal(calls.length,5);assert.equal(lost,0);assert.match(container.textContent,/인계 기록 다시 조회/);assert.match(container.textContent,/보관 맥락 후보/);
  await click('새 준비기록 작성');assert(buffer,'부모 전용 준비기록 buffer');assert(calls.every(c=>c.method==='GET'),'조회와 작성 진입만으로 POST하지 않음');
 }finally{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
});

const id=(n:number)=>'ad140001-0000-4000-8000-'+String(n).padStart(12,'0'),hash=(v:unknown)=>contentHash(canonicalJson(v));
const session={user:{id:pid},clientId:id(2),csrfToken:'c'.repeat(43)};
function seed(){const f=transferFixture(),roleSnapshot={kind:'COORDINATOR',stageRef:null,parentRoleRef:null,reason:'고정 총괄 역할',definedBy:{kind:'HUMAN',userId:pid},definedAt:at},role={projectId:pid,ref:{id:id(3),version:1,contentHash:hash(roleSnapshot)},snapshot:roleSnapshot},task=f.confirmed.snapshot.definition.taskRef,stageSnapshot={...roleSnapshot,kind:'STAGE_OWNER',stageRef:{applicationRef:task.applicationRef,nodeId:task.nodeId},parentRoleRef:role.ref},stage={projectId:pid,ref:{id:id(4),version:1,contentHash:hash(stageSnapshot)},snapshot:stageSnapshot};
 const bindingSnapshot={assignmentRef:f.confirmed.ref,roleRef:stage.ref,connectionRef:{id:id(5),version:1,contentHash:'e'.repeat(64)},existingSessionBindingRef:null,reason:'같은 임무의 과거 예약',sessionRef:{id:id(6),version:1,contentHash:'d'.repeat(64)},generation:1,state:'RESERVED',externalSessionHandleRef:null,connectionReadiness:'CANDIDATE_ONLY',executionAuthorized:false,dispatchPerformed:false,boundBy:{kind:'HUMAN',userId:pid},boundAt:at},binding={projectId:pid,ref:{id:id(7),version:1,contentHash:hash(bindingSnapshot)},snapshot:bindingSnapshot};
 f.state.roles.push(role as never,stage as never);f.state.bindings.push(binding as never);Object.assign(f.responses,{['project-roles/'+role.ref.id+'/versions/1']:role,['project-roles/'+stage.ref.id+'/versions/1']:stage,['role-bindings/'+binding.ref.id+'/versions/1']:binding});return{...f,role,stage,binding};}
function receipt(command:any,recordId=id(20)){const payload=command.payload,observedAt=new Date().toISOString(),hasContext=payload.contextRef!==null;
 const gaps=[...permanentGaps,...(hasContext?['CONTEXT_REQUIRED_MISSING']:['CONTEXT_NOT_COLLECTED']),...(!payload.roleRef?['ROLE_NOT_SELECTED']:[]),...(!payload.oldBindingRef?['OLD_BINDING_NOT_COLLECTED']:[]),...(!payload.targetConnectionRef?['TARGET_NOT_SELECTED']:[]),'TARGET_CAPABILITIES_UNVERIFIED'];
 const record=readPreparationSnapshot({schemaVersion:1,id:recordId,projectId:pid,version:1,kind:'TRANSFER_PREPARATION_RECORD',state:'PREPARATION_ONLY',...payload,baselineRefs:[],budgetRef:null,sourceRefs:[],requiredContext:['PURPOSE_REASON','RULES_SCOPE','LATEST_INSTRUCTIONS','DECISIONS_REASON','CURRENT_POSITION','ACTUAL_GAPS','NEXT_ACTION'].map(code=>({code,state:hasContext?'MISSING_OR_EXCLUDED':'NOT_COLLECTED'})),gaps,observedAt,preparationStored:true,manifestStored:false,bindingFrozen:false,ready:false,resumeAuthorized:false,executionAuthorized:false,dispatchPerformed:false});
 const ref={id:record.id,version:1,contentHash:hash(record)};return readPreparationReceipt({operationId:id(21),commandId:command.commandId,projectId:pid,status:'APPLIED',targetId:record.id,version:1,data:{ref,record,preparationStored:true,manifestStored:false},evidenceRefs:[],warnings:[],serverReceivedAt:observedAt}) as any;
}
async function host(options:{targetDenied?:boolean;registered?:boolean;otherAssignment?:boolean;empty?:boolean;readerSession?:any;knownRecord?:any;controlDenied?:boolean;historicalGet?:(path:string)=>Promise<Response>|Response|undefined}={}){const f=seed();if(options.registered){Object.assign(f.binding.snapshot,{connectionKind:'REGISTERED_DEFINITION',connectionReadiness:'REGISTERED_DEFINITION_ONLY'});f.binding.ref.contentHash=hash(f.binding.snapshot);}if(options.otherAssignment){f.binding.snapshot.assignmentRef={...f.confirmed.ref,contentHash:'f'.repeat(64)};f.binding.ref.contentHash=hash(f.binding.snapshot);}const controlDenied=options.controlDenied,targetDenied=options.targetDenied,calls:{path:string;method:string;body?:string}[]=[],modes={post:'OK',get:'OK',control:'OK'},waiting:{release:((r:Response)=>void)|null;fixed:(()=>void)|null}={release:null,fixed:null};let saved:any=options.knownRecord??null,lost=0;
 const historicalGet=options.historicalGet,records=new Map<string,any>(),commands=new Map<string,any>();
 const transport=async(url:any,options:any)=>{const path=new URL(String(url),'https://anvil.invalid').pathname,method=options?.method??'GET';calls.push({path,method,body:options?.body});if(method==='POST'){if(modes.post==='LOST')throw Error('합성 단절');if(modes.post==='409')return Response.json({code:'VERSION_CONFLICT'},{status:409});if(modes.post==='DELAY')return new Promise<Response>(r=>waiting.release=r);const command=JSON.parse(options.body);saved=commands.get(command.commandId)??receipt(command,id(20+commands.size));commands.set(command.commandId,saved);records.set(saved.data.ref.id,saved);return Response.json(saved);}
  const historical=historicalGet?.(path);if(historical)return historical;
  if(path==='/api/v1/projects/'+pid&&(controlDenied||modes.control==='403'))return Response.json({code:'PROJECT_CONTROL_REQUIRED'},{status:403});if(path==='/api/v1/projects/'+pid)return Response.json({id:pid,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:3,status:'HELD'}});
  if(path.includes('/transfer-preparations/')){saved=records.get(path.split('/').at(-3)!)??saved;if(['WAIT200','WAIT401'].includes(modes.get)){const observedAt=new Date().toISOString(),value=modes.get==='WAIT401'?{code:'AUTH_REQUIRED'}:readPreparationGet({projectId:pid,ref:saved.data.ref,record:saved.data.record,observedAt,currentStatus:{intentExpired:Date.parse(saved.data.record.intentExpiresAt)<=Date.parse(observedAt),usableForTransfer:false,sourceCurrentness:'NOT_REVALIDATED'},preparationStored:true,manifestStored:false}),response=Response.json(value,{status:modes.get==='WAIT401'?401:200}),native=response.json.bind(response);response.json=async()=>{await new Promise<void>(resolve=>waiting.fixed=resolve);return native();};return response;}if(modes.get!=='OK')return Response.json({code:'ACCESS_DENIED'},{status:Number(modes.get)});const observedAt=new Date().toISOString();return Response.json(readPreparationGet({projectId:pid,ref:saved.data.ref,record:saved.data.record,observedAt,currentStatus:{intentExpired:Date.parse(saved.data.record.intentExpiresAt)<=Date.parse(observedAt),usableForTransfer:false,sourceCurrentness:'NOT_REVALIDATED'},preparationStored:true,manifestStored:false}));}
  if(targetDenied&&path===`/api/v1/projects/${pid}/connections/${id(80)}/versions/1`)return Response.json({code:'ACCESS_DENIED'},{status:403});
  const value=f.responses[path.slice(('/api/v1/projects/'+pid+'/').length)];assert(value,'미모델 '+path);return Response.json(value);
 };
 const client=new ui.ApiClient(transport),container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container),buffers:Record<string,any>={};let props:any={client,projectId:pid,assignmentRef:f.draft.ref,session:options.readerSession??session,onAuthenticationLost:()=>{lost++;}};
 props.preparation={buffers,onChange:(expected:any,next:any)=>{const old=buffers[next.key]??null,merged=ui.api.mergePreparation(old,expected,next);if(merged===old)return false;buffers[next.key]=merged;root.render(ui.React.createElement(ui.TransferPreparationPage,props));return true;}};
 const render=async(p=props)=>{props=p;await ui.React.act(async()=>root.render(ui.React.createElement(ui.TransferPreparationPage,props)));},nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))],buttons=(label:string)=>nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent===label),button=(label:string)=>{const n=buttons(label);assert.equal(n.length,1,label);return n[0]!;},click=async(label:string)=>{const n=button(label);assert(!n.disabled,label);await ui.React.act(async()=>n.dispatchEvent({type:'click',button:0,bubbles:true}));},change=async(label:string,value:string)=>{const n=nodes().find(n=>n.getAttribute('aria-label')===label);assert(n,label);const k=Object.keys(n).find(k=>k.startsWith('__reactProps'));assert(k,label);await ui.React.act(async()=>{(n as any)[k].onChange({target:{value}});});},settle=async(check:()=>boolean)=>{const end=Date.now()+2000;while(!check()&&Date.now()<end)await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,2));});assert(check(),container.textContent.slice(-900));};
 await render();await click('기존 인계 기록 조회');await settle(()=>buttons('새 준비기록 작성').length===1);if(!options.empty)await click('새 준비기록 작성');return{f,client,calls,modes,waiting,buffers,props:()=>props,render,nodes,buttons,button,click,change,settle,text:()=>container.textContent,lost:()=>lost,buffer:()=>buffers[ui.api.preparationKey(props.session,pid,f.confirmed.ref)],close:async()=>{waiting.fixed?.();waiting.release?.(Response.json({code:'VERSION_CONFLICT'},{status:409}));await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
async function chooseNull(f:Awaited<ReturnType<typeof host>>){await f.change('준비기록 이유','정확 준비기록 선택');for(const label of['맥락 미수집 명시 선택','역할 미선택 명시','기존 결박 미수집 명시 선택','대상 미선택 명시'])await f.click(label);}
async function prepared(f:Awaited<ReturnType<typeof host>>){await chooseNull(f);await f.click('준비기록 원명령 준비');await f.settle(()=>f.buffer()?.pending?.state==='PREPARED');}

test('독립 준비기록 · A 영수증을 보존하며 명시 B 저장과 각각 정확 조회',async()=>{
 const f=await host();try{
  await prepared(f);await f.click('같은 준비기록 명령 저장·재확인');await f.settle(()=>hasOriginal(f));
  const a=structuredClone(f.buffer().pending),count=f.calls.length;
  await f.click('다음 독립 준비기록 작성');assert.equal(f.calls.length,count);assert.equal(f.buffer().pending,null);
  assert.deepEqual(f.buffer().storedCommands,[a]);assert.equal(f.buffer().reason,'');
  await prepared(f);await f.change('준비기록 조회 ID','');
  assert.notEqual(f.buffer().pending.command.commandId,a.command.commandId);
  await f.click('같은 준비기록 명령 저장·재확인');await f.settle(()=>hasOriginal(f));
  const b=structuredClone(f.buffer().pending);assert.notDeepEqual(a.receipt.data.ref,b.receipt.data.ref);
  await f.click('보존 준비기록 '+a.receipt.data.ref.id+' 고정 조회');await f.settle(()=>hasOriginal(f)&&f.text().includes(JSON.stringify(a.receipt.data.record,null,2)));
  assert.deepEqual(f.buffer().pending,b);await f.click('저장 준비기록 고정 조회');await f.settle(()=>hasOriginal(f)&&f.text().includes(JSON.stringify(b.receipt.data.record,null,2)));
  assert.equal(f.calls.filter(c=>c.method==='POST').length,2);
 }finally{await f.close();}
});

test('독립 준비기록 · GET503 영수증 보존·중복 새 작성·UNKNOWN 전환 금지',async()=>{
 const f=await host();try{
  await prepared(f);assert.equal(f.buttons('다음 독립 준비기록 작성').length,0);
  f.modes.get='503';await f.click('같은 준비기록 명령 저장·재확인');await f.settle(()=>f.buffer().failure?.status===503);
  const a=structuredClone(f.buffer().pending),button=f.button('다음 독립 준비기록 작성');
  const propsKey=Object.keys(button).find(k=>k.startsWith('__reactProps'))!;
  await ui.React.act(async()=>{(button as any)[propsKey].onClick();(button as any)[propsKey].onClick();});
  assert.equal(f.buffer().pending,null);assert.deepEqual(f.buffer().storedCommands,[a]);assert.equal(f.buffer().reason,'');
  f.modes.get='OK';await f.click('보존 준비기록 '+a.receipt.data.ref.id+' 고정 조회');await f.settle(()=>hasOriginal(f));
  assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
  await prepared(f);f.modes.post='DELAY';await f.click('같은 준비기록 명령 저장·재확인');
  const b=f.buffer();assert.equal(f.buttons('다음 독립 준비기록 작성').length,0);
  assert.throws(()=>ui.api.nextPreparation(f.client,session,f.f.confirmed,b));
  f.waiting.release!(Response.json({code:'REQUEST_FAILED'},{status:503}));await f.settle(()=>f.buffer().failure);
  assert.equal(f.buffer().pending.state,'UNKNOWN');assert.deepEqual(f.buffer().storedCommands,[a]);
  assert.throws(()=>ui.api.nextPreparation(f.client,session,f.f.confirmed,f.buffer()));
  const body=f.buffer().pending.body;f.modes.post='OK';await f.click('같은 준비기록 명령 저장·재확인');await f.settle(()=>hasOriginal(f));
  assert.deepEqual(f.calls.filter(c=>c.method==='POST').slice(1).map(c=>c.body),[body,body]);
 }finally{await f.close();}
});

for(const status of ['WAIT200','WAIT401'])test('독립 준비기록 · '+status+' A 조회 중 전환 차단·주체 ABA 뒤 폐기',async()=>{
 const f=await host();try{
  await prepared(f);await f.click('같은 준비기록 명령 저장·재확인');await f.settle(()=>hasOriginal(f));
  const a=structuredClone(f.buffer().pending),nextButton=f.button('다음 독립 준비기록 작성');
  const propsKey=Object.keys(nextButton).find(k=>k.startsWith('__reactProps'))!;
  f.modes.get=status;await f.click('저장 준비기록 고정 조회');await f.settle(()=>!!f.waiting.fixed);
  assert.equal(f.button('다음 독립 준비기록 작성').disabled,true);
  await ui.React.act(async()=>{(nextButton as any)[propsKey].onClick();});assert.deepEqual(f.buffer().pending,a);
  const props=f.props();await f.render({...props,session:{...session,csrfToken:'d'.repeat(43)}});await f.render(props);
  f.modes.get='OK';await f.click('기존 인계 기록 조회');await f.settle(()=>f.buttons('다음 독립 준비기록 작성').length===1);
  await f.click('다음 독립 준비기록 작성');await f.change('준비기록 이유','새 B 입력 유지');
  await ui.React.act(async()=>{f.waiting.fixed!();await new Promise(r=>setImmediate(r));});
  assert.equal(f.buffer().reason,'새 B 입력 유지');assert.equal(f.buffer().pending,null);assert.deepEqual(f.buffer().storedCommands,[a]);
  assert.equal(hasOriginal(f),false);assert.equal(f.lost(),0);assert.doesNotMatch(f.text(),/AUTH_REQUIRED/);
  assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 }finally{await f.close();}
});

test('독립 준비기록 · B 준비는 현재 제어권 재검산·거절 시 A 영수증 유지',async()=>{
 const f=await host();try{
  await prepared(f);await f.click('같은 준비기록 명령 저장·재확인');await f.settle(()=>hasOriginal(f));
  const a=structuredClone(f.buffer().pending);await f.click('다음 독립 준비기록 작성');await chooseNull(f);
  f.modes.control='403';await f.click('준비기록 원명령 준비');await f.settle(()=>f.text().includes('PROJECT_CONTROL_REQUIRED'));
  assert.equal(f.buffer().pending,null);assert.deepEqual(f.buffer().storedCommands,[a]);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 }finally{await f.close();}
});

test('독립 준비기록 · 부모 CAS 교체 후 늦은 A는 폐기하고 자기 flight만 해제',async()=>{
 const f=await host();try{
  await prepared(f);await f.click('같은 준비기록 명령 저장·재확인');await f.settle(()=>hasOriginal(f));
  f.modes.get='WAIT401';await f.click('저장 준비기록 고정 조회');await f.settle(()=>!!f.waiting.fixed);
  const old=f.buffer(),next=ui.api.nextPreparation(f.client,session,f.f.confirmed,old);
  await ui.React.act(async()=>{assert.equal(f.props().preparation.onChange(old,next),true);});
  await ui.React.act(async()=>{f.waiting.fixed!();await new Promise(r=>setImmediate(r));});
  assert.equal(f.buffer(),next);assert.equal(f.lost(),0);assert.equal(hasOriginal(f),false);
  assert.equal(f.button('준비기록 원명령 준비').disabled,false);
  f.modes.get='OK';await prepared(f);assert.equal(f.buffer().pending.state,'PREPARED');
  assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 }finally{await f.close();}
});
test('실제 Page/Panel은 명시 준비→1POST→영수증→보호 고정GET으로 연결하며 조회만으로 재전송하지 않는다',async()=>{const f=await host();try{await prepared(f);assert(f.calls.every(c=>c.method==='GET'));const original=f.buffer().pending.body;await f.click('같은 준비기록 명령 저장·재확인');await f.settle(()=>f.nodes().some(n=>n.getAttribute('aria-label')==='준비기록 고정 원문'));assert.equal(f.buffer().pending.state,'STORED');assert.equal(f.buffer().pending.body,original);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.match(f.text(),/SOURCE_DIFFS_UNCOLLECTED/);await f.click('준비기록 원문 닫기');await f.click('저장 준비기록 고정 조회');await f.settle(()=>f.nodes().some(n=>n.getAttribute('aria-label')==='준비기록 고정 원문'));assert.equal(f.calls.filter(c=>c.method==='POST').length,1);}finally{await f.close();}});
test('같은 임무 context·역할·과거 binding은 각각 보호 GET 후 선택하고 최신 타임무 binding은 채택하지 않는다',async()=>{const f=await host();try{await f.change('준비기록 이유','명시 과거 관계');await f.click('맥락 '+f.f.context.ref.id+' 고정 선택');await f.settle(()=>f.buffer().contextSelected);await f.click('STAGE_OWNER 역할 고정 선택');await f.settle(()=>f.buffer().roleSelected);await f.change('과거 결박 ID',f.f.binding.ref.id);await f.click('과거 결박 보호 조회·선택');await f.settle(()=>f.buffer().bindingSelected);await f.click('대상 미선택 명시');await f.click('준비기록 원명령 준비');await f.settle(()=>f.buffer().pending?.state==='PREPARED');assert.deepEqual(f.buffer().pending.command.payload.contextRef,f.f.context.ref);assert.deepEqual(f.buffer().pending.command.payload.roleRef,f.f.stage.ref);assert.deepEqual(f.buffer().pending.command.payload.oldBindingRef,f.f.binding.ref);await f.click('같은 준비기록 명령 저장·재확인');await f.settle(()=>f.buffer().pending?.state==='STORED');assert(f.calls.some(c=>c.path.includes('/role-bindings/'+f.f.binding.ref.id+'/versions/1')));}finally{await f.close();}
 const other=await host({otherAssignment:true});try{await other.click('STAGE_OWNER 역할 고정 선택');await other.settle(()=>other.buffer().roleSelected);assert.equal(other.buttons('결박 '+other.f.binding.ref.id+' 고정 선택').length,0);await other.change('과거 결박 ID',other.f.binding.ref.id);await other.click('과거 결박 보호 조회·선택');await other.settle(()=>other.text().includes('TRANSFER_PREPARATION_BINDING_MISMATCH'));assert.equal(other.buffer().oldBindingRef,null);assert(!other.calls.some(c=>c.method==='POST'));}finally{await other.close();}});
test('POST 유실은 원UUID/body/기한 UNKNOWN을 보존하며 동일 명령만 명시 재확인한다',async()=>{const f=await host();try{await prepared(f);const body=f.buffer().pending.body;f.modes.post='LOST';await f.click('같은 준비기록 명령 저장·재확인');await f.settle(()=>f.buffer().failure?.code==='CONNECTION_LOST');assert.equal(f.buffer().pending.state,'UNKNOWN');assert.equal(f.buffer().pending.body,body);assert.equal(f.buttons('준비기록 거절 확인 후 수정').length,0);f.modes.post='OK';await f.click('같은 준비기록 명령 저장·재확인');await f.settle(()=>f.buffer().pending.state==='STORED');assert.deepEqual(f.calls.filter(c=>c.method==='POST').map(c=>c.body),[body,body]);}finally{await f.close();}});
test('APPLIED 후 고정GET403/401은 영수증을 보존·GET만 재조회하고 현재401만 알린다',async()=>{for(const status of['403','401']){const f=await host();try{await prepared(f);f.modes.get=status;await f.click('같은 준비기록 명령 저장·재확인');await f.settle(()=>f.buffer().failure?.status===Number(status));assert.equal(f.buffer().pending.state,'STORED');assert(f.buffer().pending.receipt);assert.equal(f.buttons('같은 준비기록 명령 저장·재확인').length,0);assert.equal(f.lost(),status==='401'?1:0);f.modes.get='OK';await f.click('저장 준비기록 고정 조회');await f.settle(()=>f.nodes().some(n=>n.getAttribute('aria-label')==='준비기록 고정 원문'));assert.equal(f.calls.filter(c=>c.method==='POST').length,1);}finally{await f.close();}}});
test('명확409 명시 복귀와 등록 대상 보호GET 거절은 원 선택·POST1을 보존하며 binding단독을 막는다',async()=>{
 const f=await host({targetDenied:true});try{await prepared(f);f.modes.post='409';await f.click('같은 준비기록 명령 저장·재확인');await f.settle(()=>f.buffer().pending.state==='REJECTED');await f.click('준비기록 거절 확인 후 수정');assert.equal(f.buffer().pending,null);assert.equal(f.buffer().reason,'정확 준비기록 선택');
  await f.change('등록 연결 ID',id(80));await f.change('등록 연결 hash','a'.repeat(64));const before=f.buffer(),selected=structuredClone({targetConnectionRef:before.targetConnectionRef,targetSelected:before.targetSelected,pending:before.pending});
  await f.click('등록 대상 보호 조회·선택');await f.settle(()=>f.text().includes('ACCESS_DENIED'));assert.equal(f.buffer(),before);assert.deepEqual({targetConnectionRef:f.buffer().targetConnectionRef,targetSelected:f.buffer().targetSelected,pending:f.buffer().pending},selected);assert.equal(f.calls.filter(c=>c.path===`/api/v1/projects/${pid}/connections/${id(80)}/versions/1`&&c.method==='GET').length,1);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.equal(f.buffer().reason,'정확 준비기록 선택');
  await f.click('과거 결박 보호 조회·선택');await f.settle(()=>f.text().includes('TRANSFER_PREPARATION_ROLE_REQUIRED'));assert.equal(f.buffer(),before);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 }finally{await f.close();}
});

test('지연POST 중 CSRF/transport/주체 전환은 옛401·결과를 폐기하고 UNKNOWN을 복귀시 회복한다',async()=>{for(const mode of['CSRF','TRANSPORT','USER']){const f=await host();try{await prepared(f);const oldProps=f.props(),oldTransport=f.client.transport,body=f.buffer().pending.body;f.modes.post='DELAY';await f.click('같은 준비기록 명령 저장·재확인');assert(f.waiting.release);if(mode==='CSRF')await f.render({...oldProps,session:{...session,csrfToken:'d'.repeat(43)}});else if(mode==='USER')await f.render({...oldProps,session:{...session,user:{id:id(99)}}});else{f.client.transport=async()=>Response.json({code:'ACCESS_DENIED'},{status:403});await f.render();}f.waiting.release!(Response.json({code:'AUTH_REQUIRED'},{status:401}));await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});assert.equal(f.lost(),0);f.client.transport=oldTransport;await f.render(oldProps);{await f.click('기존 인계 기록 조회');await f.settle(()=>f.buttons('같은 준비기록 명령 저장·재확인').length===1);}assert.equal(f.buffer().pending.body,body);assert.equal(f.buffer().pending.state,'UNKNOWN');if(mode!=='USER')assert(!f.button('같은 준비기록 명령 저장·재확인').disabled);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);}finally{await f.close();}}});

test('고정context snapshot의enum은 배열을 문자열로 대체 해석하지 않는다',async()=>{const f=seed(),payload={assignmentRef:f.confirmed.ref,contextRef:f.context.ref,roleRef:null,oldBindingRef:null,targetConnectionRef:null,intentExpiresAt:new Date(Date.now()+900000).toISOString(),reason:'enum 원형 검산'},base=receipt({commandId:id(90),payload}).data.record;base.requiredContext[0].state='METADATA_ONLY';base.sourceRefs=[{kind:'DOCUMENT_VERSION',ref:{id:id(91),version:1,contentHash:'a'.repeat(64)},conversationId:null}];readPreparationSnapshot(base);const ref={id:base.id,version:1,contentHash:hash(base)};await ui.api.parsePreparationSnapshot(base,pid,ref);
 for(const field of['STATE','SOURCE','GAP']){const bad=structuredClone(base);if(field==='STATE')bad.requiredContext[0].state=['METADATA_ONLY'];else if(field==='SOURCE')bad.sourceRefs[0].kind=['DOCUMENT_VERSION'];else bad.gaps.push(['CONTEXT_CURRENTNESS_UNVERIFIED']);await assert.rejects(ui.api.parsePreparationSnapshot(bad,pid,{...ref,contentHash:hash(bad)}),field);}
});

test('준비 뒤 command/body를 함께 변조해도 원tuple과 기한은 IO 전에 거절한다',async()=>{for(const field of['operation','projectId','clientId','targetId','expectedVersion','controlGeneration','intentExpiresAt']){const f=await host();try{await prepared(f);const b=ui.api.markPreparationDispatch(f.buffer()),p=b.pending;if(field==='operation')p.command.operation='saveKnowledge';else if(field==='projectId'||field==='clientId'||field==='targetId')p.command[field]=id(99);else if(field==='intentExpiresAt')p.command.payload.intentExpiresAt=new Date(Date.now()+600000).toISOString();else p.command[field]++;p.body=canonicalJson(p.command);const before=f.calls.filter(c=>c.method==='POST').length;await assert.rejects(ui.api.sendPreparation(f.client,session,f.f.confirmed,b,()=>true),field);assert.equal(f.calls.filter(c=>c.method==='POST').length,before,field);}finally{await f.close();}}});

test('이유 UTF8 4096B와 최대30분만 준비하며 미선택·상한·부정Unicode는 POST0로 닫힌다',async()=>{const f=await host();try{const payload={assignmentRef:f.f.confirmed.ref,contextRef:null,roleRef:null,oldBindingRef:null,targetConnectionRef:null,intentExpiresAt:new Date(Date.now()+1800000).toISOString(),reason:'a'.repeat(4096)};assert.equal(ui.api.validatePreparationPayload(payload).reason.length,4096);assert.equal(new TextEncoder().encode(ui.api.validatePreparationPayload({...payload,reason:'가'.repeat(1365)+'a'}).reason).length,4096);assert.throws(()=>ui.api.validatePreparationPayload({...payload,reason:'가'.repeat(1366)}));for(const reason of['a'.repeat(4097),String.fromCharCode(0xd800),'x'+String.fromCharCode(0),'Bearer '+'a'.repeat(30)])assert.throws(()=>ui.api.validatePreparationPayload({...payload,reason}));await f.change('준비기록 이유','조건별 명시 선택');await f.click('준비기록 원명령 준비');await f.settle(()=>f.buffer().failure);assert.equal(f.buffer().pending,null);await chooseNull(f);for(const minutes of['0','31','NaN','1.5']){await f.change('준비기록 기한 분',minutes);await f.click('준비기록 원명령 준비');await f.settle(()=>f.buffer().failure);assert.equal(f.buffer().pending,null);}assert(!f.calls.some(c=>c.method==='POST'));}finally{await f.close();}});
test('늦은 보호GET JSON·ABA는 옛401을 폐기하고 명시 재조회 후 입력을 회복한다',async()=>{const f=await host();let release!:(v:any)=>void;const original=f.client.transport;try{// 세션 A→B→A 렌더를 포함한 실제 Page GET의 늦은 JSON을 검증한다.
 const oldProps=f.props(),oldSession=oldProps.session;const gateTransport=async(url:any,options:any)=>{if(String(url).includes('/assignment-drafts/')){const response=Response.json({code:'AUTH_REQUIRED'},{status:401});response.json=()=>new Promise(r=>release=r);return response;}return original(url,options);};f.client.transport=gateTransport;await f.render();await f.click('기존 인계 기록 조회');assert(release);await f.render({...oldProps,session:{...oldSession,csrfToken:'d'.repeat(43)}});await f.render(oldProps);release({code:'AUTH_REQUIRED'});await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});assert.equal(f.lost(),0);f.client.transport=original;await f.render();await f.click('기존 인계 기록 조회');await f.settle(()=>f.buttons('STAGE_OWNER 역할 고정 선택').length===1);assert.equal(f.buffer().pending,null);assert(!f.button('준비기록 원명령 준비').disabled);assert(!f.calls.some(c=>c.method==='POST'));
 }finally{release?.({code:'AUTH_REQUIRED'});f.client.transport=original;await f.close();}});

test('현재 읽기403·고정hash/프로젝트/역할관계 변조는 대체 선택 없이 실패하고 과거 기한은 역사조회로 보존한다',async()=>{const f=seed(),denied=new ui.ApiClient(async()=>Response.json({code:'ACCESS_DENIED'},{status:403}));await assert.rejects(ui.api.readPreparationRole(denied,f.confirmed,f.stage.ref.id,1,()=>true),{status:403});for(const field of['HASH','PROJECT','ROLE']){const value=structuredClone(field==='ROLE'?f.binding:f.stage);if(field==='HASH')value.ref.contentHash='f'.repeat(64);else if(field==='PROJECT')value.projectId=id(99);else{(value.snapshot as any).roleRef=f.role.ref;value.ref.contentHash=hash(value.snapshot);}const api=new ui.ApiClient(async()=>Response.json(value));await assert.rejects(field==='ROLE'?ui.api.readPreparationBinding(api,f.confirmed,f.stage,f.binding.ref.id,1,()=>true):ui.api.readPreparationRole(api,f.confirmed,f.stage.ref.id,1,()=>true));}
 const p={assignmentRef:f.confirmed.ref,contextRef:null,roleRef:null,oldBindingRef:null,targetConnectionRef:null,intentExpiresAt:new Date(Date.now()+60000).toISOString(),reason:'과거 기한 보존'},saved=receipt({commandId:id(90),payload:p});saved.data.record.observedAt='2026-01-01T00:00:00.000Z';saved.data.record.intentExpiresAt='2026-01-01T00:15:00.000Z';saved.data.ref.contentHash=hash(saved.data.record);const observedAt=new Date().toISOString(),v=readPreparationGet({projectId:pid,ref:saved.data.ref,record:saved.data.record,observedAt,currentStatus:{intentExpired:true,usableForTransfer:false,sourceCurrentness:'NOT_REVALIDATED'},preparationStored:true,manifestStored:false});const api=new ui.ApiClient(async()=>Response.json(v)),history=await ui.api.readPreparationRecord(api,pid,v.ref,f.confirmed.ref,()=>true);assert.equal(history.currentStatus.intentExpired,true);assert.equal(history.currentStatus.usableForTransfer,false);
});
test('늦은 실제 native digest 뒤 세션 교체는 원명령 UNKNOWN을 보존하고 옛 영수증을 적용하지 않는다',async()=>{const f=await host(),subtle=globalThis.crypto.subtle,descriptor=Object.getOwnPropertyDescriptor(subtle,'digest'),original=subtle.digest;let release!:(v:ArrayBuffer)=>void,value!:ArrayBuffer;try{await prepared(f);const body=f.buffer().pending.body;let first=true;Object.defineProperty(subtle,'digest',{configurable:true,value:async(...args:any[])=>{const actual=await Reflect.apply(original,subtle,args);if(first){first=false;value=actual;return new Promise<ArrayBuffer>(r=>release=r);}return actual;}});await f.click('같은 준비기록 명령 저장·재확인');await f.settle(()=>!!release);const old=f.props();await f.render({...old,session:{...session,csrfToken:'d'.repeat(43)}});release(value);await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});await f.render(old);await f.click('기존 인계 기록 조회');await f.settle(()=>f.buttons('같은 준비기록 명령 저장·재확인').length===1);assert.equal(f.buffer().pending.state,'UNKNOWN');assert.equal(f.buffer().pending.body,body);assert.equal(f.buffer().pending.receipt,null);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);}finally{release?.(value);if(descriptor)Object.defineProperty(subtle,'digest',descriptor);else Reflect.deleteProperty(subtle,'digest');await f.close();}});

test('browser seed는 실제 Page의 binding→연결후보를 포함한 전체 보호GET을 누락 없이 검산한다',async()=>{const base=transferFixture(),seed=await ui.harness.seedPreparationRoles({projectId:pid,draftRef:base.draft.ref,session,responses:base.responses}),container=document.createElement('div');document.body.appendChild(container);let qa:any;try{await ui.React.act(async()=>{qa=ui.harness.mountPreparationRecordQA(container,seed);});const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))],button=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent==='기존 인계 기록 조회');assert(button);await ui.React.act(async()=>button.dispatchEvent({type:'click',button:0,bubbles:true}));const end=Date.now()+1500;while(!nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='새 준비기록 작성')&&Date.now()<end)await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,2));});assert.equal(qa.calls.length,6);for(const call of qa.calls){assert.equal(call.method,'GET');const parsed=new URL(call.path,'https://anvil.invalid'),key=parsed.pathname.slice(('/api/v1/projects/'+pid+'/').length);if(key==='context'){assert.equal(parsed.searchParams.get('assignmentHash'),base.confirmed.ref.contentHash);assert.equal(parsed.searchParams.get('limit'),'50');}assert(seed.responses[key],'seed 누락 '+key);}assert(!container.textContent.includes('QA_UNMODELED'));assert(!container.textContent.includes('CONNECTION_LOST'));const binding:any=Object.values(seed.responses).find((v:any)=>v?.snapshot?.sessionRef),ref=binding.snapshot.connectionRef,view=seed.responses['connection-candidates/'+ref.id+'/versions/1'];assert(view);const input=readCandidateInput('registerConnection',view.candidate.input,{now:new Date(at),policyExpiresAt:new Date('2027-01-02T00:00:00.000Z')});assert.deepEqual(view.candidate,{kind:input.kind,input,readiness:candidateReadiness(input),capabilities:candidateCapabilities(input)});assert.equal(hash(view.candidate),ref.contentHash);assert.deepEqual(view.ref,ref);}finally{if(qa)await ui.React.act(async()=>qa.unmount());document.body.removeChild(container);}});

function historicalReceipt(){const f=transferFixture();return receipt({commandId:id(91),payload:{assignmentRef:f.confirmed.ref,contextRef:null,roleRef:null,oldBindingRef:null,targetConnectionRef:null,intentExpiresAt:new Date(Date.now()+600000).toISOString(),reason:'다른 client에서 이미 저장한 준비기록'}});}
test('빈 부모buffer·새client는 제어권 없이 알려진 fullref를 명시 GET하고 원버퍼/POST0을 보존한다',async()=>{const saved=historicalReceipt(),f=await host({empty:true,readerSession:{...session,clientId:id(95)},knownRecord:saved,controlDenied:true});try{const original=f.buffers;assert.deepEqual(Object.keys(original),[]);await f.change('준비기록 조회 ID',saved.data.ref.id);await f.change('준비기록 조회 hash',saved.data.ref.contentHash);await f.click('알려진 준비기록 고정 조회');await f.settle(()=>f.nodes().some(n=>n.getAttribute('aria-label')==='준비기록 고정 원문'));assert.equal(f.buffers,original);assert.deepEqual(Object.keys(f.buffers),[]);assert(!f.calls.some(c=>c.method==='POST'||c.path==='/api/v1/projects/'+pid));assert.equal(f.calls.filter(c=>c.path.includes('/transfer-preparations/')).length,1);assert.match(f.text(),/다른 client에서 이미 저장한 준비기록/);}finally{await f.close();}});

async function queryKnown(f:Awaited<ReturnType<typeof host>>,ref:any){await f.change('준비기록 조회 ID',ref.id);await f.change('준비기록 조회 hash',ref.contentHash);await f.click('알려진 준비기록 고정 조회');}
const hasOriginal=(f:Awaited<ReturnType<typeof host>>)=>f.nodes().some(n=>n.getAttribute('aria-label')==='준비기록 고정 원문');
const budgetButton='당시 저장된 한도 정책 보기';
function historicalBudget(reason='저장 당시 한도 근거'){
 const snapshot={limits:{maxAttempts:2,maxElapsedMs:60000,maxCalls:4,maxConcurrentAssignments:1,maxSpoolBytes:10000,maxOfflineMs:10000},
  scope:{kind:'PROJECT',projectId:pid},reason,policyBaseVersion:0,state:'APPLIED',previousRef:null,
  decidedBy:{kind:'HUMAN',userId:pid},decidedAt:'2026-01-01T00:00:00.000Z',expiresAt:'2026-01-01T00:01:00.000Z',executionAuthorized:false,dispatchPerformed:false};
 return {projectId:pid,ref:{id:id(81),version:1,contentHash:hash(snapshot)},snapshot};
}
function recordWithBudget(budgetRef:ReturnType<typeof historicalBudget>['ref']|null,recordId=id(20)){
 const record=readPreparationSnapshot({...historicalReceipt().data.record,id:recordId,budgetRef});
 return {ref:{id:recordId,version:1,contentHash:hash(record)},record};
}
function recordResponse(data:ReturnType<typeof recordWithBudget>){
 const observedAt=new Date().toISOString();
 return Response.json(readPreparationGet({projectId:pid,...data,observedAt,currentStatus:{intentExpired:Date.parse(data.record.intentExpiresAt)<=Date.parse(observedAt),usableForTransfer:false,sourceCurrentness:'NOT_REVALIDATED'},preparationStored:true,manifestStored:false}));
}
for(const mode of ['일치','미수집','다른 해시','403','401'] as const){
 test('과거 한도 정책 · '+mode,async()=>{
  const policy=historicalBudget(),data=recordWithBudget(mode==='미수집'?null:policy.ref);
  const path='/api/v1/projects/'+pid+'/limit-policies/'+policy.ref.id+'/versions/1';
  const f=await host({empty:true,knownRecord:{data},historicalGet:pathname=>{
   if(pathname!==path)return;
   if(mode==='403'||mode==='401')return Response.json({code:mode==='401'?'AUTH_REQUIRED':'ACCESS_DENIED'},{status:Number(mode)});
   return Response.json(mode==='다른 해시'?historicalBudget('다른 정책 원문'):policy);
  }});
  try{
   await queryKnown(f,data.ref);await f.settle(()=>hasOriginal(f));
   assert.equal(f.calls.filter(c=>c.path.includes('/limit-policies')).length,0);
   if(mode==='미수집'){assert.equal(f.buttons(budgetButton).length,0);assert.match(f.text(),/한도 정책 참조 없음/);}
   else{
    const start=f.calls.length;
    await f.click(budgetButton);
    const expected=mode==='일치'?policy.snapshot.reason:mode==='다른 해시'?'LIMIT_POLICY_RESPONSE_INVALID':mode==='401'?'AUTH_REQUIRED':'ACCESS_DENIED';
    await f.settle(()=>f.text().includes(expected));
    assert.deepEqual(f.calls.slice(start).map(c=>[c.method,c.path]),[['GET',path]]);
    if(mode==='일치'){assert.ok(f.text().includes('저장된 정책 상태: 적용'));assert.ok(f.text().includes(policy.snapshot.expiresAt));}
    else assert.doesNotMatch(f.text(),/저장 당시 한도 근거|다른 정책 원문/);
    assert.equal(f.lost(),mode==='401'?1:0);
   }
   assert.deepEqual(Object.keys(f.buffers),[]);assert.ok(f.calls.every(c=>c.method==='GET'));
  }finally{await f.close();}
 });
}
for(const mode of ['원문 닫기','닫은 원문 다시 열기','같은 기록 재조회','기록 교체','기록 ABA','주체 교체'] as const){
 test('과거 한도 정책 · 지연 응답 · '+mode,async()=>{
  const policy=historicalBudget(),a=recordWithBudget(policy.ref),b=recordWithBudget(null,id(22));
  const path='/api/v1/projects/'+pid+'/limit-policies/'+policy.ref.id+'/versions/1';
  const expiredAuth=mode==='기록 ABA'||mode==='주체 교체'||mode==='같은 기록 재조회';
  let resolve!:()=>void,reading=false;
  const delayed=new Promise<void>(done=>{resolve=done;});
  const f=await host({empty:true,knownRecord:{data:a},historicalGet:p=>{
   if(p.endsWith('/transfer-preparations/'+b.ref.id+'/versions/1'))return recordResponse(b);
   if(p!==path)return;
   const response=expiredAuth?Response.json({code:'AUTH_REQUIRED'},{status:401}):Response.json(policy);
   const parse=response.json.bind(response);
   response.json=async()=>{reading=true;await delayed;return parse();};
   return response;
  }});
  try{
   await queryKnown(f,a.ref);await f.settle(()=>hasOriginal(f));await f.click(budgetButton);await f.settle(()=>reading);
   if(mode==='원문 닫기'||mode==='닫은 원문 다시 열기'){
    await f.click('준비기록 원문 닫기');
    if(mode==='닫은 원문 다시 열기'){
     await f.click('알려진 준비기록 고정 조회');await f.settle(()=>hasOriginal(f));
    }
   }else if(mode==='같은 기록 재조회'){
    await f.click('알려진 준비기록 고정 조회');await f.settle(()=>hasOriginal(f)&&!f.button(budgetButton).disabled);
   }
   else if(mode==='주체 교체'){
    const props=f.props();await f.render({...props,session:{...session,user:{id:id(99)}}});
   }else{
    await queryKnown(f,b.ref);await f.settle(()=>hasOriginal(f)&&f.text().includes('한도 정책 참조 없음'));
    if(mode==='기록 ABA'){
     await queryKnown(f,a.ref);await f.settle(()=>f.buttons(budgetButton).length===1);
     assert.equal(f.button(budgetButton).disabled,false);
    }
   }
   const subtle=globalThis.crypto.subtle,descriptor=Object.getOwnPropertyDescriptor(subtle,'digest'),original=subtle.digest;
   let digested=false;
   try{
    if(!expiredAuth)Object.defineProperty(subtle,'digest',{configurable:true,value:async(...args:Parameters<SubtleCrypto['digest']>)=>{
     const result=await original.apply(subtle,args);digested=true;return result;
    }});
    await ui.React.act(async()=>{resolve();await new Promise(done=>setImmediate(done));});
    if(!expiredAuth)await f.settle(()=>digested);
   }finally{
    if(!expiredAuth){if(descriptor)Object.defineProperty(subtle,'digest',descriptor);else Reflect.deleteProperty(subtle,'digest');}
   }
   assert.equal(f.lost(),0);assert.doesNotMatch(f.text(),/저장 당시 한도 근거|AUTH_REQUIRED/);
   assert.equal(f.calls.filter(c=>c.path.includes('/limit-policies/')).length,1);
   assert.deepEqual(Object.keys(f.buffers),[]);assert.ok(f.calls.every(c=>c.method==='GET'));
  }finally{resolve();await f.close();}
 });
}
test('독립 조회의 현재403/401·hash/임무 불일치는 원문을 숨기고 버퍼/POST0를 유지한다',async()=>{for(const mode of['403','401','HASH','ASSIGNMENT']){const saved=historicalReceipt();if(mode==='ASSIGNMENT'){saved.data.record.assignmentRef={...saved.data.record.assignmentRef,contentHash:'f'.repeat(64)};saved.data.ref.contentHash=hash(saved.data.record);}const f=await host({empty:true,knownRecord:saved,controlDenied:true});try{const before={...f.buffers};if(mode==='403'||mode==='401')f.modes.get=mode;await queryKnown(f,{...saved.data.ref,...(mode==='HASH'?{contentHash:'f'.repeat(64)}:{})});await f.settle(()=>f.text().includes(mode==='403'||mode==='401'?'ACCESS_DENIED':'TRANSFER_PREPARATION_RESPONSE_INVALID'));assert(!hasOriginal(f));assert.equal(f.lost(),mode==='401'?1:0);assert.deepEqual(f.buffers,before);assert(!f.calls.some(c=>c.method==='POST'||c.path==='/api/v1/projects/'+pid));}finally{await f.close();}}});
test('독립 조회 입력수정은 즉시 원문을 숨기고 A→B→A의 지연응답을 부활시키지 않는다',async()=>{const saved=historicalReceipt(),f=await host({empty:true,knownRecord:saved});try{await queryKnown(f,saved.data.ref);await f.settle(()=>hasOriginal(f));const before=f.calls.length;await f.change('준비기록 조회 hash','f'.repeat(64));assert(!hasOriginal(f));assert.equal(f.calls.length,before);await f.change('준비기록 조회 hash',saved.data.ref.contentHash);f.modes.get='WAIT200';await f.click('알려진 준비기록 고정 조회');assert(f.waiting.fixed);await f.change('준비기록 조회 ID',id(99));await f.change('준비기록 조회 ID',saved.data.ref.id);f.waiting.fixed!();await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});assert(!hasOriginal(f));assert(!f.button('알려진 준비기록 고정 조회').disabled);f.modes.get='OK';await f.click('알려진 준비기록 고정 조회');await f.settle(()=>hasOriginal(f));assert.deepEqual(Object.keys(f.buffers),[]);assert(!f.calls.some(c=>c.method==='POST'));}finally{await f.close();}});
test('독립 조회는 owner/client/CSRF/transport/assignment 렌더 ABA 뒤 옛401·원문을 폐기한다',async()=>{for(const mode of['USER','CLIENT_ID','CLIENT','CSRF','TRANSPORT','ASSIGNMENT']){const saved=historicalReceipt(),f=await host({empty:true,knownRecord:saved});try{const props=f.props(),transport=f.client.transport;f.modes.get='WAIT401';await queryKnown(f,saved.data.ref);assert(f.waiting.fixed);if(mode==='USER')await f.render({...props,session:{...session,user:{id:id(97)}}});else if(mode==='CLIENT_ID')await f.render({...props,session:{...session,clientId:id(97)}});else if(mode==='CLIENT')await f.render({...props,client:new ui.ApiClient(transport)});else if(mode==='CSRF')await f.render({...props,session:{...session,csrfToken:'d'.repeat(43)}});else if(mode==='ASSIGNMENT')await f.render({...props,assignmentRef:{...f.f.draft.ref,contentHash:'f'.repeat(64)}});else{f.client.transport=async()=>Response.json({code:'ACCESS_DENIED'},{status:403});await f.render();}f.client.transport=transport;await f.render(props);f.waiting.fixed!();await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});assert.equal(f.lost(),0);assert(!hasOriginal(f));await f.click('기존 인계 기록 조회');await f.settle(()=>f.buttons('알려진 준비기록 고정 조회').length===1);assert.equal(f.nodes().find(n=>n.getAttribute('aria-label')==='준비기록 조회 ID')!.value,'');assert(!f.button('알려진 준비기록 고정 조회').disabled);assert.deepEqual(Object.keys(f.buffers),[]);assert(!f.calls.some(c=>c.method==='POST'));}finally{await f.close();}}});
test('독립 과거조회는 intentExpired를 표시하며 기존 UNKNOWN 원명령과 영수증을 변경하지 않는다',async()=>{const saved=historicalReceipt();saved.data.record.observedAt='2026-01-01T00:00:00.000Z';saved.data.record.intentExpiresAt='2026-01-01T00:15:00.000Z';saved.data.ref.contentHash=hash(saved.data.record);const f=await host({knownRecord:saved});try{await prepared(f);f.modes.post='LOST';await f.click('같은 준비기록 명령 저장·재확인');await f.settle(()=>f.buffer().failure?.code==='CONNECTION_LOST');const original=f.buffer(),body=original.pending.body,posts=f.calls.filter(c=>c.method==='POST').length;await queryKnown(f,saved.data.ref);await f.settle(()=>hasOriginal(f));assert.match(f.text(),/과거 기한 경과/);assert.match(f.text(),/NOT_REVALIDATED/);assert.equal(f.buffer(),original);assert.equal(f.buffer().pending.body,body);assert.equal(f.buffer().pending.state,'UNKNOWN');assert.equal(f.calls.filter(c=>c.method==='POST').length,posts);assert(!f.button('같은 준비기록 명령 저장·재확인').disabled);}finally{await f.close();}});

test('독립 조회용 browser seed는 저장 POST 없이 server GET DTO와 native hash를 검산한다',async()=>{const f=transferFixture(),{seed,ref}=await ui.harness.seedKnownPreparation({projectId:pid,draftRef:f.draft.ref,session:{...session,clientId:id(95)},responses:f.responses}),key='transfer-preparations/'+ref.id+'/versions/1',value=readPreparationGet(seed.responses[key]);assert.deepEqual(value.ref,ref);assert.equal(hash(value.record),ref.contentHash);const container=document.createElement('div');document.body.appendChild(container);let qa:any;try{await ui.React.act(async()=>{qa=ui.harness.mountPreparationRecordQA(container,seed);});const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))],click=async(label:string)=>{const n=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===label);assert(n,label);await ui.React.act(async()=>n.dispatchEvent({type:'click',button:0,bubbles:true}));},settle=async(check:()=>boolean)=>{const end=Date.now()+1500;while(!check()&&Date.now()<end)await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,2));});assert(check());};await click('기존 인계 기록 조회');await settle(()=>nodes().some(n=>n.getAttribute('aria-label')==='준비기록 조회 ID'));for(const [label,text]of[['준비기록 조회 ID',ref.id],['준비기록 조회 hash',ref.contentHash]]){const n=nodes().find(n=>n.getAttribute('aria-label')===label)!;const prop=Object.keys(n).find(k=>k.startsWith('__reactProps'))!;await ui.React.act(async()=>{(n as any)[prop].onChange({target:{value:text}});});}await click('알려진 준비기록 고정 조회');await settle(()=>nodes().some(n=>n.getAttribute('aria-label')==='준비기록 고정 원문'));assert.deepEqual(Object.keys(qa.buffers),[]);assert(qa.calls.every((c:any)=>c.method==='GET'));assert.equal(qa.calls.filter((c:any)=>c.path.includes('/transfer-preparations/')).length,1);}finally{if(qa)await ui.React.act(async()=>qa.unmount());document.body.removeChild(container);}});

async function selectRegisteredBinding(f:Awaited<ReturnType<typeof host>>){
 await f.change('준비기록 이유','등록정의의 과거 결박만 명시 보존');await f.click('맥락 미수집 명시 선택');await f.click('STAGE_OWNER 역할 고정 선택');await f.settle(()=>f.buffer().roleSelected);
 await f.change('과거 결박 ID',f.f.binding.ref.id);await f.click('과거 결박 보호 조회·선택');await f.settle(()=>f.buffer().bindingSelected||f.text().includes('TRANSFER_PREPARATION_BINDING_MISMATCH'));assert.equal(f.buffer().bindingSelected,true,f.text());await f.click('대상 미선택 명시');
}
test('등록정의 과거 결박은 실제 Page 선택·저장전 재조회·준비기록 정확 GET으로 연결된다',async()=>{
 const f=await host({registered:true});try{await selectRegisteredBinding(f);assert.deepEqual(f.buffer().oldBindingRef,f.f.binding.ref);await f.click('준비기록 원명령 준비');await f.settle(()=>f.buffer().pending?.state==='PREPARED');const packet=f.buffer().pending.body;
  assert.equal(f.calls.filter(c=>c.method==='POST').length,0);await f.click('같은 준비기록 명령 저장·재확인');await f.settle(()=>f.buffer().pending?.state==='STORED');
  assert.equal(f.buffer().pending.body,packet);assert.deepEqual(f.buffer().pending.receipt.data.record.oldBindingRef,f.f.binding.ref);assert(f.calls.filter(c=>c.path.endsWith('/role-bindings/'+f.f.binding.ref.id+'/versions/1')).length>=2,'선택 뒤 저장 전 실제 고정 GET 재검산');assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.equal(f.calls.filter(c=>c.path.includes('/transfer-preparations/')).length,1);for(const key of ['ready','resumeAuthorized','executionAuthorized','dispatchPerformed'])assert.equal(f.buffer().pending.receipt.data.record[key],false);
 }finally{await f.close();}
});

test('등록정의 결박 GET의 재봉인 unknown·교차·추가키·범위·권위 오염과 늦은 응답은 선택되지 않는다',async()=>{
 for(const mode of ['NULL_SNAPSHOT','NULL_KIND','UNKNOWN_KIND','CROSS_READINESS','NO_KIND','EXTRA','HASH','PROJECT','ASSIGNMENT','ROLE','EXECUTION_TRUE','DISPATCH_TRUE','HANDLE'] as const){
  const f=seed(),binding:any=structuredClone(f.binding);Object.assign(binding.snapshot,{connectionKind:'REGISTERED_DEFINITION',connectionReadiness:'REGISTERED_DEFINITION_ONLY'});const s=binding.snapshot;
  if(mode==='NULL_KIND')s.connectionKind=null;if(mode==='UNKNOWN_KIND')s.connectionKind='OTHER';if(mode==='CROSS_READINESS')s.connectionReadiness='CANDIDATE_ONLY';if(mode==='NO_KIND')delete s.connectionKind;if(mode==='EXTRA')s.extra=false;if(mode==='PROJECT')binding.projectId=id(92);if(mode==='ASSIGNMENT')s.assignmentRef={...s.assignmentRef,id:id(93)};if(mode==='ROLE')s.roleRef={...s.roleRef,id:id(94)};if(mode==='EXECUTION_TRUE')s.executionAuthorized=true;if(mode==='DISPATCH_TRUE')s.dispatchPerformed=true;if(mode==='HANDLE')s.externalSessionHandleRef={id:id(95),version:1,contentHash:'e'.repeat(64)};
  if(mode==='NULL_SNAPSHOT')binding.snapshot=null;
  binding.ref.contentHash=mode==='HASH'?'f'.repeat(64):hash(binding.snapshot);let gets=0;
  await assert.rejects(ui.api.readPreparationBinding(new ui.ApiClient(async()=>{gets++;return Response.json(binding);}),f.confirmed,f.stage,binding.ref.id,1,()=>true),(error:any)=>error.code==='TRANSFER_PREPARATION_BINDING_MISMATCH',mode);assert.equal(gets,1);
 }
 const f=seed(),binding:any=structuredClone(f.binding);Object.assign(binding.snapshot,{connectionKind:'REGISTERED_DEFINITION',connectionReadiness:'REGISTERED_DEFINITION_ONLY'});binding.ref.contentHash=hash(binding.snapshot);let current=true;
 await assert.rejects(ui.api.readPreparationBinding(new ui.ApiClient(async()=>{current=false;return Response.json(binding);}),f.confirmed,f.stage,binding.ref.id,1,()=>current),(error:any)=>error.code==='TRANSFER_PREPARATION_CONTEXT_CHANGED');
});
test('등록정의 선택 뒤 저장전 바뀐 binding은 원 선택을 보존하고 새 POST 전에 거절한다',async()=>{
 const f=await host({registered:true});try{await selectRegisteredBinding(f);const ref=structuredClone(f.buffer().oldBindingRef);f.f.binding.snapshot.reason='저장 전 바뀐 결박 원문';f.f.binding.ref.contentHash=hash(f.f.binding.snapshot);await f.click('준비기록 원명령 준비');await f.settle(()=>f.text().includes('TRANSFER_PREPARATION_INVALID'));assert.deepEqual(f.buffer().oldBindingRef,ref);assert.equal(f.buffer().pending,null);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);}finally{await f.close();}
});
test('등록정의 준비저장 UNKNOWN은 같은 원 packet을 보존하고 명시 재확인 전 추가 POST0이다',async()=>{
 const f=await host({registered:true});try{await selectRegisteredBinding(f);await f.click('준비기록 원명령 준비');await f.settle(()=>f.buffer().pending?.state==='PREPARED');const body=f.buffer().pending.body;f.modes.post='LOST';await f.click('같은 준비기록 명령 저장·재확인');await f.settle(()=>f.buffer().pending?.state==='UNKNOWN');assert.equal(f.buffer().pending.body,body);await f.render();assert.equal(f.calls.filter(c=>c.method==='POST').length,1);f.modes.post='OK';await f.click('같은 준비기록 명령 저장·재확인');await f.settle(()=>f.buffer().pending?.state==='STORED');assert.equal(f.buffer().pending.body,body);assert.deepEqual(f.calls.filter(c=>c.method==='POST').map(c=>c.body),[body,body]);}finally{await f.close();}
});


const contextButton='당시 맥락 원문 열기';
function historicalContext(){
 const value=structuredClone(transferFixture().context);value.manifest.id=id(87);value.ref.id=id(87);value.ref.contentHash=hash(value.manifest);return value;
}
function recordWithContext(contextRef:ReturnType<typeof historicalContext>['ref']|null,recordId=id(20)){
 return receipt({commandId:id(90),payload:{assignmentRef:transferFixture().confirmed.ref,contextRef,roleRef:null,oldBindingRef:null,targetConnectionRef:null,intentExpiresAt:new Date(Date.now()+600000).toISOString(),reason:'보관 맥락 원참조'}},recordId).data;
}

test('과거 맥락 · 최근 후보 밖의 원참조를 명시 GET1로 열고 null은 버튼·GET0이다',async()=>{
 for(const missing of [false,true]){
  const context=historicalContext(),data=recordWithContext(missing?null:context.ref),path='/api/v1/projects/'+pid+'/context/'+context.ref.id+'/versions/1';
  const f=await host({empty:true,knownRecord:{data},historicalGet:p=>p===path?Response.json(context):undefined});
  try{await queryKnown(f,data.ref);await f.settle(()=>hasOriginal(f));const before=f.calls.length;
   assert(!f.f.contexts.items.some(item=>item.ref.id===context.ref.id));assert.equal(f.calls.filter(c=>c.path===path).length,0);
   if(missing)assert.equal(f.buttons(contextButton).length,0);
   else{await f.click(contextButton);await f.settle(()=>f.nodes().some(n=>n.getAttribute('aria-label')==='당시 맥락 고정 원문'));
    assert.equal(f.calls.length,before+1);assert.equal(f.calls.at(-1)!.path,path);assert(f.text().includes(context.ref.contentHash));assert(f.text().includes('MATCHED_METADATA'));assert(f.text().includes('누락: PURPOSE_REASON'));assert(f.text().includes('제외:'));}
   assert(f.calls.every(c=>c.method==='GET'));assert.deepEqual(f.buffers,{});
  }finally{await f.close();}
 }
});


for(const mode of ['hash','본문','project','임무','401','403'] as const){
 test('과거 맥락 · '+mode+' 불일치는 원문을 표시하지 않는다',async()=>{
  const context=historicalContext();
  if(mode==='임무'){context.manifest.assignmentRef={...context.manifest.assignmentRef,id:id(99)};context.manifest.preparationInput.assignmentRef=context.manifest.assignmentRef;context.ref.contentHash=hash(context.manifest);}
  const data=recordWithContext(context.ref),path='/api/v1/projects/'+pid+'/context/'+context.ref.id+'/versions/1';
  const f=await host({empty:true,knownRecord:{data},historicalGet:p=>{
   if(p!==path)return;
   if(mode==='401'||mode==='403')return Response.json({code:'ACCESS_DENIED'},{status:Number(mode)});
   const value=structuredClone(context);
   if(mode==='hash')value.ref.contentHash='e'.repeat(64);
   if(mode==='본문')value.manifest.preparationInput.reason='다른 내용';
   if(mode==='project')value.projectId=id(99);
   return Response.json(value);
  }});
  try{await queryKnown(f,data.ref);await f.settle(()=>hasOriginal(f));await f.click(contextButton);
   await f.settle(()=>f.nodes().some(n=>n.getAttribute('aria-label')==='당시 맥락 조회'&&n.textContent.includes('확인할 수 없습니다')));
   assert(!f.nodes().some(n=>n.getAttribute('aria-label')==='당시 맥락 고정 원문'));assert.equal(f.lost(),mode==='401'?1:0);
   if(mode==='임무')assert(f.text().includes('TRANSFER_CONTEXT_ASSIGNMENT_MISMATCH'));
   assert.equal(f.calls.filter(c=>c.path===path).length,1);assert(f.calls.every(c=>c.method==='GET'));assert.deepEqual(f.buffers,{});
  }finally{await f.close();}
 });
}

for(const mode of ['닫기','재조회','기록ABA','주체ABA','프로젝트ABA'] as const){
 test('과거 맥락 · '+mode+' 뒤 지연 원문·401을 폐기하고 중복 클릭은 GET1이다',async()=>{
  const context=historicalContext(),a=recordWithContext(context.ref),b=recordWithContext(null,id(22)),path='/api/v1/projects/'+pid+'/context/'+context.ref.id+'/versions/1';
  let release!:()=>void,reading=false;const gate=new Promise<void>(r=>release=r),late401=mode.endsWith('ABA');
  const f=await host({empty:true,knownRecord:{data:a},historicalGet:p=>{
   if(p.endsWith('/transfer-preparations/'+b.ref.id+'/versions/1'))return recordResponse(b);
   if(p!==path)return;
   const response=Response.json(late401?{code:'AUTH_REQUIRED'}:context,{status:late401?401:200}),parse=response.json.bind(response);
   response.json=async()=>{reading=true;await gate;return parse();};return response;
  }});
  try{await queryKnown(f,a.ref);await f.settle(()=>hasOriginal(f));const button=f.button(contextButton),key=Object.keys(button).find(k=>k.startsWith('__reactProps'))!;
   await ui.React.act(async()=>{(button as any)[key].onClick();(button as any)[key].onClick();});await f.settle(()=>reading);
   if(mode==='닫기')await f.click('준비기록 원문 닫기');
   else if(mode==='재조회'){await f.click('알려진 준비기록 고정 조회');await f.settle(()=>hasOriginal(f)&&!f.button(contextButton).disabled);}
   else if(mode==='기록ABA'){await queryKnown(f,b.ref);await f.settle(()=>hasOriginal(f)&&f.text().includes('당시 맥락 참조 없음'));await queryKnown(f,a.ref);await f.settle(()=>f.buttons(contextButton).length===1);}
   else{const props=f.props();await f.render(mode==='주체ABA'?{...props,session:{...session,user:{id:id(99)}}}:{...props,projectId:id(99)});await f.render(props);}
   await ui.React.act(async()=>{release();await new Promise(r=>setTimeout(r,20));});
   assert(!f.nodes().some(n=>n.getAttribute('aria-label')==='당시 맥락 고정 원문'));assert(!f.text().includes('AUTH_REQUIRED'));assert.equal(f.lost(),0);
   assert.equal(f.calls.filter(c=>c.path===path).length,1);assert(f.calls.every(c=>c.method==='GET'));assert.deepEqual(f.buffers,{});
  }finally{release();await f.close();}
 });
}


function historicalOriginal(){
 const f=originalFixture(),context=f.context;context.manifest.id=id(88);context.ref.id=id(88);f.rehash();
 const data=recordWithContext(context.ref),record=data.record;
 record.requiredContext.find((r:any)=>r.code==='LATEST_INSTRUCTIONS').state='METADATA_ONLY';
 record.sourceRefs=[{kind:'USER_INSTRUCTION',ref:f.conversation.sourceRef,conversationId:f.conversation.conversationId}];data.ref.contentHash=hash(record);
 return{...f,data,contextPath:'/api/v1/projects/'+pid+'/context/'+context.ref.id+'/versions/1',bodyPath:'/api/v1/projects/'+pid+'/conversations/'+f.conversation.conversationId+'/messages/'+f.conversation.sourceRef.id};
}
async function openHistoricalContext(f:Awaited<ReturnType<typeof host>>,data:any){await queryKnown(f,data.ref);await f.settle(()=>hasOriginal(f));await f.click(contextButton);await f.settle(()=>f.nodes().some(n=>n.getAttribute('aria-label')==='당시 맥락 고정 원문'));}
const hasContextBody=(f:Awaited<ReturnType<typeof host>>)=>f.nodes().some(n=>n.getAttribute('aria-label')==='인계 항목 원문');

test('보관 맥락 항목 · 명시 포함 항목 한 건만 재검산하고 보호 원문을 연다',async()=>{
 const original=historicalOriginal(),f=await host({empty:true,knownRecord:{data:original.data},historicalGet:p=>p===original.contextPath?Response.json(original.context):p===original.bodyPath?Response.json(original.conversation):undefined});
 try{await openHistoricalContext(f,original.data);assert.equal(f.calls.filter(c=>c.path===original.bodyPath).length,0);
  assert.equal(f.button('인계 항목 원문 RULES_SCOPE').disabled,true);
  await f.click('인계 항목 원문 '+original.itemId);await f.settle(()=>hasContextBody(f));
  assert(f.text().includes(original.body));assert.equal(f.calls.filter(c=>c.path===original.contextPath).length,2);assert.equal(f.calls.filter(c=>c.path===original.bodyPath).length,1);assert(f.calls.every(c=>c.method==='GET'));assert.deepEqual(f.buffers,{});
 }finally{await f.close();}
});


for(const mode of ['CHANGED','HASH','401','403','404'] as const){
 test('보관 맥락 항목 · '+mode+' 거절은 보관 metadata를 유지하며 원문을 표시하지 않는다',async()=>{
  const original=historicalOriginal();let contextReads=0;
  const f=await host({empty:true,knownRecord:{data:original.data},historicalGet:p=>{
   if(p===original.contextPath){contextReads++;const issues:string[]=[...original.context.currentCheck.issues],value=structuredClone({...original.context,currentCheck:{...original.context.currentCheck,issues}});
    if(contextReads>1&&mode==='CHANGED')value.currentCheck={state:'CHANGED',issues:['CURRENT_SOURCE_OR_BASIS_CHANGED']};
    if(contextReads>1&&mode==='HASH')value.ref.contentHash='f'.repeat(64);
    return Response.json(value);}
   if(p===original.bodyPath)return Response.json({code:'ACCESS_DENIED'},{status:Number(mode)});
  }});
  try{await openHistoricalContext(f,original.data);await f.click('인계 항목 원문 '+original.itemId);
   await f.settle(()=>f.text().includes('원문 미확인. 다른 버전/자료로 대체하지 않습니다.'));
   assert(!hasContextBody(f));assert(hasOriginal(f));assert(f.nodes().some(n=>n.getAttribute('aria-label')==='당시 맥락 고정 원문'));assert.equal(f.lost(),mode==='401'?1:0);
   assert.equal(f.calls.filter(c=>c.path===original.bodyPath).length,['CHANGED','HASH'].includes(mode)?0:1);assert(f.calls.every(c=>c.method==='GET'));assert.deepEqual(f.buffers,{});
  }finally{await f.close();}
 });
}

for(const stage of ['CONTEXT','BODY'] as const)for(const change of ['닫기','재조회','기록ABA','주체ABA','transport'] as const){
 test('보관 맥락 항목 · '+stage+' 대기 중 '+change+'는 후속 읽기·늦은 결과를 폐기한다',async()=>{
  const original=historicalOriginal(),other=recordWithContext(null,id(22));let count=0,waiting=false,release!:()=>void;
  const gate=new Promise<void>(r=>release=r),late401=stage==='BODY'&&change!=='닫기';
  const f=await host({empty:true,knownRecord:{data:original.data},historicalGet:p=>{
   if(p.endsWith('/transfer-preparations/'+other.ref.id+'/versions/1'))return recordResponse(other);
   if(p!==original.contextPath&&p!==original.bodyPath)return;
   const response=Response.json(p===original.bodyPath&&late401?{code:'AUTH_REQUIRED'}:p===original.contextPath?original.context:original.conversation,{status:p===original.bodyPath&&late401?401:200});
   if(stage==='CONTEXT'&&p===original.contextPath&&++count===2||stage==='BODY'&&p===original.bodyPath){const parse=response.json.bind(response);response.json=async()=>{waiting=true;await gate;return parse();};}return response;
  }});
  try{await openHistoricalContext(f,original.data);await f.click('인계 항목 원문 '+original.itemId);await f.settle(()=>waiting);
   if(change==='닫기')await f.click('준비기록 원문 닫기');
   else if(change==='재조회'){await f.click(contextButton);await f.settle(()=>f.nodes().some(n=>n.getAttribute('aria-label')==='당시 맥락 고정 원문')&&!f.button('인계 항목 원문 '+original.itemId).disabled);}
   else if(change==='기록ABA'){await queryKnown(f,other.ref);await f.settle(()=>hasOriginal(f)&&f.text().includes('당시 맥락 참조 없음'));await queryKnown(f,original.data.ref);await f.settle(()=>hasOriginal(f)&&f.buttons(contextButton).length===1);}
   else if(change==='주체ABA'){const props=f.props();await f.render({...props,session:{...session,clientId:id(99)}});await f.render(props);}
   else{const transport=f.client.transport;f.client.transport=async()=>{assert.fail('옛 요청은 새 transport를 호출하지 않음');};await f.render();f.client.transport=transport;await f.render();}
   await ui.React.act(async()=>{release();await new Promise(r=>setTimeout(r,20));});
   assert(!hasContextBody(f));assert(!f.text().includes('AUTH_REQUIRED'));assert.equal(f.lost(),0);assert.equal(f.calls.filter(c=>c.path===original.bodyPath).length,stage==='CONTEXT'?0:1);assert(f.calls.every(c=>c.method==='GET'));assert.deepEqual(f.buffers,{});
  }finally{release();await f.close();}
 });
}

function executionPreparationForTransfer(otherAssignment=false){
 const f=transferFixture(),assignmentRef=f.confirmed.ref,preparationId=id(96),sourceScope={sourceRootRef:assignmentRef,mappingRef:null,observationRef:assignmentRef,baselineRef:assignmentRef,targets:[{relativePath:'src/main.ts',kind:'FILE',access:'READ',recursive:false}]};
 const intent={projectId:pid,assignmentRef:otherAssignment?{...assignmentRef,contentHash:'a'.repeat(64)}:assignmentRef,roleBindingRef:assignmentRef,contextBundleRef:assignmentRef,connectionRef:assignmentRef,environmentRef:assignmentRef,capabilityRef:assignmentRef,budgetPolicyRef:assignmentRef,sourceScopes:[sourceScope],mode:'CONTEXT_REVIEW',reason:'이전 작업 당시 실행 준비',connectionKind:'REGISTERED_DEFINITION',optionsFormat:'CLAUDE_QUERY_DATA_V1'};
 const missingConditions=['RESPONSIBLE_SESSION_RESERVED','CONNECTION_DEFINITION_ONLY','ENVIRONMENT_DEFINITION_ONLY','CAPABILITY_UNVERIFIED','BUDGET_POLICY_UNVERIFIED','SOURCE_AUTHORIZATION_UNVERIFIED','HOST_OS_FENCE_UNVERIFIED'];
 const body=canonicalJson({claudeQueryParams:{model:'claude-history-only',maxTurns:3}}),options={format:'CLAUDE_QUERY_DATA_V1',mediaType:'application/json',body,utf8Bytes:Buffer.byteLength(body),contentHash:contentHash(body)};
 const snapshot={intent,basisRefs:[assignmentRef],latestInstructionRefs:[],checkedAt:at,missingConditions,authorizationState:'NOT_AUTHORIZED',preparedBy:{kind:'HUMAN',userId:pid},executionAuthorized:false,dispatchPerformed:false,options};
 const ref={id:preparationId,version:1,contentHash:hash(snapshot)};
 const page={projectId:pid,assignmentRef,items:[{ref,mode:intent.mode,checkedAt:at,missingConditions}],nextCursor:null,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false};
 const original={projectId:pid,ref,snapshot,currentness:'NOT_RECHECKED'};
 return{page,original,options,open:'전체 준비 이력 열기',item:'준비 원문 '+ref.id,
  pagePath:`/api/v1/projects/${pid}/assignments/${assignmentRef.id}/versions/${assignmentRef.version}/execution-preparations`,
  originalPath:`/api/v1/projects/${pid}/execution-preparations/${ref.id}/versions/${ref.version}`};
}

test('인계 화면의 검산된 확정 임무에서만 명시 GET으로 과거 실행 준비의 고정 Options를 조회한다',async()=>{
 const q=executionPreparationForTransfer(),f=await host({empty:true,historicalGet:path=>path===q.pagePath?Response.json(q.page):path===q.originalPath?Response.json(q.original):undefined});
 try{
  assert(!f.calls.some(c=>c.path.includes('/execution-preparations')));
  await f.click(q.open);await f.settle(()=>f.buttons(q.item).length===1);
  assert.deepEqual(f.calls.filter(c=>c.path.includes('/execution-preparations')).map(c=>c.path),[q.pagePath]);
  assert(!f.text().includes(q.options.contentHash));
  await f.click(q.item);await f.settle(()=>f.text().includes(q.options.contentHash));
  assert.match(f.text(),/준비 원문 · NOT_AUTHORIZED/);assert(f.text().includes(q.options.format));assert(f.text().includes(String(q.options.utf8Bytes)));assert(f.text().includes(q.original.ref.contentHash));
  assert.deepEqual(f.calls.slice(-2).map(c=>[c.path,c.method]),[[q.pagePath,'GET'],[q.originalPath,'GET']]);assert.deepEqual(f.buffers,{});
 }finally{await f.close();}
});

test('인계 실행 준비 원문의 다른 임무·다른 고정 ref와 현재 접근 거절은 Options를 표시하지 않는다',async()=>{
 for(const mode of ['ASSIGNMENT','REF','403','401']){
  const q=executionPreparationForTransfer(mode==='ASSIGNMENT'),f=await host({empty:true,historicalGet:path=>path===q.pagePath?Response.json(q.page):path!==q.originalPath?undefined:
   mode==='401'||mode==='403'?Response.json({code:mode==='401'?'AUTH_REQUIRED':'ACCESS_DENIED'},{status:Number(mode)}):
   Response.json(mode==='REF'?{...q.original,ref:{...q.original.ref,id:id(99)}}:q.original)});
  try{
   await f.click(q.open);await f.settle(()=>f.buttons(q.item).length===1);await f.click(q.item);
   const error=mode==='403'?'ACCESS_DENIED':mode==='401'?'AUTH_REQUIRED':'PREPARATION_HISTORY_RESPONSE_INVALID';
   await f.settle(()=>f.text().includes(error));assert(!f.text().includes(q.options.contentHash),mode);
   assert.equal(f.lost(),mode==='401'?1:0,mode);assert(f.calls.every(c=>c.method==='GET'));assert.deepEqual(f.buffers,{});
  }finally{await f.close();}
 }
});

test('인계 실행 준비 대기 중 transport·CSRF·재조회·임무 이탈은 옛 응답과 인증 콜백을 폐기한다',async()=>{
 for(const [scope,status] of [['TRANSPORT',200],['TRANSPORT',401],['CSRF',401],['REREAD',401],['LEAVE',401]] as const){
  const q=executionPreparationForTransfer();let release:((response:Response)=>void)|undefined;
  const f=await host({empty:true,historicalGet:path=>path===q.pagePath?Response.json(q.page):path===q.originalPath?new Promise(r=>release=r):undefined});
  try{
   await f.click(q.open);await f.settle(()=>f.buttons(q.item).length===1);await f.click(q.item);await f.settle(()=>!!release);
   if(scope==='TRANSPORT')f.client.transport=f.client.transport.bind(null);
   if(scope==='CSRF')await f.render({...f.props(),session:{...f.props().session,csrfToken:'D'.repeat(43)}});
   if(scope==='REREAD'){await f.click('인계 기록 다시 조회');await f.settle(()=>f.buttons(q.open).length===1);}
   if(scope==='LEAVE')await f.render({...f.props(),assignmentRef:undefined});
   const prior=f.calls.length;
   await ui.React.act(async()=>{assert(release);release(status===401?Response.json({code:'AUTH_REQUIRED'},{status}):Response.json(q.original));});
   assert.equal(f.calls.length,prior,scope);assert.equal(f.lost(),0,scope);assert(!f.text().includes(q.options.contentHash),scope);assert(!f.text().includes('AUTH_REQUIRED'),scope);assert.deepEqual(f.buffers,{});
  }finally{await f.close();}
 }
});
