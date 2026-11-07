import assert from 'node:assert/strict';
export interface Fn02QaMigration {id:string;checksum:string}
/** 실제 적용 순서는 호출자의 고정 배열로 관리하고, DB 조회 행의 순서는 별도다. */
export function assertFn02QaManifest(actual:Fn02QaMigration[],expected:Fn02QaMigration[]){
 for(const rows of [actual,expected]){
  assert.equal(rows.length,53,'FN02_QA_MANIFEST_COUNT_INVALID');
  assert.equal(new Set(rows.map(r=>r.id)).size,53,'FN02_QA_MANIFEST_DUPLICATE');
  assert(rows.every(r=>typeof r.id==='string'&&/^[a-z0-9_]+$/.test(r.id)&&/^[0-9a-f]{64}$/.test(r.checksum)),'FN02_QA_MANIFEST_ENTRY_INVALID');
 }
 const compare=(a:Fn02QaMigration,b:Fn02QaMigration)=>a.id<b.id?-1:a.id>b.id?1:0;
 assert.deepEqual(actual.toSorted(compare),expected.toSorted(compare),'FN02_QA_MANIFEST_MISMATCH');
}
