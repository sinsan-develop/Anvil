import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {canonicalJson} from '../contracts/canonical.ts';
import {createSubnetObservationCarrier,prepareSubnetObservationCarrier,type SubnetCarrierPorts} from './qa-ix01-subnet-observation-carrier.ts';
import {assembleSubnetPreflightStdin,collectSubnetPreflight,readSubnetPreflightInput} from './qa-ix01-subnet-observation-preflight-carrier.ts';
import type {SubnetCollectionClock} from './qa-ix01-subnet-observation-supervisor.ts';
const client=String.raw`C:\Windows\System32\OpenSSH\ssh.exe`;
const args=Object.freeze(['-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ClearAllForwardings=yes',
 '-o','UpdateHostKeys=no','-o','AddKeysToAgent=no','-o','VerifyHostKeyDNS=no',
 '-o','ForwardAgent=no','-o','ForwardX11=no','-o','ForwardX11Trusted=no','-o','Tunnel=no',
 '-o','ProxyCommand=none','-o','ProxyJump=none','-o','PermitLocalCommand=no','-o','LocalCommand=none',
 '-o','ControlMaster=no','-o','ControlPath=none','-o','ControlPersist=no','-o','RequestTTY=no','-o','RemoteCommand=none',
 '-o','ConnectionAttempts=1','-o','ConnectTimeout=8','-o','ServerAliveInterval=3','-o','ServerAliveCountMax=2','-o','LogLevel=ERROR',
 'WSL-server','exec /usr/bin/env -i /opt/node-v24.22.1-linux-x64/bin/node --input-type=module']);
const options=Object.freeze({shell:false,windowsHide:true,stdio:Object.freeze(['pipe','pipe','ignore'] as const)});

const unknown=Object.freeze({status:'UNKNOWN',code:'LOCAL_OBSERVATION_UNCONFIRMED'} as const);
const hash=(v:unknown)=>createHash('sha256').update(canonicalJson(v)).digest('hex');
const observationHash='da375f17e1ccfbc4a1bd85af108ee82c0a8398a061dced888427725223bb6d8d';
function fail():never{throw null;}
function fields(v:unknown,names:readonly string[]):Record<string,unknown>{
 if(!v||typeof v!=='object'||types.isProxy(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).length!==names.length)return fail();
 const out:Record<string,unknown>=Object.create(null);for(const k of names){const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)return fail();out[k]=d.value;}return out;
}
const ap=Object.getPrototypeOf(Uint8Array.prototype),length=Object.getOwnPropertyDescriptor(ap,'byteLength')!.get!,backing=Object.getOwnPropertyDescriptor(ap,'buffer')!.get!;
function ownBundle(v:unknown){if(types.isProxy(v)||!types.isUint8Array(v)||length.call(v)!==59073||types.isSharedArrayBuffer(backing.call(v)))return fail();const b=new Uint8Array(59073);Uint8Array.prototype.set.call(b,v);return b;}
/** 외부 감독에 제출할 결박만 생성한다. 2회 SSH/원장 기록의 허가나 정착을 발급하지 않는다. */
export function prepareSubnetObservationLocal(metadataBundle:unknown,observationBundle:unknown,input:unknown,sourceHead:unknown,identity:unknown){
 const meta=assembleSubnetPreflightStdin(metadataBundle,input),q=readSubnetPreflightInput(input),bundle=ownBundle(observationBundle);
 const proof=Object.freeze({attemptId:q.proof.attemptId,bundleHash:observationHash,approvalHash:q.proof.approvalHash});
 // 지문 검산만 위한 입력이며 실제 관측에는 쓰이지 않는다. 실제 SHA는 원 메타 종결 뒤에만 파생한다.
 const check=prepareSubnetObservationCarrier(bundle,{proof,window:q.window,ip:{location:q.location,sha256:'0'.repeat(64)}},sourceHead,identity);
 const binding=Object.freeze({schemaVersion:1,purpose:'IX01_SUBNET_TWO_PHASE',sourceHead:check.binding.sourceHead,
  attemptId:proof.attemptId,approvalHash:proof.approvalHash,...q.window,location:q.location,
  phases:'PREFLIGHT_AND_OBSERVATION',metadata:Object.freeze({helperHash:q.proof.helperHash,bundleHash:meta.bundleHash,payloadHash:meta.sha256,payloadBytes:meta.byteLength,wrapperHash:meta.wrapperHash,inputHash:meta.inputHash}),
  observation:Object.freeze({bundleHash:observationHash,wrapperHash:check.binding.wrapperHash}),commandHash:hash({client,args,options}),carrier:check.binding.carrier});
 if(binding.commandHash!==check.binding.commandHash)return fail();
 return Object.freeze({binding,bindingHash:hash(binding),identityHash:check.identityHash,meta,bundle,proof,window:q.window});
}
/** 명시 합성 포트만. 실제 launch/persistent ledger/config/host trust 판독은 제공하지 않는다.
 * verifyPlanConsumed/observationReceipt는 기존 외부 정착 기록을 반환·검산하는 경계다.
 * 이 포트는 배타 생성·정착 성공을 보유한 동일 외부 감독 인스턴스에 귀속해야 한다.
 * 과거 CONSUMED 기록을 다른 factory/process가 조회만 해서 재사용하도록 구현해서는 안 된다.
 * 임의 VERIFIED 응답이나 메모리 spent를 실제 승인/프로세스 간 배타 소비로 승격할 수 없다. */
export interface SubnetLocalPorts extends SubnetCarrierPorts{
 verifyPlanConsumed(receipt:unknown,binding:unknown):unknown;
 observationReceipt(binding:unknown):unknown;
}
export function createSubnetObservationLocalHost(ports:SubnetLocalPorts){
 let spent=false;
 return Object.freeze({async run(metadataBundle:unknown,observationBundle:unknown,input:unknown,request:unknown){
  if(spent)return unknown;spent=true;
  let owned:Uint8Array|undefined;
  try{
   const p=fields(ports,['clock','verifyConsumed','verifyCarrier','start','sendEnd','verifyPlanConsumed','observationReceipt']),c=fields(p.clock,['now','monotonic','setTimeout','clearTimeout']);
   for(const f of [...Object.values(c),...Object.entries(p).filter(([k])=>k!=='clock').map(([,v])=>v)])if(typeof f!=='function'||types.isProxy(f))return unknown;
   const invoke=(k:string,a:unknown[])=>Reflect.apply(p[k] as Function,ports,a),time=(k:string,a:unknown[]=[])=>Reflect.apply(c[k] as Function,p.clock,a);
   const r=fields(request,['sourceHead','identity','receipt']),prepared=prepareSubnetObservationLocal(metadataBundle,observationBundle,input,r.sourceHead,r.identity);owned=prepared.bundle;
   const receipt=fields(r.receipt,['schemaVersion','purpose','receiptId','bindingHash','status']);
   if(receipt.schemaVersion!==1||receipt.purpose!=='IX01_SUBNET_TWO_PHASE_CONSUMED'||typeof receipt.receiptId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(receipt.receiptId)||receipt.bindingHash!==prepared.bindingHash||receipt.status!=='CONSUMED')return unknown;
   const firstMono=time('monotonic');let lastMono=firstMono,lastWall=prepared.window.issuedAt;
   if(typeof firstMono!=='number'||!Number.isFinite(firstMono)||firstMono<0)return unknown;
   const fresh=()=>{const wall=time('now'),mono=time('monotonic');if(typeof wall!=='number'||!Number.isSafeInteger(wall)||wall<lastWall||wall>=prepared.window.expiresAt||typeof mono!=='number'||!Number.isFinite(mono)||mono<(lastMono as number)||mono-firstMono>=60000)return fail();lastWall=wall;lastMono=mono;return wall;};
   fresh();const consumed=fields(invoke('verifyPlanConsumed',[Object.freeze({...receipt}),prepared.binding]),['status','receiptId','bindingHash']);fresh();
   if(consumed.status!=='VERIFIED_CONSUMED'||consumed.receiptId!==receipt.receiptId||consumed.bindingHash!==prepared.bindingHash)return unknown;
   const current=fields(invoke('verifyCarrier',[prepared.binding.carrier]),['status','identityHash','configuration','hostTrust']);fresh();
   if(current.status!=='VERIFIED'||current.identityHash!==prepared.identityHash||current.configuration!=='NO_ADDITIONAL_EFFECTS'||current.hostTrust!=='EXACT_ALIAS')return unknown;
   const startAt=fresh(),original=invoke('start',[client,args,options]);
   const clock:SubnetCollectionClock={now:fresh,monotonic:()=>{fresh();return lastMono as number;},setTimeout:(f,ms)=>{fresh();return time('setTimeout',[f,Math.min(ms,prepared.window.expiresAt-lastWall)]);},clearTimeout:h=>{time('clearTimeout',[h]);}};
   const measurement=await collectSubnetPreflight(original,prepared.meta.input,startAt,clock,()=>{fresh();invoke('sendEnd',[original,prepared.meta.bytes]);});
   fresh();if(measurement.status!=='METADATA_COLLECTED')return unknown;
   const observation=Object.freeze({proof:prepared.proof,window:prepared.window,ip:measurement.ip});
   // carrier identity의 공개 입력 세 키만 전달한다. 경로/alias를 호출자로부터 새로 받지 않는다.
   const identity=Object.freeze({imageSha256:prepared.binding.carrier.imageSha256,configurationSha256:prepared.binding.carrier.configurationSha256,knownHostsSha256:prepared.binding.carrier.knownHostsSha256});
   const selected=prepareSubnetObservationCarrier(prepared.bundle,observation,prepared.binding.sourceHead,identity);
   fresh();const observationReceipt=invoke('observationReceipt',[selected.binding]);fresh();
   let started=false;
   const carrier=createSubnetObservationCarrier({clock,verifyConsumed:(a,b)=>{fresh();return invoke('verifyConsumed',[a,b]);},verifyCarrier:i=>{fresh();return invoke('verifyCarrier',[i]);},
    start:(file,argv,o)=>{fresh();if(started)return fail();started=true;const child=invoke('start',[file,argv,o]);if(child===original)return fail();return child;},sendEnd:(child,bytes)=>{fresh();invoke('sendEnd',[child,bytes]);}});
   const result=await carrier.run(prepared.bundle,observation,{sourceHead:prepared.binding.sourceHead,identity,receipt:observationReceipt});fresh();return result;
  }catch{return unknown;}finally{owned?.fill(0);}
 }});
}
