import {arrayV1,hashV1,isoV1,recordV1,uuidV1} from '../../../contracts/runtime/validation-v1.ts';

const ids=['installationId','projectId','executionId','userId','clientId','humanSessionId','rootId','runId','preparationId','authorizationReceiptId','policyId','registrationId','observerId'];
const numbers=['executionGeneration','controlGeneration','credentialGeneration','processGeneration','preparationVersion','authorizationReceiptVersion','policyVersion','registrationVersion','observerVersion'];
const hashes=['preparationHash','authorizationReceiptHash','policyHash','registrationHash','observerHash','publicKeyFingerprint','hostHash','workerHash'];
const keys=[...ids,...numbers,...hashes,'issuedAt','expiresAt'];
const flags=['processCreationAuthorized','preparationAuthorized','executionAuthorized','dispatchPerformed'];
const requiredMissing=['AUTHENTICATED_NATIVE_CHANNEL','RETAINED_PROCESS_JOB_FACTORY','OBSERVATION_SIGNER'];
const fail=():never=>{throw new Error('OWNERSHIP_PREPARATION_INPUT_SOURCE_UNAVAILABLE');};
type SourceSelection=Readonly<Record<string,string>&{issuedAt:string;expiresAt:string}>;
function selection(v:unknown):SourceSelection{
 if(!recordV1(v,keys)||!ids.every(k=>uuidV1(v[k]))||!hashes.every(k=>hashV1(v[k]))||
  !numbers.every(k=>typeof v[k]==='string'&&/^[1-9][0-9]{0,15}$/.test(v[k])&&Number.isSafeInteger(Number(v[k]))&&String(Number(v[k]))===v[k])||
  v.preparationVersion!=='1'||v.authorizationReceiptVersion!=='1'||!isoV1(v.issuedAt)||!isoV1(v.expiresAt))return fail();
 return Object.freeze(Object.fromEntries(keys.map(k=>[k,v[k]]))) as SourceSelection;
}
function missingCodes(v:unknown):string[]{
 if(!arrayV1(v,32))return fail();
 // 입력 배열의 every/includes/iterator를 호출하지 않고 검사한 own data 값만 복사한다.
 const descriptors=Object.getOwnPropertyDescriptors(v) as unknown as Record<string,PropertyDescriptor>,copy:string[]=[];
 for(let i=0;i<descriptors.length!.value;i++){
  const value=descriptors[String(i)]!.value;
  if(typeof value!=='string'||!/^[A-Z][A-Z0-9_]{1,127}$/.test(value)||copy.includes(value))return fail();
  copy.push(value);
 }
 if(!requiredMissing.every(v=>copy.includes(v)))return fail();return copy;
}
/** 기존 server source profile의 입력 해석만. 서명/전송/인증/current provider가 아니며
 * 결과는 순간 snapshot이다. 이를 실제 native reader/허가/route에 등록하지 않는다. */
export function readOwnershipPreparationInputSource(profile:unknown,expectedSelection:unknown){
 try{
  const from=Date.now(),started=performance.now(),expected=selection(expectedSelection);
  if(!recordV1(profile,['purpose','selection','policyDisposition','registrationScope','grants','checkedAt','expiresAt',...flags,'missingEvidence'])||
   profile.purpose!=='OWNERSHIP_NATIVE_PREPARATION_PROFILE_BASIS_ONLY'||profile.policyDisposition!=='AUTO'||profile.registrationScope!=='REGISTRATION_STATUS_ONLY'||
   !arrayV1(profile.grants,0)||!flags.every(k=>profile[k]===false)||!isoV1(profile.checkedAt)||!isoV1(profile.expiresAt))return fail();
  const missing=missingCodes(profile.missingEvidence),selected=selection(profile.selection);
  if(!keys.every(k=>selected[k]===expected[k]))return fail();
  const issued=Date.parse(selected.issuedAt),originalEnd=Date.parse(selected.expiresAt),checked=Date.parse(profile.checkedAt),end=Date.parse(profile.expiresAt);
  const now=Date.now();
  if(now<from||issued>checked||checked>now||now-checked>10000||issued>now||originalEnd-issued>120000||end>originalEnd||end<=now||end<=checked||performance.now()-started>=10000)return fail();
  return Object.freeze({purpose:'OWNERSHIP_NATIVE_PREPARATION_INPUT_SOURCE_ONLY' as const,selection:selected,
   policyDisposition:'AUTO' as const,registrationScope:'REGISTRATION_STATUS_ONLY' as const,grants:Object.freeze([] as string[]),
   checkedAt:profile.checkedAt as string,expiresAt:profile.expiresAt as string,missingEvidence:Object.freeze(missing),
   serverAuthenticated:false as const,processCreationAuthorized:false as const,preparationAuthorized:false as const,executionAuthorized:false as const,dispatchPerformed:false as const});
 }catch{return fail();}
}
