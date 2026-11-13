import test from 'node:test';
import assert from 'node:assert/strict';
import inject from 'light-my-request';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {canonicalJson} from '../../../contracts/canonical.ts';
import {executionChallengeRequestBytes,executionProofBytes,executionTarget} from '../../../apps/server/modules/executions/execution-proof.ts';
import {NormalCredentialBootstrapClient,type NormalOwnedCredentialPort} from '../../../apps/connector/runtime/normal-credential-bootstrap-client.ts';
import {NormalProtectedGetClient} from '../../../apps/connector/runtime/normal-protected-get-client.ts';
import {journey,type PageSqlAdapter} from './normal-request-challenge-fixture.ts';
const {NormalPageCursors}=await import('../../../apps/server/modules/executions/normal-command-pages.ts');
const hash=(v:any)=>createHash('sha256').update(typeof v==='string'?v:canonicalJson(v)).digest('hex');
// native 실행이 아니다. owned pipe/DPAPI/HTTPS는 RAM 대역이고 서버 START/교환/페이지 핸들러는 실제 제품이다.
test('실제 START 예약→최초 교환→보호 슬롯→평문 없는 GET client→원명령 조회',async()=>{
 let port!:NormalOwnedCredentialPort,hostCalls=0,closes=0,secret='',metadata:any,grant:any,scope:any,opened=0;
 const transcript:any[]=[],files=new Map<string,any>(),prepared=new Map<string,any>();
 let hook:any,requestFailure:unknown;
 const sql:PageSqlAdapter=(s,a,{f,drafts,issued})=>{
  if(s.startsWith('SELECT v.content_hash AS vhash')){const v=drafts.find(v=>v.id===a[3]&&v.version===2),r=issued.find(r=>r.challenge_id===a[3]);return {rows:v?[{vhash:v.content_hash,consumed:v.snapshot_json,id:r?.id,content_hash:r?.content_hash,receipt:r?.snapshot_json}]:[]};}
  if(s.startsWith('SELECT * FROM anvil.normal_command_page_rows'))return {rows:f.tables.execution_commands!.filter(x=>x.project_id===a[0]&&x.execution_id===a[1]&&x.grant_id===a[2]&&x.grant_version===a[3]&&x.generation===a[4]).map(x=>{
   const audit=f.audits.get(x.created_command_id)!,out=f.tables.delivery_outbox!.find(o=>o.command_id===x.created_command_id)!;
   assert.equal(out.payload_ref.envelopeHash,x.envelope_hash);assert.equal(out.payload_ref.grantRef.id,x.grant_id);assert.equal(out.payload_ref.grantRef.version,x.grant_version);
   return {sequence:String(audit.server_sequence),valid:true,command_ref:{id:x.id,version:x.version,contentHash:x.content_hash},envelope_hash:x.envelope_hash,envelope:x.snapshot_json.envelope};
  })};
  if(s.startsWith('SELECT * FROM anvil.normal_start_material_rows'))return {rows:f.tables.execution_commands!.filter(x=>a[1].includes(x.id)).map(x=>{
   const m=f.tables.execution_material_manifests!.find(m=>m.created_command_id===x.created_command_id)!;
   return {command_record_id:x.id,manifest_ref:{id:m.id,version:1,contentHash:m.content_hash},manifest:m.snapshot_json,materials:f.tables.execution_materials!.filter(p=>p.manifest_id===m.id).map(p=>({ref:{id:p.id,version:1,contentHash:p.content_hash},snapshot:p.snapshot_json}))};
  })};
  if(s.startsWith('INSERT INTO anvil.execution_receipts(')&&JSON.parse(a[6]).kind==='NORMAL_COMMAND_PAGE'){issued.push({id:a[1],content_hash:a[5],challenge_id:a[4],snapshot_json:JSON.parse(a[6])});return {rows:[],rowCount:1};}
  return undefined;
 };
 async function http(method:string,path:string,body:string|null,auth?:string,token?:string){
  const response=await inject((q,r)=>{Object.defineProperty(q.socket,'encrypted',{value:true});hook.app.routing(q,r);},
   {method:method as any,url:path,payload:body??undefined,headers:{host:'anvil-synthetic.invalid',...(body!==null?{'content-type':'application/json'}:{}),...(auth?{'anvil-execution-auth':auth}:{}),...(token?{authorization:'Bearer '+token}:{})}});
  assert.equal(response.statusCode,200,response.body);return response.json();
 }
 const h=await journey({sql,cursors:new NormalPageCursors(randomBytes(32))},undefined,undefined,undefined,async ctx=>{
  hook=ctx;grant=ctx.f.tables.execution_grants![0]!.snapshot_json;scope={projectId:ctx.f.pid,connectorId:ctx.f.registration!.row.connector_id,executionId:ctx.request.target.path.split('/')[6],
   executionGeneration:grant.binding.executionGeneration,grantRef:ctx.request.grantRef,credentialGeneration:grant.binding.executionCredentialReservation.generation};
  assert.equal(scope.executionGeneration,1);assert.equal(grant.binding.subject.credentialGeneration,3);
  const base='/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId;
  const host={async open(signal:AbortSignal){assert.equal(signal.aborted,false);opened++;let output:Buffer|undefined,offset=0,handle='',outHash='';
   function chunk(v?:any){if(v!==undefined){output=Buffer.from(canonicalJson(v));offset=0;handle=randomUUID();outHash=hash(output!.toString());}const at=offset;offset=Math.min(output!.length,offset+48000);return {handle,offset:at,total:output!.length,hash:outHash,expiresAt:metadata.expiresAt,bytes:output!.subarray(at,offset).toString('base64url'),done:offset===output!.length};}
   return {async send(op:string,p:any){
    hostCalls++;transcript.push([op,structuredClone(p)]);
    if(op==='NORMAL_EXECUTION_BOOTSTRAP'){
     assert.equal('grantSnapshot' in p,false);assert.deepEqual(p.scope,scope);
     const request=ctx.request;
     const first=await http('POST',base+'/challenges',canonicalJson({...request,signature:ctx.signBytes(executionChallengeRequestBytes('EXECUTION',request))}));
     const c=first.challenge;assert.deepEqual(c.grantRef,scope.grantRef);assert.equal(c.scopeDigest,grant.scopeDigest);
     const reservation=ctx.f.tables.execution_credentials![0]!,b=first.bootstrapBinding;
     assert.deepEqual(b,{...scope,scopeDigest:c.scopeDigest,registrationRef:reservation.snapshot_json.registrationRef,
      reservationRef:{id:reservation.id,version:1,contentHash:reservation.content_hash},
      publicKeyFingerprint:ctx.f.registration!.connector.host_fingerprint,checkedAt:ctx.store.now().toISOString(),expiresAt:c.expiresAt});
     assert.notEqual(b.reservationRef.id,grant.binding.budgetReservationRef.id);
     const proof={requestId:c.requestId,grantRef:c.grantRef,credentialGeneration:c.credentialGeneration,scopeDigest:c.scopeDigest,serverNonce:c.serverNonce,clientNonce:c.clientNonce,expiresAt:c.expiresAt};
     const auth=Buffer.from(canonicalJson({schemaVersion:1,challengeRef:first.ref,proof,signature:ctx.signBytes(executionProofBytes('EXECUTION_CREDENTIAL_EXCHANGE',proof))})).toString('base64url');
     const issued=await http('POST',base+'/credential-exchange','{}',auth);secret=issued.credential;
     assert.equal(files.size,0);files.set('normal-slot',{...issued,scope});assert.equal(files.get('normal-slot').credential,secret);
     metadata={slotId:scope.grantRef.id,receiptRef:issued.receiptRef,scope,origin:'https://anvil-synthetic.invalid',expiresAt:issued.expiresAt,caHash:hash('RAM CA')};return metadata;
    }
    if(op==='NORMAL_EXECUTION_READ'){assert.equal(p.handle,handle);assert.equal(p.offset,offset);return chunk();}
    assert.equal(op,'NORMAL_EXECUTION_CALL');assert.equal(p.slotId,metadata.slotId);
    const r=p.request;if(p.kind==='PREPARE'){
     const q=[...new URLSearchParams(r.query)] as [string,string][];
     const target=executionTarget(r.method,r.path,q,p.body),req={requestId:randomUUID(),purpose:'EXECUTION_REQUEST',grantRef:scope.grantRef,credentialGeneration:scope.credentialGeneration,target,clientNonce:randomBytes(32).toString('base64url'),issuedAt:ctx.store.now().toISOString()};
     const first=await http('POST',base+'/challenges',canonicalJson({...req,signature:ctx.signBytes(executionChallengeRequestBytes('EXECUTION',req))}),undefined,files.get('normal-slot').credential);
     assert.equal('bootstrapBinding' in first,false,'일반 REQUEST 응답 계약은 불변');
     const c=first.challenge,proof={requestId:req.requestId,...target,grantRef:scope.grantRef,credentialGeneration:scope.credentialGeneration,serverNonce:c.serverNonce};
     const auth=Buffer.from(canonicalJson({schemaVersion:1,challengeRef:first.ref,proof,signature:ctx.signBytes(executionProofBytes('EXECUTION_REQUEST_PROOF',proof))})).toString('base64url');
     prepared.set(auth,{path:r.path,query:r.query,body:p.body});return chunk({path:r.path,query:r.query,auth,challengeRef:first.ref,requestId:req.requestId,expiresAt:c.expiresAt});
    }
    assert.deepEqual(prepared.get(r.auth),{path:r.path,query:r.query,body:p.body});
    try{return chunk(await http(r.method,r.path+r.query,p.body,r.auth,files.get('normal-slot').credential));}catch(e){requestFailure=e;throw e;}
   },async close(){closes++;output?.fill(0);return {state:'CLOSED_CONFIRMED'};}};
  }};
  const client=new NormalCredentialBootstrapClient({attemptId:randomUUID(),origin:'https://anvil-synthetic.invalid',ca:'RAM CA',scope},{host,now:()=>ctx.store.now().getTime()});
  port=await client.bootstrap(new AbortController().signal);
  assert.equal('credential' in port.metadata,false);
  // 이 return은 기존 서버 fixture만 사용하는 RAM 값이며 제품 port에는 평문 반환 경로가 없다.
  return {receiptRef:metadata.receiptRef,credential:secret,expiresAt:metadata.expiresAt};
 });
 try{
  const client=new NormalProtectedGetClient({origin:metadata.origin,ca:'RAM CA',scope,credentialExpiresAt:metadata.expiresAt},{protectedCredential:port,now:()=>h.store.now().getTime()});
  const packet=await client.prepareCommandPage({afterSequence:0,waitMs:0},new AbortController().signal);
  const page=await client.send(packet,new AbortController().signal).catch(e=>{throw requestFailure??e;});
  assert.equal(page.items.length,1);assert.equal(page.items[0]!.envelope.operation,'START_SESSION');
  assert.equal(h.store.receipts().filter(v=>v.snapshot_json.kind==='NORMAL_CREDENTIAL_ISSUED').length,1);
  assert.equal(opened,3);assert.equal(closes,3);assert.ok(hostCalls<64);
  assert.equal(JSON.stringify(transcript).includes(secret),false);
  assert.throws(()=>new NormalProtectedGetClient({origin:metadata.origin,ca:'RAM CA',scope:{...scope,credentialGeneration:2},credentialExpiresAt:metadata.expiresAt},{protectedCredential:port}));
  assert.throws(()=>new NormalProtectedGetClient({origin:metadata.origin,ca:'OTHER CA',scope,credentialExpiresAt:metadata.expiresAt},{protectedCredential:port}));
  h.store.mode.revoked=true;await assert.rejects(()=>client.prepareCommandPage({afterSequence:0,waitMs:0},new AbortController().signal));
 }finally{await h.app.close();files.clear();secret='';}
});
