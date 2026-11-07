import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {sentResponseBasisFixture} from './sent-response-basis-fixture.ts';
import {challengeCurrentReadFixture} from './challenge-current-read-fixture.ts';
test('실제 ChallengeStore readonly 포트도 같은 project 잠금·회수 거절을 유지하고 예약 쓰기를 하지 않는다',async()=>{
 const f=challengeCurrentReadFixture(true);await assert.rejects(f.run(),{message:'EXECUTION_GRANT_REVOKED'});assert.equal(f.keys.count,0);assert(!f.queries.some(s=>s.startsWith('INSERT')));
 const lock=f.queries.findIndex(s=>s.startsWith('SELECT id FROM anvil.projects')),check=f.queries.findIndex(s=>s.includes('execution_grant_revocations'));assert(lock>=0&&check>lock);
});
test('기존 credential 예약만 정확히 SELECT하고 부재/중복/변조·다른 scope는 생성 없이 거절한다',async()=>{
 const f=await sentResponseBasisFixture(),scope=f.f.scope,at=f.f.basis.fact.checkedAt;
 const snapshot={transport:'SYNTHETIC_ONLY',state:'SYNTHETIC_RESERVED_NO_TOKEN',grantRef:scope.grantRef,credentialGeneration:1,reservedAt:at,credentialIssued:false,executionAuthorized:false,dispatchPerformed:false};
 const row={project_id:scope.projectId,grant_id:scope.grantRef.id,grant_version:1,credential_generation:1,content_hash:contentHash(canonicalJson(snapshot)),snapshot_json:snapshot};
 const m=await import('../../../apps/server/modules/executions/execution-credential-reservation-read.ts');
 for(const mode of ['OK','DATE','MISSING','DUPLICATE','HASH','SCOPE','ISSUED','FUTURE','GENERATION']){
  const value:any=structuredClone(row);if(mode==='HASH')value.content_hash='0'.repeat(64);if(mode==='SCOPE')value.grant_id=crypto.randomUUID();
  if(mode==='DATE')value.created_at=new Date(at);
  if(mode==='ISSUED'){value.snapshot_json.credentialIssued=true;value.content_hash=contentHash(canonicalJson(value.snapshot_json));}
  if(mode==='FUTURE'){value.snapshot_json.reservedAt=new Date(Date.parse(at)+1).toISOString();value.content_hash=contentHash(canonicalJson(value.snapshot_json));}
  if(mode==='GENERATION'){value.snapshot_json.credentialGeneration=2;value.content_hash=contentHash(canonicalJson(value.snapshot_json));}
  const queries:string[]=[],db:any={query:async(sql:string,params:unknown[])=>{queries.push(sql);assert.deepEqual(params,[scope.projectId,scope.grantRef.id,scope.grantRef.version]);return{rows:mode==='MISSING'?[]:mode==='DUPLICATE'?[value,value]:[value]};}};
  if(mode==='OK'||mode==='DATE'){const read=await m.readExistingSyntheticCredentialReservation(db,scope,at);assert.deepEqual(read.snapshot_json,snapshot);assert.equal(read.content_hash,row.content_hash);}
  else await assert.rejects(m.readExistingSyntheticCredentialReservation(db,scope,at),{message:'SYNTHETIC_CREDENTIAL_RESERVATION_UNAVAILABLE'});
  assert.equal(queries.length,1);assert(queries.every(s=>s.startsWith('SELECT * FROM anvil.execution_credentials')));
 }
});
