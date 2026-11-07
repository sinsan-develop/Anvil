import {createElement,useMemo,useState} from 'react';
import {parseMarkdownPreview,type MarkdownPreviewBlock} from './markdown-preview.ts';
const textStyle={whiteSpace:'pre-wrap',overflowWrap:'anywhere'} as const;
function Block({block,index}:{block:MarkdownPreviewBlock;index:number}){
 if(block.kind==='HEADING')return createElement('h'+block.level,{style:textStyle},block.text);
 if(block.kind==='CODE')return <div><p className="meta">코드 블록{block.info?' · '+block.info:''} · 실행하지 않습니다.</p><pre style={textStyle}>{block.text}</pre></div>;
 if(block.kind==='LIST'){const items=block.items.map((item,n)=><li key={n} style={textStyle}>{item}</li>);return block.ordered?<ol start={block.start}>{items}</ol>:<ul>{items}</ul>;}
 if(block.kind==='QUOTE')return <blockquote style={textStyle}>{block.text}</blockquote>;
 if(block.kind==='TABLE')return <div style={{overflowX:'auto'}}><table aria-label={'Markdown 표 '+(index+1)} style={{borderCollapse:'collapse',width:'100%'}}><thead><tr>{block.headers.map((cell,n)=><th key={n} scope="col" style={{...textStyle,textAlign:block.align[n],padding:4,border:'1px solid currentColor'}}>{cell}</th>)}</tr></thead><tbody>{block.rows.map((row,n)=><tr key={n}>{row.map((cell,c)=><td key={c} style={{...textStyle,textAlign:block.align[c],padding:4,border:'1px solid currentColor'}}>{cell}</td>)}</tr>)}</tbody></table></div>;
 return <p style={textStyle}>{block.text}</p>;
}
export function DocumentMarkdownPreview({body,mediaType}:{body:string;mediaType:string}){
 const [open,setOpen]=useState(false),supported=mediaType==='text/markdown;charset=utf-8';
 const preview=useMemo(()=>open&&supported?parseMarkdownPreview(body):null,[body,open,supported]);
 if(!supported)return null;
 return <section aria-label="저장 Markdown 서식 조회"><button type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>Markdown 서식 미리보기 {open?'닫기':'열기'}</button>
  {open?<><p className="meta">제한된 서식 표시: 제목·문단·단순 목록·인용·코드 블록·표만 지원합니다. HTML·링크/이미지·inline 강조는 텍스트이며 실행/외부 조회하지 않습니다. 미리보기에서만 BOM/줄바꿈 표시를 정리하고 원문·설계 줄 위치·저장 상태는 바꾸지 않습니다.</p>
   {preview?.kind==='UNVERIFIED'?<p role="status">서식 미리보기 미확인 · 131072자/4000줄/2000블록/표50열·20000표시노드 한도 초과. 원문은 그대로 조회할 수 있습니다.</p>:preview?.kind==='READY'?<><section aria-label="Markdown 서식 미리보기 내용">{preview.blocks.map((block,index)=><Block key={index} block={block} index={index}/>)}</section>{preview.unclosedCode?<p role="status">닫히지 않은 코드 블록을 원문 끝까지 코드로 표시했습니다. 원문은 수정하지 않습니다.</p>:null}</>:null}
  </>:null}
 </section>;
}
