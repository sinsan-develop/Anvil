import test from 'node:test';
import assert from 'node:assert/strict';
import inject from 'light-my-request';
import {randomBytes} from 'node:crypto';
import {EventEmitter} from 'node:events';
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
test('실행기 codec이 실제 명령 페이지·자료 응답을 검산해 두 원본을 조립하고, 변조는 거절한다',async()=>{
 const {h,base,signedGet,material}=await setup();
 const consumer=await import('../../../apps/connector/runtime/normal-start-material-consumer.ts');
 const rejects=(fn:()=>unknown,code:string)=>assert.throws(fn,(e:any)=>e instanceof consumer.NormalMaterialConsumerFailure&&e.code===code);
 try{
  const cmd=h.f.tables.execution_commands![0]!,now=()=>Date.now()+h.store.mode.offset;
  const scope={projectId:h.f.pid,executionId:cmd.execution_id,executionGeneration:cmd.generation,afterSequence:0};
  const pageResp=await (await signedGet(base+'/commands',{waitMs:0})).get();assert.equal(pageResp.statusCode,200,pageResp.body);
  const rawPage=pageResp.json(),page=consumer.readNormalCommandPage(rawPage,scope,now());
  assert.equal(page.items.length,1);const item=page.items[0]!;
  // 서버 고정 receipt의 descriptor hash와 실행기가 계산한 hash가 같다
  const receipt=h.store.receipts().find((v:any)=>v.snapshot_json.kind==='NORMAL_COMMAND_PAGE')!;
  assert.equal(item.materialsDescriptorHash,receipt.snapshot_json.entries[0].materialsDescriptorHash);
  // 페이지 변조·다른 범위 거절
  const bad=(mut:(p:any)=>void)=>{const p=structuredClone(rawPage);mut(p);return p;};
  rejects(()=>consumer.readNormalCommandPage(rawPage,{...scope,executionGeneration:scope.executionGeneration+1},now()),'COMMAND_PAGE_ITEM_INVALID');
  rejects(()=>consumer.readNormalCommandPage(rawPage,{...scope,afterSequence:item.sequence},now()),'COMMAND_PAGE_ITEM_INVALID');
  rejects(()=>consumer.readNormalCommandPage(bad(p=>{p.executionAuthorized=true;}),scope,now()),'COMMAND_PAGE_INVALID');
  rejects(()=>consumer.readNormalCommandPage(bad(p=>{p.extra=1;}),scope,now()),'COMMAND_PAGE_INVALID');
  rejects(()=>consumer.readNormalCommandPage(bad(p=>{p.items=[];p.hasMore=true;}),scope,now()),'COMMAND_PAGE_INVALID');
  rejects(()=>consumer.readNormalCommandPage(rawPage,scope,Date.parse(rawPage.expiresAt)),'COMMAND_PAGE_INVALID');
  rejects(()=>consumer.readNormalCommandPage(bad(p=>{p.items[0].materials.groups.reverse();}),scope,now()),'MATERIAL_DESCRIPTOR_INVALID');
  rejects(()=>consumer.readNormalCommandPage(bad(p=>{p.items[0].materials.groups[1].parts[0].materialId=p.items[0].materials.groups[0].parts[0].materialId;}),scope,now()),'MATERIAL_DESCRIPTOR_INVALID');
  rejects(()=>consumer.readNormalCommandPage(bad(p=>{p.items[0].materials.groups[0].sourceBytes+=1;}),scope,now()),'MATERIAL_DESCRIPTOR_INVALID');
  rejects(()=>consumer.readNormalCommandPage(bad(p=>{p.items[0].materials.groups[0].parts[0].partIndex=2;}),scope,now()),'MATERIAL_DESCRIPTOR_INVALID');
  rejects(()=>consumer.readNormalCommandPage(bad(p=>{delete p.items[0].materials;}),scope,now()),'COMMAND_PAGE_ITEM_INVALID');
  rejects(()=>consumer.findNormalMaterial(item,h.f.pid),'MATERIAL_NOT_IN_DESCRIPTOR');
  const bodies:Record<string,string>={};
  for(const group of item.materials.groups){
   const received:ReturnType<typeof consumer.readNormalMaterialResponse>[]=[];
   for(const part of group.parts){
    const path=consumer.normalMaterialPath(h.f.registration!.row.connector_id,cmd.execution_id,item.envelope.commandId,part.materialId);
    assert.equal(path,base+'/commands/'+item.envelope.commandId+'/materials/'+part.materialId);
    const resp=await (await material(item.envelope.commandId,part.materialId)).get();assert.equal(resp.statusCode,200,resp.body);
    const raw=resp.json(),got=consumer.readNormalMaterialResponse(raw,item,part.materialId,now());
    assert.equal(got.bytes.length,part.utf8Bytes);received.push(got);
    const mut=(f:(m:any)=>void)=>{const r=structuredClone(raw);f(r);return r;};
    const other=item.materials.groups.flatMap(g=>g.parts).find(p=>p.materialId!==part.materialId)!;
    rejects(()=>consumer.readNormalMaterialResponse(raw,item,other.materialId,now()),'MATERIAL_RESPONSE_MISMATCH');
    rejects(()=>consumer.readNormalMaterialResponse(mut(r=>{r.material.bytes+='=';}),item,part.materialId,now()),'MATERIAL_BYTES_INVALID');
    rejects(()=>consumer.readNormalMaterialResponse(mut(r=>{r.material.bytes='+'+r.material.bytes.slice(1);}),item,part.materialId,now()),'MATERIAL_BYTES_INVALID');
    if(raw.material.bytes.length%4){
     // 마지막 문자의 남는 비트만 바꾼 비정규 표기는 같은 bytes로 디코드되지만 받지 않는다
     const abc='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',s=raw.material.bytes,last=abc.indexOf(s.at(-1));
     const loose=s.slice(0,-1)+abc[last^1];
     assert.notEqual(loose,s);assert.deepEqual(Buffer.from(loose,'base64url'),Buffer.from(s,'base64url'));
     rejects(()=>consumer.readNormalMaterialResponse(mut(r=>{r.material.bytes=loose;}),item,part.materialId,now()),'MATERIAL_BYTES_INVALID');
    }
    rejects(()=>consumer.readNormalMaterialResponse(mut(r=>{const b=Buffer.from(r.material.bytes,'base64url');b[0]=b[0]!^1;r.material.bytes=b.toString('base64url');}),item,part.materialId,now()),'MATERIAL_BYTES_MISMATCH');
    rejects(()=>consumer.readNormalMaterialResponse(mut(r=>{r.material.contentHash='0'.repeat(64);}),item,part.materialId,now()),'MATERIAL_RESPONSE_MISMATCH');
    rejects(()=>consumer.readNormalMaterialResponse(mut(r=>{r.dispatchPerformed=true;}),item,part.materialId,now()),'MATERIAL_RESPONSE_INVALID');
    rejects(()=>consumer.readNormalMaterialResponse(mut(r=>{r.material.encoding='base64url';}),item,part.materialId,now()),'MATERIAL_RESPONSE_INVALID');
   }
   rejects(()=>consumer.assembleNormalStartMaterial(group,[]),'MATERIAL_ASSEMBLY_INCOMPLETE');
   rejects(()=>consumer.assembleNormalStartMaterial(group,[...received,...received]),'MATERIAL_ASSEMBLY_INCOMPLETE');
   rejects(()=>consumer.assembleNormalStartMaterial({...group,contentHash:'0'.repeat(64)},received),'MATERIAL_ASSEMBLY_MISMATCH');
   const out=consumer.assembleNormalStartMaterial(group,received);
   assert.equal(contentHash(out.bytes),group.contentHash);bodies[group.kind]=out.text;JSON.parse(out.text);
  }
  // 조립한 실행 옵션 원문은 제품 준비 기록의 원문과 같다
  assert.equal(bodies.START_OPTIONS,h.f.preparation.data.snapshot.options.body);
  assert.ok(typeof bodies.CONTEXT_BUNDLE==='string'&&bodies.CONTEXT_BUNDLE.length>0);
 }finally{await h.app.close();}
});
/** node:https request 형태를 실제 Fastify 앱으로 연결하는 대역. 실제 socket·TLS는 열지 않는다(TLS 표시만 켠다). */
function httpsToApp(h:any,mode:{lose?:boolean;status?:number;contentType?:string;sent:any[]}){
 return (url:URL,options:any,callback:(res:any)=>void)=>{
  const req:any=new EventEmitter();req.destroy=()=>{};
  req.end=(body?:Buffer)=>{
   mode.sent.push({method:options.method,url:url.pathname+url.search,headers:{...options.headers},ca:options.ca,rejectUnauthorized:options.rejectUnauthorized});
   inject((rq,rp)=>{Object.defineProperty(rq.socket,'encrypted',{value:true});h.app.routing(rq,rp);},
    {method:options.method,url:url.pathname+url.search,headers:{host:url.host,...options.headers},...(body?{payload:Buffer.from(body)}:{})}).then(r=>{
    // 서버는 처리했지만 응답이 오지 않은 상황
    if(mode.lose){setImmediate(()=>req.emit('error',new Error('lost')));return;}
    const res:any=new EventEmitter();res.destroy=()=>{};res.statusCode=mode.status??r.statusCode;
    const headers={...r.headers,...(mode.contentType?{'content-type':mode.contentType}:{})};
    res.rawHeaders=Object.entries(headers).flatMap(([k,v])=>[k,String(v)]);
    callback(res);setImmediate(()=>{res.emit('data',r.rawPayload);res.emit('end');});
   },e=>req.emit('error',e));
  };
  return req;
 };
}
async function clientSetup(withContext=true){
 const s=await setup(withContext),{h}=s,cmd=h.f.tables.execution_commands![0]!;
 const {NormalProtectedGetClient,NormalProtectedGetError}=await import('../../../apps/connector/runtime/normal-protected-get-client.ts');
 const consumer=await import('../../../apps/connector/runtime/normal-start-material-consumer.ts');
 const mode:{lose?:boolean;status?:number;contentType?:string;sent:any[]}={sent:[]};
 const signer={async sign(purpose:string,bytes:Buffer){
  assert.equal(JSON.parse(bytes.toString('utf8')).purpose,purpose);return h.signBytes(bytes);}};
 const client=new NormalProtectedGetClient({origin:'https://anvil-synthetic.invalid',ca:'-----BEGIN CERTIFICATE-----\nSYNTHETIC\n-----END CERTIFICATE-----',
  credential:h.token,credentialExpiresAt:h.credentialExpiresAt,scope:{projectId:h.f.pid,connectorId:h.f.registration!.row.connector_id,executionId:cmd.execution_id,
   executionGeneration:cmd.generation,grantRef:h.mk().grantRef,credentialGeneration:h.mk().credentialGeneration}},
  {signer,request:httpsToApp(h,mode) as any,now:()=>h.store.now().getTime()});
 return {...s,client,mode,consumer,NormalProtectedGetError,signal:()=>new AbortController().signal};
}
test('실행기 보호 GET 클라이언트가 challenge·서명·GET으로 명령 페이지와 두 자료를 받아 원본을 조립한다',async()=>{
 const {h,client,mode,consumer,signal}=await clientSetup();
 try{
  const page=await client.send(await client.prepareCommandPage({afterSequence:0,waitMs:0},signal()),signal());
  assert.equal(page.items.length,1);const item=page.items[0]!;
  const bodies:Record<string,string>={};
  for(const group of item.materials.groups){
   const received=[];
   for(const part of group.parts){
    const p=await client.prepareMaterial(item,part.materialId,signal());
    received.push(await client.send(p,signal()));
   }
   bodies[group.kind]=consumer.assembleNormalStartMaterial(group,received).text;
  }
  assert.equal(bodies.START_OPTIONS,h.f.preparation.data.snapshot.options.body);JSON.parse(bodies.CONTEXT_BUNDLE!);
  // POST challenge 3번, GET 3번. 브라우저용 헤더는 보내지 않고 TLS 검증을 끄지 않는다.
  assert.deepEqual(mode.sent.map(x=>x.method),['POST','GET','POST','GET','POST','GET']);
  for(const x of mode.sent){
   assert.equal(x.headers.authorization,'Bearer '+h.token);assert.equal(x.rejectUnauthorized,true);assert.ok(x.ca);
   for(const k of ['origin','cookie','x-anvil-csrf'])assert.equal(x.headers[k],undefined);
   assert.equal('anvil-execution-auth' in x.headers,x.method==='GET');
  }
  assert.equal(mode.sent[1].url.split('?')[1],'waitMs=0');assert.ok(!mode.sent[3].url.includes('?'));
  assert.equal(h.store.receipts().filter((v:any)=>v.snapshot_json.kind==='NORMAL_START_MATERIAL').length,2);
 }finally{await h.app.close();}
});
test('GET 응답을 잃으면 결과 불명으로 끝내고 자동 재전송하지 않으며, 같은 packet 재전송은 한 번만 소비된다',async()=>{
 const {h,client,mode,NormalProtectedGetError,signal}=await clientSetup();
 try{
  const prepared=await client.prepareCommandPage({afterSequence:0,waitMs:0},signal()),before=used(h);
  mode.lose=true;
  await assert.rejects(client.send(prepared,signal()),(e:any)=>e instanceof NormalProtectedGetError&&e.code==='NORMAL_GET_OUTCOME_UNKNOWN'&&e.outcomeUnknown===true);
  mode.lose=false;
  assert.equal(mode.sent.filter(x=>x.method==='GET').length,1);// 자동 재전송 0
  assert.deepEqual(used(h),[before[0]+1,before[1]+1]);// 서버는 이미 소비했다
  const again=await client.send(prepared,signal()),third=await client.send(prepared,signal());
  assert.deepEqual(again,third);assert.deepEqual(used(h),[before[0]+1,before[1]+1]);// 같은 packet은 같은 영수증으로 수렴
  // 기한이 지난 packet은 보내지 않는다
  h.store.mode.offset+=30001;const sentBefore=mode.sent.length;
  await assert.rejects(client.send(prepared,signal()),(e:any)=>e.code==='NORMAL_GET_PACKET_EXPIRED');assert.equal(mode.sent.length,sentBefore);
 }finally{await h.app.close();}
});
test('4xx 거절·5xx 결과 불명·리다이렉트·JSON 아닌 응답·descriptor 밖 자료·잘못된 입력을 구분해 처리한다',async()=>{
 const {h,client,mode,NormalProtectedGetError,signal}=await clientSetup(false);
 try{
  const page=await client.send(await client.prepareCommandPage({afterSequence:0,waitMs:0},signal()),signal()),item=page.items[0]!;
  const context=item.materials.groups[0]!.parts[0]!,options=item.materials.groups[1]!.parts[0]!;
  // 공급자 미주입: 서버 412 거절은 효과 없음(outcomeUnknown=false)
  const c=await client.prepareMaterial(item,context.materialId,signal());
  await assert.rejects(client.send(c,signal()),(e:any)=>e instanceof NormalProtectedGetError&&e.code==='NORMAL_GET_REJECTED'&&e.status===412&&e.outcomeUnknown===false);
  // 소비되지 않은 challenge가 남아 있어 다음 준비는 429로 거절된다(효과 없음)
  await assert.rejects(client.prepareMaterial(item,options.materialId,signal()),(e:any)=>e.code==='NORMAL_GET_CHALLENGE_REJECTED'&&e.status===429&&e.outcomeUnknown===false&&e.challengeMayBeLive===false);
  h.store.mode.offset+=30001;
  const o=await client.prepareMaterial(item,options.materialId,signal());
  mode.status=302;await assert.rejects(client.send(o,signal()),(e:any)=>e.code==='NORMAL_GET_REDIRECT_DENIED');mode.status=undefined;
  for(const status of [500,502,503,504]){mode.status=status;await assert.rejects(client.send(o,signal()),(e:any)=>e.code==='NORMAL_GET_REJECTED'&&e.status===status&&e.outcomeUnknown===true);}mode.status=undefined;
  mode.contentType='text/html';await assert.rejects(client.send(o,signal()),(e:any)=>e.code==='NORMAL_GET_RESPONSE_INVALID'&&e.outcomeUnknown===true);mode.contentType=undefined;
  const got=await client.send(o,signal());assert.equal(got.materialId,options.materialId);
  // 다른 명령의 item으로 자료를 요청하지 않는다
  await assert.rejects(client.prepareMaterial(item,h.f.pid,signal()),(e:any)=>e.code==='NORMAL_GET_INPUT_INVALID');
  await assert.rejects(client.prepareMaterial({...item,materials:{manifestRef:item.materials.manifestRef,groups:null}} as any,options.materialId,signal()),(e:any)=>e.code==='NORMAL_GET_INPUT_INVALID');
  // 첫 페이지(afterSequence 0)에 cursor를 붙이는 등 입력이 어긋나면 challenge를 발급받기 전에 거절한다
  await assert.rejects(client.prepareCommandPage({afterSequence:0,afterCursor:'x',waitMs:0},signal()),(e:any)=>e.code==='NORMAL_GET_INPUT_INVALID');
 }finally{await h.app.close();}
});
test('challenge 발급 뒤 서명이 실패하거나 발급 응답이 5xx면 남은 challenge 가능성을 알린다',async()=>{
 const {h,client,mode,signal}=await clientSetup();
 try{
  // 서명 포트가 proof 서명에서만 실패하도록 바꾼다
  let calls=0;const {NormalProtectedGetClient}=await import('../../../apps/connector/runtime/normal-protected-get-client.ts');
  const cmd=h.f.tables.execution_commands![0]!;
  const flaky=new NormalProtectedGetClient({origin:'https://anvil-synthetic.invalid',ca:'x',credential:h.token,credentialExpiresAt:h.credentialExpiresAt,
   scope:{projectId:h.f.pid,connectorId:h.f.registration!.row.connector_id,executionId:cmd.execution_id,executionGeneration:cmd.generation,grantRef:h.mk().grantRef,credentialGeneration:h.mk().credentialGeneration}},
   {signer:{async sign(_p:string,bytes:Buffer){if(++calls===2)throw Error('키 사용 불가');return h.signBytes(bytes);}},request:httpsToApp(h,mode) as any,now:()=>h.store.now().getTime()});
  await assert.rejects(flaky.prepareCommandPage({afterSequence:0,waitMs:0},signal()),(e:any)=>e.code==='NORMAL_GET_SIGNER_UNAVAILABLE'&&e.challengeMayBeLive===true);
  assert.equal(mode.sent.filter((x:any)=>x.method==='GET').length,0);
  // 발급 응답 상태가 5xx면 challenge가 남았을 수 있다
  h.store.mode.offset+=30001;mode.status=502;
  await assert.rejects(client.prepareCommandPage({afterSequence:0,waitMs:0},signal()),(e:any)=>e.code==='NORMAL_GET_CHALLENGE_REJECTED'&&e.outcomeUnknown===true&&e.challengeMayBeLive===true);
  mode.status=undefined;
 }finally{await h.app.close();}
});
