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
import {executionChallengeRequestBytes,executionProofBytes,normalUnderstandingRangeChallengeBytes,normalUnderstandingRangeProofBytes} from '../../../apps/server/modules/executions/execution-proof.ts';
import {NormalUnderstandingReadAcquisition} from '../../../apps/server/modules/executions/normal-understanding-read-acquisition.ts';
import {publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v));

test('fixed range GET has a separate exact signed target; generic and synthetic proof paths remain closed',async()=>{
 const m:any=await import('../../../apps/server/modules/executions/execution-proof.ts'),cid=randomUUID(),eid=randomUUID();
 assert.equal(typeof m.normalUnderstandingRangeTarget,'function');
 const target=m.normalUnderstandingRangeTarget(cid,eid);
 assert.deepEqual(target,{method:'GET',path:`/api/v1/connectors/${cid}/executions/${eid}/understanding-response-read/range`,queryHash:hash({}),bodyHash:hash(null)});
 assert.throws(()=>m.executionTarget('GET',target.path,[],null));assert.throws(()=>m.assertSyntheticExecutionTarget(target));
 const request={requestId:randomUUID(),purpose:'EXECUTION_REQUEST',grantRef:{id:randomUUID(),version:1,contentHash:hash('grant')},credentialGeneration:1,target,clientNonce:randomBytes(32).toString('base64url'),issuedAt:new Date().toISOString()};
 assert.throws(()=>m.executionChallengeRequestBytes('EXECUTION',request));assert.ok(m.normalUnderstandingRangeChallengeBytes(request).length);
 for(const patch of [{path:target.path+'/'},{path:target.path+'?x=1'},{path:target.path.replace('/range','/%72ange')},{method:'POST'},{queryHash:hash({x:1})},{bodyHash:hash({})}])assert.throws(()=>m.normalUnderstandingRangeChallengeBytes({...request,target:{...target,...patch}}));
});
function fixture(enabled=true,rangeMode=false,rangeHttp=false,rangeBytes=[12]){
 const ref=()=>({id:randomUUID(),version:1,contentHash:hash(randomUUID())});
 const pid=randomUUID(),cid=randomUUID(),eid=randomUUID(),g=ref(),cred=ref(),start=Date.parse('2026-11-22T01:00:00Z'),origin='https://synthetic.invalid';
 const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=pair.publicKey.export({format:'der',type:'spki'}).toString('base64url');
 const binding={transport:'NORMAL_PROTECTED',mode:'EXECUTION',projectId:pid,connectorId:cid,executionId:eid,executionGeneration:1,grantRef:g,scopeDigest:hash('scope'),credentialGeneration:1,publicKeyFingerprint:publicKeyFingerprint(spki)};
 const at=new Date(start).toISOString(),expiresAt=new Date(start+30000).toISOString(),context={projectId:pid,connectorId:cid,executionId:eid,executionGeneration:1,grantRef:g,credentialGeneration:1,registrationRef:ref(),startCommandId:randomUUID(),startCommandRef:ref(),assignmentRef:ref(),preparationRef:ref(),contextBundleRef:ref(),sessionBindingRef:ref()};
 const q={schemaVersion:1,projectId:pid,commandId:randomUUID(),clientId:randomUUID(),controlGeneration:1,operation:'readNormalUnderstandingResponse',targetId:eid,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{assignmentRef:context.assignmentRef,preparationRef:context.preparationRef}};
 const snapshot={schemaVersion:1,purpose:'NORMAL_UNDERSTANDING_METADATA_DISCOVERY',request:q,context,requestedBy:{kind:'HUMAN',userId:randomUUID(),clientId:q.clientId,sessionId:randomUUID(),credentialGeneration:1,controlGeneration:1},policyRef:ref(),state:'PENDING_SOURCE',sourceScope:null,createdAt:at,expiresAt};
 let human={id:randomUUID(),version:1,contentHash:hash(snapshot)},rows:any[]=[],receipts:any[]=[],lock=Promise.resolve();
 const selection={requestRef:human,resultRef:ref(),initConfirmationRef:ref(),tailRef:ref(),firstSequence:2,lastSequence:rangeBytes.length+1,ranges:rangeBytes.map((textBytes,i)=>({outputRef:ref(),sequence:2+i,payloadDigest:hash('payload'+i),textBlocks:1,textBytes}))};
 selection.ranges.at(-1)!.outputRef=selection.tailRef;
 const {context:_context,...base}=snapshot,rangeSnapshot={...base,purpose:'NORMAL_UNDERSTANDING_FIXED_RANGE_REQUEST',request:{...q,payload:{...q.payload,selection}},sourceScope:selection};
 if(rangeMode)human={...human,id:randomUUID(),contentHash:hash(rangeSnapshot)};
 let charged=0n;
 const state={now:start,rangeDeadline:start+30000,none:false,denied:false,current:true,corrupt:false,commitUnknown:false,rollbackUnknown:false,rollbackThrow:false,afterInsert:false,rangeCount:1,unverified:false,overCap:false,failCharge:false,releases:[] as boolean[],commits:0,rollbacks:0,queries:[] as string[]};
 const ps={scope:{kind:'PROJECT',projectId:pid},state:'APPLIED',limits:{maxAttempts:3,maxCalls:50,maxConcurrentAssignments:1,maxElapsedMs:7200000,maxOfflineMs:300000,maxSpoolBytes:1073741824},decidedAt:at,expiresAt:new Date(start+240000).toISOString()};
 const policy={projectId:pid,ref:{...ref(),contentHash:hash(ps)},snapshot:ps};
 const reserve=reserveExecutionBudget([],policy as any,{projectId:pid,executionId:eid,executionGeneration:1,commandId:randomUUID(),assignmentRef:g,stageRef:{applicationRef:g,nodeId:'개발'},policyRef:policy.ref,operation:'START_SESSION',demand:{attempts:1,calls:1,spoolBytes:1,cost:null,costStatus:'VERIFIED_NO_CHARGE'}},at);
 const pool={async connect(){let unlock=()=>{},pending:any[]=[],rs:any[]=[],charge=0n;const account=(v:any)=>{if(state.unverified)throw Error('PROJECT_STORAGE_QUOTA_UNVERIFIED');if(state.overCap)throw Error('PROJECT_STORAGE_QUOTA_EXCEEDED');charge+=BigInt(Buffer.byteLength(canonicalJson(v)));if(state.failCharge)throw Error('RAM_PURPOSE_SETTLEMENT_FAILED');};return{release(e?:Error){state.releases.push(!!e);},async query(sql:string,a:any[]=[]):Promise<any>{
  state.queries.push(sql);
  if(sql==='BEGIN'){const previous=lock;lock=new Promise<void>(r=>unlock=r);await previous;pending=structuredClone(rows);rs=structuredClone(receipts);charge=charged;return{command:'BEGIN',rows:[]};}
  if(sql==='COMMIT'){rows=pending;receipts=rs;charged=charge;unlock();state.commits++;if(state.commitUnknown)throw Error('unexposed SQL details');return{command:'COMMIT',rows:[]};}
  if(sql==='ROLLBACK'){state.rollbacks++;unlock();if(state.rollbackThrow)throw Error('raw rollback');return{command:state.rollbackUnknown?'':'ROLLBACK',rows:[]};}
  if(sql.includes('SET LOCAL')||sql.includes('set_config'))return{rows:[]};
  if(sql.includes('normal_request_credential'))return{rows:[{project_id:pid,credential_ref:cred,expires_at:new Date(start+240000)}]};
  if(sql.includes('normal_exchange_current'))return{rows:state.current?[{binding,spki,deadline:new Date(start+240000),observed_at:new Date(state.now),budget_ref:reserve.ref,budget_policy:policy}]:[]};
  if(sql.includes('FROM anvil.usage_reservations'))return{rows:[{project_id:pid,reservation_id:reserve.ref.id,version:1,content_hash:reserve.ref.contentHash,snapshot_json:reserve.snapshot,server_sequence:1,command_id:reserve.snapshot.claim.commandId}]};
  if(sql==='SELECT clock_timestamp() AS at')return{rows:[{at:new Date(state.now)}]};
  if(sql.includes('fn09_normal_understanding_discovery')){
   // SQL contract fixture only: this is not a real permission/lock proof.
   if(state.denied)throw Error(rangeMode?'NORMAL_UNDERSTANDING_RANGE_DENIED':'NORMAL_UNDERSTANDING_DISCOVERY_DENIED');
   if(state.now>=start+30000)throw Error(rangeMode?'NORMAL_UNDERSTANDING_RANGE_EXPIRED':'NORMAL_UNDERSTANDING_DISCOVERY_EXPIRED');
   const expected=JSON.parse(a[3]);
   if(rangeMode){
    assert.equal(expected.purpose,'FIXED_RANGE');
    if(state.none)return{rows:[{discovery:{status:'NONE'}}]};
    if(state.rangeCount!==1||expected.requestRef!==null&&canonicalJson(expected.requestRef)!==canonicalJson(human))throw Error('NORMAL_UNDERSTANDING_RANGE_DENIED');
    if(pending.some(x=>x.version===1&&x.snapshot_json.understandingRangeRequestRef&&x.snapshot_json.request.requestId!==a[2]))throw Error('NORMAL_UNDERSTANDING_RANGE_DENIED');
    return{rows:[{discovery:{status:'RANGE_REQUEST',requestRef:human,snapshot:state.corrupt?{...rangeSnapshot,sourceScope:{unproven:true}}:rangeSnapshot,context,deadline:new Date(state.rangeDeadline).toISOString()}}]};
   }
   if(expected!==null&&canonicalJson(expected)!==canonicalJson(human))throw Error('NORMAL_UNDERSTANDING_DISCOVERY_DENIED');
   if(pending.some(x=>x.version===1&&x.snapshot_json.understandingRequestRef&&x.snapshot_json.request.requestId!==a[2]))throw Error('NORMAL_UNDERSTANDING_DISCOVERY_DENIED');
   return{rows:[{discovery:state.none?{status:'NONE'}:{status:'REQUEST',requestRef:human,snapshot:state.corrupt?{...snapshot,sourceScope:{unproven:true}}:snapshot,deadline:expiresAt}}]};
  }
  if(sql.startsWith('INSERT INTO anvil.execution_challenges')){
   const value=JSON.parse(a.at(-1)),version=value.consumption===null?1:2;pending.push({id:a[1],version,content_hash:hash(value),snapshot_json:value});if(rangeMode&&version===1)account(value);if(state.afterInsert)state.current=false;return{rowCount:1,rows:[]};
  }
  if(sql.startsWith('INSERT INTO anvil.execution_receipts')){const r=JSON.parse(a[6]);rs.push({id:a[1],challenge_id:a[4],content_hash:a[5],snapshot_json:r});if(rangeMode)account({v2:pending.at(-1).snapshot_json,receipt:r});return{rowCount:1,rows:[]};}
  if(sql.includes('count(*) FILTER')){const originals=pending.filter(x=>x.version===1);return{rows:[{total:originals.length,recent:originals.length,sequence:pending.length+1,live:originals.filter(x=>!pending.some(v=>v.version===2&&v.id===x.id)).length}]};}
  if(sql.startsWith('SELECT COALESCE(max'))return{rows:[{sequence:pending.length+1}]};
  if(sql.includes('LEFT JOIN anvil.execution_receipts'))return{rows:pending.filter(v=>v.version===2&&v.id===a[3]).map(v=>{const r=rs.find(r=>r.challenge_id===v.id);return{vhash:v.content_hash,consumed:v.snapshot_json,id:r?.id,content_hash:r?.content_hash,receipt:r?.snapshot_json};})};
  if(sql.includes('FROM anvil.execution_challenges')&&sql.includes('request_id='))return{rows:pending.filter(v=>v.version===1&&(v.snapshot_json.request.requestId===a[3]||v.snapshot_json.request.clientNonce===a[4]))};
  if(sql.includes('FROM anvil.execution_challenges'))return{rows:pending.filter(v=>v.version===1&&v.id===a[3]&&v.content_hash===a[4])};
  throw Error('Unexpected SQL '+sql);
 }}}};
 const access={repository:new AccessRepository(pool as any,{installationId:randomUUID(),key:Buffer.alloc(32,2)}),origin};
 const buildArgs:Parameters<typeof buildApp>=[{},undefined,enabled?access:undefined,undefined,undefined,undefined,undefined,null,undefined,undefined,undefined,{pool} as any,undefined,{origin}];
 if(rangeHttp)(buildArgs as any[])[24]={mode:'NORMAL_PROTECTED',purpose:'FN09_FIXED_RANGE_ACQUISITION'};
 const app=buildApp(...buildArgs);
 // RAM request socket only. No listener, TLS service, DB or private key input.
 app.addHook('onRequest',async r=>{Object.defineProperty(r.raw.socket,'encrypted',{value:true,configurable:true});});
 const path='/api/v1/connectors/'+cid+'/executions/'+eid,target={method:'GET',path:path+'/understanding-response-read'+(rangeMode?'/range':''),queryHash:hash({}),bodyHash:hash(null)};
 const request={requestId:randomUUID(),purpose:'EXECUTION_REQUEST',grantRef:g,credentialGeneration:1,target,clientNonce:randomBytes(32).toString('base64url'),issuedAt:at};
 const signature=(bytes:Buffer)=>sign('sha256',bytes,{key:pair.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 const headers={host:'synthetic.invalid',authorization:'Bearer av3ex1_'+randomBytes(32).toString('base64url')};
 const challengeBytes=(r:any)=>rangeMode?normalUnderstandingRangeChallengeBytes(r):executionChallengeRequestBytes('EXECUTION',r);
 const issue=(r:any=request)=>app.inject({method:'POST',url:path+'/challenges',headers,payload:{...r,signature:signature(challengeBytes(r))}});
 const packet=(issued:any)=>{const proof={requestId:issued.challenge.requestId,...target,grantRef:g,credentialGeneration:1,serverNonce:issued.challenge.serverNonce};return{schemaVersion:1,challengeRef:issued.ref,proof,signature:signature(rangeMode?normalUnderstandingRangeProofBytes(proof):executionProofBytes('EXECUTION_REQUEST_PROOF',proof))};};
 const get=(p:any)=>app.inject({method:'GET',url:target.path,headers:{...headers,'anvil-execution-auth':Buffer.from(canonicalJson(p)).toString('base64url')}});
 const source=new NormalUnderstandingReadAcquisition(pool as any),token=hash('RAM_RANGE_TOKEN'),signal=new AbortController().signal;
 const issueRange=async(r:any=request)=>{const m:any=await import('../../../apps/server/modules/executions/normal-exchange-challenge.ts');return m.issueNormalUnderstandingRangeChallenge(pool,cid,eid,{...r,signature:signature(challengeBytes(r))},token,source,signal);};
 return{app,state,issue,packet,get,request,target,source,selection,context,signal,issueRange,buildArgs,headers,wireRequest:(r:any=request)=>({...r,signature:signature(challengeBytes(r))}),acquireRange:(frame:any)=>(source as any).acquireRange(cid,eid,token,frame,signal),charge:()=>charged,human:()=>human,replaceHuman:()=>{human={...human,id:randomUUID()};},rows:()=>rows,receipts:()=>receipts};
}

test('fixed range current acquisition caps total selected bytes before nonce or transport charge, exact 2MiB replays without delta',async()=>{
 for(const extra of [0,1]){
  const f=fixture(true,true,false,[1048576,1048576+extra]);
  try{
   if(extra){await assert.rejects(f.issueRange());assert.equal(f.rows().length,0);assert.equal(f.receipts().length,0);assert.equal(f.charge(),0n);assert.equal(f.state.queries.some(s=>s.startsWith('INSERT INTO')),false);}
   else{const issued=await f.issueRange(),packet=f.packet(issued),saved=await f.acquireRange(packet),charge=f.charge();assert.equal(saved.status,'RANGE_ACQUIRED');assert.ok(charge>0n);assert.deepEqual(await f.acquireRange(packet),saved);assert.equal(f.rows().length,2);assert.equal(f.receipts().length,1);assert.equal(f.charge(),charge);}
  }finally{await f.app.close();}
 }
});

test('fixed range HTTP is an explicit internal opt-in and performs one atomic acquisition with exact packet replay',async()=>{
 const f=fixture(true,true,true);try{
  const issue=await f.issue();assert.equal(issue.statusCode,200,issue.body);const frame=f.packet(issue.json()),charge=f.charge();assert.ok(charge>0n);
  const [a,b]=await Promise.all([f.get(frame),f.get(frame)]);assert.equal(a.statusCode,200,a.body);assert.equal(b.statusCode,200,b.body);assert.deepEqual(a.json(),b.json());
  assert.equal(a.headers['cache-control'],'no-store');assert.equal(a.json().status,'RANGE_ACQUIRED');assert.deepEqual(a.json().receipt.selection,f.selection);
  assert.equal(f.rows().length,2);assert.equal(f.receipts().length,1);assert.ok(f.charge()>charge);const settled=f.charge();
  f.state.now+=1000;const again=await f.get(frame);assert.equal(again.statusCode,200,again.body);assert.deepEqual(again.json(),a.json());assert.equal(f.charge(),settled);
  assert.equal(a.json().sourceAvailable,false);assert.equal(a.json().selectionAvailable,false);assert.doesNotMatch(a.body,/requestedBy|responsePartRefs|sdkRaw|humanSessionId/);
  f.state.denied=true;const denied=await f.get(frame);assert.equal(denied.statusCode,412,denied.body);assert.equal(denied.json().proofResultRef,undefined);assert.equal(f.charge(),settled);
 }finally{await f.app.close();}
});

test('fixed range HTTP opt-in requires exact own internal descriptors and the original non-synthetic pool and origin',async()=>{
 const m=await import('../../../apps/server/modules/executions/normal-understanding-read-acquisition.ts'),f=fixture(true,true);let getters=0;
 const valid={mode:'NORMAL_PROTECTED',purpose:'FN09_FIXED_RANGE_ACQUISITION'} as const;
 try{
  const output=m.readNormalUnderstandingRangeOptions(valid);assert.deepEqual(output,valid);assert.ok(Object.isFrozen(output));assert.notEqual(output,valid);
  for(const invalid of [null,false,[],{...valid,extra:true},{...valid,purpose:'FN09_DISCOVERY_METADATA'},Object.create(valid),new Proxy({...valid},{}),
   Object.defineProperty({...valid},'extra',{value:true}),{...valid,[Symbol('extra')]:true},Object.defineProperty({...valid},'mode',{get(){getters++;return 'NORMAL_PROTECTED';}})]){
   assert.throws(()=>m.readNormalUnderstandingRangeOptions(invalid as any),/NORMAL_UNDERSTANDING_RANGE_CONFIGURATION_INVALID/);
  }
  for(const modify of [(a:any[])=>{a[2]=undefined;},(a:any[])=>{a[3]={};},(a:any[])=>{a[11]={pool:{connect:async()=>{throw Error('must not connect');}}};},
   (a:any[])=>{a[13]={origin:'https://other.invalid'};},(a:any[])=>{a[11]=undefined;},(a:any[])=>{a[13]=undefined;}]){
   const args:Parameters<typeof buildApp>=[...f.buildArgs];(args as any[])[24]=valid;modify(args);assert.throws(()=>buildApp(...args),/NORMAL_UNDERSTANDING_RANGE_CONFIGURATION_INVALID/);
  }
  assert.equal(getters,0);assert.equal(f.state.queries.length,0);
  const args:Parameters<typeof buildApp>=[...f.buildArgs];(args as any[])[23]={mode:'NORMAL_PROTECTED',purpose:'FN09_DISCOVERY_METADATA'};
  const resultOnly=buildApp(...args);resultOnly.addHook('onRequest',async r=>{Object.defineProperty(r.raw.socket,'encrypted',{value:true,configurable:true});});
  try{const response=await resultOnly.inject({method:'POST',url:f.target.path.slice(0,-'/understanding-response-read/range'.length)+'/challenges',headers:f.headers,payload:f.wireRequest()});assert.equal(response.statusCode,503,response.body);assert.equal(f.state.queries.length,0);}finally{await resultOnly.close();}
 }finally{await f.app.close();}
});

test('fixed range HTTP rejects nonliteral paths, bodies, mixed identity and invalid or repeated proof headers before SQL',async()=>{
 const f=fixture(true,true,true);try{
  const issued=await f.issue();assert.equal(issued.statusCode,200,issued.body);const frame=f.packet(issued.json()),auth=Buffer.from(canonicalJson(frame)).toString('base64url'),headers={...f.headers,'anvil-execution-auth':auth};
  for(const patch of [{url:f.target.path+'?x=1'},{url:f.target.path.replace('/range','/%72ange')},{url:f.target.path+'/'},{url:f.target.path+'/extra'},
   {method:'HEAD'},{method:'POST'},{headers:{...headers,cookie:'__Host-anvil.sid='+'x'.repeat(43)}},{headers:{...headers,origin:'https://synthetic.invalid'}},
   {headers:{...headers,'x-anvil-csrf':'c'.repeat(43)}},{headers:{...headers,'content-length':'0'}},{headers:{...headers,'content-type':'application/json'}},
   {headers:{...headers,'content-encoding':'gzip'}},{headers:{...headers,host:'other.invalid'}},{headers:{...headers,authorization:['Bearer av3ex1_'+'x'.repeat(43),f.headers.authorization]}},
   {headers:{...headers,'anvil-execution-auth':[auth,auth]}},{headers:{...headers,'anvil-execution-auth':auth+'='}},
   {headers:{...headers,'anvil-execution-auth':Buffer.from(' '+canonicalJson(frame)).toString('base64url')}},
   {headers:{...headers,'anvil-execution-auth':Buffer.from(canonicalJson({...frame,signature:'bad'})).toString('base64url')}},
   {headers:{host:f.headers.host,'anvil-execution-auth':auth}},{headers:{...headers,authorization:'Bearer av3sr1_'+'x'.repeat(43)}}]){
   const count=f.state.queries.length,response=await f.app.inject({method:'GET',url:f.target.path,headers,...patch} as any);assert.ok(response.statusCode>=400,response.body);assert.equal(f.state.queries.length,count,'rejected channel performed SQL');
  }
  const count=f.state.queries.length,badBody=await f.app.inject({method:'GET',url:f.target.path,headers:{...headers,'content-type':'application/json'},payload:{raw:'forbidden'}});
  assert.ok(badBody.statusCode>=400);assert.equal(f.state.queries.length,count);assert.equal(f.rows().length,1);assert.equal(f.receipts().length,0);
  const actual=await f.get(frame);assert.equal(actual.statusCode,200,actual.body);assert.equal(f.receipts().length,1);
 }finally{await f.app.close();}
});

test('fixed range challenge reports its own expiry code when the returned HUMAN deadline is already behind the current sample',async()=>{
 for(const http of [false,true]){
  const f=fixture(true,true,http);try{
   f.state.now+=1000;f.state.rangeDeadline=f.state.now-1;
   // RPC 예외가 아니라 형식이 유효한 짧은 deadline 반환 뒤 challenge의 직접 비교 분기를 검증한다.
   if(http){const response=await f.issue();assert.equal(response.statusCode,412,response.body);assert.equal(response.json().code,'NORMAL_UNDERSTANDING_RANGE_EXPIRED');}
   else await assert.rejects(f.issueRange(),{message:'NORMAL_UNDERSTANDING_RANGE_EXPIRED',statusCode:412});
   assert.ok(f.state.queries.some(q=>q.includes('fn09_normal_understanding_discovery')));assert.equal(f.rows().length,0);assert.equal(f.receipts().length,0);assert.equal(f.charge(),0n);
  }finally{await f.app.close();}
 }
});

test('fixed range purpose derives one HUMAN request, settles v1 and acquisition separately, and exact concurrent replay adds zero bytes',async()=>{
 const f=fixture(true,true);try{
  assert.equal((await f.issue()).statusCode,503);assert.equal(f.state.queries.length,0);
  const issued=await f.issueRange(),v1charge=f.charge();assert.ok(v1charge>0n);assert.deepEqual(f.rows()[0].snapshot_json.understandingRangeRequestRef,f.human());assert.equal(f.rows()[0].snapshot_json.understandingRequestRef,undefined);
  const frame=f.packet(issued),[a,b]=await Promise.all([f.acquireRange(frame),f.acquireRange(frame)]);assert.deepEqual(a,b);
  assert.equal(a.status,'RANGE_ACQUIRED');assert.deepEqual(a.receipt.rangeRequestRef,f.human());assert.deepEqual(a.receipt.selection,f.selection);assert.deepEqual(a.receipt.context,f.context);
  assert.equal(a.sourceAvailable,false);assert.equal(a.selectionAvailable,false);assert.equal(f.rows().length,2);assert.equal(f.receipts().length,1);assert.ok(f.charge()>v1charge);
  const charged=f.charge();f.state.now+=1000;assert.deepEqual(await f.acquireRange(frame),a);assert.equal(f.charge(),charged);
  await assert.rejects(f.issueRange({...f.request,requestId:randomUUID(),clientNonce:randomBytes(32).toString('base64url')}));assert.equal(f.rows().length,2);assert.equal(f.charge(),charged);
  assert.doesNotMatch(JSON.stringify(a),/requestedBy|humanSessionId|sourceScope|payloadRaw|sdkRaw|responsePartRefs/);
 }finally{await f.app.close();}
});

test('fixed range purpose refuses absent ambiguity, bad parent, lost current and failed issue accounting before publishing a nonce',async()=>{
 for(const mode of ['none','ambiguous','denied','expired','corrupt','afterInsert','unverified','overCap','failCharge'] as const){
  const f=fixture(true,true);try{
   if(mode==='none')f.state.none=true;else if(mode==='ambiguous')f.state.rangeCount=2;else if(mode==='expired')f.state.now+=30000;else f.state[mode]=true;
   if(mode==='none'){const result=await f.issueRange();assert.equal(result.status,'NONE');assert.equal(result.challenge,null);}
   else await assert.rejects(f.issueRange());
   assert.equal(f.rows().length,0,mode);assert.equal(f.receipts().length,0,mode);assert.equal(f.charge(),0n,mode);
  }finally{await f.app.close();}
 }
});

test('fixed range acquisition refuses altered proof, metadata, current and partial accounting without changing the original v1 charge',async()=>{
 for(const mode of ['proof','raw','human','denied','expired','corrupt','afterInsert','unverified','overCap','failCharge'] as const){
  const f=fixture(true,true);try{
   const issued=await f.issueRange(),frame=f.packet(issued),charge=f.charge();
   if(mode==='proof')frame.proof.credentialGeneration++;
   else if(mode==='raw')(frame as any).raw='forbidden';
   else if(mode==='human')f.replaceHuman();else if(mode==='expired')f.state.now+=30000;else f.state[mode]=true;
   await assert.rejects(f.acquireRange(frame));assert.equal(f.rows().length,1,mode);assert.equal(f.receipts().length,0,mode);assert.equal(f.charge(),charge,mode);
  }finally{await f.app.close();}
 }
 const f=fixture(true,true);try{
  const issued=await f.issueRange(),frame=f.packet(issued);await f.acquireRange(frame);const charged=f.charge();
  f.receipts()[0].snapshot_json.selection.ranges[0].payloadDigest=hash('other');
  await assert.rejects(f.acquireRange(frame));assert.equal(f.receipts().length,1);assert.equal(f.charge(),charged);
 }finally{await f.app.close();}
});

test('fixed range unknown COMMIT retains the exact original event and explicit same-packet replay adds no records or charge',async()=>{
 for(const phase of ['issue','acquire']){
  const f=fixture(true,true);try{
   if(phase==='issue'){
    f.state.commitUnknown=true;await assert.rejects(f.issueRange(),{statusCode:503});assert.equal(f.rows().length,1);const charged=f.charge();assert.ok(charged>0n);
    f.state.commitUnknown=false;const original=await f.issueRange();assert.deepEqual(original.ref,{id:f.rows()[0].id,version:1,contentHash:f.rows()[0].content_hash});assert.equal(f.charge(),charged);assert.equal(f.rows().length,1);
   }else{
    const issued=await f.issueRange(),frame=f.packet(issued);f.state.commitUnknown=true;await assert.rejects(f.acquireRange(frame),{statusCode:503});
    assert.equal(f.rows().length,2);assert.equal(f.receipts().length,1);const charged=f.charge();f.state.commitUnknown=false;
    const original=await f.acquireRange(frame);assert.equal(original.proofResultRef.id,f.receipts()[0].id);assert.equal(f.charge(),charged);assert.equal(f.rows().length,2);assert.equal(f.receipts().length,1);
   }
   assert.ok(f.state.releases.includes(true));
  }finally{await f.app.close();}
 }
});

test('fixed range unknown rollback overrides NONE or a known refusal and discards the original client once',async()=>{
 for(const mode of ['none','denied','acquire'])for(const throws of [true,false]){
  const f=fixture(true,true);try{
   const issued=mode==='acquire'?await f.issueRange():undefined;f.state[throws?'rollbackThrow':'rollbackUnknown']=true;
   if(mode==='none')f.state.none=true;else f.state.denied=true;
   await assert.rejects(mode==='acquire'?f.acquireRange(f.packet(issued)):f.issueRange(),{statusCode:503});
   assert.equal(f.state.releases.at(-1),true);assert.equal(f.state.rollbacks,1);assert.equal(f.receipts().length,0);
  }finally{await f.app.close();}
 }
});

test('fixed range holds the original monotonic deadline across known COMMIT without inventing a rollback',async t=>{
 for(const phase of ['issue','acquire']){
  const f=fixture(true,true);try{
   const issued=phase==='acquire'?await f.issueRange():undefined,commits=f.state.commits,rollbacks=f.state.rollbacks;
   t.mock.method(performance,'now',()=>f.state.commits>commits?40000:0);
   await assert.rejects(phase==='issue'?f.issueRange():f.acquireRange(f.packet(issued)),{statusCode:503});
   assert.equal(f.state.commits,commits+1);assert.equal(f.state.rollbacks,rollbacks);assert.equal(f.state.releases.at(-1),false);assert.ok(f.charge()>0n);
  }finally{t.mock.restoreAll();await f.app.close();}
 }
});
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
