import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const m:any=await import('../../../apps/server/modules/documents/source-content-verification-head.ts');
const id=(n:number)=>`88000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)}),now=Date.parse('2026-10-24T01:00:00.000Z'),at=(n:number)=>new Date(now+n).toISOString();
const context=()=>({observationRef:ref(2),targetIndex:0,relativePath:'src/a.ts',documentRef:ref(3),observerImplementationRef:ref(4)});
function row(version=1,previous:any=null,decision=version===1?'ACCEPTED':'REVOKED'):any{
 const snapshot={kind:'합성 불투명 계보',version,decision};return {project_id:id(1),id:id(5),version,observation_id:id(2),observation_version:1,observation_hash:'a'.repeat(64),target_index:0,relative_path:'src/a.ts',document_id:id(3),document_version:1,document_hash:'a'.repeat(64),observer_implementation_ref:ref(4),decision,verified_at:at(-3000+version*1000),expires_at:at(10000),previous_ref:previous===null?null:{id:previous.id,version:Number(previous.version),contentHash:previous.content_hash},snapshot_json:snapshot,content_hash:contentHash(canonicalJson(snapshot))};
}
function fn(){assert.equal(typeof m.readLatestSourceContentVerificationLineageCandidate,'function','검증 latest+인접계보 판독 미구현');return m.readLatestSourceContentVerificationLineageCandidate;}
function db(rows:any[],queries:any[]=[]){return {async query(sql:string,args:unknown[]){queries.push({sql,args});return {rows};}};}
async function load(current:any,previous:any=null){return fn()(db([{current,previous}]),id(1),context(),at(-2500),now);}
test('단일 최신head 조회의 최초 양성도 최소 계보·false권위이며 입력은 await 전에 고정된다',async()=>{
 const c=context(),r=row(),queries:any[]=[];const out=await fn()({async query(sql:string,args:unknown[]){queries.push({sql,args});c.documentRef.contentHash='f'.repeat(64);return {rows:[{current:r,previous:null}]};}},id(1),c,at(-2500),now);
 assert.equal(queries.length,1);assert.deepEqual(queries[0].args,[id(1),id(2),0]);assert.match(queries[0].sql,/ORDER BY version DESC LIMIT 1/);assert.match(queries[0].sql,/p\.version=h\.version-1/);assert.doesNotMatch(queries[0].sql,/p\.content_hash\s*=/);assert.equal(out.status,'UNVERIFIED');assert.equal(out.reason,'CURRENT_VERIFIER_UNAVAILABLE');assert.equal(out.lineage.previousRef,null);assert.deepEqual(out.verificationRef,{id:id(5),version:1,contentHash:r.content_hash});
 for(const key of ['verifierEvidenceVerified','currentAuthorityVerified','storageMutationPerformed','executionAuthorized','linkAuthorized'])assert.equal(out[key],false);assert.equal(JSON.stringify(out).includes('src/a.ts'),false);assert.equal(JSON.stringify(out).includes('합성 불투명 계보'),false);
});
test('최신 회수·무효는 정합한 인접계보를 표시해도 거절하며 과거양성으로 fallback하지 않는다',async()=>{
 const p=row();for(const decision of ['REVOKED','INVALID']){const n=row(2,p,decision),q:any[]=[],out=await fn()(db([{current:n,previous:p}],q),id(1),context(),at(-2500),now);assert.equal(q.length,1);assert.equal(out.status,'DENIED');assert.equal(out.reason,decision==='REVOKED'?'VERIFICATION_REVOKED':'VERIFICATION_INVALID');assert.equal(out.lineage.previousRef.contentHash,p.content_hash);assert.equal(out.lineage.verificationRef.version,2);assert.equal(out.linkAuthorized,false);}
});
test('인접 이전 부재·hash/identity/시각불일치가 최신음성을 살리지 않으며 계보만 닫힌다',async()=>{
 const p=row(),n=row(2,p);for(const previous of [null,{...p,document_hash:'b'.repeat(64)},{...p,verified_at:at(-500)}, {...p,snapshot_json:{other:true},content_hash:contentHash(canonicalJson({other:true}))}]){const out=await load(n,previous);assert.equal(out.reason,'VERIFICATION_REVOKED');assert.equal(out.status,'DENIED');assert.equal(out.lineage,null);assert.equal(out.linkAuthorized,false);}
 const first=await load(row(),p);assert.equal(first.status,'DENIED');assert.equal(first.reason,'VERIFICATION_LINEAGE_UNAVAILABLE');assert.equal(first.lineage,null);
});
test('최신 만료·원수신 이전·malformed와 부재는 옛행이나 계보로 대체하지 않는다',async()=>{
 for(const [r,reason] of [[{...row(),expires_at:at(0)},'VERIFICATION_EXPIRED'],[{...row(),verified_at:at(-2600)},'VERIFICATION_BEFORE_OBSERVATION'],[{...row(),content_hash:'f'.repeat(64)},'MALFORMED_HEAD'],[{...row(),document_hash:'f'.repeat(64)},'MALFORMED_HEAD']] as const){const out=await load(r);assert.equal(out.status,'DENIED');assert.equal(out.reason,reason);assert.equal(out.linkAuthorized,false);}
 const absent=await fn()(db([]),id(1),context(),at(-2500),now);assert.equal(absent.reason,'VERIFICATION_ABSENT');assert.equal(absent.lineage,null);
 const multiple=await fn()(db([{current:row(),previous:null},{current:row(),previous:null}]),id(1),context(),at(-2500),now);assert.equal(multiple.reason,'MALFORMED_HEAD');
});
test('getter0·PG 정수/Date와 입력선검사·원query오류를 유지한다',async()=>{
 let gets=0,calls=0;const bundle={current:row(),previous:null};Object.defineProperty(bundle,'current',{enumerable:true,get(){gets++;return row();}});const bad=await fn()(db([bundle]),id(1),context(),at(-2500),now);assert.equal(bad.reason,'MALFORMED_HEAD');assert.equal(gets,0);
 const p=row(),n=row(2,p);for(const r of [p,n]){r.version=String(r.version);r.observation_version='1';r.document_version='1';r.target_index='0';r.verified_at=new Date(r.verified_at);r.expires_at=new Date(r.expires_at);}const normalized=await load(n,p);assert.equal(normalized.lineage.verificationRef.version,2);
 const error=Error('SYNTHETIC_VERIFICATION_LINEAGE_QUERY'),d={async query(){calls++;throw error;}};for(const c of [{...context(),targetIndex:200},{...context(),verified:true}])await assert.rejects(fn()(d,id(1),c,at(-2500),now),/SOURCE_CONTENT_VERIFICATION_INPUT_INVALID/);await assert.rejects(fn()(d,id(1),context(),at(1),now),/SOURCE_CONTENT_VERIFICATION_INPUT_INVALID/);assert.equal(calls,0);await assert.rejects(fn()(d,id(1),context(),at(-2500),now),e=>e===error);assert.equal(calls,1);
});
