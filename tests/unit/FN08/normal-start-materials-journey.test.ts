import test from 'node:test';
import assert from 'node:assert/strict';
import inject from 'light-my-request';
import {randomBytes} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {journey,type PageSqlAdapter} from './normal-request-challenge-fixture.ts';
const {NormalPageCursors}=await import('../../../apps/server/modules/executions/normal-command-pages.ts');
const {startContextBody}=await import('../../../apps/server/modules/executions/normal-initial-execution.ts');
const digest=(v:unknown)=>contentHash(canonicalJson(v));
async function setup(withContext=true){
 const opts={failBinding:false,contextCalls:0,wrongContext:false,hang:false};
 const bindings:any[]=[];
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
  if(s.startsWith('SELECT * FROM anvil.normal_start_material_part')){
   // 원 제품 START가 저장한 명령·manifest·material 행과 준비 기록의 options 원문만 돌려준다.
   const [pid,eid,gid,gv,gen,command,material]=a;
   return {rows:commandRows(pid).filter(x=>x.execution_id===eid&&x.grant_id===gid&&x.grant_version===gv&&x.generation===gen&&x.snapshot_json.envelope.commandId===command).flatMap(x=>{
    const r=registered(pid,x);
    if(!r||!r.materials.some(m=>m.ref.id===material))return [];
    return [{...r,command_ref:{id:x.id,version:x.version,contentHash:x.content_hash},envelope:x.snapshot_json.envelope,envelope_hash:x.envelope_hash,
     options_body:f.preparation.data.snapshot.options.body}];
   })};
  }
  if(s.startsWith('INSERT INTO anvil.execution_receipts(')&&['NORMAL_COMMAND_PAGE','NORMAL_START_MATERIAL'].includes(JSON.parse(a[6]).kind)){
   issued.push({id:a[1],content_hash:a[5],challenge_id:a[4],snapshot_json:JSON.parse(a[6])});return {rows:[],rowCount:1};
  }
  if(s.startsWith('INSERT INTO anvil.execution_material_proof_bindings(')){
   if(opts.failBinding)throw Error('합성 binding 저장 실패');
   assert.equal(a.length,10);assert.equal(a[8],digest(JSON.parse(a[9])));bindings.push({proof_result_id:a[1],material_id:a[7],snapshot_json:JSON.parse(a[9])});return {rows:[],rowCount:1};
  }
  return undefined;
 };
 const h=await journey({sql,cursors:new NormalPageCursors(randomBytes(32))},{context:withContext?f=>({async contextBody(scope,signal){
  opts.contextCalls++;assert.ok(signal instanceof AbortSignal);assert.ok(!('query' in scope));
  if(opts.hang)await new Promise<void>(ok=>signal.addEventListener('abort',()=>ok(),{once:true}));
  // 제품 reader와 제품 조립 함수로 원문을 다시 만든다. 시험이 본문이나 hash를 따로 만들지 않는다.
  const db=await f.access.pool.connect();
  try{
   await db.query('BEGIN');
   const body=startContextBody(await f.contexts.readStartSource(db,f.actor,scope.projectId,scope.contextBundleRef as any),f.preparation.data.snapshot.intent);
   return opts.wrongContext?body+' ':body;
  }finally{await db.query('ROLLBACK');db.release();}
 }}):undefined});
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
 return {h,opts,bindings,base,discover,material,signedGet,expire};
}
test('명령 페이지에서 발견한 두 자료를 보호 GET으로 받아 등록 hash와 대조한다',async()=>{
 const {h,opts,bindings,discover,material}=await setup();
 try{
  const {item,parts}=await discover();assert.equal(parts.length,2);
  for(const part of parts){
   const p=await material(item.envelope.commandId,part.materialId);
   h.store.mode.lost=true;const lost=await p.get();assert.equal(lost.statusCode,503);assert.equal(lost.json().material,undefined);h.store.mode.lost=false;
   const [a,b]=await Promise.all([p.get(),p.get()]);assert.equal(a.statusCode,200,a.body);assert.deepEqual(a.json(),b.json());
   const out=a.json(),bytes=Buffer.from(out.material.bytes,'base64url');
   assert.equal(bytes.toString('base64url'),out.material.bytes);assert.ok(!/[=+/]/.test(out.material.bytes));
   assert.equal(contentHash(bytes),part.contentHash);assert.equal(bytes.length,part.utf8Bytes);assert.equal(contentHash(bytes),part.group.contentHash);
   assert.deepEqual(Object.keys(out.material).sort(),['bytes','contentHash','materialId','partCount','partIndex','sourceRef']);
   assert.deepEqual([out.material.materialId,out.material.partIndex,out.material.partCount,out.material.sourceRef],[part.materialId,1,1,part.group.sourceRef]);
   assert.equal(out.cacheControl,'no-store');assert.equal(out.executionAuthorized,false);assert.equal(out.dispatchPerformed,false);assert.equal(a.headers['cache-control'],'no-store');
   JSON.parse(bytes.toString('utf8'));
  }
  const receipts=h.store.receipts().filter(v=>v.snapshot_json.kind==='NORMAL_START_MATERIAL');
  assert.equal(receipts.length,2);assert.ok(opts.contextCalls>=1);
  for(const r of receipts){
   assert.ok(!JSON.stringify(r).includes('"bytes"'));
   assert.ok(bindings.some(b=>b.proof_result_id===r.id&&b.material_id===r.snapshot_json.materialRef.id&&b.snapshot_json.contentHash===r.snapshot_json.partContentHash));
  }
  assert.ok(!JSON.stringify([h.store.sqlArgs,h.store.receipts()]).includes(h.token));
 }finally{await h.app.close();}
});
const used=(h:any)=>[h.store.events().filter((v:any)=>v.version===2).length,h.store.receipts().length];
const denied=async(p:{get:(o?:any)=>any},o?:any)=>{const r=await p.get(o);assert.ok(r.statusCode>=400,r.body);assert.equal(r.json().material,undefined);return r;};
test('서명 대상과 다른 경로·query·채널, 등록 행 변조, 회수는 원문을 내지 않고 nonce를 소비하지 않는다',async()=>{
 const {h,base,discover,material}=await setup();
 try{
  const {item,parts}=await discover(),context=parts.find(p=>p.kind==='CONTEXT_BUNDLE')!,options=parts.find(p=>p.kind==='START_OPTIONS')!,start=used(h);
  const p=await material(item.envelope.commandId,options.materialId);
  await denied(p,{url:base+'/commands/'+item.envelope.commandId+'/materials/'+context.materialId});
  await denied(p,{url:base+'/commands/'+item.envelope.commandId+'/materials/'+options.materialId+'?waitMs=0'});
  await denied(p,{tls:false});await denied(p,{headers:{cookie:'x=y'}});
  const row=h.f.tables.execution_materials!.find(m=>m.id===options.materialId)!,saved=structuredClone(row.snapshot_json);
  row.snapshot_json={...saved,contentHash:'0'.repeat(64)};assert.equal((await denied(p)).statusCode,412);row.snapshot_json=saved;
  h.store.mode.revoked=true;await denied(p);h.store.mode.revoked=false;
  // 거절 뒤 같은 packet은 정상 조건에서 한 번만 소비된다
  assert.deepEqual(used(h),start);assert.equal((await p.get()).statusCode,200);assert.equal((await p.get()).statusCode,200);
  assert.deepEqual(used(h),[start[0]+1,start[1]+1]);
 }finally{await h.app.close();}
});
test('등록되지 않은 자료 ID와 다른 명령 ID는 거절한다',async()=>{
 const {h,discover,material,expire}=await setup();
 try{
  const {item,parts}=await discover(),start=used(h);
  await denied(await material(item.envelope.commandId,h.f.pid));expire();
  await denied(await material(h.f.pid,parts[0]!.materialId));
  assert.deepEqual(used(h),start);
 }finally{await h.app.close();}
});
test('명령 조회용 challenge는 자료에 쓸 수 없고, 공급자가 다른 원문을 주거나 응답하지 않으면 거절한다',async()=>{
 const {h,opts,base,discover,material,signedGet,expire}=await setup();
 try{
  const {item,parts}=await discover(),context=parts.find(p=>p.kind==='CONTEXT_BUNDLE')!,start=used(h);
  const pageProof=await signedGet(base+'/commands',{waitMs:0});
  await denied(pageProof,{url:base+'/commands/'+item.envelope.commandId+'/materials/'+context.materialId});expire();
  const c=await material(item.envelope.commandId,context.materialId);
  opts.wrongContext=true;assert.equal((await denied(c)).statusCode,412);opts.wrongContext=false;
  opts.hang=true;assert.equal((await denied(c)).statusCode,503);opts.hang=false;
  assert.deepEqual(used(h),start);
  assert.equal((await c.get()).statusCode,200);assert.deepEqual(used(h),[start[0]+1,start[1]+1]);
 }finally{await h.app.close();}
});
test('보호 공급자를 주입하지 않으면 맥락 묶음은 거절하고 실행 옵션만 전달한다',async()=>{
 const {h,discover,material,expire}=await setup(false);
 try{
  const {item,parts}=await discover(),context=parts.find(p=>p.kind==='CONTEXT_BUNDLE')!,options=parts.find(p=>p.kind==='START_OPTIONS')!;
  const c=await (await material(item.envelope.commandId,context.materialId)).get();
  assert.equal(c.statusCode,412);assert.equal(c.json().code,'EXECUTION_MATERIAL_SOURCE_REQUIRED');expire();
  assert.equal((await (await material(item.envelope.commandId,options.materialId)).get()).statusCode,200);
  assert.equal(h.store.receipts().filter(v=>v.snapshot_json.kind==='NORMAL_START_MATERIAL').length,1);
 }finally{await h.app.close();}
});
