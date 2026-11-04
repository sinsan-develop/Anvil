import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// 정적 의존/원문 보존만 검산한다. PG parser나 digest 결과의 동등성 실행 증거가 아니다.
const raw=await readFile(new URL('../../../db/migrations/0039_ownership_authority.sql.pending',import.meta.url));
const source=raw.toString('utf8');
const replacements=[
 ["digest(convert_to(anvil.execution_authority_canonical(v),'UTF8'),'sha256')","pg_catalog.sha256(convert_to(anvil.execution_authority_canonical(v),'UTF8'))"],
 ["digest(decode(translate(report->>'nonce','-_','+/')||'=','base64'),'sha256')","pg_catalog.sha256(decode(translate(report->>'nonce','-_','+/')||'=','base64'))"],
] as const;

test('ownership SQL 해시는 별도 확장 없는 두 pg_catalog SHA256 의존만 소비한다',()=>{
 const calls=[...source.matchAll(/\b(?:pg_catalog\.)?(?:digest|sha256)\s*\(/g)].map(m=>m[0]);
 assert.deepEqual(calls,['pg_catalog.sha256(','pg_catalog.sha256(']);
 assert.doesNotMatch(source,/CREATE\s+EXTENSION|SET\s+(?:LOCAL\s+)?search_path/i);
});

test('해시 의존 두 곳 외 canonical·nonce·hex·guard·DDL·ACL raw는 원본 그대로다',()=>{
 let restored=source;
 for(const [before,after]of replacements){
  const oldCount=restored.split(before).length-1,newCount=restored.split(after).length-1;
  assert.equal(oldCount+newCount,1,'각 원문 해시 식이 정확 한 번 있어야 한다');
  restored=restored.replace(after,before);
 }
 assert.equal(createHash('sha256').update(Buffer.from(restored,'utf8')).digest('hex'),'cc5835077567d9108a909029fcbf5dfa69f110a0b947fdb5c078d12b6f7e2da7');
});
