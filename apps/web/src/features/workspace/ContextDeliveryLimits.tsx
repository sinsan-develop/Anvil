type Limits={maxPartBytes:number;maxParts:number};
export function contextDeliveryLimitsValid(limits:Limits):boolean{
 return Number.isSafeInteger(limits.maxPartBytes)&&limits.maxPartBytes>=1&&limits.maxPartBytes<=2097152&&Number.isSafeInteger(limits.maxParts)&&limits.maxParts>=1&&limits.maxParts<=200;
}
export function ContextDeliveryLimits({limits,disabled,onChange}:{limits:Limits;disabled:boolean;onChange:(value:Limits)=>void}){
 function change(field:keyof Limits,value:string){if(disabled)return;const parsed=Number(value);onChange({...limits,[field]:Number.isFinite(parsed)?parsed:0});}
 return <fieldset disabled={disabled} aria-label="맥락 분할 한도"><legend>맥락 분할 준비 한도</legend>
  <label>부분 최대 UTF8 바이트<input type="number" aria-label="부분 최대 UTF8 바이트" min={1} max={2097152} step={1} value={limits.maxPartBytes} onChange={event=>change('maxPartBytes',event.target.value)}/></label>
  <label>최대 부분 수<input type="number" aria-label="최대 부분 수" min={1} max={200} step={1} value={limits.maxParts} onChange={event=>change('maxParts',event.target.value)}/></label>
  <p className="meta">원문 UTF8 바이트의 분할 준비값입니다 · 토큰·비용 한도 아님 · Agent 전달·실행 허가 아님</p>
  {!contextDeliveryLimitsValid(limits)?<p role="alert">부분 바이트는 1~2097152, 부분 수는 1~200의 정수로 입력하세요. 잘못된 한도는 저장하지 않습니다.</p>:null}
 </fieldset>;
}
