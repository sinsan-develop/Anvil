import {ApiClient,ApiError} from '../../api/client.ts';
import type {BaselineBuffer} from './baseline-api.ts';
import {reference,uuid,type Ref} from './baseline-validation.ts';
import {readDocument} from '../design-trace/api.ts';
import {documentDraftHash,type DocumentContent,type DocumentSession} from '../design-trace/editor-api.ts';
import {getPinnedForm} from '../methodologies/forms-api.ts';
import {verifyFormVersionIntegrity} from '../methodologies/form-version-read.ts';
import {stageRef} from '../design-trace/stage-api.ts';
function editable(b:BaselineBuffer,s:DocumentSession,index:number){
 if(!b||![b.projectId,b.bindingId,s.user.id,s.clientId].every(uuid)||b.ownerUserId!==s.user.id||b.ownerClientId!==s.clientId||!Number.isSafeInteger(b.controlGeneration)||b.controlGeneration<1||!b.dirty||b.pending||b.upload||b.uncertain||!Number.isSafeInteger(index)||index<0||index>=b.input.items.length)throw new ApiError('BASELINE_DESIGN_LOCKED');
}
/** 로컬 연결만 바꾼다. 실제 문서/현재 정책은 저장 시 서버가 다시 확인한다. */
export function setBaselineDesign(b:BaselineBuffer,s:DocumentSession,index:number,ref:Ref|null):BaselineBuffer{
 editable(b,s,index);if(ref!==null&&!reference(ref))throw new ApiError('BASELINE_DESIGN_INVALID');
 return{...b,input:{...b.input,items:b.input.items.map((item,n)=>n===index?{...item,designRef:ref?{...ref}:null}:item)},review:null,reviewDirty:false,confirmation:{reason:'',acknowledged:false},failure:null};
}
export async function readBaselineDesign(client:ApiClient,b:BaselineBuffer,s:DocumentSession,index:number,id:string,version:string,active:()=>boolean){
 editable(b,s,index);const check=()=>{if(!active())throw new ApiError('BASELINE_DESIGN_PAUSED');};check();
 if(!uuid(id)||!/^\d+$/.test(version)||!Number.isSafeInteger(Number(version))||Number(version)<1)throw new ApiError('BASELINE_DESIGN_INVALID');
 const v=await readDocument(client,b.projectId,id,Number(version),{active});check();const d=v.document;
 if(d.content.sourceRefs.length||await documentDraftHash(d.title,d.formRef,d.content as DocumentContent,stageRef(d.stageNodeRef)?d.stageNodeRef:null)!==d.contentHash)throw new ApiError('DOCUMENT_REFERENCE_CHANGED');check();
 const form=await getPinnedForm(client,d.formRef);check();await verifyFormVersionIntegrity(form);check();if(form.definition.formCode!=='AF02')throw new ApiError('DESIGN_DOCUMENT_KIND_INVALID');
 return{ref:{id:d.id,version:d.version,contentHash:d.contentHash},title:d.title,body:v.body,confirmed:d.confirmed};
}
