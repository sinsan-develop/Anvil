import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const old=await readFile(new URL('../../../db/migrations/0022_execution_grant_revocation.sql',import.meta.url),'utf8');
const sql=await readFile(new URL('../../../db/migrations/0096_normal_grant_revocation.sql.pending',import.meta.url),'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
const functionOf=(s:string)=>s.slice(s.indexOf('CREATE FUNCTION anvil.check_execution_grant_revocation('),s.indexOf('CREATE FUNCTION anvil.guard_execution_grant_revocation()')).trim();
test('forward는 원 signature 함수만 교체하며 기존 synthetic 본문과 모든 guard를 보존한다(정적)',()=>{
 assert(sql.includes('CREATE OR REPLACE FUNCTION anvil.check_execution_grant_revocation(pid uuid,cid uuid,row_json jsonb)'));
 let restored=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION')).trim().replace('CREATE OR REPLACE FUNCTION','CREATE FUNCTION');
 restored=restored.replace(/-- NORMAL ONLY BEGIN[\s\S]*?-- NORMAL ONLY END\n/g,'');
 for(const [expression,original] of [
  ["(CASE WHEN normal THEN 'NORMAL_PROTECTED' ELSE 'SYNTHETIC_ONLY' END)","'SYNTHETIC_ONLY'"],
  ["(CASE WHEN normal THEN 'NORMAL_REVOCATION_STORED' ELSE 'SYNTHETIC_REVOCATION_STORED' END)","'SYNTHETIC_REVOCATION_STORED'"],
  ["(CASE WHEN normal THEN 'NORMAL_GRANT_REVOCATION_STORED' ELSE 'SYNTHETIC_GRANT_REVOCATION_STORED' END)","'SYNTHETIC_GRANT_REVOCATION_STORED'"]] as const)restored=restored.split(expression).join(original);
 assert.equal(restored.replace(/\r/g,''),functionOf(old).replace(/\r/g,''));
 assert.equal((sql.match(/CREATE OR REPLACE FUNCTION/g)??[]).length,1);
 assert(!/\b(?:GRANT|CREATE TABLE|ALTER TABLE|DROP|DISABLE TRIGGER)\b/.test(sql));
});
test('normal 분기는 정확 원 grant fact/scope digest·실행 최신세대 검산이며 원주체 현재 로그인이나 OS를 추가하지 않는다(정적)',()=>{
 for(const term of ["s->>'transport'='NORMAL_PROTECTED'","g.snapshot_json->>'factHash'","g.snapshot_json->>'scopeDigest'","g.snapshot_json->>'state' IS DISTINCT FROM 'GRANTED'","max(e.generation)","g.snapshot_json->'binding'->'subject'","g.snapshot_json->'binding'->'intent'->'sourceScopes'"])assert(sql.includes(term),term);
 assert(sql.includes('FOR UPDATE'));assert(sql.includes("c.approval_consumption_id IS NOT NULL"));assert(sql.includes("m.participation='OWNER'"));
 assert(sql.includes('grant_revocation_policy_deadline'));assert(sql.includes('>=100'));assert(sql.includes('>2097152'));
 assert(!/normal_exchange_current|osFence|credential_revocation|UPDATE anvil\./.test(sql));
});
