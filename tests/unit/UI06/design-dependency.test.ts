import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const id=(n:number)=>`a6f30000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ref={id:id(1),version:2,contentHash:'a'.repeat(64)},session={user:{id:id(2)},clientId:id(3),csrfToken:'C'.repeat(43)};
test('비동기 문서 준비와 설계 의존 진입은 한 번에 하나이며 옛 해제는 새 준비를 풀지 않는다',async()=>{
 const m:any=await import('../../../apps/web/src/features/design-trace/document-preparation-gate.ts').catch(()=>null);assert.ok(m);const gate=m.createDocumentPreparationGate(),release=gate.acquire();assert.equal(typeof release,'function');assert.equal(gate.acquire(),null);release();const next=gate.acquire();release();assert.equal(gate.acquire(),null);next();assert.equal(typeof gate.acquire(),'function');
});
function fixture(){return {ownerUserId:session.user.id,projectId:id(4),documentId:ref.id,baseVersion:2,baseHash:ref.contentHash,controlGeneration:3,items:[1,2].map(n=>({id:id(n+10),documentRef:ref,localCode:`D0${n}`,title:`항목${n}`,anchor:`line:${n}`,itemHash:'b'.repeat(64)}))};}
test('화면 상세화는 등록된 화면의 고정 원문과 같은 인덱스 설계만 REFINES로 연결한다',async()=>{
 const m:any=await import('../../../apps/web/src/features/design-trace/design-dependency.ts'),base=fixture(),screenRef={...ref,id:id(6),version:4},screen={id:id(7),designItemId:base.items[0]!.id,screenCode:'S01',documentRef:screenRef,artifactRef:{artifactId:id(8),bytes:10,contentHash:'c'.repeat(64),mediaType:'text/markdown;charset=utf-8'},anchor:'line:3',regionHash:'d'.repeat(64)},b={...base,screenRegions:[screen]},s=m.newDesignDependency(b,'REFINES');
 s.fromId=screen.id;s.toId=base.items[1]!.id;s.reason='설계 내용의 화면 상세화';const command=m.prepareDesignDependency(b,s,session);assert.equal(command.payload.relation,'REFINES');assert.deepEqual(command.payload.from,{kind:'SCREEN_REGION',id:screen.id,versionRef:screenRef,localCode:'S01',anchor:'line:3'});assert.equal(command.payload.to.kind,'DESIGN_ITEM');assert.throws(()=>m.prepareDesignDependency(b,{...s,fromId:base.items[0]!.id},session));
 let sent:any;const client=new ApiClient(async(_p:any,o:any)=>{sent=JSON.parse(o.body);const data={...sent.payload,designRefs:[ref]},edgeHash=contentHash(canonicalJson(data)),edge={id:id(9),...data,edgeHash,createdAt:'2026-10-25T00:00:00Z'};return new Response(JSON.stringify({commandId:sent.commandId,projectId:b.projectId,operationId:id(10),status:'APPLIED',targetId:edge.id,version:1,serverReceivedAt:edge.createdAt,data:{status:'TRACE_LINKED',ref:{id:edge.id,version:1,contentHash:edgeHash},edge}}),{headers:{'content-type':'application/json'}});});s.pending=command;assert.equal((await m.sendDesignDependency(client,b,s,session,()=>true)).relation,'REFINES');
});
test('같은 명령 성공 뒤 옛 화면 요청 실패는 성공과 닫기 가능성을 덮지 않는다',async()=>{
 const m:any=await import('../../../apps/web/src/features/design-trace/design-dependency.ts');assert.equal(typeof m.keepDependencyFailure,'function');const s=m.newDesignDependency(fixture());s.pending={commandId:id(8)};s.result={id:id(9)};const result=m.keepDependencyFailure(s,id(8),{code:'CONNECTION_LOST',status:0});assert.equal(result,s);assert.equal(result.uncertain,false);
 const pending={...s,result:null};assert.equal(m.keepDependencyFailure(pending,id(7),{code:'CONNECTION_LOST',status:0}),pending);assert.equal(m.keepDependencyFailure(pending,id(8),{code:'CONNECTION_LOST',status:0}).uncertain,true);
});
test('설계 의존 저장 준비는 같은 고정 인덱스의 서로 다른 항목만 허용한다',async()=>{
 const m:any=await import('../../../apps/web/src/features/design-trace/design-dependency.ts').catch(()=>null);assert.ok(m,'설계 의존 저장 소비자가 필요하다');
 const b=fixture(),s=m.newDesignDependency(b);s.fromId=b.items[0]!.id;s.toId=b.items[1]!.id;s.reason='선행 계약에 의존';
 const c=m.prepareDesignDependency(b,s,session);assert.equal(c.operation,'linkTrace');assert.equal(c.payload.relation,'DEPENDS_ON');assert.deepEqual(c.payload.from.versionRef,ref);
 assert.throws(()=>m.prepareDesignDependency(b,{...s,toId:s.fromId},session));assert.throws(()=>m.prepareDesignDependency(b,s,{...session,user:{id:id(9)}}));const duplicate={...b,items:[b.items[0],b.items[0],b.items[1]]};assert.throws(()=>m.prepareDesignDependency(duplicate,{...s,context:structuredClone(duplicate)},session));
});
test('설계 의존 저장은 응답유실 뒤 같은 명령을 재확인하고 변조·이탈을 거절한다',async()=>{
 const m:any=await import('../../../apps/web/src/features/design-trace/design-dependency.ts').catch(()=>null);assert.ok(m);
 const b=fixture(),s=m.newDesignDependency(b);s.fromId=b.items[0]!.id;s.toId=b.items[1]!.id;s.reason='기존 계약 연결';s.pending=m.prepareDesignDependency(b,s,session);
 const sent:string[]=[];const client=new ApiClient(async(_p:any,o:any)=>{sent.push(o.body);if(sent.length===1)throw Error('연결 단절');const c=JSON.parse(o.body),data={...c.payload,designRefs:[ref]},edgeHash=contentHash(canonicalJson(data)),edge={id:id(8),...data,edgeHash,createdAt:'2026-10-25T00:00:00Z'};return new Response(JSON.stringify({commandId:c.commandId,projectId:b.projectId,operationId:id(9),status:'APPLIED',targetId:edge.id,version:1,serverReceivedAt:edge.createdAt,data:{status:'TRACE_LINKED',ref:{id:edge.id,version:1,contentHash:edgeHash},edge}}),{headers:{'content-type':'application/json'}});});
 await assert.rejects(m.sendDesignDependency(client,b,s,session,()=>true));const result=await m.sendDesignDependency(client,b,s,session,()=>true);assert.equal(result.relation,'DEPENDS_ON');assert.equal(sent[0],sent[1]);
 await assert.rejects(m.sendDesignDependency(client,b,{...s,reason:'변조'},session,()=>true));assert.equal(sent.length,2);
 await assert.rejects(m.sendDesignDependency(client,b,s,session,()=>false));assert.equal(sent.length,2);
 let active=true;const delayed=new ApiClient(async(p:any,o:any)=>{const r=await client.transport(p,o);active=false;return r;});await assert.rejects(m.sendDesignDependency(delayed,b,s,session,()=>active));
});
