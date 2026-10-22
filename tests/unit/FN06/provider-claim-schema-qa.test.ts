import test from 'node:test';import assert from 'node:assert/strict';
const m:any=await import('../../integration/FN06/provider-claim-schema-qa.ts').catch((e:any)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
test('회수 단계 예외·false 뒤에도 남은 회수를 시도하고 실패를 보존한다',async()=>{
 const calls:string[]=[];assert.equal(await m.runProviderClaimLabCleanup([()=>{calls.push('budget');throw Error('expired');},async()=>{calls.push('pool');return false;},async()=>{calls.push('pg');throw Error('timeout');},async()=>{calls.push('network');return true;}]),false);assert.deepEqual(calls,['budget','pool','pg','network']);assert.equal(await m.runProviderClaimLabCleanup([async()=>true]),true);
});
test('권한 closure는 표본 밖 추가 UPDATE 열·grant option·중복도 거절한다',()=>{
 const rows=['auth_sessions:id','users:id','clients:id','projects:id','permission_policies:id','project_members:project_id','project_control:project_id'].map(x=>{const [table,column]=x.split(':');return{table,column,privilege:'UPDATE',grantable:false};});m.assertProviderClaimColumnAcl(rows);for(const extra of[{table:'users',column:'created_at',privilege:'UPDATE',grantable:false},{...rows[0],grantable:true},rows[0]])assert.throws(()=>m.assertProviderClaimColumnAcl([...rows,extra]));
});
test('claim schema lab은 새 전용 root·유한창·명시실행만 허용하고 정식/혼합 설정을 거절한다',()=>{
 assert.equal(typeof m.validateProviderClaimSchemaQa,'function');const now=1000000,v={cwd:'/home/daon/deploy/anvil-v3-fn06-claim-schema-qa-01',sha:'a'.repeat(40),expires:now+300000,now,env:{ANVIL_FN06_CLAIM_SCHEMA_QA:'1'}};m.validateProviderClaimSchemaQa(v);
 for(const change of[{cwd:'/home/daon/deploy/anvil-v3'},{sha:'HEAD'},{expires:now},{expires:now+600001},{env:{}},{env:{...v.env,PGHOST:'formal'}},{env:{...v.env,ANVIL_FN12_MANUAL_REPORT_QA:'1'}},{env:{...v.env,NODE_OPTIONS:'--require unsafe'}}])assert.throws(()=>m.validateProviderClaimSchemaQa({...v,...change}));
});
test('claim schema lab 회수는 정확 ID·owner/runlabel·고정image·전용net·무mount/공개port0만 허용한다',()=>{
 assert.equal(typeof m.assertProviderClaimLabContainer,'function');const q=m.providerClaimLab,id='a'.repeat(64),run='b'.repeat(32),net='c'.repeat(64),v={Id:id,Name:'/'+q.pg,Image:q.imageId,Config:{Labels:{'anvil.owner':q.owner,'anvil.instance':run}},Mounts:[],HostConfig:{PortBindings:{},PublishAllPorts:false,Tmpfs:{'/var/lib/postgresql/data':'rw,noexec,nosuid,size=536870912'}},NetworkSettings:{Ports:{'5432/tcp':null},Networks:{[q.net]:{NetworkID:net}}}};m.assertProviderClaimLabContainer(v,id,run,net);for(const key of['Name','Image','Mounts']){const bad=structuredClone(v);(bad as any)[key]=key==='Mounts'?[{Source:'formal'}]:'formal';assert.throws(()=>m.assertProviderClaimLabContainer(bad,id,run,net));}assert.throws(()=>m.assertProviderClaimLabContainer(v,id,'wrong',net));
});
