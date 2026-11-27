import {ApiClient,ApiError} from '../../api/client.ts';
import {readTrace,type TraceRef} from '../design-trace/trace-api.ts';
import type {PlanRef,WorkPlanView} from '../design-trace/work-plan-api.ts';
import {ordered} from '../knowledge/review-view.ts';

const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
const invalid=():never=>{throw new ApiError('ASSIGNMENT_TRACE_PAGE_INVALID');};

export function assignmentPlanDesignTrace(client:ApiClient,projectId:string,plan:WorkPlanView,taskCode:string,designRef:PlanRef,current:()=>boolean){
 const card=plan.tasks.find(task=>task.taskCode===taskCode);
 if(!card||plan.relationalProjection!=='STORED'||!same(plan.designRef,designRef))return invalid();
 const task:TraceRef={kind:'PLAN_TASK',id:plan.ref.id,versionRef:plan.ref,localCode:taskCode};
 const allowed=new Set([...card.designRefs,...card.screenRefs].map(ordered));
 const cursors=new Set<string>(),edges=new Set<string>();
 const matches=new Map<string,{edgeId:string;edgeHash:string;target:TraceRef;title:string}>();
 let cursor:string|null=null,finished=false;

 return async()=>{
  if(finished||!current())return null;
  try{
   const page=await readTrace(client,projectId,designRef,'REVERSE',cursor);
   if(!current())return null;
   if(page.nextCursor!==null&&(cursors.has(page.nextCursor)||!page.edges.length))return invalid();
   const nodes=new Map(page.nodes.map(node=>[ordered(node.ref),node]));
   for(const edge of page.edges){
    if(edges.has(edge.id))return invalid();
    edges.add(edge.id);
    // REVERSE affects traversal display. The stored edge still points from the task to the design or screen.
    const target=edge.to, key=ordered(target);
    if(edge.relation!=='IMPLEMENTS'||!same(edge.from,task)||!allowed.has(key))continue;
    if(target.kind!=='DESIGN_ITEM'&&target.kind!=='SCREEN_REGION'||target.kind==='DESIGN_ITEM'&&!same(target.versionRef,designRef))continue;
    const node=nodes.get(key);
    if(!node?.title.trim()||!node.designRefs.some(ref=>same(ref,designRef))||matches.has(key))return invalid();
    matches.set(key,{edgeId:edge.id,edgeHash:edge.edgeHash,target,title:node.title});
   }
   cursor=page.nextCursor;
   if(cursor!==null)cursors.add(cursor);
   finished=cursor===null;
   return {matches:[...matches.values()],hasMore:page.hasMore};
  }catch(cause){
   finished=true;
   if(!current())return null;
   throw cause;
  }
 };
}
