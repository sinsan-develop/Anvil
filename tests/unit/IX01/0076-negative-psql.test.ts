import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {current0076NegativeContract,type NegativeOwnedTarget} from '../../../scripts/qa-ix01-0076-atomicity-negative.ts';
import {current0076NegativeReceiverContract,type NegativeReceiverPorts} from '../../../scripts/qa-ix01-0076-atomicity-negative-receiver.ts';
import {
 bind0076NegativePsqlTarget,create0076NegativePsqlReceiver,
 type NegativePsqlInvocation,type NegativePsqlOwnerPorts,type NegativePsqlProcessPorts,type NegativePsqlProcessResult,
} from '../../../scripts/qa-ix01-0076-negative-psql.ts';

const root=new URL('../../../',import.meta.url);
const original=readFileSync(new URL('db/migrations/0076_native_first_receive.sql.pending',root)),commit=Buffer.from('COMMIT;\n','ascii'),commitOffset=384546;
assert.deepEqual(original.subarray(commitOffset,commitOffset+commit.length),commit);
const sql=new Uint8Array(Buffer.concat([original.subarray(0,commitOffset),original.subarray(commitOffset+commit.length),commit]));
assert.equal(contentHash(sql),current0076NegativeContract.executionSha256);
let targetSequence=40;
function makeTarget(){
 const attemptId='d7000000-0000-4000-8000-'+String(++targetSequence).padStart(12,'0'),compact=attemptId.replaceAll('-','');
 const namespace=Object.freeze({container:'anvil-ix01-0076-negative-'+compact,database:'ix01_0076_negative_'+compact,receipt:'/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+attemptId,network:'none' as const});
 return Object.freeze({schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_OWNED_TARGET' as const,attemptId,sourceHead:'8'.repeat(40),planHash:'9'.repeat(64),graphHash:'a'.repeat(64),namespace,containerId:'b'.repeat(64)}) satisfies Readonly<NegativeOwnedTarget>;
}

function request(target:Readonly<NegativeOwnedTarget>,overrides:Record<string,unknown>={}){
 const raw={schemaVersion:1,purpose:current0076NegativeReceiverContract.requestPurpose,attemptId:target.attemptId,targetHash:contentHash(canonicalJson(target)),graphHash:target.graphHash,
  receiverPath:current0076NegativeReceiverContract.receiverPath,receiverSourceHash:'c'.repeat(64),sourceSqlHash:current0076NegativeContract.sourceSha256,
  executionSqlHash:current0076NegativeContract.executionSha256,expectedSqlState:'42723',statementEndLine:2343,timeoutMs:30000,sql:new Uint8Array(sql),...overrides};
 return Object.freeze(raw) as Parameters<NegativeReceiverPorts['execute']>[0];
}

function fixture(mode:'DDL'|'EXIT0'|'SIGNAL'|'OPEN'|'STDOUT'|'OVERSIZE'|'INVALID_UTF8'|'THROW'|'MUTATE'|'CURRENT_LOST'|'CLOCK_REVERSED'|'LATE'='DDL'){
 const target=makeTarget();let runs=0,current=0,scheduled=0,last:NegativePsqlInvocation|undefined,lastScheduled=0,wall=1000,mono=100;
 const ownerRecipient=Object.freeze(Object.create(null));
 const deadline=Object.freeze({wallExpiresAt:31000,monotonicExpiresAt:30100});
 const owner=Object.freeze({recipient:ownerRecipient,deadline,now(this:object){assert.equal(this,ownerRecipient);return wall;},monotonic(this:object){assert.equal(this,ownerRecipient);return mono;},assertCurrent(this:object,found:Readonly<NegativeOwnedTarget>){
  current++;assert.equal(this,ownerRecipient);assert.equal(found,target);if(mode==='CURRENT_LOST'&&runs>0)throw Error('lost');
 }}) satisfies NegativePsqlOwnerPorts;
 const capability=bind0076NegativePsqlTarget(target,owner),processRecipient=Object.freeze(Object.create(null));
 const process=Object.freeze({
  recipient:processRecipient,
  schedule(this:object,callback:()=>void,timeoutMs:number){scheduled++;lastScheduled=timeoutMs;assert.equal(this,processRecipient);assert(timeoutMs>0&&timeoutMs<=30000);const id=setTimeout(callback,timeoutMs);return()=>clearTimeout(id);},
  async run(this:object,invocation:Readonly<NegativePsqlInvocation>,signal:AbortSignal):Promise<Readonly<NegativePsqlProcessResult>>{
   runs++;assert.equal(this,processRecipient);assert.equal(signal.aborted,false);last=invocation;if(mode==='THROW')throw Error('unknown');if(mode==='MUTATE')invocation.stdin[0]=(invocation.stdin[0]??0)^1;if(mode==='CLOCK_REVERSED'){wall--;mono--;}if(mode==='LATE'){wall+=30000;mono+=30000;}
   const stderr=mode==='OVERSIZE'?new Uint8Array(16385):mode==='INVALID_UTF8'?new Uint8Array([0xff]):new Uint8Array(Buffer.from('psql:<stdin>:2343: ERROR:  42723: PRIVATE SQL discarded','utf8'));
   return Object.freeze({status:mode==='EXIT0'?0:3,signal:mode==='SIGNAL'?'SIGKILL':null,code:null,closed:mode!=='OPEN',stdout:mode==='STDOUT'?new Uint8Array([1]):new Uint8Array(),stderr});
  },
 }) satisfies NegativePsqlProcessPorts;
 return{receiver:create0076NegativePsqlReceiver(capability,process),capability,process,owner,target,advance(wallMs:number,monoMs=wallMs){wall+=wallMs;mono+=monoMs;},get runs(){return runs;},get current(){return current;},get scheduled(){return scheduled;},get lastScheduled(){return lastScheduled;},get last(){return last;}};
}

test('원 target capability와 교정 bytes만 고정 docker psql stdin 명령으로 남은 기한 안에 한 번 전달한다',async()=>{
 const h=fixture();h.advance(100);const signal=new AbortController().signal,result=await h.receiver.execute(request(h.target),signal);
 assert.equal(result.kind,'DDL_FAILURE');assert.equal(h.runs,1);assert(h.current>=5);assert.equal(h.scheduled,0);
 const invocation=h.last!;assert.equal(invocation.executable,'/usr/bin/docker');
 assert.deepEqual(invocation.argv,['--config',h.target.namespace.receipt+'/docker-config','--host','unix:///var/run/docker.sock','exec','-i','--user','999:999',h.target.containerId,'psql','--no-psqlrc','--no-password','--quiet','--no-align','--tuples-only','--host=/var/run/postgresql','--username=anvil_v3_migrator','--dbname='+h.target.namespace.database,'--set=ON_ERROR_STOP=on','--set=VERBOSITY=verbose','--set=SHOW_CONTEXT=never','--set=ECHO=none','--file=-']);
 assert.deepEqual(invocation.env,{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',HOME:h.target.namespace.receipt});assert.equal(invocation.cwd,'/');assert.equal(invocation.timeoutMs,29900);assert.equal(invocation.outputLimitBytes,16384);
 assert.equal(invocation.stdin.byteLength,current0076NegativeContract.sourceBytes);assert.equal(await h.receiver.execute(request(h.target),signal).then(value=>value.kind),'UNKNOWN');assert.equal(h.runs,1);
});

test('cross target·원본 hash·변조 bytes·취소는 process 호출 전에 UNKNOWN이다',async()=>{
 for(const overrides of [{attemptId:'d7000000-0000-4000-8000-000000000099'},{targetHash:'d'.repeat(64)},{executionSqlHash:current0076NegativeContract.sourceSha256},{sql:new Uint8Array([1])},{timeoutMs:30001}]){
  const h=fixture();assert.equal((await h.receiver.execute(request(h.target,overrides),new AbortController().signal)).kind,'UNKNOWN');assert.equal(h.runs,0);
 }
 const h=fixture(),controller=new AbortController();controller.abort();assert.equal((await h.receiver.execute(request(h.target),controller.signal)).kind,'UNKNOWN');assert.equal(h.runs,0);
 const expired=fixture();expired.advance(30000);assert.equal((await expired.receiver.execute(request(expired.target),new AbortController().signal)).kind,'UNKNOWN');assert.equal(expired.runs,0);
});

test('exit·signal·close·출력·UTF8·current 불명은 raw 진단 성공이나 retry로 바뀌지 않는다',async()=>{
 for(const mode of ['EXIT0','SIGNAL','OPEN','STDOUT','OVERSIZE','INVALID_UTF8','THROW','MUTATE','CURRENT_LOST','CLOCK_REVERSED','LATE'] as const){
  const h=fixture(mode),result=await h.receiver.execute(request(h.target),new AbortController().signal);assert.equal(result.kind,'UNKNOWN',mode);assert.equal(h.runs,1,mode);
  assert.equal((await h.receiver.execute(request(h.target),new AbortController().signal)).kind,'UNKNOWN',mode);assert.equal(h.runs,1,mode);
 }
});

test('동일 target capability 재발급은 없고 scheduler도 원 절대기한의 남은 값만 사용한다',()=>{
 const h=fixture(),callback=()=>{};assert.throws(()=>create0076NegativePsqlReceiver(h.capability,h.process));assert.throws(()=>bind0076NegativePsqlTarget(h.target,h.owner));
 const clone=Object.freeze({...h.target,namespace:Object.freeze({...h.target.namespace})});assert.throws(()=>bind0076NegativePsqlTarget(clone,h.owner));
 const rebound=Object.freeze({...h.target,containerId:'c'.repeat(64)});assert.throws(()=>bind0076NegativePsqlTarget(rebound,h.owner));
 h.advance(29999);const cancel=h.receiver.schedule(callback,30000);assert.equal(typeof cancel,'function');assert.equal(h.scheduled,1);assert.equal(h.lastScheduled,1);cancel();
});
