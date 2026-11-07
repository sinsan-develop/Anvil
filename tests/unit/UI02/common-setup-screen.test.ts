import assert from 'node:assert/strict';import {test,after,before} from 'node:test';import {build} from 'vite';import {fileURLToPath} from 'node:url';import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';import {emptyDraft} from '../../../apps/web/src/features/project-create/api.ts';
import {exportMethodDraftFile} from '../../../apps/web/src/features/methodology-editor/method-draft-export.ts';
import {emptyMethodBuffer} from '../../../apps/web/src/features/methodology-editor/common-api.ts';
class MemoryNode{
 nodeType:number;nodeName:string;tagName:string;localName:string;namespaceURI='http://www.w3.org/1999/xhtml';parentNode:MemoryNode|null=null;childNodes:MemoryNode[]=[];ownerDocument:any;attributes=new Map<string,string>();style:Record<string,unknown>={};listeners=new Map<string,Function[]>();value='';checked=false;disabled=false;data='';
 constructor(name:string,type=1,owner?:any){this.nodeType=type;this.nodeName=type===1?name.toUpperCase():name;this.tagName=this.nodeName;this.localName=name;this.ownerDocument=owner;}
 get options():MemoryNode[]{return this.childNodes.flatMap(n=>n.tagName==='OPTION'?[n]:n.options);}
 get firstChild():MemoryNode|null{return this.childNodes[0]??null;}get lastChild():MemoryNode|null{return this.childNodes.at(-1)??null;}get nextSibling():MemoryNode|null{const a=this.parentNode?.childNodes;return a?.[a.indexOf(this)+1]??null;}
 get nodeValue():string|null{return this.nodeType===3?this.data:null;}set nodeValue(v:string|null){if(this.nodeType===3)this.data=v??'';}
 get textContent():string{return this.nodeType===3?this.data:this.childNodes.map(n=>n.textContent).join('');}
 set textContent(v:string){if(this.nodeType===3){this.data=String(v);return;}for(const n of this.childNodes)n.parentNode=null;this.childNodes=[];if(v)this.appendChild(this.ownerDocument.createTextNode(String(v)));}
 appendChild(n:MemoryNode){if(n.parentNode)n.parentNode.removeChild(n);n.parentNode=this;this.childNodes.push(n);return n;}
 insertBefore(n:MemoryNode,b:MemoryNode){if(n.parentNode)n.parentNode.removeChild(n);n.parentNode=this;const i=this.childNodes.indexOf(b);assert(i>=0);this.childNodes.splice(i,0,n);return n;}
 removeChild(n:MemoryNode){const i=this.childNodes.indexOf(n);assert(i>=0);this.childNodes.splice(i,1);n.parentNode=null;return n;}
 setAttribute(k:string,v:unknown){this.attributes.set(k,String(v));if(k==='disabled')this.disabled=true;}removeAttribute(k:string){this.attributes.delete(k);if(k==='disabled')this.disabled=false;}getAttribute(k:string){return this.attributes.get(k)??null;}
 addEventListener(k:string,f:Function){this.listeners.set(k,[...(this.listeners.get(k)??[]),f]);}removeEventListener(k:string,f:Function){this.listeners.set(k,(this.listeners.get(k)??[]).filter(v=>v!==f));}
 contains(n:MemoryNode|null):boolean{return !!n&&(n===this||this.childNodes.some(c=>c.contains(n)));}focus(){this.ownerDocument.activeElement=this;}
 dispatchEvent(e:any){e.target=this;e.preventDefault??=()=>{e.defaultPrevented=true;};e.stopPropagation??=()=>{e.cancelBubble=true;};const chain:MemoryNode[]=[];for(let n:MemoryNode|null=this;n;n=n.parentNode)chain.push(n);for(const n of chain)for(const f of n.listeners.get(e.type)??[])f(e);return !e.defaultPrevented;}
}
const document:any=new MemoryNode('#document',9);document.ownerDocument=document;document.createElement=(n:string)=>new MemoryNode(n,1,document);document.createElementNS=(_ns:string,n:string)=>document.createElement(n);document.createTextNode=(s:string)=>{const n=new MemoryNode('#text',3,document);n.data=s;return n;};document.documentElement=document.createElement('html');document.body=document.createElement('body');document.documentElement.appendChild(document.body);document.activeElement=document.body;
const saved=new Map<string,PropertyDescriptor|undefined>();let ui:any;
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}

before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/project-create/CommonSetupSelector.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:common-setup',name:'CommonSetupMemoryTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'rework-memory-entry',resolveId(id){if(id.endsWith('virtual:common-setup'))return '\0common-setup';},load(id){if(id==='\0common-setup')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{CommonSetupSelector}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import{renderToStaticMarkup}from'react-dom/server';import{ProjectCreatePage}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/project-create/ProjectCreatePage.tsx',import.meta.url)))};import{ProjectSetupCopies}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/project-create/ProjectSetupCopies.tsx',import.meta.url)))};export{React,createRoot,CommonSetupSelector,ProjectCreatePage,ProjectSetupCopies,ApiClient,renderToStaticMarkup};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel,location:new URL('https://anvil.invalid/#/projects/new'),history:{state:null,replaceState(){}}})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return CommonSetupMemoryTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});


const owner='11111111-1111-4111-8111-111111111111',clientId='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333',pid='44444444-4444-4444-8444-444444444444';
const session={user:{id:owner},clientId,csrfToken:'c'.repeat(43)},definition={label:'내 도구',toolProduct:'Codex',toolVersion:'현재',adapterKind:'NATIVE',modelOptions:{model:'auto'}},snapshot={id,version:1,kind:'TOOL',definition,reason:'원문',createdBy:owner},ref={id,version:1,contentHash:contentHash(canonicalJson(snapshot))};
const fixed=()=>({ref,snapshot,headVersion:1,status:'ACTIVE',configurationCurrent:true,support:'UNVERIFIED',executionAuthorized:false,observedAt:new Date().toISOString()});
const nodes=(n:MemoryNode):MemoryNode[]=>[n,...n.childNodes.flatMap(nodes)];
async function settle(check:()=>boolean){for(let i=0;i<50;i++){if(check())return;await ui.React.act(async()=>{await new Promise<void>(r=>setImmediate(r));});}assert.fail('React 유한 정착 실패');}
async function mount(component:string,buffer:any,transport:any){const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);let lost=0;const props:any={client:new ui.ApiClient(transport),session,buffer,disabled:false,onBusyChange:()=>{},onAuthenticationLost:()=>lost++,onChange:(action:any)=>{buffer=typeof action==='function'?action(buffer):action;props.buffer=buffer;root.render(ui.React.createElement(ui[component],props));}};const render=async()=>ui.React.act(async()=>root.render(ui.React.createElement(ui[component],props)));await render();return{container,props,render,get:()=>buffer,lost:()=>lost,async click(label:string){const b=nodes(container).find(n=>n.tagName==='BUTTON'&&n.textContent===label);assert.ok(b,label);assert.equal(b.disabled,false,label);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0}));},async close(){await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};}
test('실제 생성 페이지 3단계는 초기 IO0으로 공통 선택·작성 기능을 연결한다',()=>{let calls=0;const buffer={...emptyDraft(),wizardStep:3};const html=ui.renderToStaticMarkup(ui.React.createElement(ui.ProjectCreatePage,{client:new ui.ApiClient(async()=>{calls++;throw Error('NO_IO');}),session,buffer,onChange:()=>{throw Error('NO_MUTATION');},onAuthenticationLost:()=>{}}));assert.equal(calls,0);assert.match(html,/aria-label="공통 도구·환경 선택"/);assert.match(html,/본인 원형 목록 조회/);assert.match(html,/새 도구 원형 작성/);assert.match(html,/새 환경 원형 작성/);assert.doesNotMatch(html,/선택 미구현/);});
test('실제 React 목록→고정 원형→선택은 초안 원ref와 auto를 보존하며 자동 POST0이다',async()=>{const calls:string[]=[];const f=await mount('CommonSetupSelector',emptyDraft(),async(path:string)=>{calls.push(path);return Response.json(path.includes('/versions/')?fixed():{items:[{ref,kind:'TOOL',label:'내 도구',status:'ACTIVE'}],hasMore:false,nextCursor:null,observedAt:new Date().toISOString()});});try{assert.equal(calls.length,0);await f.click('본인 원형 목록 조회');await settle(()=>f.container.textContent.includes('고정 원형 보기 · 내 도구'));await f.click('고정 원형 보기 · 내 도구');await settle(()=>f.container.textContent.includes('총괄 도구로 선택'));await f.click('총괄 도구로 선택');await settle(()=>!!f.get().input.setupSelection);assert.deepEqual(f.get().input.setupSelection.coordinatorToolRef,ref);assert.equal(f.get().dirty,true);assert.equal(calls.length,2);await f.click('선택 해제 · 총괄 도구');await settle(()=>f.get().input.setupSelection.coordinatorToolRef===null);assert.equal(calls.length,2);}finally{await f.close();}});
test('실제 React 원형 저장의 응답 유실은 같은 ID/body 재확인 후에만 닫을 수 있다',async()=>{let fail=true;const bodies:string[]=[];const buffer={...emptyDraft(),ownerUserId:owner,commonSetupEditor:{kind:'TOOL',definition,reason:'원문',base:null}};const f=await mount('CommonSetupSelector',buffer,async(_path:string,init:RequestInit)=>{bodies.push(String(init.body));if(fail)throw Error('SYNTHETIC_LOST');const c=JSON.parse(String(init.body));return Response.json({scopeKind:'USER_COMMON',ownerUserId:owner,operationId:pid,commandId:c.commandId,status:'APPLIED',targetId:id,version:1,data:{ref,snapshot,status:'COMMON_SETUP_STORED',validation:{issues:[]}},evidenceRefs:[],warnings:[],serverReceivedAt:new Date().toISOString()});});try{assert.equal(bodies.length,0);await f.click('본인 공통 설정 저장');await settle(()=>f.get().commonSetupWork?.phase==='UNKNOWN');const work=f.get().commonSetupWork;assert.equal(work.command.payload.definition.modelOptions.model,'auto');assert.equal(nodes(f.container).some(n=>n.tagName==='BUTTON'&&n.textContent==='작성 닫기'),false);fail=false;await f.click('같은 명령 결과 다시 확인');await settle(()=>f.get().commonSetupWork.phase==='APPLIED');assert.equal(bodies.length,2);assert.equal(bodies[0],bodies[1]);await f.click('확인한 명령 닫기');assert.equal(f.get().commonSetupWork,null);}finally{await f.close();}});
test('실제 React 사용자/client ABA 뒤 늦은401은 이전 원문·인증상태를 채택하지 않는다',async()=>{let finish!:(v:Response)=>void;const f=await mount('CommonSetupSelector',emptyDraft(),async()=>await new Promise(r=>finish=r));try{await f.click('본인 원형 목록 조회');f.props.session={...session,user:{id:pid},clientId:id};await f.render();f.props.session={...session,user:{id:owner}};await f.render();finish(Response.json({code:'AUTH_REQUIRED'},{status:401}));await settle(()=>!f.container.textContent.includes('공통 설정 조회·검산 중'));assert.equal(f.lost(),0);assert.equal(f.get().input.setupSelection,undefined);assert.equal(f.container.textContent.includes('AUTH_REQUIRED'),false);}finally{await f.close();}});
test('실제 사본 보호조회403은 생성 결과·고정refs를 지우지 않고 재진입은 기존 detail을 쓴다',async()=>{const copyRef={...ref,slot:'CODING_TOOL'},calls:string[]=[];const f=await mount('ProjectSetupCopies',emptyDraft(),async(path:string)=>{calls.push(path);return path.endsWith('/'+pid)?Response.json({id:pid,setupCopyRefs:[copyRef]}):Response.json({code:'POLICY_DENIED'},{status:403});});try{f.props.projectId=pid;f.props.initialRefs=[copyRef];await f.render();assert.equal(calls.length,0);await f.click('사본 원문 조회 · CODING_TOOL');await settle(()=>f.container.textContent.includes('POLICY_DENIED'));assert.deepEqual(f.props.initialRefs,[copyRef]);assert.equal(f.container.textContent.includes(ref.contentHash),true);assert.equal(f.container.textContent.includes('조회 준비가 필요'),true);delete f.props.initialRefs;await f.render();await f.click('저장된 사본 참조 조회');await settle(()=>calls.length===2&&!f.container.textContent.includes('보호된 프로젝트 설정을 확인'));assert.equal(calls[1],'/api/v1/projects/'+pid);assert.equal(f.container.textContent.includes(ref.contentHash),true);}finally{await f.close();}});
test('실제 생성3단계 중간 저장과 복원은 선택 원ref를 기존 payload/GET에 왕복한다',async()=>{const selection={coordinatorToolRef:ref,codingToolRef:ref,environmentRef:null},buffer={...emptyDraft(),ownerUserId:owner,draftId:id,version:1,wizardStep:3,dirty:true,input:{...emptyDraft().input,name:'새 프로젝트',purpose:'목적',desiredOutcome:'결과',methodologySelection:{kind:'CONFIRMED_REFERENCE',versionRef:ref},setupSelection:selection}},calls:{path:string;body:any}[]=[];let stored:any;const f=await mount('ProjectCreatePage',buffer,async(path:string,init:RequestInit)=>{const body=init.method==='PATCH'?JSON.parse(String(init.body)):null;calls.push({path,body});if(body){stored={draftId:id,version:body.expectedVersion+1,step:body.step,input:body.input,editable:true};return Response.json(stored);}return Response.json(stored);});try{const form=nodes(f.container).find(n=>n.tagName==='FORM');assert.ok(form);await ui.React.act(async()=>form.dispatchEvent({type:'submit'}));await settle(()=>f.get().draftId===id&&!f.get().pendingCommand);assert.deepEqual(calls[0]!.body.input.setupSelection,selection);assert.equal(calls[0]!.body.step,3);assert.equal(Object.hasOwn(calls[0]!.body,'commonSetupEditor'),false);assert.equal(f.get().dirty,false);await settle(()=>calls.length===2&&!f.container.textContent.includes('저장 내용을 조회하고'));await f.click('저장본 다시 조회');await settle(()=>calls.length===3);await settle(()=>f.container.textContent.includes('선택 해제 · 총괄 도구'));assert.equal(calls[1]!.path,'/api/v1/project-drafts/'+id);assert.deepEqual(f.get().input.setupSelection,selection);}finally{await f.close();}});
test('실제 화면의 미확인 개인명령은 초안 저장·생성과 입력 대체를 잠근다',async()=>{const buffer={...emptyDraft(),ownerUserId:owner,wizardStep:3,commonSetupWork:{phase:'UNKNOWN',command:{commandId:id}},commonSetupEditor:{kind:'TOOL',definition,reason:'원문',base:null}},f=await mount('ProjectCreatePage',buffer,async()=>{throw Error('POST0');});try{const save=nodes(f.container).find(n=>n.tagName==='BUTTON'&&n.textContent==='중간 저장');assert.ok(save);assert.equal(save.disabled,true);const restore=nodes(f.container).find(n=>n.tagName==='BUTTON'&&n.textContent==='저장본 다시 조회');assert.ok(restore);assert.equal(restore.disabled,true);assert.equal(f.get().commonSetupWork.command.commandId,id);}finally{await f.close();}});
test('실제 환경 작성·고정 도구 개정·회수는 기존 두 명령과 정확 base ref를 소비한다',async()=>{const environment={label:'내 환경',executionHost:{label:'개발 PC',platform:'WINDOWS',pathHint:null},targetHosts:[],sourceRoots:[{label:'소스',pathHint:'D:/설명',requestedAccess:'READ'}],commandProfiles:[{label:'검사',purpose:'설명',commandText:'npm test'}],executionUserHint:null};for(const mode of ['ENVIRONMENT','EDIT','REVOKE']){let sent:any;const editor=mode==='ENVIRONMENT'?null:{kind:'TOOL',definition,reason:'변경 이유',base:fixed()},f=await mount('CommonSetupSelector',{...emptyDraft(),ownerUserId:owner,commonSetupEditor:editor},async(_path:string,init:RequestInit)=>{sent=JSON.parse(String(init.body));const rev=sent.operation==='revokeCommonSetupDefinition',snap=rev?snapshot:{id,version:sent.expectedVersion+1,kind:sent.payload.kind,definition:sent.payload.definition,reason:sent.payload.reason,createdBy:owner},r={id,version:snap.version,contentHash:contentHash(canonicalJson(snap))};return Response.json({scopeKind:'USER_COMMON',ownerUserId:owner,operationId:pid,commandId:sent.commandId,status:'APPLIED',targetId:id,version:snap.version,data:{ref:r,snapshot:snap,status:rev?'COMMON_SETUP_REVOKED':'COMMON_SETUP_STORED',validation:{issues:[]}},evidenceRefs:[],warnings:[],serverReceivedAt:new Date().toISOString()});});try{if(mode==='ENVIRONMENT'){await f.click('새 환경 원형 작성');assert.ok(f.container.textContent.includes('실행 기기 설명'));assert.ok(f.container.textContent.includes('명령 설명 · 실행하지 않음'));await ui.React.act(async()=>f.props.onChange((p:any)=>({...p,commonSetupEditor:{...p.commonSetupEditor,definition:environment,reason:'환경 설명'}})));}await f.click(mode==='REVOKE'?'이 원형 회수':'본인 공통 설정 저장');await settle(()=>f.get().commonSetupWork?.phase==='APPLIED');assert.equal(Object.keys(sent).length,7);if(mode==='ENVIRONMENT'){assert.deepEqual(sent.payload.definition,environment);assert.equal(sent.targetId,null);}else{assert.equal(sent.targetId,ref.id);assert.equal(sent.expectedVersion,ref.version);if(mode==='REVOKE')assert.deepEqual(sent.payload.targetRef,ref);}assert.equal(f.get().commonSetupWork.receipt.data.snapshot.createdBy,owner);}finally{await f.close();}}});
test('실제 화면은 뒤늦게 회수된 고정 원형을 자동 교체·제거하거나 다시 선택하지 않는다',async()=>{const original={coordinatorToolRef:ref,codingToolRef:null,environmentRef:null},buffer={...emptyDraft(),ownerUserId:owner,input:{...emptyDraft().input,setupSelection:original}},f=await mount('CommonSetupSelector',buffer,async()=>Response.json({...fixed(),status:'REVOKED',configurationCurrent:false}));try{await f.click('선택 원형 다시 보기 · 총괄 도구');await settle(()=>f.container.textContent.includes('이전 버전 · 선택 불가'));assert.deepEqual(f.get().input.setupSelection,original);const choose=nodes(f.container).find(n=>n.tagName==='BUTTON'&&n.textContent==='총괄 도구로 선택');assert.ok(choose);assert.equal(choose.disabled,true);}finally{await f.close();}});
test('사본 원문 닫기 뒤 늦은 성공·401은 원문을 다시 열거나 인증을 바꾸지 않는다',async()=>{const copy={id,projectId:pid,slot:'CODING_TOOL',sourceRef:ref,sourceOwnerUserId:owner,definitionSnapshot:definition,status:'UNBOUND'},copyRef={id,version:1,contentHash:contentHash(canonicalJson(copy)),slot:'CODING_TOOL'};for(const late of ['SUCCESS','AUTH']){let finish!:(v:Response)=>void,n=0;const response=()=>({projectId:pid,ref:{id,version:1,contentHash:copyRef.contentHash},copy,observedAt:new Date().toISOString(),readiness:'UNBOUND',executionAuthorized:false}),f=await mount('ProjectSetupCopies',emptyDraft(),async()=>++n===1?Response.json(response()):await new Promise(r=>finish=r));try{f.props.projectId=pid;f.props.initialRefs=[copyRef];await f.render();await f.click('사본 원문 조회 · CODING_TOOL');await settle(()=>f.container.textContent.includes('사본 원문 닫기'));await f.click('사본 원문 조회 · CODING_TOOL');await f.click('사본 원문 닫기');finish(late==='SUCCESS'?Response.json(response()):Response.json({code:'AUTH_REQUIRED'},{status:401}));await ui.React.act(async()=>await new Promise<void>(r=>setImmediate(r)));assert.equal(f.container.textContent.includes('사본 원문 닫기'),false);assert.equal(f.lost(),0);assert.equal(f.container.textContent.includes(copyRef.contentHash),true);}finally{await f.close();}}});
test('현재 원형조회403은 page/preview 동작만 회수하고 원선택과 명령을 보존한다',async()=>{let n=0;const selection={coordinatorToolRef:ref,codingToolRef:null,environmentRef:null},buffer={...emptyDraft(),ownerUserId:owner,input:{...emptyDraft().input,setupSelection:selection}},f=await mount('CommonSetupSelector',buffer,async()=>++n===1?Response.json(fixed()):Response.json({code:'FORBIDDEN'},{status:403}));try{await f.click('선택 원형 다시 보기 · 총괄 도구');await settle(()=>f.container.textContent.includes('총괄 도구로 선택'));await f.click('선택 원형 다시 보기 · 총괄 도구');await settle(()=>f.container.textContent.includes('FORBIDDEN'));assert.equal(f.container.textContent.includes('총괄 도구로 선택'),false);assert.deepEqual(f.get().input.setupSelection,selection);}finally{await f.close();}});
test('현재 명령401은 고정 오류코드 종류와 무관하게 인증 상실을 알리고 원명령은 보존한다',async()=>{const f=await mount('CommonSetupSelector',{...emptyDraft(),ownerUserId:owner,commonSetupEditor:{kind:'TOOL',definition,reason:'원문',base:null}},async()=>Response.json({code:'SESSION_REVOKED'},{status:401}));try{await f.click('본인 공통 설정 저장');await settle(()=>f.get().commonSetupWork?.phase==='REJECTED');assert.equal(f.lost(),1);assert.equal(f.get().commonSetupWork.command.operation,'saveCommonSetupDefinition');}finally{await f.close();}});
test('잘못된 모델 JSON 원문은 화면 재진입에도 보존되고 수정 전 저장은 차단된다',async()=>{const bodies:string[]=[],start={...emptyDraft(),ownerUserId:owner,commonSetupEditor:{kind:'TOOL',definition,reason:'원문',base:null}},transport=async(_p:string,init:RequestInit)=>{bodies.push(String(init.body));throw Error('SYNTHETIC_LOST');};let f=await mount('CommonSetupSelector',start,transport);const change=async(raw:string)=>{const textarea=nodes(f.container).find(n=>n.tagName==='TEXTAREA'&&n.getAttribute('id')?.endsWith('options'));assert.ok(textarea);const propsKey=Object.keys(textarea).find(k=>k.startsWith('__reactProps$'));assert.ok(propsKey);textarea.value=raw;await ui.React.act(async()=>{(textarea as any)[propsKey].onChange({target:{value:raw}});});};try{const bad='{"model":';await change(bad);assert.match(f.container.textContent,/올바른 JSON 객체/);const retained=f.get();assert.equal(retained.commonSetupEditor.modelOptionsText,bad);assert.equal(retained.commonSetupEditor.modelOptionsValid,false);assert.deepEqual(retained.commonSetupEditor.definition.modelOptions,definition.modelOptions);await f.close();f=await mount('CommonSetupSelector',retained,transport);const textarea=nodes(f.container).find(n=>n.tagName==='TEXTAREA'&&n.getAttribute('id')?.endsWith('options'));assert.ok(textarea);assert.equal((textarea as any)[Object.keys(textarea).find(k=>k.startsWith('__reactProps$'))!].value,bad);assert.match(f.container.textContent,/올바른 JSON 객체/);const save=nodes(f.container).find(n=>n.tagName==='BUTTON'&&n.textContent==='본인 공통 설정 저장');assert.ok(save);assert.equal(save.disabled,true);assert.equal(bodies.length,0);const valid=' { "model" : "auto", "literal" : "\\u0000" } ';await change(valid);const options=JSON.parse(valid);assert.deepEqual(f.get().commonSetupEditor.definition.modelOptions,options);const corrected=f.get();await f.close();f=await mount('CommonSetupSelector',corrected,transport);const restored=nodes(f.container).find(n=>n.tagName==='TEXTAREA'&&n.getAttribute('id')?.endsWith('options'));assert.ok(restored);assert.equal((restored as any)[Object.keys(restored).find(k=>k.startsWith('__reactProps$'))!].value,valid);await f.click('본인 공통 설정 저장');await settle(()=>f.get().commonSetupWork?.phase==='UNKNOWN');assert.equal(bodies.length,1);const wire=JSON.parse(bodies[0]!);assert.deepEqual(wire.payload.definition.modelOptions,options);assert.deepEqual(Object.keys(wire.payload).sort(),['definition','kind','reason']);assert.equal(JSON.stringify(wire).includes('modelOptionsText'),false);}finally{await f.close();}});

const importedGraph={nodes:[{nodeId:'N1',name:'검토 단계',purpose:'원본 확인',kind:'HUMAN' as const,role:'USER' as const,mode:'CASE_BY_CASE' as const,position:{x:0,y:0},inputs:[],outputs:[],taskScope:{included:['확인'],excluded:[]},completionCriteria:['확인'],approvalBoundary:[],limitPolicyRef:null,recordRequirements:[]}],edges:[],entryNodeId:'N1',terminalNodeIds:['N1']};
const importedSelection={kind:'NEW_PROJECT_DRAFT',name:'가져온 방법론',purpose:'가져온 목적',graph:importedGraph,sourceRefs:[],reviewRefs:[]};
const methodFile=()=>exportMethodDraftFile({...emptyMethodBuffer(),ownerUserId:owner,name:importedSelection.name,purpose:importedSelection.purpose,graph:importedGraph,reason:'이유는 옮기지 않음'},owner,'PROJECT');
const methodDraft=(selection:any=null)=>{const base=emptyDraft();return {...base,ownerUserId:owner,draftId:id,version:1,wizardStep:2,dirty:true,input:{...base.input,name:'프로젝트',purpose:'목적',desiredOutcome:'결과',methodologySelection:selection}};};
const methodInput=(container:MemoryNode)=>nodes(container).find(n=>n.tagName==='INPUT'&&n.getAttribute('accept')==='.json,application/json');
async function chooseMethodFile(container:MemoryNode,file:{size:number;text:()=>Promise<string>}){
 const input=methodInput(container);assert.ok(input,'프로젝트 방법론 초안 파일 입력');
 assert.equal(input.disabled,false);
 const key=Object.keys(input).find(k=>k.startsWith('__reactProps$'));assert.ok(key);
 const target={files:[file],value:'선택한 파일'};
 await ui.React.act(async()=>{(input as any)[key].onChange({target,currentTarget:target});});
 assert.equal(target.value,'');
}
async function confirmMethodReplacement(run:(decide:(yes:boolean)=>void,count:()=>number)=>Promise<void>){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'confirm');let answer=false,calls=0;
 Object.defineProperty(globalThis,'confirm',{value:()=>{calls++;return answer;},configurable:true});
 try{await run(yes=>{answer=yes;},()=>calls);}finally{if(previous)Object.defineProperty(globalThis,'confirm',previous);else Reflect.deleteProperty(globalThis,'confirm');}
}

test('UI02 PROJECT 방법론 파일은 저장 전 로컬 초안이며 기존 저장과 재조회에 같은 선택을 보낸다',async()=>{
 const calls:{path:string;method:string;body:any}[]=[];let stored:any;
 const f=await mount('ProjectCreatePage',methodDraft(),async(path:string,init:RequestInit)=>{
  const method=init.method??'GET',body=method==='PATCH'?JSON.parse(String(init.body)):null;
  calls.push({path,method,body});
  if(path==='/api/v1/project-drafts/'+id){
   if(body)stored={draftId:id,version:body.expectedVersion+1,step:body.step,input:body.input,editable:true};
   return Response.json(stored);
  }
  return Response.json({items:[],nextCursor:null});
 });
 try{
  const raw=methodFile();await chooseMethodFile(f.container,{size:Buffer.byteLength(raw),text:async()=>raw});
  await settle(()=>f.get().input.methodologySelection?.name===importedSelection.name);
  assert.deepEqual(f.get().input.methodologySelection,importedSelection);
  assert.equal(f.get().dirty,true);
  assert.equal(calls.filter(call=>call.method!=='GET').length,0);
  const form=nodes(f.container).find(n=>n.tagName==='FORM');assert.ok(form);
  await ui.React.act(async()=>form.dispatchEvent({type:'submit'}));
  await settle(()=>f.get().version===2&&!f.get().pendingCommand);
  assert.deepEqual(calls.filter(call=>call.method!=='GET').map(call=>call.body.input.methodologySelection),[importedSelection]);
  await settle(()=>calls.some(call=>call.path==='/api/v1/project-drafts/'+id&&call.method==='GET'));
  await ui.React.act(async()=>f.props.onChange((p:any)=>({...p,input:{...p.input,methodologySelection:null}})));
  await f.click('저장본 다시 조회');
  await settle(()=>f.get().input.methodologySelection?.name===importedSelection.name);
  assert.equal(calls.filter(call=>call.path==='/api/v1/project-drafts/'+id&&call.method==='GET').length,2);
  assert.deepEqual(f.get().input.methodologySelection,importedSelection);
 }finally{await f.close();}
});

test('UI02 방법론 파일의 오류와 교체 취소는 기존 선택을 보존한다',async()=>confirmMethodReplacement(async(decide,count)=>{
 const existing={kind:'CONFIRMED_REFERENCE',versionRef:ref};let writes=0;
 const f=await mount('ProjectCreatePage',methodDraft(existing),async(_path:string,init:RequestInit)=>{
  if(init.method&&init.method!=='GET')writes++;
  return Response.json({items:[],nextCursor:null});
 });
 try{
  const valid=methodFile(),wrong=valid.replace('"PROJECT"','"USER_COMMON"'),sensitive=valid.replace(importedSelection.name,'Bearer SYNTHETIC_SENSITIVE_VALUE');let reads=0;
  for(const file of [{size:wrong.length,text:async()=>wrong},{size:sensitive.length,text:async()=>sensitive},
   {size:32,text:async()=>{throw new Error('로컬 원문 오류');}},{size:2097153,text:async()=>{reads++;return valid;}}]){
   await chooseMethodFile(f.container,file);
   await settle(()=>f.container.textContent.includes('방법론 초안 파일을 가져오지 못했습니다'));
   assert.deepEqual(f.get().input.methodologySelection,existing);
   assert.doesNotMatch(f.container.textContent,/SYNTHETIC_SENSITIVE_VALUE|로컬 원문 오류/);
  }
  assert.equal(reads,0);assert.equal(count(),0);
  const good={size:Buffer.byteLength(valid),text:async()=>valid};
  await chooseMethodFile(f.container,good);
  await settle(()=>count()===1);
  assert.deepEqual(f.get().input.methodologySelection,existing);
  decide(true);
  await chooseMethodFile(f.container,good);
  await settle(()=>count()===2&&f.get().input.methodologySelection?.name===importedSelection.name);
  assert.deepEqual(f.get().input.methodologySelection,importedSelection);
  assert.equal(writes,0);
 }finally{await f.close();}
}));

test('UI02 파일 읽기 중 초안·세션·클라이언트·단계·저장 잠금이 바뀌면 늦은 결과를 버린다',async()=>{
 const raw=methodFile();
 for(const change of ['DRAFT','SESSION','CLIENT','STEP','LOCK'] as const){
  const start={...methodDraft(),dirty:false},f=await mount('ProjectCreatePage',start,async()=>Response.json({items:[],nextCursor:null}));
  let release!:(raw:string)=>void;
  try{
   const pending=new Promise<string>(resolve=>{release=resolve;});
   await chooseMethodFile(f.container,{size:Buffer.byteLength(raw),text:()=>pending});
   if(change==='SESSION'){
    f.props.session={...session,clientId:pid};await f.render();
    f.props.session=session;await f.render();
   }else if(change==='CLIENT'){
    const client=f.props.client;
    f.props.client=new ui.ApiClient(async()=>Response.json({items:[],nextCursor:null}));await f.render();
    f.props.client=client;await f.render();
   }else if(change==='STEP'){
    await f.click('목적·소스로 이전');
    await f.click('방법론·자료로 다음');
   }else{
    const patch=change==='DRAFT'?{draftId:pid}:{pendingCommand:{body:{commandId:pid}}};
    await ui.React.act(async()=>f.props.onChange((p:any)=>({...p,...patch})));
   }
   let releaseNew:(value:string)=>void=()=>{};
   if(change==='SESSION')await chooseMethodFile(f.container,{size:Buffer.byteLength(raw),text:()=>new Promise(resolve=>{releaseNew=resolve;})});
   await ui.React.act(async()=>{release(raw);await pending;});
   assert.equal(f.get().input.methodologySelection,null,change);
   if(change==='SESSION'){
    assert.equal(methodInput(f.container)?.disabled,true,'새 파일 읽기 잠금 보존');
    await ui.React.act(async()=>{releaseNew(raw);});
    assert.deepEqual(f.get().input.methodologySelection,importedSelection);
   }
   const input=methodInput(f.container);assert.ok(input,change);
   assert.equal(input.disabled,change==='LOCK',change);
   if(change==='LOCK')assert.equal(f.get().pendingCommand.body.commandId,pid);
  }finally{await f.close();}
 }
});
