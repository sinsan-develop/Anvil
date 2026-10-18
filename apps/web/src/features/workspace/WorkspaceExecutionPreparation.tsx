import { useEffect, useRef, useState } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import type { DocumentSession } from '../design-trace/editor-api.ts';
import { readCurrentBaseline } from '../project-create/baseline-api.ts';
import { readSourceRoot, type RootView } from '../connections/source-roots-api.ts';
import { readSourceReadSnapshot, type SourceReadSnapshotView } from '../connections/source-read-api.ts';
import { applyAssignmentSourceSelection, type AssignmentBuffer } from './assignment-api.ts';

interface SourceSelection {baseline:any;root:RootView;observation:SourceReadSnapshotView}
/** exact 조회 자료만 선택한다. Agent 호출·경로 권한 발급·새 관측 실행을 하지 않는다. */
export function AssignmentSourceSelection({client,buffer,session,locked,update,run}:{client:ApiClient;buffer:AssignmentBuffer;session:DocumentSession;locked:boolean;update:(change:(value:AssignmentBuffer)=>AssignmentBuffer)=>void;run:(action:()=>Promise<void>)=>void}) {
  const [source,setSource]=useState<SourceSelection|null>(null),[selected,setSelected]=useState<Record<string,'READ'|'WRITE'>>({});
  const [notice,setNotice]=useState<string|null>(null),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  async function load() {
    setSource(null);setSelected({});setNotice(null);
    const baseline=await readCurrentBaseline(client,buffer.projectId);
    if(baseline.status!=='FEATURE_STATUS_V1'||!baseline.contentConfirmed||!baseline.currentContentReviewValid||baseline.currentCheck.state!=='MATCHED_METADATA') {
      if(alive.current)setNotice('현재 적합하게 확인한 기준선이 없습니다. 기준선 작성·검토·확정 후 다시 조회하세요.');return;
    }
    const binding=baseline.snapshot.input.source;
    if(binding.kind!=='ATTRIBUTE_REPORT'||!binding.sourceRootRef||!binding.snapshotRef||!binding.grantRef) {
      if(alive.current)setNotice('이 기준선에는 실제 소스 관측이 연결되지 않았습니다. 임의 파일 경로나 참조는 입력하지 않습니다.');return;
    }
    const [root,observation]=await Promise.all([
      readSourceRoot(client,buffer.projectId,binding.sourceRootRef.id,binding.sourceRootRef.version),
      readSourceReadSnapshot(client,buffer.projectId,binding.snapshotRef,binding.grantRef),
    ]);
    if(!root.rawAllowed||!observation.rawAllowed||root.headVersion!==root.ref.version||root.status!=='DECLARED'||observation.report.root.state!=='OBSERVED')throw new ApiError('ASSIGNMENT_SOURCE_SELECTION_INVALID');
    if(alive.current)setSource({baseline,root,observation});
  }
  function apply() {
    if(locked||!source)return;
    const files=Object.entries(selected).map(([relativePath,access])=>({relativePath,access}));
    applyAssignmentSourceSelection(buffer,session,source.baseline,source.root,source.observation,files,update);
    setNotice('선택 범위 반영을 요청했습니다. 아래 실제 초안 범위를 확인하세요. 그 사이 입력이 바뀌면 기존 입력을 보존하며, 저장·실행 허가는 별도입니다.');
  }
  const files=source?.observation.rawAllowed?source.observation.report.files.filter(file=>file.state==='OBSERVED'):[];
  return <section aria-label="임무 소스 범위 선택"><h5>임무 소스 범위</h5>
    <button type="button" disabled={locked} onClick={()=>run(load)}>현재 기준선·소스 관측 조회</button>
    {notice?<p role="status">{notice}</p>:null}
    {source?<><p>기준선 v{source.baseline.ref.version} · 관측 {source.observation.snapshotRef.id}<br/>현재 권한·OS 소유는 미검증입니다. READ와 WRITE를 각각 명시합니다.</p>
      {files.length?<ul>{files.map(file=><li key={file.relativePath}><label><input type="checkbox" disabled={locked} checked={Object.hasOwn(selected,file.relativePath)} onChange={event=>setSelected(previous=>{if(event.target.checked)return {...previous,[file.relativePath]:'READ'};const next={...previous};delete next[file.relativePath];return next;})}/>{file.relativePath}</label>
        {Object.hasOwn(selected,file.relativePath)?<label>{file.relativePath} 임무 접근<select disabled={locked} value={selected[file.relativePath]} onChange={event=>setSelected(previous=>({...previous,[file.relativePath]:event.target.value as 'READ'|'WRITE'}))}><option value="READ">READ</option><option value="WRITE">WRITE</option></select></label>:null}
      </li>)}</ul>:<p>선택할 수 있는 정상 관측 파일이 없습니다.</p>}
      <button type="button" disabled={locked||!Object.keys(selected).length} onClick={()=>run(async()=>apply())}>선택 파일을 임무 초안에 반영</button>
    </>:null}
    {buffer.input.definition.allowedScopes.length?<pre aria-label="선택한 임무 소스 범위">{JSON.stringify(buffer.input.definition.allowedScopes,null,2)}</pre>:<p>범위 미선택 · 빈 범위를 임의 허가로 바꾸지 않습니다.</p>}
  </section>;
}
