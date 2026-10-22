import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import type {Pool,PoolClient} from 'pg';
import {AccessRepository,AuthFailure} from '../../../apps/server/modules/access/repository.ts';

const token='t'.repeat(43),csrf='c'.repeat(43),at=new Date('2050-01-01T00:00:00.000Z');
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
function fixture(){
 const row={id:'11111111-1111-4111-8111-111111111111',uid:'22222222-2222-4222-8222-222222222222',client_id:'33333333-3333-4333-8333-333333333333',server_owner:true,user_status:'ACTIVE',credential_generation:2,current_generation:2,csrf_digest:digest(csrf),revoked_at:null,user_revoked_at:null,client_revoked_at:null,idle_expires_at:new Date(at.getTime()+10000),absolute_expires_at:new Date(at.getTime()+20000),reauth_until:new Date(at.getTime()+5000)};
 const queries:string[]=[];let clock:unknown=at,transactionId:string|null='77',missing=false;
 const db={async query(sql:string,args?:unknown[]){queries.push(sql);
  if(sql.includes('FROM anvil.auth_sessions')){assert.deepEqual(args,[digest(token)]);assert.match(sql,/FOR UPDATE OF u,s,c/);return{rows:missing?[]:[row]};}
  if(sql.includes('clock_timestamp()'))return{rows:[{at:clock,transaction_id:transactionId}]};
  throw Error('UNEXPECTED_QUERY');
 },release(){throw Error('CALLER_OWNS_RELEASE');}} as unknown as PoolClient;
 const pool={connect(){throw Error('NO_NESTED_CONNECTION');}} as unknown as Pool;
 const access=new AccessRepository(pool,{installationId:'44444444-4444-4444-8444-444444444444',key:Buffer.alloc(32,7)});
 return{access,db,row,queries,setClock(v:unknown){clock=v;},noTransaction(){transactionId=null;},missing(){missing=true;}};
}

test('기존 transaction의 session/CSRF를 DB 시각으로 검사하고 연결·종료는 호출자에게 남긴다',async()=>{
 const f=fixture(),identity=await f.access.authenticateInTransaction(f.db,token,csrf);
 assert.equal(identity.actorId,'22222222-2222-4222-8222-222222222222');
 assert.equal(identity.clientId,'33333333-3333-4333-8333-333333333333');assert.equal(identity.credentialGeneration,2);
 assert.equal(identity.authSession?.id,'11111111-1111-4111-8111-111111111111');
 assert(Object.isFrozen(identity));assert(Object.isFrozen(identity.authSession));
 assert.equal(f.queries.length,2);assert(f.queries.every(q=>! /^(BEGIN|COMMIT|ROLLBACK|INSERT|UPDATE|DELETE)/.test(q)));
 assert(!JSON.stringify(identity).includes(token));assert(!JSON.stringify(identity).includes(csrf));
});

test('회수·자격세대·기한을 현재 DB 시각으로 다시 검사하고 거절한다',async()=>{
 const changes=[(f:ReturnType<typeof fixture>)=>{f.row.revoked_at=at as never;},(f:ReturnType<typeof fixture>)=>{f.row.user_revoked_at=at as never;},(f:ReturnType<typeof fixture>)=>{f.row.client_revoked_at=at as never;},(f:ReturnType<typeof fixture>)=>{f.row.current_generation=3;},(f:ReturnType<typeof fixture>)=>{f.row.user_status='DISABLED';},(f:ReturnType<typeof fixture>)=>{f.setClock(f.row.idle_expires_at);},(f:ReturnType<typeof fixture>)=>{f.row.absolute_expires_at=at;},(f:ReturnType<typeof fixture>)=>{f.missing();}];
 for(const change of changes){const f=fixture();change(f);await assert.rejects(f.access.authenticateInTransaction(f.db,token,csrf),e=>e instanceof AuthFailure&&e.message==='AUTH_REQUIRED');}
});

test('CSRF 누락·불일치와 잘못된 token은 인증하지 않는다',async()=>{
 for(const bad of [null,undefined,'','wrong','x'.repeat(43)]){const f=fixture();await assert.rejects(f.access.authenticateInTransaction(f.db,token,bad as string),e=>e instanceof AuthFailure&&e.message==='CSRF_INVALID'&&e.statusCode===403);}
 const f=fixture();await assert.rejects(f.access.authenticateInTransaction(f.db,'bad',csrf),/AUTH_REQUIRED/);assert.equal(f.queries.length,0);
});

test('활성 transaction·유효 DB 시각이 없으면 인증을 발급하지 않는다',async()=>{
 for(const bad of [null,new Date(NaN),'2050-01-01T00:00:00Z']){const f=fixture();f.setClock(bad);await assert.rejects(f.access.authenticateInTransaction(f.db,token,csrf),/AUTH_REQUIRED/);}
 const f=fixture();f.noTransaction();await assert.rejects(f.access.authenticateInTransaction(f.db,token,csrf),/AUTH_REQUIRED/);
});

test('이전 인증 결과를 캐시하지 않고 같은 transaction에서도 회수를 다시 읽는다',async()=>{
 const f=fixture(),first=await f.access.authenticateInTransaction(f.db,token,csrf);f.row.current_generation=3;
 await assert.rejects(f.access.authenticateInTransaction(f.db,token,csrf),/AUTH_REQUIRED/);assert.equal(first.credentialGeneration,2);
});
