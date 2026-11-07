import {canonicalJson} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1,cloneV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceScopesV1} from '../../../../contracts/runtime/source-scope-v1.ts';
import {nativeBytes,nativeSame,nativeInvalid,nativePositive} from '../../../../contracts/runtime/native-preparation-authority-v1.ts';
import {isApprovalRef} from '../approvals/approval-input.ts';
import type {ProjectCommand} from '../access/project-command.ts';
export function readNativePreparationCommand(raw:unknown):ProjectCommand{
 if(!recordV1(raw,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||raw.schemaVersion!==1||!uuidV1(raw.projectId)||!uuidV1(raw.commandId)||!uuidV1(raw.clientId)||!nativePositive(raw.controlGeneration)||raw.operation!=='prepareNativeBoundary'||raw.approvalRef!==null&&!isApprovalRef(raw.approvalRef)||!Array.isArray(raw.baselineRefs)||raw.baselineRefs.length!==1||nativeBytes(raw)>2097152)return nativeInvalid();
 const p=raw.payload;if(!recordV1(p,['registrationRef','nativeFactoryRef','sourceScopes','expectedWriterHeadRef','reason'])||![p.registrationRef,p.nativeFactoryRef,p.expectedWriterHeadRef].every(refV1)||typeof p.reason!=='string'||!p.reason.isWellFormed()||!p.reason.trim()||p.reason.length>20000||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(p.reason)||raw.targetId!==p.expectedWriterHeadRef.id||raw.expectedVersion!==p.expectedWriterHeadRef.version||!nativeSame(raw.baselineRefs,[p.expectedWriterHeadRef]))return nativeInvalid();readSourceScopesV1(p.sourceScopes);canonicalJson(raw);return cloneV1(raw) as unknown as ProjectCommand;
}
