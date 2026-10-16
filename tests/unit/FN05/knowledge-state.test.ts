import assert from'node:assert/strict';import{test}from'node:test';
const load=()=>import('../../../apps/server/modules/knowledge/knowledge-state.ts').catch(()=>null);
test('정정은 앞 버전을 대체 이력으로 남기고 제외 사건은 기본 선택에서 구분한다',async()=>{
 const m=await load();assert.ok(m,'지식 이력 상태 판정이 필요하다');
 for(const [version,head,kinds,want]of[[1,1,['PROPOSED'],'PROPOSED'],[1,2,['PROPOSED'],'SUPERSEDED'],[2,2,['CORRECTED'],'PROPOSED'],[2,2,['CORRECTED','EXCLUDED'],'EXCLUDED'],[1,2,['PROPOSED','EXCLUDED'],'EXCLUDED']]as const)assert.equal(m.knowledgeState(version,head,[...kinds]),want);
 for(const kinds of[[],['CONFIRMED'],['PROPOSED','PROPOSED'],['PROPOSED','EXCLUDED','EXCLUDED']])assert.throws(()=>m.knowledgeState(1,1,kinds));
});
