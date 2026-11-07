import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {GraphRelationsEditor} from '../../../apps/web/src/features/methodology-editor/GraphRelationsEditor.tsx';
import {emptyMethodBuffer,type MethodBuffer} from '../../../apps/web/src/features/methodology-editor/common-api.ts';
import {importMethodDraft,readMethodDraftFile} from '../../../apps/web/src/features/methodology-editor/method-draft-import.ts';
import type {MethodologyGraph} from '../../../contracts/methodologies.ts';

const w=window as any;
const imported=importMethodDraft(emptyMethodBuffer(),'22222222-2222-4222-8222-222222222222',readMethodDraftFile(JSON.stringify(w.__duplicateEdgeSeed),'USER_COMMON'));
const qa=w.__duplicateEdgeQA={original:structuredClone(imported),buffer:imported,changes:[] as MethodologyGraph[],replace:null as null|((graph:MethodologyGraph)=>void)};
function Harness(){
 const [buffer,setBuffer]=useState<MethodBuffer>(imported);
 qa.buffer=buffer;
 qa.replace=(graph:MethodologyGraph)=>setBuffer(prior=>({...prior,graph}));
 // 실제 부모와 같이 graph만 교체해 나머지 미저장 초안 필드를 보존한다.
 return <GraphRelationsEditor graph={buffer.graph} onChange={graph=>{qa.changes.push(structuredClone(graph));setBuffer(prior=>({...prior,graph,dirty:true}));}}/>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
