import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as qa from '../../support/fn06-https-qa-server.ts';
const {validateHttpsQaLease,qaFailureSummary,qaCleanupTopNames}=qa;
test('HTTPS QA 임대는 정확 run/project/SHA·생성시작부터 최대60분으로 제한하고 과거·미래·추가필드를 거절한다',()=>{
 const now=Date.parse('2026-10-17T02:00:00.000Z'),lease={runId:'11111111-1111-4111-8111-111111111111',projectId:'22222222-2222-4222-8222-222222222222',sourceSha:'a'.repeat(40),createdAt:'2026-10-17T02:00:00.000Z',expiresAt:'2026-10-17T03:00:00.000Z'};
 assert.deepEqual(validateHttpsQaLease(lease,now),lease);
 for(const change of [{sourceSha:'main'},{runId:'../outside'},{expiresAt:'2026-10-17T03:00:00.001Z'},{expiresAt:lease.createdAt},{createdAt:'2026-10-17T02:01:00.000Z'},{privateKey:'not-allowed'}])assert.throws(()=>validateHttpsQaLease({...lease,...change},now),{message:'HTTPS_QA_LEASE_INVALID'});
 assert.throws(()=>validateHttpsQaLease(lease,now+3600001),{message:'HTTPS_QA_LEASE_INVALID'});
 assert.deepEqual(validateHttpsQaLease(lease,now+3600001,false),lease); // 만료 뒤에도 정확 본인 자원만 정리할 수 있다.
});
test('최초 QA 실패와 정리 실패는 고정 phase/유한 코드로 구별하고 child 비밀은 반사하지 않는다',()=>{
 const error={code:'EACCES',status:1,stderr:Buffer.from('Set-Acl Access is denied PRIVATE_RAW_VALUE'),message:'PRIVATE_RAW_VALUE'};
 assert.deepEqual(qaFailureSummary('ROOT_ACL',error),{kind:'QA_FAILED',phase:'ROOT_ACL',category:'ACL_ACCESS_DENIED',childStatus:1});
 assert.equal(JSON.stringify(qaFailureSummary('ROOT_ACL',error)).includes('PRIVATE_RAW_VALUE'),false);
 assert.deepEqual(qaFailureSummary('PRIVATE_RAW_VALUE',error),{kind:'QA_FAILED',phase:'UNKNOWN',category:'CHILD_FAILED',childStatus:1});
 assert.equal(qaFailureSummary('CLEANUP',error).phase,'CLEANUP');
});
test('standalone HTTPS 시작도 최초 전체 기한 이후의 새 임대를 거절하고 만료된 본인 정리만 허용한다',()=>{
 const now=Date.parse('2026-10-17T03:00:00.000Z'),lease={runId:'11111111-1111-4111-8111-111111111111',projectId:'22222222-2222-4222-8222-222222222222',sourceSha:'a'.repeat(40),createdAt:'2026-10-17T03:00:00.000Z',expiresAt:'2026-10-17T03:29:30.227Z'};
 assert.deepEqual(validateHttpsQaLease(lease,now),lease);
 assert.throws(()=>validateHttpsQaLease({...lease,expiresAt:'2026-10-17T03:29:30.228Z'},now),{message:'HTTPS_QA_LEASE_INVALID'});
 const later={...lease,createdAt:'2026-10-17T04:00:00.000Z',expiresAt:'2026-10-17T04:10:00.000Z'};
 assert.throws(()=>validateHttpsQaLease(later,Date.parse(later.createdAt)),{message:'HTTPS_QA_LEASE_INVALID'});
 assert.throws(()=>validateHttpsQaLease(lease,Date.parse(lease.expiresAt)),{message:'HTTPS_QA_LEASE_INVALID'});
 assert.deepEqual(validateHttpsQaLease(lease,Date.parse(lease.expiresAt)+1,false),lease);
});
test('ACL 준비 중 남은 본인 lease-only root도 정리하되 알 수 없는 파일은 보존한다',()=>{
 assert.deepEqual(qaCleanupTopNames(['lease.json']),['lease.json']);
 assert.deepEqual(qaCleanupTopNames(['lease.json','bin','protected','results']),['lease.json','bin','protected','results']);
 for(const names of [[],['lease.json','outside'],['bin'],['lease.json','../outside']])assert.throws(()=>qaCleanupTopNames(names),{message:'QA_EXTRA_FILE_PRESERVED'});
});
test('stage 중 종료는 진행 중 쓰기가 끝난 뒤 정확 정리하고 다음 키·서버 생성을 막는다',async()=>{
 assert.equal(typeof (qa as any).withHttpsQaLifecycle,'function');
 const run=(qa as any).withHttpsQaLifecycle;let stop=()=>{},release=()=>{},entered=()=>{},cleaned=0,ran=false,detached=false;const files:string[]=[];
 const started=new Promise<void>(resolve=>{entered=resolve;}),pending=new Promise<void>(resolve=>{release=resolve;});
 const task=run({installStop:(callback:()=>void)=>{stop=callback;return()=>{detached=true;};},stage:async(life:any)=>{await life.step(async()=>{files.push('lease.json-partial');entered();await pending;});await life.step(async()=>{files.push('server.key.pem');});},run:async()=>{ran=true;},cleanup:async()=>{cleaned++;files.length=0;}});
 await started;stop();stop();assert.equal(cleaned,0);release();await assert.rejects(task,{message:'HTTPS_QA_STOP_REQUESTED'});
 assert.deepEqual(files,[]);assert.equal(cleaned,1);assert.equal(ran,false);assert.equal(detached,true);
});
test('lease 초기쓰기 실패도 메모리 소유 stage 정리로 전달하고 등록하지 않은 파일은 보존한다',async()=>{
 assert.equal(typeof (qa as any).withHttpsQaLifecycle,'function');assert.equal(typeof (qa as any).qaPartialStageNames,'function');
 const files=['lease.json'];let ran=false,cleaned=0;
 await assert.rejects((qa as any).withHttpsQaLifecycle({installStop:()=>()=>{},stage:async(life:any)=>{await life.step(async()=>{throw Error('SYNTHETIC_PARTIAL_LEASE_WRITE');});},run:async()=>{ran=true;},cleanup:async()=>{(qa as any).qaPartialStageNames(files,new Set(['lease.json']));files.length=0;cleaned++;}}),{message:'SYNTHETIC_PARTIAL_LEASE_WRITE'});
 assert.equal(ran,false);assert.equal(cleaned,1);assert.deepEqual(files,[]);
 assert.throws(()=>(qa as any).qaPartialStageNames(['lease.json','unowned'],new Set(['lease.json'])),{message:'HTTPS_QA_EXTRA_FILE_PRESERVED'});
 assert.throws(()=>(qa as any).qaPartialStageNames(['server.key.pem'],new Set(['lease.json'])),{message:'HTTPS_QA_EXTRA_FILE_PRESERVED'});
});
test('정상 lifecycle은 stage 뒤 run 결과를 보존하고 정리 완료 뒤에만 종료 핸들러를 해제한다',async()=>{
 let ready=false,served=false,cleaned=false,detached=false;
 await qa.withHttpsQaLifecycle({installStop:()=>()=>{assert.equal(cleaned,true);detached=true;},stage:async life=>{await life.step(async()=>{ready=true;});},run:async life=>{assert.equal(ready,true);await life.step(async()=>{served=true;});},cleanup:async()=>{assert.equal(served,true);assert.equal(detached,false);cleaned=true;}});
 assert.equal(detached,true);
});
