import test from 'node:test';import assert from 'node:assert/strict';
const m:any=await import('../../../tests/integration/FN12/manual-report-qa.ts').catch((e:any)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const entry=()=>{assert.equal(typeof m.validateManualReportQaEntry,'function');return m.validateManualReportQaEntry;};

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
