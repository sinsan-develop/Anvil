import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
// 생성된 SQL 상수 자료의 교차 검수다. SQL 파싱/함수/trigger 실행 증거가 아니다.
async function mapping(){const sql=await readFile(new URL('../../../db/migrations/0008_source_read_observation.sql',import.meta.url),'utf8'),encoded=sql.split('$a3_unicode17$');assert.equal(encoded.length,3,'SQL draft Unicode mapping artifact missing');return JSON.parse(encoded[1]!) as Record<string,string>;}
test('SQL 초안의 생성 Unicode 자료는 Node 대문자 충돌·확장·보충평면 벡터와 일치한다',async()=>{const m=await mapping(),fold=(v:string)=>[...v].map(c=>m[c]??c).join('');for(const [a,b,want] of [['straße.ts','STRASSE.ts','STRASSE.TS'],['ﬃ.ts','FFI.ts','FFI.TS'],['ı.ts','I.ts','I.TS'],['ς.ts','σ.ts','Σ.TS'],['𐐨.ts','𐐀.ts','𐐀.TS']]){assert.equal(fold(a!),want);assert.equal(fold(b!),want);}assert.notEqual(fold('é.ts'),fold('e.ts'));});
test('생성 자료는 모든 Unicode scalar의 Node uppercase와 대조하며 locale에 의존하지 않는다',async()=>{const m=await mapping();for(let i=1;i<=0x10ffff;i++){if(i>=0xd800&&i<=0xdfff)continue;const c=String.fromCodePoint(i);assert.equal(m[c]??c,c.toUpperCase(),`U+${i.toString(16)}`);}});
