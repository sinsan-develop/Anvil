import {ApiClient,ApiError} from '../../api/client.ts';import {readMethodApplicationRef} from '../methodology-editor/project-api.ts';import {readWorkspaceMethodology} from '../workspace/api.ts';import {getPinnedForm} from '../methodologies/forms-api.ts';import {readDocumentStageOptions,sameStageRef} from './stage-api.ts';import {documentControl,newDocument,type DocumentSession} from './editor-api.ts';import type {PlanRef} from './work-plan-api.ts';import {ordered} from '../knowledge/review-view.ts';
export interface StageDocumentChoice{projectId:string;userId:string;clientId:string;applicationRef:PlanRef;nodeId:string;itemId:string;formRef:PlanRef}
export type StageDocumentScope=Pick<StageDocumentChoice,'applicationRef'|'nodeId'>;
// 요청 객체나 전송 포트는 화면 버퍼에 복사하지 않는다.
const origins=new WeakMap<object,{choice:StageDocumentChoice;client:ApiClient;transport:ApiClient['transport'];csrf:DocumentSession['csrfToken']}>();
export function preparedOnClient(draft:object,choice:StageDocumentChoice,client:ApiClient,session:DocumentSession){
 const origin=origins.get(draft);return origin?.choice===choice&&origin.client===client&&origin.transport===client.transport&&origin.csrf===session.csrfToken;
}
export function discardPreparedOutput(draft:object){origins.delete(draft);}
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const ref=(v:PlanRef)=>v&&Object.keys(v).sort().join(',')==='contentHash,id,version'&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&typeof v.contentHash==='string'&&/^[0-9a-f]{64}$/.test(v.contentHash);
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
const text=(v:unknown)=>typeof v==='string'&&!!v.trim()&&v.length<=200&&v.isWellFormed()&&!/[\u0000-\u001f\u007f]/.test(v);
export async function readStageDocumentApplication(client:ApiClient,projectId:string,active:()=>boolean,scope?:StageDocumentScope){
 if(scope&&(!ref(scope.applicationRef)||!text(scope.nodeId)))throw new ApiError('STAGE_DOCUMENT_CHOICE_INVALID');
 const expected=scope?structuredClone(scope):undefined;
 const check=()=>{if(!active())throw new ApiError('STAGE_DOCUMENT_PREPARATION_PAUSED');};check();const current=await readMethodApplicationRef(client,projectId);check();const value=await readWorkspaceMethodology(client,projectId,current);check();
 if(value.snapshot&&(value.snapshot.graph.nodes.length>200||value.snapshot.graph.nodes.some(n=>n.outputs.length>200)||value.snapshot.graph.nodes.reduce((n,v)=>n+v.outputs.length,0)>1000))throw new ApiError('STAGE_DOCUMENT_DISPLAY_LIMIT');
 if(expected&&(!same(value.applicationRef,expected.applicationRef)||!value.snapshot||value.snapshot.graph.nodes.filter(n=>n.nodeId===expected.nodeId).length!==1))throw new ApiError('STAGE_DOCUMENT_APPLICATION_CHANGED');return value;
}
/** 읽기와 로컬 초안 준비뿐이다. 저장·승인 요청/사용·문서 생성은 별도 명시 명령이다. */
export async function prepareStageDocumentDraft(client:ApiClient,selection:StageDocumentChoice,session:DocumentSession,active:()=>boolean){
 if(!selection||![selection.projectId,selection.userId,selection.clientId].every(uuid)||!ref(selection.applicationRef)||!ref(selection.formRef)||!text(selection.nodeId)||!text(selection.itemId)||selection.userId!==session?.user?.id||selection.clientId!==session?.clientId)throw new ApiError('STAGE_DOCUMENT_CHOICE_INVALID');
 const chosen=structuredClone(selection),actor=structuredClone(session),transport=client.transport;
 const current=()=>active()&&client.transport===transport&&actor.user.id===session.user.id&&actor.clientId===session.clientId&&actor.csrfToken===session.csrfToken;
 const check=()=>{if(!current())throw new ApiError('STAGE_DOCUMENT_PREPARATION_PAUSED');};
 const value=await readStageDocumentApplication(client,chosen.projectId,current);check();if(!same(value.applicationRef,chosen.applicationRef)||!value.snapshot)throw new ApiError('STAGE_DOCUMENT_APPLICATION_CHANGED');
 const nodes=value.snapshot.graph.nodes.filter(n=>n.nodeId===chosen.nodeId),node=nodes[0];if(nodes.length!==1||!node||node.outputs.filter(i=>i.itemId===chosen.itemId&&same(i.formRef,chosen.formRef)).length!==1)throw new ApiError('STAGE_DOCUMENT_OUTPUT_CHANGED');
 const form=await getPinnedForm(client,chosen.formRef);check();const options=await readDocumentStageOptions(client,chosen.projectId,chosen.formRef);check();const stage={applicationId:chosen.applicationRef.id,nodeId:chosen.nodeId};
 if(!same(options.applicationRef,chosen.applicationRef)||options.items.filter(i=>sameStageRef(i.stageNodeRef,stage)&&i.uses.includes('OUTPUT')).length!==1)throw new ApiError('STAGE_DOCUMENT_OUTPUT_CHANGED');
 const control=await documentControl(client,chosen.projectId,actor);check();
 const preparedStageOutput=Object.freeze({...chosen,applicationRef:Object.freeze(chosen.applicationRef),formRef:Object.freeze(chosen.formRef),controlGeneration:control});
 const draft={...newDocument(chosen.projectId,form,chosen.userId,control),stageNodeRef:stage,preparedStageOutput,dirty:true};
 origins.set(draft,{choice:preparedStageOutput,client,transport,csrf:actor.csrfToken});
 return draft;
}
