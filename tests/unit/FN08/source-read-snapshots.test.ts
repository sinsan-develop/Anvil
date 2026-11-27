import assert from 'node:assert/strict';import{test}from'node:test';
import {SourceReadProtocol} from '../../../apps/server/modules/connections/source-read-protocol.ts';
import {SourceReadRecords} from '../../../apps/server/modules/connections/source-read-records.ts';
import {protocolFixture} from './source-read-protocol-fixtures.ts';
const keyQuery='SELECT project_id,id,registration_id,public_key_spki FROM anvil.connectors WHERE project_id=$1 AND id=$2 AND registration_id=$3';

test('만료·회수·현재 connector 세대 증가와 프로젝트 보관 후에도 원 등록키의 역사 보고만 읽는다',async(t)=>{
 const{f,receipt,db,actor}=await stored(),records=new SourceReadRecords(f.scope.installationId);
 f.time.now=f.at(700000);f.stored.current=false;f.grant.revoked_at=f.at(4000);f.grant.revoke_command_id='11111111-1111-4111-8111-000000000081';
 f.registration.generation=f.scope.connectorRef.version+1;f.registration.state='REVOKED';f.registration.connector_state='REVOKED';f.registration.revoked_at=f.at(4000);f.registration.host_revoked_at=f.at(4000);f.stored.credential.revoked_at=f.at(4000);
 const query=db.query.bind(db),keys:any[][]=[];
 t.mock.method(db,'query',async(sql:string,args:any[]=[])=>{
  if(sql===keyQuery)keys.push(args);
  const result=await query(sql,args);
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members'))return{rows:result.rows.map((row:any)=>({...row,archived_at:f.at(5000)}))};
  return result;
 });
 const n=f.writes.length,v=await records.readSnapshot(db,actor,f.scope.projectId,receipt.snapshotRef.id);
 assert.deepEqual(keys,[[f.scope.projectId,f.scope.connectorRef.id,f.scope.registrationRef.id]]);
 assert.equal(v.rawAllowed,true);assert.deepEqual(v.snapshotRef,receipt.snapshotRef);assert.deepEqual(v.connectorRef,f.scope.connectorRef);
 assert.equal(v.report.signature,f.stored.snapshot.signature);assert.equal(v.osVerification,'UNVERIFIED');assert.equal(v.executionAuthorized,false);assert.equal(v.agentDispatchPerformed,false);assert.equal(f.writes.length,n);
 assert.equal(JSON.stringify(v).includes(f.spki),false);
});

test('원 등록 공개키의 부재·중복·타 scope·잘못된 P-256 또는 지문은 같은 고정503이며 쓰기0이다',async(t)=>{
 const other=protocolFixture().spki;
 for(const change of [(r:any)=>[],(r:any)=>[r,r],(r:any)=>[{...r,project_id:'11111111-1111-4111-8111-000000000099'}],(r:any)=>[{...r,id:'11111111-1111-4111-8111-000000000099'}],(r:any)=>[{...r,registration_id:'11111111-1111-4111-8111-000000000099'}],(r:any)=>[{...r,public_key_spki:null}],(r:any)=>[{...r,public_key_spki:'invalid'}],(r:any)=>[{...r,public_key_spki:other}]]){
  const{f,receipt,db,actor}=await stored(),query=db.query.bind(db),n=f.writes.length;
  t.mock.method(db,'query',async(sql:string,args:any[]=[])=>{const result=await query(sql,args);return sql===keyQuery?{rows:change(result.rows[0])}:result;});
  await assert.rejects(new SourceReadRecords(f.scope.installationId).readSnapshot(db,actor,f.scope.projectId,receipt.snapshotRef.id),(e:any)=>e.message==='SOURCE_READ_INTEGRITY_FAILED'&&e.statusCode===503);
  assert.equal(f.writes.length,n);
 }
});

test('VIEWER는 원 서명이 검산되어도 보존 SPKI와 등록 주체를 받지 않는다',async()=>{
 const{f,receipt,db,actor}=await stored();f.stored.viewer=true;
 const v=await new SourceReadRecords(f.scope.installationId).readSnapshot(db,actor,f.scope.projectId,receipt.snapshotRef.id);
 assert.equal(v.rawAllowed,false);
 for(const key of ['report','public_key_spki','publicKeySpki','hostFingerprint','registrationRef','userId','clientId'])assert.equal(Object.hasOwn(v,key),false);
 assert.equal(JSON.stringify(v).includes(f.spki),false);assert.equal(JSON.stringify(v).includes(f.stored.snapshot.signature),false);
});

test('보관 보고의 두 서명 사본을 같은 정규형으로 변조해도 OWNER·VIEWER 모두 고정503으로 거절한다',async()=>{
 for(const viewer of [false,true]){
  const{f,receipt,db,actor}=await stored();f.stored.viewer=viewer;
  const bytes=Buffer.from(f.stored.snapshot.signature,'base64url');bytes[0]=bytes[0]!^1;
  const signature=bytes.toString('base64url');assert.equal(Buffer.from(signature,'base64url').length,64);
  f.stored.snapshot.signature=signature;f.stored.snapshot.report_json.signature=signature;
  const n=f.writes.length;
  await assert.rejects(new SourceReadRecords(f.scope.installationId).readSnapshot(db,actor,f.scope.projectId,receipt.snapshotRef.id),(e:any)=>e.message==='SOURCE_READ_INTEGRITY_FAILED'&&e.statusCode===503);
  assert.equal(f.writes.length,n);
 }
});
async function stored(){const f=protocolFixture(),s=new SourceReadProtocol(f.access),cid=f.scope.connectorRef.id,gid=f.grantRef.id,c=await s.exchange(cid,gid,{step:'CHALLENGE',preflight:f.preflight,signature:f.signed(f.preflight)}),token=await s.exchange(cid,gid,{step:'ISSUE',challengeId:c.challenge.id,payload:c.challenge.payload,signature:f.signed(c.challenge.payload)});f.time.now=f.at(3000);const receipt=await s.report(cid,gid,token.credential,f.report()),db=await f.access.pool.connect(),actor={actorId:f.scope.userId,clientId:f.scope.clientId,credentialGeneration:2,reauthUntil:null,serverOwner:false};return{f,receipt,db,actor};}
test('보관 보고의 OWNER 조회는 exact snapshot/hash를 보존하고 과거 회수를 숨기거나 OS로 승격하지 않는다',async()=>{const{f,receipt,db,actor}=await stored(),records=new SourceReadRecords(f.scope.installationId);assert.equal(typeof records.readSnapshot,'function');f.grant.revoked_at=f.at(3000);f.grant.revoke_command_id='11111111-1111-4111-8111-000000000081';const n=f.writes.length,v=await records.readSnapshot(db,actor,f.scope.projectId,receipt.snapshotRef.id);assert.equal(v.rawAllowed,true);assert.deepEqual(v.snapshotRef,receipt.snapshotRef);assert.equal(v.report.root.facts?.canonicalPath,'D:\\Synthetic A3\\한글');assert.equal(v.evidenceClass,'CONNECTOR_REPORTED');assert.equal(v.osVerification,'UNVERIFIED');assert.equal(v.executionAuthorized,false);assert.equal(f.writes.length,n);});
test('VIEWER 보관 보고는 메타데이터만 받고 원 경로·파일목록·서명/주체를 받지 않는다',async()=>{const{f,receipt,db,actor}=await stored(),records=new SourceReadRecords(f.scope.installationId);assert.equal(typeof records.readSnapshot,'function');f.stored.viewer=true;const n=f.writes.length,v=await records.readSnapshot(db,actor,f.scope.projectId,receipt.snapshotRef.id);assert.equal(v.rawAllowed,false);assert.equal(v.observedSummary.total,1);for(const key of ['report','root','files','signature','scope','reason','userId','clientId'])assert.equal(Object.hasOwn(v,key),false);assert.equal(JSON.stringify(v).includes('Synthetic'),false);assert.equal(f.writes.length,n);});
test('보관 report 행의 원문/hash·다른 project 귀속 불일치는 고정503이며 원문을 반사하지 않는다',async()=>{for(const mutate of [(r:any)=>r.content_hash='f'.repeat(64),(r:any)=>r.report_json.root.facts.canonicalPath='D:\\altered',(r:any)=>r.project_id='11111111-1111-4111-8111-000000000099']){const{f,receipt,db,actor}=await stored(),records=new SourceReadRecords(f.scope.installationId);assert.equal(typeof records.readSnapshot,'function');mutate(f.stored.snapshot);const n=f.writes.length;await assert.rejects(records.readSnapshot(db,actor,f.scope.projectId,receipt.snapshotRef.id),(e:any)=>e.message==='SOURCE_READ_INTEGRITY_FAILED'&&e.statusCode===503);assert.equal(f.writes.length,n);}});
