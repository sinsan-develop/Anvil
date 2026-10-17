import {AuthFailure} from '../access/repository.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';

export interface HostTrustRegistrationInput {kind:'HOST_TRUST_REGISTRATION';hostLabel:string;expectedHostFingerprint:string;policyRef:VersionRef;expiresAt:string;reason:string}
export interface HostTrustConfirmationInput {registrationId:string;observedHostFingerprint:string;scopeDigest:string;decision:'APPROVE'|'REJECT';reason:string}
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const exact=(value:unknown,keys:string):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys.split(',').sort().join(',');
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&!!value.trim()&&value.length<=max&&value.isWellFormed()&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
function sensitive(values:string[]){if(inspectArtifact(Buffer.from(values.join('\n'),'utf8')).state==='SUSPECTED')throw new AuthFailure('CONNECTOR_REGISTRATION_SENSITIVE_CONTENT_SUSPECTED',412);}
export function readHostTrustRegistration(value:unknown,now:Date):HostTrustRegistrationInput {
 if(!(now instanceof Date)||!Number.isFinite(now.getTime())||!Number.isSafeInteger(now.getTime()+600000))throw new AuthFailure('CONNECTOR_REGISTRATION_POLICY_REQUIRED',412);
 if(!exact(value,'kind,hostLabel,expectedHostFingerprint,policyRef,expiresAt,reason')||value.kind!=='HOST_TRUST_REGISTRATION'||!text(value.hostLabel,200)||/[\r\n\t]/.test(value.hostLabel)||!text(value.reason,20000)||!hash(value.expectedHostFingerprint)||!isVersionRef(value.policyRef)||typeof value.expiresAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.expiresAt)||!Number.isFinite(Date.parse(value.expiresAt))||new Date(value.expiresAt).toISOString()!==value.expiresAt||Date.parse(value.expiresAt)<=now.getTime()||Date.parse(value.expiresAt)>now.getTime()+600000)throw new AuthFailure('CONNECTOR_REGISTRATION_INPUT_INVALID',422);
 sensitive([value.hostLabel,value.reason]);return structuredClone(value) as unknown as HostTrustRegistrationInput;
}
export function readHostTrustConfirmation(value:unknown):HostTrustConfirmationInput {
 if(!exact(value,'registrationId,observedHostFingerprint,scopeDigest,decision,reason')||!uuid(value.registrationId)||!hash(value.observedHostFingerprint)||!hash(value.scopeDigest)||(value.decision!=='APPROVE'&&value.decision!=='REJECT')||!text(value.reason,20000))throw new AuthFailure('CONNECTOR_CONFIRMATION_INPUT_INVALID',422);
 sensitive([value.reason]);return structuredClone(value) as unknown as HostTrustConfirmationInput;
}
