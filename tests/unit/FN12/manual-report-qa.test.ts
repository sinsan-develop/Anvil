import test from 'node:test';import assert from 'node:assert/strict';
const m:any=await import('../../../tests/integration/FN12/manual-report-qa.ts').catch((e:any)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const entry=()=>{assert.equal(typeof m.validateManualReportQaEntry,'function');return m.validateManualReportQaEntry;};

test('관측 페이지 단일 QA는 기존 격리 대상에서만 선택하고 정식·혼합 설정을 거절한다',()=>{
 const check=entry(),now=1000000,v={cwd:'/home/daon/deploy/anvil-v3-fn12-manual-report-qa-01',sha:'a'.repeat(40),expires:now+300000,now,env:{ANVIL_FN12_MANUAL_REPORT_CASE:'OBSERVATION_PAGES'}};check(v);assert.throws(()=>check({...v,cwd:'/home/daon/deploy/anvil-v3'}));assert.throws(()=>check({...v,env:{...v.env,ANVIL_FN13_OBSERVATION_READ_QA:'1'}}));
});

test('새 참조의 단일 REFERENCES QA만 명시 선택하고 정식 설정·혼합 실행은 거절한다',()=>{
 const check=entry(),now=1000000,v={cwd:'/home/daon/deploy/anvil-v3-fn12-manual-report-qa-01',sha:'a'.repeat(40),expires:now+300000,now,env:{ANVIL_FN12_MANUAL_REPORT_CASE:'REFERENCES'}};check(v);assert.throws(()=>check({...v,env:{...v.env,PGHOST:'formal'}}));assert.throws(()=>check({...v,env:{...v.env,ANVIL_FN13_OTHER_QA:'1'}}));
});

test('수기 산출물 단일 QA 선택은 명시 ARTIFACTS만 받고 알 수 없는 실행 선택을 거절한다',()=>{
 const check=entry(),now=1000000,v={cwd:'/home/daon/deploy/anvil-v3-fn12-manual-report-qa-01',sha:'a'.repeat(40),expires:now+300000,now};check({...v,env:{ANVIL_FN12_MANUAL_REPORT_CASE:'ARTIFACTS'}});assert.throws(()=>check({...v,env:{ANVIL_FN12_MANUAL_REPORT_CASE:'UNKNOWN'}}));
});
test('직접보고 QA는 전용 exact 경로·유한창·실DB 설정 부재만 허용한다',()=>{
 const check=entry(),now=1000000,v={cwd:'/home/daon/deploy/anvil-v3-fn12-manual-report-qa-01',sha:'a'.repeat(40),expires:now+300000,now,env:{}};check(v);
 for(const change of [{cwd:'/home/daon/deploy/anvil-v3'},{sha:'HEAD'},{expires:now},{expires:now+600001},{env:{ANVIL_DB_CONFIG:'formal'}},{env:{PGHOST:'formal'}},{env:{NODE_OPTIONS:'--require unsafe'}}])assert.throws(()=>check({...v,...change}));
});
test('회수는 정확 신규PG ID·runlabel·고정image·빈mount/공개port0·전용network만 허용한다',()=>{
 entry();assert.equal(typeof m.assertManualReportQaContainer,'function');const q=m.manualReportQa,id='a'.repeat(64),run='b'.repeat(32),net='c'.repeat(64),v={Id:id,Name:'/'+q.pg,Image:q.imageId,Config:{Labels:{'anvil.owner':q.owner,'anvil.instance':run}},Mounts:[],HostConfig:{PortBindings:{},PublishAllPorts:false,Tmpfs:{'/var/lib/postgresql/data':'rw,noexec,nosuid,size=536870912'}},NetworkSettings:{Ports:{'5432/tcp':null},Networks:{[q.net]:{NetworkID:net}}}};m.assertManualReportQaContainer(v,id,run,net);
 for(const key of ['Name','Image','Mounts']){const bad=structuredClone(v);(bad as any)[key]=key==='Mounts'?[{Source:'formal'}]:'formal';assert.throws(()=>m.assertManualReportQaContainer(bad,id,run,net));}assert.throws(()=>m.assertManualReportQaContainer(v,id,'wrong',net));
});
