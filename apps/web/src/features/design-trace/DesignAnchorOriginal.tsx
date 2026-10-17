import{useEffect,useMemo,useRef}from'react';
import{resolveDesignAnchor,type DesignAnchorContext,type DesignAnchorSelection}from'./design-anchor.ts';
const reasons={CONTEXT_CHANGED:'프로젝트·문서 버전 또는 원문 hash가 달라 선택을 해제했습니다.',INVALID_ANCHOR:'저장된 줄 위치 형식을 확인할 수 없습니다.',LINE_NOT_FOUND:'저장된 줄이 현재 원문에 없습니다.',DISPLAY_LIMIT:'위치 강조 한도 131072 UTF-16 단위·4000줄을 초과했습니다. 원문은 유지합니다.'};
export function DesignAnchorOriginal({body,context,selection,onClear}:{body:string;context:DesignAnchorContext;selection:DesignAnchorSelection|null;onClear:()=>void}){
 const {projectId,documentRef:{id,version,contentHash},bodyHash}=context,mark=useRef<HTMLElement|null>(null);
 const result=useMemo(()=>resolveDesignAnchor(body,{projectId,documentRef:{id,version,contentHash},bodyHash},selection),[body,projectId,id,version,contentHash,bodyHash,selection]);
 useEffect(()=>{if(result.kind==='READY'){mark.current?.focus({preventScroll:true});mark.current?.scrollIntoView({block:'center'});}},[result]);
 return <>
  {result.kind==='READY'?<p role="status">설계 원문 위치 · v{version} · {result.lineNumber}줄</p>:result.kind==='UNVERIFIED'?<p role="status">원문 위치 미확인 · {reasons[result.reason]} · 다른 줄로 대체하지 않습니다.</p>:null}
  {selection?<button onClick={onClear}>원문 위치 선택 해제</button>:null}
  <pre aria-label="문서 원문" className="document-original">{result.kind==='READY'?<>{result.before}<mark ref={mark} tabIndex={-1} aria-label="선택한 설계 원문 줄" style={{display:'inline-block',minWidth:'1ch',outline:'2px solid currentColor'}}>{result.line}</mark>{result.after}</>:body}</pre>
 </>;
}
