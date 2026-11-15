import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {nodeDecisionFixture,nodeDecisionTransport} from '../FN10/node-decision-fixture.ts';
import {H} from '../FN10/node-decision-fixture.ts';
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
 setAttribute(k:string,v:unknown){this.attributes.set(k,String(v));if(k==='value')this.value=String(v);if(k==='disabled')this.disabled=true;}removeAttribute(k:string){this.attributes.delete(k);if(k==='disabled')this.disabled=false;}getAttribute(k:string){return this.attributes.get(k)??null;}
 addEventListener(k:string,f:Function){this.listeners.set(k,[...(this.listeners.get(k)??[]),f]);}removeEventListener(k:string,f:Function){this.listeners.set(k,(this.listeners.get(k)??[]).filter(v=>v!==f));}
 contains(n:MemoryNode|null):boolean{return !!n&&(n===this||this.childNodes.some(c=>c.contains(n)));}focus(){this.ownerDocument.activeElement=this;}
 dispatchEvent(e:any){e.target=this;e.preventDefault??=()=>{e.defaultPrevented=true;};e.stopPropagation??=()=>{e.cancelBubble=true;};const chain:MemoryNode[]=[];for(let n:MemoryNode|null=this;n;n=n.parentNode)chain.push(n);for(const n of chain)for(const f of n.listeners.get(e.type)??[])f(e);return !e.defaultPrevented;}
}
let ui:any,document:any,currentTransport:typeof fetch;
const saved=new Map<string,PropertyDescriptor|undefined>(),channels:MessageChannel[]=[],events=new Map<string,Set<Function>>();
const location={hash:'',protocol:'https:',origin:'https://anvil-synthetic.invalid'};
before(async()=>{
 const api=fileURLToPath(new URL('../../../apps/web/src/features/workspace/node-decision-api.ts',import.meta.url)),panel=fileURLToPath(new URL('../../../apps/web/src/features/workspace/NodeDecisionPanel.tsx',import.meta.url)),app=fileURLToPath(new URL('../../../apps/web/src/App.tsx',import.meta.url)),client=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:node-decision',name:'NodeDecisionUI',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'node-decision-memory',resolveId(id){if(id.endsWith('virtual:node-decision'))return'\0node-decision';},load(id){if(id==='\0node-decision')return`import * as React from 'react';import{createRoot}from'react-dom/client';import * as api from ${JSON.stringify(api)};import{NodeDecisionPanel}from ${JSON.stringify(panel)};import{App}from ${JSON.stringify(app)};import{ApiClient}from ${JSON.stringify(client)};export{React,createRoot,api,NodeDecisionPanel,App,ApiClient};`;}}]});
 document=new MemoryNode('#document',9);document.ownerDocument=document;document.createElement=(n:string)=>new MemoryNode(n,1,document);document.createElementNS=(_ns:string,n:string)=>document.createElement(n);document.createTextNode=(s:string)=>{const n=new MemoryNode('#text',3,document);n.data=s;return n;};document.documentElement=document.createElement('html');document.body=document.createElement('body');document.documentElement.appendChild(document.body);document.activeElement=document.body;
 const Native=globalThis.MessageChannel;class Channel extends Native{constructor(){super();channels.push(this);}}
 const add=(k:string,f:Function)=>{let set=events.get(k);if(!set)events.set(k,set=new Set());set.add(f);},remove=(k:string,f:Function)=>events.get(k)?.delete(f),window={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener:add,removeEventListener:remove,getComputedStyle:()=>({}),location};document.defaultView=window;
 for(const[k,v]of Object.entries({window,document,location,addEventListener:add,removeEventListener:remove,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:Channel,fetch:(...args:Parameters<typeof fetch>)=>currentTransport(...args)})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((v:any)=>v.type==='chunk').code+';return NodeDecisionUI;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});
const all=(n:MemoryNode):MemoryNode[]=>[n,...n.childNodes.flatMap(all)],tick=()=>new Promise<void>(yes=>setImmediate(yes));
async function wait(check:()=>boolean,container?:MemoryNode){for(let i=0;i<150;i++){if(check())return;await ui.React.act(async()=>{await tick();});}assert.fail('DOM_WAIT: '+container?.textContent);}
async function mount(realApp=false,existing=false){
 const f=await nodeDecisionFixture(),q=await nodeDecisionTransport(f);if(existing)await q.service.command(f.token,f.csrf,f.command());currentTransport=q.transport;location.hash=`#/projects/${f.pid}/workspace`;
 const container=document.createElement('main');document.body.appendChild(container);const root=ui.createRoot(container),buffers:Record<string,any>={};
 let authLost=0;const props:any={client:new ui.ApiClient(q.transport),projectId:f.pid,session:q.session,applicationRef:f.applicationRef,nodeId:'choose',participation:'OWNER',controlState:q.project.controlState,onAuthenticationLost:()=>{authLost++;}};
 let redraw:()=>void=()=>{};const storage={buffers,onChange:(key:string,expected:any,change:Function)=>{const previous=buffers[key]??null;if(expected!==null&&previous?.packet!==expected)return;buffers[key]=change(previous);redraw();}};
 const Host=()=>{const[,update]=ui.React.useState(0);redraw=()=>update((n:number)=>n+1);return ui.React.createElement(ui.NodeDecisionPanel,{...props,storage});};
 const render=async()=>{await ui.React.act(async()=>{root.render(realApp?ui.React.createElement(ui.App):ui.React.createElement(Host));await tick();});};
 const node=(name:string)=>all(container).find(n=>n.attributes.get('aria-label')===name)??all(container).find(n=>n.tagName==='BUTTON'&&n.textContent===name);
 const click=async(name:string)=>{const n=node(name);assert(n,'BUTTON '+name+' '+container.textContent);assert.equal(n.disabled,false,name);await ui.React.act(async()=>{n.dispatchEvent({type:'click',button:0});await tick();});};
 const change=async(name:string,value:string|boolean)=>{const n=node(name);assert(n,'FIELD '+name+' '+container.textContent);await ui.React.act(async()=>{n.value=String(value);if(typeof value==='boolean')n.checked=value;const key=Object.keys(n).find(k=>k.startsWith('__reactProps'));assert(key);const handler=(n as any)[key!].onChange;assert.equal(typeof handler,'function');handler({target:{value:n.value,checked:n.checked}});await tick();});};
 const select=async()=>{await wait(()=>!!node('확정 설계')?.options.find(v=>v.value===f.design.ref.id),container);await change('확정 설계',f.design.ref.id);await wait(()=>node('확정 설계')?.value===f.design.ref.id,container);await change('확정 계획',f.plan.ref.id);await wait(()=>node('확정 계획')?.value===f.plan.ref.id,container);await change('근거 AF02',true);await wait(()=>!node('판단값')?.disabled,container);await change('판단값','GO');await change('판단 이유','사용자가 명시한 판단');};
 await render();return{f,q,container,props,render,node,click,change,select,buffers,authLost:()=>authLost,close:async()=>{q.release();q.releaseRead();await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
async function pagedHistory(){
 const h=await mount();await wait(()=>!h.node('확정 설계')?.disabled,h.container);
 let base:{id:string;version:number;contentHash:string}|null=null;
 for(let i=0;i<3;i++){
  await h.q.service.command(h.f.token,h.f.csrf,h.f.command('recordNodeDecision',base));
  const row=h.f.versions.at(-1)!;base={id:row.stream_id,version:row.version,contentHash:row.content_hash};
 }
 const cursors:(string|null)[]=[];
 const gate=(kind:'FIRST'|'NEXT')=>({kind,release:Promise.withResolvers<number>(),returned:Promise.withResolvers<void>()});
 let pending:ReturnType<typeof gate>|null=null;
 const paged:typeof fetch=async(input,init)=>{
  const u=new URL(String(input),'https://anvil-synthetic.invalid');
  if(!u.pathname.endsWith('/node-decisions'))return h.q.transport(input,init);
  const cursor=u.searchParams.get('cursor');cursors.push(cursor);
  const delayed=pending?.kind===(cursor?'NEXT':'FIRST')?pending:null;
  if(delayed){const status=await delayed.release.promise;if(status!==200){delayed.returned.resolve();return Response.json({code:'PROJECT_READ_DENIED'},{status});}}
  // 같은 서버 목록·서명 cursor를 사용하되 DOM 경계 시험에서는 페이지당 한 버전을 반환한다.
  u.searchParams.set('limit','1');const page=await h.q.transport(u.pathname+u.search,init);delayed?.returned.resolve();return page;
 };
 h.props.client=new ui.ApiClient(paged);await h.render();await wait(()=>!!h.node('이력 더 보기')&&!h.node('이력 더 보기')?.disabled,h.container);
 const rows=()=>all(h.container).filter(n=>n.tagName==='BUTTON'&&n.textContent.startsWith('고정 이력 ')).map(n=>n.textContent);
 let returned=Promise.resolve();
 return {...h,cursors,rows,get returned(){return returned;},hold(kind:'FIRST'|'NEXT'='NEXT'){pending=gate(kind);returned=pending.returned.promise;},release(code=200){pending?.release.resolve(code);pending=null;}};
}
test('이력 더 보기의 같은 cursor를 연달아 눌러도 한 페이지씩 한번만 반영한다',async()=>{
 const h=await pagedHistory();try{
  const first=h.rows();assert.equal(first.length,1);h.hold();
  const more=h.node('이력 더 보기')!;
  await ui.React.act(async()=>{more.dispatchEvent({type:'click',button:0});more.dispatchEvent({type:'click',button:0});await tick();});
  assert.equal(h.cursors.length,2);assert.equal(h.cursors[0],null);assert.ok(h.cursors[1]);
  h.release();await wait(()=>h.rows().length===2,h.container);
  await h.click('이력 더 보기');await wait(()=>h.rows().length===3&&!h.node('이력 더 보기'),h.container);
  assert.deepEqual(h.rows().slice(0,1),first);assert.equal(new Set(h.rows()).size,3);assert.equal(h.cursors.length,3);assert.notEqual(h.cursors[2],h.cursors[1]);
  assert.equal(h.q.calls.filter(v=>v.method==='POST').length,0);
 }finally{h.release();await h.close();}
});
test('이력 다음쪽 거절 후 옛 cursor를 버리고 명시 재조회가 첫 페이지를 복원한다',async()=>{
 const h=await pagedHistory();try{
  const first=h.rows();h.hold();await h.click('이력 더 보기');h.release(403);
  await wait(()=>h.container.textContent.includes('PROJECT_READ_DENIED'),h.container);
  assert.deepEqual(h.rows(),[]);assert.equal(Boolean(h.node('이력 더 보기')),false);assert.equal(h.cursors.length,2);
  await h.click('이력 보호 재조회');await wait(()=>h.rows().length===1&&!!h.node('이력 더 보기'),h.container);
  assert.equal(h.cursors[2],null);assert.deepEqual(h.rows(),first);
  await h.click('이력 더 보기');await wait(()=>h.rows().length===2,h.container);assert.equal(new Set(h.rows()).size,2);
  assert.equal(h.q.calls.filter(v=>v.method==='POST').length,0);
 }finally{h.release();await h.close();}
});
for(const code of [200,401])test('노드 왕복 후 지연된 이력 다음쪽 '+code+'는 새 목록과 인증에 반영되지 않는다',async()=>{
 const h=await pagedHistory();try{
  const first=h.rows();h.hold();await h.click('이력 더 보기');
  h.props.nodeId='other';await h.render();await wait(()=>!h.node('사람 판단 기록'),h.container);
  h.props.nodeId='choose';await h.render();await wait(()=>h.rows().length===1&&!!h.node('이력 더 보기'),h.container);
  h.release(code);await ui.React.act(async()=>{await h.returned;await tick();});
  assert.deepEqual(h.rows(),first);assert.equal(h.authLost(),0);assert.deepEqual(Object.keys(h.buffers),[]);
  assert.equal(h.cursors.length,3);assert.equal(h.cursors[2],null);assert.equal(h.q.calls.filter(v=>v.method==='POST').length,0);
 }finally{h.release();await h.close();}
});
test('고정 이력 원문 조회 뒤 다음쪽 403은 원 저장 영수증을 보존하고 원문을 숨긴다',async()=>{
 const h=await pagedHistory();try{
  await h.select();await h.click('판단 기록');
  await wait(()=>Object.values(h.buffers).some(v=>v.phase==='SAVED'),h.container);
  const key=Object.keys(h.buffers)[0]!,{packet,receipt,phase}=h.buffers[key];
  await h.click('이력 보호 재조회');await wait(()=>h.rows().length===1&&h.node('이력 더 보기')?.disabled===false,h.container);
  const version=Number(h.rows()[0]!.split(' ').at(-1)),row=h.f.versions.find(v=>v.version===version)!;
  await h.click(h.rows()[0]!);await wait(()=>h.node('이력 더 보기')?.disabled===false&&h.node('보호 판단 원문')?.textContent.includes(row.snapshot_json.reason)===true,h.container);
  const posts=h.q.calls.filter(v=>v.method==='POST').length;assert.equal(posts,1);
  h.hold();await h.click('이력 더 보기');h.release(403);await wait(()=>h.container.textContent.includes('PROJECT_READ_DENIED'),h.container);
  assert.equal(Boolean(h.node('보호 판단 원문')),false);assert.deepEqual(h.rows(),[]);assert.equal(Boolean(h.node('이력 더 보기')),false);
  assert.equal(h.buffers[key].packet,packet);assert.equal(h.buffers[key].receipt,receipt);assert.equal(h.buffers[key].phase,phase);
  await h.click('이력 보호 재조회');await wait(()=>h.rows().length===1&&!!h.node('보호 판단 원문'),h.container);
  assert.equal(h.cursors.at(-1),null);assert.equal(h.q.calls.filter(v=>v.method==='POST').length,posts);
 }finally{h.release();await h.close();}
});
for(const code of [200,401])test('다음쪽 거절 뒤 첫 페이지 재조회 연속 클릭은 지연 '+code+' 원응답 하나만 수용한다',async()=>{
 const h=await pagedHistory();try{
  const first=h.rows();h.hold();await h.click('이력 더 보기');h.release(403);await wait(()=>h.container.textContent.includes('PROJECT_READ_DENIED'),h.container);
  h.hold('FIRST');const before=h.cursors.length,button=h.node('이력 보호 재조회')!;
  await ui.React.act(async()=>{button.dispatchEvent({type:'click',button:0});button.dispatchEvent({type:'click',button:0});await tick();});
  assert.deepEqual(h.cursors.slice(before),[null]);h.release(code);
  await wait(()=>!h.node('이력 보호 재조회')?.disabled,h.container);
  assert.deepEqual(h.rows(),code===200?first:[]);assert.equal(h.authLost(),code===401?1:0);assert.equal(h.q.calls.filter(v=>v.method==='POST').length,0);
 }finally{h.release();await h.close();}
});
test('실제 browser 선언은 서버 원 선언과 hash·C1/Cf·무변형 값을 동일하게 보존한다',async()=>{const f=await nodeDecisionFixture(),q=await nodeDecisionTransport(f),method={projectId:f.pid,applicationRef:f.applicationRef,snapshot:f.applicationSnapshot,observedAt:new Date().toISOString(),executionState:'NOT_CONNECTED'};assert.deepEqual(await ui.api.previewNodeDecision(method,'choose'),f.declaration);f.applicationSnapshot.graph.edges[0]!.condition.value=['A\u0085B'];await assert.rejects(ui.api.previewNodeDecision(method,'choose'));f.applicationSnapshot.graph.edges[0]!.condition.value=['A\u200dB'];assert.deepEqual((await ui.api.previewNodeDecision(method,'choose')).values,['A\u200dB']);assert.equal(q.calls.length,0);});
test('실제 Panel→원 보호reader→record·정정·철회·고정이력은 source-only 저장 여정을 완성한다',async()=>{const h=await mount();try{await h.select();await h.click('판단 기록');await wait(()=>h.f.versions.length===1&&h.container.textContent.includes('보관 버전 1'),h.container);assert.equal(h.q.calls.filter(v=>v.method==='POST').length,1);await h.change('판단 이유','명시 정정');await h.click('판단 기록');await wait(()=>h.f.versions.length===2&&h.container.textContent.includes('보관 버전 2'),h.container);await h.change('판단 이유','명시 철회');await h.click('판단 철회');await wait(()=>h.f.versions.length===3&&h.container.textContent.includes('REVOKED'),h.container);await h.click('고정 이력 1');await wait(()=>h.container.textContent.includes('보관 버전 1'),h.container);assert.equal(h.q.calls.filter(v=>v.method==='POST').length,3);assert.equal(h.f.versions[2].snapshot_json.status,'REVOKED');assert.equal(h.f.active(),false);}finally{await h.close();}});
test('실제 App의 확정 임무 없는 USER 단계 선택은 같은 App buffer로 명시 판단을 저장한다',async()=>{const h=await mount(true);try{await wait(()=>!!h.node('적용 절차 조회'),h.container);await h.click('적용 절차 조회');await wait(()=>!!h.node('절차 정의: 사람 판단'),h.container);await h.click('절차 정의: 사람 판단');await h.select();await h.click('판단 기록');await wait(()=>h.f.versions.length===1&&h.container.textContent.includes('보관 버전 1'),h.container);assert.equal(h.q.calls.filter(v=>v.method==='POST').length,1);assert.equal(h.f.versions[0].snapshot_json.actor.credentialGeneration,3);assert.equal(h.f.active(),false);}finally{await h.close();}});
test('Panel 응답 유실은 원 body/ID UNKNOWN을 보존하고 이력 재조회에도 POST를 늘리지 않는다',async()=>{const h=await mount();try{await h.select();h.q.modes.post='LOST';await h.click('판단 기록');await wait(()=>h.container.textContent.includes('원 명령의 결과가 불명'),h.container);const b=Object.values(h.buffers)[0] as any,body=b.packet.body,commandId=b.packet.command.commandId;assert.equal(b.phase,'UNKNOWN');assert.equal(h.f.versions.length,1);assert.equal(h.node('판단 기록')!.disabled,true);await h.click('이력 보호 재조회');await wait(()=>h.container.textContent.includes('고정 이력 1'),h.container);assert.equal(h.q.calls.filter(v=>v.method==='POST').length,1);const after=Object.values(h.buffers)[0] as any;assert.equal(after.packet.body,body);assert.equal(after.packet.command.commandId,commandId);assert.equal(after.phase,'UNKNOWN');}finally{await h.close();}});
test('Panel은 receipt를 GET보다 먼저 보존하고 보호 거절 뒤 같은 ref GET만 재시도한다',async()=>{const h=await mount();try{await h.select();h.q.modes.read='DENY_AFTER_POST';await h.click('판단 기록');await wait(()=>h.container.textContent.includes('원 저장 응답을 보존'),h.container);const b=Object.values(h.buffers)[0] as any,ref=structuredClone(b.receipt.data.ref),body=b.packet.body;assert.equal(b.phase,'READ_UNAVAILABLE');assert.equal(b.view,null);assert.equal(h.f.versions.length,1);assert(!h.container.textContent.includes('사용자가 명시한 판단'));h.f.state.readAllowed=true;await h.click('이력 보호 재조회');await wait(()=>h.container.textContent.includes('보관 버전 1'),h.container);const after=Object.values(h.buffers)[0] as any;assert.deepEqual(after.receipt.data.ref,ref);assert.equal(after.packet.body,body);assert.equal(h.q.calls.filter(v=>v.method==='POST').length,1);}finally{await h.close();}});
test('Panel POST HOLD 뒤 주체 전환은 늦은 성공을 새 화면에 표시하거나 원 UNKNOWN을 지우지 않는다',async()=>{const h=await mount();try{await h.select();h.q.modes.post='HOLD';await h.click('판단 기록');await wait(()=>h.q.entered(),h.container);const old=Object.values(h.buffers)[0] as any,body=old.packet.body;h.f.state.member=false;h.props.session={...h.props.session,user:{...h.props.session.user,id:'a1100000-0000-4000-8000-000000000099'}};await h.render();await ui.React.act(async()=>{h.q.release();await tick();});await wait(()=>(Object.values(h.buffers)[0] as any).phase==='UNKNOWN',h.container);assert.equal((Object.values(h.buffers)[0] as any).packet.body,body);assert(!h.container.textContent.includes('보관 버전 1'));assert(!h.container.textContent.includes('사용자가 명시한 판단'));assert.equal(h.q.calls.filter(v=>v.method==='POST').length,1);}finally{await h.close();}});
test('실제 API의 첫 POST 직전 취소·포트 변경은 sent0이며 원 packet의 두번째 공급은 차단된다',async()=>{
 for(const fault of ['cancel','transport','lost']){const f=await nodeDecisionFixture(),q=await nodeDecisionTransport(f),client=new ui.ApiClient(q.transport),c={client,projectId:f.pid,session:q.session,applicationRef:f.applicationRef,nodeId:'choose',controlGeneration:1},packet=await ui.api.prepareNodeDecision(c,f.basisSelection,[f.design.ref],'GO','명시 기록',null,false,()=>true);let active=true;
  if(fault==='transport')client.transport=async()=>{throw Error('REPLACED_TRANSPORT');};if(fault==='lost')q.modes.post='LOST';await assert.rejects(ui.api.sendNodeDecision(c,packet,()=>active,({sent}:any)=>{if(fault==='cancel'&&!sent)active=false;}));
  const posts=q.calls.filter(v=>v.method==='POST').length;assert.equal(posts,fault==='lost'?1:0);assert.equal(ui.api.nodeDecisionPacketState(packet).sent,fault==='lost');if(fault==='lost'){await assert.rejects(ui.api.sendNodeDecision(c,packet,()=>true,()=>{}));assert.equal(q.calls.filter(v=>v.method==='POST').length,1);}
 }
});
test('저장 뒤 명시 선택 refs 변경·거절에는 이전 보호 본문을 즉시 숨긴다',async()=>{const h=await mount();try{await h.select();await h.click('판단 기록');await wait(()=>!!h.node('보호 판단 원문'),h.container);await h.change('확정 설계',h.f.planDoc.ref.id);await wait(()=>h.container.textContent.includes('NODE_DECISION_SOURCE_CONFLICT'),h.container);assert.equal(!!h.node('보호 판단 원문'),false);assert.equal(h.q.calls.filter(v=>v.method==='POST').length,1);}finally{await h.close();}});
test('재봉인된 다른 판단값 응답도 원 packet의 receipt로 먼저 채택하지 않는다',async()=>{const f=await nodeDecisionFixture(),q=await nodeDecisionTransport(f),transport=async(input:any,init:any)=>{const response=await q.transport(input,init);if(init?.method!=='POST')return response;const raw=await response.json();raw.data.snapshot.value='STOP';raw.data.ref.contentHash=H(raw.data.snapshot);return Response.json(raw);},client=new ui.ApiClient(transport),c={client,projectId:f.pid,session:q.session,applicationRef:f.applicationRef,nodeId:'choose',controlGeneration:1},packet=await ui.api.prepareNodeDecision(c,f.basisSelection,[f.design.ref],'GO','원 입력 고정',null,false,()=>true);await assert.rejects(ui.api.sendNodeDecision(c,packet,()=>true,()=>{}));assert.equal(ui.api.nodeDecisionPacketState(packet).receipt,null);assert.equal(f.versions[0].snapshot_json.value,'GO');assert.equal(q.calls.filter(v=>v.method==='POST').length,1);});
test('기존v1 새진입에서 자료를 명시 선택해도 같은 stream 정정·철회의 원 head CAS가 유지된다',async()=>{const h=await mount(false,true);try{await h.select();await h.click('판단 기록');await wait(()=>h.f.versions.length===2&&h.container.textContent.includes('보관 버전 2'),h.container);await h.change('판단 이유','새 화면의 명시 철회');await h.click('판단 철회');await wait(()=>h.f.versions.length===3&&h.container.textContent.includes('REVOKED'),h.container);const posted=h.q.calls.filter(v=>v.method==='POST').map(v=>JSON.parse(v.body!));assert.deepEqual(posted.map(c=>c.expectedVersion),[1,2]);assert.equal(posted[0].targetId,h.f.versions[0].stream_id);assert.equal(h.f.versions[2].snapshot_json.status,'REVOKED');assert(!h.container.textContent.includes('원 명령의 결과가 불명'));}finally{await h.close();}});
test('실제 App의 같은 node 복귀는 새 보호 목록 HOLD·403에서 옛본문0이고 원 receipt만 보존한다',async()=>{const h=await mount(true);try{await wait(()=>!!h.node('적용 절차 조회'),h.container);await h.click('적용 절차 조회');await wait(()=>!!h.node('절차 정의: 사람 판단'),h.container);await h.click('절차 정의: 사람 판단');await h.select();await h.click('판단 기록');await wait(()=>!!h.node('보호 판단 원문'),h.container);const original=h.q.calls.find(v=>v.method==='POST')!.body;await h.click('절차 정의: 완료 정의');h.q.modes.read='HOLD_LIST';await h.click('절차 정의: 사람 판단');await wait(()=>h.q.enteredRead(),h.container);assert.equal(!!h.node('보호 판단 원문'),false);h.f.state.readAllowed=false;h.q.modes.read='NORMAL';await ui.React.act(async()=>{h.q.releaseRead();await tick();});await wait(()=>h.container.textContent.includes('PROJECT_OPERATION_DENIED'),h.container);assert.equal(!!h.node('보호 판단 원문'),false);assert(h.container.textContent.includes('원 저장 응답을 보존'));h.f.state.readAllowed=true;await h.click('이력 보호 재조회');await wait(()=>!!h.node('보호 판단 원문'),h.container);assert.equal(h.q.calls.filter(v=>v.method==='POST').length,1);assert.equal(h.q.calls.find(v=>v.method==='POST')!.body,original);}finally{await h.close();}});
