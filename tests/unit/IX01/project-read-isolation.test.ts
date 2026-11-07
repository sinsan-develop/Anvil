import assert from 'node:assert/strict';
import {mock,test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../../../apps/server/modules/access/repository.ts';

const id=(n:number)=>'a6f30000-0000-4000-8000-'+String(n).padStart(12,'0');
const origin='https://anvil-synthetic.invalid',host=new URL(origin).host;
const at='2026-11-08T00:00:00.000000Z',missingId=id(30);
const owners=[
  {token:'synthetic-owner-alpha',userId:id(1),clientId:id(2),sessionId:id(3),projectId:id(4),name:'합성 공동검색 알파',purpose:'알파 고유 목적'},
  {token:'synthetic-owner-beta',userId:id(5),clientId:id(6),sessionId:id(7),projectId:id(8),name:'합성 공동검색 베타',purpose:'베타 고유 목적'},
] as const;

const artifactChild=process.env.ANVIL_IX01_ARTIFACT_MEMORY_CHILD==='1';
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

if(!artifactChild)test('IX01 목록 SQL 대역은 참여 조건에 OR TRUE를 덧붙인 조회 범위 확장을 거절한다',()=>{
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

async function fixture(artifactRoot?:string){
  const projects=owners.map(owner=>({id:owner.projectId,name:owner.name,purpose:owner.purpose,desired_outcome:'격리 조회 검수',
    version:1,created_at:new Date(at),updated_at:new Date(at),archived_at:null}));
  const memberships=owners.map(owner=>({projectId:owner.projectId,userId:owner.userId,participation:'OWNER',revokedAt:null}));
  const calls:{kind:'LIST'|'DETAIL'|'SOURCE'|'MEMBER'|'ARTIFACT';actorId:string;value?:unknown}[]=[],writes:string[]=[];
  let cursorSigns=0;

  // 쿠키→인증 주체와 SQL 결과만 메모리 모형이다. 앱 라우트, ProjectsRepository, 오류 응답 및 목록 커서 결정은 실제 코드다.
  const repository={
    installationId:id(90),
    signProjectCursor(){
      cursorSigns++;
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

if(!artifactChild)test('IX01 두 합성 OWNER의 목록과 검색은 상대 프로젝트 이름·건수·커서를 노출하지 않는다',async()=>{
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

if(!artifactChild)test('IX01 두 합성 OWNER의 직접 조회는 자신의 상세만 반환하고 상대와 미존재를 같은 404로 응답한다',async()=>{
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

if(!artifactChild)test(attachmentTest,()=>{
  // 다른 시험과 ESM 모듈 캐시를 공유하지 않는 별도 Node 프로세스에서만 FS import를 대역한다.
  const env={...process.env,ANVIL_IX01_ARTIFACT_MEMORY_CHILD:'1'};
  Reflect.deleteProperty(env,'NODE_TEST_CONTEXT');
  const child=spawnSync(process.execPath,['--experimental-test-module-mocks','--test','--test-reporter=spec',fileURLToPath(import.meta.url)],{
    env,encoding:'utf8',timeout:30000,windowsHide:true,
  });
  assert.equal(child.error,undefined);
  assert.equal(child.signal,null);
  assert.equal(child.status,0,child.stdout+'\n'+child.stderr);
  assert.match(child.stdout,/pass 1\b/);
});

if(artifactChild)test(attachmentTest,async()=>{
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
