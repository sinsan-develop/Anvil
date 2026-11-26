import {ApiClient,ApiError} from '../../api/client.ts';
import {validRef} from '../connections/api.ts';
import {readTrace,type TraceEdge,type TraceRef} from '../design-trace/trace-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import {readAssignmentPlanOriginal} from './assignment-plan-original.ts';
import type {ArtifactTraceDetail} from './artifact-task-trace-api.ts';
import type {ReportedEvidenceArtifactView} from './reported-evidence-artifact.ts';
import type {SubmittedResultView} from './result-api.ts';

interface TraceMatch {
 target:TraceRef;
 title:string;
 artifactEdgeId:string;
 artifactEdgeHash:string;
 targetEdgeId:string;
 targetEdgeHash:string;
}
export type ReportedEvidenceTracePage={state:'MORE'|'FINISHED';matches:TraceMatch[]};
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
const invalid=():never=>{throw new ApiError('REPORTED_EVIDENCE_TRACE_BINDING_INVALID');};
const inconsistent=():never=>{throw new ApiError('REPORTED_EVIDENCE_TRACE_INCONSISTENT');};

async function selectedArtifact(detail:ArtifactTraceDetail,result:SubmittedResultView,evidence:ReportedEvidenceArtifactView):Promise<TraceRef>{
 const {scope,manifest}=result.snapshot,file=evidence.file,artifact=file?.artifactRef;
 if(evidence.bytesState!=='MATCHED_REGISTERED_BYTES'||!file||!artifact||!validRef(artifact)||artifact.version!==1||
  !validRef(result.ref)||!validRef(scope.executionRef)||!detail.confirmed||scope.projectId!==detail.projectId||
  evidence.projectId!==scope.projectId||file.projectId!==scope.projectId||file.sourceState!=='REGISTERED_BYTES_ONLY'||
  !same(evidence.resultRef,result.ref)||!same(file.resultRef,result.ref)||!same(scope.assignmentRef,detail.confirmed.ref)||
  !same(manifest.assignmentRef,scope.assignmentRef)||!same(manifest.executionRef,scope.executionRef)||
  !same(evidence.reported.ref,artifact)||evidence.reported.contentHash!==artifact.contentHash||
  !Array.isArray(manifest.artifactRefs)||!manifest.artifactRefs.every(validRef)||
  manifest.artifactRefs.filter(ref=>ref.id===artifact.id).length!==1||!manifest.artifactRefs.some(ref=>same(ref,artifact)))return invalid();
 const bytes=new TextEncoder().encode(ordered(result.snapshot));
 if(bytes.length>2*1024*1024)return invalid();
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 if(Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')!==result.ref.contentHash)return invalid();
 return {kind:'ARTIFACT',id:artifact.id,versionRef:artifact};
}

/** 진행은 명시 호출당 한 페이지다. 읽은 페이지가 프로젝트 전체의 스냅샷이거나 시험 출처라는 뜻은 아니다. */
export function createReportedEvidenceTrace(client:ApiClient,detail:ArtifactTraceDetail,result:SubmittedResultView,evidence:ReportedEvidenceArtifactView,active:()=>boolean){
 const selected=structuredClone(detail),report=structuredClone(result),verified=structuredClone(evidence),transport=client.transport;
 const current=()=>active()&&client.transport===transport;
 let binding:Awaited<ReturnType<typeof source>>=null,cursor:string|null=null,busy=false,finished=false;
 const seenCursors=new Set<string>();
 const seenEdges=new Set<string>();
 let artifactEdge:TraceEdge|null=null;
 const locations=new Map<string,{edge:TraceEdge;title:string}>();

 async function source(){
  const artifact=await selectedArtifact(selected,report,verified);
  if(!current())return null;
  const plan=await readAssignmentPlanOriginal(client,selected,current);
  if(!plan||!current())return null;
  const taskCode=selected.confirmed!.snapshot.definition.taskRef.taskCode;
  const card=plan.tasks.find(task=>task.taskCode===taskCode)!;
  const task:TraceRef={kind:'PLAN_TASK',id:plan.ref.id,versionRef:plan.ref,localCode:taskCode};
  const allowed=new Map<string,TraceRef>();
  for(const target of [...card.designRefs,...card.screenRefs]){
   const key=ordered([target.kind,target.id]);
   if(allowed.has(key))inconsistent();
   allowed.set(key,target);
  }
  return {artifact,task,allowed,designRef:plan.designRef};
 }

 async function next():Promise<ReportedEvidenceTracePage|null>{
  if(busy||finished||!current())return null;
  busy=true;
  try{
   binding??=await source();
   if(!binding||!current())return null;
   const {artifact,task,allowed,designRef}=binding;
   const page=await readTrace(client,selected.projectId,designRef,'REVERSE',cursor);
   if(!current())return null;
   if(page.nextCursor!==null&&(seenCursors.has(page.nextCursor)||page.edges.length===0))inconsistent();
   const nodes=new Map(page.nodes.map(node=>[ordered(node.ref),node]));
   for(const edge of page.edges){
    if(seenEdges.has(edge.id))inconsistent();
    seenEdges.add(edge.id);
    if(edge.relation!=='IMPLEMENTS')continue;
    if(same(edge.from,artifact)&&same(edge.to,task)){
     if(artifactEdge)inconsistent();
     artifactEdge=edge;
    }else if(same(edge.from,task)){
     const key=ordered([edge.to.kind,edge.to.id]),target=allowed.get(key),node=nodes.get(ordered(edge.to));
     if(!target)continue;
     if(!same(target,edge.to)||!node?.designRefs.some(ref=>same(ref,designRef))||
      (target.kind==='DESIGN_ITEM'&&!same(target.versionRef,designRef))||!node.title.trim()||locations.has(key))inconsistent();
     locations.set(key,{edge,title:node!.title});
    }
   }
   cursor=page.nextCursor;
   if(cursor!==null){
    seenCursors.add(cursor);
    return {state:'MORE',matches:[]};
   }
   finished=true;
   const proof=artifactEdge;
   return {state:'FINISHED',matches:proof?[...locations.values()].map(location=>({
    target:location.edge.to,title:location.title,artifactEdgeId:proof.id,artifactEdgeHash:proof.edgeHash,
    targetEdgeId:location.edge.id,targetEdgeHash:location.edge.edgeHash
   })):[]};
  }catch(error){
   finished=true;
   if(!current())return null;
   throw error;
  }finally{busy=false;}
 }
 return {next};
}
