import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {createManagementOriginTransactionFence} from '../../integration/FN03/source-content-management-origin-transaction-fence.ts';

function fixture(){
 const calls:string[]=[],releases:unknown[]=[];
 let current=true,reply:(sql:string)=>Promise<unknown>=async sql=>({command:sql==='SELECT 1'?'SELECT':sql});
 const client={query(sql:string){calls.push(sql);return reply(sql);},release(error?:unknown){releases.push(error);}};
 const raw={async connect(){calls.push('CONNECT');return client;}};
 const fence=createManagementOriginTransactionFence(raw,()=>{if(!current)throw Error('private deadline');});
 return{calls,releases,client,raw,fence,expire(){current=false;},reply(fn:typeof reply){reply=fn;}};
}
test('고정 Pool/client 메서드와 원 BEGIN/COMMIT 응답·release를 수거한다',async()=>{
 const h=fixture();assert.equal(h.fence.pool.connect,h.fence.pool.connect);
 const c=await h.fence.pool.connect();assert.equal(c.query,c.query);assert.equal(c.release,c.release);
 await c.query('BEGIN');await c.query('SELECT 1');await c.query('COMMIT');c.release();
 assert.deepEqual(h.calls,['CONNECT','BEGIN','SELECT 1','COMMIT']);assert.deepEqual(h.releases,[undefined]);
 assert.deepEqual(h.fence.settlements(),['COMMIT']);assert.deepEqual(h.fence.releases(),['RELEASED']);
 assert.throws(()=>c.release());await assert.rejects(c.query('SELECT 1'));assert.equal(h.releases.length,1);
});
test('원 업무 오류는 원 rollback tag 확인 뒤 ROLLBACK, 오류 객체는 보존한다',async()=>{
 const h=fixture(),failure=Error('private SQL');h.reply(async sql=>{if(sql==='SELECT 1')throw failure;return{command:sql};});
 const c=await h.fence.pool.connect();await c.query('BEGIN');await assert.rejects(c.query('SELECT 1'),e=>e===failure);
 await c.query('ROLLBACK');c.release();assert.deepEqual(h.fence.settlements(),['ROLLBACK']);
});
test('COMMIT throw 또는 다른 tag는 이후 rollback 성공으로 UNKNOWN을 덮지 않는다',async()=>{
 for(const throws of [true,false]){
  const h=fixture();h.reply(async sql=>{if(sql==='COMMIT'){if(throws)throw Error('private connection');return{command:'ROLLBACK'};}return{command:sql};});
  const c=await h.fence.pool.connect();await c.query('BEGIN');await assert.rejects(c.query('COMMIT'));
  await c.query('ROLLBACK');c.release();assert.deepEqual(h.fence.settlements(),['UNKNOWN']);
  await assert.rejects(h.fence.pool.connect());assert.equal(h.calls.filter(x=>x==='CONNECT').length,1);
 }
});
test('불명 뒤 원 rollback도 단 한 번만 보내고 원 Access의 정상/거절/불명 거래를 그대로 수거한다',async()=>{
 const once=fixture(),client=await once.fence.pool.connect();await client.query('BEGIN');once.expire();
 await assert.rejects(client.query('COMMIT'));await client.query('ROLLBACK');await assert.rejects(client.query('ROLLBACK'));client.release();
 assert.equal(once.calls.filter(x=>x==='ROLLBACK').length,1);
 const original=AccessRepository.prototype.authenticated;
 for(const mode of ['normal','denied','unknown']){
  const h=fixture(),csrf='c'.repeat(43),failure=Error('FIXTURE_DENIED');
  h.reply(async sql=>{
   if(sql.startsWith('SELECT s.*'))return{command:'SELECT',rows:[{id:'session',uid:'actor',client_id:'client',server_owner:false,user_status:'ACTIVE',revoked_at:null,user_revoked_at:null,client_revoked_at:null,credential_generation:1,current_generation:1,idle_expires_at:new Date('2099-01-01'),absolute_expires_at:new Date('2099-01-01'),reauth_until:new Date('2099-01-01'),csrf_digest:createHash('sha256').update(csrf).digest('hex')}]};
   if(mode==='unknown'&&sql==='COMMIT')throw Error('FIXTURE_COMMIT_UNKNOWN');
   return{command:sql};
  });
  const access=new AccessRepository(h.fence.pool as unknown as Pool,{installationId:'00000000-0000-4000-8000-000000000001',key:Buffer.alloc(32)});
  assert.equal(access.authenticated,original);assert.equal(Object.hasOwn(access,'authenticated'),false);
  const action=access.authenticated('t'.repeat(43),csrf,async(db,identity)=>{const query=db.query;assert.equal(db.query,query);assert.equal(identity.actorId,'actor');if(mode==='denied')throw failure;return'OK';});
  if(mode==='normal')assert.equal(await action,'OK');else await assert.rejects(action);
  assert.deepEqual(h.fence.settlements(),[mode==='normal'?'COMMIT':mode==='denied'?'ROLLBACK':'UNKNOWN']);
  assert.equal(h.releases.length,1);assert.equal(h.calls.filter(x=>x==='ROLLBACK').length,mode==='normal'?0:1);
 }
});
test('BEGIN 및 ROLLBACK tag 불일치와 원 release 예외를 확정 종결로 표시하지 않는다',async()=>{
 for(const target of ['BEGIN','ROLLBACK']){
  const h=fixture();h.reply(async sql=>({command:sql===target?'SELECT':sql}));const c=await h.fence.pool.connect();
  if(target!=='BEGIN')await c.query('BEGIN');await assert.rejects(c.query(target));c.release();assert.deepEqual(h.fence.settlements(),['UNKNOWN']);
 }
 const h=fixture();h.client.release=()=>{throw Error('private release');};const c=await h.fence.pool.connect();
 await c.query('BEGIN');await c.query('COMMIT');assert.throws(()=>c.release());assert.deepEqual(h.fence.releases(),['UNKNOWN']);
 await assert.rejects(h.fence.pool.connect());
});
test('현재성 소실 뒤 새 query/연결0, 원 rollback/release만 수거한다',async()=>{
 const h=fixture(),c=await h.fence.pool.connect();await c.query('BEGIN');h.expire();
 await assert.rejects(c.query('SELECT 1'));await c.query('ROLLBACK');c.release();
 assert.deepEqual(h.calls,['CONNECT','BEGIN','ROLLBACK']);assert.deepEqual(h.fence.settlements(),['UNKNOWN']);
 await assert.rejects(h.fence.pool.connect());
});
test('늦은 COMMIT 성공·중첩 query는 불명이며 원 client 메서드 교체는 전송 전 거절한다',async()=>{
 const h=fixture(),c=await h.fence.pool.connect();await c.query('BEGIN');
 let finish!:(value:unknown)=>void;h.reply(()=>new Promise(resolve=>{finish=resolve;}));const pending=c.query('COMMIT');
 h.expire();finish({command:'COMMIT'});await assert.rejects(pending);assert.deepEqual(h.fence.settlements(),['UNKNOWN']);c.release();
 const x=fixture(),d=await x.fence.pool.connect();await d.query('BEGIN');x.client.query=async()=>({command:'SELECT'});
 await assert.rejects(d.query('SELECT 1'));d.release();assert.deepEqual(x.calls,['CONNECT','BEGIN']);
 const y=fixture(),e=await y.fence.pool.connect();await e.query('BEGIN');y.reply(()=>new Promise(resolve=>{finish=resolve;}));const first=e.query('SELECT 1');
 await assert.rejects(e.query('COMMIT'));finish({command:'SELECT'});await assert.rejects(first);e.release();assert.deepEqual(y.fence.settlements(),['UNKNOWN']);
});
test('연결 획득 뒤 현재성 소실은 원 release 1회, client 재사용 checkout은 별도 수명이다',async()=>{
 const h=fixture();h.raw.connect=async()=>{h.expire();return h.client;};
 // factory 이후 connect 교체는 원 connect를 호출하지 않는다.
 await assert.rejects(h.fence.pool.connect());assert.deepEqual(h.calls,[]);
 const x=fixture();x.raw.connect=async()=>{x.expire();return x.client;};const f=createManagementOriginTransactionFence(x.raw,()=>{if(x.calls.length)throw Error('scope');x.calls.push('CHECK');});
 await assert.rejects(f.pool.connect());assert.equal(x.releases.length,1);
 const y=fixture();for(let n=0;n<2;n++){const c=await y.fence.pool.connect();await c.query('BEGIN');await c.query('COMMIT');c.release();}
 assert.deepEqual(y.fence.settlements(),['COMMIT','COMMIT']);assert.equal(y.releases.length,2);
});
test('동시에 같은 원 client를 반환한 다른 checkout은 query/release 소유권을 받지 않는다',async()=>{
 const h=fixture(),c=await h.fence.pool.connect();await c.query('BEGIN');
 await assert.rejects(h.fence.pool.connect());assert.equal(h.releases.length,0);
 await assert.rejects(c.query('SELECT 1'));await c.query('ROLLBACK');c.release();
 assert.deepEqual(h.fence.settlements(),['UNKNOWN']);assert.equal(h.releases.length,1);
 assert.equal(h.calls.filter(x=>x==='SELECT 1').length,0);
});
