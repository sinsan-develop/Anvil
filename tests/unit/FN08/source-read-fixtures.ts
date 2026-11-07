import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
export const a3Id=(n:number)=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
export const a3Ref=(n:number)=>({id:a3Id(n),version:1,contentHash:String(n%10).repeat(64)});
export const a3Now=Date.parse('2026-10-17T14:00:00.000Z');
export const a3At=(ms:number)=>new Date(a3Now+ms).toISOString();
export function sourceReadFixture(){
 const pathHint='D:\\Synthetic A3\\한글',targets=[{relativePath:'src/main.ts',kind:'FILE',access:'READ_ATTRIBUTES',recursive:false}];
 const request={sourceRootRef:a3Ref(1),connectorRef:a3Ref(2),registrationRef:a3Ref(3),targets,expiresAt:a3At(7200000),reason:'지정 파일 메타데이터 확인'};
 const scope={protocolVersion:1,purpose:'SOURCE_READ_OBSERVATION',installationId:a3Id(4),projectId:a3Id(5),sourceRootRef:request.sourceRootRef,connectorRef:request.connectorRef,registrationRef:request.registrationRef,pathHintHash:contentHash(pathHint),hostFingerprint:'a'.repeat(64),userId:a3Id(6),clientId:a3Id(7),credentialGeneration:2,controlGeneration:3,policyRef:a3Ref(8),targets,requestedAt:a3At(0),expiresAt:request.expiresAt,reason:request.reason};
 const scopeDigest=contentHash(canonicalJson(scope)),grantRef={...a3Ref(9),contentHash:scopeDigest},issuedAt=a3At(1000),expiresAt=a3At(301000);
 const permit={protocolVersion:1,grantRef,scopeDigest,scope,root:{sourceRootRef:scope.sourceRootRef,pathHint,pathHintHash:scope.pathHintHash},issuedAt,expiresAt,serverNow:a3At(2000),executionAuthorized:false,agentDispatchPerformed:false,baselineConfirmed:false};
 const preflight={protocolVersion:1,purpose:'SOURCE_READ_PREFLIGHT',installationId:scope.installationId,projectId:scope.projectId,connectorId:scope.connectorRef.id,registrationId:scope.registrationRef.id,connectorGeneration:scope.connectorRef.version,grantRef,scopeDigest,publicKeyFingerprint:scope.hostFingerprint,clientNonce:Buffer.alloc(32,1).toString('base64url'),expiresAt:scope.expiresAt};
 const challenge={...preflight,purpose:'SOURCE_READ_EXCHANGE',serverNonce:Buffer.alloc(32,2).toString('base64url'),issuedAt,expiresAt:a3At(121000)};
 const unsigned={protocolVersion:1,commandId:a3Id(10),grantRef,scopeDigest,connectorRef:scope.connectorRef,hostFingerprint:scope.hostFingerprint,observedAt:a3At(2000),finishedAt:a3At(3000),root:{state:'OBSERVED',facts:{declaredRootRef:scope.sourceRootRef,kind:'DIRECTORY',canonicalPath:pathHint,volumeSerialHex:'0123456789abcdef',fileIdHex:'1'.repeat(32),reparse:false},reasonCode:null},files:[{relativePath:'src/main.ts',state:'OBSERVED',facts:{kind:'REGULAR_FILE',volumeSerialHex:'0123456789abcdef',fileIdHex:'2'.repeat(32),sizeBytesDecimal:'18446744073709551615',lastWriteFileTimeDecimal:'133000000000000000',reparse:false},reasonCode:null}],localEvidence:{kind:'NATIVE_METADATA_REPORT',observerProtocolVersion:1,observerImageHash:'b'.repeat(64),ownedProcessRef:null}};
 const report={...unsigned,contentHash:contentHash(canonicalJson(unsigned)),signature:Buffer.alloc(64,3).toString('base64url')};
 const context={scope,grantRef,credentialIssuedAt:issuedAt,credentialExpiresAt:expiresAt,receivedAt:a3At(4000)};
 return{request,scope,scopeDigest,grantRef,permit,preflight,challenge,report,context};
}
export function rehashReport(report:any){const {contentHash:_,signature,...unsigned}=report;return{...unsigned,contentHash:contentHash(canonicalJson(unsigned)),signature};}
