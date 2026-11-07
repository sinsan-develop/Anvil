import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {ContextPreparationBuffer} from './context-api.ts';
import type {ContextSlotCode} from '../../../../server/modules/context/context-input.ts';
import {editableContextBuffer} from './context-source-selection.ts';
type Edit={kind:'PREPARATION_REASON';value:string}|{kind:'SLOT_REASON';code:ContextSlotCode;value:string}|{kind:'DELIVERY_LIMIT';field:'maxPartBytes'|'maxParts';value:number};
/** UI edits only. Protocol pending/result transitions must not use this gate.
 * Explicit limit field prevents stale render values replacing a different field. */
export function editContextPreparationBuffer(current:ContextPreparationBuffer|null,rendered:ContextPreparationBuffer|null,session:DocumentSession,edit:Edit):ContextPreparationBuffer|null{
 if(!editableContextBuffer(current,rendered,session))return current;
 if(edit.kind==='PREPARATION_REASON'){
  if(typeof edit.value!=='string'||edit.value.length>20000||current.input.reason===edit.value)return current;
  return{...current,input:{...current.input,reason:edit.value},dirty:true};
 }
 if(edit.kind==='SLOT_REASON'){
  if(typeof edit.value!=='string'||edit.value.length>20000)return current;
  const slots=current.input.slots.filter(s=>s.code===edit.code);if(slots.length!==1||slots[0]!.reason===edit.value)return current;
  return{...current,input:{...current.input,slots:current.input.slots.map(s=>s.code===edit.code?{...s,reason:edit.value}:s)},dirty:true};
 }
 if(edit.kind==='DELIVERY_LIMIT'){
  if(!['maxPartBytes','maxParts'].includes(edit.field)||typeof edit.value!=='number'||Object.is(current.input.limits[edit.field],edit.value))return current;
  // Temporary invalid numeric input remains visible; existing save/server checks
  // still reject it. Do not silently clamp, extend or weaken the original limits.
  return{...current,input:{...current.input,limits:{...current.input.limits,[edit.field]:edit.value}},dirty:true,result:null,failure:null};
 }
 return current;
}
