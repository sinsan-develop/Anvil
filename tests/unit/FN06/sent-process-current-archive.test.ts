import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ownershipCurrentFixture} from './ownership-current-fixture.ts';
import {sentProcessEvidenceFixture} from './sent-process-evidence-fixture.ts';
import {SyntheticSentProcessEvidence} from '../../../apps/connector/runtime/sent-process-evidence.ts';
const m=await import(new URL('../../../apps/connector/runtime/sent-process-current-archive.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function adapter(source:any,clock:()=>number,timeoutMs=100){assert.equal(typeof m.SyntheticSentProcessCurrentArchive,'function','BASIS_ONLY와 기존 응답 archive 사이 명시 합성 어댑터가 필요하다');return new m.SyntheticSentProcessCurrentArchive(source,{clock,timeoutMs});}
test('현재 source가 없으면 저장 후보를 임의 대체하지 않고 거절한다',async()=>{await assert.rejects(adapter(null,()=>0).readCurrent({},new AbortController().signal),{message:'SENT_CURRENT_ARCHIVE_UNAVAILABLE'});});
test('실제 합성 resolver 결과를 전후 두 번 소비하고 명시 7필드만 투영한다',async()=>{
 const f=await ownershipCurrentFixture();let calls=0;const source={transport:'SYNTHETIC_ONLY',async resolve(selection:any,signal:AbortSignal){calls++;assert.deepEqual(selection,f.selection);return f.read(false,{signal});}},a=adapter(source,f.clock);
 const first=await a.readCurrent(f.selection,new AbortController().signal),last=await a.readCurrent(f.selection,new AbortController().signal);assert.deepEqual(Object.keys(first).sort(),['anchor','anchorHeadRef','binding','bindingHeadRef','expiresAt','readAt','revoked']);assert.deepEqual(first.anchor,f.anchor);assert.deepEqual(first.binding,f.binding);assert.deepEqual(last.anchor,first.anchor);assert.equal(calls,2);await assert.rejects(a.readCurrent(f.selection,new AbortController().signal),{message:'SENT_CURRENT_ARCHIVE_UNAVAILABLE'});assert.equal(calls,2);
});
test('같은 요청 재사용·권위 true·다른 선택·기한/누락은 현재 archive가 아니다',async()=>{
 for(const mode of ['REPLAY','AUTHORITY','SELECTION','EXPIRED','MISSING']){const f=await ownershipCurrentFixture();const basis=await f.read(),source={transport:'SYNTHETIC_ONLY',async resolve(){const v=structuredClone(basis);if(mode==='AUTHORITY')v.currentAuthorityVerified=true;if(mode==='EXPIRED')v.archive.expiresAt=new Date(f.clock()).toISOString();if(mode==='MISSING')delete v.missingEvidence;return v;}};const a=adapter(source,f.clock),selected=structuredClone(f.selection);if(mode==='SELECTION')selected.permitRef.version++;
  if(mode==='REPLAY'){await a.readCurrent(selected,new AbortController().signal);await assert.rejects(a.readCurrent(selected,new AbortController().signal),{message:'SENT_CURRENT_ARCHIVE_UNAVAILABLE'});}else await assert.rejects(a.readCurrent(selected,new AbortController().signal),{message:'SENT_CURRENT_ARCHIVE_UNAVAILABLE'});
 }
});
test('기존 응답 consumer는 투영 후보와 별도 observer를 소비해도 합성 false-authority만 반환한다',async()=>{
 const f=await sentProcessEvidenceFixture(),signal=new AbortController().signal,server=await f.responseSource.currentSentResponse(f.selection.envelope,f.selection.parentThreadClaimRef,signal),now=Date.parse(server.basis.fact.checkedAt);let resolves=0,observes=0;
 const source={transport:'SYNTHETIC_ONLY',async resolve(){resolves++;return{purpose:'SYNTHETIC_OWNERSHIP_CURRENT_BASIS_ONLY',transport:'SYNTHETIC_ONLY',archive:{anchor:f.anchor,binding:f.binding,anchorHeadRef:f.anchor.ref,bindingHeadRef:f.binding.ref,revoked:false,readAt:new Date(now).toISOString(),expiresAt:f.anchor.snapshot.expiresAt},requestRef:{id:`70000000-0000-4000-8000-${String(resolves).padStart(12,'0')}`,version:1,contentHash:'c'.repeat(64)},observationRef:{id:`80000000-0000-4000-8000-${String(resolves).padStart(12,'0')}`,version:1,contentHash:'d'.repeat(64)},headRef:{id:'90000000-0000-4000-8000-000000000001',version:resolves,contentHash:'e'.repeat(64)},missingEvidence:['ACTUAL_CURRENT_AUTHORITY_PROVIDER','VERIFIED_WRITER_NONE_OR_RECLAIM','CANDIDATE_PROVENANCE','SOURCE_WRITE_SANDBOX'],currentAuthorityVerified:false,writerReleaseVerified:false,fileSandboxVerified:false,executionAuthorized:false,dispatchPerformed:false};}};
 const observer={transport:'SYNTHETIC_ONLY' as const,async observe(request:any){observes++;return{requestRef:request.ref,ownershipEvidenceRef:f.anchor.ref,bindingRef:f.binding.ref,observerRef:f.anchor.snapshot.observerRef,observedAt:new Date(now).toISOString(),expiresAt:f.anchor.snapshot.expiresAt,facts:{processRef:f.anchor.snapshot.processRef,state:'RUNNING',active:1,processes:[{pid:f.anchor.snapshot.processRef.pid,startTicks:f.anchor.snapshot.processRef.startTicks,inJob:true,executableHash:f.anchor.snapshot.processRef.executableHash}],killOnClose:false,fileSandboxVerified:false}};}};
 const consumer=new SyntheticSentProcessEvidence(f.responseSource,adapter(source,()=>now),observer,{clock:()=>now,timeoutMs:100}),v=await consumer.read(f.selection,signal);assert.equal(v.state,'SYNTHETIC_MATCHED');assert.equal(v.currentAuthorityVerified,false);assert.equal(v.writerReleaseVerified,false);assert.equal(v.executionAuthorized,false);assert.equal(v.dispatchPerformed,false);assert.equal(observes,1);assert.equal(resolves,2);
});
test('새 request/관측이어도 head 세대를 되돌리거나 source transport를 바꾸면 거절한다',async()=>{
 for(const mode of ['HEAD','PORT']){const f=await ownershipCurrentFixture();let prior=0;const source:any={transport:'SYNTHETIC_ONLY',async resolve(_:any,signal:AbortSignal){const v=await f.read(false,{signal});if(prior&&mode==='HEAD')v.headRef.version=prior;else prior=v.headRef.version;if(prior&&mode==='PORT')source.transport='REAL';return v;}};const a=adapter(source,f.clock);
  if(mode==='HEAD'){await a.readCurrent(f.selection,new AbortController().signal);await assert.rejects(a.readCurrent(f.selection,new AbortController().signal),{message:'SENT_CURRENT_ARCHIVE_UNAVAILABLE'});}else await assert.rejects(a.readCurrent(f.selection,new AbortController().signal),{message:'SENT_CURRENT_ARCHIVE_UNAVAILABLE'});
 }
});
test('resolve 무응답은 timeout/취소로 종료하고 늦은 결과를 채택하지 않는다',async()=>{
 for(const cancel of [false,true]){const f=await ownershipCurrentFixture(),basis=await f.read();let enter!:()=>void,finish!:(v:any)=>void,observed:AbortSignal|undefined,calls=0;const waiting=new Promise<void>(r=>enter=r),delayed=new Promise(r=>finish=r);
  const a=adapter({transport:'SYNTHETIC_ONLY',async resolve(_:any,signal:AbortSignal){calls++;observed=signal;enter();return delayed;}},f.clock,cancel?100:5),c=new AbortController();const work=a.readCurrent(f.selection,c.signal).then(()=> 'UNEXPECTED_SUCCESS',(e:Error)=>e.message);await waiting;if(cancel)c.abort();let timer:ReturnType<typeof setTimeout>|undefined;const result=await Promise.race([work,new Promise(r=>{timer=setTimeout(()=>r('DID_NOT_SETTLE'),100);})]);if(timer)clearTimeout(timer);assert.equal(result,'SENT_CURRENT_ARCHIVE_UNAVAILABLE');assert.equal(observed?.aborted,true);finish(basis);await Promise.resolve();assert.equal(calls,1);
 }
});
test('동시 두 조회가 역순 완료되면 새 head 뒤에 도착한 옛 head를 채택하지 않는다',async()=>{
 const f=await ownershipCurrentFixture(),older=await f.read(),newer=await f.read();older.archive.readAt=newer.archive.readAt;
 let entered!:()=>void;const waiting=new Promise<void>(r=>entered=r),complete:((v:any)=>void)[]=[];
 const a=adapter({transport:'SYNTHETIC_ONLY',async resolve(){return new Promise(r=>{complete.push(r);if(complete.length===2)entered();});}},f.clock);
 const first=a.readCurrent(f.selection,new AbortController().signal).then(()=> 'UNEXPECTED_OLD_SUCCESS',(e:Error)=>e.message),second=a.readCurrent(f.selection,new AbortController().signal);await waiting;complete[1]!(newer);assert.deepEqual((await second).anchor,f.anchor);complete[0]!(older);assert.equal(await first,'SENT_CURRENT_ARCHIVE_UNAVAILABLE');
});
