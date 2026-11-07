import test from 'node:test';
import assert from 'node:assert/strict';
import {assertJourneyLedgerProjection} from '../../integration/IX01/journey-ledger-projection.ts';
const rows=()=>Array.from({length:105},(_,i)=>({id:String(i).padStart(4,'0')+'_ix01_schema',checksum:i.toString(16).padStart(64,'0')}));
const rejected=(got:unknown,expected:unknown)=>assert.throws(()=>assertJourneyLedgerProjection(got,expected),{message:'IX01_LEDGER_PROJECTION_INVALID'});

test('원장105 정확집합은 DB순서/객체키순서와 무관하고 입력을 변경하지 않는다',()=>{
 const expected=rows(),got=expected.map(({id,checksum})=>({checksum,id})).reverse(),before=JSON.stringify({got,expected});
 assert.equal(assertJourneyLedgerProjection(got,expected),true);assert.equal(JSON.stringify({got,expected}),before);
 const ordered=rows();ordered[0]!.id='0003_documents';ordered[1]!.id='0003_document_stage_bindings';assert.equal(assertJourneyLedgerProjection([...ordered].reverse(),ordered),true);
});
test('원장 누락/추가/중복/다른ID/checksum변조를 거절한다',()=>{
 const expected=rows();
 for(const got of [expected.slice(1),[...expected,expected[0]],[expected[0],...expected.slice(0,-1)],expected.map((r,i)=>i?r:{...r,id:'9999_other'}),expected.map((r,i)=>i?r:{...r,checksum:'f'.repeat(64)})])rejected(got,expected);
});
test('원장 exact2키/유효ID/소문자64hex 및105형상은 양쪽에 필수다',()=>{
 const expected=rows();
 const bad=[null,{},[],expected.map((r,i)=>i?r:{...r,extra:true}),expected.map((r,i)=>i?r:{id:r.id}),expected.map((r,i)=>i?r:{...r,id:'BAD/ID'}),expected.map((r,i)=>i?r:{...r,checksum:'F'.repeat(64)}),expected.map((r,i)=>i?r:{...r,checksum:null}),expected.map((r,i)=>i?r:[r.id,r.checksum]),expected.map((r,i)=>i?r:null)];
 for(const value of bad){rejected(value,expected);rejected(expected,value);}
});
test('동일자료라도 부족한105/중복집합은 합격으로 승격하지 않는다',()=>{
 const value=rows().slice(1);rejected(value,value);const duplicated=Array(105).fill(rows()[0]);rejected(duplicated,duplicated);
});
