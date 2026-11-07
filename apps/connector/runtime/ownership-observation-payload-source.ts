import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {cloneV1} from '../../../contracts/runtime/validation-v1.ts';
import {readOwnershipObservationRequestV1,readOwnershipObservationV1,matchOwnershipObservationV1,matchOwnershipObservationFactsV1,ownershipObservationBytesV1} from '../../../contracts/runtime/ownership-observation-v1.ts';

/** unsigned 데이터 SOURCE 조립만. request/process는 caller 후보이고 실제 원출처/OS 진위를 증명하지 않는다.
 * 서명/키/권한/전송·서버 nonce 소비를 하지 않으며 실제 provider/route에 등록하지 않는다. */
export function buildOwnershipObservationPayloadSource(requestSourceValue:unknown,factsSourceValue:unknown,processSourceValue:unknown,observedAt:unknown){
 try{
  const from=Date.now(),started=performance.now();
  // own data descriptor를 쓰는 기존 canonical 복사로 입력 iterator/getter를 후속 검사에 전달하지 않는다.
  const request=readOwnershipObservationRequestV1(cloneV1(requestSourceValue)),facts=cloneV1(factsSourceValue),process=cloneV1(processSourceValue);
  const report=readOwnershipObservationV1({...request,factsHash:contentHash(canonicalJson(facts)),observedAt});
  matchOwnershipObservationV1(report,request,Date.now());
  const matched=matchOwnershipObservationFactsV1(report,facts,process);
  const result=Object.freeze({purpose:'OWNERSHIP_OBSERVATION_PAYLOAD_SOURCE_ONLY' as const,reportJson:canonicalJson(report),factsJson:canonicalJson(matched),
   unsignedBytesBase64:ownershipObservationBytesV1(report).toString('base64'),signature:null,
   serverRequestAuthenticated:false as const,nativeFactsVerified:false as const,signingAuthorized:false as const,executionAuthorized:false as const,dispatchPerformed:false as const});
  if(Date.now()<from||Date.now()>=Date.parse(request.expiresAt)||performance.now()-started>=10000)throw Error();return result;
 }catch{throw new Error('OWNERSHIP_OBSERVATION_PAYLOAD_SOURCE_UNAVAILABLE');}
}
