import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'vite';
import {ApiClient} from '../../../apps/web/src/api/client.ts';

type UI=typeof import('../../../apps/web/src/features/workspace/NormalUnderstandingDiscovery.tsx');
let compiled:Promise<UI>|undefined;
function load(){
 return compiled??=(async()=>{
  const entry=fileURLToPath(new URL('../../../apps/web/src/features/workspace/NormalUnderstandingDiscovery.tsx',import.meta.url));
  const built=await build({configFile:false,logLevel:'error',build:{write:false,lib:{entry,formats:['es']},rollupOptions:{external:['react','react/jsx-runtime']}}});
  const output=Array.isArray(built)?built[0]:built;
  assert.ok(output&&'output'in output);
  const chunk=output.output.find(value=>value.type==='chunk');assert.ok(chunk&&chunk.type==='chunk');
  const code=chunk.code.replace(/(["'])(react(?:\/jsx-runtime)?)\1/g,(_match,_quote,name)=>JSON.stringify(import.meta.resolve(name)));
  return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 })();
}

const id=(n:number)=>`af090102-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
const projectId=id(1),session={user:{id:id(2)},clientId:id(3),csrfToken:'c'.repeat(43)},assignmentRef=ref(5),preparationRef=ref(6);

function fixture(){
 const observedAt=new Date().toISOString(),expiresAt=new Date(Date.now()+30000).toISOString();
 const ready={projectId,assignmentRef,preparationRef,executionId:id(8),executionGeneration:7,observedAt,expiresAt};
 const calls:{path:string;init:RequestInit|undefined}[]=[];
 let bad=false,unknown=false;
 const client=new ApiClient(async(url,init)=>{
  const path=String(url);calls.push({path,init});
  if(path===`/api/v1/projects/${projectId}`)return Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}});
  if(path.includes('understanding-response-readiness?'))return Response.json(bad?{...ready,preparationRef:ref(99)}:ready);
  if(unknown){unknown=false;throw Error('RAM_LOST');}
  const command=JSON.parse(String(init?.body)),requestRef=ref(26);
  return Response.json({operationId:id(24),commandId:command.commandId,projectId,status:'APPLIED',targetId:requestRef.id,version:requestRef.version,
   data:{ref:requestRef,status:'NORMAL_UNDERSTANDING_METADATA_REQUESTED',requestRef,state:'PENDING_SOURCE',sourceAvailable:false,selectionAvailable:false,expiresAt},
   evidenceRefs:[],warnings:[],serverReceivedAt:observedAt});
 });
 return {client,calls,ready,bad:()=>{bad=true;},unknown:()=>{unknown=true;}};
}

test('FN09 Web initial render uses only registered CONTEXT_REVIEW preparation and performs no request',async()=>{
 const m=await load(),f=fixture();
 const preparation=(n:number,mode:string,connectionKind?:string)=>({projectId,ref:ref(n),snapshot:{intent:{mode,connectionKind,assignmentRef}}});
 const markup=renderToStaticMarkup(createElement(m.NormalUnderstandingDiscovery,{client:f.client,session,projectId,assignmentRef,busy:false,
  preparations:[preparation(6,'CONTEXT_REVIEW','REGISTERED_DEFINITION'),preparation(7,'WORK','REGISTERED_DEFINITION'),preparation(9,'CONTEXT_REVIEW')]}));
 assert.ok(markup.includes(preparationRef.id));assert.ok(!markup.includes(id(7)));assert.ok(!markup.includes(id(9)));
 assert.ok(!markup.includes(f.ready.executionId));assert.ok(!markup.includes('최초 이해 자료 탐색 요청'));assert.equal(f.calls.length,0);
});

test('FN09 Web gets only exact selected basis and explicitly retries the same body after an uncertain POST',async()=>{
 const m=await load(),f=fixture(),signal=new AbortController().signal;
 const basis=await m.readNormalUnderstandingBasis(f.client,session,projectId,assignmentRef,preparationRef,signal);
 assert.equal(f.calls.length,2);const readiness=f.calls[1]!;
 assert.equal(readiness.init?.method,'GET');
 const query=new URL(readiness.path,'https://anvil.invalid').searchParams;
 assert.equal(query.get('assignmentId'),assignmentRef.id);assert.equal(query.get('preparationHash'),preparationRef.contentHash);assert.equal(query.has('executionId'),false);
 const command=m.prepareNormalUnderstandingCommand(basis),body=JSON.stringify(command);
 assert.equal(command.targetId,f.ready.executionId);assert.equal(command.expectedVersion,7);assert.equal(command.controlGeneration,9);
 assert.deepEqual(command.payload,{assignmentRef,preparationRef});
 f.unknown();await assert.rejects(m.sendNormalUnderstandingCommand(f.client,session,command,body,signal),{code:'CONNECTION_LOST'});
 assert.equal(f.calls.length,3);
 assert.deepEqual(await m.sendNormalUnderstandingCommand(f.client,session,command,body,signal),ref(26));
 assert.deepEqual(f.calls.slice(2).map(call=>[call.path,call.init?.method,call.init?.body]),[
  [`/api/v1/projects/${projectId}/executions/${f.ready.executionId}/understanding-response-read-requests`,'POST',body],
  [`/api/v1/projects/${projectId}/executions/${f.ready.executionId}/understanding-response-read-requests`,'POST',body]
 ]);
});

test('FN09 Web rejects mismatched preparation projection before any POST',async()=>{
 const m=await load(),f=fixture();f.bad();
 await assert.rejects(m.readNormalUnderstandingBasis(f.client,session,projectId,assignmentRef,preparationRef,new AbortController().signal),{code:'RESPONSE_INVALID'});
 assert.ok(f.calls.every(call=>call.init?.method==='GET'));
});

test('FN09 Web never sends readiness or a late POST through changed scope or transport',async()=>{
 const m=await load(),signal=new AbortController().signal;
 for(const change of ['transport','selection'] as const){
  const f=fixture(),transport=f.client.transport;let active=true,release!:()=>void,replacement=0;
  const waiting=new Promise<void>(resolve=>{release=resolve;});
  f.client.transport=async(...args)=>{await waiting;return transport(...args);};
  const read=m.readNormalUnderstandingBasis(f.client,session,projectId,assignmentRef,preparationRef,signal,()=>active);
  if(change==='transport')f.client.transport=async()=>{replacement++;return Response.json(f.ready);};
  else active=false;
  release();await assert.rejects(read,{code:'DISCOVERY_SCOPE_CHANGED'});assert.equal(replacement,0);assert.equal(f.calls.length,1);
 }
 const f=fixture(),basis=await m.readNormalUnderstandingBasis(f.client,session,projectId,assignmentRef,preparationRef,signal);
 const command=m.prepareNormalUnderstandingCommand(basis);
 await assert.rejects(m.sendNormalUnderstandingCommand(f.client,session,command,JSON.stringify(command),signal,()=>false),{code:'DISCOVERY_SCOPE_CHANGED'});
 assert.equal(f.calls.some(call=>call.init?.method==='POST'),false);
});

test('FN09 Web preserves an uncertain command across an equivalent session projection and isolates other channels',async()=>{
 const m=await load(),f=fixture(),signal=new AbortController().signal;
 const basis=await m.readNormalUnderstandingBasis(f.client,session,projectId,assignmentRef,preparationRef,signal);
 const command=m.prepareNormalUnderstandingCommand(basis),body=JSON.stringify(command),originalTransport=f.client.transport;
 const ledger=m.normalUnderstandingRecords(session,f.client);
 f.unknown();await assert.rejects(m.sendNormalUnderstandingCommand(f.client,session,command,body,signal),{code:'CONNECTION_LOST'});
 ledger.set('original-command-scope',{command,body,state:'UNKNOWN'});
 const props={client:f.client,projectId,assignmentRef,preparations:[],busy:false};
 const render=(projection:typeof session,client=f.client)=>renderToStaticMarkup(createElement(m.NormalUnderstandingDiscovery,{...props,client,session:projection}));
 const refreshed={...session,user:{...session.user}};
 assert.notStrictEqual(refreshed,session);
 assert.strictEqual(m.normalUnderstandingRecords(refreshed,f.client),ledger);
 const markup=render(refreshed);
 assert.ok(markup.includes(command.commandId));assert.ok(markup.includes('같은 탐색 명령 결과 확인'));
 assert.equal(f.calls.filter(call=>call.init?.method==='POST').length,1);
 for(const other of [{...refreshed,csrfToken:'r'.repeat(43)},{...refreshed,clientId:id(30)},
  {...refreshed,user:{id:id(31)}}])assert.ok(!render(other).includes(command.commandId));
 assert.ok(!render(refreshed,new ApiClient(originalTransport)).includes(command.commandId));
 f.client.transport=async()=>{throw Error('UNEXPECTED_TRANSPORT');};
 assert.ok(!render(refreshed).includes(command.commandId));
 f.client.transport=originalTransport;
 const retained=m.normalUnderstandingRecords(refreshed,f.client).get('original-command-scope');
 assert.equal(retained?.state,'UNKNOWN');assert.ok(retained);
 assert.deepEqual(await m.sendNormalUnderstandingCommand(f.client,refreshed,retained.command,retained.body,signal),ref(26));
 assert.deepEqual(f.calls.filter(call=>call.init?.method==='POST').map(call=>call.init?.body),[body,body]);
});
