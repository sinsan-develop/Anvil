import type {MethodologyGraph} from '../../../../../contracts/methodologies.ts';
/** 서버의 위치 문자열을 현재 원본에만 대조한다. 모호한 ID는 추측하지 않는다. */
export function methodIssueNodeTargets(graph:MethodologyGraph,location:string):{nodeId:string;name:string}[]{
 const points=(ids:string[])=>[...new Set(ids)].flatMap(id=>{const nodes=graph.nodes.filter(n=>n.nodeId===id);return nodes.length===1?[{nodeId:nodes[0]!.nodeId,name:nodes[0]!.name}]:[];});
 if(typeof location!=='string'||location.length>4096)return[];
 if(location==='entryNodeId')return points([graph.entryNodeId]);
 if(location==='terminalNodeIds')return points(graph.terminalNodeIds);
 const nodes=graph.nodes.filter(n=>location===`nodes.${n.nodeId}`||location.startsWith(`nodes.${n.nodeId}.`));
 if(nodes.length)return nodes.length===1?points([nodes[0]!.nodeId]):[];
 const edges=graph.edges.filter(e=>location===`edges.${e.edgeId}`||location.startsWith(`edges.${e.edgeId}.`));
 return edges.length===1?points([edges[0]!.fromNodeId,edges[0]!.toNodeId]):[];
}
