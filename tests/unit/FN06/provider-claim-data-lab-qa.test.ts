import test from 'node:test';import assert from 'node:assert/strict';
const m:any=await import('../../integration/FN06/provider-claim-data-lab-qa.ts').catch((e:any)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
test('claim 데이터 runner는 전용 root·명시 유한 실행만 허용하고 schema모드/정식 PG 설정을 거절한다',()=>{
 const now=1000000,v={cwd:'/home/daon/deploy/anvil-v3-fn06-claim-data-qa-01',sha:'a'.repeat(40),now,expires:now+300000,env:{ANVIL_FN06_CLAIM_DATA_QA:'1'}};m.validateProviderClaimDataQa(v);
 for(const d of[{cwd:'/home/daon/deploy/anvil-v3'},{sha:'HEAD'},{expires:now+600001},{expires:now},{env:{}},{env:{...v.env,PGPASSWORD:'formal'}},{env:{...v.env,ANVIL_FN06_CLAIM_SCHEMA_QA:'1'}},{env:{...v.env,NODE_OPTIONS:'--require unsafe'}}])assert.throws(()=>m.validateProviderClaimDataQa({...v,...d}));
});
test('데이터 lab 회수는 자기 fullID·label·image·tmpfs·전용net 및 공개port0만 허용한다',()=>{
 const q=m.providerClaimDataLab,id='a'.repeat(64),run='b'.repeat(32),net='c'.repeat(64),v={Id:id,Name:'/anvil-v3-fn06-claim-data-pg-01',Image:'sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f',Config:{Labels:{'anvil.owner':'AV3_FN06_CLAIM_DATA_QA','anvil.instance':run}},Mounts:[],HostConfig:{PortBindings:{},PublishAllPorts:false,Tmpfs:{'/var/lib/postgresql/data':'rw,noexec,nosuid,size=536870912'}},NetworkSettings:{Ports:{'5432/tcp':null},Networks:{'anvil-v3-fn06-claim-data-net-01':{NetworkID:net}}}};
 m.assertProviderClaimDataContainer(v,id,run,net);for(const change of[{Name:'/anvil-v3-development-pg'},{Image:'formal'},{Mounts:[{Source:'formal'}]},{Config:{Labels:{'anvil.owner':q.owner,'anvil.instance':'wrong'}}},{HostConfig:{...v.HostConfig,PortBindings:{'5432/tcp':[{}]}}}])assert.throws(()=>m.assertProviderClaimDataContainer({...v,...change},id,run,net));
});
test('child summary 부재·중복·실패·미정리는 완료로 처리하지 않고 원문 오류를 출력하지 않는다',()=>{
 const safe={phase:'DONE',cases:['FN06_NORMAL_REGISTRATION_RESERVATION_SIGNED_START','FN06_CLAIM_COMMIT_DISTINCT_READ_SAME_NEW_PROOF_ATOMIC_ROLLBACK','EXPLICIT_SYNTHETIC_SOURCE_OS_NO_ACTUAL_PROVIDER'],failure:null,rootCleanup:{files:2,dirs:5},closeFailures:0,rootCleanupFailed:false};
 assert.deepEqual(m.readClaimDataChildSummary('noise PRIVATE_TOKEN\nFN12_ISOLATED_SAFE '+JSON.stringify(safe)+'\n'),safe);
 for(const out of['PRIVATE_TOKEN','FN12_ISOLATED_SAFE '+JSON.stringify({...safe,failure:{code:'ERROR'}}),'FN12_ISOLATED_SAFE '+JSON.stringify({...safe,closeFailures:1}),'FN12_ISOLATED_SAFE '+JSON.stringify({...safe,cases:[]}),'FN12_ISOLATED_SAFE '+JSON.stringify(safe)+'\nFN12_ISOLATED_SAFE '+JSON.stringify(safe)])assert.throws(()=>m.readClaimDataChildSummary(out),e=>!String(e).includes('PRIVATE_TOKEN'));
});

test('실패 child의 안전 phase/code만 보존하고 stderr/본문/credential은 반환하지 않는다',()=>{
 const failure={phase:'FN06_CLAIM_DATA',messageCode:'CLAIM_QA_TRUST_PREREQUISITE_REFUSED',code:null,lastResponseCode:'POLICY_DENIED',expected:200,actual:403,secret:'PRIVATE_TOKEN'},summary={phase:'FN06_CLAIM_DATA',failure,rootCleanup:{files:2,dirs:5},closeFailures:0,rootCleanupFailed:false};
 const got=m.readClaimDataChildFailure('# FN12_ISOLATED_SAFE '+JSON.stringify(summary)+'\nPRIVATE_TOKEN');
 assert.deepEqual(got,{phase:'FN06_CLAIM_DATA',messageCode:'CLAIM_QA_TRUST_PREREQUISITE_REFUSED',code:null,lastResponseCode:'POLICY_DENIED',expected:200,actual:403,closeFailures:0,rootCleanupFailed:false});assert(!JSON.stringify(got).includes('PRIVATE_TOKEN'));
 const bad=m.readClaimDataChildFailure('FN12_ISOLATED_SAFE '+JSON.stringify({...summary,failure:{...failure,messageCode:'PRIVATE_TOKEN secret',expected:'PRIVATE_TOKEN'}}));assert.equal(bad.messageCode,null);assert.equal(bad.expected,null);assert.deepEqual(m.readClaimDataChildFailure('PRIVATE_TOKEN'),{phase:'SAFE_SUMMARY_UNAVAILABLE'});
 const shapedSecret=m.readClaimDataChildFailure('FN12_ISOLATED_SAFE '+JSON.stringify({...summary,phase:'PRIVATE_TOKEN',failure:{...failure,messageCode:'PRIVATE_TOKEN',code:'PRIVATE_TOKEN',lastResponseCode:'PRIVATE_TOKEN'}}));assert.equal(shapedSecret.phase,'SAFE_SUMMARY_UNAVAILABLE');assert.equal(shapedSecret.messageCode,null);assert.equal(shapedSecret.code,null);assert.equal(shapedSecret.lastResponseCode,null);
});
