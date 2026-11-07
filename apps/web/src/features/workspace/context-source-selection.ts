import type {ContextPreparationInput,ContextSlotCode,ContextSourceSelection} from '../../../../server/modules/context/context-input.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {ContextPreparationBuffer} from './context-api.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
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

export function editableContextBuffer(current:ContextPreparationBuffer|null,rendered:ContextPreparationBuffer|null,session:DocumentSession):current is ContextPreparationBuffer{
 if(!current||!rendered)return false;
 const locked=(b:ContextPreparationBuffer)=>!!b.pending||b.uncertain||!!b.resultRef||!!b.result;
 return !locked(current)&&!locked(rendered)&&current.bindingId===rendered.bindingId&&current.projectId===rendered.projectId&&current.ownerUserId===session.user.id&&rendered.ownerUserId===session.user.id&&current.ownerClientId===session.clientId&&rendered.ownerClientId===session.clientId&&current.controlGeneration===rendered.controlGeneration&&ordered(current.assignmentRef)===ordered(rendered.assignmentRef)&&ordered(current.input.assignmentRef)===ordered(current.assignmentRef);
}
/** Recheck the live buffer after source selection, not only the rendered button.
 * Existing source-kind/count rules and immutable input ownership stay unchanged. */
export function appendContextSourceToBuffer(current:ContextPreparationBuffer|null,rendered:ContextPreparationBuffer|null,session:DocumentSession,code:ContextSlotCode,selection:ContextSourceSelection):ContextPreparationBuffer|null{
 if(!editableContextBuffer(current,rendered,session))return current;
 const input=appendContextSourceSelection(current.input,code,selection);
 return input===current.input?current:{...current,input,dirty:true,result:null};
}
/** Remove the clicked exact source, never a rendered index into a newer array.
 * Recheck the live buffer in the functional updater; no persistence/authority. */
export function removeContextSourceFromBuffer(current:ContextPreparationBuffer|null,rendered:ContextPreparationBuffer|null,session:DocumentSession,code:ContextSlotCode,selection:ContextSourceSelection):ContextPreparationBuffer|null{
 if(!editableContextBuffer(current,rendered,session))return current;
 const slots=current.input.slots.filter(slot=>slot.code===code);if(slots.length!==1)return current;
 const slot=slots[0]!,target=ordered(selection),matches=slot.sources.flatMap((source,index)=>ordered(source)===target?[index]:[]);
 // A stale/ambiguous selection is not permission to remove a neighbour.
 if(matches.length!==1)return current;
 const input=structuredClone(current.input);input.slots.find(slot=>slot.code===code)!.sources.splice(matches[0]!,1);
 return{...current,input,dirty:true,result:null};
}
