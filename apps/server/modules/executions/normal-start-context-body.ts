import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import type {RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import type {ProjectContexts} from '../context/project-contexts.ts';

const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const reject=():never=>{throw new AuthFailure('NORMAL_START_CURRENT_REQUIRED',412);};

type StartContext=Awaited<ReturnType<ProjectContexts['readStartSource']>>;
/** 보호 reader가 돌려준 맥락에서 START 자료 원문을 만든다. 최초 등록과 이후 자료 전달이 같은 bytes를 내도록 한곳에 둔다.
 * 이 함수는 접근 권한이나 전달 허가를 만들지 않는다. */
export function startContextBody(ctx:StartContext,intent:{contextBundleRef:Ref;assignmentRef:Ref}):string{
  if(!same(ctx.ref,intent.contextBundleRef)||!same(ctx.manifest.assignmentRef,intent.assignmentRef)||!ctx.prepared.parts.length)return reject();
  const items=ctx.manifest.items.map(item=>{
    const bound=ctx.manifest.sourceBindings.find(b=>b.itemId===item.itemId);
    if(!bound?.bodyRef||!bound.selection||item.issue||item.includedState!=='INCLUDED')return reject();
    const parts=ctx.manifest.deliveryPlan.parts.filter(v=>v.itemId===item.itemId).map(v=>{
      const t=ctx.prepared.parts.find(x=>x.partId===v.partId&&x.itemId===item.itemId);
      if(!t||t.utf8Bytes!==v.utf8Bytes||t.contentHash!==v.contentHash||!t.text.length
        ||Buffer.byteLength(t.text)!==v.utf8Bytes||contentHash(t.text)!==v.contentHash)return reject();
      return {partId:v.partId,order:v.order,byteOffset:v.byteOffset,utf8Bytes:v.utf8Bytes,contentHash:v.contentHash,text:t.text};
    });
    if(!parts.length)return reject();
    return {itemId:item.itemId,category:item.category,sourceRef:item.sourceRef,selection:bound.selection,bodyRef:bound.bodyRef,
      sourceState:bound.sourceState,includedState:item.includedState,reason:item.reason,parts};
  });
  return canonicalJson({schemaVersion:1,purpose:'START_CONTEXT_BODY_V1',contextBundleRef:ctx.ref,assignmentRef:intent.assignmentRef,
    budgetRef:ctx.manifest.budgetRef,baselineRefs:ctx.manifest.baselineRefs,constitutionRef:ctx.manifest.constitutionRef,items,
    ready:false,executionAuthorized:false,dispatchPerformed:false});
}
