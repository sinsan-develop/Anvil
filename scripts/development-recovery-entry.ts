import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

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
