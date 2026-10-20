import assert from 'node:assert/strict';
import test from 'node:test';
import {assertFn02QaManifest} from '../../../scripts/fn02-empty-application-manifest.ts';

const expected=Array.from({length:53},(_,i)=>({id:i===9?'0003_document_stage_bindings':i===10?'0003_documents':'qa_'+String(i).padStart(2,'0'),checksum:i.toString(16).padStart(64,'0')}));
test('DB collation과 Node locale 순서가 달라도 정확53개 ID/hash는 같은 manifest다',()=>{
  const actual=structuredClone(expected);[actual[9],actual[10]]=[actual[10]!,actual[9]!];
  assertFn02QaManifest(actual,expected);assert.equal(expected[9]!.id,'0003_document_stage_bindings');
});
test('순서와 별개로 hash 변조·누락·추가·중복·미지 ID는 거절한다',()=>{
  for(const mode of ['HASH','MISSING','EXTRA','DUPLICATE','ID']){
    const actual=structuredClone(expected);
    if(mode==='HASH')actual[0]!.checksum='f'.repeat(64);if(mode==='MISSING')actual.pop();if(mode==='EXTRA')actual.push({id:'extra',checksum:'a'.repeat(64)});
    if(mode==='DUPLICATE')actual[1]=actual[0]!;if(mode==='ID')actual[0]!.id='unregistered';
    assert.throws(()=>assertFn02QaManifest(actual,expected));
  }
});
test('기준 manifest 자체의 중복/지문 형식도 거절한다',()=>{
  const duplicate=structuredClone(expected);duplicate[1]=duplicate[0]!;assert.throws(()=>assertFn02QaManifest(expected,duplicate));
  const bad=structuredClone(expected);bad[0]!.checksum='not-a-hash';assert.throws(()=>assertFn02QaManifest(expected,bad));
});
