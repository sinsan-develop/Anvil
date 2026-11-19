import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {canonicalJson} from '../contracts/canonical.ts';
import {assembleSubnetObservationStdin} from './qa-ix01-subnet-observation-stdin.ts';
import {readSubnetCompletionBinding} from './qa-ix01-subnet-observation-remote.ts';
import {collectSubnetRemoteCompletion,type SubnetCollectionClock} from './qa-ix01-subnet-observation-supervisor.ts';
const client=String.raw`C:\Windows\System32\OpenSSH\ssh.exe`;
const args=Object.freeze(['-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ClearAllForwardings=yes',
 '-o','UpdateHostKeys=no','-o','AddKeysToAgent=no','-o','VerifyHostKeyDNS=no',
 '-o','ForwardAgent=no','-o','ForwardX11=no','-o','ForwardX11Trusted=no','-o','Tunnel=no',
 '-o','ProxyCommand=none','-o','ProxyJump=none','-o','PermitLocalCommand=no','-o','LocalCommand=none',
 '-o','ControlMaster=no','-o','ControlPath=none','-o','ControlPersist=no','-o','RequestTTY=no','-o','RemoteCommand=none',
 '-o','ConnectionAttempts=1','-o','ConnectTimeout=8','-o','ServerAliveInterval=3','-o','ServerAliveCountMax=2','-o','LogLevel=ERROR',
 'WSL-server','exec /usr/bin/env -i /opt/node-v24.22.1-linux-x64/bin/node --input-type=module']);
const options=Object.freeze({shell:false,windowsHide:true,stdio:Object.freeze(['pipe','pipe','ignore'] as const)});
const unknown=Object.freeze({status:'UNKNOWN',code:'CARRIER_UNCONFIRMED'} as const);
const hash=(v:unknown)=>createHash('sha256').update(canonicalJson(v)).digest('hex');
function invalid():never{throw new Error('SUBNET_CARRIER_INVALID');}
function fields(v:unknown,names:readonly string[]):Record<string,unknown>{
 if(!v||typeof v!=='object'||types.isProxy(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).length!==names.length)return invalid();
 const out:Record<string,unknown>=Object.create(null);for(const name of names){const d=Object.getOwnPropertyDescriptor(v,name);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)return invalid();out[name]=d.value;}return out;
}
const hex=(v:unknown,n:number):v is string=>typeof v==='string'&&v.length===n&&/^[a-f0-9]+$/.test(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
/** 외부 원장 검토에 낼 순수 결박 자료다. 승인/단회 소비/파일 신원을 스스로 증명하지 않는다. */
export function prepareSubnetObservationCarrier(bundle:unknown,observation:unknown,sourceHead:unknown,identity:unknown){
 const payload=assembleSubnetObservationStdin(bundle,observation),v=fields(observation,['proof','window','ip']);
 const {proof,window}=readSubnetCompletionBinding(v.proof,v.window),i=fields(identity,['imageSha256','configurationSha256','knownHostsSha256']);
 if(!hex(sourceHead,40)||Object.values(i).some(v=>!hex(v,64)))return invalid();
 const carrier=Object.freeze({client,alias:'WSL-server',imageSha256:i.imageSha256 as string,configurationSha256:i.configurationSha256 as string,knownHostsSha256:i.knownHostsSha256 as string});
 const binding=Object.freeze({schemaVersion:1,purpose:'IX01_SUBNET_OBSERVATION_CARRIER',sourceHead,...proof,...window,
  payloadHash:payload.sha256,wrapperHash:payload.wrapperSha256,inputHash:payload.inputSha256,commandHash:hash({client,args,options}),carrier});
 return Object.freeze({payload,binding,bindingHash:hash(binding),identityHash:hash(carrier),proof,window});
}
/** 반드시 명시 주입하는 합성/후속 감독 포트. 실제 OS·SSH·원장 구현은 제공하지 않는다.
 * verifyConsumed는 이미 소진된 외부 기록과 정확 결박을 검산한다(발급/소진 동작 아님).
 * verifyCarrier는 파일 지문뿐 아니라 기존 alias 설정의 Match exec 발동 등 추가 효과 없음과
 * 정확 host trust가 별도 검수됐음을 확인해야 한다. 이름만 같은 boolean은 운용 증거가 아니다.
 */
export interface SubnetCarrierPorts{
 clock:SubnetCollectionClock;
 verifyConsumed(receipt:unknown,binding:unknown):unknown;
 verifyCarrier(identity:unknown):unknown;
 start(file:string,args:readonly string[],launchOptions:typeof options):unknown;
 sendEnd(original:unknown,bytes:Uint8Array):void;
}
/** 단일 메모리 owner. 새 factory/프로세스가 외부 단회 ledger를 대신하지 못한다.
 * CLI 플래그는 proxy/local-command/forwarding을 제한하나 config의 Match exec·Include 해석을
 * 금지하는 증명은 아니다. 현재 client/config/known_hosts 지문은 미확정이며 과거 터널 값을 쓰지 않는다.
 * 로컬 SSH 종결은 원격 종결과 별개다. 미종결 원 객체는 외부 소유자가 보존·감독해야 한다.
 */
export function createSubnetObservationCarrier(ports:SubnetCarrierPorts){
 let spent=false;
 return Object.freeze({async run(bundle:unknown,observation:unknown,request:unknown){
  if(spent)return unknown;spent=true;
  try{
   const p=fields(ports,['clock','verifyConsumed','verifyCarrier','start','sendEnd']),c=fields(p.clock,['now','monotonic','setTimeout','clearTimeout']);
   for(const fn of [...Object.values(c),p.verifyConsumed,p.verifyCarrier,p.start,p.sendEnd])if(typeof fn!=='function'||types.isProxy(fn))return unknown;
   const invoke=(name:string,a:unknown[])=>Reflect.apply(p[name] as Function,ports,a),time=(name:string,a:unknown[]=[])=>Reflect.apply(c[name] as Function,p.clock,a);
   const r=fields(request,['sourceHead','identity','receipt']),prepared=prepareSubnetObservationCarrier(bundle,observation,r.sourceHead,r.identity);
   const receipt=fields(r.receipt,['schemaVersion','purpose','receiptId','bindingHash','status']);
   if(receipt.schemaVersion!==1||receipt.purpose!=='IX01_SUBNET_OBSERVATION_CONSUMED'||!uuid(receipt.receiptId)||receipt.bindingHash!==prepared.bindingHash||receipt.status!=='CONSUMED')return unknown;
   const pinnedReceipt=Object.freeze({...receipt});
   let lastWall=prepared.window.issuedAt,lastMono=time('monotonic');const firstMono=lastMono;
   if(typeof firstMono!=='number'||!Number.isFinite(firstMono)||firstMono<0)return unknown;
   const fresh=()=>{const wall=time('now'),mono=time('monotonic');if(typeof wall!=='number'||!Number.isSafeInteger(wall)||wall<lastWall||wall>=prepared.window.expiresAt||typeof mono!=='number'||!Number.isFinite(mono)||mono<(lastMono as number)||mono-firstMono>=60000)throw null;lastWall=wall;lastMono=mono;};
   fresh();const consumed=fields(invoke('verifyConsumed',[pinnedReceipt,prepared.binding]),['status','receiptId','bindingHash']);fresh();
   if(consumed.status!=='VERIFIED_CONSUMED'||consumed.receiptId!==receipt.receiptId||consumed.bindingHash!==prepared.bindingHash)return unknown;
   const current=fields(invoke('verifyCarrier',[prepared.binding.carrier]),['status','identityHash','configuration','hostTrust']);fresh();
   if(current.status!=='VERIFIED'||current.identityHash!==prepared.identityHash||current.configuration!=='NO_ADDITIONAL_EFFECTS'||current.hostTrust!=='EXACT_ALIAS')return unknown;
   const child=invoke('start',[client,args,options]);
   let ready=false,registered=false,fired=false,registering=false,transferFailed=false,stopCollection:(()=>void)|undefined;
   const clock:SubnetCollectionClock={now:()=>time('now') as number,monotonic:()=>time('monotonic') as number,
    setTimeout(callback,ms){
     if(registered)throw null;registered=true;registering=true;
     stopCollection=()=>{fired=true;ready=false;callback();};
     try{const timer=time('setTimeout',[stopCollection,ms]);registering=false;ready=!fired;return timer;}catch{registering=false;ready=false;throw null;}
    },clearTimeout(timer){ready=false;time('clearTimeout',[timer]);}};
   // 등록은 collector의 모든 원 listener 설치 후 발생한다. microtask 순서를 준비 증거로 쓰지 않는다.
   const collection=collectSubnetRemoteCompletion(child,prepared.proof,prepared.window,clock);
   try{fresh();if(!ready||registering||fired){stopCollection?.();await collection;return unknown;}
    // public bytes는 sendEnd의 원 stdin finish까지 운송자가 보유할 수 있다. 미정착 중 덮어쓰지 않는다.
    invoke('sendEnd',[child,prepared.payload.bytes]);
   }catch{transferFailed=true;stopCollection?.();}
   const result=await collection;fresh();return transferFailed?unknown:result;
  }catch{return unknown;}
 }});
}
