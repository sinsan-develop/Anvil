import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const m=await import(new URL('../../../apps/server/modules/documents/source-content-policy-definition.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const id=(n:number)=>`87000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
const at='2026-10-23T15:00:00.000Z';
function payload():any{return {previousPolicyRef:null,definition:{protocolVersion:1,namespace:'SOURCE_DOCUMENT_CONTENT_HASH_V1',subjectUserId:id(2),disposition:'AUTO',expiresAt:'2027-10-23T15:00:00.000Z',allowedOperations:['linkDocumentSource','requestSourceContentHash','revokeSourceContentHash'],sourceRootRef:ref(3),connectorRef:ref(4),registrationRef:ref(5),observerRef:ref(6),targets:[{relativePath:'src/a.ts',documentRef:ref(7),documentBlobRef:{artifactId:id(8),bytes:0,contentHash:'b'.repeat(64),mediaType:'text/plain'}}],limits:{maxFiles:200,maxFileBytes:2097152,maxTotalBytes:20971520,maxObservationMs:30000,maxReportBytes:1048576}},reason:'합성 본인 정책 정의'};}
function run(p:unknown,c:unknown={projectId:id(1),actorId:id(2),sequence:1,recordedAt:at}){assert.equal(typeof m.buildSourceContentPolicySnapshotCandidate,'function','관리 정책 순수 입력 미구현');return m.buildSourceContentPolicySnapshotCandidate(p,c);}
test('정확 범위와 본인 주체를 서버 값 snapshot으로 결박하며 장기 정책에 요청 TTL을 복사하지 않는다',()=>{
 const p=payload(),out=run(p);assert.equal(out.status,'UNVERIFIED');assert.equal(out.reason,'POLICY_DEFINITION_SHAPE_ONLY');assert.equal(Object.keys(out.snapshot).length,16);assert.equal(out.snapshot.projectId,id(1));assert.equal(out.snapshot.subjectUserId,id(2));assert.equal(out.snapshot.sequence,1);assert.equal(out.snapshot.recordedAt,at);assert.equal(out.snapshot.expiresAt,'2027-10-23T15:00:00.000Z');assert.equal(out.contentHash,contentHash(canonicalJson(out.snapshot)));assert.deepEqual(out.snapshot.targets,p.definition.targets);p.definition.targets[0].relativePath='changed';assert.equal(out.snapshot.targets[0].relativePath,'src/a.ts');for(const k of ['managementEvidenceVerified','currentAuthorityVerified','storageMutationPerformed','executionAuthorized','linkAuthorized'])assert.equal(out[k],false);
});
test('AUTO 부분집합은 고정 순서로만 받고 거절·회수는 빈 operation만 받는다',()=>{
 for(const ops of [['linkDocumentSource'],['requestSourceContentHash','revokeSourceContentHash']]){const p=payload();p.definition.allowedOperations=ops;assert.deepEqual(run(p).snapshot.allowedOperations,ops);}
 for(const disposition of ['DENY','REVOKED']){const p=payload();p.definition.disposition=disposition;p.definition.allowedOperations=[];assert.equal(run(p).snapshot.disposition,disposition);p.definition.allowedOperations=['linkDocumentSource'];assert.throws(()=>run(p),/SOURCE_CONTENT_POLICY_DEFINITION_INVALID/);}
 for(const ops of [[],['revokeSourceContentHash','linkDocumentSource'],['linkDocumentSource','linkDocumentSource'],['defineSourceContentPolicy'],['unknown']]){const p=payload();p.definition.allowedOperations=ops;assert.throws(()=>run(p),/SOURCE_CONTENT_POLICY_DEFINITION_INVALID/);}
});
test('caller의 서버필드·다른 주체·역시각·안전정수 밖·잘못된 predecessor를 거절한다',()=>{
 for(const key of ['projectId','sequence','recordedAt','verified']){const p=payload();p.definition[key]=key==='sequence'?2:id(99);assert.throws(()=>run(p),/SOURCE_CONTENT_POLICY_DEFINITION_INVALID/);}
 for(const patch of [{actorId:id(99)},{sequence:0},{sequence:9007199254740992},{recordedAt:'bad'},{recordedAt:'2027-10-23T15:00:00.000Z'},{projectId:'bad'},{currentAuthorityVerified:true}])assert.throws(()=>run(payload(),{projectId:id(1),actorId:id(2),sequence:1,recordedAt:at,...patch}),/SOURCE_CONTENT_POLICY_DEFINITION_INVALID/);
 const p=payload();p.previousPolicyRef=ref(10);assert.throws(()=>run(p),/SOURCE_CONTENT_POLICY_DEFINITION_INVALID/);assert.deepEqual(run(p,{projectId:id(1),actorId:id(2),sequence:2,recordedAt:at}).previousPolicyRef,ref(10));p.previousPolicyRef.version=2;assert.throws(()=>run(p,{projectId:id(1),actorId:id(2),sequence:2,recordedAt:at}),/SOURCE_CONTENT_POLICY_DEFINITION_INVALID/);assert.throws(()=>run(payload(),{projectId:id(1),actorId:id(2),sequence:2,recordedAt:at}),/SOURCE_CONTENT_POLICY_DEFINITION_INVALID/);
});
test('유한 대상·바이트 한도·중복과 경로 탈출을 기존 범위 규칙으로 거절한다',()=>{
 const mutations=[(p:any)=>p.definition.targets.push({...p.definition.targets[0]}),(p:any)=>p.definition.targets[0].relativePath='../a.ts',(p:any)=>p.definition.targets[0].documentBlobRef.bytes=2097153,(p:any)=>p.definition.limits.maxFiles=201,(p:any)=>p.definition.limits.maxObservationMs=30001,(p:any)=>p.definition.sourceRootRef.contentHash='bad',(p:any)=>p.reason=' ',(p:any)=>p.reason='x'.repeat(20001)];for(const mutate of mutations){const p=payload();mutate(p);assert.throws(()=>run(p),/SOURCE_CONTENT_POLICY_DEFINITION_INVALID/);}
});
test('getter·추가키·과대 입력은 실행하거나 원자료를 반환하지 않고 거절한다',()=>{
 let gets=0;const p=payload();Object.defineProperty(p.definition,'targets',{enumerable:true,get(){gets++;return [];}});assert.throws(()=>run(p),/SOURCE_CONTENT_POLICY_DEFINITION_INVALID/);assert.equal(gets,0);assert.throws(()=>run({...payload(),secret:'원문표식'}),/SOURCE_CONTENT_POLICY_DEFINITION_INVALID/);const big=payload();big.reason='x'.repeat(1048577);assert.throws(()=>run(big),/SOURCE_CONTENT_POLICY_DEFINITION_INVALID/);
});
