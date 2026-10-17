import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validateHttpsQaLease,qaFailureSummary,qaCleanupTopNames} from '../../support/fn06-https-qa-server.ts';
test('HTTPS QA 임대는 정확 run/project/SHA·생성시작부터 최대60분으로 제한하고 과거·미래·추가필드를 거절한다',()=>{
 const now=Date.parse('2026-10-17T03:00:00.000Z'),lease={runId:'11111111-1111-4111-8111-111111111111',projectId:'22222222-2222-4222-8222-222222222222',sourceSha:'a'.repeat(40),createdAt:'2026-10-17T03:00:00.000Z',expiresAt:'2026-10-17T04:00:00.000Z'};
 assert.deepEqual(validateHttpsQaLease(lease,now),lease);
 for(const change of [{sourceSha:'main'},{runId:'../outside'},{expiresAt:'2026-10-17T04:00:00.001Z'},{expiresAt:lease.createdAt},{createdAt:'2026-10-17T03:01:00.000Z'},{privateKey:'not-allowed'}])assert.throws(()=>validateHttpsQaLease({...lease,...change},now),{message:'HTTPS_QA_LEASE_INVALID'});
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
test('ACL 준비 중 남은 본인 lease-only root도 정리하되 알 수 없는 파일은 보존한다',()=>{
 assert.deepEqual(qaCleanupTopNames(['lease.json']),['lease.json']);
 assert.deepEqual(qaCleanupTopNames(['lease.json','bin','protected','results']),['lease.json','bin','protected','results']);
 for(const names of [[],['lease.json','outside'],['bin'],['lease.json','../outside']])assert.throws(()=>qaCleanupTopNames(names),{message:'QA_EXTRA_FILE_PRESERVED'});
});
