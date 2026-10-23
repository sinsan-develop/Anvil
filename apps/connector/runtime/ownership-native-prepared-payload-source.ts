import {parseWireJson} from '../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1} from '../../../contracts/runtime/validation-v1.ts';
import {readOwnershipObservationRequestV1} from '../../../contracts/runtime/ownership-observation-v1.ts';
import {readOwnershipPreparationSelectionSource} from './ownership-preparation-input-source.ts';
import {buildOwnershipObservationPayloadSource} from './ownership-observation-payload-source.ts';

const flags=['dispatchPerformed','executionAuthorized','nativeFactsVerified','preparationAuthorized','serverRequestAuthenticated','signingAuthorized'];
/** native JSON 후보와 기존 request 후보를 대조하는 SOURCE 조립만.
 * 실제 native 출처·서버 인증·OS 소유권·서명·전송 또는 nonce 소비를 증명하거나 수행하지 않는다. */
export function buildOwnershipNativePreparedPayloadSource(requestSourceValue:unknown,rawEnvelope:unknown){
 try{
  const from=Date.now(),started=performance.now();
  if(typeof rawEnvelope!=='string'||!rawEnvelope.isWellFormed()||rawEnvelope.length===0||rawEnvelope.length>2097152||Buffer.byteLength(rawEnvelope,'utf8')>2097152)throw Error();
  const envelope=parseWireJson(rawEnvelope);
  if(!recordV1(envelope,['purpose','selection','processRef','facts','observedAt','expiresAt',...flags,'signature'])||
   envelope.purpose!=='NATIVE_PREPARED_FACTS_SOURCE_ONLY'||!flags.every(k=>envelope[k]===false)||envelope.signature!==null||
   !isoV1(envelope.observedAt)||!isoV1(envelope.expiresAt))throw Error();
  const selected=readOwnershipPreparationSelectionSource(envelope.selection),request=readOwnershipObservationRequestV1(cloneV1(requestSourceValue));
  const issued=Date.parse(selected.issuedAt),originalEnd=Date.parse(selected.expiresAt),observed=Date.parse(envelope.observedAt),end=Date.parse(envelope.expiresAt),now=Date.now();
  if(request.phase!=='BOOTSTRAP_PREPARED'||issued>observed||observed>now||now-observed>10000||end<=now||end<=observed||
   originalEnd<=issued||originalEnd-issued>120000||end>originalEnd||Date.parse(request.requestedAt)<issued||Date.parse(request.expiresAt)>end)throw Error();
  if(request.installationId!==selected.installationId||request.projectId!==selected.projectId||request.executionId!==selected.executionId||
   request.executionGeneration!==Number(selected.executionGeneration)||request.publicKeyFingerprint!==selected.publicKeyFingerprint)throw Error();
  for(const prefix of ['registration','observer','preparation'] as const){
   const ref=request[`${prefix}Ref`];
   if(ref.id!==selected[`${prefix}Id`]||ref.version!==Number(selected[`${prefix}Version`])||ref.contentHash!==selected[`${prefix}Hash`])throw Error();
  }
  const process=envelope.processRef;
  if(!recordV1(process,['runId','generation','jobId','pid','startTicks','executableHash'])||process.runId!==selected.runId||
   process.generation!==Number(selected.processGeneration)||process.executableHash!==selected.workerHash)throw Error();
  if(typeof process.startTicks!=='string'||! /^[1-9][0-9]{0,18}$/.test(process.startTicks)||!Number.isInteger(process.pid)||process.pid<1||process.pid>4294967295)throw Error();
  const ticks=BigInt(process.startTicks),epochOffset=11644473600000n;
  // C# DateTime의 100ns는 JSON UTC에서 ms 내림된다. 관측 ms의 마지막 tick까지 허용한다.
  if(ticks>2650467743999999999n||ticks<(BigInt(issued)+epochOffset)*10000n||ticks>=(BigInt(observed)+epochOffset+1n)*10000n)throw Error();
  const facts=envelope.facts;
  if(!recordV1(facts,['processRef','state','everResumed','active','processes','killOnClose','fileSandboxVerified'])||
   facts.active!==1||!Array.isArray(facts.processes)||facts.processes.length!==1)throw Error();
  const result=buildOwnershipObservationPayloadSource(request,envelope.facts,process,envelope.observedAt);
  if(Date.now()<from||Date.now()>=Math.min(end,Date.parse(request.expiresAt))||performance.now()-started>=10000)throw Error();
  return result;
 }catch{throw new Error('OWNERSHIP_NATIVE_PREPARED_PAYLOAD_SOURCE_UNAVAILABLE');}
}
