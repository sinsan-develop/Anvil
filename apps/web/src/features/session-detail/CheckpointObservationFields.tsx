import {emptyCheckpointObservations,type CheckpointObservationForm,type CheckpointReferenceForm} from './checkpoint-observation-input.ts';
/** 기록은 사용자 선언이며 실제 로컬 관측이 아니다. */
export function CheckpointObservationFields({value,onChange}:{value?:CheckpointObservationForm;onChange:(value:CheckpointObservationForm)=>void}){
 const v=value??emptyCheckpointObservations(),change=(key:'lastLocalSequence'|'ackSequence',text:string)=>onChange({...v,[key]:text});
 function refChange(index:number|null,next:CheckpointReferenceForm){if(index===null)onChange({...v,ackRef:next});else onChange({...v,executionRefs:v.executionRefs.map((r,i)=>i===index?next:r)});}
 return <fieldset><legend>관측 순번·실행 참조 기록</legend><p>비어 있는 순번은 미확인입니다. 0은 확인한 값으로 직접 입력한 경우만 기록하세요. 아래 값은 사용자 선언이며 실제 로컬/서버의 현재 사실·쓰기 회수·재개를 인증하지 않습니다.</p>
 <label>로컬 마지막 순번<input inputMode="numeric" maxLength={16} value={v.lastLocalSequence} onChange={e=>change('lastLocalSequence',e.target.value)}/></label>
 <label>서버 연속 수신 순번<input inputMode="numeric" maxLength={16} value={v.ackSequence} onChange={e=>change('ackSequence',e.target.value)}/></label>
 <ReferenceFields label="ACK" value={v.ackRef} onChange={r=>refChange(null,r)}/><p>양수 ACK에는 정확한 참조가 필요합니다. 0의 참조도 보존하며, 참조가 없다는 사실을 실제 미수신 증명으로 사용하지 않습니다.</p>
 {v.executionRefs.map((r,i)=><div key={i}><ReferenceFields label={'실행 '+(i+1)} value={r} onChange={next=>refChange(i,next)}/><button type="button" onClick={()=>onChange({...v,executionRefs:v.executionRefs.filter((_,n)=>i!==n)})}>{'실행 '+(i+1)+' 참조 제거'}</button></div>)}
 <button type="button" disabled={v.executionRefs.length>=200} onClick={()=>onChange({...v,executionRefs:[...v.executionRefs,{id:'',version:'',contentHash:''}]})}>실행 참조 추가</button><p>보관 관측 조회의 원문에서 참조를 대조해 입력할 수 있습니다. 이 입력은 해당 원장의 존재/소유·진위를 검증하지 않으며 기존 기록을 자동 채우거나 덮어쓰지 않습니다.</p>
 </fieldset>;
}
function ReferenceFields({label,value,onChange}:{label:string;value:CheckpointReferenceForm;onChange:(value:CheckpointReferenceForm)=>void}){
 return <fieldset><legend>{label+' 참조'}</legend>{([['id','ID',36],['version','버전',16],['contentHash','SHA-256',64]] as const).map(([key,name,length])=><label key={key}>{label+' '+name}<input value={value[key]} maxLength={length} inputMode={key==='version'?'numeric':'text'} onChange={e=>onChange({...value,[key]:e.target.value})}/></label>)}</fieldset>;
}
