import type {ContextPreparationInput,ContextSlotCode,ContextSourceSelection} from '../../../../server/modules/context/context-input.ts';
import {ordered} from '../knowledge/review-view.ts';
export function contextSourceSelectionState(input:ContextPreparationInput,code:ContextSlotCode):'AVAILABLE'|'SLOT_FULL'|'TOTAL_FULL'|'SLOT_MISSING'{
 const slot=input.slots.find(value=>value.code===code);if(!slot)return'SLOT_MISSING';
 if((code==='PURPOSE_REASON'||code==='RULES_SCOPE')&&slot.sources.length>=1)return'SLOT_FULL';
 return input.slots.reduce((count,value)=>count+value.sources.length,0)>=200?'TOTAL_FULL':'AVAILABLE';
}
/** 이미 조회한 선택의 UI 상한만 집행한다. 원문 효력/권한/저장 적합은 기존 서버가 재검사한다. */
export function appendContextSourceSelection(input:ContextPreparationInput,code:ContextSlotCode,selection:ContextSourceSelection):ContextPreparationInput{
 const slot=input.slots.find(value=>value.code===code);if(!slot||slot.sources.some(value=>ordered(value)===ordered(selection)))return input;
 const allowed=selection.kind==='KNOWLEDGE_VERSION'&&code!=='LATEST_INSTRUCTIONS'||selection.kind==='DOCUMENT_VERSION'&&['CURRENT_POSITION','ACTUAL_GAPS','NEXT_ACTION'].includes(code)||selection.kind==='USER_INSTRUCTION'&&code==='LATEST_INSTRUCTIONS';
 if(!allowed||contextSourceSelectionState(input,code)!=='AVAILABLE')return input;
 const next=structuredClone(input);next.slots.find(value=>value.code===code)!.sources.push(structuredClone(selection));return next;
}
