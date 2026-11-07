import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

function dataFields(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('DEVELOPMENT_RECOVERY_MANIFEST_INVALID');
 const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(descriptors).length!==keys.length||keys.some(key=>!descriptors[key]||!('value' in descriptors[key]!)))throw Error('DEVELOPMENT_RECOVERY_MANIFEST_INVALID');
 return Object.fromEntries(keys.map(key=>[key,descriptors[key]!.value]));
}
export interface RecoveryManifestFile {relativePath:string;contentHash:string;sizeBytes:number}
/** 선언 목록의 순수 결박이다. 실제 파일 존재/완전성/OS pin 또는 실행 권위가 아니다. */
export function prepareRecoveryManifest(input:unknown){
 const fail=()=>{throw Error('DEVELOPMENT_RECOVERY_MANIFEST_INVALID');};
 const value=dataFields(input,['schemaVersion','commit','files']);
 if(value.schemaVersion!==1||typeof value.commit!=='string'||!/^[a-f0-9]{40}$/.test(value.commit)||!Array.isArray(value.files)||Object.getPrototypeOf(value.files)!==Array.prototype||value.files.length<1||value.files.length>100000)fail();
 const source=value.files as unknown[],files:Readonly<RecoveryManifestFile>[]=[];const seen=new Set<string>();let totalBytes=0;
 for(let i=0;i<source.length;i++){
  const descriptor=Object.getOwnPropertyDescriptor(source,String(i));if(!descriptor||!('value' in descriptor))fail();
  const row=dataFields(descriptor!.value,['relativePath','contentHash','sizeBytes']),path=row.relativePath;
  if(typeof path!=='string'||path.length>4096||Buffer.from(path,'utf8').toString('utf8')!==path||path.normalize('NFC')!==path||typeof row.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(row.contentHash)||!Number.isSafeInteger(row.sizeBytes)||(row.sizeBytes as number)<0)fail();
  const relativePath=path as string,segments=relativePath.split('/');
  if(segments.length>64||segments.some(segment=>!segment||segment.length>255||segment==='.'||segment==='..'||/[. ]$/.test(segment)||/[\x00-\x1f\x7f\\:"*?<>|]/.test(segment)||/^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/i.test(segment)))fail();
  if(!['apps/server/','contracts/','apps/web/dist/','node_modules/'].some(prefix=>relativePath.startsWith(prefix))&&!['package.json','scripts/development-recovery-entry.ts'].includes(relativePath))fail();
  const leaf=segments[segments.length-1]!.toLowerCase();
  if(segments.some(segment=>/^\.env(?:\.|$)/i.test(segment))||['auth.json','db-app.json','bootstrap.json'].includes(leaf)||/\.(pem|key|p12|pfx)$/i.test(leaf))fail();
  const key=relativePath.toUpperCase();if(seen.has(key))fail();seen.add(key);
  totalBytes+=row.sizeBytes as number;if(totalBytes>2147483648)fail();
  files.push(Object.freeze({relativePath,contentHash:row.contentHash as string,sizeBytes:row.sizeBytes as number}));
 }
 files.sort((a,b)=>a.relativePath<b.relativePath?-1:a.relativePath>b.relativePath?1:0);
 const frozenFiles=Object.freeze(files),canonicalJson=JSON.stringify({schemaVersion:1,commit:value.commit,files:frozenFiles});
 return Object.freeze({commit:value.commit as string,files:frozenFiles,fileCount:files.length,totalBytes,canonicalJson,manifestHash:createHash('sha256').update(canonicalJson).digest('hex'),runtimeCoverage:'DECLARED_NOT_VERIFIED' as const,nativePinCapacityVerified:false as const,executionAuthorized:false as const});
}

export interface RecoveryLifetime {
 issuedAt:number;expiresAt:number;acquiredWall:number;remainingAtAcquireMs:number;lastWall:number;lastElapsedMs:number;executionAuthorized:false;
}
export function prepareRecoveryLifetime(issuedAt:number,expiresAt:number,acquiredWall:number):Readonly<RecoveryLifetime>{
 if(![issuedAt,expiresAt,acquiredWall].every(Number.isSafeInteger)||expiresAt<=issuedAt||expiresAt-issuedAt>1800000||acquiredWall<issuedAt||acquiredWall>=expiresAt)throw Error('DEVELOPMENT_RECOVERY_WINDOW_INVALID');
 return Object.freeze({issuedAt,expiresAt,acquiredWall,remainingAtAcquireMs:expiresAt-acquiredWall,lastWall:acquiredWall,lastElapsedMs:0,executionAuthorized:false});
}
export function checkRecoveryLifetime(previous:Readonly<RecoveryLifetime>,wallNow:number,elapsedMs:number):Readonly<RecoveryLifetime>{
 const p={...previous};
 if(![p.issuedAt,p.expiresAt,p.acquiredWall,p.remainingAtAcquireMs,p.lastWall,p.lastElapsedMs,wallNow,elapsedMs].every(Number.isSafeInteger)||p.executionAuthorized!==false||p.expiresAt<=p.issuedAt||p.expiresAt-p.issuedAt>1800000||p.acquiredWall<p.issuedAt||p.remainingAtAcquireMs!==p.expiresAt-p.acquiredWall||p.lastWall<p.acquiredWall||p.lastElapsedMs<0||wallNow<p.lastWall||wallNow>=p.expiresAt||elapsedMs<p.lastElapsedMs||elapsedMs>=p.remainingAtAcquireMs)throw Error('DEVELOPMENT_RECOVERY_WINDOW_INVALID');
 return Object.freeze({...p,lastWall:wallNow,lastElapsedMs:elapsedMs,executionAuthorized:false});
}
export interface RecoverySimulationContext {
 kind:'SOURCE_SIMULATION';mode:'P2'|'P3';commit:string;runId:string;issuedAt:number;expiresAt:number;
 manifestHash:string|null;manifest:ReturnType<typeof prepareRecoveryManifest>|null;
}
export interface RecoverySourceSimulationIo {
 kind:string;wallNow:()=>number;monotonicNow:()=>number;
 simulateAcquire:(context:Readonly<RecoverySimulationContext>)=>Promise<unknown>;
 simulateStep:(context:Readonly<RecoverySimulationContext>&{readonly leaseId:string})=>Promise<unknown>;
 simulateRelease:(context:Readonly<RecoverySimulationContext>&{readonly leaseId:string})=>Promise<unknown>;
}
/** 가짜 시험 주입 경계다. callback의 주장은 native/플랫폼 승인 증거가 아니며 실제 entry에 연결하지 않는다. */
export async function simulateRecoverySourceBridge(input:unknown,io:RecoverySourceSimulationIo){
 let context:Readonly<RecoverySimulationContext>,lifetime:Readonly<RecoveryLifetime>,monoStart:number;
 try{
  const r=dataFields(input,['mode','commit','runId','issuedAt','expiresAt','manifest']);
  if(!['P2','P3'].includes(r.mode as string)||typeof r.commit!=='string'||!/^[a-f0-9]{40}$/.test(r.commit)||typeof r.runId!=='string'||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(r.runId)||io.kind!=='SOURCE_SIMULATION')throw Error();
  const mode=r.mode as 'P2'|'P3',issuedAt=r.issuedAt as number,expiresAt=r.expiresAt as number;
  if(![issuedAt,expiresAt].every(Number.isSafeInteger)||expiresAt-issuedAt>(mode==='P2'?600000:1800000))throw Error();
  const manifest=mode==='P3'?prepareRecoveryManifest(r.manifest):null;
  if(mode==='P2'&&r.manifest!==null)throw Error();
  if(manifest&&(manifest.commit!==r.commit||['apps/server/main.ts','apps/web/dist/index.html','package.json','scripts/development-recovery-entry.ts'].some(path=>!manifest.files.some(file=>file.relativePath===path))))throw Error();
  context=Object.freeze({kind:'SOURCE_SIMULATION',mode,commit:r.commit,runId:r.runId,issuedAt,expiresAt,manifestHash:manifest?.manifestHash??null,manifest});
  const wall=io.wallNow();monoStart=io.monotonicNow();if(!Number.isSafeInteger(monoStart)||monoStart<0)throw Error();
  lifetime=prepareRecoveryLifetime(issuedAt,expiresAt,wall);
 }catch{throw Error('DEVELOPMENT_RECOVERY_SOURCE_BRIDGE_INVALID');}
 const fresh=()=>{lifetime=checkRecoveryLifetime(lifetime,io.wallNow(),io.monotonicNow()-monoStart);};
 const result=(status:string,step:string,cleanup:string,stepAttempted=false)=>Object.freeze({kind:'SOURCE_SIMULATION_RESULT',status,runId:context.runId,commit:context.commit,mode:context.mode,step,cleanup,stepAttempted,runtimeCoverage:'DECLARED_NOT_VERIFIED',authorityBoundary:'EXTERNAL_PLATFORM_NOT_AUTHENTICATED_HERE',executionAuthorized:false,osVerified:false});
 const readReply=(value:unknown,states:string[],leaseId?:string)=>{
  const r=dataFields(value,['kind','state','runId','commit','mode','manifestHash','leaseId','nativeVerified']);
  if(r.kind!=='SOURCE_SIMULATION'||typeof r.state!=='string'||!states.includes(r.state)||r.runId!==context.runId||r.commit!==context.commit||r.mode!==context.mode||r.manifestHash!==context.manifestHash||r.nativeVerified!==false||typeof r.leaseId!=='string'||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(r.leaseId)||(leaseId!==undefined&&r.leaseId!==leaseId))throw Error('DEVELOPMENT_RECOVERY_SOURCE_CORRELATION_INVALID');
  return {state:r.state,leaseId:r.leaseId};
 };
 let raw:unknown;
 try{fresh();raw=await io.simulateAcquire(context);}catch{return result('ACQUISITION_UNCONFIRMED','NOT_STARTED','OWNERSHIP_UNVERIFIED');}
 let leaseId:string;
 // 만료 뒤 ACK도 상관관계가 정확할 때 정리 대상으로만 보존한다. 새 동작 권한은 아니다.
 try{leaseId=readReply(raw,['ACQUIRED_SIMULATION']).leaseId;}catch{return result('OWNERSHIP_UNVERIFIED','NOT_STARTED','OWNERSHIP_UNVERIFIED');}
 const owned=Object.freeze({...context,leaseId});let step='NOT_STARTED',stepAttempted=false;
 try{fresh();stepAttempted=true;const reply=await io.simulateStep(owned);fresh();readReply(reply,['STEP_RECORDED_SIMULATION'],leaseId);step='STEP_RECORDED_SIMULATION';}
 catch(error){step=error instanceof Error&&error.message==='DEVELOPMENT_RECOVERY_WINDOW_INVALID'?'WINDOW_UNVERIFIED':'SOURCE_STEP_UNCONFIRMED';}
 let cleanup='RELEASE_UNCONFIRMED_SIMULATION';
 // 정리는 같은 원 source 상관관계만 사용한다. 기한 만료를 핑계로 정리까지 생략하지 않는다.
 try{cleanup=readReply(await io.simulateRelease(owned),['RELEASE_RECORDED_SIMULATION','RELEASE_UNCONFIRMED_SIMULATION'],leaseId).state;}catch{}
 const status=step==='STEP_RECORDED_SIMULATION'&&cleanup==='RELEASE_RECORDED_SIMULATION'?'SOURCE_SIMULATION_RECORDED_NOT_OS_VALIDATED':'SOURCE_SIMULATION_UNCONFIRMED';
 return result(status,step,cleanup,stepAttempted);
}

export interface RecoveryDeadline {
 closeAt:number;observeUntil:number;expiresAt:number;remainingMs:number;executionAuthorized:false;
}
/** 순수 계산이다. 이 반환값이나 시계가 native lease/실행 허가를 증명하지 않는다. */
export function prepareRecoveryDeadline(issuedAt:number,expiresAt:number,now:number):Readonly<RecoveryDeadline>{
 if(![issuedAt,expiresAt,now].every(Number.isSafeInteger)||expiresAt<=issuedAt||expiresAt-issuedAt>1800000||now<issuedAt||now>=expiresAt||now>=expiresAt-30000)throw Error('DEVELOPMENT_RECOVERY_WINDOW_INVALID');
 return Object.freeze({closeAt:expiresAt-30000,observeUntil:expiresAt-15000,expiresAt,remainingMs:expiresAt-now,executionAuthorized:false});
}
export function scheduleRecoveryClose(plan:Readonly<RecoveryDeadline>,io:{now:()=>number;schedule:(fire:()=>void,ms:number)=>()=>void;requestClose:()=>void}){
 plan=Object.freeze({...plan});
 const now=io.now();
 if(!Number.isSafeInteger(now)||!Number.isSafeInteger(plan.closeAt)||plan.closeAt<now||plan.observeUntil!==plan.closeAt+15000||plan.expiresAt!==plan.closeAt+30000||plan.expiresAt-now>1800000)throw Error('DEVELOPMENT_RECOVERY_WINDOW_INVALID');
 let fired=false,disposed=false,state='EXIT_UNCONFIRMED';
 const cancel=io.schedule(()=>{
  if(fired||disposed)return;fired=true;
  const at=io.now();
  if(!Number.isSafeInteger(at)||at<plan.closeAt||at>=plan.expiresAt){state='CLOCK_OR_DEADLINE_UNVERIFIED';return;}
  // 요청 성공은 실제 process exit·Job active0·COMMIT 증거가 아니다.
  try{io.requestClose();}catch{state='CLOSE_REQUEST_FAILED';}
 },plan.closeAt-now);
 return Object.freeze({outcome:()=>state,dispose:()=>{if(!disposed){disposed=true;cancel();}}});
}
export function assertRecoveryNativeExecution():never{
 // 소스 채택만 승인됐다. native/OS 검수·실제 lease/guardian 연결 승인은 아직 없다.
 throw Error('DEVELOPMENT_TLS_RECOVERY_PROTECTION_UNVERIFIED');
}
export async function runDevelopmentRecoveryEntry(_io?:{start:()=>Promise<void>;schedule:()=>void}):Promise<never>{
 throw Error('DEVELOPMENT_RECOVERY_OS_NOT_VALIDATED');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await runDevelopmentRecoveryEntry();
