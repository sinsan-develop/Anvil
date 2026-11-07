import {verify} from 'node:crypto';
import {matchOwnershipObservationV1,matchOwnershipObservationFactsV1,ownershipObservationBytesV1} from '../../../../contracts/runtime/ownership-observation-v1.ts';
import {canonicalBase64,publicKeyFingerprint,readHostPublicKey} from '../connections/registration-proof.ts';
import {AuthFailure} from '../access/repository.ts';

/** No route/default provider registration. Callers must supply the ORIGINAL authenticated
 * server request, original process and currently valid registered SPKI, not caller echoes.
 * Cryptographic/shape verification alone does not consume a nonce or authenticate the OS,
 * current registration/head, preparation rights, writer or source sandbox. */
export function verifyOwnershipObservationProofV1(spki:unknown,signature:unknown,reportValue:unknown,expectedRequest:unknown,factsValue:unknown,expectedProcess:unknown,nowMs:number) {
 try {
  const report=matchOwnershipObservationV1(reportValue,expectedRequest,nowMs);
  const facts=matchOwnershipObservationFactsV1(report,factsValue,expectedProcess);
  const key=readHostPublicKey(spki),sig=canonicalBase64(signature,64);
  if(publicKeyFingerprint(spki)!==report.publicKeyFingerprint||!verify('sha256',ownershipObservationBytesV1(report),{key,dsaEncoding:'ieee-p1363'},sig))throw Error();
  return{purpose:'OWNERSHIP_SIGNATURE_ONLY' as const,report,facts,executionAuthorized:false as const,dispatchPerformed:false as const};
 }catch{throw new AuthFailure('OWNERSHIP_OBSERVATION_PROOF_INVALID',412);}
}
