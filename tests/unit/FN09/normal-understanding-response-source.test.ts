import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readNormalUnderstandingResponse} from '../../../apps/server/modules/executions/normal-understanding-response-source.ts';
import {NormalSdkSessionOutput} from '../../../apps/connector/runtime/normal-sdk-session-output.ts';

const hash=(v:unknown)=>contentHash(canonicalJson(v));
const ref=():{id:string;version:number;contentHash:string}=>({id:randomUUID(),version:1,contentHash:'a'.repeat(64)});
function fixture(){
 const at=Date.parse('2026-11-22T00:00:00.000Z'),sid='private-session-not-for-output';
 const scope={projectId:randomUUID(),executionId:randomUUID(),generation:1,registrationRef:ref(),profileRef:ref(),assignmentRef:ref(),slotRef:ref(),grantRef:ref(),startReadyRef:ref(),dispatchAttemptRef:ref(),sessionBindingRef:ref(),plannedSidDigest:hash(sid)};
 const rows:{ref:ReturnType<typeof ref>;snapshot:any}[]=[];
 const add=(snapshot:any)=>{const r={ref:{...ref(),contentHash:hash(snapshot)},snapshot};rows.push(r);return r.ref;};
 const message=(v:any,init:ReturnType<typeof ref>|null)=>add({schemaVersion:1,state:init?'SESSION_OUTPUT':'OUTPUT_PENDING_SESSION',scope,sequence:rows.length+1,previousRef:rows.at(-1)?.ref??null,initConfirmationRef:init,observedAt:new Date(at).toISOString(),family:v.type==='system'?'SYSTEM_INIT':'ASSISTANT',identity:hash(v.uuid),payloadDigest:hash(v),classification:'ORDINARY',body:Buffer.from(canonicalJson(v)).toString('base64')});
 const first=message({type:'system',subtype:'init',uuid:'init',session_id:sid,apiKeySource:'none',claude_code_version:'2.1.224',cwd:'private-path',tools:[],mcp_servers:[],model:'private-model',permissionMode:'default',slash_commands:[],output_style:'fixture',skills:[],plugins:[]},null);
 const confirmation=add({schemaVersion:1,state:'SESSION_INIT_CONFIRMED',scope,sequence:2,previousRef:first,initOutputRef:first,observedSidDigest:scope.plannedSidDigest,prefixCount:1,tailRef:first,prefixDigest:hash({previous:hash([]),ref:first,payloadDigest:rows[0]!.snapshot.payloadDigest}),observedAt:new Date(at).toISOString()});
 const tail=message({type:'assistant',uuid:'answer',session_id:sid,parent_tool_use_id:null,message:{role:'assistant',content:[{type:'text',text:'사람이 대조할 원 응답'}]}},confirmation);
 const basis=ref();
 const binding={scope,mode:'CONTEXT_REVIEW',bundleRef:ref(),subjectBindingRef:ref(),basisRefs:[basis],requiredPartRefs:[basis],receivedPartRefs:[basis],checkedAt:new Date(at).toISOString(),expiresAt:new Date(at+10000).toISOString()};
 const request={scope,initConfirmationRef:confirmation,tailRef:tail,firstSequence:3,lastSequence:3};
 const state={now:at,open:0,reads:0,closed:0,active:true,failClose:false,afterRead:()=>{},afterClose:()=>{}};
 const source={clock:()=>state.now,current:()=>state.active?structuredClone(binding):null,withRead:async(body:(reader:{rowCount:number;read:(sequence:number)=>Promise<unknown>})=>Promise<void>)=>{
  state.open++;await body({rowCount:rows.length,read:async sequence=>{state.reads++;const row=structuredClone(rows[sequence-1]);state.afterRead();return row;}});state.closed++;state.afterClose();if(state.failClose)throw Error('private path/error');
 }};
 const signal=new AbortController();
 return{scope,rows,binding,request,state,source,signal,run:()=>readNormalUnderstandingResponse(request,source,signal.signal),rehash:(i:number)=>{rows[i]!.ref.contentHash=hash(rows[i]!.snapshot);}};
}
test('같은 보호 읽기의 정상 종결 뒤 고정 범위 text만 반환하고 권위·SID·SDK 메타를 반환하지 않는다',async()=>{
 const f=fixture(),v=await f.run();
 assert.equal(f.state.open,1);assert.equal(f.state.closed,1);assert.equal(f.state.reads,3);
 assert.equal(v.attribution,'SESSION_ONLY');assert.equal(v.executionAuthorized,false);assert.equal(v.wholeConversationComplete,false);
 assert.equal(v.parts.length,1);assert.equal(v.parts[0]!.text,'사람이 대조할 원 응답');assert.deepEqual(v.parts[0]!.outputRef,f.rows[2]!.ref);
 assert.equal(v.parts[0]!.textHash,contentHash('사람이 대조할 원 응답'));
 assert.equal(/private-session|private-path|private-model|plannedSidDigest|NORMAL_PROTECTED|MATCH/.test(JSON.stringify(v)),false);
});
test('다른 세대·WORK·필수 수신 부족은 원 읽기 전 거절한다',async()=>{
 for(const change of [(f:ReturnType<typeof fixture>)=>{f.binding.scope={...f.scope,generation:2};},(f:ReturnType<typeof fixture>)=>{f.binding.mode='WORK';},(f:ReturnType<typeof fixture>)=>{f.binding.receivedPartRefs=[];}]){
  const f=fixture();change(f);await assert.rejects(f.run(),/NORMAL_UNDERSTANDING_SOURCE_UNAVAILABLE/);assert.equal(f.state.open,0);
 }
});
test('원 범위·tail·init·chain·본문 해시가 다르면 projection을 반환하지 않는다',async()=>{
 for(const change of [(f:ReturnType<typeof fixture>)=>{f.request.tailRef=ref();},(f:ReturnType<typeof fixture>)=>{f.request.initConfirmationRef=ref();},(f:ReturnType<typeof fixture>)=>{f.rows[2]!.snapshot.previousRef=ref();},(f:ReturnType<typeof fixture>)=>{f.rows[2]!.snapshot.payloadDigest='b'.repeat(64);f.rehash(2);f.request.tailRef=f.rows[2]!.ref;},(f:ReturnType<typeof fixture>)=>{f.rows[1]!.snapshot.prefixDigest='b'.repeat(64);}]){
  const f=fixture();change(f);await assert.rejects(f.run(),/NORMAL_UNDERSTANDING_SOURCE_UNAVAILABLE/);
 }
});
test('QUARANTINED·도구 block·혼합 content·하위 agent·모호한 본문은 선택에서 조용히 건너뛰지 않는다',async()=>{
 for(const kind of ['quarantine','tool','mixed','subagent','empty','extra']){
  const f=fixture(),s=f.rows[2]!.snapshot,m=JSON.parse(Buffer.from(s.body,'base64').toString());
  if(kind==='quarantine')s.classification='QUARANTINED';
  else if(kind==='subagent')m.parent_tool_use_id='parent';
  else if(kind==='empty')m.message.content=[];
  else if(kind==='extra')m.message.content[0].unknown='private';
  else if(kind==='mixed')m.message.content.push({type:'tool_use',input:{secret:'private'}});
  else m.message.content=[{type:'tool_use',input:{secret:'private'}}];
  s.body=Buffer.from(canonicalJson(m)).toString('base64');s.payloadDigest=hash(m);f.rehash(2);f.request.tailRef=f.rows[2]!.ref;
  await assert.rejects(f.run(),e=>e instanceof Error&&e.message==='NORMAL_UNDERSTANDING_SOURCE_UNAVAILABLE');
 }
});
test('초기 read·정상 close 이후 기한/현재성/취소 상실 또는 close 불명은 원문을 반환하지 않는다',async()=>{
 for(const phase of ['read','close','throw','abort']){
  const f=fixture();if(phase==='read')f.state.afterRead=()=>{f.state.now+=10000;};
  if(phase==='close')f.state.afterClose=()=>{f.state.active=false;};
  if(phase==='throw')f.state.failClose=true;
  if(phase==='abort')f.state.afterRead=()=>f.signal.abort();
  await assert.rejects(f.run(),e=>e instanceof Error&&e.message==='NORMAL_UNDERSTANDING_SOURCE_UNAVAILABLE');
 }
});
test('호출 전 오염 shape/getter와 이중 read callback은 결과가 없다',async()=>{
 const f=fixture();let accessed=0;
 Object.defineProperty(f.request,'tailRef',{get(){accessed++;return ref();},enumerable:true});
 await assert.rejects(f.run(),/NORMAL_UNDERSTANDING_SOURCE_UNAVAILABLE/);assert.equal(accessed,0);assert.equal(f.state.open,0);
 const g=fixture(),original=g.source.withRead;g.source.withRead=async body=>{await original(body);await original(body);};
 await assert.rejects(g.run(),/NORMAL_UNDERSTANDING_SOURCE_UNAVAILABLE/);
 const h=fixture(),read=h.source.withRead;h.source.withRead=async body=>{await read(body);try{await read(body);}catch{}};
 await assert.rejects(h.run(),/NORMAL_UNDERSTANDING_SOURCE_UNAVAILABLE/);
});
test('기존 정상 SDK 출력 producer가 정착한 원 row를 직접 소비한다 · init 전 응답도 원 prefix와 대조',async()=>{
 const f=fixture(),messages=[JSON.parse(Buffer.from(f.rows[2]!.snapshot.body,'base64').toString()),JSON.parse(Buffer.from(f.rows[0]!.snapshot.body,'base64').toString())];
 const iterator={async next(){return messages.length?{done:false as const,value:messages.shift()}:{done:true as const,value:undefined};}},query={[Symbol.asyncIterator]:()=>iterator};
 const origin={owner:{},attempt:{},query,iterator};let bytes=0;
 f.rows.length=0;
 const output=new NormalSdkSessionOutput({origin,scope:f.scope,plannedSid:'private-session-not-for-output',expiresAt:f.state.now+10000,
  context:{projectId:f.scope.projectId,assignmentId:f.scope.assignmentRef.id,executionId:f.scope.executionId,executionGeneration:1,connectionRef:ref(),environmentRef:ref(),authorizationReceiptRef:ref(),capabilityRef:ref(),budgetRef:ref(),sourceScopes:[]},
  ports:{clock:()=>f.state.now,current:()=>({...origin,scopeDigest:hash(f.scope),expiresAt:f.state.now+10000}),classify:()=> 'ORDINARY',
   async reserve(request){return{id:randomUUID(),requestDigest:hash(request),normalUsed:bytes,normalHeldBefore:0,channelBytes:bytes,channelRows:f.rows.length,channelHeldBytes:0,channelHeldRows:0,managementBytes:1};},
   async strictExclusive(hold,body){await body({async read(){return structuredClone(f.rows);},async appendAndSync(value){f.rows.push(structuredClone(value) as typeof f.rows[number]);}});return{holdId:hold.id,tailRef:f.rows.at(-1)?.ref??null,rows:f.rows.length};},
   async settle(hold,added){bytes+=added;return{holdId:hold.id,dataBytes:added,managementBytes:1};}}});
 assert.equal((await output.next(f.signal.signal)).state,'PENDING_SESSION');
 const confirmation=await output.next(f.signal.signal);assert.equal(confirmation.state,'SESSION_CONFIRMED');
 f.request.initConfirmationRef=confirmation.receipts[0]!.initConfirmationRef;f.request.tailRef=f.rows.at(-1)!.ref;f.request.firstSequence=1;f.request.lastSequence=1;
 const value=await f.run();assert.equal(value.parts[0]!.text,'사람이 대조할 원 응답');assert.deepEqual(value.parts[0]!.outputRef,confirmation.receipts[0]!.outputRef);assert.equal(f.state.closed,1);
});
test('비정규 UTF8·중복 JSON 필드·원 선택의 크기 초과는 본문을 반환하지 않는다',async()=>{
 for(const kind of ['utf8','duplicate','large']){
  const f=fixture(),s=f.rows[2]!.snapshot;
  let body:Buffer;
  if(kind==='utf8')body=Buffer.from([0xc3,0x28]);
  else if(kind==='duplicate')body=Buffer.from('{"type":"assistant","type":"assistant"}');
  else {const m=JSON.parse(Buffer.from(s.body,'base64').toString());m.message.content[0].text='x'.repeat(1600000);body=Buffer.from(canonicalJson(m));}
  s.body=body.toString('base64');s.payloadDigest=contentHash(body);f.rehash(2);f.request.tailRef=f.rows[2]!.ref;
  await assert.rejects(f.run(),/NORMAL_UNDERSTANDING_SOURCE_UNAVAILABLE/);
 }
});
test('소스가 read 완료를 기다리지 않은 종결과 기한 연장으로 원 입력을 채택하지 않는다',async()=>{
 const f=fixture();let pending:Promise<void>|undefined,release:(v:unknown)=>void=()=>{};
 f.source.withRead=async body=>{pending=body({rowCount:3,read:()=>new Promise(resolve=>{release=resolve;})});void pending.catch(()=>{});};
 await assert.rejects(f.run(),/NORMAL_UNDERSTANDING_SOURCE_UNAVAILABLE/);release(f.rows[0]);await assert.rejects(pending!,/NORMAL_UNDERSTANDING_SOURCE_UNAVAILABLE/);
 const g=fixture();g.state.afterRead=()=>{g.state.now+=10000;g.binding.expiresAt=new Date(g.state.now+10000).toISOString();};
 await assert.rejects(g.run(),/NORMAL_UNDERSTANDING_SOURCE_UNAVAILABLE/);
});

for(const mode of ['OK','EMPTY','CLOSE','CHAIN','QUARANTINED'])test('DISCOVERY 원 행에서 init/tail 메타만 도출 '+mode,async()=>{
 const {readNormalUnderstandingDiscovery}=await import('../../../apps/connector/runtime/normal-understanding-response-source.ts');
 const f=fixture();if(mode==='EMPTY')f.rows.pop();if(mode==='CLOSE')f.state.failClose=true;if(mode==='CHAIN')f.rows[2]!.snapshot.previousRef=ref();if(mode==='QUARANTINED'){f.rows[2]!.snapshot.classification='QUARANTINED';f.rehash(2);}
 const current={scope:f.scope,requestRef:ref(),acquisitionRef:ref(),contextBundleRef:f.binding.bundleRef,checkedAt:f.binding.checkedAt,expiresAt:f.binding.expiresAt};
 const run=()=>readNormalUnderstandingDiscovery(current,{...f.source,current:()=>f.state.active?current:null},f.signal.signal);
 if(!['OK','EMPTY'].includes(mode)){await assert.rejects(run(),/NORMAL_UNDERSTANDING_SOURCE_UNAVAILABLE/);return;}
 const result=await run();assert.equal(f.state.closed,1);assert.deepEqual(result.initConfirmationRef,f.rows[1]!.ref);assert.deepEqual(result.tailRef,f.rows.at(-1)!.ref);assert.equal(result.ranges.length,mode==='EMPTY'?0:1);
 assert.equal(/사람이|private|plannedSid|session_id|body|textHash/.test(JSON.stringify(result)),false);assert.equal(result.executionAuthorized,false);assert.equal(Object.isFrozen(result),true);assert.equal(Object.isFrozen(result.ranges),true);if(result.ranges.length)assert.equal(Object.isFrozen(result.ranges[0]!.outputRef),true);
});

for(const mode of ['DOUBLE','LATE','CANCEL','OVER_PARTS'])test('DISCOVERY callback·기한·취소·200 한도는 부분 메타를 반환하지 않는다 '+mode,async()=>{
 const {readNormalUnderstandingDiscovery}=await import('../../../apps/connector/runtime/normal-understanding-response-source.ts');const f=fixture();
 if(mode==='DOUBLE'){const old=f.source.withRead;f.source.withRead=async body=>{await old(body);try{await old(body);}catch{}};}
 if(mode==='LATE')f.state.afterClose=()=>{f.state.now+=10000;};if(mode==='CANCEL')f.state.afterRead=()=>f.signal.abort();
 if(mode==='OVER_PARTS'){const row=f.rows[2]!,m=JSON.parse(Buffer.from(row.snapshot.body,'base64').toString());m.message.content=Array.from({length:201},()=>({type:'text',text:'bounded'}));row.snapshot.body=Buffer.from(canonicalJson(m)).toString('base64');row.snapshot.payloadDigest=hash(m);f.rehash(2);}
 const binding={scope:f.scope,requestRef:ref(),acquisitionRef:ref(),contextBundleRef:f.binding.bundleRef,checkedAt:f.binding.checkedAt,expiresAt:f.binding.expiresAt};
 await assert.rejects(readNormalUnderstandingDiscovery(binding,{...f.source,current:()=>binding},f.signal.signal),/NORMAL_UNDERSTANDING_SOURCE_UNAVAILABLE/);
});
