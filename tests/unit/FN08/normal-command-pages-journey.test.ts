import test from 'node:test';
import assert from 'node:assert/strict';
import inject from 'light-my-request';
import {randomBytes} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {journey,type PageSqlAdapter} from './normal-request-challenge-fixture.ts';
const {NormalPageCursors}=await import('../../../apps/server/modules/executions/normal-command-pages.ts');
const digest=(v:unknown)=>contentHash(canonicalJson(v));
async function setup(){
 let selected=0,announce!:()=>void;
 const firstRead=new Promise<void>(ok=>announce=ok);
 const opts={failReceipt:false,empty:false,noManifest:false,onWaitRelease:undefined as (()=>void)|undefined};
 const sql:PageSqlAdapter=(s,a,{f,drafts,issued})=>{
  if(s==='ROLLBACK'){opts.onWaitRelease?.();return undefined;}
  if(s.startsWith('SELECT v.content_hash AS vhash')){
   const consumed=drafts.find(v=>v.id===a[3]&&v.version===2),receipt=issued.find(v=>v.challenge_id===a[3]);
   return {rows:consumed?[{vhash:consumed.content_hash,consumed:consumed.snapshot_json,id:receipt?.id,content_hash:receipt?.content_hash,receipt:receipt?.snapshot_json}]:[]};
  }
  if(s.startsWith('SELECT * FROM anvil.normal_command_page_rows')){
   selected++;announce();
   const [pid,eid,gid,gv,gen,after,ids]=a;
   const output=f.tables.execution_commands!.filter(x=>x.project_id===pid&&x.execution_id===eid&&x.grant_id===gid&&x.grant_version===gv&&x.generation===gen).flatMap(x=>{
    const ar=f.receipts.get(x.created_command_id),audit=f.audits.get(x.created_command_id);
    assert.ok(ar&&audit);const o=f.tables.delivery_outbox!.find(o=>o.project_id===pid&&o.command_id===x.created_command_id)!;
    const sequence=audit.server_sequence,ref={id:x.id,version:x.version,contentHash:x.content_hash};
    if(sequence<=after||ids&&!ids.includes(ref.id)||opts.empty)return [];
    const valid=ar.id===x.authorization_ref.id&&audit.scope_digest===ar.scope_digest&&
     canonicalJson(audit.target_ref)===canonicalJson(ref)&&canonicalJson(o.payload_ref.commandRef)===canonicalJson(ref)&&
     o.payload_ref.envelopeHash===x.envelope_hash&&o.payload_ref.grantRef.id===gid&&o.destination_ref.executionId===eid;
    return [{sequence:String(sequence),valid,command_ref:ref,envelope_hash:x.envelope_hash,envelope:x.snapshot_json.envelope}];
   });
   return {rows:output};
  }
  if(s.startsWith('SELECT * FROM anvil.normal_start_material_rows')){
   // 원 제품 START가 저장한 manifest/material 행만 돌려준다. ID를 시험이 따로 만들지 않는다.
   const [pid,ids]=a;
   return {rows:f.tables.execution_commands!.filter(x=>x.project_id===pid&&ids.includes(x.id)).flatMap(x=>{
    const d=f.tables.execution_material_manifests!.find(m=>m.project_id===pid&&m.created_command_id===x.created_command_id);
    if(!d||opts.noManifest)return [];
    return [{command_record_id:x.id,manifest_ref:{id:d.id,version:1,contentHash:d.content_hash},manifest:d.snapshot_json,
     materials:f.tables.execution_materials!.filter(m=>m.project_id===pid&&m.manifest_id===d.id&&m.command_record_id===x.id)
      .map(m=>({ref:{id:m.id,version:1,contentHash:m.content_hash},snapshot:m.snapshot_json}))}];
   })};
  }
  if(s.startsWith('INSERT INTO anvil.execution_receipts(')&&JSON.parse(a[6]).kind==='NORMAL_COMMAND_PAGE'){
   if(opts.failReceipt)throw Error('합성 부분 쓰기 실패');
   issued.push({id:a[1],content_hash:a[5],challenge_id:a[4],snapshot_json:JSON.parse(a[6])});
   return {rows:[],rowCount:1};
  }
  return undefined;
 };
 const h=await journey({sql,cursors:new NormalPageCursors(randomBytes(32))});
 async function challenge(query:Record<string,string|number>={waitMs:0}){
  const r=h.mk();r.target.queryHash=digest(query);const resp=await h.post(h.signed(r));assert.equal(resp.statusCode,200,resp.body);
  const {challenge:c,ref}=resp.json();
  const proof={requestId:c.requestId,...r.target,grantRef:c.grantRef,credentialGeneration:c.credentialGeneration,serverNonce:c.serverNonce};
  const frame={schemaVersion:1,challengeRef:ref,proof,signature:h.signProof(proof)};
  const suffix=new URLSearchParams(Object.entries(query).map(([k,v])=>[k,String(v)])).toString();
  const url=r.target.path+(suffix?'?'+suffix:'');
  const get=(overrides:{url?:string;frame?:any;headers?:Record<string,string>;duplicate?:string;array?:string;tls?:boolean}={})=>
   inject((req,rep)=>{Object.defineProperty(req.socket,'encrypted',{value:overrides.tls!==false});
    if(overrides.duplicate)req.rawHeaders.push(overrides.duplicate,'duplicate');
    if(overrides.array)Object.assign(req.headers,{[overrides.array]:[String(req.headers[overrides.array])]});
    h.app.routing(req,rep);},{method:'GET',url:overrides.url??url,headers:{host:'anvil-synthetic.invalid',authorization:'Bearer '+h.token,
    'anvil-execution-auth':Buffer.from(canonicalJson(overrides.frame??frame)).toString('base64url'),...overrides.headers}});
  return {get,frame,url};
 }
 return {h,opts,challenge,firstRead,selected:()=>selected};
}
test('제품 START 원감사와 outbox를 조회하고 같은 packet의 동시 소비와 COMMIT 유실은 최초 페이지로 수렴한다',async()=>{
 const {h,challenge}=await setup();
 try{
  const p=await challenge(),row=h.f.tables.execution_commands![0]!,audit=h.f.audits.get(row.created_command_id)!;
  h.store.mode.lost=true;const lost=await p.get();assert.equal(lost.statusCode,503);assert.equal(lost.json().items,undefined);
  h.store.mode.lost=false;
  const [a,b]=await Promise.all([p.get(),p.get()]);assert.equal(a.statusCode,200,a.body);assert.deepEqual(a.json(),b.json());
  const page=a.json();assert.equal(page.items.length,1);assert.equal(page.items[0].sequence,audit.server_sequence);
  assert.deepEqual(page.items[0].envelope,row.snapshot_json.envelope);assert.equal(page.items[0].envelope.operation,'START_SESSION');
  assert.equal(page.hasMore,false);assert.equal(page.executionAuthorized,false);
  assert.equal(h.store.receipts().filter(v=>v.snapshot_json.kind==='NORMAL_COMMAND_PAGE').length,1);
  assert.equal(h.store.events().filter(v=>v.version===2&&v.snapshot_json.request.purpose==='EXECUTION_REQUEST').length,1);
  const next=await challenge({afterCursor:page.nextCursor,waitMs:0}),empty=await next.get();
  assert.equal(empty.statusCode,200,empty.body);assert.deepEqual(empty.json().items,[]);
  assert.ok(!JSON.stringify([h.store.sqlArgs,h.store.receipts(),page]).includes(h.token));
 }finally{await h.app.close();}
});
test('헤더 중복·서명·query 변경·출처 위조와 부분쓰기/COMMIT ROLLBACK은 성공 행을 내지 않는다',async()=>{
 const {h,opts,challenge}=await setup();
 try{
  const p=await challenge(),out=h.f.tables.delivery_outbox![0]!,payload=structuredClone(out.payload_ref);
  for(const name of ['Host','Anvil-Execution-Auth','Authorization']){
   const result=await p.get({duplicate:name});assert.equal(result.statusCode,403,name);
   assert.equal((await p.get({array:name.toLowerCase()})).statusCode,403,name);
  }
  for(const bad of [{tls:false},{url:p.url+'&waitMs=1'},{url:p.url.replace('waitMs=0','waitMs=1')},
   {frame:{...p.frame,signature:randomBytes(64).toString('base64url')}},{headers:{cookie:'x=y'}}])assert.ok((await p.get(bad)).statusCode>=400);
  out.payload_ref={...payload,envelopeHash:'0'.repeat(64)};assert.equal((await p.get()).statusCode,412);out.payload_ref=payload;
  opts.failReceipt=true;assert.equal((await p.get()).statusCode,503);opts.failReceipt=false;
  h.store.mode.badTag=true;const bad=await p.get();assert.equal(bad.statusCode,503);assert.equal(bad.json().code,'EXECUTION_PAGE_COMMIT_UNKNOWN');h.store.mode.badTag=false;
  assert.equal(h.store.events().length,3);assert.equal(h.store.receipts().length,1);
  const [a,b]=await Promise.all([p.get(),p.get()]);assert.equal(a.statusCode,200,a.body);assert.deepEqual(a.json(),b.json());
  assert.equal(h.store.receipts().length,2);
 }finally{await h.app.close();}
});
test('대기 사이 기한이 지나거나 서명된 요청의 nonce가 달라지면 소비하지 않는다',async()=>{
 const {h,opts,challenge}=await setup();try{
  const p=await challenge({waitMs:100});
  const wrong={...p.frame.proof,serverNonce:randomBytes(32).toString('base64url')};
  assert.equal((await p.get({frame:{...p.frame,proof:wrong,signature:h.signProof(wrong)}})).statusCode,412);
  opts.empty=true;
  opts.onWaitRelease=()=>{h.store.mode.offset+=30001;opts.onWaitRelease=undefined;};
  const res=await p.get();assert.equal(res.statusCode,412);assert.equal(h.store.events().length,3);assert.equal(h.store.receipts().length,1);
 }finally{await h.app.close();}
});
test('빈 페이지 대기는 연결을 반환하고, 대기 중 회수되면 nonce를 소비하지 않는다',async()=>{
 const {h,opts,challenge,firstRead}=await setup();try{
  opts.empty=true;const p=await challenge({waitMs:100});
  const released=new Promise<void>(ok=>opts.onWaitRelease=ok);
  const pending=Promise.resolve(p.get());await firstRead;await released;
  h.store.mode.revoked=true;
  const res=await pending;assert.ok(res.statusCode>=400);assert.equal(h.store.events().length,3);assert.equal(h.store.receipts().length,1);
 }finally{await h.app.close();}
});
test('제품 START가 등록한 자료 ID와 범위를 명령 페이지와 고정 영수증으로 전달한다',async()=>{
 const {h,challenge}=await setup();
 try{
  const p=await challenge(),res=await p.get();assert.equal(res.statusCode,200,res.body);
  const item=res.json().items[0],row=h.f.tables.execution_commands![0]!;
  const manifest=h.f.tables.execution_material_manifests!.find(m=>m.created_command_id===row.created_command_id)!;
  const stored=h.f.tables.execution_materials!.filter(m=>m.manifest_id===manifest.id);
  assert.deepEqual(item.materials.manifestRef,{id:manifest.id,version:1,contentHash:manifest.content_hash});
  assert.deepEqual(item.materials.groups.map((g:any)=>g.kind),['CONTEXT_BUNDLE','START_OPTIONS']);
  assert.deepEqual(item.materials.groups.map((g:any)=>g.payloadRef),[item.envelope.payload.contextBundleRef,item.envelope.payload.optionsRef]);
  const parts=item.materials.groups.flatMap((g:any)=>g.parts);
  assert.deepEqual(parts.map((x:any)=>x.materialId).sort(),stored.map(m=>m.id).sort());
  for(const g of item.materials.groups){
   assert.equal(g.mediaType,'application/json');assert.equal(g.parts.reduce((n:number,x:any)=>n+x.utf8Bytes,0),g.sourceBytes);
   assert.deepEqual(Object.keys(g).sort(),['contentHash','kind','mediaType','parts','payloadRef','sourceBytes','sourceRef']);
  }
  const receipt=h.store.receipts().find(v=>v.snapshot_json.kind==='NORMAL_COMMAND_PAGE')!.snapshot_json;
  assert.equal(receipt.materialDiscoveryVersion,1);
  assert.deepEqual(receipt.entries[0].materialsManifestRef,item.materials.manifestRef);
  assert.equal(receipt.entries[0].materialsDescriptorHash,digest(item.materials));
  assert.deepEqual((await p.get()).json(),res.json());
  assert.ok(!JSON.stringify(res.json()).includes(String(h.f.root)));
 }finally{await h.app.close();}
});
test('자료 등록이 없거나 변조됐거나 결박 없는 옛 영수증이면 자료 metadata를 내지 않는다',async()=>{
 const {h,opts,challenge}=await setup();
 try{
  const p=await challenge(),material=h.f.tables.execution_materials![0]!,saved=structuredClone(material.snapshot_json);
  opts.noManifest=true;assert.equal((await p.get()).statusCode,412);opts.noManifest=false;
  material.snapshot_json={...saved,byteOffset:1};assert.equal((await p.get()).statusCode,412);
  material.snapshot_json={...saved,commandId:h.f.pid};assert.equal((await p.get()).statusCode,412);material.snapshot_json=saved;
  assert.equal(h.store.receipts().length,1);
  const ok=await p.get();assert.equal(ok.statusCode,200,ok.body);
  // 발견 결박이 생기기 전 형식의 영수증을 재현한다. 사후에 metadata를 덧붙이지 않아야 한다.
  const receipt=h.store.receipts().find(v=>v.snapshot_json.kind==='NORMAL_COMMAND_PAGE')!,{materialDiscoveryVersion:_,...old}=receipt.snapshot_json;
  receipt.snapshot_json={...old,entries:old.entries.map(({materialsManifestRef:__,materialsDescriptorHash:___,...e}:any)=>e)};
  receipt.content_hash=digest(receipt.snapshot_json);
  const used=h.store.events().find(v=>v.version===2&&v.snapshot_json.consumption?.resultRef.id===receipt.id)!;
  used.snapshot_json.consumption.resultRef.contentHash=receipt.content_hash;used.content_hash=digest(used.snapshot_json);
  const again=await p.get();assert.equal(again.statusCode,412);assert.equal(again.json().code,'MATERIAL_DISCOVERY_BINDING_REQUIRED');
  assert.equal(again.json().items,undefined);
 }finally{await h.app.close();}
});
