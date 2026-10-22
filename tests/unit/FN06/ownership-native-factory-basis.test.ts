import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {PoolClient} from 'pg';
import {ownershipPreparationReceiptFixture} from './ownership-preparation-receipt-fixture.ts';
const moduleValue=await import(new URL('../../../apps/server/modules/executions/ownership-native-factory-basis.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const id=(n:number)=>`80000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function fixture(){
 const f=await ownershipPreparationReceiptFixture(),p=f.prep.snapshot,rows:any[]=[],queries:string[]=[];let mode='',reads=0;
 const ref={id:id(7),version:1,contentHash:'a'.repeat(64)};
 const claim=()=>({project_id:p.scope.projectId,id:id(1),execution_id:p.scope.executionId,generation:1,grant_id:id(2),grant_version:1,scope_json:[{sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/app.ts',kind:'FILE',access:'READ',recursive:false}]}],expires_at:new Date(f.now.getTime()-1),ownership_state:'SYNTHETIC_CLAIM',created_command_id:id(3),issued_at:new Date(f.now.getTime()-100),reclaimed_at:null});
 const db={async query(sql:string,args:any[]=[]){queries.push(sql);if(sql.includes('FROM anvil.writer_claims')){assert.deepEqual(args,[p.scope.projectId]);reads++;if(mode==='REVOKE')Object.assign(f.row,{revoked_at:f.now});if(reads===2&&mode==='CHANGE')rows[0].created_command_id=id(99);if(reads===2&&mode==='LATE')f.late();return{rows:structuredClone(rows)};}return f.db.query(sql,args);}} as unknown as PoolClient;
 const read=(source:PoolClient=db,scope:unknown=p.scope,prepRef:unknown=f.prep.ref)=>{assert.equal(typeof moduleValue.readOwnershipNativeFactoryBasis,'function','native factory 선행에 원 writer history 연결이 필요하다');return moduleValue.readOwnershipNativeFactoryBasis(source,f.access,f.token,f.csrf,scope,prepRef);};
 return{...f,rows,claim,db,read,queries,mode(value:string){mode=value;},reads(){return reads;}};
}
test('빈/회수된 원 claim 이력을 읽어도 실제 NONE·factory 준비 권한은 아니다',async()=>{
 for(const reclaimed of [false,true]){const f=await fixture();if(reclaimed)f.rows.push({...f.claim(),reclaimed_at:f.now});const v=await f.read();assert.equal(v.purpose,'OWNERSHIP_NATIVE_FACTORY_BASIS_ONLY');assert.equal(v.writerState,'UNKNOWN');assert.equal(v.actualWriterAbsenceVerified,false);assert.equal(v.hasUnreclaimedClaim,false);assert.equal(v.recordedClaimCount,reclaimed?1:0);assert.equal(f.reads(),2);assert.equal(v.selection.projectId,f.prep.snapshot.scope.projectId);
 for(const key of ['factoryReady','processCreationAuthorized','preparationAuthorized','executionAuthorized','dispatchPerformed'])assert.equal(v[key],false);assert(v.missingEvidence.includes('ACTUAL_EXCLUSIVE_WRITER_AUTHORITY'));assert(v.missingEvidence.includes('AUTHENTICATED_NATIVE_CHANNEL'));assert(f.queries.every(sql=>! /^(BEGIN|COMMIT|ROLLBACK|INSERT|UPDATE|DELETE|SELECT set_config)/.test(sql)));}
});
test('이미 만료된 미회수 claim도 native factory 선행을 차단한다',async()=>{const f=await fixture();f.rows.push(f.claim());await assert.rejects(f.read(),{message:'OWNERSHIP_NATIVE_FACTORY_BASIS_UNAVAILABLE'});assert.equal(f.reads(),1);});
test('전후 원 이력 변화·인증 회수·만료·타 project는 거절한다',async()=>{
 for(const mode of ['CHANGE','REVOKE','LATE']){const f=await fixture();f.rows.push({...f.claim(),reclaimed_at:f.now});f.mode(mode);await assert.rejects(f.read(),{message:'OWNERSHIP_NATIVE_FACTORY_BASIS_UNAVAILABLE'});}
 const bad=await fixture();bad.rows.push({...bad.claim(),project_id:id(99)});await assert.rejects(bad.read(),{message:'OWNERSHIP_NATIVE_FACTORY_BASIS_UNAVAILABLE'});
 const extra=await fixture();await assert.rejects(extra.read(extra.db,{...extra.prep.snapshot.scope,writerState:'NONE'}),{message:'OWNERSHIP_NATIVE_FACTORY_BASIS_UNAVAILABLE'});
});
test('await 중 caller scope/ref 변경은 고정 선택을 바꾸지 못한다',async()=>{
 const f=await fixture(),scope=structuredClone(f.prep.snapshot.scope),ref=structuredClone(f.prep.ref);let changed=false;
 const db={async query(sql:string,args:any[]=[]){if(!changed){changed=true;scope.projectId='changed';ref.contentHash='changed';}return f.db.query(sql,args);}} as unknown as PoolClient;
 const v=await f.read(db,scope,ref);assert.equal(v.selection.projectId,f.prep.snapshot.scope.projectId);assert.equal(v.selection.preparationHash,f.prep.ref.contentHash);
});
