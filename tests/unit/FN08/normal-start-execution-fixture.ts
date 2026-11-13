
import assert from 'node:assert/strict';
import inject from 'light-my-request';
import {randomBytes} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {journey,type PageSqlAdapter} from './normal-request-challenge-fixture.ts';
const {NormalPageCursors}=await import('../../../apps/server/modules/executions/normal-command-pages.ts');
const { RegisteredStartContextSource } = await import('../../../apps/server/modules/executions/normal-start-context-source.ts');
const { contextSourceFixture } = await import('./normal-start-context-source-fixture.ts');
const digest=(v:unknown)=>contentHash(canonicalJson(v));
export async function executionFixture(withContext=true){
 const opts={failBinding:false,contextCalls:0,wrongContext:false,hang:false,events:[] as string[],contextBodies:[] as string[]};

 const bindings:any[]=[],permits:any[]=[],observations:any[]=[],acks:any[]=[];
 const sql:PageSqlAdapter=(s,a,{f,drafts,issued})=>{
  if(s.startsWith('SELECT v.content_hash AS vhash')){
   const consumed=drafts.find(v=>v.id===a[3]&&v.version===2),receipt=issued.find(v=>v.challenge_id===a[3]);
   return {rows:consumed?[{vhash:consumed.content_hash,consumed:consumed.snapshot_json,id:receipt?.id,content_hash:receipt?.content_hash,receipt:receipt?.snapshot_json}]:[]};
  }
  const commandRows=(pid:string)=>f.tables.execution_commands!.filter(x=>x.project_id===pid);
  const registered=(pid:string,x:any)=>{
   const d=f.tables.execution_material_manifests!.find(m=>m.project_id===pid&&m.created_command_id===x.created_command_id);
   return d?{command_record_id:x.id,manifest_ref:{id:d.id,version:1,contentHash:d.content_hash},manifest:d.snapshot_json,
    materials:f.tables.execution_materials!.filter(m=>m.project_id===pid&&m.manifest_id===d.id&&m.command_record_id===x.id)
     .map(m=>({ref:{id:m.id,version:1,contentHash:m.content_hash},snapshot:m.snapshot_json}))}:undefined;
  };
  if(s.startsWith('SELECT * FROM anvil.normal_command_page_rows')){
   const [pid,eid,gid,gv,gen,after,ids]=a;
   return {rows:commandRows(pid).filter(x=>x.execution_id===eid&&x.grant_id===gid&&x.grant_version===gv&&x.generation===gen).flatMap(x=>{
    const sequence=f.audits.get(x.created_command_id)!.server_sequence;
    if(sequence<=after||ids&&!ids.includes(x.id))return [];
    return [{sequence:String(sequence),valid:true,command_ref:{id:x.id,version:x.version,contentHash:x.content_hash},envelope_hash:x.envelope_hash,envelope:x.snapshot_json.envelope}];
   })};
  }
  if(s.startsWith('SELECT * FROM anvil.normal_start_material_rows'))return {rows:commandRows(a[0]).filter(x=>a[1].includes(x.id)).flatMap(x=>registered(a[0],x)??[])};
  if(s==='ROLLBACK'){opts.events.push('ROLLBACK');return undefined;}
  if(s.startsWith('SELECT * FROM anvil.normal_start_material_part')){
   opts.events.push('PART');
   // 원 제품 START가 저장한 명령·manifest·material 행과 준비 기록의 options 원문만 돌려준다.
   const [pid,eid,gid,gv,gen,command,material]=a;
   return {rows:commandRows(pid).filter(x=>x.execution_id===eid&&x.grant_id===gid&&x.grant_version===gv&&x.generation===gen&&x.snapshot_json.envelope.commandId===command).flatMap(x=>{
    const r=registered(pid,x);
    if(!r||!r.materials.some(m=>m.ref.id===material))return [];
    return [{...r,command_ref:{id:x.id,version:x.version,contentHash:x.content_hash},envelope:x.snapshot_json.envelope,envelope_hash:x.envelope_hash,
     options_body:f.preparation.data.snapshot.options.body}];
   })};
  }
  if(s.startsWith('INSERT INTO anvil.execution_receipts(')&&['NORMAL_COMMAND_PAGE','NORMAL_START_MATERIAL','NORMAL_START_PERMIT','NORMAL_OBSERVATIONS'].includes(JSON.parse(a[6]).kind)){
   issued.push({id:a[1],content_hash:a[5],challenge_id:a[4],snapshot_json:JSON.parse(a[6])});return {rows:[],rowCount:1};
  }
  if(s.startsWith('INSERT INTO anvil.execution_material_proof_bindings(')){
   if(opts.failBinding)throw Error('합성 binding 저장 실패');
   assert.equal(a.length,10);assert.equal(a[8],digest(JSON.parse(a[9])));bindings.push({proof_result_id:a[1],material_id:a[7],snapshot_json:JSON.parse(a[9])});return {rows:[],rowCount:1};
  }
  if(s.startsWith('SELECT snapshot_json FROM anvil.execution_grants')){
   return {rows:f.tables.execution_grants!.filter(g=>g.project_id===a[0]&&g.id===a[1]&&g.version===a[2]&&g.content_hash===a[3]).map(g=>({snapshot_json:g.snapshot_json}))};
  }
  if(s.startsWith('SELECT id,content_hash,snapshot_json,proof_result_id FROM anvil.execution_start_permits'))return {rows:permits.filter(p=>p.project_id===a[0]&&p.execution_id===a[1]&&p.generation===a[2])};
  if(s.startsWith('INSERT INTO anvil.execution_start_permits(')){
   const [pid,eid,gen,id,proof,hash,raw]=a,snap=JSON.parse(raw);assert.equal(hash,digest(snap));
   if(permits.some(p=>p.project_id===pid&&p.execution_id===eid&&p.generation===gen))throw Error('합성 UNIQUE 위반');
   permits.push({project_id:pid,execution_id:eid,generation:gen,id,proof_result_id:proof,content_hash:hash,snapshot_json:snap});return {rows:[],rowCount:1};
  }
  if(s.startsWith('SELECT id,content_hash,snapshot_json FROM anvil.execution_observations'))return {rows:observations.filter(o=>o.project_id===a[0]&&o.execution_id===a[1]&&o.generation===a[2]).sort((x,y)=>x.event_sequence-y.event_sequence)};
  if(s.startsWith('SELECT id,version,content_hash,snapshot_json FROM anvil.execution_acknowledgements')){
   const own=acks.filter(k=>k.project_id===a[0]&&k.execution_id===a[1]&&k.generation===a[2]);
   if(s.includes('AND id=$4'))return {rows:own.filter(k=>k.id===a[3]&&k.version===a[4])};
   return {rows:own.sort((x,y)=>y.version-x.version).slice(0,1)};
  }
  if(s.startsWith('INSERT INTO anvil.execution_observations(')){
   const [pid,eid,gen,id,seq,gid,gv,hash,raw]=a,snap=JSON.parse(raw);assert.equal(hash,digest(snap));
   if(observations.some(o=>o.project_id===pid&&o.execution_id===eid&&o.generation===gen&&(o.event_sequence===seq||o.snapshot_json.event.eventId===snap.event.eventId)))throw Error('합성 UNIQUE 위반');
   observations.push({project_id:pid,execution_id:eid,generation:gen,id,event_sequence:seq,grant_id:gid,grant_version:gv,content_hash:hash,snapshot_json:snap});return {rows:[],rowCount:1};
  }
  if(s.startsWith('INSERT INTO anvil.execution_acknowledgements(')){
   const [pid,eid,gen,id,version,gid,gv,hash,raw]=a,snap=JSON.parse(raw);assert.equal(hash,digest(snap));
   acks.push({project_id:pid,execution_id:eid,generation:gen,id,version,grant_id:gid,grant_version:gv,content_hash:hash,snapshot_json:snap});return {rows:[],rowCount:1};
  }
  return undefined;
 };
 const h=await journey({sql,cursors:new NormalPageCursors(randomBytes(32))},{context:withContext?f=>({async contextBody(scope,signal){
  opts.contextCalls++;assert.ok(signal instanceof AbortSignal);assert.ok(!('query' in scope));opts.events.push('PROVIDER');
  if(opts.hang)await new Promise<void>(ok=>signal.addEventListener('abort',()=>ok(),{once:true}));
  // 실제 START 저장행의 grant/등록묶음을 공급자 자신의 snapshot에서 검증한다.
  const registered=contextSourceFixture(f);registered.mode.offset=h.store.mode.offset;
  const body=await new RegisteredStartContextSource({pool:registered.pool as any,contexts:f.contexts}).contextBody(scope,signal);
  assert.deepEqual(registered.calls.filter(s=>/project_members|FOR UPDATE|FOR SHARE|^\s*(INSERT|UPDATE|DELETE)\b/.test(s)),[]);
  assert.equal(registered.calls[0],'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(registered.calls.at(-1),'ROLLBACK');assert.equal(registered.releases.length,1);
  opts.contextBodies.push(body);return opts.wrongContext?body+' ':body;
 }}):undefined},{current:f=>({async observe(_scope,signal){assert(signal instanceof AbortSignal);return {...structuredClone(f.tables.execution_grants![0]!.snapshot_json.binding),writerState:'OWNED',checkedAt:h.store.now().toISOString()};}})},true);
 async function signedGet(path:string,query:Record<string,string|number>){
  const r=h.mk();r.target.path=path;r.target.queryHash=digest(query);const resp=await h.post(h.signed(r));assert.equal(resp.statusCode,200,resp.body);
  const {challenge:c,ref}=resp.json();
  const proof={requestId:c.requestId,...r.target,grantRef:c.grantRef,credentialGeneration:c.credentialGeneration,serverNonce:c.serverNonce};
  const frame={schemaVersion:1,challengeRef:ref,proof,signature:h.signProof(proof)};
  const suffix=new URLSearchParams(Object.entries(query).map(([k,v])=>[k,String(v)])).toString();
  const get=(o:{url?:string;headers?:Record<string,string>;tls?:boolean}={})=>inject((req,rep)=>{Object.defineProperty(req.socket,'encrypted',{value:o.tls!==false});h.app.routing(req,rep);},
   {method:'GET',url:o.url??path+(suffix?'?'+suffix:''),headers:{host:'anvil-synthetic.invalid',authorization:'Bearer '+h.token,
    'anvil-execution-auth':Buffer.from(canonicalJson(frame)).toString('base64url'),...o.headers}});
  return {get,frame};
 }
 const base='/api/v1/connectors/'+h.f.registration!.row.connector_id+'/executions/'+h.f.tables.execution_commands![0]!.execution_id;
 // 실행기는 명령 페이지에서만 자료 ID를 알아낸다.
 async function discover(){
  const page=await (await signedGet(base+'/commands',{waitMs:0})).get();assert.equal(page.statusCode,200,page.body);
  const item=page.json().items[0];
  return {item,parts:item.materials.groups.flatMap((g:any)=>g.parts.map((p:any)=>({...p,kind:g.kind,group:g}))) as any[]};
 }
 const material=(command:string,id:string)=>signedGet(base+'/commands/'+command+'/materials/'+id,{});
 // credential당 살아 있는 challenge는 하나다. 소비하지 못한 challenge는 30초 기한이 지나야 다음 것을 받을 수 있다.
 const expire=()=>{h.store.mode.offset+=30001;};
 return {h,opts,bindings,permits,observations,acks,base,discover,material,signedGet,expire};
}
/** HTTPS 요청 드라이버의 RAM 대역. 실제 Fastify handler와 서버 서명/nonce/permit/ACK 검산을 통과한다. */
export function httpsFixture(h:Awaited<ReturnType<typeof executionFixture>>['h']){
 const mode={lose:false,alter:(_path:string,v:any)=>v};const calls:{path:string;method:string}[]=[];
 const request:any=(url:URL,options:any,onResponse:any)=>{
  const req:any=new EventEmitter();req.destroy=()=>req;req.end=(bytes?:Uint8Array)=>{
   const payload=bytes?Buffer.from(bytes).toString('utf8'):undefined;calls.push({path:url.pathname,method:options.method});
   queueMicrotask(async()=>{
    try{
     const reply=await inject((a,b)=>{Object.defineProperty(a.socket,'encrypted',{value:true});h.app.routing(a,b);},
      {url:url.pathname+url.search,method:options.method,payload,headers:{...options.headers,host:url.host}});
     if(mode.lose&&!url.pathname.endsWith('/challenges')){req.emit('error',Error('합성 응답 유실'));return;}
     const body=JSON.stringify(mode.alter(url.pathname,reply.json()));
     const res:any=new EventEmitter();res.statusCode=reply.statusCode;res.rawHeaders=['content-type','application/json','cache-control','no-store'];res.destroy=()=>res;
     onResponse(res);res.emit('data',Buffer.from(body));res.emit('end');
    }catch{req.emit('error',Error('합성 HTTP 실패'));}
   });return req;
  };return req;
 };
 const cmd=h.f.tables.execution_commands![0]!,grant=h.f.tables.execution_grants![0]!,cred=h.f.tables.execution_credentials![0]!;
 const options={origin:'https://anvil-synthetic.invalid',ca:'합성 CA',credential:h.token,credentialExpiresAt:h.credentialExpiresAt,
  scope:{projectId:h.f.pid,connectorId:h.f.registration!.row.connector_id,executionId:cmd.execution_id,executionGeneration:cmd.generation,
   grantRef:{id:grant.id,version:grant.version,contentHash:grant.content_hash},credentialGeneration:cred.credential_generation}};
 const ports={request,now:()=>h.store.now().getTime(),signer:{async sign(_purpose:any,bytes:Buffer){return h.signBytes(bytes);}}};
 return{options,ports,mode,calls};
}

/** 원제품 서버+RAM 저장을 재사용하는 합성 정상 실행 준비. 실제 키/DB/파일/Agent 호출0. */
export async function preparedExecution(){
 const [{NormalProtectedGetClient},{NormalProtectedPostClient},{NormalStartIntake,receiveNormalStart},{NormalStartFileStore},
  {NormalObservationSpool},{NormalStartCoordinator},{root,memoryFiles}]=await Promise.all([
 import('../../../apps/connector/runtime/normal-protected-get-client.ts'),import('../../../apps/connector/runtime/normal-protected-post-client.ts'),
 import('../../../apps/connector/runtime/normal-start-intake.ts'),import('../../../apps/connector/runtime/normal-start-file-store.ts'),
 import('../../../apps/connector/runtime/normal-observation-spool.ts'),import('../../../apps/connector/runtime/normal-start-coordinator.ts'),import('./normal-start-local-fixture.ts')]);
 const q=await executionFixture(),h=q.h,http=httpsFixture(h),post=new NormalProtectedPostClient(http.options,http.ports),get=new NormalProtectedGetClient(http.options,http.ports);
 const signal=new AbortController().signal,page=await get.send(await get.prepareCommandPage({afterSequence:0,waitMs:0},signal),signal) as any,item=page.items[0],e=item.envelope;
 const scope={projectId:e.context.projectId,executionId:e.context.executionId,executionGeneration:e.context.executionGeneration},fs=memoryFiles();
 const store=new NormalStartFileStore(root,scope,fs.fs),clock=()=>h.store.now().getTime(),intake=new NormalStartIntake(store.intake(),{context:e.context,executorRegistrationRef:e.executorRegistrationRef},clock);
 await receiveNormalStart(get,intake,item,page.proofResultRef,signal);
 const grantRef=http.options.scope.grantRef,binding=h.f.tables.execution_grants![0]!.snapshot_json.binding;
 const mode={wires:0,currents:0,currentHook:async()=>{},wireHook:async()=>{},timeoutMs:1000};
 const current={transport:'NORMAL_PROTECTED' as const,async current(envelope:any,attempt:any,_signal:AbortSignal){
  mode.currents++;await mode.currentHook();
  return{transport:'NORMAL_PROTECTED',key:{...scope,commandId:e.commandId},envelopeHash:envelope.envelopeHash,grantRef,localAttemptRef:attempt,
   sourceObservationRefs:[...new Map(e.context.sourceScopes.map((s:any)=>[canonicalJson(s.observationRef),s.observationRef])).values()],
   osOwnershipRef:binding.checks.osFence.evidenceRefs[0],checkedAt:h.store.now().toISOString(),expiresAt:new Date(clock()+10000).toISOString()};
 }};
 const wire={transport:'NORMAL_PROTECTED' as const,async send(value:any,_signal:AbortSignal){mode.wires++;assert.equal(Buffer.from(value.options.bytes).toString(),h.f.preparation.data.snapshot.options.body);
  await mode.wireHook();return{transport:'NORMAL_PROTECTED',responseRef:grantRef,processRef:null};}};
 const make=()=>{
  const fresh=new NormalStartFileStore(root,scope,fs.fs),spool=new NormalObservationSpool(fresh,scope,clock);
  return{spool,coordinator:new NormalStartCoordinator({intake:new NormalStartIntake(fresh.intake(),{context:e.context,executorRegistrationRef:e.executorRegistrationRef},clock),
   store:fresh,post,current,wire,spool,grantRef,clock,timeoutMs:mode.timeoutMs})};
 };
 return{q,h,http,post,get,signal,e,item,scope,fs,store,intake,grantRef,binding,clock,mode,make};
}
