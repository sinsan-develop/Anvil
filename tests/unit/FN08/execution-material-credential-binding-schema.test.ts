import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const sql=readFileSync(new URL('../../../db/migrations/0079_material_credential_namespace_binding.sql.pending',import.meta.url),'utf8'),old=readFileSync(new URL('../../../db/migrations/0062_execution_material_registration.sql.pending',import.meta.url),'utf8');
function body(text:string){const start=text.indexOf('FUNCTION anvil.material_binding_complete('),from=text.indexOf('AS $$',start),end=text.indexOf('$$;',from+5);assert(start>=0&&from>start&&end>from);return text.slice(from+5,end);}
const h=(v:unknown)=>contentHash(canonicalJson(v));
test('0079는 원 함수 signature·owner·ACL을 보존하고 기존 proof 관계를 삭제하지 않는다',()=>{
 const clean=sql.replace(/--[^\n]*/g,'');assert.match(clean,/CREATE OR REPLACE FUNCTION anvil\.material_binding_complete\(pid uuid,rid uuid\) RETURNS boolean LANGUAGE plpgsql AS \$\$/);
 assert.equal((clean.match(/CREATE OR REPLACE FUNCTION/g)||[]).length,1);assert(!/GRANT |REVOKE |ALTER |DROP |CREATE TABLE|SECURITY DEFINER|INSERT INTO|UPDATE anvil\.|DELETE FROM|clock_timestamp|current_timestamp/i.test(clean));
 let restored=body(sql).replace('g anvil.execution_grants%ROWTYPE;ec anvil.execution_credentials%ROWTYPE;','');
 const from=restored.indexOf(' SELECT * INTO g FROM anvil.execution_grants'),to=restored.indexOf(' IF b.snapshot_json IS DISTINCT FROM',from);assert(from>0&&to>from);restored=restored.slice(0,from)+restored.slice(to);
 restored=restored.replace("OR NOT COALESCE((c.snapshot_json->'binding'-'credentialGeneration') @> (sc-'credentialGeneration'),false)",()=> "OR NOT COALESCE(c.snapshot_json->'binding' @> sc,false)");assert.equal(restored,body(old));
});
test('0079는 실제 같은 grant 예약 E와 원 자료 H·발급 이전 예약시각을 닫힌 식으로 검산한다',()=>{
 const b=body(sql);for(const part of ["g.content_hash IS DISTINCT FROM anvil.execution_json_hash(g.snapshot_json)","ec.content_hash IS DISTINCT FROM anvil.execution_json_hash(ec.snapshot_json)","sc->'credentialGeneration' IS DISTINCT FROM g.snapshot_json->'binding'->'subject'->'credentialGeneration'","sc->'credentialGeneration' IS DISTINCT FROM to_jsonb(d.credential_generation)","c.snapshot_json->'binding'->'credentialGeneration' IS DISTINCT FROM to_jsonb(ec.credential_generation)","c.snapshot_json->'publicChallenge'->'credentialGeneration' IS DISTINCT FROM to_jsonb(ec.credential_generation)","ec.snapshot_json->'grantRef' IS DISTINCT FROM sc->'grantRef'","(ec.snapshot_json->>'reservedAt')::timestamptz>(c.snapshot_json->'publicChallenge'->>'issuedAt')::timestamptz","credential_generation=1)<>1","'credentialIssued' IS DISTINCT FROM 'false'::jsonb"])assert(b.includes(part),part);
});
function model(raw:any){
 try{
  const {material,execution,grant,reservation,challenge}=raw,keys=['mode','projectId','connectorId','executionId','executionGeneration','grantRef'];
  return keys.every(k=>canonicalJson(material[k])===canonicalJson(execution[k]))&&material.credentialGeneration===grant.binding.subject.credentialGeneration&&reservation.contentHash===h(reservation.snapshot)&&canonicalJson(reservation.snapshot.grantRef)===canonicalJson(material.grantRef)&&reservation.snapshot.credentialGeneration===1&&execution.credentialGeneration===1&&challenge.binding.credentialGeneration===1&&challenge.publicChallenge.credentialGeneration===1&&reservation.snapshot.state==='SYNTHETIC_RESERVED_NO_TOKEN'&&reservation.snapshot.credentialIssued===false&&reservation.snapshot.executionAuthorized===false&&reservation.snapshot.dispatchPerformed===false&&Date.parse(reservation.snapshot.reservedAt)<=Date.parse(challenge.publicChallenge.issuedAt);
 }catch{return false;}
}
function tuple(H=3){const ref={id:'af080078-1111-4111-8111-000000000001',version:1,contentHash:'a'.repeat(64)},execution={mode:'EXECUTION',projectId:ref.id,connectorId:ref.id,executionId:ref.id,executionGeneration:1,grantRef:ref,credentialGeneration:1},snapshot={grantRef:ref,credentialGeneration:1,state:'SYNTHETIC_RESERVED_NO_TOKEN',reservedAt:'2026-11-06T00:00:00.000Z',credentialIssued:false,executionAuthorized:false,dispatchPerformed:false};return{material:{...execution,credentialGeneration:H},execution,grant:{binding:{subject:{credentialGeneration:H}}},reservation:{contentHash:h(snapshot),snapshot},challenge:{binding:{credentialGeneration:1},publicChallenge:{credentialGeneration:1,issuedAt:'2026-11-06T00:00:00.000Z'}}};}
test('두 namespace 합성모델은 H1/E1과 H3/E1을 보존하고 H/E치환·NULL·원 예약 후행을 거절한다',()=>{
 assert.equal(model(tuple(1)),true);assert.equal(model(tuple(3)),true);
 const prior=tuple();prior.reservation.snapshot.reservedAt='2026-11-05T23:59:59.999Z';prior.reservation.contentHash=h(prior.reservation.snapshot);assert.equal(model(prior),true);
 for(const mutate of [(r:any)=>r.material.credentialGeneration=1,(r:any)=>r.execution.credentialGeneration=3,(r:any)=>r.challenge.binding.credentialGeneration=3,(r:any)=>r.challenge.publicChallenge.credentialGeneration=null,(r:any)=>r.execution.connectorId='other',(r:any)=>r.reservation=null,(r:any)=>r.reservation.contentHash='f'.repeat(64),(r:any)=>{r.reservation.snapshot.credentialIssued=true;r.reservation.contentHash=h(r.reservation.snapshot);},(r:any)=>{r.reservation.snapshot.reservedAt='2026-11-06T00:00:00.001Z';r.reservation.contentHash=h(r.reservation.snapshot);}]){
  const r=tuple();mutate(r);assert.equal(model(r),false);
 }
});
