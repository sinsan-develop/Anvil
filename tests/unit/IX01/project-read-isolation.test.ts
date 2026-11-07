import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {PoolClient} from 'pg';
import {buildApp} from '../../../apps/server/app.ts';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../../../apps/server/modules/access/repository.ts';

const id=(n:number)=>'a6f30000-0000-4000-8000-'+String(n).padStart(12,'0');
const origin='https://anvil-synthetic.invalid',host=new URL(origin).host;
const at='2026-11-08T00:00:00.000000Z',missingId=id(30);
const owners=[
  {token:'synthetic-owner-alpha',userId:id(1),clientId:id(2),sessionId:id(3),projectId:id(4),name:'합성 공동검색 알파',purpose:'알파 고유 목적'},
  {token:'synthetic-owner-beta',userId:id(5),clientId:id(6),sessionId:id(7),projectId:id(8),name:'합성 공동검색 베타',purpose:'베타 고유 목적'},
] as const;

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

test('IX01 목록 SQL 대역은 참여 조건에 OR TRUE를 덧붙인 조회 범위 확장을 거절한다',()=>{
  const widened=expectedListSql.replace('m.revoked_at IS NULL','m.revoked_at IS NULL OR TRUE');
  assert.notEqual(widened,expectedListSql);
  assert.throws(()=>assertListSql(widened),{code:'ERR_ASSERTION',message:/PROJECT_LIST_SQL_SCOPE_MISMATCH/});
});

function fixture(){
  const projects=owners.map(owner=>({id:owner.projectId,name:owner.name,purpose:owner.purpose,desired_outcome:'격리 조회 검수',
    version:1,created_at:new Date(at),updated_at:new Date(at),archived_at:null}));
  const memberships=owners.map(owner=>({projectId:owner.projectId,userId:owner.userId,participation:'OWNER',revokedAt:null}));
  const calls:{kind:'LIST'|'DETAIL'|'SOURCE';actorId:string;value?:unknown}[]=[],writes:string[]=[];
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
          throw Error('UNMODELED_PROJECT_READ_SQL');
        },
      } as unknown as PoolClient;
      return body(db,actor);
    },
  };
  const app=buildApp({},undefined,{repository:repository as unknown as AccessRepository,origin});
  const read=(owner:typeof owners[number],path:string)=>app.inject({method:'GET',url:'/api/v1/projects'+path,
    headers:{host,cookie:'__Host-anvil.sid='+owner.token}});
  return {app,read,calls,writes,cursorSigns:()=>cursorSigns};
}

function withoutObservedAt(response:Record<string,unknown>){
  const {observedAt,...body}=response;
  assert.equal(typeof observedAt,'string');assert.ok(Number.isFinite(Date.parse(observedAt as string)));
  return body;
}

test('IX01 두 합성 OWNER의 목록과 검색은 상대 프로젝트 이름·건수·커서를 노출하지 않는다',async()=>{
  const f=fixture();
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

test('IX01 두 합성 OWNER의 직접 조회는 자신의 상세만 반환하고 상대와 미존재를 같은 404로 응답한다',async()=>{
  const f=fixture();
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
