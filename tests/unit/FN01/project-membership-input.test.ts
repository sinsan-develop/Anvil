import test from 'node:test';
import assert from 'node:assert/strict';
const path='../../../contracts/runtime/project-membership-v1.ts';
const uuid=(n:number)=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0');
async function codec(){const m=await import(path).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});assert.ok(m,'채택 membership codec 생산선 부재');return m;}
test('참여권한 payload는 대상/역할/원사유 exact 원문을 보존하고 getter/추가키/회수연산은 받지 않는다',async()=>{
 const m=await codec(),p={targetUserRef:{kind:'HUMAN',userId:uuid(1)},participation:'HANDOFF_ELIGIBLE',reason:'원 사유'};
 assert.deepEqual(m.readMembershipPayload(p),p);let gets=0;const getter={...p};Object.defineProperty(getter,'reason',{enumerable:true,get(){gets++;return '위장';}});assert.throws(()=>m.readMembershipPayload(getter));assert.equal(gets,0);
 for(const bad of [{...p,participation:'REVOKED'},{...p,approvalRef:null},{...p,reason:' '},{...p,targetUserRef:{kind:'HUMAN',userId:'bad'}}])assert.throws(()=>m.readMembershipPayload(bad));
});
test('승인 후보는 원11키/NEW-null과 EXISTING fullref를 묶고 대상·role·버전 혼용을 거절한다',async()=>{
 const m=await codec(),command={schemaVersion:1,projectId:uuid(2),commandId:uuid(3),clientId:uuid(4),controlGeneration:2,operation:'saveProjectMembership',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{targetUserRef:{kind:'HUMAN',userId:uuid(1)},participation:'VIEWER',reason:'추가'}};
 const candidate={schemaVersion:1,purpose:'PROJECT_MEMBERSHIP_APPROVAL_CANDIDATE',command,baseMembership:{kind:'NEW'}};assert.deepEqual(m.readMembershipCandidate(candidate),candidate);
 const ref={id:uuid(1),version:3,contentHash:'a'.repeat(64)},existing={...candidate,command:{...command,targetId:ref.id,expectedVersion:ref.version},baseMembership:{kind:'EXISTING',ref,participation:'OWNER'}};assert.deepEqual(m.readMembershipCandidate(existing),existing);
 for(const bad of [{...candidate,command:{...command,targetId:uuid(1)}},{...existing,baseMembership:{...existing.baseMembership,ref:{...ref,id:uuid(8)}}},{...candidate,command:{...command,approvalRef:{requestId:uuid(4)}}}])assert.throws(()=>m.readMembershipCandidate(bad));
});

test('원사유 UTF16 20000 상한과 유효Unicode를 보존하며 공백만/불완전Unicode는 거절한다',async()=>{const m=await codec(),p={targetUserRef:{kind:'HUMAN',userId:uuid(1)},participation:'VIEWER',reason:'😀'.repeat(10000)};assert.equal(m.readMembershipPayload(p).reason.length,20000);for(const reason of ['😀'.repeat(10001),'x'.repeat(20001),'\u00a0\ufeff','\ud800'])assert.throws(()=>m.readMembershipPayload({...p,reason}));});
