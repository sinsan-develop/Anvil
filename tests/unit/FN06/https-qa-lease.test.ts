import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validateHttpsQaLease} from '../../support/fn06-https-qa-server.ts';
test('HTTPS QA 임대는 정확 run/project/SHA·생성시작부터 최대60분으로 제한하고 과거·미래·추가필드를 거절한다',()=>{
 const now=Date.parse('2026-10-17T03:00:00.000Z'),lease={runId:'11111111-1111-4111-8111-111111111111',projectId:'22222222-2222-4222-8222-222222222222',sourceSha:'a'.repeat(40),createdAt:'2026-10-17T03:00:00.000Z',expiresAt:'2026-10-17T04:00:00.000Z'};
 assert.deepEqual(validateHttpsQaLease(lease,now),lease);
 for(const change of [{sourceSha:'main'},{runId:'../outside'},{expiresAt:'2026-10-17T04:00:00.001Z'},{expiresAt:lease.createdAt},{createdAt:'2026-10-17T03:01:00.000Z'},{privateKey:'not-allowed'}])assert.throws(()=>validateHttpsQaLease({...lease,...change},now),{message:'HTTPS_QA_LEASE_INVALID'});
 assert.throws(()=>validateHttpsQaLease(lease,now+3600001),{message:'HTTPS_QA_LEASE_INVALID'});
 assert.deepEqual(validateHttpsQaLease(lease,now+3600001,false),lease); // 만료 뒤에도 정확 본인 자원만 정리할 수 있다.
});
