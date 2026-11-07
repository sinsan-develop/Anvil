import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const path=new URL('../../../db/migrations/0071_native_preparation_authority.sql.pending',import.meta.url);

test('native 감사 fullref 비교식은 문자열 밖 괄호가 대응한다',async()=>{
 const sql=await readFile(path,'utf8');
 const start=sql.indexOf('CREATE FUNCTION anvil.native_preparation_authority_complete('),end=sql.indexOf('END;$$;',start);
 assert(start>=0&&end>start);
 const lines=sql.slice(start,end).split('\n').filter(line=>line.startsWith(" IF g->'parent'->'auditRef' IS DISTINCT FROM "));
 assert.equal(lines.length,1);
 const expression=lines[0]!.replace(/'(?:''|[^'])*'/g,"''");
 let depth=0;
 for(const char of expression){if(char==='(')depth++;else if(char===')')depth--;assert(depth>=0,'감사식에 대응하는 열기 없는 닫는 괄호가 있다');}
 assert.equal(depth,0,'감사식의 모든 호출 괄호가 닫혀야 한다');
});

test('native SQL은 감사식 닫기 한 문자 외 부모 raw·필드·guard·ACL을 보존한다',async()=>{
 const bytes=await readFile(path),sql=bytes.toString('utf8');
 const fixed="'correctionOf',au.correction_of))) THEN RETURN false;END IF;";
 assert.equal(sql.split(fixed).length,2);
 const restored=sql.replace(fixed,()=>"'correctionOf',au.correction_of)))) THEN RETURN false;END IF;");
 assert.equal(bytes.length,40917);assert.equal(Buffer.byteLength(restored),40918);
 assert.equal(createHash('sha256').update(restored,'utf8').digest('hex'),'11dce811b5b912e51348db8c7f17970c9edb391e6b4c895b88e0e34aed5c0da4');
 assert.equal((sql.match(/^BEGIN;/gm)||[]).length,1);assert.equal((sql.match(/^COMMIT;/gm)||[]).length,1);assert(sql.endsWith('COMMIT;\n'));
});
