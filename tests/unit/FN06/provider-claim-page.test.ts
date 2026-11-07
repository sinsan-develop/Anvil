import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHmac} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {fixture,at} from './provider-history-db-fixture.ts';
const m:any=await import('../../../apps/server/modules/executions/provider-session-claim-page.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const sign=(v:string)=>createHmac('sha256',Buffer.alloc(32,7)).update(v).digest('hex');
function setup(count=3){
 const f=fixture();f.provideClaim();const base=f.rows()[0];
 f.replaceRows(Array.from({length:count},(_,i)=>{
  const row=structuredClone(base),id=String(i+1).padStart(8,'0')+'-1111-4111-8111-111111111111',c=row.snapshot_json.claim;
  c.claimId=id;c.protectedHandleRef.id=id;c.source.requestIdDigest=hash(i);row.claim_id=id;row.request_id_digest=c.source.requestIdDigest;
  row.content_hash=hash(c);row.event_key=hash([c.projectId,c.execution.id,c.execution.generation,c.commandId,c.kind,c.source.requestIdDigest]);row.snapshot_json.eventKey=row.event_key;
  row.snapshot_json.receipt.claimRef={id,version:1,contentHash:row.content_hash};return row;
 }));
 const q={projectId:f.q.projectId,agentSessionId:f.q.agentSessionId,limit:2,cursor:null};
 return{f,q,read:(query:any=q)=>{assert.equal(typeof m.readProviderClaimPage,'function');return m.readProviderClaimPage(f.make(),f.db,query,sign);}};
}
test('현재 OWNER 목록은 유한 keyset/서명 cursor로 정확 metadata만 읽고 원 예약·claim을 바꾸지 않는다',async()=>{
 const x=setup(),before=JSON.stringify(x.f.rows()),page=await x.read();assert.equal(page.items.length,2);assert.equal(page.hasMore,true);assert.equal(typeof page.nextCursor,'string');assert.equal(page.availability,'UNVERIFIED');assert.equal(page.historyOnly,true);assert.equal(page.items[0].query.claimHash,page.items[0].receipt.claimRef.contentHash);
 const second=await x.read({...x.q,cursor:page.nextCursor});assert.equal(second.items.length,1);assert.equal(second.hasMore,false);assert.equal(second.nextCursor,null);assert.equal(new Set([...page.items,...second.items].map((i:any)=>i.receipt.claimRef.id)).size,3);assert.equal(JSON.stringify(x.f.rows()),before);assert.equal(x.f.calls.some(c=>/^(INSERT|UPDATE|DELETE|BEGIN|COMMIT)/.test(c.sql)),false);
});
test('cursor는 현재 actor/예약/filter/기한·서명에 결박하며 타주체·변조·만료는 거절한다',async()=>{
 assert.equal(typeof m.readProviderClaimPage,'function');const x=setup(),page=await x.read();
 for(const q of [{...x.q,limit:1,cursor:page.nextCursor},{...x.q,cursor:page.nextCursor+'x'},{...x.q,limit:51},{...x.q,extra:'actor'}])await assert.rejects(x.read(q));
 x.f.actor.clientId='99999999-9999-4999-8999-999999999999';await assert.rejects(x.read({...x.q,cursor:page.nextCursor}));
 const y=setup();y.f.fault('expire');await assert.rejects(y.read());const z=setup();z.f.member.participation='VIEWER';await assert.rejects(z.read());assert.equal(z.f.calls.some(c=>c.sql.includes('FROM anvil.provider_session_claims')),false);
});
test('손상·타예약 row/원 receipt·조회후 회수는 목록을 비우고 성공으로 위장하지 않는다',async()=>{
 assert.equal(typeof m.readProviderClaimPage,'function');
 for(const change of [(r:any)=>r.snapshot_json.receipt.executionAuthorized=true,(r:any)=>r.content_hash='f'.repeat(64),(r:any)=>r.agent_session_id='99999999-9999-4999-8999-999999999999']){const x=setup(1);change(x.f.rows()[0]);await assert.rejects(x.read());}
 const x=setup();x.f.fault('revoke');await assert.rejects(x.read());const empty=setup(0),page=await empty.read();assert.equal(page.items.length,0);assert.equal(page.hasMore,false);assert.equal(page.observedAt,at);
});
test('같은 HUMAN 로그인 기한 갱신은 cursor 결박을 바꾸지 않고 원 cursor 기한도 늘리지 않는다',async()=>{
 const x=setup(),page=await x.read();x.f.actor.authSession.idleExpiresAt='2026-10-22T05:15:00.000Z';x.f.user.idle_expires_at=new Date(x.f.actor.authSession.idleExpiresAt);
 const next=await x.read({...x.q,cursor:page.nextCursor});assert.equal(next.items.length,1);assert.equal(next.hasMore,false);
 x.f.clock('2026-10-22T05:00:31.000Z');await assert.rejects(x.read({...x.q,cursor:page.nextCursor}));assert.equal((await x.read()).items.length,2);
});
