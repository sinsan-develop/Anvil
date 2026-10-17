import {useMemo} from 'react';
import {compareKnowledgeCorrection} from './correction-diff.ts';

interface Fields {title:string;body:string;reason:string}
const labels={UNCHANGED:'변경 없음',ADDED:'추가',REMOVED:'삭제',CHANGED:'변경'};
function FieldDiff({name,value}:{name:string;value:ReturnType<typeof compareKnowledgeCorrection>['title']}){
 return <section aria-label={`${name} 비교`}><h5>{name}</h5><p aria-label={`${name} 변경 상태`}>{labels[value.change]}</p>
  {value.change!=='UNCHANGED'?<><p>변경 전</p><pre aria-label={`${name} 변경 전`}>{value.before===''?<em>(빈 값)</em>:value.before}</pre><p>변경 후</p><pre aria-label={`${name} 변경 후`}>{value.after===''?<em>(빈 값)</em>:value.after}</pre></>:null}
 </section>;
}
export function KnowledgeCorrectionDiff({base,current,version}:{base:Fields;current:Fields;version:number}){
 const value=useMemo(()=>compareKnowledgeCorrection(base,current),[base.title,base.body,base.reason,current.title,current.body,current.reason]);
 const body=value.body;
 return <section aria-label="지식 정정 변경 비교"><h4>기준 v{version} 대비 현재 입력 비교</h4><p>비교는 저장·확정을 수행하지 않습니다. ‘지식 정정 사유’ 입력은 비교 대상과 별도로 보존합니다.</p>
  <FieldDiff name="제목" value={value.title}/><FieldDiff name="판단 이유" value={value.reason}/>
  <section aria-label="본문 비교"><h5>본문</h5><p aria-label="본문 변경 상태">{labels[body.change]}</p>
   {body.detail==='LIMITED'?<p aria-label="본문 상세 비교 제한">상세 비교 제한: {body.reason==='SIZE_LIMIT'?'한쪽 본문이 65,536 UTF-16 단위를 초과했습니다.':'한쪽 본문이 2,000줄을 초과했습니다.'} 원문과 편집 입력은 유지되며 변경 없음으로 판정하지 않습니다. 전체 원문은 위 입력에서 확인하세요.</p>:null}
   {body.detail==='FULL'&&body.diff?<><p>변경 구간 시작 {body.diff.startLine}줄 · 앞 동일 {body.diff.unchangedBefore}줄 / 뒤 동일 {body.diff.unchangedAfter}줄</p><p>삭제·대체 전</p><pre aria-label="본문 변경 전">{body.diff.before.length?body.diff.before.join(''):<em>(빈 값)</em>}</pre><p>추가·대체 후</p><pre aria-label="본문 변경 후">{body.diff.after.length?body.diff.after.join(''):<em>(빈 값)</em>}</pre></>:null}
  </section>
 </section>;
}
