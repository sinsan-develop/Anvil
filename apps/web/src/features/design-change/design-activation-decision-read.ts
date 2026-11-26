import {ApiClient,ApiError} from '../../api/client.ts';
import {readApproval} from '../decisions/api.ts';
import {activationHash,activationRef,activationSame as same,readActivationInput,type ActivationCommand,type FixedActivation} from './activation-api.ts';

const fail=():never=>{throw new ApiError('DESIGN_ACTIVATION_DECISION_MISMATCH');};

/** 저장 당시 적용에 소비된 원 승인만 읽는다. 현재 승인·적용 가능성을 다시 판정하지 않는다. */
export async function readDesignActivationDecision(client:ApiClient,projectId:string,selection:FixedActivation,active:()=>boolean){
 const transport=client.transport,current=()=>active()&&client.transport===transport;
 if(!current())return null;
 const {snapshot,ref,projectId:storedProject}=structuredClone(selection);
 try{
  if(storedProject!==projectId||snapshot.projectId!==projectId||!activationRef(ref)||snapshot.purpose!=='DESIGN_BASELINE_ACTIVATION'||
   snapshot.activationId!==ref.id||snapshot.generation!==ref.version||await activationHash(snapshot)!==ref.contentHash)return fail();
  if(!current())return null;
  const approval=snapshot.approvalRef,baselineRefs=snapshot.previousActivationRef?[snapshot.previousActivationRef]:[];
  const {request,requestRef,decision,consumption,candidateActivation}=await readApproval(client,projectId,approval.requestId);
  if(!current())return null;
  const expectedScope={
   operation:'activateDesignChange',targetRef:snapshot.changeRef,expectedVersion:snapshot.changeRef.version,
   payloadHash:snapshot.candidatePayloadHash,baselineRefs,environmentRef:null,sourceScopes:[],limitsRef:null,
   requestedSubjectRef:snapshot.recordedBy,controlGeneration:snapshot.controlGeneration
  };
  if(!candidateActivation||!decision||!consumption||decision.decision!=='APPROVE'||decision.id!==approval.decisionId||
   decision.scopeDigest!==approval.scopeDigest||request.scopeDigest!==approval.scopeDigest||
   request.details.candidateCommandId!==snapshot.commandId||candidateActivation.candidateCommandId!==snapshot.commandId||
   !same(request.details.actionScope,expectedScope)||!same(request.policyRef,snapshot.policyRef)||
   !same(request.requestedBy,snapshot.recordedBy)||request.controlGeneration!==snapshot.controlGeneration||
   consumption.id!==snapshot.approvalConsumptionId||consumption.commandId!==snapshot.commandId||
   consumption.scopeDigest!==approval.scopeDigest||!same(consumption.policyRef,snapshot.policyRef))return fail();
  const input=readActivationInput(candidateActivation.payload);
  if(candidateActivation.payloadHash!==snapshot.candidatePayloadHash||!same(input.changeRef,snapshot.changeRef)||
   !same(input.impactRef,snapshot.impactRef)||!same(input.approvedDesignRef,snapshot.approvedDesignRef)||
   !same(input.confirmedPlanRef,snapshot.confirmedPlanRef))return fail();
  const command:ActivationCommand={
   schemaVersion:1,projectId,commandId:snapshot.commandId,clientId:snapshot.recordedBy.clientId,controlGeneration:snapshot.controlGeneration,
   operation:'activateDesignChange',targetId:snapshot.changeRef.id,expectedVersion:snapshot.changeRef.version,
   baselineRefs,approvalRef:approval,payload:candidateActivation.payload
  };
  if(await activationHash(command)!==consumption.requestHash)return fail();
  return current()?{requestRef,decisionRef:decision.ref,decisionReason:decision.reason,candidateReason:input.reason}:null;
 }catch(error){
  if(!current())return null;
  throw error;
 }
}
