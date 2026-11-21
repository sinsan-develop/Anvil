import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const sql=await readFile(new URL('../../../db/migrations/0102_normal_understanding_responses.sql.pending',import.meta.url),'utf8');
test('DISCOVERY acquisition is a scoped current RPC with same request/nonce receipt completion',()=>{
 for(const name of ['fn09_normal_understanding_discovery','fn09_normal_understanding_acquisition_valid','normal_request_challenge_valid_pre0102','normal_command_consumption_valid_pre0102'])assert.ok(sql.includes(name),name);
 assert.ok(sql.includes('NORMAL_UNDERSTANDING_DISCOVERY_ACQUIRED'));
 assert.ok(sql.includes('understandingRequestRef'));
});
import {randomUUID,randomBytes,generateKeyPairSync,sign} from 'node:crypto';
import {buildApp} from '../../../apps/server/app.ts';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {reserveExecutionBudget} from '../../../apps/server/modules/executions/execution-budget.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {executionChallengeRequestBytes,executionProofBytes} from '../../../apps/server/modules/executions/execution-proof.ts';
import {publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
function fixture(enabled=true){
 const ref=()=>({id:randomUUID(),version:1,contentHash:hash(randomUUID())});
 const pid=randomUUID(),cid=randomUUID(),eid=randomUUID(),g=ref(),cred=ref(),start=Date.parse('2026-11-22T01:00:00Z'),origin='https://synthetic.invalid';
 const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=pair.publicKey.export({format:'der',type:'spki'}).toString('base64url');
 const binding={transport:'NORMAL_PROTECTED',mode:'EXECUTION',projectId:pid,connectorId:cid,executionId:eid,executionGeneration:1,grantRef:g,scopeDigest:hash('scope'),credentialGeneration:1,publicKeyFingerprint:publicKeyFingerprint(spki)};
 const at=new Date(start).toISOString(),expiresAt=new Date(start+30000).toISOString(),context={projectId:pid,connectorId:cid,executionId:eid,executionGeneration:1,grantRef:g,credentialGeneration:1,registrationRef:ref(),startCommandId:randomUUID(),startCommandRef:ref(),assignmentRef:ref(),preparationRef:ref(),contextBundleRef:ref(),sessionBindingRef:ref()};
 const q={schemaVersion:1,projectId:pid,commandId:randomUUID(),clientId:randomUUID(),controlGeneration:1,operation:'readNormalUnderstandingResponse',targetId:eid,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{assignmentRef:context.assignmentRef,preparationRef:context.preparationRef}};
 const snapshot={schemaVersion:1,purpose:'NORMAL_UNDERSTANDING_METADATA_DISCOVERY',request:q,context,requestedBy:{kind:'HUMAN',userId:randomUUID(),clientId:q.clientId,sessionId:randomUUID(),credentialGeneration:1,controlGeneration:1},policyRef:ref(),state:'PENDING_SOURCE',sourceScope:null,createdAt:at,expiresAt};
 let human={id:randomUUID(),version:1,contentHash:hash(snapshot)},rows:any[]=[],receipts:any[]=[],lock=Promise.resolve();
 const state={now:start,none:false,denied:false,current:true,corrupt:false,commitUnknown:false,rollbackUnknown:false,rollbackThrow:false,afterInsert:false,releases:[] as boolean[],commits:0,rollbacks:0,queries:[] as string[]};
 const ps={scope:{kind:'PROJECT',projectId:pid},state:'APPLIED',limits:{maxAttempts:3,maxCalls:50,maxConcurrentAssignments:1,maxElapsedMs:7200000,maxOfflineMs:300000,maxSpoolBytes:1073741824},decidedAt:at,expiresAt:new Date(start+240000).toISOString()};
 const policy={projectId:pid,ref:{...ref(),contentHash:hash(ps)},snapshot:ps};
 const reserve=reserveExecutionBudget([],policy as any,{projectId:pid,executionId:eid,executionGeneration:1,commandId:randomUUID(),assignmentRef:g,stageRef:{applicationRef:g,nodeId:'개발'},policyRef:policy.ref,operation:'START_SESSION',demand:{attempts:1,calls:1,spoolBytes:1,cost:null,costStatus:'VERIFIED_NO_CHARGE'}},at);
 const pool={async connect(){let unlock=()=>{},pending:any[]=[],rs:any[]=[];return{release(e?:Error){state.releases.push(!!e);},async query(sql:string,a:any[]=[]):Promise<any>{
  state.queries.push(sql);
  if(sql==='BEGIN'){const previous=lock;lock=new Promise<void>(r=>unlock=r);await previous;pending=structuredClone(rows);rs=structuredClone(receipts);return{command:'BEGIN',rows:[]};}
  if(sql==='COMMIT'){rows=pending;receipts=rs;unlock();state.commits++;if(state.commitUnknown)throw Error('unexposed SQL details');return{command:'COMMIT',rows:[]};}
  if(sql==='ROLLBACK'){state.rollbacks++;unlock();if(state.rollbackThrow)throw Error('raw rollback');return{command:state.rollbackUnknown?'':'ROLLBACK',rows:[]};}
  if(sql.includes('SET LOCAL')||sql.includes('set_config'))return{rows:[]};
  if(sql.includes('normal_request_credential'))return{rows:[{project_id:pid,credential_ref:cred,expires_at:new Date(start+240000)}]};
  if(sql.includes('normal_exchange_current'))return{rows:state.current?[{binding,spki,deadline:new Date(start+240000),observed_at:new Date(state.now),budget_ref:reserve.ref,budget_policy:policy}]:[]};
  if(sql.includes('FROM anvil.usage_reservations'))return{rows:[{project_id:pid,reservation_id:reserve.ref.id,version:1,content_hash:reserve.ref.contentHash,snapshot_json:reserve.snapshot,server_sequence:1,command_id:reserve.snapshot.claim.commandId}]};
  if(sql==='SELECT clock_timestamp() AS at')return{rows:[{at:new Date(state.now)}]};
  if(sql.includes('fn09_normal_understanding_discovery')){
   // SQL contract fixture only: this is not a real permission/lock proof.
   if(state.denied)throw Error('NORMAL_UNDERSTANDING_DISCOVERY_DENIED');
   if(state.now>=start+30000)throw Error('NORMAL_UNDERSTANDING_DISCOVERY_EXPIRED');
   const expected=JSON.parse(a[3]);
   if(expected!==null&&canonicalJson(expected)!==canonicalJson(human))throw Error('NORMAL_UNDERSTANDING_DISCOVERY_DENIED');
   if(pending.some(x=>x.version===1&&x.snapshot_json.understandingRequestRef&&x.snapshot_json.request.requestId!==a[2]))throw Error('NORMAL_UNDERSTANDING_DISCOVERY_DENIED');
   return{rows:[{discovery:state.none?{status:'NONE'}:{status:'REQUEST',requestRef:human,snapshot:state.corrupt?{...snapshot,sourceScope:{unproven:true}}:snapshot,deadline:expiresAt}}]};
  }
  if(sql.startsWith('INSERT INTO anvil.execution_challenges')){
   const value=JSON.parse(a.at(-1)),version=value.consumption===null?1:2;pending.push({id:a[1],version,content_hash:hash(value),snapshot_json:value});if(state.afterInsert)state.current=false;return{rowCount:1,rows:[]};
  }
  if(sql.startsWith('INSERT INTO anvil.execution_receipts')){rs.push({id:a[1],challenge_id:a[4],content_hash:a[5],snapshot_json:JSON.parse(a[6])});return{rowCount:1,rows:[]};}
  if(sql.includes('count(*) FILTER')){const originals=pending.filter(x=>x.version===1);return{rows:[{total:originals.length,recent:originals.length,sequence:pending.length+1,live:originals.filter(x=>!pending.some(v=>v.version===2&&v.id===x.id)).length}]};}
  if(sql.startsWith('SELECT COALESCE(max'))return{rows:[{sequence:pending.length+1}]};
  if(sql.includes('LEFT JOIN anvil.execution_receipts'))return{rows:pending.filter(v=>v.version===2&&v.id===a[3]).map(v=>{const r=rs.find(r=>r.challenge_id===v.id);return{vhash:v.content_hash,consumed:v.snapshot_json,id:r?.id,content_hash:r?.content_hash,receipt:r?.snapshot_json};})};
  if(sql.includes('FROM anvil.execution_challenges')&&sql.includes('request_id='))return{rows:pending.filter(v=>v.version===1&&(v.snapshot_json.request.requestId===a[3]||v.snapshot_json.request.clientNonce===a[4]))};
  if(sql.includes('FROM anvil.execution_challenges'))return{rows:pending.filter(v=>v.version===1&&v.id===a[3]&&v.content_hash===a[4])};
  throw Error('Unexpected SQL '+sql);
 }}}};
 const access={repository:new AccessRepository(pool as any,{installationId:randomUUID(),key:Buffer.alloc(32,2)}),origin};
 const app=buildApp({},undefined,enabled?access:undefined,undefined,undefined,undefined,undefined,null,undefined,undefined,undefined,{pool} as any,undefined,{origin});
 // RAM request socket only. No listener, TLS service, DB or private key input.
 app.addHook('onRequest',async r=>{Object.defineProperty(r.raw.socket,'encrypted',{value:true,configurable:true});});
 const path='/api/v1/connectors/'+cid+'/executions/'+eid,target={method:'GET',path:path+'/understanding-response-read',queryHash:hash({}),bodyHash:hash(null)};
 const request={requestId:randomUUID(),purpose:'EXECUTION_REQUEST',grantRef:g,credentialGeneration:1,target,clientNonce:randomBytes(32).toString('base64url'),issuedAt:at};
 const signature=(bytes:Buffer)=>sign('sha256',bytes,{key:pair.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 const headers={host:'synthetic.invalid',authorization:'Bearer av3ex1_'+randomBytes(32).toString('base64url')};
 const issue=(r:any=request)=>app.inject({method:'POST',url:path+'/challenges',headers,payload:{...r,signature:signature(executionChallengeRequestBytes('EXECUTION',r))}});
 const packet=(issued:any)=>{const proof={requestId:issued.challenge.requestId,...target,grantRef:g,credentialGeneration:1,serverNonce:issued.challenge.serverNonce};return{schemaVersion:1,challengeRef:issued.ref,proof,signature:signature(executionProofBytes('EXECUTION_REQUEST_PROOF',proof))};};
 const get=(p:any)=>app.inject({method:'GET',url:target.path,headers:{...headers,'anvil-execution-auth':Buffer.from(canonicalJson(p)).toString('base64url')}});
 return{app,state,issue,packet,get,request,target,human:()=>human,replaceHuman:()=>{human={...human,id:randomUUID()};},rows:()=>rows,receipts:()=>receipts};
}
test('RAM app: same HUMAN request -> signed challenge -> one acquisition receipt, exact packet replay preserves original expiry',async()=>{
 const f=fixture();try{
  const issued=await f.issue();assert.equal(issued.statusCode,200,issued.body);assert.deepEqual(f.rows()[0].snapshot_json.understandingRequestRef,f.human());
  const frame=f.packet(issued.json());const [a,b]=await Promise.all([f.get(frame),f.get(frame)]);
  assert.equal(a.statusCode,200,a.body);assert.equal(b.statusCode,200,b.body);assert.deepEqual(a.json(),b.json());
  assert.equal(a.json().status,'DISCOVERY_ACQUIRED');assert.equal(a.json().sourceAvailable,false);assert.equal(a.json().selectionAvailable,false);
  assert.equal(f.rows().length,2);assert.equal(f.receipts().length,1);assert.equal(a.json().receipt.kind,'NORMAL_UNDERSTANDING_DISCOVERY_ACQUIRED');
  assert.doesNotMatch(a.body,/initConfirmationRef|tailRef|plannedSid|slotRef|sourceScope/);
  f.state.now+=1000;const replay=await f.get(frame);assert.equal(replay.statusCode,200);assert.deepEqual(replay.json(),a.json());
  const replacement=await f.issue({...f.request,requestId:randomUUID(),clientNonce:randomBytes(32).toString('base64url')});assert.equal(replacement.statusCode,412);assert.equal(f.rows().length,2);
 }finally{await f.app.close();}
});
test('NONE has no nonce and requires known rollback; missing provider stays503 without DB',async()=>{
 for(const mode of ['none','rollbackUnknown','rollbackThrow','missing'] as const){const f=fixture(mode!=='missing');try{
  f.state.none=true;if(mode==='rollbackUnknown')f.state.rollbackUnknown=true;if(mode==='rollbackThrow')f.state.rollbackThrow=true;
  const r=await f.issue();assert.equal(r.statusCode,mode==='none'?200:503,r.body);assert.equal(f.rows().length,0);
  if(mode==='none'){assert.equal(r.json().status,'NONE');assert.equal(r.json().challenge,null);assert.deepEqual(f.state.releases,[false]);}
  else if(mode==='missing')assert.equal(f.state.queries.length,0);
  else{assert.equal(r.json().status,undefined);assert.deepEqual(f.state.releases,[true]);assert.equal(f.state.rollbacks,1);}
 }finally{await f.app.close();}}
});
test('denied/expired/corrupt HUMAN basis never issues a nonce; exact request change cannot consume original nonce',async()=>{
 for(const mode of ['denied','expired','corrupt'] as const){const f=fixture();try{
  if(mode==='denied')f.state.denied=true;else if(mode==='expired')f.state.now+=30000;else f.state.corrupt=true;
  const r=await f.issue();assert.equal(r.statusCode,mode==='corrupt'?503:412,r.body);assert.equal(f.rows().length,0);
 }finally{await f.app.close();}}
 const f=fixture();try{const issue=await f.issue();assert.equal(issue.statusCode,200,issue.body);f.replaceHuman();const r=await f.get(f.packet(issue.json()));assert.equal(r.statusCode,412,r.body);assert.equal(f.rows().length,1);assert.equal(f.receipts().length,0);}finally{await f.app.close();}
});
test('late current loss/COMMIT uncertainty do not publish an acquisition and never retry',async()=>{
 for(const mode of ['afterInsert','commitUnknown'] as const){const f=fixture();try{
  const issue=await f.issue();assert.equal(issue.statusCode,200,issue.body);f.state[mode]=true;
  const r=await f.get(f.packet(issue.json()));assert.equal(r.statusCode,mode==='afterInsert'?412:503,r.body);assert.equal(r.json().proofResultRef,undefined);
  assert.equal(f.state.commits,mode==='afterInsert'?1:2);assert.equal(f.state.releases.at(-1),mode==='commitUnknown');
  if(mode==='afterInsert'){assert.equal(f.rows().length,1);assert.equal(f.receipts().length,0);}
 }finally{await f.app.close();}}
});

test('same signed nonce cannot switch target/proof/old HUMAN request; result issuance remains503',async()=>{
 const f=fixture();try{
  const first=await f.issue();assert.equal(first.statusCode,200,first.body);const frame=f.packet(first.json());
  const malformed={...frame,proof:{...frame.proof,credentialGeneration:2}};
  assert.equal((await f.get(malformed)).statusCode,412);assert.equal(f.rows().length,1);assert.equal(f.receipts().length,0);
  const post=await f.issue({...f.request,requestId:randomUUID(),clientNonce:randomBytes(32).toString('base64url'),target:{method:'POST',path:f.target.path+'/'+randomUUID()+'/result',queryHash:hash({}),bodyHash:hash({})}});
  assert.equal(post.statusCode,503);assert.equal(f.rows().length,1);
  f.state.denied=true;assert.equal((await f.get(frame)).statusCode,412);assert.equal(f.rows().length,1);f.state.denied=false;
  const ok=await f.get(frame);assert.equal(ok.statusCode,200,ok.body);
  f.state.now+=30000;const expired=await f.get(frame);assert.equal(expired.statusCode,412);assert.equal(expired.json().proofResultRef,undefined);assert.equal(f.rows().length,2);
 }finally{await f.app.close();}
});
test('stored receipt alteration is rejected, not repaired or replaced on explicit reconfirmation',async()=>{
 const f=fixture();try{
  const issue=await f.issue(),frame=f.packet(issue.json()),first=await f.get(frame);assert.equal(first.statusCode,200,first.body);
  f.receipts()[0].snapshot_json.context.startCommandId=randomUUID();
  const replay=await f.get(frame);assert.equal(replay.statusCode,409);assert.equal(replay.json().receipt,undefined);assert.equal(f.rows().length,2);assert.equal(f.receipts().length,1);
 }finally{await f.app.close();}
});

for(const operation of ['issue','acquire'] as const)for(const rollback of ['rollbackUnknown','rollbackThrow'] as const){
 test('rollback uncertainty overrides current denial: '+operation+'/'+rollback,async()=>{
  const f=fixture();try{
   let frame:ReturnType<typeof f.packet>|undefined;
   if(operation==='acquire'){const issued=await f.issue();assert.equal(issued.statusCode,200,issued.body);frame=f.packet(issued.json());}
   const commits=f.state.commits,releaseCount=f.state.releases.length,rollbackCount=f.state.rollbacks;
   f.state.afterInsert=true;f.state[rollback]=true;
   const result=operation==='issue'?await f.issue():await f.get(frame!);
   assert.equal(result.statusCode,503,result.body);assert.equal(result.json().code,'NORMAL_UNDERSTANDING_DISCOVERY_UNKNOWN');
   assert.equal(result.json().challenge,undefined);assert.equal(result.json().proofResultRef,undefined);
   assert.equal(f.state.commits,commits);assert.equal(f.state.rollbacks,rollbackCount+1);
   assert.deepEqual(f.state.releases.slice(releaseCount),[true]);
   assert.equal(f.rows().length,operation==='issue'?0:1);assert.equal(f.receipts().length,0);
  }finally{await f.app.close();}
 });
}
