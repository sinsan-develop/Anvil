import test from 'node:test';
import assert from 'node:assert/strict';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {loadContextKnowledgeCandidates} from '../../../apps/web/src/features/workspace/context-knowledge-search.ts';
import {readContextKnowledgeOriginal} from '../../../apps/web/src/features/workspace/context-original.ts';
import {contextOriginalFixture} from '../../fixtures/context-original.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {planContextText} from '../../../apps/server/modules/context/context-text-plan.ts';
import {buildContextManifest} from '../../../apps/server/modules/context/context-manifest.ts';
function fixture(){
 const seed=contextOriginalFixture(),scope={projectId:seed.projectId,stageRefs:[{applicationRef:seed.assignmentRef,nodeId:'N1'}],taskRefs:[{planRef:seed.assignmentRef,taskCode:'FN05'}]},entry={...seed.knowledge.entry,kind:'DECISION',scope},ref={...seed.knowledge.ref,contentHash:contentHash(canonicalJson(entry))},knowledge={...seed.knowledge,entry,ref},input=structuredClone(seed.view.manifest.preparationInput);
 input.slots.forEach(s=>{s.sources=[];});input.slots.find(s=>s.code==='DECISIONS_REASON')!.sources=[{kind:'KNOWLEDGE_VERSION',versionRef:ref}];
 const entries=input.slots.map(slot=>({slot,selection:slot.sources[0]??null,itemId:slot.code+(slot.sources.length?'_1':'')})),plan=planContextText(entries.map(({slot,selection,itemId})=>({itemId,category:slot.code,required:true,sourceRef:selection?.kind==='KNOWLEDGE_VERSION'?ref:null,reason:slot.reason,state:selection?'AVAILABLE':'MISSING',bodyRef:selection?entry.contentRef:null,body:selection?knowledge.body:null})),input.limits),prepared:any={preparationInput:input,assignmentRef:seed.assignmentRef,baselineRefs:[seed.assignmentRef],constitutionRef:null,budgetRef:null,bindings:entries.map(({selection,itemId})=>({itemId,selection,bodyRef:selection?entry.contentRef:null,sourceState:selection?'PROPOSED':'NOT_SELECTED'})),...plan};
 return{...seed,scope,knowledge,view:{...seed.view,...buildContextManifest(seed.projectId,seed.projectId,prepared)}};
}
test('맥락 원문 선택은 정확조회 scope를 표시용으로 보존하되 검색query나선택ref를바꾸지않는다',async()=>{
 const f=fixture(),calls:string[]=[],client=new ApiClient(async path=>{calls.push(String(path));return Response.json(String(path).includes('/versions/')?f.knowledge:{items:[{versionRef:f.knowledge.ref,title:f.knowledge.entry.title,kind:'DECISION',sourceRefs:[],reasonSnippet:f.knowledge.entry.reason,state:'PROPOSED'}],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:'2026-10-25T00:00:00Z'});});
 const page=await loadContextKnowledgeCandidates(client,f.projectId,'DECISIONS_REASON','결정',null),preview=await page.items[0]!.inspect();assert.deepEqual((preview as any).knowledgeScope,f.scope);assert.deepEqual(preview.selection,{kind:'KNOWLEDGE_VERSION',versionRef:f.knowledge.ref});assert.equal(calls.length,2);assert.equal(new URL(calls[0]!,'https://anvil.invalid').searchParams.has('scope'),false);
});
test('보관 맥락의 정확원문은 고정 관련성을 표시용으로만 반환하고 현재실행을승격하지않는다',async()=>{
 const f=fixture(),client=new ApiClient(async path=>Response.json(String(path).includes('/context/')?f.view:f.knowledge));
 const value=await readContextKnowledgeOriginal(client,f.projectId,f.view.ref,f.assignmentRef,'DECISIONS_REASON_1',()=>true);assert.ok(value);assert.deepEqual((value as any).knowledgeScope,f.scope);assert.equal(value.executionAuthorized,false);assert.equal(value.dispatchPerformed,false);assert.deepEqual(value.sourceRef,f.knowledge.ref);
});
