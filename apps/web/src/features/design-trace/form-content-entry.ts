import {ApiClient,ApiError} from '../../api/client.ts';
import {getPinnedForm} from '../methodologies/forms-api.ts';
import {verifyFormVersionIntegrity} from '../methodologies/form-version-read.ts';
import {documentControl,type DocumentBuffer,type DocumentSession} from './editor-api.ts';
import type {FormDefinition} from '../../../../server/modules/documents/forms.ts';
import type {VersionRef} from '../../../../../contracts/generated-types.ts';
export interface FormContentEntry {ref:VersionRef;form:FormDefinition;values:Record<string,string|Record<string,string>[]>;renderedBody:string}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function available(b:DocumentBuffer){return b.documentId===null&&b.baseVersion===0&&!b.pending&&!b.importState&&!b.importPreparationId&&!b.importCandidateRef&&!b.proposalState&&!b.designIndexState&&!b.workPlanState&&b.mediaType==='text/markdown;charset=utf-8';}
const invalid=()=>{throw new ApiError('FORM_ENTRY_INPUT_INVALID',422);};
function text(value:unknown):string{if(typeof value!=='string'||!value.isWellFormed()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)||value.length>2097152)return invalid();return value;}
function label(value:string){return text(value).replace(/[\\|[\]_*#`<>]/g,'\\$&').replace(/[\r\n]/g,' ');}
function cell(value:unknown){return text(value).replace(/\\/g,'\\\\').replace(/\|/g,'\\|').replace(/\r\n|\r|\n/g,'<br>');}
/** 새 빈 문서에만 항목 입력을 연다. 원문·API/DB 계약·확정 상태는 바꾸지 않는다. */
export async function prepareFormContentEntry(client:ApiClient,buffer:DocumentBuffer,session:DocumentSession,active:()=>boolean):Promise<DocumentBuffer|null>{
 if(!active())return null;
 if(!available(buffer)||buffer.body!==''||buffer.formEntry||buffer.content.sections.length||buffer.ownerUserId!==session.user.id)throw new ApiError('FORM_ENTRY_UNAVAILABLE',409);
 try{
  const generation=await documentControl(client,buffer.projectId,session);if(!active())return null;
  if(generation!==buffer.controlGeneration)throw new ApiError('CONTROL_GENERATION_CONFLICT',409);
  const form=await getPinnedForm(client,buffer.formRef);if(!active())return null;
  await verifyFormVersionIntegrity(form);if(!active())return null;
  if(!form.definition.items.length||form.definition.items.some(i=>i.valueType==='RECORDS'&&!i.fields.length))invalid();
  const entry:FormContentEntry={ref:structuredClone(form.ref),form:structuredClone(form.definition),values:Object.fromEntries(form.definition.items.map(i=>[i.itemId,i.valueType==='TEXT'?'':[]])),renderedBody:''};
  return{...buffer,formEntry:entry};
 }catch(cause){if(!active())return null;throw cause;}
}
/** 필드 입력은 기존 body/sections로 직렬화한다. 서버 저장은 기존 명시 저장만 사용한다. */
export function applyFormContentEntry(buffer:DocumentBuffer,entry:FormContentEntry):DocumentBuffer{
 const prior=buffer.formEntry;
 if(!available(buffer)||!prior||buffer.body!==prior.renderedBody||!same(buffer.formRef,prior.ref)||!same(entry.ref,prior.ref)||!same(entry.form,prior.form))throw new ApiError('FORM_ENTRY_UNAVAILABLE',409);
 const items=entry.form.items,keys=Object.keys(entry.values);
 if(keys.length!==items.length||items.some(i=>!Object.hasOwn(entry.values,i.itemId))||new Set(items.map(i=>i.itemId)).size!==items.length)invalid();
 const lines=['# '+label(entry.form.name),''],sections:{itemId:string;anchor:string}[]=[];
 for(const item of items){
  sections.push({itemId:item.itemId,anchor:'line:'+(lines.length+1)});lines.push('## '+label(item.itemId)+' '+label(item.title),'');
  const value=entry.values[item.itemId];
  if(item.valueType==='TEXT'){for(const line of text(value).split(/\r\n|\r|\n/))lines.push(line);lines.push('');}
  else{
   if(!Array.isArray(value)||value.length>200||!item.fields.length||new Set(item.fields.map(f=>f.fieldId)).size!==item.fields.length)invalid();
   lines.push('| '+item.fields.map(f=>cell(f.fieldId)).join(' | ')+' |','| '+item.fields.map(()=>'---').join(' | ')+' |');
   for(const row of value as Record<string,string>[]){
    if(!row||Array.isArray(row)||Object.keys(row).length!==item.fields.length||item.fields.some(f=>!Object.hasOwn(row,f.fieldId)))invalid();
    lines.push('| '+item.fields.map(field=>cell(row[field.fieldId])).join(' | ')+' |');
   }
   lines.push('');
  }
 }
 const body=lines.join('\n');if(new TextEncoder().encode(body).length>2097152)invalid();
 return{...buffer,formEntry:{...structuredClone(entry),renderedBody:body},body,content:{...buffer.content,sections},dirty:true,savedRef:null,failure:null};
}
