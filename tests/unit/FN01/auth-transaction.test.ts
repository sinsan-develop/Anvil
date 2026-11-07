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


function ownedTransactionFixture(){
 const row=fixture().row,queries:string[]=[],releases:(Error|undefined)[]=[],callbackError=new AuthFailure('NATIVE_PURPOSE_DENIED',403),commitError=Error('SYNTHETIC_COMMIT_LOST'),rollbackError=Error('SYNTHETIC_ROLLBACK_LOST'),releaseError=Error('SYNTHETIC_RELEASE_LOST');let commitResponse:unknown={command:'COMMIT',rows:[]},fault='';
 const db={query:async(sql:string)=>{queries.push(sql);if(sql==='BEGIN')return{command:'BEGIN',rows:[]};if(sql==='COMMIT'){if(fault==='commit')throw commitError;return commitResponse;}if(sql==='ROLLBACK'){if(fault==='rollback')throw rollbackError;return{command:'ROLLBACK',rows:[]};}if(sql==="SELECT pg_advisory_xact_lock(hashtext('anvil-auth-attempts'))")return{rows:[]};if(sql.includes('FROM anvil.auth_sessions'))return{rows:[row]};if(sql.includes('FROM anvil.auth_attempt_windows'))return{rows:[{blocked_until:new Date('2099-01-01T00:00:00.000Z')}]};if(sql.startsWith('INSERT INTO anvil.auth_audit_events'))return{rows:[],rowCount:1};throw Error('UNEXPECTED_TRANSACTION_QUERY');},release:(error?:Error)=>{queries.push('RELEASE');releases.push(error);if(fault==='release')throw releaseError;}},pool={connect:async()=>db},access=new AccessRepository(pool as unknown as Pool,{installationId:'44444444-4444-4444-8444-444444444444',key:Buffer.alloc(32,7)});
 return{access,queries,releases,callbackError,commitError,rollbackError,releaseError,setResponse(value:unknown){commitResponse=value;},fault(value:string){fault=value;}};
}

test('공통 transaction은 정확 COMMIT tag와 Pool release 뒤에만 정상값과 undefined를 반환한다',async()=>{
 for(const value of [{accepted:false},undefined]){const f=ownedTransactionFixture();let marker=0;assert.equal(await f.access.authenticated(token,csrf,async()=>value).then(result=>{assert.equal(f.queries.at(-1),'RELEASE');marker++;return result;}),value);assert.equal(marker,1);assert.equal(f.queries.filter(q=>q==='COMMIT').length,1);assert.equal(f.queries.includes('ROLLBACK'),false);assert.deepEqual(f.releases,[undefined]);}
});

test('COMMIT 응답 누락과 다른 tag는 정상 반환·후속 marker0이며 rollback과 연결 폐기를 유지한다',async()=>{
 for(const response of [undefined,null,{}, {command:'ROLLBACK'}, {command:'SELECT'}, {command:'commit'}]){const f=ownedTransactionFixture();f.setResponse(response);let marker=0;await assert.rejects(f.access.authenticated(token,csrf,async()=>({accepted:false})).then(value=>{marker++;return value;}),/TRANSACTION_STATE_UNKNOWN/);assert.equal(marker,0);assert.equal(f.queries.filter(q=>q==='COMMIT').length,1);assert.deepEqual(f.queries.slice(-2),['ROLLBACK','RELEASE']);assert.equal(f.releases.length,1);assert.equal(f.releases[0]?.message,'TRANSACTION_STATE_UNKNOWN');}
});

test('공통 transaction은 callback·COMMIT·rollback·release 실패의 원 오류와 정리 순서를 보존한다',async()=>{
 for(const fault of ['callback','commit','rollback','release']){const f=ownedTransactionFixture();f.fault(fault);const expected=fault==='commit'?f.commitError:fault==='release'?f.releaseError:f.callbackError;let marker=0;await assert.rejects(f.access.authenticated(token,csrf,async()=>{if(fault==='callback'||fault==='rollback')throw f.callbackError;return undefined;}).then(value=>{marker++;return value;}),error=>error===expected);assert.equal(marker,0);assert.equal(f.releases.length,1);assert.equal(f.queries.at(-1),'RELEASE');assert.equal(f.queries.includes('ROLLBACK'),fault!=='release');assert.equal(f.queries.includes('COMMIT'),fault==='commit'||fault==='release');assert.equal(f.releases[0],fault==='commit'?f.commitError:fault==='rollback'?f.rollbackError:undefined);}
});

test('감사 뒤 Result failure의 업무상 거절은 정상 COMMIT 후 원429이며 미확정 완료는 UNKNOWN으로 구분한다',async()=>{
 for(const confirmed of [true,false]){const f=ownedTransactionFixture();if(!confirmed)f.setResponse({command:'ROLLBACK'});await assert.rejects(f.access.login('source-test','합성 입력','합성 클라이언트','source-only'),error=>confirmed?error instanceof AuthFailure&&error.message==='AUTH_RATE_LIMITED'&&error.statusCode===429:error instanceof Error&&error.message==='TRANSACTION_STATE_UNKNOWN');const audit=f.queries.findIndex(q=>q.startsWith('INSERT INTO anvil.auth_audit_events'));assert.ok(audit>=0);assert.ok(audit<f.queries.indexOf('COMMIT'));assert.equal(f.queries.includes('ROLLBACK'),!confirmed);assert.equal(f.queries.at(-1),'RELEASE');assert.equal(f.releases.length,1);assert.equal(f.releases[0]?.message,confirmed?undefined:'TRANSACTION_STATE_UNKNOWN');}
});
