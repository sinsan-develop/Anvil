import test from 'node:test';import assert from 'node:assert/strict';import {existsSync} from 'node:fs';
import {newContextPreparation,prepareContextWrite} from '../../../apps/web/src/features/workspace/context-api.ts';
import {readContextPreparationInput} from '../../../apps/server/modules/context/context-input.ts';
const url=new URL('../../../apps/web/src/features/workspace/context-source-selection.ts',import.meta.url),subject=existsSync(url)?await import(url.href):{};
const pid='10000000-0000-4000-8000-000000000001',uid='20000000-0000-4000-8000-000000000002',ref={id:uid,version:1,contentHash:'a'.repeat(64)},session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)},confirmed:any={projectId:pid,ref,snapshot:{definition:{budgetRef:null},contentConfirmed:true,ready:false,executionAuthorized:false,dispatchPerformed:false}};
function buffer(){const b=newContextPreparation(confirmed,session,1);b.input.reason='원문 선택 검토';return b;}
const knowledge=(n:number)=>({kind:'KNOWLEDGE_VERSION',versionRef:{...ref,id:'30000000-0000-4000-8000-'+n.toString(16).padStart(12,'0')}});
function append(...args:any[]){assert.equal(typeof subject.appendContextSourceSelection,'function');return subject.appendContextSourceSelection(...args);}
test('첫선택은새입력으로만추가하고중복·목적/헌법두번째선택은원입력그대로보존한다',()=>{
 for(const code of ['PURPOSE_REASON','RULES_SCOPE']){const b=buffer(),original=structuredClone(b.input),next=append(b.input,code,knowledge(1));assert.deepEqual(b.input,original);assert.notEqual(next,b.input);assert.equal(next.slots.find((s:any)=>s.code===code).sources.length,1);assert.equal(append(next,code,knowledge(1)),next);assert.equal(append(next,code,knowledge(2)),next);assert.equal(subject.contextSourceSelectionState(next,code),'SLOT_FULL');b.input=next;assert.equal(readContextPreparationInput(prepareContextWrite(b,session).payload).slots.find(s=>s.code===code)!.sources.length,1);}
});
test('전체200경계의마지막선택만허용하고201번째추가/기존선택손실은막는다',()=>{
 const b=buffer();b.input.slots.find(s=>s.code==='CURRENT_POSITION')!.sources=Array.from({length:199},(_,i)=>knowledge(i+1)) as any;
 const full=append(b.input,'ACTUAL_GAPS',knowledge(200));assert.equal(full.slots.reduce((n:number,s:any)=>n+s.sources.length,0),200);assert.equal(subject.contextSourceSelectionState(full,'NEXT_ACTION'),'TOTAL_FULL');assert.equal(append(full,'NEXT_ACTION',knowledge(201)),full);assert.equal(b.input.slots.find(s=>s.code==='ACTUAL_GAPS')!.sources.length,0);b.input=full;assert.equal(readContextPreparationInput(prepareContextWrite(b,session).payload).slots.reduce((n,s)=>n+s.sources.length,0),200);
});
test('지식/문서/지시의기존슬롯종류제약을유지하고불일치나없는슬롯은조용히수정하지않는다',()=>{
 const b=buffer(),doc={kind:'DOCUMENT_VERSION',versionRef:ref},instruction={kind:'USER_INSTRUCTION',conversationId:pid,messageRef:{kind:'CONVERSATION',id:uid,contentHash:ref.contentHash}};
 for(const [code,selection] of [['LATEST_INSTRUCTIONS',knowledge(1)],['PURPOSE_REASON',doc],['DECISIONS_REASON',instruction],['UNKNOWN',knowledge(1)]])assert.equal(append(b.input,code,selection),b.input);
 const next=append(b.input,'LATEST_INSTRUCTIONS',instruction);assert.equal(next.slots.find((s:any)=>s.code==='LATEST_INSTRUCTIONS').sources[0].messageRef.kind,'CONVERSATION');assert.equal(subject.contextSourceSelectionState(b.input,'CURRENT_POSITION'),'AVAILABLE');
});
test('준비화면은선택한도를안내하되원문목록조회는막지않는다',async()=>{
 const {createServer}=await import('vite'),{fileURLToPath}=await import('node:url'),{createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{ApiClient}=await import('../../../apps/web/src/api/client.ts');
 const compiler=await createServer({configFile:fileURLToPath(new URL('../../../apps/web/vite.config.ts',import.meta.url)),server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true},logLevel:'silent'});
 try{const module=await compiler.ssrLoadModule('/src/features/workspace/WorkspaceContextPreparation.tsx'),b=buffer();b.input.slots[0]!.sources=[knowledge(1)] as any;let calls=0;
 const render=()=>renderToStaticMarkup(createElement(module.WorkspaceContextPreparation,{client:new ApiClient(async()=>{calls++;throw Error('정적표시조회금지');}),confirmed,session,buffer:b,onChange:()=>{},owner:true,busy:false,run:()=>{}}));
 const single=render();assert.ok(single.includes('이 슬롯은 원문 1개만 선택'));assert.equal(single.match(/<button[^>]*>지식 원문 목록<\/button>/)?.[0].includes('disabled'),false);
 b.input.slots[0]!.sources=[];b.input.slots.find(s=>s.code==='CURRENT_POSITION')!.sources=Array.from({length:200},(_,i)=>knowledge(i+1)) as any;assert.ok(render().includes('전체 원문 선택 200개에 도달'));assert.equal(calls,0);
 }finally{await compiler.close();}
});
