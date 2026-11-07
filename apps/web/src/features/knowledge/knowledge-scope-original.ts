import {ApiClient,ApiError} from '../../api/client.ts';
import {readKnowledge} from './api.ts';
import {validKnowledgeScope} from './knowledge-scope.ts';
import type {KnowledgeStageRef,KnowledgeTaskRef} from '../../../../server/modules/knowledge/knowledge-entry.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {readWorkPlan} from '../design-trace/work-plan-api.ts';
import {readWorkspaceProject,readWorkspaceMethodology} from '../workspace/api.ts';
import {ordered} from './review-view.ts';
export type KnowledgeScopeSource={kind:'STAGE';reference:KnowledgeStageRef}|{kind:'TASK';reference:KnowledgeTaskRef};
export interface KnowledgeScopeSelection{projectId:string;knowledgeRef:PlanRef;source:KnowledgeScopeSource}
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
const exact=(v:unknown,keys:string[]):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
/** 기존 허용 GET만 소비한다. 과거 단계의 새 endpoint/현재본 치환이나 자동 적용은 하지 않는다. */
export async function readKnowledgeScopeOriginal(client:ApiClient,input:KnowledgeScopeSelection,active:()=>boolean){
 if(!active())return null;
 const selection=structuredClone(input),{projectId,knowledgeRef,source}=selection;
 if(!exact(selection,['projectId','knowledgeRef','source'])||!exact(source,['kind','reference'])||!['STAGE','TASK'].includes(source.kind)||!validKnowledgeScope({projectId,stageRefs:source.kind==='STAGE'?[source.reference]:[],taskRefs:source.kind==='TASK'?[source.reference]:[]},projectId,'FACT'))throw new ApiError('KNOWLEDGE_SCOPE_INVALID');
 try{
  const knowledge=await readKnowledge(client,projectId,knowledgeRef);if(!active())return null;
  const refs=source.kind==='STAGE'?knowledge.entry.scope.stageRefs:knowledge.entry.scope.taskRefs;
  if(!refs.some(r=>same(r,source.reference)))throw new ApiError('KNOWLEDGE_SCOPE_NOT_SELECTED');
  const authority={executionAuthorized:false as const,dispatchPerformed:false as const};
  if(source.kind==='TASK'){
   const plan=await readWorkPlan(client,projectId,source.reference.planRef);if(!active())return null;
   const matches=plan.tasks.filter(t=>t.taskCode===source.reference.taskCode);
   if(matches.length!==1)throw new ApiError(matches.length?'KNOWLEDGE_SCOPE_AMBIGUOUS':'KNOWLEDGE_SCOPE_NOT_FOUND');
   return{kind:'TASK' as const,ref:structuredClone(plan.ref),task:structuredClone(matches[0]!),status:plan.status,...authority};
  }
  const project=await readWorkspaceProject(client,projectId);if(!active())return null;
  if(!same(project.currentMethodologyRef,source.reference.applicationRef))throw new ApiError('KNOWLEDGE_SCOPE_ORIGINAL_NOT_CURRENT');
  const method=await readWorkspaceMethodology(client,projectId,source.reference.applicationRef);if(!active())return null;
  const nodes=method.snapshot?.graph.nodes.filter(node=>node.nodeId===source.reference.nodeId)??[];
  if(nodes.length!==1||!method.applicationRef)throw new ApiError('KNOWLEDGE_SCOPE_NOT_FOUND');
  return{kind:'STAGE' as const,ref:structuredClone(method.applicationRef),name:method.snapshot!.name,node:structuredClone(nodes[0]!),...authority};
 }catch(e){if(!active())return null;throw e;}
}
