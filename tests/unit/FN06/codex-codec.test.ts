import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import * as subject from '../../../apps/connector/adapters/primary/codec.ts';

const initResult={codexHome:'C:\\synthetic-only',platformFamily:'windows',platformOs:'windows',userAgent:'synthetic'};
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const frame=(value:unknown)=>Buffer.from(JSON.stringify(value)+'\n');
function codec(options:any={maxFrameBytes:4096,maxPending:8}):any{
 assert.equal(typeof (subject as any).Codex0161Codec,'function');
 return new (subject as any).Codex0161Codec(options);
}
function ready(options?:any):any{
 const c=codec(options);assert.equal(c.encodeRequest('initialize','init',{clientInfo:{name:'anvil',version:'0.1'}}).kind,'ENCODED');
 assert.equal(c.push(frame({id:'init',result:initResult}))[0].kind,'RPC_RESPONSE');
 assert.equal(c.encodeInitialized().kind,'ENCODED');return c;
}
function sent(c:any,method:string,id:string|number,params:unknown){const out=c.encodeRequest(method,id,params);assert.equal(out.kind,'ENCODED');return out;}
function refused(c:any,code:string){const next=c.encodeRequest('turn/interrupt','later',{threadId:'thread-a',turnId:'turn-a'});assert.equal(next.kind,'REJECTED');assert.equal(next.code,code);}

// 실제 고정 schema에 없는 필드를 만들거나 초기화 순서를 건너뛰면 실패한다.
test('initialize 필수 필드·후속 initialized 준비를 확인하되 메모리 wire를 전송/허가로 보고하지 않는다',()=>{
 const c=codec();assert.equal(c.encodeRequest('thread/start',1,{}).code,'INITIALIZATION_WIRE_NOT_READY');
 assert.equal(c.encodeInitialized().code,'INITIALIZE_RESPONSE_REQUIRED');
 assert.equal(c.encodeRequest('initialize',1,{clientInfo:{name:'anvil'}}).code,'SCHEMA_INVALID');
 const out=sent(c,'initialize',1,{clientInfo:{name:'anvil',version:'0.1'}});
 assert.deepEqual(JSON.parse(Buffer.from(out.wire).toString()),{id:1,method:'initialize',params:{clientInfo:{name:'anvil',version:'0.1'}}});
 assert.equal(out.wire.at(-1),10);assert.equal(out.executionAuthorized,false);assert.equal(out.dispatched,false);
 assert.equal(c.push(frame({id:1,result:initResult}))[0].kind,'RPC_RESPONSE');
 assert.deepEqual(JSON.parse(Buffer.from(c.encodeInitialized().wire).toString()),{method:'initialized'});
 assert.equal(c.encodeRequest('initialize',2,{clientInfo:{name:'anvil',version:'0.1'}}).code,'INITIALIZE_ALREADY_PREPARED');
});

// 필수 turnId/expectedTurnId/input을 빼고도 encode하거나 알려지지 않은 method를 통과시키면 실패한다.
test('실제 6개 요청 분기와 turn/session 필수 필드를 고정 schema 그대로 검증한다',()=>{
 const c=ready();
 for(const [method,id,params] of [['thread/start',1,{}],['thread/resume',2,{threadId:'thread-a'}],['turn/start',3,{threadId:'thread-a',input:[{type:'text',text:'합성 지시'}]}],['turn/steer',4,{threadId:'thread-a',expectedTurnId:'turn-a',input:[]}],['turn/interrupt',5,{threadId:'thread-a',turnId:'turn-a'}]] as const){
  const value=JSON.parse(Buffer.from(sent(c,method,id,params).wire).toString());assert.equal(value.method,method);assert.deepEqual(value.params,params);
 }
 for(const [method,params] of [['thread/resume',{}],['turn/start',{threadId:'thread-a'}],['turn/steer',{threadId:'thread-a',input:[]}],['turn/interrupt',{threadId:'thread-a'}]])assert.equal(c.encodeRequest(method,'bad',params).code,'SCHEMA_INVALID');
 assert.equal(c.encodeRequest('invented/stop','bad',{}).code,'UNSUPPORTED_METHOD');
 assert.equal(c.encodeRequest('turn/interrupt',Number.MAX_SAFE_INTEGER+1,{threadId:'thread-a',turnId:'turn-a'}).code,'INPUT_INVALID');
});

// 같은 id의 덮어쓰기/무한 pending을 허용하면 실패한다.
test('유한 옵션·pending 예산과 중복 송신 id를 검사하고 대기 응답을 덮지 않는다',()=>{
 for(const opts of [{},{maxFrameBytes:0,maxPending:1},{maxFrameBytes:1.5,maxPending:1},{maxFrameBytes:2**31,maxPending:1},{maxFrameBytes:100,maxPending:Infinity},{maxFrameBytes:100,maxPending:0},{maxFrameBytes:100,maxPending:1000000}])assert.throws(()=>codec(opts),/CODEC_OPTIONS_INVALID/);
 const c=ready({maxFrameBytes:4096,maxPending:1});
 sent(c,'turn/interrupt',1,{threadId:'thread-a',turnId:'turn-a'});
 assert.equal(c.encodeRequest('turn/interrupt',1,{threadId:'other',turnId:'other'}).code,'DUPLICATE_REQUEST_ID');
 assert.equal(c.encodeRequest('turn/interrupt',2,{threadId:'thread-a',turnId:'turn-a'}).code,'PENDING_LIMIT');
 assert.equal(c.push(frame({id:1,result:{}}))[0].kind,'INTERRUPT_RESPONSE');
 assert.equal(c.encodeRequest('turn/interrupt',2,{threadId:'thread-a',turnId:'turn-a'}).kind,'ENCODED');
});

// 응답 id를 문자열/숫자 간 치환하거나 중복 reply 뒤 새 요청을 허용하면 실패한다.
test('응답 id 타입 불일치·미대응·중복 reply는 sticky UNKNOWN이고 후속 새 요청을 차단한다',()=>{
 for(const response of [{id:'1',result:{}},{id:99,result:{}}]){
  const c=ready();sent(c,'turn/interrupt',1,{threadId:'thread-a',turnId:'turn-a'});
  assert.equal(c.push(frame(response))[0].code,'UNMATCHED_RESPONSE');refused(c,'CODEC_UNUSABLE');
  assert.equal(c.push(frame({id:1,result:{}}))[0].code,'CODEC_UNUSABLE');
 }
 const c=ready();sent(c,'turn/interrupt',1,{threadId:'thread-a',turnId:'turn-a'});c.push(frame({id:1,result:{}}));
 assert.equal(c.push(frame({id:1,result:{}}))[0].code,'UNMATCHED_RESPONSE');refused(c,'CODEC_UNUSABLE');
});

// generic result:true만 검사해 잘못된 InitializeResponse를 통과시키면 실패한다.
test('method별 응답 schema를 검사하고 remote error 본문·data·id를 보고에 반사하지 않는다',()=>{
 const init=codec();sent(init,'initialize',1,{clientInfo:{name:'anvil',version:'0.1'}});
 assert.equal(init.push(frame({id:1,result:{userAgent:'missing-required-fields'}}))[0].code,'SCHEMA_INVALID');refused(init,'CODEC_UNUSABLE');
 const c=ready();sent(c,'turn/interrupt',7,{threadId:'thread-a',turnId:'turn-a'});
 const fact=c.push(frame({id:7,error:{code:-32603,message:'PRIVATE_MESSAGE',data:{path:'D:\\private\\only',token:'PRIVATE_TOKEN'}}}))[0];
 assert.equal(fact.kind,'RPC_ERROR');assert.equal(fact.code,'REMOTE_RPC_ERROR');assert.equal(fact.requestIdDigest,digest(7));
 const text=JSON.stringify(fact);for(const marker of ['PRIVATE_MESSAGE','PRIVATE_TOKEN','D:\\private\\only'])assert.equal(text.includes(marker),false);
});

// 절단된 UTF8을 교체문자로 통과시키거나 정상 두 프레임을 하나로 읽으면 실패한다.
test('UTF8 다중 바이트 분할·LF/CRLF·한 chunk의 복수 정상 프레임을 보존한다',()=>{
 const c=ready();sent(c,'turn/steer',1,{threadId:'thread-a',expectedTurnId:'turn-a',input:[]});
 const raw=Buffer.from(JSON.stringify({id:1,result:{turnId:'turn-a',description:'한글'}})+'\r\n');const split=raw.indexOf(Buffer.from('한'))+1;
 assert.deepEqual(c.push(raw.subarray(0,split)),[]);assert.equal(c.push(raw.subarray(split))[0].kind,'RPC_RESPONSE');
 sent(c,'turn/interrupt',2,{threadId:'thread-a',turnId:'turn-a'});sent(c,'turn/interrupt',3,{threadId:'thread-a',turnId:'turn-a'});
 assert.deepEqual(c.push(Buffer.concat([frame({id:2,result:{}}),frame({id:3,result:{}})])).map((x:any)=>x.kind),['INTERRUPT_RESPONSE','INTERRUPT_RESPONSE']);
});

// 빈/중복key·escape중복·형식 혼합·잘못 UTF8 뒤 복구된 척하면 실패한다.
test('빈 프레임·malformed·중복/escape key·응답/요청 혼합·잘못 UTF8은 원문 없는 UNKNOWN이다',()=>{
 for(const bytes of [Buffer.from('\n'),Buffer.from('{bad PRIVATE_TOKEN}\n'),Buffer.from('{"id":1,"id":1,"result":{}}\n'),Buffer.from('{"id":1,"\\u0069d":1,"result":{}}\n'),frame({id:1,result:{},error:{code:1,message:'PRIVATE_TOKEN'}}),frame({id:1,method:'turn/completed',result:{}}),Buffer.from([0xc3,0x28,10])]){
  const c=ready();sent(c,'turn/interrupt',1,{threadId:'thread-a',turnId:'turn-a'});const facts=c.push(bytes);
  assert.equal(facts.at(-1).kind,'PROTOCOL_UNKNOWN');assert.equal(JSON.stringify(facts).includes('PRIVATE_TOKEN'),false);refused(c,'CODEC_UNUSABLE');
 }
});

// payload 상한 변경·CRLF 오계수·미종결 과대 입력을 계속 보관하면 실패한다.
test('프레임 상한은 CRLF를 뺀 payload 바이트에 적용하고 미종결·단일 chunk 과대를 거절한다',()=>{
 const c=ready();const bytes=frame({id:1,result:{}});sent(c,'turn/interrupt',1,{threadId:'thread-a',turnId:'turn-a'});
 const small=codec({maxFrameBytes:bytes.length-1,maxPending:1});
 assert.equal(small.push(Buffer.concat([bytes.subarray(0,-1),Buffer.from('\r\n')]))[0].code,'UNMATCHED_RESPONSE');
 const over=codec({maxFrameBytes:32,maxPending:1});assert.equal(over.push(Buffer.from('x'.repeat(33)))[0].code,'FRAME_TOO_LARGE');refused(over,'CODEC_UNUSABLE');
 const chunk=codec({maxFrameBytes:32,maxPending:1});assert.equal(chunk.push(Buffer.alloc(35))[0].code,'CHUNK_TOO_LARGE');refused(chunk,'CODEC_UNUSABLE');
 assert.equal(c.push(bytes)[0].kind,'INTERRUPT_RESPONSE');
});

// 부분/미응답 EOF를 정상 종료로 처리하거나 종료 뒤 새 wire를 만들면 실패한다.
test('정상 빈 EOF는 CLOSED, 부분/응답대기 EOF·오류 단절은 UNKNOWN이고 모두 후속 요청 불가다',()=>{
 const closed=ready();assert.equal(closed.finish()[0].kind,'STREAM_CLOSED');refused(closed,'CODEC_UNUSABLE');
 const partial=ready();partial.push(Buffer.from('{"id":'));assert.equal(partial.finish()[0].code,'PARTIAL_FRAME_EOF');refused(partial,'CODEC_UNUSABLE');
 const pending=ready();sent(pending,'turn/interrupt',1,{threadId:'thread-a',turnId:'turn-a'});assert.equal(pending.finish()[0].code,'PENDING_RESPONSE_EOF');
 const disconnected=ready();assert.equal(disconnected.finish('TRANSPORT_ERROR')[0].code,'TRANSPORT_ERROR');refused(disconnected,'CODEC_UNUSABLE');
});

// 다른 turn의 응답을 같은 지시의 결과에 섞으면 실패한다.
test('steer 응답과 관측의 정확 thread/turn 결박을 검사하며 식별 원문은 digest로만 보고한다',()=>{
 const c=ready();sent(c,'turn/steer',1,{threadId:'thread-a',expectedTurnId:'turn-a',input:[]});
 assert.equal(c.push(frame({id:1,result:{turnId:'other-turn'}}))[0].code,'CONTEXT_MISMATCH');refused(c,'CODEC_UNUSABLE');
 const c2=ready();sent(c2,'turn/interrupt',1,{threadId:'thread-a',turnId:'turn-a'});
 const fact=c2.push(frame({method:'turn/completed',params:{threadId:'different-thread',turn:{id:'turn-a',items:[],status:'completed'}}}))[0];
 assert.equal(fact.kind,'CONTEXT_UNVERIFIED');assert.equal(JSON.stringify(fact).includes('different-thread'),false);
});

// 도구 완료/interrupt 응답을 업무합격·소유회수로 승격하면 실패한다.
test('completed와 interrupt 응답은 도구 사실뿐이며 업무합격·RECLAIMED를 발급하지 않는다',()=>{
 const c=ready();sent(c,'turn/interrupt',1,{threadId:'thread-a',turnId:'turn-a'});
 const completed=c.push(frame({method:'turn/completed',params:{threadId:'thread-a',turn:{id:'turn-a',items:[],status:'completed'}}}))[0];
 assert.equal(completed.kind,'TURN_FACT');assert.equal(completed.toolStatus,'completed');assert.equal(completed.workAccepted,false);assert.equal(completed.ownership,'UNVERIFIED');
 const stopped=c.push(frame({id:1,result:{}}))[0];assert.equal(stopped.kind,'INTERRUPT_RESPONSE');assert.equal(stopped.ownership,'UNVERIFIED');assert.equal(stopped.workAccepted,false);
 assert.equal(JSON.stringify([completed,stopped]).includes('RECLAIMED'),false);assert.equal(JSON.stringify(completed).includes('thread-a'),false);
});

// 승인 startedAtMs·결박을 생략하거나 trusted=true를 실제 허가로 바꾸면 실패한다.
test('tool approval의 실제 필수 필드·요청/세션/항목 digest를 검사하되 서버 결정 없이는 응답wire0이다',()=>{
 const c=ready();sent(c,'turn/interrupt',1,{threadId:'thread-a',turnId:'turn-a'});
 const req={id:'approval-1',method:'item/commandExecution/requestApproval',params:{threadId:'thread-a',turnId:'turn-a',itemId:'item-a',startedAtMs:123,command:'PRIVATE_COMMAND',reason:'PRIVATE_TOKEN'}};
 const fact=c.push(frame(req))[0];assert.equal(fact.kind,'TOOL_APPROVAL_REQUIRED');assert.equal(fact.automaticDecision,false);assert.equal(fact.requestDigest,digest({id:'approval-1',method:'item/commandExecution/requestApproval',params:{command:'PRIVATE_COMMAND',itemId:'item-a',reason:'PRIVATE_TOKEN',startedAtMs:123,threadId:'thread-a',turnId:'turn-a'}}));
 for(const marker of ['PRIVATE_COMMAND','PRIVATE_TOKEN','approval-1','thread-a','turn-a','item-a'])assert.equal(JSON.stringify(fact).includes(marker),false);
 const blocked=c.encodeToolDecision(fact.requestDigest,{trusted:true,decision:'accept'});assert.equal(blocked.code,'SERVER_DECISION_VERIFIER_NOT_CONNECTED');assert.equal(blocked.state,'UNVERIFIED');assert.equal('wire' in blocked,false);
 const bad=ready();sent(bad,'turn/interrupt',1,{threadId:'thread-a',turnId:'turn-a'});const noTime=structuredClone(req) as any;delete noTime.params.startedAtMs;
 assert.equal(bad.push(frame(noTime))[0].code,'SCHEMA_INVALID');refused(bad,'CODEC_UNUSABLE');
});

// 새 이벤트·미지원 서버 요청을 성공 관측·자동 승인으로 치환하면 실패한다.
test('알 수 없는 event·미지원 server request는 유한 코드만 반환하고 새 요청을 차단한다',()=>{
 for(const message of [{method:'unknown/PRIVATE_TOKEN',params:{token:'PRIVATE_TOKEN'}},{id:7,method:'unknown/PRIVATE_TOKEN',params:{path:'D:\\private'}}]){
  const c=ready(),fact=c.push(frame(message))[0];assert.equal(fact.code,'UNSUPPORTED_METHOD');assert.equal(fact.kind,'PROTOCOL_UNKNOWN');assert.equal(JSON.stringify(fact).includes('PRIVATE_TOKEN'),false);refused(c,'CODEC_UNUSABLE');
 }
});

// 오류/출력 원문을 관측에 흘리거나 잘못된 형식을 통과시키면 실패한다.
test('출력 delta·오류 알림은 원문 없는 digest 사실이고 잘못된 params는 거절한다',()=>{
 const c=ready();sent(c,'turn/interrupt',1,{threadId:'thread-a',turnId:'turn-a'});
 const fact=c.push(frame({method:'item/commandExecution/outputDelta',params:{threadId:'thread-a',turnId:'turn-a',itemId:'item-a',delta:'PRIVATE_TOKEN\nD:\\private'}}))[0];
 assert.equal(fact.kind,'OUTPUT_FACT');assert.equal(typeof fact.payloadDigest,'string');assert.equal(JSON.stringify(fact).includes('PRIVATE_TOKEN'),false);
 const bad=ready();assert.equal(bad.push(frame({method:'turn/completed',params:{threadId:'thread-a',turn:{id:'turn-a',items:[],status:'imaginary'}}}))[0].code,'SCHEMA_INVALID');
});

// 잘못된 Unicode id가 예외로 빠져나가거나 getter를 실행하면 실패한다.
test('잘못된 Unicode id·위험 객체를 고정 입력 거절로 돌려주고 caller getter를 실행하지 않는다',()=>{
 const c=codec();assert.doesNotThrow(()=>assert.equal(c.encodeRequest('initialize','\ud800',{clientInfo:{name:'anvil',version:'0.1'}}).code,'INPUT_INVALID'));
 let invoked=false;const params:any={};Object.defineProperty(params,'clientInfo',{enumerable:true,get(){invoked=true;throw Error('PRIVATE_TOKEN');}});
 const denied=c.encodeRequest('initialize',1,params);assert.equal(denied.code,'INPUT_INVALID');assert.equal(invoked,false);assert.equal(JSON.stringify(denied).includes('PRIVATE_TOKEN'),false);
});
