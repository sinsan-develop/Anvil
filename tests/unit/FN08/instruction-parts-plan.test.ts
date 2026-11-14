import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
const module=await import('../../../apps/server/modules/executions/instruction-parts-plan.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;}) as any;
const hash=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');
const ref=(body:string)=>({artifactId:randomUUID(),bytes:Buffer.byteLength(body),contentHash:hash(body),mediaType:'text/plain;charset=utf-8'});
test('고정 부분계획은 원 UTF8 code point 경계를 지키며 동일 원문에서 같은 참조를 만든다',()=>{
 assert.equal(typeof module.instructionPartsPlan,'function');const body='a'.repeat(65535)+'한🙂뒤',bodyRef=ref(body),result=module.instructionPartsPlan(bodyRef,Buffer.from(body));
 assert.equal(result.plan.purpose,'INSTRUCTION_PARTS_PLAN');assert.equal(result.plan.algorithm,'UTF8_CODEPOINT_64K_V1');assert.deepEqual(result.plan.bodyRef,bodyRef);
 assert.deepEqual(result.plan.parts,[{partIndex:1,byteOffset:0,utf8Bytes:65535,contentHash:hash('a'.repeat(65535))},{partIndex:2,byteOffset:65535,utf8Bytes:10,contentHash:hash('한🙂뒤')}]);
 assert.deepEqual(result.partsRef,{id:bodyRef.artifactId,version:1,contentHash:result.partsRef.contentHash});assert.deepEqual(module.instructionPartsPlan(bodyRef,Buffer.from(body)),result);
});
test('부분계획은 빈/초과/손상 UTF8 및 body hash/bytes 변경을 거절한다',()=>{
 assert.equal(typeof module.instructionPartsPlan,'function');for(const body of ['', 'x'.repeat(2097153)])assert.throws(()=>module.instructionPartsPlan(ref(body),Buffer.from(body)),/INSTRUCTION_PARTS_UNAVAILABLE/);
 const damaged=Buffer.from([0xed,0xa0,0x80]);assert.throws(()=>module.instructionPartsPlan({artifactId:randomUUID(),bytes:3,contentHash:hash(damaged),mediaType:'text/plain;charset=utf-8'},damaged),/INSTRUCTION_PARTS_UNAVAILABLE/);
 const body='원문';for(const r of [{...ref(body),bytes:4},{...ref(body),contentHash:'0'.repeat(64)},{...ref(body),mediaType:'application/json'}])assert.throws(()=>module.instructionPartsPlan(r,Buffer.from(body)),/INSTRUCTION_PARTS_UNAVAILABLE/);
});
test('2MiB 정확 경계는 1 기반 32부분이며 계획 해시는 고정 canonical 원문을 사용한다',()=>{
 assert.equal(typeof module.instructionPartsPlan,'function');const body='x'.repeat(2097152),bodyRef=ref(body),result=module.instructionPartsPlan(bodyRef,Buffer.from(body));assert.equal(result.plan.parts.length,32);assert.equal(result.plan.parts.at(-1).byteOffset,31*65536);assert.equal(result.plan.parts.at(-1).utf8Bytes,65536);
 const r={artifactId:'00000000-0000-4000-8000-000000000001',bytes:1,contentHash:hash('a'),mediaType:'text/plain;charset=utf-8'};
 const expected='{"algorithm":"UTF8_CODEPOINT_64K_V1","bodyRef":{"artifactId":"00000000-0000-4000-8000-000000000001","bytes":1,"contentHash":"ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb","mediaType":"text/plain;charset=utf-8"},"limits":{"maxPartBytes":65536,"maxParts":200,"maxSourceBytes":2097152},"parts":[{"byteOffset":0,"contentHash":"ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb","partIndex":1,"utf8Bytes":1}],"purpose":"INSTRUCTION_PARTS_PLAN","schemaVersion":1}';
 assert.equal(module.instructionPartsPlan(r,Buffer.from('a')).partsRef.contentHash,hash(expected));
});
