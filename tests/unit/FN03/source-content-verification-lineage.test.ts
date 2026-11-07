import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const m=await import(new URL('../../../apps/server/modules/documents/source-content-verification-lineage.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const id=(n:number)=>`87000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)}),zero=Date.parse('2026-10-23T21:00:00.000Z'),at=(n:number)=>new Date(zero+n).toISOString();
function row(version=1,previous:any=null,decision=version===1?'ACCEPTED':'REVOKED'):any{const snapshot={kind:'합성 불투명 검증 snapshot',version,decision};return {project_id:id(1),id:id(5),version,observation_id:id(2),observation_version:1,observation_hash:'a'.repeat(64),target_index:0,relative_path:'src/a.ts',document_id:id(3),document_version:1,document_hash:'a'.repeat(64),observer_implementation_ref:ref(4),decision,verified_at:at(version*1000),expires_at:at(version*1000+10000),previous_ref:previous===null?null:fullref(previous),snapshot_json:snapshot,content_hash:contentHash(canonicalJson(snapshot))};}
function fullref(r:any){return {id:r.id,version:Number(r.version),contentHash:r.content_hash};}
function fn(){assert.equal(typeof m.inspectSourceContentVerificationLineageCandidate,'function','검증 인접계보 SOURCE inspector 미구현');return m.inspectSourceContentVerificationLineageCandidate;}
function bad(p:unknown,n:unknown){assert.throws(()=>fn()(p,n),/^Error: SOURCE_CONTENT_VERIFICATION_LINEAGE_INVALID$/);}
test('최초 양성 구조도 실제 verifier/current 권위가 아닌 최소 계보 후보만 반환한다',()=>{
 const n=row(),out=fn()(null,n);assert.equal(out.status,'UNVERIFIED');assert.equal(out.reason,'VERIFICATION_LINEAGE_SHAPE_ONLY');assert.deepEqual(out.verificationRef,fullref(n));assert.equal(out.previousRef,null);for(const k of ['verifierEvidenceVerified','currentAuthorityVerified','storageMutationPerformed','executionAuthorized','linkAuthorized'])assert.equal(out[k],false);assert.equal(Object.hasOwn(out,'snapshot'),false);assert.equal(Object.hasOwn(out,'relativePath'),false);
});
test('정확 predecessor hash와 불변identity의 회수/무효 append만 허용하고 복사refs를 반환한다',()=>{
 const p=row(),n=row(2,p),third=row(3,n,'INVALID');assert.deepEqual(fn()(p,n).previousRef,fullref(p));const out=fn()(n,third);assert.deepEqual(out.verificationRef,fullref(third));n.content_hash='f'.repeat(64);third.previous_ref.contentHash='f'.repeat(64);assert.notEqual(out.previousRef.contentHash,'f'.repeat(64));assert.equal(out.linkAuthorized,false);
});
test('다른project/관측·target/path·문서/구현 identity는 새 유효행이라도 계보에 섞지 않는다',()=>{
 const p=row();for(const patch of [{project_id:id(99)},{observation_id:id(99)},{observation_hash:'b'.repeat(64)},{target_index:1},{relative_path:'src/b.ts'},{document_id:id(99)},{document_version:2},{document_hash:'b'.repeat(64)},{observer_implementation_ref:ref(99)}])bad(p,{...row(2,p),...patch});
 const n=row(2,p);n.id=id(99);n.previous_ref.id=id(99);bad(p,n);
});
test('predecessor 부재/다른hash·건너뛰기/역시각·재양성과 최초의 이전행을 거절한다',()=>{
 const p=row(),n=row(2,p);bad(null,n);bad(p,{...n,previous_ref:{...n.previous_ref,contentHash:'f'.repeat(64)}});const jump=row(3,p);jump.previous_ref.version=2;bad(p,jump);bad(p,{...n,verified_at:at(500),expires_at:at(10500)});bad(p,row(2,p,'ACCEPTED'));bad(n,row(3,n,'ACCEPTED'));bad(p,row());bad(null,row(1,null,'REVOKED'));
});
test('PG 정수문자열/Date는 정규화하되 snapshot의 권위 주장과 과거시각을 현재허가로 승격하지 않는다',()=>{
 const p=row(),n=row(2,p);for(const r of [p,n]){r.version=String(r.version);r.observation_version='1';r.target_index='0';r.document_version='1';r.verified_at=new Date(r.verified_at);r.expires_at=new Date(r.expires_at);}n.snapshot_json={verified:true,linkAuthorized:true};n.content_hash=contentHash(canonicalJson(n.snapshot_json));const out=fn()(p,n);assert.equal(out.verificationRef.version,2);assert.equal(out.currentAuthorityVerified,false);assert.equal(out.verifierEvidenceVerified,false);assert.equal(out.linkAuthorized,false);
});
test('getter·추가키/과대snapshot·해시/시각·ref형식 오류는 원자료를 실행하거나 노출하지 않는다',()=>{
 const p=row();let gets=0;const a=row();Object.defineProperty(a,'snapshot_json',{enumerable:true,get(){gets++;return {};}});const b=row();Object.defineProperty(b.snapshot_json,'verified',{enumerable:true,get(){gets++;return true;}});const oversized={...row(),snapshot_json:{body:'x'.repeat(1048577)}};oversized.content_hash=contentHash(canonicalJson(oversized.snapshot_json));for(const n of [a,b,{...row(),verified:true},oversized,{...row(),content_hash:'f'.repeat(64)},{...row(),expires_at:at(31001)},{...row(),verified_at:'invalid'},{...row(),target_index:200},{...row(),relative_path:'../bad'},{...row(),document_version:0},{...row(),observation_version:2}])bad(null,n);assert.equal(gets,0);bad(p,{...row(2,p),previous_ref:{...ref(5),version:2}});
});
