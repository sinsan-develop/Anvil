import { useEffect,useId,useRef,useState,type PointerEvent } from 'react';
import type { MethodologyGraph } from '../../../../../contracts/methodologies.ts';

const previewCoordinate = (value: number) => Number.isFinite(value) ? Math.max(-1_000_000, Math.min(1_000_000, value)) : 0;
interface Drag {source:MethodologyGraph;nodeId:string;pointerId:number;startX:number;startY:number;clientX:number;clientY:number;inverse:DOMMatrix;element:SVGGElement}
export function MethodGraphCanvas({ graph, selectedId, onSelect, onMove, label = '방법론 공간형 흐름도' }: {
  graph: MethodologyGraph; selectedId: string; onSelect: (id: string) => void; onMove?: (id: string, dx: number, dy: number) => void; label?: string;
}) {
  const arrowId = useId(), [zoom, setZoom] = useState(1), [focus, setFocus] = useState(false);
  const gesture=useRef<Drag|null>(null),latest=useRef({graph,onMove});latest.current={graph,onMove};
  const [ghost,setGhost]=useState<{source:MethodologyGraph;nodeId:string;dx:number;dy:number;viewBox:string}|null>(null);
  function cancelDrag(){const d=gesture.current;gesture.current=null;setGhost(null);if(d)try{if(d.element.hasPointerCapture(d.pointerId))d.element.releasePointerCapture(d.pointerId);}catch{/* 이미 해제된 capture는 상태만 폐기한다. */}}
  useEffect(()=>{if(gesture.current&&(gesture.current.source!==graph||!onMove))cancelDrag();},[graph,onMove]);
  useEffect(()=>()=>{gesture.current=null;},[]);
  function startDrag(event:PointerEvent<SVGGElement>,nodeId:string){
    if(!onMove||gesture.current||event.button!==0||!event.isPrimary)return;
    const svg=event.currentTarget.ownerSVGElement,matrix=svg?.getScreenCTM();if(!svg||!matrix)return;
    const inverse=matrix.inverse(),p=new DOMPoint(event.clientX,event.clientY).matrixTransform(inverse);if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return;
    try{event.currentTarget.setPointerCapture(event.pointerId);}catch{return;}
    event.preventDefault();event.currentTarget.focus({preventScroll:true});gesture.current={source:graph,nodeId,pointerId:event.pointerId,startX:p.x,startY:p.y,clientX:event.clientX,clientY:event.clientY,inverse,element:event.currentTarget};
    setGhost({source:graph,nodeId,dx:0,dy:0,viewBox:svg.getAttribute('viewBox')!});onSelect(nodeId);
  }
  function dragDelta(event:PointerEvent<SVGGElement>){const d=gesture.current;if(!d||d.pointerId!==event.pointerId)return null;if(d.source!==latest.current.graph||!latest.current.onMove){cancelDrag();return null;}const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(d.inverse),dx=Math.round(p.x-d.startX),dy=Math.round(p.y-d.startY);if(!Number.isFinite(dx)||!Number.isFinite(dy)){cancelDrag();return null;}return{d,dx,dy};}
  function previewDrag(event:PointerEvent<SVGGElement>){const v=dragDelta(event);if(v)setGhost(p=>p?.source===v.d.source&&p.nodeId===v.d.nodeId?{...p,dx:v.dx,dy:v.dy}:p);}
  function finishDrag(event:PointerEvent<SVGGElement>){const v=dragDelta(event);if(!v)return;const move=latest.current.onMove,changed=Math.hypot(event.clientX-v.d.clientX,event.clientY-v.d.clientY)>=3;cancelDrag();if(move&&changed&&(v.dx||v.dy))move(v.d.nodeId,v.dx,v.dy);}
  if (graph.nodes.length > 200) return <p role="status">200단계를 넘는 그래프는 목록에서 편집하세요. 공간 미리보기만 제한하며 저장된 단계는 생략하거나 변경하지 않습니다.</p>;
  const points = graph.nodes.map(node => ({ ...node, x: previewCoordinate(node.position.x), y: previewCoordinate(node.position.y) }));
  const byId = new Map(points.map(node => [node.nodeId, node]));
  const activeGhost=ghost?.source===graph?ghost:null,renderPoints=points.map(node=>activeGhost?.nodeId===node.nodeId?{...node,x:node.x+activeGhost.dx,y:node.y+activeGhost.dy}:node),renderById=new Map(renderPoints.map(node=>[node.nodeId,node]));
  const minX = Math.min(0, ...points.map(node => node.x)) - 40, maxX = Math.max(320, ...points.map(node => node.x + 180)) + 40;
  const minY = Math.min(0, ...points.map(node => node.y)) - 40, maxY = Math.max(180, ...points.map(node => node.y + 72)) + 40;
  const width = maxX - minX, height = Math.max(300, maxY - minY), selected = byId.get(selectedId);
  const cx = focus && selected ? selected.x + 90 : (minX + maxX) / 2, cy = focus && selected ? selected.y + 36 : minY + height / 2;
  const hiddenEdges = graph.edges.filter(edge => !byId.has(edge.fromNodeId) || !byId.has(edge.toNodeId)).length;
  return <div className="graph-editor-view">
    <div className="methodology-flow"><button disabled={!!activeGhost} onClick={() => setZoom(value => Math.min(4, value * 1.25))}>흐름도 확대</button><button disabled={!!activeGhost} onClick={() => setZoom(value => Math.max(.25, value / 1.25))}>흐름도 축소</button><button disabled={!!activeGhost} onClick={() => { setZoom(1); setFocus(false); }}>흐름도 전체 보기</button><button disabled={!selected||!!activeGhost} onClick={() => { setFocus(true); setZoom(2); }}>선택 단계 중심 보기</button></div>
    <p className="meta">보기 {Math.round(zoom * 100)}% · 단계 선택 후 {onMove ? '드래그·이동 버튼 또는 방향키로 위치를 바꿀 수 있습니다. 드래그는 놓을 때 초안에 반영하고 Escape로 취소합니다.' : '상세를 확인하세요. 원본은 변경하지 않습니다.'}</p>
    {points.some(node => node.x !== node.position.x || node.y !== node.position.y) ? <p role="alert">너무 큰 좌표는 미리보기에서만 제한했습니다. 저장값은 변경하지 않습니다.</p> : null}
    {hiddenEdges ? <p role="alert">대상 단계가 없는 연결 {hiddenEdges}건은 그림에 그릴 수 없습니다. 저장 후 오류 위치를 확인하세요.</p> : null}
    <div className="graph-viewport"><svg role="group" aria-label={label} width={Math.min(1800, Math.max(640, width))} height="340" viewBox={activeGhost?.viewBox??`${cx - width / zoom / 2} ${cy - height / zoom / 2} ${width / zoom} ${height / zoom}`}>
      <defs><marker id={arrowId} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" className="graph-arrow" /></marker></defs>
      {graph.edges.map(edge => { const from = renderById.get(edge.fromNodeId), to = renderById.get(edge.toNodeId); if (!from || !to) return null;
        const x1 = from.x + 180, y1 = from.y + 36, x2 = to.x, y2 = to.y + 36;
        return <path key={edge.edgeId} d={`M${x1},${y1} C${x1 + 60},${y1} ${x2 - 60},${y2} ${x2},${y2}`} markerEnd={`url(#${arrowId})`} className={edge.kind === 'REWORK' ? 'graph-edge graph-rework' : 'graph-edge'}><title>{`${edge.kind}: ${edge.fromNodeId} → ${edge.toNodeId} ${edge.reason}`}</title></path>;
      })}
      {renderPoints.map(node => <g key={node.nodeId} role="button" tabIndex={0} aria-label={`흐름도 단계 ${node.nodeId}: ${node.name}`} aria-pressed={node.nodeId === selectedId} className="graph-node" transform={`translate(${node.x},${node.y})`} style={{touchAction:onMove?'none':undefined,cursor:onMove?'grab':undefined}} onPointerDown={event=>startDrag(event,node.nodeId)} onPointerMove={previewDrag} onPointerUp={finishDrag} onPointerCancel={cancelDrag} onLostPointerCapture={event=>{if(gesture.current?.pointerId===event.pointerId)cancelDrag();}} onClick={() => onSelect(node.nodeId)} onKeyDown={event => {
        if(event.key==='Escape'){event.preventDefault();cancelDrag();return;}if(gesture.current)cancelDrag();
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(node.nodeId); }
        const delta: Record<string, [number, number]> = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
        if (onMove && delta[event.key]) { event.preventDefault(); onSelect(node.nodeId); onMove(node.nodeId, ...delta[event.key]!); }
      }}><title>{`${node.nodeId} ${node.name}: ${node.purpose}`}</title><rect width="180" height="72" rx="8" /><text x="12" y="25">{Array.from(node.name || '이름 미작성').slice(0, 20).join('')}</text><text x="12" y="48" className="graph-node-meta">{node.nodeId} · {node.kind}</text></g>)}
    </svg></div>
    {onMove ? <div className="methodology-flow">{([['왼쪽', -20, 0], ['오른쪽', 20, 0], ['위', 0, -20], ['아래', 0, 20]] as const).map(([direction, dx, dy]) => <button key={direction} disabled={!selected} onClick={() => onMove(selectedId, dx, dy)}>선택 단계 {direction} 이동</button>)}</div> : null}
  </div>;
}
