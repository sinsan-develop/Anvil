import type {MethodologyGraph} from '../../../../../contracts/methodologies.ts';
const unverified=():never=>{throw Error('METHOD_DELETION_IMPACT_UNVERIFIED');};
function references(condition:unknown,nodeId:string):boolean{
 const queue:unknown[]=[condition],seen=new Set<object>();let count=0,found=false;
 while(queue.length){const value=queue.pop();if(value===null||value===undefined)continue;if(++count>10000||typeof value!=='object'||Array.isArray(value)||seen.has(value))return unverified();seen.add(value);
  if('fieldRef'in value){const ref=value.fieldRef;if(!ref||typeof ref!=='object'||!('nodeId'in ref)||typeof ref.nodeId!=='string')return unverified();found ||= ref.nodeId===nodeId;}
  else if('all'in value&&Array.isArray(value.all))queue.push(...value.all);
  else if('any'in value&&Array.isArray(value.any))queue.push(...value.any);
  else if('not'in value)queue.push(value.not);
  else return unverified();
 }
 return found;
}
/** 현재 초안의 구조상 영향만 계산한다. 삭제·저장·적용이나 의미상 영향 판정은 하지 않는다. */
export function nodeDeletionImpact(graph:MethodologyGraph,nodeId:string){
 const node=graph.nodes.find(n=>n.nodeId===nodeId);if(!node)return unverified();
 const removedEdges=graph.edges.filter(e=>e.fromNodeId===nodeId||e.toNodeId===nodeId),retainedReferences:string[]=[];
 for(const other of graph.nodes){if(other.nodeId===nodeId)continue;for(const direction of ['inputs','outputs']as const)for(const item of other[direction])if(item.sourceNodeId===nodeId)retainedReferences.push(`nodes.${other.nodeId}.${direction}.${item.itemId}`);
  if(references(other.joinRule?.condition,nodeId))retainedReferences.push(`nodes.${other.nodeId}.joinRule.condition`);
 }
 for(const edge of graph.edges)if(!removedEdges.includes(edge)&&references(edge.condition,nodeId))retainedReferences.push(`edges.${edge.edgeId}.condition`);
 return{nodeId:node.nodeId,nodeName:node.name,removesEntry:graph.entryNodeId===nodeId,removesTerminal:graph.terminalNodeIds.includes(nodeId),removedEdges:removedEdges.map(e=>({edgeId:e.edgeId,fromNodeId:e.fromNodeId,toNodeId:e.toNodeId})),removedDocuments:[...node.inputs.map(item=>({direction:'입력',itemId:item.itemId,required:item.required,formRef:item.formRef})),...node.outputs.map(item=>({direction:'산출',itemId:item.itemId,required:item.required,formRef:item.formRef}))],retainedReferences};
}
