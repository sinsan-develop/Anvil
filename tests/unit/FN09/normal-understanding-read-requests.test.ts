import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {ProjectPolicyRepository} from '../../../apps/server/modules/access/project-command.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const modulePath='../../../apps/server/modules/executions/normal-understanding-read-requests.ts';
const mod:any=await import(modulePath).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const id=(n:number)=>`af090102-0000-4000-8000-${String(n).padStart(12,'0')}`,hash=(v:unknown)=>contentHash(canonicalJson(v));
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function fixture(reauthMode='CURRENT'){
 const pid=id(1),uid=id(2),cid=id(3),sid=id(4),eid=id(5),token='t'.repeat(43),csrf='c'.repeat(43);
 const at=new Date(),until=new Date(at.getTime()+60000),calls:string[]=[];
 let state:any={commands:[],requests:[]},backup:any,control=1,denied=false,failInsert=false,loseCommit=false,changed=false,changeAfterInsert=false,swapQuery=false,basisMissing=false;
 const rules:any[]=[{ruleId:'read-normal-understanding',subjectRef:{kind:'HUMAN',userId:uid},operations:['readNormalUnderstandingResponse'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:until.toISOString()}];
 const context={projectId:pid,executionId:eid,executionGeneration:1,grantRef:ref(10),registrationRef:ref(11),connectorId:id(12),credentialGeneration:1,
  startCommandId:id(13),startCommandRef:ref(14),assignmentRef:ref(15),preparationRef:ref(16),contextBundleRef:ref(17),sessionBindingRef:ref(18)};
 const request=()=>({schemaVersion:1 as const,projectId:pid,commandId:id(20),clientId:cid,controlGeneration:1,operation:'readNormalUnderstandingResponse',targetId:eid,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{assignmentRef:ref(15),preparationRef:ref(16)}});
 const db:any={query:async(sql:string,p:any[]=[])=>{
  calls.push(sql);const rows=(v:any[])=>({rows:v,rowCount:v.length});
  if(sql==='BEGIN'){backup=structuredClone(state);return{...rows([]),command:'BEGIN'};}
  if(sql==='COMMIT'){if(loseCommit)throw Error('RAM_COMMIT_UNKNOWN');return{...rows([]),command:'COMMIT'};}
  if(sql==='ROLLBACK'){state=backup;return{...rows([]),command:'ROLLBACK'};}
  if(sql.startsWith('SELECT s.*,u.id AS uid'))return rows([{id:sid,uid,client_id:cid,current_generation:1,credential_generation:1,user_status:'ACTIVE',user_revoked_at:null,client_revoked_at:null,revoked_at:null,idle_expires_at:until,absolute_expires_at:until,csrf_digest:createHash('sha256').update(csrf).digest('hex'),reauth_until:reauthMode==='NONE'?null:reauthMode==='EXPIRED'?new Date(at.getTime()-1):new Date(until),server_owner:false}]);
  if(sql.startsWith('SELECT clock_timestamp()'))return rows([{at,transaction_id:'17'}]);
  if(sql.startsWith('SELECT transaction_timestamp()'))return rows([{at}]);
  if(sql.startsWith('SELECT p.id,p.archived_at'))return rows([{id:pid,participation:'OWNER',archived_at:null}]);
  if(sql.startsWith('SELECT * FROM anvil.project_control'))return rows([{actor_id:uid,client_id:cid,generation:control,revoked_at:null}]);
  if(sql.includes('FROM anvil.permission_policies')){const body={rules:[...rules,...(denied?[{...rules[0],ruleId:'deny',disposition:'DENY'}]:[])],reason:'RAM',reviewRefs:[]};return rows([{id:id(30),head_version:1,rules_json:body.rules,content_hash:hash(body),reason:body.reason,review_refs:[],created_at:at}]);}
  if(sql.startsWith('SELECT anvil.fn09_normal_understanding_request_basis')){if(swapQuery){const original=db.query;db.query=(...args:any[])=>original(...args);}return rows([{basis:basisMissing?null:{context:{...context,...(changed?{startCommandId:id(99)}:{})},observedAt:at.toISOString(),expiresAt:until.toISOString()}}]);}
  if(sql.startsWith('SELECT operation,request_hash,result_ref'))return rows(state.commands.filter((c:any)=>c.command_key===p[2]));
  if(sql.startsWith('SELECT * FROM anvil.fn09_normal_understanding_request_replay'))return rows(state.requests.filter((r:any)=>r.commandId===JSON.parse(p[3]).commandId));
  if(sql.startsWith('INSERT INTO anvil.commands')){state.commands.push({id:p[0],command_key:p[5],operation:p[4],request_hash:p[6],result_ref:JSON.parse(p[14])});return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.authorization_receipts')||sql.startsWith('INSERT INTO anvil.audit_events')||sql.startsWith('SELECT set_config'))return rows([]);
  if(sql.startsWith('SELECT anvil.fn09_normal_understanding_request_insert')){if(failInsert)throw Error('RAM_INSERT_FAILED');const s=JSON.parse(p[7]),r=JSON.parse(p[6]);state.requests.push({id:r.id,content_hash:r.contentHash,snapshot_json:s,commandId:request().commandId,result_ref:state.commands.at(-1).result_ref,complete:true});if(changeAfterInsert)changed=true;return rows([{stored:r}]);}
  throw Error('UNEXPECTED_RAM_SQL');
 },release:()=>{calls.push('RELEASE');}};
 const access=new AccessRepository({connect:async()=>db} as any,{installationId:id(40),key:Buffer.alloc(32,1)});
 return{access,db,calls,request,token,csrf,pid,context,rules,run:()=>{assert.equal(typeof mod.NormalUnderstandingReadRequests,'function');return new mod.NormalUnderstandingReadRequests(access).command(token,csrf,request());},state:()=>state,deny:()=>{denied=true;},stale:()=>{control=2;},fail:()=>{failInsert=true;},unknown:()=>{loseCommit=true;},change:()=>{changed=true;},lateChange:()=>{changeAfterInsert=true;},swap:()=>{swapQuery=true;},missing:()=>{basisMissing=true;}};
}
test('FN09 metadata request uses original Access transaction and stores waiting only; identical replay writes nothing',async()=>{
 const f=fixture(),first=await f.run();assert.equal(first.data.status,'NORMAL_UNDERSTANDING_METADATA_REQUESTED');assert.equal(first.data.state,'PENDING_SOURCE');assert.equal(first.data.sourceAvailable,false);assert.equal(first.data.selectionAvailable,false);
 const s=f.state().requests[0].snapshot_json;assert.equal(s.sourceScope,null);assert.deepEqual(s.context,f.context);assert.equal(s.request.operation,'readNormalUnderstandingResponse');assert.equal(f.calls.filter(s=>s==='COMMIT').length,1);
 const writes=f.calls.filter(s=>s.startsWith('INSERT')||s.includes('request_insert')).length;assert.deepEqual(await f.run(),first);assert.equal(f.calls.filter(s=>s.startsWith('INSERT')||s.includes('request_insert')).length,writes);
});
test('FN09 current DENY/control loss and REQUIRE_APPROVAL reject before request or receipt writes',async()=>{
 for(const alter of [(f:any)=>f.deny(),(f:any)=>f.stale(),(f:any)=>{f.rules[0].disposition='REQUIRE_APPROVAL';}]){const f=fixture();alter(f);await assert.rejects(f.run());assert.equal(f.calls.some(s=>s.startsWith('INSERT')||s.includes('request_insert')),false);}
});
test('FN09 receipt/request insertion failure rolls back; uncertain COMMIT never returns pending success or retries',async()=>{
 for(const alter of [(f:any)=>f.fail(),(f:any)=>f.unknown()]){const f=fixture();alter(f);await assert.rejects(f.run());assert.equal(f.state().requests.length,0);assert.equal(f.calls.filter(s=>s==='BEGIN').length,1);assert.equal(f.calls.at(-1),'RELEASE');}
});
test('FN09 general project command cannot create or replay the dedicated request',async()=>{
 const f=fixture();await assert.rejects(new ProjectPolicyRepository(f.access).command(f.token,f.csrf,f.request()),/NORMAL_UNDERSTANDING_REQUEST_ROUTE_REQUIRED/);assert.deepEqual(f.calls,[]);
});
test('FN09 original stored source context must match on replay',async()=>{const f=fixture();await f.run();f.change();await assert.rejects(f.run(),/NORMAL_UNDERSTANDING_REQUEST/);assert.equal(f.state().requests.length,1);});
test('FN09 missing stored basis/query replacement reject before writes; source change after insert rolls back',async()=>{
 for(const action of ['missing','swap','lateChange'] as const){const f=fixture();f[action]();await assert.rejects(f.run(),/NORMAL_UNDERSTANDING_REQUEST/);assert.equal(f.state().requests.length,0);assert.equal(f.calls.includes('COMMIT'),false);if(action!=='lateChange')assert.equal(f.calls.some(s=>s.startsWith('INSERT')),false);}
});

test('FN09 actual Access Date reauthentication is required and its expiry is bounded',async()=>{const f=fixture();assert.equal((await f.run()).data.state,'PENDING_SOURCE');for(const mode of ['NONE','EXPIRED']){const f=fixture(mode);await assert.rejects(f.run(),/REAUTHENTICATION_REQUIRED/);assert.equal(f.calls.some(s=>s.startsWith('INSERT')||s.includes('request_insert')),false);}});

test('FN09 actual buildApp inject reaches dedicated metadata request and blocks mixed identity/cross project/query',async()=>{
 const {buildApp}=await import('../../../apps/server/app.ts');const f=fixture(),app=buildApp({},undefined,{repository:f.access,origin:'https://anvil.test'});
 const url='/api/v1/projects/'+f.pid+'/executions/'+f.request().targetId+'/understanding-response-read-requests',headers={host:'anvil.test',origin:'https://anvil.test',cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf};
 try{const response=await app.inject({method:'POST',url,headers,payload:f.request()});assert.equal(response.statusCode,200,response.body);assert.equal(response.json().data.state,'PENDING_SOURCE');const writes=f.state().commands.length;for(const patch of [{url:url+'?next=1'},{headers:{...headers,authorization:'Bearer ignored'}},{payload:{...f.request(),projectId:id(99)}}]){const r=await app.inject({method:'POST',url,headers,payload:f.request(),...patch});assert.ok(r.statusCode>=400);assert.equal(f.state().commands.length,writes);}}finally{await app.close();}
});
