import assert from 'node:assert/strict';
import{test}from'node:test';
const pid='11111111-1111-4111-8111-111111111111',aid='22222222-2222-4222-8222-222222222222';
const payload=()=>({conversationId:null,targetRoleRef:null,message:{kind:'USER_INSTRUCTION',bodyRef:{artifactId:aid,bytes:10,contentHash:'a'.repeat(64),mediaType:'text/plain;charset=utf-8'},attachmentRefs:[],replyTo:null,supersedesInstructionRef:null,effectiveScope:{projectId:pid,stageRefs:[],taskRefs:[]}},sourceRefs:[]});
const load=()=>import('../../../apps/server/modules/knowledge/conversation-input.ts').catch(()=>null);
test('사람 발언은 원문과 범위를 유지하고 Agent/도구 발언이나 역할 배정으로 위장하지 않는다',async()=>{
 const m=await load();assert.ok(m,'불변 대화 입력 계약이 필요하다');const p=payload();assert.deepEqual(m.readConversationInput(p,pid),p);
 for(const kind of ['AGENT_OUTPUT','TOOL_FACT'])assert.throws(()=>m.readConversationInput({...p,message:{...p.message,kind}},pid));
 for(const bad of [{...p,authorRef:{kind:'HUMAN',userId:aid}},{...p,targetRoleRef:{id:aid}},{...p,message:{...p.message,effectiveScope:{projectId:aid,stageRefs:[],taskRefs:[]}}},{...p,message:{...p.message,attachmentRefs:[p.message.bodyRef]}}])assert.throws(()=>m.readConversationInput(bad,pid));
});
