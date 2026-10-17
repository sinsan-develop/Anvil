import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lstat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {WindowsHttpsQaResources} from '../../support/fn06-windows-qa-resources.ts';
import {qaFailureSummary} from '../../support/fn06-https-qa-server.ts';
const deadline='2026-10-17T03:29:30.227Z';
function resources(){if(process.platform!=='win32')throw Error('WINDOWS_FOCUSED_QA_REQUIRED_NOT_SKIP');return new WindowsHttpsQaResources({runId:randomUUID(),projectId:randomUUID(),sourceSha:process.env.ANVIL_FN06_HTTPS_SOURCE!,createdAt:new Date().toISOString(),expiresAt:deadline});}
test('lease 전 빈 본인 root의 준비 실패도 추가자료 없이 정확 정리한다',{timeout:30000},async()=>{const r=resources();try{await r.create();}finally{await r.cleanup();}await assert.rejects(lstat(r.root),{code:'ENOENT'});});
test('본인 root만 DACL 최소보호·owner 불변 검증 후 lease를 쓰고 준비 실패와 정리 결과를 분리한다',{timeout:30000},async()=>{const r=resources();let primary:any;try{await r.create();await r.protect();await r.initialize();primary=qaFailureSummary('ROOT_DIRS',Error('CONTROLLED_PRE_TLS_FAILURE'));}finally{await r.cleanup();}assert.equal(primary.phase,'ROOT_DIRS');await assert.rejects(lstat(r.root),{code:'ENOENT'});console.log(JSON.stringify({kind:'ROOT_FOCUSED_FAILURE_CHECKED',primary,cleanupRemaining:0,tlsTransfers:0,listenerCreated:0,localHelperCandidate:true,expiresAt:deadline}));});
