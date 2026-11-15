import type { FormDefinition, FormField } from '../../../../server/modules/documents/forms.ts';
import type { CommonCommandReceipt, MethodCommand } from '../methodology-editor/common-api.ts';
import type { FormVersion } from './forms-api.ts';
import type { VersionRef } from '../../../../../contracts/generated-types.ts';
import {reviewRefFor, type ContentReviewRef, type ReviewOutcome} from './forms-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import {ApiError} from '../../api/client.ts';

export interface FormReviewWork {
  ref: VersionRef; criteriaVersion: number; criteria: { criterionId: string; title: string }[];
  items: { criterionId: string; outcome: ReviewOutcome; evidenceRefs: []; reason: string }[];
  outcome: ReviewOutcome; reason: string; dirty: boolean; pending: MethodCommand | null; receiptEvent?: ReviewReceiptEvent;
}
type ReviewRead = Pick<FormVersion,'ref'|'contentReviews'|'contentReviewCriteria'> & {
  confirmation?: {id:string;decidedBy:string;reviewRefs:ContentReviewRef[]}|null;
};
type ReviewReceiptEvent = { command: string; userId:string; projectId:string|null; target:VersionRef; criteriaVersion:number } &
  ({kind:'review';reviewRef:ContentReviewRef}|{kind:'confirmation';confirmationId:string});

export function reviewReceiptEvent(request:MethodCommand, receipt:CommonCommandReceipt, target:VersionRef,
    criteriaVersion:number, userId:string, projectId:string|null):ReviewReceiptEvent {
  const invalid=()=>new ApiError('RESPONSE_INVALID');
  if ((request.projectId??null)!==projectId || request.targetId!==target.id || request.expectedVersion!==target.version ||
      ordered(receipt.data.ref)!==ordered(target)) throw invalid();
  const base={command:ordered(request),userId,projectId,target:{...target},criteriaVersion};
  if (request.operation==='recordContentReview') {
    const ref=receipt.data.reviewRef;
    if (receipt.data.status!=='REVIEW_RECORDED' || ordered(request.payload.targetRef)!==ordered(target) ||
        !reviewRefFor(ref,target) || ref.criteriaVersion!==criteriaVersion || ref.criteriaVersion!==request.payload.criteriaVersion ||
        ref.outcome!==request.payload.outcome) throw invalid();
    return {...base,kind:'review',reviewRef:structuredClone(ref)};
  }
  const id=receipt.data.confirmationId;
  if (!['confirmForm','confirmMethodology'].includes(request.operation) || receipt.data.status!=='CONFIRMED' ||
      ordered(request.payload.versionRef)!==ordered(target) || !Array.isArray(request.payload.reviewRefs) || !request.payload.reviewRefs.length ||
      !request.payload.reviewRefs.every(ref=>reviewRefFor(ref,target)&&ref.outcome==='ACCEPTED') ||
      !id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) throw invalid();
  return {...base,kind:'confirmation',confirmationId:id};
}

export function matchesReviewReceipt(event:ReviewReceiptEvent, request:MethodCommand, target:VersionRef, criteriaVersion:number,
    userId:string, projectId:string|null):boolean {
  return event.command===ordered(request) && event.userId===userId && event.projectId===projectId &&
    (request.projectId??null)===projectId && ordered(event.target)===ordered(target) && event.criteriaVersion===criteriaVersion;
}

export function verifyReviewEvent(event:ReviewReceiptEvent, request:MethodCommand, value:ReviewRead) {
  if (event.command!==ordered(request) || ordered(value.ref)!==ordered(event.target) ||
      value.contentReviewCriteria?.criteriaVersion!==event.criteriaVersion) throw new ApiError('RESPONSE_INVALID');
  if (event.kind==='review') {
    const rows=value.contentReviews?.filter(row=>row.ref.id===event.reviewRef.id), row=rows?.[0];
    if (rows?.length!==1 || !row || ordered(row.ref)!==ordered(event.reviewRef) || row.reviewer.kind!=='HUMAN' ||
        row.reviewer.userId!==event.userId || row.sourceKind!=='HUMAN_REVIEW' || row.reason!==request.payload.reason ||
        ordered(row.items)!==ordered(request.payload.items)) throw new ApiError('RESPONSE_INVALID');
  } else {
    const confirmation=value.confirmation;
    if (confirmation?.id!==event.confirmationId || confirmation.decidedBy!==event.userId ||
        ordered(confirmation.reviewRefs)!==ordered(request.payload.reviewRefs)) throw new ApiError('RESPONSE_INVALID');
  }
}


export interface FormBuffer {
  ownerUserId: string | null; targetId: string | null; version: number; definition: FormDefinition | null;
  itemId: string; reason: string; dirty: boolean;
  pending: { request: MethodCommand; name: string; formCode: string; storedRef?: VersionRef } | null;
  review: FormReviewWork | null;
}
export function emptyFormBuffer(): FormBuffer { return { ownerUserId: null, targetId: null, version: 0, definition: null, itemId: '', reason: '', dirty: false, pending: null, review: null }; }
export function formBuffer(value: FormVersion, ownerUserId: string): FormBuffer {
  return { ownerUserId, targetId: value.ref.id, version: value.ref.version, definition: structuredClone(value.definition), itemId: value.definition.items[0]?.itemId ?? '', reason: '', dirty: false, pending: null, review: null };
}
/** 명시 형식 전환만 수행한다. TEXT로 필드가 사라지는 전환은 별도 확인이 필요하다. */
export function changeFormItemType(buffer:FormBuffer,ownerUserId:string,itemId:string,valueType:'TEXT'|'RECORDS',acknowledged:boolean):FormBuffer{
 const items=buffer.definition?.items.filter(item=>item.itemId===itemId),item=items?.[0];
 if(!ownerUserId||buffer.ownerUserId!==ownerUserId||buffer.pending||buffer.review?.pending||buffer.itemId!==itemId||buffer.definition?.scope!=='USER_COMMON'||items?.length!==1||!item||!['TEXT','RECORDS'].includes(valueType))throw new ApiError('FORM_ITEM_TYPE_INVALID');
 if(item.valueType===valueType)return buffer;
 if(valueType==='TEXT'&&item.fields.length&&!acknowledged)throw new ApiError('FORM_ITEM_TYPE_CONFIRMATION_REQUIRED');
 const next={...item,valueType,repeated:valueType==='RECORDS',fields:valueType==='TEXT'?[]:item.fields};
 return {...buffer,dirty:true,definition:{...buffer.definition,items:buffer.definition.items.map(value=>value===item?next:value)}};
}
/** 저장하지 않은 항목/열의 순서만 바꾼다. ID·본문·서버 버전과 기존 명령은 변경하지 않는다. */
export function moveFormEntry(buffer:FormBuffer,ownerUserId:string,itemId:string,fieldId:string|null,direction:-1|1):FormBuffer{
 const definition=buffer.definition,items=definition?.items,item=items?.find(value=>value.itemId===itemId);
 if(!ownerUserId||buffer.ownerUserId!==ownerUserId||buffer.pending||buffer.review?.pending||buffer.itemId!==itemId||definition?.scope!=='USER_COMMON'||!items||!item||new Set(items.map(value=>value.itemId)).size!==items.length||![-1,1].includes(direction)||fieldId!==null&&(typeof fieldId!=='string'||!fieldId))throw new ApiError('FORM_ENTRY_MOVE_INVALID');
 if(fieldId!==null&&(item.valueType!=='RECORDS'||!item.repeated||new Set(item.fields.map(value=>value.fieldId)).size!==item.fields.length))throw new ApiError('FORM_ENTRY_MOVE_INVALID');
 const index=fieldId===null?items.indexOf(item):item.fields.findIndex(value=>value.fieldId===fieldId),length=fieldId===null?items.length:item.fields.length,next=index+direction;
 if(index<0)throw new ApiError('FORM_ENTRY_MOVE_INVALID');
 if(next<0||next>=length)return buffer;
 function swap<T>(source:T[]):T[]{const result=[...source],entry=result[index]!;result[index]=result[next]!;result[next]=entry;return result;}
 return {...buffer,dirty:true,definition:{...definition,items:fieldId===null?swap(items):items.map(value=>value===item?{...value,fields:swap(value.fields)}:value)}};
}
/** 미저장 공통 양식의 한 필드만 해제한다. 마지막 필드의 기존 검증 문제는 유지한다. */
export function removeFormRepeatField(buffer:FormBuffer,ownerUserId:string,itemId:string,fieldId:string):FormBuffer{
 const items=buffer.definition?.items.filter(item=>item.itemId===itemId),item=items?.[0];
 if(!ownerUserId||buffer.ownerUserId!==ownerUserId||buffer.pending||buffer.review?.pending||buffer.itemId!==itemId||buffer.definition?.scope!=='USER_COMMON'||items?.length!==1||!item||item.valueType!=='RECORDS'||!item.repeated||item.fields.filter(field=>field.fieldId===fieldId).length!==1)throw new ApiError('FORM_REPEAT_FIELD_REMOVAL_INVALID');
 return {...buffer,dirty:true,definition:{...buffer.definition,items:buffer.definition.items.map(value=>value===item?{...value,fields:value.fields.filter(field=>field.fieldId!==fieldId)}:value)}};
}

export interface DuplicateFormFieldSelection {
 buffer:FormBuffer; itemId:string; fields:FormField[]; index:number; field:FormField; fingerprint:string; contextFingerprint:string;
}
/** 중복 ID의 확인된 배열 정의 하나만 제거한다. 같은 ID의 마지막 정의는 이 복구로 제거하지 않는다. */
export function removeDuplicateFormRepeatField(buffer:FormBuffer,ownerUserId:string,selection:DuplicateFormFieldSelection):FormBuffer{
 const definition=buffer.definition,items=definition?.items.filter(item=>item.itemId===selection.itemId),item=items?.[0];
 if(!ownerUserId||buffer.ownerUserId!==ownerUserId||buffer.pending||buffer.review?.pending||buffer!==selection.buffer||JSON.stringify(buffer)!==selection.contextFingerprint||buffer.itemId!==selection.itemId||definition?.scope!=='USER_COMMON'||items?.length!==1||!item||item.valueType!=='RECORDS'||!item.repeated||item.fields!==selection.fields||!Number.isSafeInteger(selection.index)||selection.index<0||item.fields[selection.index]!==selection.field||JSON.stringify(selection.field)!==selection.fingerprint||item.fields.filter(field=>field.fieldId===selection.field.fieldId).length<2)throw new ApiError('FORM_DUPLICATE_FIELD_REMOVAL_INVALID');
 return {...buffer,dirty:true,definition:{...definition,items:definition.items.map(value=>value===item?{...value,fields:value.fields.filter((_,index)=>index!==selection.index)}:value)}};
}
