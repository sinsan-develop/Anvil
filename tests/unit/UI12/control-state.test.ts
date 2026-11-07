import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ControlScope,emptyControlBuffer,freezeControlCommand,mergeControlBuffer,selfRequestCommand} from '../../../apps/web/src/features/control-handoff/state.ts';
const projectId='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',clientId='33333333-3333-4333-8333-333333333333',other='44444444-4444-4444-8444-444444444444';
const session={user:{id:user,displayName:'이름'},clientId,csrfToken:'c'.repeat(43)},state={schemaVersion:1 as const,projectId,actorId:user,clientId,observedAt:'2026-10-26T00:00:00.000Z',participation:'OWNER' as const,control:{state:'OTHER_CLIENT' as const,basis:{actorId:user,clientId:other,generation:2,version:7}},executionAuthorized:false as const,controlTransferred:false as const};
test('세션 객체 revision/프로젝트/ticket/명령 binding은 ABA와 지연 응답을 차단한다',()=>{
 const scope=new ControlScope();scope.bind(session,projectId);const first=scope.ticket('a');assert.equal(scope.current(first,'a'),true);const second=scope.ticket('b');assert.equal(scope.current(first,'a'),false);assert.equal(scope.current(second,'a'),false);assert.equal(scope.current(second,'b'),true);
 scope.bind(null,projectId);scope.bind({...session},projectId);assert.equal(scope.current(second,'b'),false);const current=scope.ticket('b');scope.bind(session,other);assert.equal(scope.current(current,'b'),false);scope.dispose();assert.equal(scope.current(scope.ticket('b'),'b'),false);
});
test('SELF는 정확 basis와 서버 관측 만료만 사용하고 동일 제어 기기·30분 초과를 거절한다',()=>{
 const command=selfRequestCommand(session,projectId,state,'이 기기로 이어가기','2026-10-26T00:20:00.000Z',other);assert.equal(command.payload.baseControl.version,7);assert.equal(command.payload.targetActorRef.userId,user);assert.equal(command.payload.targetClientRef.clientId,clientId);
 for(const expiresAt of ['2026-10-26T00:00:00.000Z','2026-10-26T00:30:00.001Z','invalid'])assert.throws(()=>selfRequestCommand(session,projectId,state,'이유',expiresAt,other));
 assert.throws(()=>selfRequestCommand(session,projectId,{...state,control:{state:'HELD',basis:{...state.control.basis,clientId}}},'이유','2026-10-26T00:20:00.000Z',other));
});
test('App CAS 버퍼는 불명 명령과 원문을 보존하고 이전 binding의 완료가 새 초안을 덮지 않는다',()=>{
 const original=emptyControlBuffer(session,projectId);const command=selfRequestCommand(session,projectId,state,'보존 원문','2026-10-26T00:20:00.000Z',other);const frozen=freezeControlCommand(original,command);assert.equal(frozen.pending?.command.commandId,other);assert.equal(frozen.reason,'');assert.equal(frozen.pending?.status,'READY');assert(Object.isFrozen(frozen.pending?.command.payload));
 const unknown={...frozen,pending:frozen.pending?{...frozen.pending,status:'UNKNOWN' as const}:null};assert.equal(mergeControlBuffer(unknown,original.bindingId,original),unknown);const merged=mergeControlBuffer(unknown,unknown.bindingId,{...unknown,reason:'다른 내용'});assert(merged);assert.equal(merged.reason,'다른 내용');assert.equal(unknown.pending?.command.operation,'requestControl');if(unknown.pending?.command.operation==='requestControl')assert.equal(unknown.pending.command.payload.reason,'보존 원문');
 assert.throws(()=>freezeControlCommand(unknown,command));
});

test('같은 세션 객체의 user/client 변형도 ticket 주체 대조에서 거절한다',()=>{
 const mutable={...session,user:{...session.user}},scope=new ControlScope();scope.bind(mutable,projectId);const before=scope.ticket('cmd');mutable.user.id=other;assert.equal(scope.current(before,'cmd'),false);scope.bind(mutable,projectId);assert.equal(scope.current(before,'cmd'),false);
});
