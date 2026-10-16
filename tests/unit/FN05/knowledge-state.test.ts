import assert from'node:assert/strict';import{test}from'node:test';
const load=()=>import('../../../apps/server/modules/knowledge/knowledge-state.ts').catch(()=>null);
test('정정은 앞 버전을 대체 이력으로 남기고 제외 사건은 기본 선택에서 구분한다',async()=>{
 const m=await load();assert.ok(m,'지식 이력 상태 판정이 필요하다');
 for(const [version,head,kinds,want]of[[1,1,['PROPOSED'],'PROPOSED'],[1,2,['PROPOSED'],'SUPERSEDED'],[2,2,['CORRECTED'],'PROPOSED'],[2,2,['CORRECTED','EXCLUDED'],'EXCLUDED'],[1,2,['PROPOSED','EXCLUDED'],'EXCLUDED']]as const)assert.equal(m.knowledgeState(version,head,[...kinds]),want);
 for(const kinds of[[],['CONFIRMED'],['PROPOSED','PROPOSED'],['PROPOSED','EXCLUDED','EXCLUDED']])assert.throws(()=>m.knowledgeState(1,1,kinds));
});
test('지식 정정 이유·주체·버전이 원 명령 영수증과 다르면 조회용 이력으로 채택하지 않는다',async()=>{
 const m=await load();assert.ok(m&&typeof m.assertKnowledgeHistory==='function','이력/명령 대조가 필요하다');
 const id='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',ref={id,version:2,contentHash:'a'.repeat(64)},baseRef={...ref,version:1},entry={reason:'지식의 판단 이유',scope:{projectId:id}},event={id,kind:'CORRECTED',reason:'정정한 이유',actor_ref:{kind:'HUMAN',userId:user},base_ref:baseRef,change_sources:[],command_actor_id:user,command_operation:'correctKnowledge',command_result:{status:'APPLIED',projectId:id,targetId:id,version:2,data:{ref,status:'PROPOSED',entry,reason:'정정한 이유',eventId:id,baseRef,changeSources:[]}}};
 m.assertKnowledgeHistory([event],ref,entry);
 for(const bad of [{...event,reason:'변조된 이유'},{...event,actor_ref:{kind:'HUMAN',userId:id}},{...event,command_result:{...event.command_result,data:{...event.command_result.data,ref:{...ref,version:3}}}}])assert.throws(()=>m.assertKnowledgeHistory([bad],ref,entry));
});
