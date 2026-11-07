import assert from 'node:assert/strict';
import {mock,test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {PoolClient} from 'pg';
import {canonicalJson} from '../../../contracts/canonical.ts';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../../../apps/server/modules/access/repository.ts';

const id=(n:number)=>'a6f30000-0000-4000-8000-'+String(n).padStart(12,'0');
const origin='https://anvil-synthetic.invalid',host=new URL(origin).host;
const at='2026-11-08T00:00:00.000000Z',missingId=id(30);
const owners=[
  {token:'synthetic-owner-alpha',userId:id(1),clientId:id(2),sessionId:id(3),projectId:id(4),name:'합성 공동검색 알파',purpose:'알파 고유 목적'},
  {token:'synthetic-owner-beta',userId:id(5),clientId:id(6),sessionId:id(7),projectId:id(8),name:'합성 공동검색 베타',purpose:'베타 고유 목적'},
] as const;

const artifactChild=process.env.ANVIL_IX01_ARTIFACT_MEMORY_CHILD==='1';
const knowledgeChild=process.env.ANVIL_IX01_ARTIFACT_MEMORY_CHILD==='knowledge';
const memoryChild=artifactChild||knowledgeChild;
const expectedListSql=`SELECT p.id,p.name,p.purpose,p.version,to_char(p.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at
  FROM anvil.projects p JOIN anvil.project_members m ON m.project_id=p.id
  WHERE m.user_id=$1 AND m.revoked_at IS NULL AND ((p.archived_at IS NOT NULL)=$2)
  AND (p.name ILIKE $3 OR p.purpose ILIKE $3)
  AND ($4::timestamptz IS NULL OR (p.updated_at,p.id)<($4::timestamptz,$5::uuid))
  ORDER BY p.updated_at DESC,p.id DESC LIMIT $6`;
const normalizeSql=(sql:string)=>sql.replace(/\s+/g,' ').trim();
function assertListSql(sql:string){
  assert.equal(normalizeSql(sql),normalizeSql(expectedListSql),'PROJECT_LIST_SQL_SCOPE_MISMATCH');
}

if(!memoryChild)test('IX01 목록 SQL 대역은 참여 조건에 OR TRUE를 덧붙인 조회 범위 확장을 거절한다',()=>{
  const widened=expectedListSql.replace('m.revoked_at IS NULL','m.revoked_at IS NULL OR TRUE');
  assert.notEqual(widened,expectedListSql);
  assert.throws(()=>assertListSql(widened),{code:'ERR_ASSERTION',message:/PROJECT_LIST_SQL_SCOPE_MISMATCH/});
});

const attachmentTest='IX01 메모리 파일에서 첨부 GET의 소유자 격리를 검증한다';
const attachmentIds=[id(40),id(41)] as const;
const attachmentFiles=owners.map((owner,index)=>({
  id:attachmentIds[index]!,projectId:owner.projectId,bytes:Buffer.from('IX01 합성 첨부 '+(index+1)+'\n'),
}));
const sha256=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');

const knowledgeTest='IX01 메모리 원문으로 지식 검색의 프로젝트와 커서를 격리한다';
const knowledgeRows=owners.flatMap((owner,index)=>[0,1].map(slot=>{
  const file=attachmentFiles[index]!,label=index===0?'알파':'베타',digest=sha256(file.bytes);
  const entry={kind:'FACT',title:label+(slot===0?' 공통 지식':' 두 번째 기록'),reason:label+(slot===0?' 제목 일치 근거':' 공통 검색 근거'),
    contentRef:{artifactId:file.id,bytes:file.bytes.length,contentHash:digest,mediaType:'text/plain;charset=utf-8'},
    sourceRefs:[{kind:'ARTIFACT',id:file.id,contentHash:digest}],scope:{projectId:owner.projectId,stageRefs:[],taskRefs:[]},relatedRefs:[]};
  const ref={id:id(60+index*2+slot),version:1,contentHash:sha256(Buffer.from(canonicalJson(entry)))};
  return {entry,ref,owner,at:'2026-11-08T00:00:0'+(1-slot)+'.000000Z',eventId:id(70+index*2+slot)};
}));
const knowledgeSign=(value:string)=>sha256(Buffer.from(value));
const knowledgeSql=`SELECT k.id,k.head_version,to_char(k.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') cursor_at
  FROM anvil.knowledge_entries k JOIN anvil.knowledge_versions v ON v.project_id=k.project_id AND v.entry_id=k.id AND v.version=k.head_version
  WHERE k.project_id=$1 AND ($2::text IS NULL OR k.kind=$2) AND (strpos(lower(v.title),lower($3))>0 OR strpos(lower(v.reason),lower($3))>0)
  AND ($4::timestamptz IS NULL OR (k.created_at,k.id)<($4::timestamptz,$5::uuid))
  AND EXISTS(SELECT 1 FROM anvil.knowledge_events e WHERE e.project_id=k.project_id AND e.entry_id=k.id AND e.version=k.head_version AND e.kind='EXCLUDED')=($7::text='EXCLUDED')
  AND ($7::text NOT IN ('PROPOSED','CONFIRMED') OR EXISTS(SELECT 1 FROM anvil.knowledge_events e WHERE e.project_id=k.project_id AND e.entry_id=k.id AND e.version=k.head_version AND e.kind='CONFIRMED')=($7::text='CONFIRMED'))
  ORDER BY k.created_at DESC,k.id DESC LIMIT $6`;

async function fixture(artifactRoot?:string,knowledge=false){
  const projects=owners.map(owner=>({id:owner.projectId,name:owner.name,purpose:owner.purpose,desired_outcome:'격리 조회 검수',
    version:1,created_at:new Date(at),updated_at:new Date(at),archived_at:null}));
  const memberships=owners.map(owner=>({projectId:owner.projectId,userId:owner.userId,participation:'OWNER',revokedAt:null}));
  const calls:{kind:'LIST'|'DETAIL'|'SOURCE'|'MEMBER'|'ARTIFACT'|'KNOWLEDGE_SEARCH'|'KNOWLEDGE_READ';actorId:string;value?:unknown}[]=[],writes:string[]=[];
  let cursorSigns=0;

  // 쿠키→인증 주체와 SQL 결과만 메모리 모형이다. 앱 라우트, ProjectsRepository, 오류 응답 및 목록 커서 결정은 실제 코드다.
  const repository={
    installationId:id(90),
    signProjectCursor(value:string){
      cursorSigns++;
      if(knowledge){assert.ok(value.startsWith('KNOWLEDGE:'));return knowledgeSign(value);}
      throw Error('UNEXPECTED_CURSOR_SIGN');
    },
    async authenticated<T>(token:string,csrf:string|null,body:(db:PoolClient,actor:AuthenticatedIdentity)=>Promise<T>){
      assert.equal(csrf,null);
      const owner=owners.find(candidate=>candidate.token===token);
      if(!owner)throw new AuthFailure('AUTH_REQUIRED',401);
      const actor:AuthenticatedIdentity={actorId:owner.userId,clientId:owner.clientId,serverOwner:false,credentialGeneration:1,reauthUntil:null,
        authSession:{id:owner.sessionId,idleExpiresAt:'2098-01-01T00:00:00Z',absoluteExpiresAt:'2099-01-01T00:00:00Z'}};
      const member=(projectId:string,userId:unknown)=>memberships.find(row=>row.projectId===projectId&&row.userId===userId&&row.revokedAt===null);
      const db={
        async query(sql:string,args:unknown[]){
          const text=normalizeSql(sql);
          if(/^(INSERT|UPDATE|DELETE|MERGE|TRUNCATE)\b/i.test(text)){writes.push(text);throw Error('UNEXPECTED_DOMAIN_WRITE');}
          if(text.startsWith('SELECT p.id,p.name,p.purpose,p.version,')){
            assertListSql(sql);
            const [userId,archived,pattern,cursorAt,cursorId,limit]=args;
            assert.equal(userId,owner.userId);assert.equal(archived,false);
            assert.equal(cursorAt,null);assert.equal(cursorId,null);
            assert.ok(typeof pattern==='string'&&pattern.startsWith('%')&&pattern.endsWith('%'));
            assert.equal(limit,2,'limit=1에는 초과 행 1개만 읽는다');
            const search=pattern.slice(1,-1).toLowerCase();
            calls.push({kind:'LIST',actorId:actor.actorId,value:search});
            return {rows:projects.filter(row=>member(row.id,userId)&&(row.name.toLowerCase().includes(search)||row.purpose.toLowerCase().includes(search)))
              .slice(0,limit).map(({id,name,purpose,version})=>({id,name,purpose,version,at}))};
          }
          if(text.startsWith('SELECT p.*,m.participation,pc.actor_id,')){
            assert.match(text,/JOIN anvil\.project_members m ON m\.project_id=p\.id/);
            assert.match(text,/WHERE p\.id=\$1 AND m\.user_id=\$2 AND m\.revoked_at IS NULL$/);
            const [projectId,userId]=args;assert.equal(userId,owner.userId);
            calls.push({kind:'DETAIL',actorId:actor.actorId,value:projectId});
            const row=projects.find(candidate=>candidate.id===projectId),membership=row&&member(row.id,userId);
            return {rows:row&&membership?[{...row,participation:membership.participation,setup_copy_records:0}]:[]};
          }
          if(text.startsWith('SELECT b.*,c.operation,c.actor_id,c.client_id command_client FROM anvil.project_source_declarations')){
            assert.deepEqual(args,[owner.projectId]);
            calls.push({kind:'SOURCE',actorId:actor.actorId,value:args[0]});
            return {rows:[]};
          }
          if(artifactRoot&&text.startsWith('SELECT p.id,p.archived_at,m.participation FROM anvil.projects')){
            assert.equal(text,'SELECT p.id,p.archived_at,m.participation FROM anvil.projects p JOIN anvil.project_members m ON m.project_id=p.id WHERE p.id=$1 AND m.user_id=$2 AND m.revoked_at IS NULL');
            const [projectId,userId]=args;assert.equal(userId,owner.userId);
            calls.push({kind:'MEMBER',actorId:actor.actorId,value:projectId});
            const project=projects.find(row=>row.id===projectId),membership=project&&member(project.id,userId);
            return {rows:project&&membership?[{id:project.id,archived_at:project.archived_at,participation:membership.participation}]:[]};
          }
          if(artifactRoot&&text==='SELECT * FROM anvil.artifacts WHERE id=$1 AND project_id=$2'){
            const [artifactId,projectId]=args;
            assert.equal(projectId,owner.projectId);
            calls.push({kind:'ARTIFACT',actorId:actor.actorId,value:args});
            const entry=attachmentFiles.find(file=>file.id===artifactId&&file.projectId===projectId);
            return {rows:entry?[{id:entry.id,project_id:entry.projectId,bytes:entry.bytes.length,content_hash:sha256(entry.bytes),
              state:'READY',storage_key:'blobs/'+entry.projectId+'/'+entry.id,inspection_json:null}]:[]};
          }
          if(knowledge&&text.startsWith('SELECT k.id,k.head_version,')){
            assert.equal(text,normalizeSql(knowledgeSql),'KNOWLEDGE_SEARCH_SQL_SCOPE_MISMATCH');
            const [projectId,kind,query,cursorAt,cursorId,limit,status]=args;
            assert.equal(projectId,owner.projectId);assert.deepEqual([kind,limit,status],['FACT',2,'ACTIVE']);
            assert.equal(args.length,7);assert.equal(typeof query,'string');
            assert.ok(cursorAt===null&&cursorId===null||knowledgeRows.some(row=>row.owner===owner&&row.at===cursorAt&&row.ref.id===cursorId));
            calls.push({kind:'KNOWLEDGE_SEARCH',actorId:actor.actorId,value:args});
            const term=String(query).toLowerCase();
            return {rows:knowledgeRows.filter(row=>row.entry.scope.projectId===projectId&&(row.entry.title.toLowerCase().includes(term)||row.entry.reason.toLowerCase().includes(term))
              &&(cursorAt===null||row.at<String(cursorAt)||row.at===cursorAt&&row.ref.id<String(cursorId)))
              .sort((a,b)=>b.at.localeCompare(a.at)||b.ref.id.localeCompare(a.ref.id)).slice(0,2)
              .map(row=>({id:row.ref.id,head_version:1,cursor_at:row.at}))};
          }
          if(knowledge){
            const record=knowledgeRows.find(row=>row.owner===owner&&row.ref.id===args[1]);
            if(text==='SELECT v.*,k.kind,k.head_version FROM anvil.knowledge_versions v JOIN anvil.knowledge_entries k ON k.project_id=v.project_id AND k.id=v.entry_id WHERE v.project_id=$1 AND v.entry_id=$2 AND v.version=$3'){
              assert.ok(record);assert.deepEqual(args,[owner.projectId,record.ref.id,1]);
              const {entry,ref}=record;calls.push({kind:'KNOWLEDGE_READ',actorId:actor.actorId,value:args});
              return {rows:[{entry_json:entry,content_hash:ref.contentHash,kind:entry.kind,title:entry.title,reason:entry.reason,
                content_artifact_id:entry.contentRef.artifactId,source_refs:entry.sourceRefs,scope_json:entry.scope,related_refs:entry.relatedRefs,head_version:1,created_by:owner.userId}]};
            }
            if(text==="SELECT e.id,e.kind,e.reason,e.actor_ref,e.recorded_at,e.base_ref,e.change_sources,e.review_refs,c.actor_id command_actor_id,c.operation command_operation,c.result_ref command_result FROM anvil.knowledge_events e JOIN anvil.commands c ON c.id=e.command_id AND c.project_id=e.project_id WHERE e.project_id=$1 AND e.entry_id=$2 AND e.version=$3 ORDER BY CASE WHEN e.kind IN ('PROPOSED','CORRECTED') THEN 0 WHEN e.kind='CONFIRMED' THEN 1 ELSE 2 END,e.recorded_at,e.id"){
              assert.ok(record);assert.deepEqual(args,[owner.projectId,record.ref.id,1]);
              return {rows:[{id:record.eventId,kind:'PROPOSED',reason:record.entry.reason,actor_ref:{kind:'HUMAN',userId:owner.userId},recorded_at:new Date(record.at),
                base_ref:null,change_sources:null,review_refs:null,command_actor_id:owner.userId,command_operation:'saveKnowledge',
                command_result:{status:'APPLIED',projectId:owner.projectId,targetId:record.ref.id,version:1,data:{status:'PROPOSED',ref:record.ref,entry:record.entry}}}]};
            }
            if(text==="SELECT r.*,a.server_sequence,c.actor_id command_actor,c.client_id command_client,c.operation command_operation,c.result_ref command_result FROM anvil.content_reviews r JOIN anvil.audit_events a ON a.project_id=r.project_id AND a.command_id=r.command_id JOIN anvil.commands c ON c.id=r.command_id AND c.project_id=r.project_id WHERE r.scope_kind='PROJECT' AND r.project_id=$1 AND r.target_kind='KNOWLEDGE' AND r.target_id=$2 AND r.target_version=$3 AND r.target_hash=$4 AND ($5::uuid[] IS NULL OR r.id=ANY($5::uuid[])) ORDER BY a.server_sequence DESC LIMIT 200"){
              assert.ok(record);assert.deepEqual(args,[owner.projectId,record.ref.id,1,record.ref.contentHash,null]);return {rows:[]};
            }
            if(text==='SELECT application_version,application_hash,entry_id,version FROM anvil.project_constitutions WHERE project_id=$1'){
              assert.deepEqual(args,[owner.projectId]);return {rows:[]};
            }
            const source=attachmentFiles.find(file=>file.projectId===owner.projectId)!;
            const digest=sha256(source.bytes),mediaType='text/plain;charset=utf-8';
            if(text==="SELECT bytes,media_type,content_hash FROM anvil.artifacts WHERE project_id=$1 AND id=$2 AND state='READY'"){
              assert.deepEqual(args,[owner.projectId,source.id]);return {rows:[{bytes:source.bytes.length,media_type:mediaType,content_hash:digest}]};
            }
            if(text==='SELECT * FROM anvil.artifacts WHERE id=$1 AND project_id=$2 AND content_hash=$3 AND bytes=$4 AND media_type=$5'){
              assert.deepEqual(args,[source.id,owner.projectId,digest,source.bytes.length,mediaType]);
              return {rows:[{state:'READY',storage_key:'blobs/'+owner.projectId+'/'+source.id,inspection_json:null}]};
            }
          }
          throw Error('UNMODELED_PROJECT_READ_SQL');
        },
      } as unknown as PoolClient;
      return body(db,actor);
    },
  };
  const {buildApp}=await import('../../../apps/server/app.ts');
  const app=buildApp({},undefined,{repository:repository as unknown as AccessRepository,origin,...(artifactRoot?{artifactRoot}:{})});
  const read=(owner:typeof owners[number],path:string)=>app.inject({method:'GET',url:'/api/v1/projects'+path,
    headers:{host,cookie:'__Host-anvil.sid='+owner.token}});
  return {app,read,calls,writes,cursorSigns:()=>cursorSigns};
}

function withoutObservedAt(response:Record<string,unknown>){
  const {observedAt,...body}=response;
  assert.equal(typeof observedAt,'string');assert.ok(Number.isFinite(Date.parse(observedAt as string)));
  return body;
}

if(!memoryChild)test('IX01 두 합성 OWNER의 목록과 검색은 상대 프로젝트 이름·건수·커서를 노출하지 않는다',async()=>{
  const f=await fixture();
  try{
    for(const [index,owner] of owners.entries()){
      const other=owners[1-index]!;
      for(const query of ['', '공동검색', owner.purpose]){
        const response=await f.read(owner,'?'+new URLSearchParams({limit:'1',...(query?{query}:{})}));
        assert.equal(response.statusCode,200,response.body);
        assert.deepEqual(withoutObservedAt(response.json()),{items:[{id:owner.projectId,name:owner.name,purpose:owner.purpose,version:1,updatedAt:at}],
          hasMore:false,nextCursor:null,baselineVersion:null});
      }
      const hidden=await f.read(owner,'?'+new URLSearchParams({limit:'1',query:other.purpose}));
      const absent=await f.read(owner,'?'+new URLSearchParams({limit:'1',query:'어느 프로젝트에도 없는 합성 검색어'}));
      for(const response of [hidden,absent]){
        assert.equal(response.statusCode,200,response.body);
        assert.deepEqual(withoutObservedAt(response.json()),{items:[],hasMore:false,nextCursor:null,baselineVersion:null});
      }
    }
    assert.equal(f.calls.filter(call=>call.kind==='LIST').length,10);
    assert.equal(f.cursorSigns(),0);assert.deepEqual(f.writes,[]);
  }finally{await f.app.close();assert.equal(f.app.server.listening,false);}
});

if(!memoryChild)test('IX01 두 합성 OWNER의 직접 조회는 자신의 상세만 반환하고 상대와 미존재를 같은 404로 응답한다',async()=>{
  const f=await fixture();
  try{
    for(const [index,owner] of owners.entries()){
      const other=owners[1-index]!;
      const own=await f.read(owner,'/'+owner.projectId);
      assert.equal(own.statusCode,200,own.body);
      const view=own.json();
      assert.deepEqual({id:view.id,name:view.name,purpose:view.purpose,desiredOutcome:view.desiredOutcome,participation:view.participation},
        {id:owner.projectId,name:owner.name,purpose:owner.purpose,desiredOutcome:'격리 조회 검수',participation:'OWNER'});
      const before=f.calls.length;
      for(const projectId of [other.projectId,missingId]){
        const denied=await f.read(owner,'/'+projectId);
        assert.equal(denied.statusCode,404,denied.body);
        assert.equal(denied.headers['cache-control'],'no-store');
        const {requestId,...body}=denied.json();
        assert.equal(typeof requestId,'string');assert.ok(requestId.length>0);
        assert.deepEqual(body,{code:'NOT_FOUND',message:'요청을 처리하지 못했습니다',targetId:null,retryDisposition:'not-retryable',details:{}});
      }
      assert.deepEqual(f.calls.slice(before),[other.projectId,missingId].map(value=>({kind:'DETAIL',actorId:owner.userId,value})));
    }
    assert.equal(f.calls.filter(call=>call.kind==='SOURCE').length,2);
    assert.deepEqual(f.writes,[]);
  }finally{await f.app.close();assert.equal(f.app.server.listening,false);}
});

function runMemoryChild(kind:'1'|'knowledge'){
  // 다른 시험과 ESM 모듈 캐시를 공유하지 않는 별도 Node 프로세스에서만 FS import를 대역한다.
  const env={...process.env,ANVIL_IX01_ARTIFACT_MEMORY_CHILD:kind};
  Reflect.deleteProperty(env,'NODE_TEST_CONTEXT');
  const child=spawnSync(process.execPath,['--experimental-test-module-mocks','--test','--test-reporter=spec',fileURLToPath(import.meta.url)],{
    env,encoding:'utf8',timeout:30000,windowsHide:true,
  });
  assert.equal(child.error,undefined);
  assert.equal(child.signal,null);
  assert.equal(child.status,0,child.stdout+'\n'+child.stderr);
  assert.match(child.stdout,/pass 1\b/);
}

if(!memoryChild)test(attachmentTest,()=>runMemoryChild('1'));
if(!memoryChild)test(knowledgeTest,()=>runMemoryChild('knowledge'));

async function memoryFiles(){
  const root=resolve('never-created-ix01-attachment-memory-root');
  const directories=new Set([root,join(root,'blobs'),...owners.map(owner=>join(root,'blobs',owner.projectId))]);
  const files=new Map(attachmentFiles.map(file=>[join(root,'blobs',file.projectId,file.id),file.bytes]));
  const fsCalls:{kind:string;path:string}[]=[],handles=new Set<object>(),blockedCalls:string[]=[];
  const stat=(path:string)=>{
    assert.ok(directories.has(path)||files.has(path),'MEMORY_PATH_NOT_REGISTERED');
    return {isDirectory:()=>directories.has(path),isFile:()=>files.has(path),isSymbolicLink:()=>false,
      nlink:1,uid:process.getuid?.()??0,mode:directories.has(path)?0o40700:0o100600,size:files.get(path)?.length??0};
  };
  const trace=(kind:string,path:string)=>fsCalls.push({kind,path});
  const fs={
    lstat:async(path:string)=>{trace('lstat',path);return stat(path);},
    realpath:async(path:string)=>{trace('realpath',path);stat(path);return path;},
    open:async(path:string,flags:number)=>{
      trace('open',path);
      assert.equal(flags,constants.O_RDONLY|(constants.O_NOFOLLOW??0));assert.ok(files.has(path));
      const handle={
        stat:async()=>{trace('stat',path);return stat(path);},
        readFile:async()=>{trace('readFile',path);return Buffer.from(files.get(path)!);},
        close:async()=>{trace('close',path);assert.ok(handles.delete(handle));},
      };
      handles.add(handle);return handle;
    },
  };
  const originalFs=await import('node:fs/promises');
  const blocked=Object.fromEntries(Object.keys(originalFs).filter(key=>key!=='default').map(key=>[key,()=>{
    blockedCalls.push(key);throw Error('UNEXPECTED_MEMORY_FS_OPERATION');
  }]));
  const exports={...blocked,...fs};
  const fsMock=mock.module('node:fs/promises',{exports:{...exports,default:exports}});
  return {root,files,fsCalls,handles,blockedCalls,fsMock};
}

if(artifactChild)test(attachmentTest,async()=>{
  const {root,files,fsCalls,handles,blockedCalls,fsMock}=await memoryFiles();
  let f:Awaited<ReturnType<typeof fixture>>|undefined;
  try{
    const running=await fixture(root);f=running;
    for(const [index,owner] of owners.entries()){
      const own=attachmentFiles[index]!,other=attachmentFiles[1-index]!,path=join(root,'blobs',owner.projectId,own.id);
      const get=(pid:string,aid:string)=>running.read(owner,'/'+pid+'/files/'+aid);
      const callStart=running.calls.length,fsStart=fsCalls.length;
      const visible=await get(owner.projectId,own.id);
      assert.equal(visible.statusCode,200,visible.body);
      assert.equal(visible.headers['content-type'],'application/octet-stream');
      assert.equal(visible.headers['content-disposition'],'attachment; filename="artifact-'+own.id+'.bin"');
      assert.equal(visible.headers['cache-control'],'no-store');
      assert.equal(visible.headers['x-content-type-options'],'nosniff');
      assert.deepEqual(visible.rawPayload,own.bytes);assert.equal(sha256(visible.rawPayload),sha256(own.bytes));
      assert.deepEqual(running.calls.slice(callStart),[{kind:'MEMBER',actorId:owner.userId,value:owner.projectId},
        {kind:'ARTIFACT',actorId:owner.userId,value:[own.id,owner.projectId]}]);
      assert.deepEqual(fsCalls.slice(fsStart),[
        {kind:'lstat',path:root},{kind:'realpath',path:root},
        {kind:'lstat',path:join(root,'blobs')},{kind:'realpath',path:join(root,'blobs')},
        {kind:'lstat',path:join(root,'blobs',owner.projectId)},{kind:'realpath',path:join(root,'blobs',owner.projectId)},
        ...['lstat','open','stat','readFile','close'].map(kind=>({kind,path})),
      ]);
      assert.equal(handles.size,0);

      const missingAid=id(42);
      for(const [pid,aid,member] of [[other.projectId,other.id,false],[missingId,other.id,false],
        [owner.projectId,other.id,true],[owner.projectId,missingAid,true]] as const){
        const before=running.calls.length,filesBefore=fsCalls.length;
        const denied=await get(pid,aid);assert.equal(denied.statusCode,404,denied.body);
        assert.equal(denied.headers['content-disposition'],undefined);
        assert.equal(denied.headers['cache-control'],'no-store');
        const {requestId,...body}=denied.json();
        assert.equal(typeof requestId,'string');assert.ok(requestId.length>0);
        assert.deepEqual(body,{code:'NOT_FOUND',message:'요청을 처리하지 못했습니다',targetId:null,retryDisposition:'not-retryable',details:{}});
        assert.deepEqual(running.calls.slice(before),[{kind:'MEMBER',actorId:owner.userId,value:pid},
          ...(member?[{kind:'ARTIFACT',actorId:owner.userId,value:[aid,pid]}]:[])]);
        assert.equal(fsCalls.length,filesBefore);assert.equal(handles.size,0);
      }
    }

    // 행의 원 해시를 그대로 둔 채 파일 바이트만 같은 길이로 바꾸면 실제 ArtifactStore가 거절한다.
    const owner=owners[0],attachment=attachmentFiles[0]!,path=join(root,'blobs',owner.projectId,attachment.id);
    files.set(path,Buffer.alloc(attachment.bytes.length,0x78));
    const corrupted=await running.read(owner,'/'+owner.projectId+'/files/'+attachment.id);
    assert.equal(corrupted.statusCode,503,corrupted.body);
    assert.equal(corrupted.json().code,'STORAGE_FAILED');
    assert.equal(corrupted.headers['content-disposition'],undefined);
    assert.deepEqual(running.writes,[]);assert.deepEqual(blockedCalls,[]);assert.equal(handles.size,0);
  }finally{
    try{if(f){await f.app.close();assert.equal(f.app.server.listening,false);}}
    finally{fsMock.restore();}
  }
});

if(knowledgeChild)test(knowledgeTest,async()=>{
  const {root,fsCalls,handles,blockedCalls,fsMock}=await memoryFiles();
  let f:Awaited<ReturnType<typeof fixture>>|undefined;
  try{
    const running=await fixture(root,true);f=running;
    const {ProjectListCodec}=await import('../../../apps/server/modules/projects/service.ts');
    const codec=new ProjectListCodec(value=>knowledgeSign('KNOWLEDGE:'+value));
    const filter=(projectId:string)=>({query:canonicalJson({projectId,query:'공통',kind:'FACT',status:'ACTIVE'}),archived:false,limit:1});
    for(const [index,owner] of owners.entries()){
      const other=owners[1-index]!,ownRows=knowledgeRows.filter(row=>row.owner===owner),foreignRows=knowledgeRows.filter(row=>row.owner===other);
      const get=(projectId:string,query:string,cursor?:string)=>running.read(owner,'/'+projectId+'/knowledge?'+new URLSearchParams({
        limit:'1',kind:'FACT',query,...(cursor?{cursor}:{}),
      }));
      const expectedItem=(row:typeof knowledgeRows[number])=>({versionRef:row.ref,title:row.entry.title,kind:'FACT',
        sourceRefs:row.entry.sourceRefs,reasonSnippet:row.entry.reason,state:'PROPOSED',currentConfirmationValid:false});
      const ownFile=join(root,'blobs',owner.projectId,attachmentFiles[index]!.id);
      const start=fsCalls.length;
      const first=await get(owner.projectId,'공통');
      assert.equal(first.statusCode,200,first.body);
      const {nextCursor,...firstBody}=withoutObservedAt(first.json());
      assert.deepEqual(firstBody,{items:[expectedItem(ownRows[0]!)],hasMore:true,searchScope:'TITLE_REASON'});
      assert.equal(typeof nextCursor,'string');assert.ok(nextCursor);
      const cursor=nextCursor as string;
      assert.deepEqual(codec.read(cursor,owner.userId,filter(owner.projectId)),{at:ownRows[0]!.at,id:ownRows[0]!.ref.id});
      assert.throws(()=>codec.read(cursor,other.userId,filter(owner.projectId)),{message:'CURSOR_INVALID'});
      assert.throws(()=>codec.read(cursor,owner.userId,filter(other.projectId)),{message:'CURSOR_INVALID'});
      const second=await get(owner.projectId,'공통',cursor);
      assert.equal(second.statusCode,200,second.body);
      assert.deepEqual(withoutObservedAt(second.json()),{items:[expectedItem(ownRows[1]!)],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON'});
      assert.deepEqual(fsCalls.slice(start).filter(call=>call.kind==='readFile').map(call=>call.path),[ownFile,ownFile,ownFile,ownFile]);
      assert.equal(handles.size,0);

      const hiddenFs=fsCalls.length,hiddenSigns=running.cursorSigns();
      for(const term of [foreignRows[0]!.entry.title,foreignRows[1]!.entry.reason,'합성 미존재 검색어']){
        const hidden=await get(owner.projectId,term);
        assert.equal(hidden.statusCode,200,hidden.body);
        assert.deepEqual(withoutObservedAt(hidden.json()),{items:[],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON'});
      }
      assert.equal(running.cursorSigns(),hiddenSigns);assert.equal(fsCalls.length,hiddenFs);

      for(const pid of [other.projectId,missingId]){
        const before=running.calls.length;
        const denied=await get(pid,'공통',cursor);
        assert.equal(denied.statusCode,404,denied.body);assert.equal(denied.headers['cache-control'],'no-store');
        const {requestId,...body}=denied.json();assert.equal(typeof requestId,'string');assert.ok(requestId.length>0);
        assert.deepEqual(body,{code:'NOT_FOUND',message:'요청을 처리하지 못했습니다',targetId:null,retryDisposition:'not-retryable',details:{}});
        assert.deepEqual(running.calls.slice(before),[{kind:'MEMBER',actorId:owner.userId,value:pid}]);
        assert.equal(running.cursorSigns(),hiddenSigns);assert.equal(fsCalls.length,hiddenFs);
      }

      const otherCursor=codec.create(other.userId,filter(other.projectId),{at:foreignRows[0]!.at,id:foreignRows[0]!.ref.id});
      const before=running.calls.length;
      const rejected=await get(owner.projectId,'공통',otherCursor);
      assert.equal(rejected.statusCode,400,rejected.body);assert.equal(rejected.json().code,'CURSOR_INVALID');
      assert.deepEqual(running.calls.slice(before),[{kind:'MEMBER',actorId:owner.userId,value:owner.projectId}]);
      assert.equal(fsCalls.length,hiddenFs);
    }
    assert.deepEqual(running.writes,[]);assert.deepEqual(blockedCalls,[]);assert.equal(handles.size,0);
  }finally{
    try{if(f){await f.app.close();assert.equal(f.app.server.listening,false);}}
    finally{fsMock.restore();}
  }
});
