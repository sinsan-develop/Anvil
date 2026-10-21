import {ApiClient,ApiError} from '../../api/client.ts';
import {getPinnedForm} from '../methodologies/forms-api.ts';
import {verifyFormVersionIntegrity} from '../methodologies/form-version-read.ts';
import {documentControl,newDocument,type DocumentSession} from './editor-api.ts';
import type {VersionRef} from '../../../../../contracts/generated-types.ts';
function label(value:string){if(typeof value!=='string'||!value.trim()||!value.isWellFormed()||/[\u0000-\u001f\u007f]/.test(value))throw new ApiError('FORM_OUTLINE_UNSUPPORTED');return value.replace(/[\\|[\]_*#`<>]/g,'\\$&');}
/** 정확 양식의 빈 항목만 로컬에 만든다. 내용 작성·저장·내용검토/확정·Agent 호출이 아니다. */
export async function prepareFormDocumentOutline(client:ApiClient,projectId:string,ref:VersionRef,session:DocumentSession,active:()=>boolean){
 if(!active())return null;const selected=structuredClone(ref);
 try{
  const generation=await documentControl(client,projectId,session);if(!active())return null;
  const form=await getPinnedForm(client,selected);if(!active())return null;
  await verifyFormVersionIntegrity(form);if(!active())return null;
  if(!form.definition.items.length)throw new ApiError('FORM_OUTLINE_UNSUPPORTED');
  const draft=newDocument(projectId,form,session.user.id,generation),lines=['# '+label(form.definition.name),''],sections:{itemId:string;anchor:string}[]=[];
  for(const item of form.definition.items){
   if(sections.some(s=>s.itemId===item.itemId))throw new ApiError('FORM_OUTLINE_UNSUPPORTED');
   sections.push({itemId:item.itemId,anchor:'line:'+(lines.length+1)});lines.push('## '+label(item.itemId)+' '+label(item.title),'');
   if(item.valueType==='RECORDS'){
    if(!item.fields.length)throw new ApiError('FORM_OUTLINE_UNSUPPORTED');
    lines.push('| '+item.fields.map(f=>label(f.title)).join(' | ')+' |','| '+item.fields.map(()=>'---').join(' | ')+' |','| '+item.fields.map(()=>'').join(' | ')+' |','');
   }
  }
  const body=lines.join('\n');if(new TextEncoder().encode(body).length>2097152)throw new ApiError('FORM_OUTLINE_UNSUPPORTED');
  return{...draft,title:form.definition.name,body,content:{...draft.content,sections},dirty:true};
 }catch(cause){if(!active())return null;throw cause;}
}
