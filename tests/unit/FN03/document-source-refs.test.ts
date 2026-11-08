import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {mock,test} from 'node:test';
import {constants} from 'node:fs';
import {join,resolve} from 'node:path';
import type {PoolClient} from 'pg';
import type {AuthenticatedIdentity} from '../../../apps/server/modules/access/repository.ts';
import type {ProjectCommand} from '../../../apps/server/modules/access/project-command.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

const id=(n:number)=>'a6f30000-0000-4000-8000-'+String(n).padStart(12,'0');
const pid=id(1),uid=id(2),other=id(3),root=resolve('never-created-fn03-source-refs-memory-root');
const actor:AuthenticatedIdentity={actorId:uid,clientId:id(4),serverOwner:false,credentialGeneration:1,reauthUntil:null};
const form={items:[]},formRef={id:id(5),version:1,contentHash:contentHash(canonicalJson(form))};
type Ref={kind:string;id:string;version?:number;contentHash:string};
// DB 행/인증 주체는 합성이다. 실제 ProjectDocuments/ProjectConversations/ArtifactStore의 읽기는 우회하지 않는다.
test('문서 전체 출처의 실제 저장·보호조회는 메모리 DB/FS 경계에서만 검산한다',async t=>{
 let readHook:(()=>void)|undefined;
 const files=new Map<string,Buffer>(),handles=new Set<object>(),reads:string[]=[],blocked:string[]=[];
 const dirs=new Set([root,join(root,'blobs'),join(root,'blobs',pid),join(root,'blobs',other)]);
 const stat=(path:string)=>{assert.ok(dirs.has(path)||files.has(path),'MEMORY_PATH_NOT_REGISTERED');return {
  isDirectory:()=>dirs.has(path),isFile:()=>files.has(path),isSymbolicLink:()=>false,nlink:1,
  uid:process.getuid?.()??0,mode:dirs.has(path)?0o40700:0o100600,size:files.get(path)?.length??0};};
 const original=await import('node:fs/promises');
 const exports=Object.fromEntries(Object.keys(original).filter(k=>k!=='default').map(k=>[k,()=>{blocked.push(k);throw Error('MEMORY_FS_FORBIDDEN');}]));
 Object.assign(exports,{lstat:async(path:string)=>stat(path),realpath:async(path:string)=>{stat(path);return path;},open:async(path:string,flags:number)=>{
  assert.equal(flags,constants.O_RDONLY|(constants.O_NOFOLLOW??0));assert.ok(files.has(path));
  const h={stat:async()=>stat(path),readFile:async()=>{reads.push(path);readHook?.();return Buffer.from(files.get(path)!);},read:async(buffer:Buffer,offset:number,length:number,position:number)=>{reads.push(path);const n=files.get(path)!.copy(buffer,offset,position,position+length);readHook?.();return {bytesRead:n,buffer};},close:async()=>{assert.ok(handles.delete(h));}};
  handles.add(h);return h;
 }});
 const fsMock=mock.module('node:fs/promises',{exports:{...exports,default:exports}});
 try{
 const {createArtifactBackupReadBudget,readArtifactBackupReadUsage}=await import('../../../apps/server/storage/artifact-backup-budget-read.ts');
 const {ProjectConversations}=await import('../../../apps/server/modules/knowledge/conversations.ts');
 const {readDocumentSourceRefs}=await import('../../../apps/server/modules/documents/document-source-refs.ts');
 const {ProjectDocuments}=await import('../../../apps/server/modules/documents/project-documents.ts');
 const fixture=()=>{
  const artifacts=new Map<string,any>(),versions=new Map<string,any>(),messages=new Map<string,any>(),writes:{sql:string;args:any[]}[]=[],queries:string[]=[];
  let hook:((sql:string)=>void|Promise<void>)|undefined;
  const artifact=(n:number,text='검산할 보관 원문',project=pid)=>{
   const bytes=Buffer.from(text),ref={artifactId:id(n),bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/plain;charset=utf-8'};
   files.set(join(root,'blobs',project,ref.artifactId),bytes);
   artifacts.set(ref.artifactId,{id:ref.artifactId,project_id:project,bytes:ref.bytes,content_hash:ref.contentHash,media_type:ref.mediaType,state:'READY',storage_key:`blobs/${project}/${ref.artifactId}`,inspection_json:null});return ref;
  };
  const body=artifact(10),sourceArtifact=artifact(11);
  const seed=(n:number,refs:Ref[]=[],version=1)=>{
   const content={body,attachments:[],sections:[],sourceRefs:structuredClone(refs)},title='고정 문서 '+n;
   const hash=contentHash(canonicalJson({title,formRef,stageNodeRef:null,content}));
   versions.set(id(n)+':'+version,{project_id:pid,document_id:id(n),version,confirmed_version:null,title,form_definition_id:formRef.id,form_version:1,form_hash:formRef.contentHash,content_json:content,source_refs_json:structuredClone(refs),content_hash:hash,stage_ref_json:null,sections_json:[],author_ref_json:{kind:'HUMAN',userId:uid},validation_json:{},created_at:new Date('2026-11-08T00:00:00Z')});
   return {kind:'DOCUMENT_VERSION',id:id(n),version,contentHash:hash};
  };
  const document=seed(20);
  const message=(n:number,kind='USER_MESSAGE',project=pid)=>{
   const content={conversationId:id(30),targetRoleRef:null,message:{kind,bodyRef:sourceArtifact,attachmentRefs:[],replyTo:null,supersedesInstructionRef:null,effectiveScope:{projectId:project,stageRefs:[],taskRefs:[]}},sourceRefs:[],serverSequence:n,authorRef:{kind:'HUMAN',userId:uid}};
   const hash=contentHash(canonicalJson(content));
   messages.set(id(n),{project_id:project,conversation_id:id(30),sequence:n,message_json:content,author_ref:content.authorRef,kind,body_artifact_id:sourceArtifact.artifactId,reply_to:null,supersedes_instruction_id:null,effective_scope:content.message.effectiveScope,source_refs:[],content_hash:hash,redaction_state:'NOT_REDACTED',recorded_at:new Date('2026-11-08T00:00:00Z')});
   return {kind:kind==='USER_INSTRUCTION'?'USER_INSTRUCTION':'CONVERSATION',id:id(n),contentHash:hash};
  };
  const conversation=message(31),instruction=message(32,'USER_INSTRUCTION');
  const query=async(sql:string,args:any[]=[])=>{
   queries.push(sql);await hook?.(sql);
   if(sql.includes('JOIN anvil.project_members')){assert.deepEqual(args,[pid,uid]);return {rows:[{id:pid,participation:'OWNER',archived_at:null}]};}
   if(sql.startsWith('SELECT v.*,d.confirmed_version')){assert.equal(args[0],pid);const row=versions.get(args[1]+':'+args[2]);return {rows:row&&row.project_id===args[0]?[structuredClone(row)]:[]};}
   if(sql.startsWith('SELECT v.definition_json')){assert.deepEqual(args,[formRef.id,1,uid]);return {rows:[{definition_json:form,content_hash:formRef.contentHash}]};}
   if(sql.startsWith('SELECT definition_json FROM anvil.form_versions')){assert.deepEqual(args,[formRef.id,1,formRef.contentHash]);return {rows:[{definition_json:form}]};}
   if(sql.startsWith('SELECT * FROM anvil.artifacts')){assert.equal(args.length,5);const row=artifacts.get(args[0]);return {rows:row&&row.project_id===args[1]&&row.content_hash===args[2]&&row.bytes===args[3]&&row.media_type===args[4]?[{...row}]:[]};}
   if(sql.startsWith('SELECT bytes,media_type,content_hash FROM anvil.artifacts')){assert.equal(args.length,2);const row=artifacts.get(args[1]);return {rows:row&&row.project_id===args[0]&&row.state==='READY'?[{...row}]:[]};}
   if(sql==='SELECT conversation_id FROM anvil.conversation_messages WHERE project_id=$1 AND id=$2'){assert.equal(args.length,2);const row=messages.get(args[1]);return {rows:row?.project_id===args[0]?[{conversation_id:row.conversation_id}]:[]};}
   if(sql==='SELECT * FROM anvil.conversation_messages WHERE project_id=$1 AND conversation_id=$2 AND id=$3'){assert.equal(args.length,3);const row=messages.get(args[2]);return {rows:row?.project_id===args[0]&&row.conversation_id===args[1]?[structuredClone(row)]:[]};}
   if(sql.startsWith('SELECT r.*,a.server_sequence')||sql.startsWith('SELECT event_kind,actor_ref')||sql.startsWith('SELECT import_id FROM')||sql.startsWith('SELECT p.id FROM anvil.document_proposals')){assert.equal(args[0],pid);return {rows:[]};}
   if(sql==='SELECT transaction_timestamp() AS at')return {rows:[{at:new Date('2026-11-08T00:00:00Z')}]};
   if(sql.startsWith('SELECT * FROM anvil.documents WHERE id=$1 AND project_id=$2 FOR UPDATE')){assert.equal(args[1],pid);const row=[...versions.values()].filter(v=>v.document_id===args[0]).sort((a,b)=>b.version-a.version)[0];return {rows:row?[{head_version:row.version}]:[]};}
   if(sql.startsWith('INSERT INTO anvil.document_versions(')){
    assert.equal(args.length,18);const content=JSON.parse(args[9]);versions.set(args[1]+':'+args[2],{project_id:args[0],document_id:args[1],version:args[2],form_definition_id:args[3],form_version:args[4],form_hash:args[5],title:args[7],source_refs_json:JSON.parse(args[8]),content_json:content,content_hash:args[10],sections_json:JSON.parse(args[11]),author_ref_json:JSON.parse(args[12]),validation_json:JSON.parse(args[13]),stage_ref_json:args[17]===null?null:JSON.parse(args[17]),confirmed_version:null,created_at:new Date('2026-11-08T00:00:00Z')});
   }else if(!/^(INSERT INTO anvil\.(commands|authorization_receipts|audit_events|documents|document_artifact_links|document_version_events)\b|UPDATE anvil.documents SET title=|SELECT set_config\('anvil.actor_id')/.test(sql))throw Error('UNSUPPORTED_DOCUMENT_SOURCE_SQL');
   writes.push({sql,args:structuredClone(args)});return {rows:[]};
  };
  const db={query} as unknown as PoolClient,docs=new ProjectDocuments(root);
  const request=(refs:Ref[]=[],targetId:string|null=null,expectedVersion=0):ProjectCommand=>({schemaVersion:1,projectId:pid,commandId:id(40),clientId:actor.clientId,controlGeneration:1,operation:'saveDocumentDraft',targetId,expectedVersion,baselineRefs:[],approvalRef:null,payload:{title:'출처 문서',formRef,stageNodeRef:null,content:{body,attachments:[],sections:[],sourceRefs:refs},importCandidateRef:null,reason:'보관 출처 연결'}});
  const save=(c:ProjectCommand)=>docs.save(db,actor,c,formRef);
  return {db,docs,request,save,versions,artifacts,messages,writes,queries,seed,artifact,document,sourceArtifact,conversation,instruction,setHook:(h:typeof hook)=>{hook=h;}};
 };
 await t.test('4종 저장과 정확 GET은 과거 문서버전·원문·분리 출처열을 보존한다',async()=>{
  const f=fixture();f.seed(20,[],2);
  const refs=[f.document,{kind:'ARTIFACT',id:f.sourceArtifact.artifactId,contentHash:f.sourceArtifact.contentHash},f.conversation,f.instruction];
  const saved=await f.save(f.request(refs));assert.ok('ref'in saved.data);const ref=saved.data.ref as {id:string;version:number;contentHash:string};
  const v=await f.docs.version(f.db,actor,pid,ref.id,ref.version);
  assert.deepEqual(v.content.sourceRefs,refs);assert.deepEqual(v.sourceRefs,refs);assert.equal(v.contentHash,ref.contentHash);
  assert.ok(f.queries.includes('SELECT conversation_id FROM anvil.conversation_messages WHERE project_id=$1 AND id=$2'));
  assert.ok(reads.includes(join(root,'blobs',pid,f.sourceArtifact.artifactId)));
  const before=structuredClone(f.versions.get(ref.id+':1'));await f.save(f.request([],ref.id,1));assert.deepEqual(f.versions.get(ref.id+':1'),before);
 });

 await t.test('빈 출처 정상 및 잘못된 형상·중복·201개·getter·Proxy는 쓰기 전에 차단한다',async()=>{
  const good=fixture(),saved=await good.save(good.request());assert.deepEqual((await good.docs.version(good.db,actor,pid,saved.targetId!,1)).sourceRefs,[]);
  const f=fixture();let called=0;
  const getter={kind:'ARTIFACT',id:f.sourceArtifact.artifactId,get contentHash(){called++;return f.sourceArtifact.contentHash;}};
  const proxy=new Proxy(f.document,{get(){called++;throw Error('PROXY_GET');},ownKeys(){called++;throw Error('PROXY_KEYS');}});
  for(const refs of [[{...f.document,extra:true}],[{...f.document,version:0}],[{...f.document,kind:'URL'}],
   [f.document,f.document],Array.from({length:201},(_,i)=>({...f.document,id:id(1000+i)})),[getter],[proxy]]){
   await assert.rejects(f.save(f.request(refs as Ref[])));assert.equal(f.writes.length,0);
  }
  assert.equal(called,0);
  const array=new Proxy([f.document],{get(){called++;throw Error('PROXY_ARRAY');}});
  assert.throws(()=>readDocumentSourceRefs(array));assert.equal(called,0);
 });
 await t.test('요청의 await 중 변이는 원 출처/명령 사본을 바꾸지 않는다',async()=>{
  const f=fixture(),refs=[f.document],request=f.request(refs),before=structuredClone(request);
  let changed=false;f.setHook(()=>{if(!changed){changed=true;refs[0]!.contentHash='0'.repeat(64);request.commandId=id(99);(request.payload.content as any).sourceRefs=[];}});
  const saved=await f.save(request),v=await f.docs.version(f.db,actor,pid,saved.targetId!,1);
  assert.equal(saved.commandId,before.commandId);assert.deepEqual(v.sourceRefs,(before.payload.content as any).sourceRefs);
 });
 await t.test('교차 프로젝트·없는 참조·hash·실지시 종류 오염은 저장/receipt0이다',async()=>{
  for(const mode of ['document','artifact','message','missing','hash','kind'] as const){
   const f=fixture();let ref:Ref=f.document;
   if(mode==='document')f.versions.get(f.document.id+':1').project_id=other;
   if(mode==='artifact'){ref={kind:'ARTIFACT',id:f.sourceArtifact.artifactId,contentHash:f.sourceArtifact.contentHash};f.artifacts.get(ref.id).project_id=other;}
   if(mode==='message'){ref=f.conversation;f.messages.get(ref.id).project_id=other;}
   if(mode==='missing')ref={...f.document,id:id(777)};
   if(mode==='hash')ref={...f.document,contentHash:'0'.repeat(64)};
   if(mode==='kind')ref={...f.conversation,kind:'USER_INSTRUCTION'};
   await assert.rejects(f.save(f.request([ref])));assert.equal(f.writes.length,0);
  }
 });
 await t.test('출처의 격리·미지원 media·실바이트 손상·민감 원문은 저장0이다',async()=>{
  for(const mode of ['quarantine','media','bytes','sensitive'] as const){
   const f=fixture();let ref:Ref={kind:'ARTIFACT',id:f.sourceArtifact.artifactId,contentHash:f.sourceArtifact.contentHash};
   if(mode==='quarantine')f.artifacts.get(ref.id).state='QUARANTINED';
   if(mode==='media')f.artifacts.get(ref.id).media_type='application/octet-stream';
   if(mode==='bytes')files.set(join(root,'blobs',pid,ref.id),Buffer.alloc(f.sourceArtifact.bytes,65));
   if(mode==='sensitive'){const a=f.artifact(12,'password: synthetic-known-marker');ref={kind:'ARTIFACT',id:a.artifactId,contentHash:a.contentHash};}
   await assert.rejects(f.save(f.request([ref])));assert.equal(f.writes.length,0);assert.equal(handles.size,0);
  }
 });
 await t.test('저장 후 분리열/content/hash/원문/격리 변조는 정확 GET을 실패시킨다',async()=>{
  for(const mode of ['column','content','column-shape','content-shape','bytes','quarantine','message'] as const){
   const f=fixture(),saved=await f.save(f.request([f.document,f.instruction]));
   const row=f.versions.get(saved.targetId+':1');
   if(mode==='column')row.source_refs_json=[];
   if(mode==='content')row.content_json.sourceRefs=[];
   if(mode==='column-shape')row.source_refs_json=[{kind:'ARTIFACT',id:id(123)}];
   if(mode==='content-shape'){row.content_json.sourceRefs=null;row.content_hash=contentHash(canonicalJson({title:row.title,formRef,stageNodeRef:null,content:row.content_json}));}
   if(mode==='bytes')files.set(join(root,'blobs',pid,f.sourceArtifact.artifactId),Buffer.alloc(f.sourceArtifact.bytes,65));
   if(mode==='quarantine')f.artifacts.get(f.sourceArtifact.artifactId).state='QUARANTINED';
   if(mode==='message')f.messages.get(f.instruction.id).message_json.message.kind='USER_MESSAGE';
   const writes=f.writes.length;
   if(mode==='column-shape'||mode==='content-shape')await assert.rejects(f.docs.version(f.db,actor,pid,saved.targetId!,1),{message:'DOCUMENT_INTEGRITY_FAILED',statusCode:503});
   else await assert.rejects(f.docs.version(f.db,actor,pid,saved.targetId!,1));assert.equal(f.writes.length,writes);assert.equal(handles.size,0);
  }
 });
 await t.test('문서 연쇄의 모든 종류는 같은 총200회 예산을 쓰며 성공을 캐시하지 않는다',async()=>{
  const f=fixture();
  const leaf=f.seed(50,[{kind:'ARTIFACT',id:f.sourceArtifact.artifactId,contentHash:f.sourceArtifact.contentHash},f.conversation,f.instruction]);
  const branches=Array.from({length:50},(_,i)=>f.seed(100+i,[leaf]));
  const rootRef=f.seed(51,branches),start=f.queries.length;
  // root→50 branches→50 leaf→150 leaf sources =250회. leaf의 반복 검산도 매번 계상한다.
  await assert.rejects(f.docs.version(f.db,actor,pid,rootRef.id,1),{message:'DOCUMENT_SOURCE_BUDGET_EXCEEDED',statusCode:422});
  assert.ok(f.queries.slice(start).filter(sql=>sql==='SELECT * FROM anvil.conversation_messages WHERE project_id=$1 AND conversation_id=$2 AND id=$3').length>1);
  const allowed=f.seed(52,Array.from({length:40},(_,i)=>f.seed(200+i,[leaf])));
  assert.equal((await f.docs.version(f.db,actor,pid,allowed.id,1)).contentHash,allowed.contentHash);
  assert.equal(f.writes.length,0);
 });
 await t.test('위조 순환 저장행은 원 hash 검사를 우회하거나 재귀 성공을 만들지 못한다',async()=>{
  const f=fixture(),a=f.seed(60),b=f.seed(61,[a]);
  const row=f.versions.get(a.id+':1');row.content_json.sourceRefs=[b];row.source_refs_json=[b];
  await assert.rejects(f.docs.version(f.db,actor,pid,a.id,1),{message:'DOCUMENT_INTEGRITY_FAILED',statusCode:503});
  assert.equal(f.writes.length,0);
 });
 await t.test('genuine readMessage의 optional budget은 원 originalText에 동일객체로 전달되고 기존5인자도 유지된다',async()=>{
  const f=fixture(),reader=new ProjectConversations(f.docs),originalText=f.docs.originalText,observed:unknown[][]=[];
  f.docs.originalText=async function(...args:Parameters<typeof originalText>){observed.push(args);return originalText.apply(this,args);};
  try{
   const plain=await reader.readMessage(f.db,actor,pid,id(30),f.instruction.id);assert.equal(plain.message.kind,'USER_INSTRUCTION');
   assert.equal(observed[0]!.length,3);
   const budget=createArtifactBackupReadBudget({maxBytes:100000,deadlineMs:30000},new AbortController().signal);
   await reader.readMessage(f.db,actor,pid,id(30),f.instruction.id,budget);
   assert.equal(observed[1]![3],budget);assert.equal(readArtifactBackupReadUsage(budget).inputBytes,f.sourceArtifact.bytes);
   const doc=f.seed(70,[f.instruction]);const shared=createArtifactBackupReadBudget({maxBytes:100000,deadlineMs:30000},new AbortController().signal);
   await f.docs.version(f.db,actor,pid,doc.id,1,shared);
   assert.equal(readArtifactBackupReadUsage(shared).inputBytes,f.sourceArtifact.bytes+f.versions.get(doc.id+':1').content_json.body.bytes);
  }finally{f.docs.originalText=originalText;}
 });
 await t.test('readMessage의 진입/member/row/text await 뒤 취소는 원문 또는 결과를 반환하지 않는다',async()=>{
  for(const phase of ['entry','member','row','text'] as const){
   const f=fixture(),controller=new AbortController(),budget=createArtifactBackupReadBudget({maxBytes:100000,deadlineMs:30000},controller.signal);
   if(phase==='entry')controller.abort();
   f.setHook(sql=>{if(phase==='member'&&sql.includes('JOIN anvil.project_members')||phase==='row'&&sql.startsWith('SELECT * FROM anvil.conversation_messages'))controller.abort();});
   if(phase==='text')readHook=()=>controller.abort();
   const count=reads.length;
   try{await assert.rejects(new ProjectConversations(f.docs).readMessage(f.db,actor,pid,id(30),f.instruction.id,budget),{message:'ARTIFACT_BACKUP_CANCELLED'});}
   finally{readHook=undefined;}
   if(phase!=='text')assert.equal(reads.length,count);
   assert.equal(handles.size,0);assert.equal(f.writes.length,0);
  }
 });
 await t.test('문서 검산의 대화 본문은 원행 await 전후 Docs getter/가짜 originalText를 실행하지 않는다',async()=>{
  for(const phase of ['before','row'] as const){
   const f=fixture();let getters=0,fake=0;
   const replace=()=>Object.defineProperty(f.docs,'originalText',{get(){getters++;return async()=>{fake++;return '검산하지 않은 가짜 본문';};},configurable:true});
   if(phase==='before')replace();else f.setHook(sql=>{if(sql.startsWith('SELECT * FROM anvil.conversation_messages'))replace();});
   const count=reads.length;
   const result=await f.save(f.request([f.instruction]));
   assert.equal(result.status,'APPLIED');assert.equal(getters,0);assert.equal(fake,0);
   assert.ok(reads.slice(count).includes(join(root,'blobs',pid,f.sourceArtifact.artifactId)));
  }
 });
 await t.test('기존 제안 입력의 비빈 출처412는 문서 base 타입 확장과 별개로 유지된다',async()=>{
  const {prepareDocumentProposalMaterial}=await import('../../../apps/server/modules/documents/project-proposals.ts');
  const f=fixture(),base=await f.docs.version(f.db,actor,pid,f.document.id,1),baseRef={id:base.id,version:base.version,contentHash:base.contentHash};
  for(const field of ['sourceRefs','proposedContent'] as const){
   const proposedContent={...base.content,sourceRefs:field==='proposedContent'?[f.document]:[]};
   const before=f.queries.length;
   await assert.rejects(prepareDocumentProposalMaterial(f.db,actor,pid,{baseRef,proposedContent,reason:'기존 제안 경계',sourceRefs:field==='sourceRefs'?[f.document]:[]},base,async()=>{throw Error('원문 읽기 금지');}),{message:'DOCUMENT_REFERENCE_CONNECTION_PENDING',statusCode:412});
   assert.equal(f.queries.length,before);assert.equal(f.writes.length,0);
  }
 });
 await t.test('기존 protected plan reader도 출처와 backup 제한을 유지한다',async()=>{
  const f=fixture(),doc=f.seed(80,[f.document,f.instruction]);
  const protectedDocs=new ProjectDocuments(root,undefined,'FN09_PLAN_PROOF');
  assert.equal(ProjectDocuments.isProtectedPlanReader(protectedDocs),true);
  const budget=createArtifactBackupReadBudget({maxBytes:100000,deadlineMs:30000},new AbortController().signal);
  assert.equal((await protectedDocs.version(f.db,actor,pid,doc.id,1,budget)).contentHash,doc.contentHash);
  assert.ok(readArtifactBackupReadUsage(budget).inputBytes>0);assert.equal(f.writes.length,0);assert.equal(handles.size,0);
 });
 }finally{fsMock.restore();assert.equal(handles.size,0);assert.deepEqual(blocked,[]);}
});


test('최초 prototype 교체도 문서출처 전용 genuine 대화 reader를 대체하지 않는다',()=>{
 const code=`import assert from 'node:assert/strict';
 const {ProjectConversations}=await import(${JSON.stringify(new URL('../../../apps/server/modules/knowledge/conversations.ts',import.meta.url).href)});
 const {ProjectDocuments}=await import(${JSON.stringify(new URL('../../../apps/server/modules/documents/project-documents.ts',import.meta.url).href)});
 let fake=0,reads=0,getters=0;
 const replaced=async()=>{fake++;return {};};ProjectConversations.prototype.readMessage=replaced;
 const documents=new ProjectDocuments(),ordinary=new ProjectConversations(documents);
 assert.equal(Object.hasOwn(ordinary,'readMessage'),false);assert.equal(ordinary.readMessage,replaced);
 for(const phase of ['before','after']){
  if(phase==='before')Object.defineProperty(ProjectConversations.prototype,'readMessage',{get(){getters++;return replaced;},configurable:true});
  const reader=new ProjectConversations(documents,'DOCUMENT_SOURCE_REFS');
  const descriptor=Object.getOwnPropertyDescriptor(reader,'readMessage');assert.equal(descriptor.writable,false);assert.equal(descriptor.configurable,false);assert.ok('value'in descriptor);
  Object.defineProperty(ProjectConversations.prototype,'readMessage',{get(){getters++;return replaced;},configurable:true});
  await assert.rejects(reader.readMessage({query:async()=>{reads++;throw Error('ACTUAL_MEMBER_READ');}},${JSON.stringify(actor)},${JSON.stringify(pid)},${JSON.stringify(id(30))},${JSON.stringify(id(32))}),/ACTUAL_MEMBER_READ/);
 }
 assert.throws(()=>new ProjectConversations(documents,'UNKNOWN'),/DOCUMENT_SOURCE_READER_INVALID/);
 assert.equal(fake,0);assert.equal(getters,0);assert.equal(reads,2);`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',windowsHide:true,timeout:15000,killSignal:'SIGKILL',maxBuffer:16384});
 assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,0,child.stderr);
});

test('실제 app·Documents·Conversations 독립 import 진입순서에 TDZ가 없다',()=>{
 for(const path of ['../../../apps/server/app.ts','../../../apps/server/modules/documents/project-documents.ts','../../../apps/server/modules/knowledge/conversations.ts']){
  const child=spawnSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(new URL(path,import.meta.url).href)});`],{encoding:'utf8',windowsHide:true,timeout:15000,killSignal:'SIGKILL',maxBuffer:16384});
  assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,0,child.stderr);
 }
});
