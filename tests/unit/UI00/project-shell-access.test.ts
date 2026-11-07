import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';

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

const projectA='11111111-1111-4111-8111-111111111111';
const projectB='22222222-2222-4222-8222-222222222222';
const userId='33333333-3333-4333-8333-333333333333';
const clientId='44444444-4444-4444-8444-444444444444';
const session={user:{id:userId,displayName:'합성 사용자'},clientId,csrfToken:'a'.repeat(43)};
const at='2026-10-20T00:00:00Z';
const action='프로젝트 접근 상태 확인';
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const project=(id:string,participation='OWNER',status='HELD')=>({
  id,name:'합성 프로젝트',purpose:'읽기',desiredOutcome:'기록 조회',version:1,createdAt:at,updatedAt:at,
  currentMethodologyRef:null,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,
  readinessIssues:[{code:'METHODOLOGY_CONNECTION_PENDING'}],viewerPermissions:['READ_PROJECT'],participation,
  controlState:status==='UNASSIGNED'?{actorId:null,clientId:null,generation:null,status}:{actorId:userId,clientId,generation:3,status},
});

let bundle:Promise<string>|undefined;
function appCode(){
  return bundle??=Promise.resolve().then(async()=>{
    const app=fileURLToPath(new URL('../../../apps/web/src/App.tsx',import.meta.url));
    const shell=fileURLToPath(new URL('../../../apps/web/src/shell/AppShell.tsx',import.meta.url));
    const api=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));
    const result:any=await build({
      configFile:false,envDir:false,publicDir:false,logLevel:'silent',
      define:{'process.env.NODE_ENV':JSON.stringify('development')},
      build:{write:false,minify:false,lib:{entry:'virtual:project-shell-access',name:'ProjectShellAccessTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},
      plugins:[{name:'project-shell-memory-entry',resolveId(id){if(id.endsWith('virtual:project-shell-access'))return '\\0project-shell-access';},
        load(id){if(id==='\\0project-shell-access')return "import * as React from 'react';import{createRoot}from'react-dom/client';import{App}from"+JSON.stringify(app)+";import{AppShell}from"+JSON.stringify(shell)+";import{ApiClient}from"+JSON.stringify(api)+";export{React,createRoot,App,AppShell,ApiClient};";}}],
    });
    return (Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ProjectShellAccessTest;';
  });
}

async function mount(){
  const code=await appCode();
  const saved=new Map<string,PropertyDescriptor|undefined>();
  const channels:MessageChannel[]=[];
  const events=new Map<string,Set<Function>>();
  const requests:{path:string;method:string}[]=[];
  const document:any=new MemoryNode('#document',9);
  document.ownerDocument=document;
  document.createElement=(name:string)=>new MemoryNode(name,1,document);
  document.createElementNS=(_ns:string,name:string)=>document.createElement(name);
  document.createTextNode=(text:string)=>{const n=new MemoryNode('#text',3,document);n.data=text;return n;};
  document.documentElement=document.createElement('html');
  document.body=document.createElement('body');
  document.documentElement.appendChild(document.body);
  document.activeElement=document.body;
  document.getElementById=()=>null;
  const location=new URL('https://anvil.invalid/#/projects');
  const addEventListener=(name:string,handler:Function)=>{
    const handlers=events.get(name)??new Set<Function>();
    handlers.add(handler);
    events.set(name,handlers);
  };
  const removeEventListener=(name:string,handler:Function)=>events.get(name)?.delete(handler);
  const window={document,location,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener,removeEventListener,getComputedStyle:()=>({})};
  document.defaultView=window;
  const NativeChannel=globalThis.MessageChannel;
  class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
  let onProject=(id:string):Response|Promise<Response>=>response(project(id));
  const fetch:typeof globalThis.fetch=async(input,init)=>{
    const path=String(input),method=init?.method??'GET';
    requests.push({path,method});
    assert(path.startsWith('/api/v1/'));
    assert.equal(init?.credentials,'same-origin');
    if(path==='/api/v1/session')return response(session);
    if(path.startsWith('/api/v1/projects?'))return response({items:[],nextCursor:null,hasMore:false,observedAt:at,baselineVersion:null});
    const match=/^\/api\/v1\/projects\/([\da-f-]+)$/.exec(path);
    if(match)return onProject(match[1]!);
    return response({code:'NOT_FOUND'},404);
  };
  for(const [key,value]of Object.entries({window,document,location,fetch,addEventListener,removeEventListener,HTMLElement:MemoryNode,Node:MemoryNode,MessageChannel:OwnedChannel,IS_REACT_ACT_ENVIRONMENT:true})){
    saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  }
  const ui=new Function(code)();
  const container=document.createElement('main') as MemoryNode;
  document.body.appendChild(container);
  const root=ui.createRoot(container);
  const nodes=(node=container):MemoryNode[]=>[node,...node.childNodes.flatMap(v=>nodes(v))];
  const header=()=>nodes().find(n=>n.tagName==='HEADER'&&n.getAttribute('class')==='topbar')!;
  const flush=()=>ui.React.act(async()=>{await new Promise(resolve=>setImmediate(resolve));});
  const wait=async(check:()=>boolean)=>{
    for(let n=0;n<80&&!check();n++)await flush();
    assert(check(),header().textContent);
  };
  const click=async(label:string,scope:MemoryNode=header())=>{
    const target=nodes(scope).find(n=>n.tagName==='BUTTON'&&n.textContent===label);
    assert(target,'상단에 프로젝트 접근 상태 확인 동작이 필요합니다');
    assert.equal(target.disabled,false);
    await ui.React.act(async()=>target.dispatchEvent({type:'click',button:0,bubbles:true}));
  };
  const nav=async(hash:string)=>ui.React.act(async()=>{
    location.hash=hash;
    for(const fn of events.get('hashchange')??[])fn();
  });
  const close=async()=>{
    await ui.React.act(async()=>root.unmount());
    for(const c of channels){c.port1.close();c.port2.close();}
    for(const [key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);
  };
  return {ui,root,container,nodes,header,click,nav,close,wait,flush,requests,setProject:(next:typeof onProject)=>{onProject=next;}};
}

test('실제 App 상단에서 기존 보호 GET을 명시 조회하고 같은 프로젝트 화면 이동에 결과를 유지한다',async()=>{
  const h=await mount();
  try{
    await h.ui.React.act(async()=>h.root.render(h.ui.React.createElement(h.ui.App)));
    await h.wait(()=>h.header().textContent.includes('합성 사용자'));
    assert(!h.header().textContent.includes(action));
    await h.nav('#/projects/'+projectA+'/control');
    const details=()=>h.requests.filter(r=>r.path==='/api/v1/projects/'+projectA);
    assert.equal(details().length,0);
    const requestedAt=Date.now();
    await h.click(action);
    await h.wait(()=>h.header().textContent.includes('브라우저 수신 시각'));
    const time=h.nodes(h.header()).find(n=>n.tagName==='TIME');
    const receivedAt=Date.parse(time?.getAttribute('datetime')??time?.getAttribute('dateTime')??'');
    assert(receivedAt>=requestedAt&&receivedAt<=Date.now());
    assert.match(h.header().textContent,/소유자/);
    assert.match(h.header().textContent,/이 로그인·기기에 제어 기록 있음/);
    assert(!h.header().textContent.includes(userId));
    assert(!h.header().textContent.includes(clientId));
    assert(!h.header().textContent.includes('METHODOLOGY_CONNECTION_PENDING'));
    await h.nav('#/projects/'+projectA+'/session');
    assert.match(h.header().textContent,/소유자/);
    assert.equal(details().length,1);
    assert(h.requests.every(r=>r.method==='GET'));
  }finally{
    await h.close();
  }
});

async function openApp(h:Awaited<ReturnType<typeof mount>>,hash='#/projects/'+projectA+'/control'){
  await h.ui.React.act(async()=>h.root.render(h.ui.React.createElement(h.ui.App)));
  await h.wait(()=>h.header().textContent.includes('합성 사용자'));
  await h.nav(hash);
}

test('재조회는 이전 결과를 숨기고 403과 연결 오류 뒤 명시 재조회로 복구한다',async()=>{
  const h=await mount();
  try{
    await openApp(h);
    await h.click(action);
    await h.wait(()=>h.header().textContent.includes('소유자'));
    const pending=Promise.withResolvers<Response>();
    h.setProject(()=>pending.promise);
    await h.click(action);
    assert.match(h.header().textContent,/조회 중/);
    assert.doesNotMatch(h.header().textContent,/소유자|브라우저 수신 시각/);
    await h.ui.React.act(async()=>pending.resolve(response({code:'PROJECT_ACCESS_DENIED',message:'비공개 오류 본문'},403)));
    await h.wait(()=>h.header().textContent.includes('조회할 수 없습니다'));
    assert.doesNotMatch(h.header().textContent,/비공개 오류 본문|소유자|브라우저 수신 시각/);
    h.setProject(()=>{throw Error('합성 연결 오류');});
    await h.click(action);
    await h.wait(()=>h.header().textContent.includes('확인하지 못했습니다'));
    h.setProject(id=>response(project(id,'VIEWER','UNASSIGNED')));
    await h.click(action);
    await h.wait(()=>h.header().textContent.includes('조회자'));
    assert.match(h.header().textContent,/현재 유효한 제어 기록 없음/);
    assert(h.requests.every(r=>r.method==='GET'));
  }finally{await h.close();}
});

test('프로젝트 A→B→A에서 늦은 JSON과 지난 요청의 401은 새 상단과 인증을 바꾸지 않는다',async()=>{
  const h=await mount();
  const jsonEntered=Promise.withResolvers<void>();
  const jsonRelease=Promise.withResolvers<void>();
  const rejected=Promise.withResolvers<Response>();
  try{
    await openApp(h);
    const delayed=response(project(projectA));
    const json=delayed.json.bind(delayed);
    delayed.json=async()=>{jsonEntered.resolve();await jsonRelease.promise;return json();};
    h.setProject(()=>delayed);
    await h.click(action);
    await jsonEntered.promise;
    await h.nav('#/projects/'+projectB+'/control');
    assert.doesNotMatch(h.header().textContent,/소유자|조회 중/);
    h.setProject(()=>rejected.promise);
    await h.click(action);
    await h.nav('#/projects/'+projectA+'/control');
    h.setProject(id=>response(project(id,'VIEWER','UNASSIGNED')));
    await h.click(action);
    await h.wait(()=>h.header().textContent.includes('조회자'));
    await h.ui.React.act(async()=>{
      jsonRelease.resolve();
      rejected.resolve(response({code:'AUTH_REQUIRED',message:'오래된 응답'},401));
      await new Promise(resolve=>setImmediate(resolve));
    });
    assert.match(h.header().textContent,/조회자/);
    assert.match(h.header().textContent,/합성 사용자/);
    assert.doesNotMatch(h.header().textContent,/소유자|로그인 확인 필요|오래된 응답/);
    assert(h.requests.every(r=>r.method==='GET'));
  }finally{jsonRelease.resolve();rejected.resolve(response({},401));await h.close();}
});

test('현재 조회의 401 뒤 다시 로그인 문맥을 확인해도 App의 미전송 프로젝트 이름은 유지된다',async()=>{
  const h=await mount();
  try{
    await openApp(h,'#/projects/new');
    const input=()=>{
      const match=h.nodes().find(n=>n.tagName==='INPUT'&&n.getAttribute('id')?.endsWith('-name'));
      assert(match,'프로젝트 이름 입력');
      return match;
    };
    const original=input();
    const key=Object.keys(original).find(k=>k.startsWith('__reactProps$'));
    assert(key);
    await h.ui.React.act(async()=>(original as any)[key].onChange({target:{value:'보존할 미전송 이름'}}));
    assert.equal(input().value,'보존할 미전송 이름');
    await h.nav('#/projects/'+projectA+'/control');
    h.setProject(()=>response({code:'AUTH_REQUIRED',message:'비공개 인증 본문'},401));
    await h.click(action);
    await h.wait(()=>h.header().textContent.includes('접근 확인 전'));
    assert.doesNotMatch(h.header().textContent,/소유자|비공개 인증 본문|프로젝트 접근 상태 확인/);
    await h.click('접근 상태 다시 확인',h.container);
    await h.wait(()=>h.header().textContent.includes('합성 사용자'));
    await h.nav('#/projects/new');
    assert.equal(input().value,'보존할 미전송 이름');
    assert(h.requests.every(r=>r.method==='GET'));
  }finally{await h.close();}
});

test('Session 객체 교체·동일 객체의 스칼라 교체·transport 왕복은 대기 응답을 폐기한다',async()=>{
  for(const mode of ['SESSION','USER_VALUE','CLIENT_VALUE','TRANSPORT','UNMOUNT']){
    const h=await mount();
    const pending=Promise.withResolvers<Response>();
    const requests:string[]=[];
    const originalTransport:typeof fetch=async(input,init)=>{
      requests.push(String(input));
      assert.equal(init?.method,'GET');
      return requests.length===1?pending.promise:response(project(projectA,'VIEWER','UNASSIGNED'));
    };
    const client=new h.ui.ApiClient(originalTransport);
    let current=structuredClone(session);
    let authenticationLost=0;
    const render=()=>h.ui.React.act(async()=>h.root.render(h.ui.React.createElement(h.ui.AppShell,{
      route:{screen:'control',projectId:projectA},
      displayName:current.user.displayName,
      projectAccess:{client,session:current,onAuthenticationLost:()=>authenticationLost++},
    })));
    try{
      await render();
      await h.click(action);
      if(mode==='SESSION'){
        current=structuredClone(current);
        await render();
      }
      if(mode==='USER_VALUE')current.user.id=projectB;
      if(mode==='CLIENT_VALUE')current.clientId=projectB;
      if(mode==='TRANSPORT'){
        client.transport=async()=>assert.fail('transport 변경 시 자동 조회');
        await render();
        client.transport=originalTransport;
        await render();
      }
      if(mode==='UNMOUNT')await h.ui.React.act(async()=>h.root.render(null));
      await h.ui.React.act(async()=>{
        pending.resolve(mode==='UNMOUNT'?response({code:'AUTH_REQUIRED'},401):response(project(projectA)));
        await new Promise(resolve=>setImmediate(resolve));
      });
      assert.doesNotMatch(h.container.textContent,/소유자|브라우저 수신 시각/);
      assert.deepEqual(requests,['/api/v1/projects/'+projectA]);
      assert.equal(authenticationLost,0);
      if(mode==='USER_VALUE'||mode==='CLIENT_VALUE'){
        await h.click(action);
        await h.wait(()=>h.header().textContent.includes('조회자'));
        assert.deepEqual(requests,['/api/v1/projects/'+projectA,'/api/v1/projects/'+projectA]);
        assert.equal(authenticationLost,0);
      }
    }finally{pending.resolve(response({},401));await h.close();}
  }
});
