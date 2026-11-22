import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,generateKeyPairSync,sign,createHash} from 'node:crypto';
import {buildApp} from '../../../apps/server/app.ts';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {reserveExecutionBudget} from '../../../apps/server/modules/executions/execution-budget.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {executionChallengeRequestBytes,executionProofBytes} from '../../../apps/server/modules/executions/execution-proof.ts';
import {publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';
import {readNormalUnderstandingDiscovery} from '../../../apps/connector/runtime/normal-understanding-response-source.ts';
import {readPreparedUnderstandingResult,frameUnderstandingResult} from '../../../apps/connector/runtime/normal-credential-bootstrap-client.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v)),copy=<T>(v:T):T=>JSON.parse(canonicalJson(v));
const enabled={mode:'NORMAL_PROTECTED',purpose:'FN09_DISCOVERY_METADATA'};

/** 실제 HTTP handler/서명 검산을 사용하는 RAM ledger다. native 파일·SQL/ACL/정산 실행 증거가 아니다. */
function fixture(option:unknown=enabled,configure:{synthetic?:boolean;wrongPool?:boolean;wrongOrigin?:boolean}={}){
 const ref=()=>({id:randomUUID(),version:1,contentHash:hash(randomUUID())});
 const pid=randomUUID(),cid=randomUUID(),eid=randomUUID(),grant=ref(),credential=ref(),start=Date.parse('2026-11-22T01:00:00Z'),origin='https://synthetic.invalid';
 const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=pair.publicKey.export({format:'der',type:'spki'}).toString('base64url');
 const iso=(n:number)=>new Date(start+n).toISOString(),path='/api/v1/connectors/'+cid+'/executions/'+eid,base=path+'/understanding-response-read';
 const rawToken='av3ex1_'+randomBytes(32).toString('base64url'),token=createHash('sha256').update(rawToken).digest('hex');
 const binding={transport:'NORMAL_PROTECTED',mode:'EXECUTION',projectId:pid,connectorId:cid,executionId:eid,executionGeneration:1,grantRef:grant,scopeDigest:hash('scope'),credentialGeneration:1,publicKeyFingerprint:publicKeyFingerprint(spki)};
 const context={projectId:pid,connectorId:cid,executionId:eid,executionGeneration:1,grantRef:grant,credentialGeneration:1,registrationRef:ref(),startCommandId:randomUUID(),startCommandRef:ref(),assignmentRef:ref(),preparationRef:ref(),contextBundleRef:ref(),sessionBindingRef:ref()};
 const command={schemaVersion:1,projectId:pid,commandId:randomUUID(),clientId:randomUUID(),controlGeneration:1,operation:'readNormalUnderstandingResponse',targetId:eid,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{assignmentRef:context.assignmentRef,preparationRef:context.preparationRef}};
 const snapshot={schemaVersion:1,purpose:'NORMAL_UNDERSTANDING_METADATA_DISCOVERY',request:command,context,requestedBy:{kind:'HUMAN',userId:randomUUID(),clientId:command.clientId,sessionId:randomUUID(),credentialGeneration:1,controlGeneration:1},policyRef:ref(),state:'PENDING_SOURCE',sourceScope:null,createdAt:iso(0),expiresAt:iso(30000)};
 const human={...ref(),contentHash:hash(snapshot)};
 const ps={scope:{kind:'PROJECT',projectId:pid},state:'APPLIED',limits:{maxAttempts:3,maxCalls:50,maxConcurrentAssignments:1,maxElapsedMs:7200000,maxOfflineMs:300000,maxSpoolBytes:1073741824},decidedAt:iso(0),expiresAt:iso(240000)};
 const policy={projectId:pid,ref:{...ref(),contentHash:hash(ps)},snapshot:ps};
 const budget=reserveExecutionBudget([],policy as any,{projectId:pid,executionId:eid,executionGeneration:1,commandId:randomUUID(),assignmentRef:grant,stageRef:{applicationRef:grant,nodeId:'개발'},policyRef:policy.ref,operation:'START_SESSION',demand:{attempts:1,calls:1,spoolBytes:1,cost:null,costStatus:'VERIFIED_NO_CHARGE'}},iso(0));
 const state={now:start,connects:0,queries:[] as string[],denied:false,commitUnknown:false,rollbackUnknown:false,afterInsert:false,afterStore:false,used:0n,stores:0,releases:[] as boolean[],onCommit:()=>{},credentialRef:credential,bodyBasisChanged:false,connectFailure:false,uninstalled:false,abortBefore:false,cancelOnCommit:false,abort:()=>{}};
 let rows:any[]=[],receipts:any[]=[],lock=Promise.resolve();
 const pool={async connect(){state.connects++;if(state.connectFailure)throw Error('RAW_CONNECT_SECRET');let unlock=()=>{},pending:any[]=[],rs:any[]=[],used=0n;return{release(e?:Error){state.releases.push(!!e);},async query(sql:string,a:any[]=[]):Promise<any>{
  state.queries.push(sql);const result=(rows:any[]=[],command?:string)=>({rows,command});
  if(sql==='BEGIN'){const previous=lock;lock=new Promise<void>(r=>unlock=r);await previous;pending=copy(rows);rs=copy(receipts);used=state.used;return result([],'BEGIN');}
  if(sql==='COMMIT'){rows=pending;receipts=rs;state.used=used;unlock();state.onCommit();if(state.cancelOnCommit)state.abort();return result([],state.commitUnknown?'':'COMMIT');}
  if(sql==='ROLLBACK'){unlock();return result([],state.rollbackUnknown?'':'ROLLBACK');}
  if(sql.includes('SET LOCAL')||sql.includes('set_config'))return result();
  if(sql.includes('normal_request_credential'))return result(a[0]===token?[{project_id:pid,credential_ref:state.credentialRef,expires_at:new Date(start+240000)}]:[]);
  if(sql.includes('normal_exchange_current'))return result(state.denied?[]:[{binding,spki,deadline:new Date(start+240000),observed_at:new Date(state.now),budget_ref:budget.ref,budget_policy:policy}]);
  if(sql.includes('FROM anvil.usage_reservations'))return result([{project_id:pid,reservation_id:budget.ref.id,version:1,content_hash:budget.ref.contentHash,snapshot_json:budget.snapshot,server_sequence:1,command_id:budget.snapshot.claim.commandId}]);
  if(sql==='SELECT clock_timestamp() AS at')return result([{at:new Date(state.now)}]);
  if(sql.includes('fn09_normal_understanding_discovery'))return result([{discovery:{status:'REQUEST',requestRef:human,snapshot,deadline:iso(30000)}}]);
  if(sql.startsWith('SELECT g.snapshot_json')){
   const g=pending.find(x=>x.version===1&&x.snapshot_json.understandingRequestRef?.id===a[3]);const r=g&&rs.find(x=>x.challenge_id===g.id);
   return result(r?[{request_ref:g.snapshot_json.understandingRequestRef,acquisition_ref:{id:r.id,version:1,contentHash:r.content_hash},transaction_id:'17'}]:[]);
  }
  if(sql.includes('fn09_normal_understanding_result_basis')){
   if(state.uninstalled)throw Error('RAW_MIGRATION_DETAILS');
   const r=rs.find(x=>x.id===JSON.parse(a[3]).id),g=r&&pending.find(x=>x.id===r.challenge_id&&x.version===1),u=r&&pending.find(x=>x.id===r.challenge_id&&x.version===2);
   if(state.denied||state.bodyBasisChanged||!r||!g||!u||JSON.parse(a[2]).id!==human.id)throw Error('NORMAL_UNDERSTANDING_RESULT_DENIED');
   return result([{basis:{requestRef:human,snapshot,acquisitionRef:{id:r.id,version:1,contentHash:r.content_hash},receipt:r.snapshot_json,getChallenge:{id:g.id,content_hash:g.content_hash,snapshot_json:g.snapshot_json},getConsumed:{ref:{id:u.id,version:2,contentHash:u.content_hash},snapshot:u.snapshot_json},deadline:iso(30000)}}]);
  }
  if(sql.includes('pg_current_xact_id_if_assigned()'))return result([{at:new Date(state.now),transaction_id:'17'}]);
  if(sql.includes('fn09_normal_understanding_result_store')){
   state.stores++;assert.equal(a[0],token);const v=JSON.parse(a[3]),rref=JSON.parse(a[4]),r=JSON.parse(a[5]);
   assert.deepEqual(JSON.parse(a[1]),binding);assert.equal(hash(r),rref.contentHash);assert.deepEqual(v.consumption.resultRef,rref);
   // 목적 SQL accounting RPC 대역. 실제 canonical bytes/락/권한은 별도 PG 검증 대상이다.
   const bytes=BigInt(Buffer.byteLength(canonicalJson({v,r})));used+=bytes;
   pending.push({id:JSON.parse(a[2]).id,version:2,content_hash:hash(v),snapshot_json:v});rs.push({id:rref.id,challenge_id:JSON.parse(a[2]).id,content_hash:rref.contentHash,snapshot_json:r});
   if(state.afterStore)state.denied=true;return result([{stored:{status:'SETTLED',ref:rref,bytes:bytes.toString(),planHash:hash({bytes:bytes.toString()})}}]);
  }
  if(sql.startsWith('INSERT INTO anvil.execution_challenges')){const value=JSON.parse(a.at(-1));pending.push({id:a[1],version:value.consumption===null?1:2,content_hash:hash(value),snapshot_json:value});if(state.afterInsert)state.denied=true;return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.execution_receipts')){rs.push({id:a[1],challenge_id:a[4],content_hash:a[5],snapshot_json:JSON.parse(a[6])});return{rows:[],rowCount:1};}
  if(sql.includes('count(*) FILTER')){const originals=pending.filter(x=>x.version===1);return result([{total:originals.length,recent:originals.length,sequence:pending.length+1,live:originals.filter(x=>!pending.some(v=>v.version===2&&v.id===x.id)).length}]);}
  if(sql.startsWith('SELECT COALESCE(max'))return result([{sequence:pending.length+1}]);
  if(sql.includes('LEFT JOIN anvil.execution_receipts'))return result(pending.filter(v=>v.version===2&&v.id===a[3]).map(v=>{const r=rs.find(r=>r.challenge_id===v.id);return{valid:true,vhash:v.content_hash,consumed:v.snapshot_json,id:r?.id,content_hash:r?.content_hash,receipt:r?.snapshot_json};}));
  const project=(v:any)=>({id:v.id,content_hash:v.content_hash,snapshot_json:v.snapshot_json});
  if(sql.includes("snapshot_json ? 'understandingResultBinding'"))return result(pending.filter(v=>v.version===1&&v.snapshot_json.understandingResultBinding?.requestRef.id===a[3]).map(project));
  if(sql.includes('FROM anvil.execution_challenges')&&sql.includes('request_id='))return result(pending.filter(v=>v.version===1&&(v.snapshot_json.request.requestId===a[3]||v.snapshot_json.request.clientNonce===a[4])).map(project));
  if(sql.includes('FROM anvil.execution_challenges'))return result(pending.filter(v=>v.version===1&&v.id===a[3]&&v.content_hash===a[4]).map(project));
  throw Error('UNEXPECTED_RAM_QUERY');
 }}}};
 const access={repository:new AccessRepository(pool as any,{installationId:randomUUID(),key:Buffer.alloc(32,2)}),origin};
 const create=()=> (buildApp as any)({},undefined,access,configure.synthetic?{}:undefined,undefined,undefined,undefined,null,undefined,undefined,undefined,{pool:configure.wrongPool?{connect:pool.connect}:pool},undefined,{origin:configure.wrongOrigin?'https://other.invalid':origin},undefined,undefined,undefined,undefined,null,undefined,undefined,undefined,undefined,option===null?undefined:option);
 const app=create();app.addHook('onRequest',async(r:any)=>{Object.defineProperty(r.raw.socket,'encrypted',{value:true,configurable:true});const controller=new AbortController();Object.defineProperty(r,'signal',{value:controller.signal});state.abort=()=>controller.abort();if(state.abortBefore)controller.abort();});
 const headers={host:'synthetic.invalid',authorization:'Bearer '+rawToken};
 const signature=(bytes:Buffer)=>sign('sha256',bytes,{key:pair.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 const request=(method:string,url:string,value:unknown=null)=>({requestId:randomUUID(),purpose:'EXECUTION_REQUEST',grantRef:grant,credentialGeneration:1,target:{method,path:url,queryHash:hash({}),bodyHash:hash(value)},clientNonce:randomBytes(32).toString('base64url'),issuedAt:new Date(state.now).toISOString()});
 const issue=(r:any)=>app.inject({method:'POST',url:path+'/challenges',headers,payload:{...r,signature:signature(executionChallengeRequestBytes('EXECUTION',r))}});
 const packet=(r:any,issued:any)=>{const proof={requestId:r.requestId,...r.target,grantRef:grant,credentialGeneration:1,serverNonce:issued.challenge.serverNonce};return{schemaVersion:1,challengeRef:issued.ref,proof,signature:signature(executionProofBytes('EXECUTION_REQUEST_PROOF',proof))};};
 const send=(method:string,url:string,frame:any,value?:unknown,extra:Record<string,any>={})=>app.inject({method,url,headers:{...headers,'anvil-execution-auth':Buffer.from(canonicalJson(frame)).toString('base64url'),...(value!==undefined?{'content-type':'application/json'}:{}),...extra},...(value!==undefined?{payload:typeof value==='string'?value:canonicalJson(value)}:{})});
 async function acquire(){const r=request('GET',base),issued=await issue(r);assert.equal(issued.statusCode,200,issued.body);const frame=packet(r,issued.json());const got=await send('GET',base,frame);assert.equal(got.statusCode,200,got.body);return got.json();}
 const body=(acq:any)=>({schemaVersion:1,kind:'DISCOVERY_METADATA',metadata:{attribution:'SESSION_ONLY',projectId:pid,executionId:eid,executionGeneration:1,requestRef:human,acquisitionRef:acq.proofResultRef,contextBundleRef:context.contextBundleRef,initConfirmationRef:ref(),tailRef:ref(),ranges:[{outputRef:ref(),sequence:2,payloadDigest:hash('payload'),textBlocks:1,textBytes:8}],wholeConversationComplete:false,executionAuthorized:false}});
 async function ready(){const acq=await acquire(),value=body(acq),r=request('POST',base+'/'+human.id+'/result',value),issued=await issue(r);assert.equal(issued.statusCode,200,issued.body);return{value,r,issued:issued.json(),frame:packet(r,issued.json())};}
 return{app,state,path,base,human,context,binding,request,issue,packet,send,acquire,body,ready,headers,rows:()=>rows,receipts:()=>receipts};
}

test('TS discovery reader canonical bytes and purpose frame cross actual signed HTTP custody; native provenance remains synthetic',async()=>{
 for(const mode of ['stored','default503','expired'] as const){const f=fixture(mode==='default503'?null:enabled);let bytes:Buffer|undefined;
  try{
   const acq=await f.acquire(),ref=()=>({id:randomUUID(),version:1,contentHash:hash('RAM reference')}),sid='ram-session-not-a-credential';
   const scope={projectId:f.binding.projectId,executionId:f.binding.executionId,generation:1,registrationRef:f.context.registrationRef,
    profileRef:ref(),assignmentRef:ref(),slotRef:acq.receipt.credentialRef,grantRef:f.binding.grantRef,startReadyRef:ref(),dispatchAttemptRef:ref(),sessionBindingRef:f.context.sessionBindingRef,plannedSidDigest:hash(sid)};
   const rows:{ref:ReturnType<typeof ref>;snapshot:any}[]=[];
   const add=(snapshot:any)=>{const r={ref:{...ref(),contentHash:hash(snapshot)},snapshot};rows.push(r);return r.ref;};
   const message=(value:any,init:ReturnType<typeof ref>|null)=>add({schemaVersion:1,state:init?'SESSION_OUTPUT':'OUTPUT_PENDING_SESSION',scope,sequence:rows.length+1,previousRef:rows.at(-1)?.ref??null,
    initConfirmationRef:init,observedAt:new Date(f.state.now).toISOString(),family:value.type==='system'?'SYSTEM_INIT':'ASSISTANT',identity:hash(value.uuid),payloadDigest:hash(value),classification:'ORDINARY',body:Buffer.from(canonicalJson(value)).toString('base64')});
   const first=message({type:'system',subtype:'init',uuid:'ram-init',session_id:sid,apiKeySource:'none',claude_code_version:'2.1.224',cwd:'ram-private-path',tools:[],mcp_servers:[],model:'ram-model',permissionMode:'default',slash_commands:[],output_style:'fixture',skills:[],plugins:[]},null);
   const init=add({schemaVersion:1,state:'SESSION_INIT_CONFIRMED',scope,sequence:2,previousRef:first,initOutputRef:first,observedSidDigest:scope.plannedSidDigest,prefixCount:1,tailRef:first,
    prefixDigest:hash({previous:hash([]),ref:first,payloadDigest:rows[0]!.snapshot.payloadDigest}),observedAt:new Date(f.state.now).toISOString()});
   const tail=message({type:'assistant',uuid:'ram-answer',session_id:sid,parent_tool_use_id:null,message:{role:'assistant',content:[{type:'text',text:'RAM 보호 응답 본문'}]}},init);
   const sourceBinding={scope,requestRef:f.human,acquisitionRef:acq.proofResultRef,contextBundleRef:f.context.contextBundleRef,checkedAt:acq.receipt.observedAt,expiresAt:acq.receipt.expiresAt};
   let reads=0,closed=0;
   const metadata=await readNormalUnderstandingDiscovery(sourceBinding,{clock:()=>f.state.now,current:()=>sourceBinding,withRead:async body=>{
    await body({rowCount:rows.length,read:async n=>{reads++;return copy(rows[n-1]);}});closed++;
   }},new AbortController().signal);
   assert.equal(reads,3);assert.equal(closed,1);assert.deepEqual(metadata.initConfirmationRef,init);assert.deepEqual(metadata.tailRef,tail);
   bytes=Buffer.from(canonicalJson({schemaVersion:1,kind:'DISCOVERY_METADATA',metadata}));
   assert.doesNotMatch(bytes.toString(),/ram-private-path|ram-session|RAM 보호 응답 본문|plannedSidDigest/);
   const target=f.base+'/'+f.human.id+'/result',request=f.request('POST',target,JSON.parse(bytes.toString())),before=f.state.connects,issued=await f.issue(request);
   if(mode==='default503'){assert.equal(issued.statusCode,503,issued.body);assert.equal(f.state.connects,before);assert.equal(f.state.stores,0);continue;}
   assert.equal(issued.statusCode,200,issued.body);
   // C# PREPARE/보호 원장은 명시 RAM 대역이다. 서명/nonce는 실제 HTTP challenge의 원값만 사용한다.
   const frame=f.packet(request,issued.json()),binding={requestRef:f.human,acquisitionRef:acq.proofResultRef,bodyHash:contentHash(bytes)};
   const slot={slotId:randomUUID(),receiptRef:acq.receipt.credentialRef,origin:'https://synthetic.invalid',scope:{projectId:f.binding.projectId,connectorId:f.binding.connectorId,executionId:f.binding.executionId,executionGeneration:1,grantRef:f.binding.grantRef,credentialGeneration:1},expiresAt:sourceBinding.expiresAt,caHash:hash('RAM CA metadata')};
   const raw={state:'NATIVE_DISCOVERY_RESULT_PREPARED',...binding,preparedHash:hash('RAM protected prepared row'),auth:Buffer.from(canonicalJson(frame)).toString('base64url'),expiresAt:issued.json().challenge.expiresAt};
   const {bodyHash:_,...preparedWire}=raw;
   const prepared=readPreparedUnderstandingResult(preparedWire,binding,slot,f.state.now,Date.parse(sourceBinding.expiresAt));
   const framed=frameUnderstandingResult(randomUUID(),slot,prepared,binding,bytes);assert.equal(framed.kind,'DIRECT');if(framed.kind!=='DIRECT')throw Error('RAM_EXPECTED_DIRECT');
   assert.ok(Buffer.from(framed.payload.body).equals(bytes));assert.deepEqual(framed.payload.acquisitionRef,acq.proofResultRef);
   const originalPacket=JSON.parse(Buffer.from(framed.payload.auth,'base64url').toString());assert.equal(originalPacket.proof.bodyHash,contentHash(bytes));
   if(mode==='expired')f.state.now=Date.parse(sourceBinding.expiresAt);
   const answer=await f.send(originalPacket.proof.method,originalPacket.proof.path,originalPacket,framed.payload.body);
   if(mode==='expired'){assert.equal(answer.statusCode,412,answer.body);assert.equal(f.state.stores,0);assert.equal(f.receipts().length,1);}
   else{assert.equal(answer.statusCode,200,answer.body);assert.equal(answer.json().status,'DISCOVERY_METADATA_STORED');const used=f.state.used;
    assert.ok(Buffer.from(canonicalJson(f.receipts().at(-1).snapshot_json.body)).equals(bytes));
    const again=await f.send(originalPacket.proof.method,originalPacket.proof.path,originalPacket,framed.payload.body);assert.equal(again.statusCode,200,again.body);
    assert.deepEqual(again.json(),answer.json());assert.equal(f.state.stores,1);assert.equal(f.state.used,used);assert.equal(f.receipts().length,2);}
  }finally{bytes?.fill(0);await f.app.close();}
 }
});

test('result transport stays absent and challenge stays503 with only existing GET options',async()=>{
 const f=fixture(null);try{const acq=await f.acquire(),b=f.body(acq),r=f.request('POST',f.base+'/'+f.human.id+'/result',b),before=f.state.connects;
  const issued=await f.issue(r);assert.equal(issued.statusCode,503,issued.body);assert.equal(f.state.connects,before);
  const posted=await f.send('POST',r.target.path,{},b);assert.ok([403,404].includes(posted.statusCode));assert.equal(f.state.connects,before);
 }finally{await f.app.close();}
});
test('metadata result is an explicit closed server configuration and rejects synthetic or crossed storage/origin',()=>{
 for(const option of [true,{mode:'NORMAL_PROTECTED'},{...enabled,enable:true},{...enabled,purpose:'SELECT_TEXT'}])assert.throws(()=>fixture(option),/NORMAL_UNDERSTANDING_RESULT_CONFIGURATION_INVALID/);
 for(const configure of [{synthetic:true},{wrongPool:true},{wrongOrigin:true}])assert.throws(()=>fixture(enabled,configure),/NORMAL_UNDERSTANDING_RESULT_CONFIGURATION_INVALID/);
});
test('real HTTP signed GET acquisition -> fresh POST challenge -> atomic metadata custody -> exact replay delta0',async()=>{
 const f=fixture();try{const acq=await f.acquire(),b=f.body(acq),r=f.request('POST',f.base+'/'+f.human.id+'/result',b),issued=await f.issue(r);
  assert.equal(issued.statusCode,200,issued.body);const frame=f.packet(r,issued.json()),row=f.rows().at(-1);
  assert.deepEqual(row.snapshot_json.understandingResultBinding,{requestRef:f.human,acquisitionRef:acq.proofResultRef});
  const repeated=await f.issue(r);assert.equal(repeated.statusCode,200,repeated.body);assert.deepEqual(repeated.json(),issued.json());assert.equal(f.rows().length,3);
  const first=await f.send('POST',r.target.path,frame,b);assert.equal(first.statusCode,200,first.body);assert.equal(first.json().status,'DISCOVERY_METADATA_STORED');assert.equal(first.json().selectionAvailable,false);
  const used=f.state.used,again=await f.send('POST',r.target.path,frame,b);assert.equal(again.statusCode,200,again.body);assert.deepEqual(again.json(),first.json());assert.equal(f.state.used,used);assert.equal(f.state.stores,1);
  assert.equal(f.rows().length,4);assert.equal(f.receipts().length,2);assert.equal(first.headers['cache-control'],'no-store');
 }finally{await f.app.close();}
});

test('configuration rejects getter/proxy witnesses without calling user code; configured challenge still needs an acquired original GET',async()=>{
 let invoked=0;assert.throws(()=>fixture(Object.defineProperty({purpose:enabled.purpose},'mode',{get(){invoked++;return enabled.mode;},enumerable:true})),/CONFIGURATION_INVALID/);
 assert.throws(()=>fixture(new Proxy(enabled,{get(){invoked++;throw Error('proxy');}})),/CONFIGURATION_INVALID/);assert.equal(invoked,0);
 const f=fixture();try{const r=f.request('POST',f.base+'/'+f.human.id+'/result',{schemaVersion:1,kind:'DISCOVERY_METADATA'}),answer=await f.issue(r);
  assert.equal(answer.statusCode,412,answer.body);assert.equal(f.rows().length,0);assert.equal(f.state.queries.some(q=>q.startsWith('INSERT')),false);
 }finally{await f.app.close();}
});

test('HTTP exact path/canonical UTF8/body and cookie/header boundaries reject before custody connection',async()=>{
 const f=fixture();try{const t=await f.ready();
  for(const entry of [
   {url:t.r.target.path+'?extra=1',value:t.value,extra:{}},
   {url:t.r.target.path.replace(f.human.id,'%'+f.human.id.charCodeAt(0).toString(16)+f.human.id.slice(1)),value:t.value,extra:{}},
   {url:f.base+'/'+randomUUID()+'/result',value:t.value,extra:{}},
   {url:t.r.target.path,value:' '+canonicalJson(t.value),extra:{}},
   {url:t.r.target.path,value:canonicalJson(t.value)+'\n',extra:{}},
   {url:t.r.target.path,value:t.value,extra:{cookie:'__Host-anvil.sid=not-authority'}},
   {url:t.r.target.path,value:t.value,extra:{origin:'https://synthetic.invalid'}},
   {url:t.r.target.path,value:t.value,extra:{'x-anvil-csrf':'not-authority'}},
   {url:t.r.target.path,value:t.value,extra:{authorization:[f.headers.authorization,f.headers.authorization]}},
   {url:t.r.target.path,value:t.value,extra:{'anvil-execution-auth':['a','a']}},
   {url:t.r.target.path,value:t.value,extra:{'content-encoding':'identity'}},
   {url:t.r.target.path,value:t.value,extra:{'transfer-encoding':'chunked'}},
  ]){const before=f.state.connects,response=await f.send('POST',entry.url,t.frame,entry.value,entry.extra);assert.ok(response.statusCode>=400,response.body);assert.equal(f.state.connects,before);}
  const raw=await f.app.inject({method:'POST',url:t.r.target.path,headers:{...f.headers,'anvil-execution-auth':Buffer.from(canonicalJson(t.frame)).toString('base64url'),'content-type':'application/json'},payload:Buffer.from([0xff,0xfe])});assert.equal(raw.statusCode,400,raw.body);
  const large=await f.send('POST',t.r.target.path,t.frame,'"'+'x'.repeat(2*1024*1024)+'"');assert.equal(large.statusCode,413,large.body);
  assert.equal(f.state.stores,0);assert.equal(f.receipts().length,1);
 }finally{await f.app.close();}
});

test('signed body, exact request/acquisition, nonce and registered credential cannot cross on the result HTTP path',async()=>{
 const f=fixture();try{const t=await f.ready();
  for(const change of [(b:any)=>{b.metadata.ranges[0].textBytes++;},(b:any)=>{b.metadata.acquisitionRef.id=randomUUID();},(b:any)=>{b.metadata.contextBundleRef.id=randomUUID();},(b:any)=>{b.metadata.raw='forbidden';},(b:any)=>{b.metadata.executionAuthorized=true;}]){
   const b=copy(t.value);change(b);const answer=await f.send('POST',t.r.target.path,t.frame,b);assert.ok(answer.statusCode>=400,answer.body);assert.equal(f.state.stores,0);
  }
  const bad=copy(t.frame);bad.proof.serverNonce=randomBytes(32).toString('base64url');assert.equal((await f.send('POST',t.r.target.path,bad,t.value)).statusCode,412);
  const other=await f.send('POST',t.r.target.path,t.frame,t.value,{authorization:'Bearer av3ex1_'+randomBytes(32).toString('base64url')});assert.equal(other.statusCode,404,other.body);
  f.state.credentialRef={...f.state.credentialRef,id:randomUUID()};assert.ok((await f.send('POST',t.r.target.path,t.frame,t.value)).statusCode>=400);
  assert.equal(f.state.stores,0);assert.equal(f.rows().length,3);assert.equal(f.receipts().length,1);
 }finally{await f.app.close();}
});

test('current loss and unknown challenge rollback never publish or retain a result nonce',async()=>{
 for(const mode of ['afterInsert','rollbackUnknown','commitUnknown'] as const){const f=fixture();try{
  const acq=await f.acquire(),value=f.body(acq),r=f.request('POST',f.base+'/'+f.human.id+'/result',value);
  if(mode==='rollbackUnknown'){f.state.afterInsert=true;f.state.rollbackUnknown=true;}else f.state[mode]=true;
  const answer=await f.issue(r);assert.equal(answer.statusCode,mode==='afterInsert'?412:503,answer.body);assert.equal(answer.json().challenge,undefined);
  assert.equal(f.state.stores,0);if(mode!=='commitUnknown')assert.equal(f.rows().length,2);assert.equal(f.state.releases.at(-1),mode!=='afterInsert');
 }finally{await f.app.close();}}
});

test('HTTP custody known denial rolls back all output; COMMIT unknown allows only explicit same packet delta0 replay',async()=>{
 for(const mode of ['afterStore','commitUnknown','expired'] as const){const f=fixture();try{const t=await f.ready();
  if(mode==='expired')f.state.now+=30000;else f.state[mode]=true;
  const answer=await f.send('POST',t.r.target.path,t.frame,t.value);assert.equal(answer.statusCode,mode==='commitUnknown'?503:412,answer.body);assert.equal(answer.json().proofResultRef,undefined);
  if(mode==='commitUnknown'){const used=f.state.used;assert.equal(f.receipts().length,2);f.state.commitUnknown=false;
   const replay=await f.send('POST',t.r.target.path,t.frame,t.value);assert.equal(replay.statusCode,200,replay.body);assert.equal(f.state.used,used);assert.equal(f.state.stores,1);
  }else{assert.equal(f.rows().length,3);assert.equal(f.receipts().length,1);assert.equal(f.state.used,0n);}
 }finally{await f.app.close();}}
});

test('result challenge cancellation before admission is DB0; known COMMIT cancellation preserves original nonce without invented rollback',async()=>{
 const f=fixture();try{const acq=await f.acquire(),value=f.body(acq),r=f.request('POST',f.base+'/'+f.human.id+'/result',value),before=f.state.connects;
  f.state.abortBefore=true;const rejected=await f.issue(r);assert.equal(rejected.statusCode,412,rejected.body);assert.equal(f.state.connects,before);
  f.state.abortBefore=false;f.state.cancelOnCommit=true;const rollbacks=f.state.queries.filter(q=>q==='ROLLBACK').length,answer=await f.issue(r);
  assert.equal(answer.statusCode,503,answer.body);assert.equal(answer.json().code,'NORMAL_UNDERSTANDING_RESULT_DELIVERY_UNKNOWN');assert.equal(f.rows().length,3);
  assert.equal(f.state.queries.filter(q=>q==='ROLLBACK').length,rollbacks);assert.equal(f.state.releases.at(-1),false);
  f.state.cancelOnCommit=false;const replay=await f.issue(r);assert.equal(replay.statusCode,200,replay.body);assert.equal(f.rows().length,3);
 }finally{await f.app.close();}
});

test('missing purpose SQL or connection has safe503 and no fallback nonce, result or raw installation details',async()=>{
 for(const mode of ['uninstalled','connectFailure'] as const){const f=fixture();try{const acq=await f.acquire(),value=f.body(acq),r=f.request('POST',f.base+'/'+f.human.id+'/result',value);
  f.state[mode]=true;const answer=await f.issue(r);assert.equal(answer.statusCode,503,answer.body);assert.doesNotMatch(answer.body,/RAW_|MIGRATION|CONNECT_SECRET/);assert.equal(f.rows().length,2);assert.equal(f.state.stores,0);
 }finally{await f.app.close();}}
});
