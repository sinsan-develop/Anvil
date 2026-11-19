import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import type {MethodologyNode} from '../../../contracts/methodologies.ts';
import {stageDocumentFixture} from '../UI06/stage-document-fixture.ts';
import {readMethodDraftFile} from '../../../apps/web/src/features/methodology-editor/method-draft-import.ts';
import {validateMethodologyGraph} from '../../../apps/server/modules/methodologies/service.ts';
import {readStageOutputItem} from '../../../apps/server/modules/documents/document-stage.ts';
import {prepareStageDocumentDraft} from '../../../apps/web/src/features/design-trace/stage-document-draft.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';

/** 실제 ReactDOM의 요소/이벤트/effect를 실행하는 최소 메모리 DOM. 레이아웃·브라우저 보안·시각 검증은 아니다. */
class MemoryNode{
 nodeType:number;nodeName:string;tagName:string;localName:string;namespaceURI='http://www.w3.org/1999/xhtml';parentNode:MemoryNode|null=null;childNodes:MemoryNode[]=[];ownerDocument:any;attributes=new Map<string,string>();style:Record<string,unknown>={};listeners=new Map<string,Function[]>();value='';checked=false;disabled=false;data='';
 constructor(name:string,type=1,owner?:any){this.nodeType=type;this.nodeName=type===1?name.toUpperCase():name;this.tagName=this.nodeName;this.localName=name;this.ownerDocument=owner;}
 get nodeValue():string|null{return this.nodeType===3?this.data:null;}set nodeValue(v:string|null){if(this.nodeType===3)this.data=v??'';}
 get options():MemoryNode[]{return this.childNodes.flatMap(n=>n.tagName==='OPTION'?[n]:n.options);}
 get firstChild():MemoryNode|null{return this.childNodes[0]??null;}get lastChild():MemoryNode|null{return this.childNodes.at(-1)??null;}get nextSibling():MemoryNode|null{const a=this.parentNode?.childNodes;return a?.[a.indexOf(this)+1]??null;}
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
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/methodology-editor/NodeDocumentFields.tsx',import.meta.url)),client=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:node-documents',name:'NodeDocumentsTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'node-documents-memory',resolveId(id){if(id.endsWith('virtual:node-documents'))return '\0node-documents';},load(id){if(id==='\0node-documents')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{NodeDocumentFields}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(client)};export{React,createRoot,NodeDocumentFields,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return NodeDocumentsTest;')();
});
after(()=>{for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});

async function editor(initial:MethodologyNode,form:ReturnType<typeof stageDocumentFixture>['form']){
 let node=initial;const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 function View(){const[value,setValue]=ui.React.useState(initial);node=value;return ui.React.createElement(ui.NodeDocumentFields,{node:value,nodes:[value],forms:[form],onChange:(patch:Partial<MethodologyNode>)=>setValue((old:MethodologyNode)=>({...old,...patch}))});}
 await ui.React.act(async()=>root.render(ui.React.createElement(View)));
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 return{node:()=>node,click:async(label:string)=>{const button=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===label);assert(button);assert(!button.disabled);await ui.React.act(async()=>button.dispatchEvent({type:'click',button:0}));},close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
const hash=(v:unknown)=>contentHash(canonicalJson(v));

test('200자 단계의 실제 추가 버튼 산출물을 FN03 고정 선택과 서버 항목 검산이 소비한다',async()=>{
 const f=stageDocumentFixture(),graph=f.application.snapshot.graph,id='단계'.repeat(100);
 graph.nodes[0]!.nodeId=id;graph.entryNodeId=id;graph.terminalNodeIds=[id];
 const imported=readMethodDraftFile(JSON.stringify({name:'긴 단계',purpose:'단계 산출물 준비',scope:'USER_COMMON',graph,reason:'사용자 정의'}),'USER_COMMON');
 assert.equal(imported.graph.nodes[0]!.nodeId.length,200);
 assert.equal(validateMethodologyGraph(imported.graph,[f.form.ref]).validForConfirmation,true);
 const original=structuredClone(imported.graph.nodes[0]!),e=await editor(imported.graph.nodes[0]!,f.form);
 try{await e.click('산출 문서 추가');const node=e.node(),item=node.outputs.at(-1)!;
  assert.deepEqual(node.outputs.slice(0,-1),original.outputs);assert.deepEqual(node.inputs,original.inputs);assert.deepEqual(item.formRef,f.form.ref);assert.equal(item.required,true);assert.deepEqual(item.reviewCriteria,[]);
  graph.nodes[0]=node as typeof graph.nodes[number];f.application.snapshot.sourceRef.contentHash=hash(graph);f.choice.applicationRef.contentHash=hash(f.application.snapshot);
  f.options.items[0]!.stageNodeRef.nodeId=id;
  const choice={...f.choice,nodeId:id,itemId:item.itemId},calls:string[]=[];
  const client=new ApiClient(async(url,init)=>{assert.equal(init?.method,'GET');const path=String(url);calls.push(path);const kind=path.includes('/methodology-application')?'application':path.includes('/stage-options')?'options':path.includes('/forms/')?'form':'project';return Response.json(f[kind]);});
  const draft=await prepareStageDocumentDraft(client,choice,f.session,()=>true);
  assert.equal(calls.length,5);assert.equal(draft.preparedStageOutput.itemId,item.itemId);assert.equal(draft.stageNodeRef.nodeId,id);
  assert.deepEqual(readStageOutputItem({applicationRef:choice.applicationRef,itemId:item.itemId}),{applicationRef:choice.applicationRef,itemId:item.itemId});
  assert(item.itemId.length<=200);assert(!item.itemId.includes(id));assert.deepEqual(imported.graph.nodes[0],original);
 }finally{await e.close();}
});

test('새 입력·산출 ID는 양쪽 기존 ID와 충돌하지 않고 원 항목·원본 단계·순서를 보존한다',async()=>{
 const f=stageDocumentFixture(),uuid='12345678-1234-4234-8234-123456789abc',base='DOC-'+uuid;
 const original=Object.getOwnPropertyDescriptor(crypto,'randomUUID');Object.defineProperty(crypto,'randomUUID',{configurable:true,value:()=>uuid});
 const node=structuredClone(f.application.snapshot.graph.nodes[0]!) as MethodologyNode;
 node.nodeId='한글/공백 단계';node.inputs=[{...node.outputs[0]!,itemId:base,sourceNodeId:'원 단계',required:false}];node.outputs[0]!.itemId=base+'-1';
 const before=structuredClone(node),e=await editor(node,f.form);
 try{await e.click('산출 문서 추가');await e.click('입력 문서 추가');await e.click('산출 문서 추가');const next=e.node(),ids=[...next.inputs,...next.outputs].map(v=>v.itemId);
  assert.equal(new Set(ids).size,5);assert(ids.every(id=>id.length<=200));
  assert.deepEqual(next.inputs[0],before.inputs[0]);assert.deepEqual(next.outputs[0],before.outputs[0]);assert.deepEqual(node,before);
  assert(!next.inputs[1]!.itemId.includes(node.nodeId));assert(!next.outputs[1]!.itemId.includes(node.nodeId));
  for(const item of [next.inputs[1]!,next.outputs[1]!]){assert.deepEqual(item.formRef,f.form.ref);assert.equal(item.required,true);assert.deepEqual(item.reviewCriteria,[]);assert.equal(item.sourceNodeId,undefined);}
 }finally{await e.close();if(original)Object.defineProperty(crypto,'randomUUID',original);else Reflect.deleteProperty(crypto,'randomUUID');}
});
