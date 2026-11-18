import test from 'node:test';import assert from 'node:assert/strict';import {ApiClient,ApiError} from '../../../apps/web/src/api/client.ts';import {stageDocumentFixture} from './stage-document-fixture.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
test('같은 양식의 A와 B 중 선택한 B를 저장 전 로컬 선택에 보존한다',async()=>{
 const f=stageDocumentFixture(), node=f.application.snapshot.graph.nodes[0]!;
 node.outputs.push({...node.outputs[0]!,itemId:'B'});
 f.application.snapshot.sourceRef.contentHash=contentHash(canonicalJson(f.application.snapshot.graph));
 f.choice.applicationRef.contentHash=contentHash(canonicalJson(f.application.snapshot));
 const choice={...f.choice,itemId:'B'},a=transport(f);
 const {prepareStageDocumentDraft}=await import('../../../apps/web/src/features/design-trace/stage-document-draft.ts');
 const draft=await prepareStageDocumentDraft(a.client,choice,f.session,()=>true);
 assert.deepEqual(draft.preparedStageOutput,{...choice,controlGeneration:7});
 Object.assign(draft,{title:'선택 검증',body:'본문',reason:'원 선택'});
 const {prepareDocumentSave}=await import('../../../apps/web/src/features/design-trace/editor-api.ts'),pending=await prepareDocumentSave(draft,f.session);
 assert.deepEqual(pending.stageOutputItem,{applicationRef:choice.applicationRef,itemId:'B'});assert.equal(Object.hasOwn(pending.upload.payload,'stageOutputItem'),false);
 choice.formRef.version++;assert.notEqual(draft.preparedStageOutput.formRef.version,choice.formRef.version);
});
const m=await import(new URL('../../../apps/web/src/features/design-trace/stage-document-draft.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const prepare=()=>{assert.equal(typeof m.prepareStageDocumentDraft,'function');return m.prepareStageDocumentDraft;};
test('첫 프로젝트 GET 뒤 원 주체 또는 transport가 바뀌면 적용본 GET을 시작하지 않는다',async()=>{
 for(const mode of ['user','transport']){
  const f=stageDocumentFixture(),calls:string[]=[];
  const client=new ApiClient(async path=>{
   calls.push(String(path));
   if(mode==='user')f.session.user.id=f.projectId;
   else Object.defineProperty(client,'transport',{value:async()=>{throw Error('다른 포트 호출');}});
   return Response.json(f.project);
  });
  await assert.rejects(prepare()(client,f.choice,f.session,()=>true),{code:'STAGE_DOCUMENT_PREPARATION_PAUSED'});
  assert.equal(calls.length,1);
 }
});
test('주 작업 선택 단계의 적용버전·노드가 다르면 산출물 목록을 채택하지 않는다',async()=>{for(const expected of [{applicationRef:{...stageDocumentFixture().choice.applicationRef,version:3},nodeId:'DESIGN'},{applicationRef:stageDocumentFixture().choice.applicationRef,nodeId:'MISSING'}]){const f=stageDocumentFixture(),a=transport(f);await assert.rejects(m.readStageDocumentApplication(a.client,f.projectId,()=>true,expected),ApiError);}const f=stageDocumentFixture(),a=transport(f),v=await m.readStageDocumentApplication(a.client,f.projectId,()=>true,{applicationRef:f.choice.applicationRef,nodeId:'DESIGN'});assert.equal(v.snapshot.graph.nodes[0].nodeId,'DESIGN');assert.equal(a.calls.length,2);});
test('목록 대기 중 선택 적용 ref를 바꿔 최초 불일치 선택을 합격시키지 않는다',async()=>{const f=stageDocumentFixture(),a=transport(f),scope={applicationRef:{...f.choice.applicationRef,version:3},nodeId:'DESIGN'},request=m.readStageDocumentApplication(a.client,f.projectId,()=>true,scope);scope.applicationRef.version=2;await assert.rejects(request,ApiError);});
function transport(f:ReturnType<typeof stageDocumentFixture>,alter:(kind:string,v:any)=>any=(_k,v)=>v){const calls:string[]=[];return{calls,client:new ApiClient(async(url,init)=>{assert.equal(init?.method,'GET');const path=String(url);calls.push(path);const kind=path.includes('/methodology-application')?'application':path.includes('/stage-options')?'options':path.includes('/forms/')?'form':'project';return Response.json(alter(kind,f[kind]));})};}
test('선택한 적용 단계 산출물로 본문/제목이 빈 미저장 초안만 만든다',async()=>{const f=stageDocumentFixture(),a=transport(f),v=await prepare()(a.client,f.choice,f.session,()=>true);assert.equal(v.documentId,null);assert.equal(v.baseVersion,0);assert.equal(v.title,'');assert.equal(v.body,'');assert.equal(v.pending,null);assert.deepEqual(v.formRef,f.form.ref);assert.deepEqual(v.stageNodeRef,{applicationId:f.choice.applicationRef.id,nodeId:'DESIGN'});assert.equal(v.controlGeneration,7);assert.equal(v.dirty,true);assert.equal(a.calls.length,5);});
test('적용 세대/산출물/양식이 바뀌면 다른 양식이나 최신 적용본을 채택하지 않는다',async()=>{for(const patch of [{nodeId:'MISSING'},{itemId:'MISSING'},{formRef:{id:'66666666-6666-4666-8666-666666666666',version:1,contentHash:'e'.repeat(64)}},{applicationRef:{id:'44444444-4444-4444-8444-444444444444',version:3,contentHash:'e'.repeat(64)}}]){const f=stageDocumentFixture(),a=transport(f);await assert.rejects(prepare()(a.client,{...f.choice,...patch},f.session,()=>true),ApiError);assert.equal(a.calls.some(p=>p.includes('/forms/')),false);}});
test('stage-options의 INPUT만/다른 적용hash는 준비를 차단한다',async()=>{for(const change of ['INPUT','HASH']){const f=stageDocumentFixture(),a=transport(f,(kind,v)=>kind==='options'?change==='INPUT'?{...v,items:v.items.map((i:any)=>({...i,uses:['INPUT']}))}:{...v,applicationRef:{...v.applicationRef,contentHash:'e'.repeat(64)}}:v);await assert.rejects(prepare()(a.client,f.choice,f.session,()=>true),ApiError);assert.equal(a.calls.length,4);}});
test('현재 제어client/소유자 거절·닫힌 준비는 빈 초안을 발급하지 않는다',async()=>{const f=stageDocumentFixture(),a=transport(f,(kind,v)=>kind==='project'?{...v,participation:'VIEWER'}:v);await assert.rejects(prepare()(a.client,f.choice,f.session,()=>true),(e:any)=>e.status===403);const b=transport(f);await assert.rejects(prepare()(b.client,f.choice,f.session,()=>false),ApiError);assert.equal(b.calls.length,0);let active=true,count=0;await assert.rejects(prepare()(new ApiClient(async()=>{count++;active=false;return Response.json(f.project);}),f.choice,f.session,()=>active),ApiError);assert.equal(count,1);});
test('적용본 없음과 표시 한도 초과는 가짜 산출물이나 일부 성공으로 바꾸지 않는다',async()=>{assert.equal(typeof m.readStageDocumentApplication,'function');const f=stageDocumentFixture(),a=transport(f,(kind,v)=>kind==='project'?{...v,currentMethodologyRef:null}:kind==='application'?{...v,applicationRef:null,snapshot:null}:v);const empty=await m.readStageDocumentApplication(a.client,f.projectId,()=>true);assert.equal(empty.snapshot,null);assert.equal(a.calls.length,2);const g=stageDocumentFixture();g.application.snapshot.graph.nodes=Array.from({length:201},(_,n)=>({...structuredClone(g.application.snapshot.graph.nodes[0]!),nodeId:n?'NODE'+n:'DESIGN'}));g.application.snapshot.sourceRef.contentHash=contentHash(canonicalJson(g.application.snapshot.graph));g.application.applicationRef.contentHash=contentHash(canonicalJson(g.application.snapshot));const b=transport(g);await assert.rejects(m.readStageDocumentApplication(b.client,g.projectId,()=>true),(e:any)=>e.code==='STAGE_DOCUMENT_DISPLAY_LIMIT');assert.equal(b.calls.length,2);});
test('양식 응답 후 닫힌 준비는 stage-options와 제어권 후속 GET도 보내지 않는다',async()=>{const f=stageDocumentFixture();let active=true;const a=transport(f,(kind,v)=>{if(kind==='form')active=false;return v;});await assert.rejects(prepare()(a.client,f.choice,f.session,()=>active),ApiError);assert.equal(a.calls.length,3);assert.equal(a.calls.some(path=>path.includes('/stage-options')),false);});

test('IX01 산출물 여정 RAM: 선택 B를 저장 영수증·고정 조회·새 client 조회까지 보존한다',async()=>{
 const {prepareDocumentSave,continueDocumentSave,documentDraftHash}=await import('../../../apps/web/src/features/design-trace/editor-api.ts');
 const {readDocument}=await import('../../../apps/web/src/features/design-trace/api.ts');
 const f=stageDocumentFixture(),node=f.application.snapshot.graph.nodes[0]!;
 node.outputs.push({...node.outputs[0]!,itemId:'B'});
 f.application.snapshot.sourceRef.contentHash=contentHash(canonicalJson(f.application.snapshot.graph));
 f.choice.applicationRef.contentHash=contentHash(canonicalJson(f.application.snapshot));
 const choice={...f.choice,itemId:'B'},expected={applicationRef:structuredClone(choice.applicationRef),itemId:'B'};
 const stage={applicationId:choice.applicationRef.id,nodeId:choice.nodeId},base=transport(f);
 const documentId='66666666-6666-4666-8666-666666666666',artifactId='77777777-7777-4777-8777-777777777777';
 const body='IX01 명시 선택 B의 원문',bytes=new TextEncoder().encode(body);
 let stored:import('../../../apps/web/src/features/design-trace/api.ts').DocumentVersion|undefined;
 let posts=0,reads=0,wrongReceipt=false,wrongRead=false;
 const fetcher:ConstructorParameters<typeof ApiClient>[0]=async(url,init)=>{
  const path=String(url);
  if(init?.method==='POST'){
   posts++;
   const command=JSON.parse(path.endsWith('/files')?new Headers(init.headers).get('X-Anvil-Command')!:String(init.body)) as import('../../../apps/web/src/features/design-trace/editor-api.ts').DocumentWrite;
   const common={commandId:command.commandId,projectId:f.projectId,status:'APPLIED',operationId:documentId,serverReceivedAt:'2026-11-18T00:00:00.000Z'};
   if(path.endsWith('/files')){
    assert.equal(Object.hasOwn(command.payload,'stageOutputItem'),false);
    assert.deepEqual(new Uint8Array(init.body as Uint8Array),bytes);
    return Response.json({...common,targetId:artifactId,version:null,data:{status:'ARTIFACT_READY',artifactRef:{artifactId,...command.payload}}});
   }
   assert.equal(command.operation,'saveDocumentDraft');assert.equal(command.targetId,null);assert.equal(command.expectedVersion,0);
   assert.deepEqual(command.payload.stageOutputItem,expected);
   const content=command.payload.content as import('../../../apps/web/src/features/design-trace/editor-api.ts').DocumentContent;
   const digest=await documentDraftHash(String(command.payload.title),f.form.ref,content,stage);
   stored={id:documentId,version:1,title:String(command.payload.title),formRef:f.form.ref,content,contentHash:digest,confirmed:false,
    stageNodeRef:stage,stageBinding:{applicationRef:expected.applicationRef,methodologyName:f.application.snapshot.name,nodeId:choice.nodeId,nodeName:node.name,uses:['OUTPUT']},
    stageOutputItem:structuredClone(expected),validation:{validForConfirmation:false,issues:[]},statusHistory:[],
    contentReviewCriteria:{criteriaVersion:1,formRef:f.form.ref,items:[]},contentReviews:[]};
   return Response.json({...common,targetId:documentId,version:1,data:{status:'DRAFT',ref:{id:documentId,version:1,contentHash:digest},stageOutputItem:wrongReceipt?{...expected,itemId:node.outputs[0]!.itemId}:expected}});
  }
  if(path===`/api/v1/projects/${f.projectId}/documents/${documentId}/versions/1`){
   assert(stored);reads++;return Response.json(wrongRead?{...stored,stageOutputItem:{...expected,itemId:node.outputs[0]!.itemId}}:stored);
  }
  if(path===`/api/v1/projects/${f.projectId}/files/${artifactId}`)return new Response(bytes,{headers:{'content-type':'application/octet-stream'}});
  return base.client.transport(url,init);
 };
 const client=new ApiClient(fetcher);
 const draft=await prepare()(client,choice,f.session,()=>true);
 Object.assign(draft,{title:'IX01 B 문서',body,reason:'선택한 산출물만 저장'});
 const pending=await prepareDocumentSave(draft,f.session);assert.deepEqual(pending.stageOutputItem,expected);
 let savedPending=pending;
 const ref=await continueDocumentSave(client,pending,f.session,value=>{savedPending=value;},()=>true);
 assert.equal(posts,2);assert(stored);
 async function fixed(reader:ApiClient){
  const view=await readDocument(reader,f.projectId,ref.id,ref.version,{expectedContentHash:ref.contentHash,expectedStage:stage});
  assert.deepEqual(view.document.stageOutputItem,expected);assert.equal(view.body,body);return view;
 }
 const before=await fixed(client),after=await fixed(new ApiClient(fetcher));assert.deepEqual(after,before);assert.equal(reads,2);assert.equal(posts,2);
 wrongRead=true;await assert.rejects(fixed(new ApiClient(fetcher)),assert.AssertionError);wrongRead=false;
 wrongReceipt=true;await assert.rejects(continueDocumentSave(client,savedPending,f.session,()=>{},()=>true),e=>e instanceof ApiError&&e.code==='RESPONSE_INVALID');
 assert.equal(posts,3); // 명시 재확인의 저장 POST만; 기존 upload 재발행 없음.
});
