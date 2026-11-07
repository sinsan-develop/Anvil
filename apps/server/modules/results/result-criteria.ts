import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readAssignmentDraftInput} from '../assignments/assignment-input.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';
type SourceField='acceptanceCriteria'|'verificationRequirements';
type Kind='BUILD'|'TYPECHECK'|'UNIT'|'INTEGRATION'|'BROWSER'|'AGENT'|'DEPLOYMENT'|'SECURITY';
interface SourceBinding{field:SourceField;index:number;contentHash:string}
interface CriteriaInput{assignmentRef:RuntimeRefV1;baseRef:RuntimeRefV1|null;items:{criterionId:string;testId:string;kind:Kind;environmentRef:RuntimeRefV1;sources:SourceBinding[]}[];reason:string}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v)),code=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(v);
class ResultCriteriaFailure extends Error{}
function fail(reason:string):never{throw new ResultCriteriaFailure(reason);}
/** 고정 임무 원문에 대한 명시 입력만 정규화한다. 호출자는 PG의 정확 확정본 reader를 사용해야 한다.
 * 이 함수는 권한/현재 적용·등록/실제 환경 관측을 확인하거나 저장하지 않는다. */
export function prepareResultCriteria(rawAssignment:unknown,rawInput:unknown){
 try{
  const a=cloneV1(rawAssignment),v=cloneV1(rawInput);
  if(Buffer.byteLength(canonicalJson({assignment:a,input:v}))>2*1024*1024)fail('RESULT_CRITERIA_INPUT_LIMIT');
  if(!recordV1(a,['projectId','ref','snapshot','observedAt'])||!uuidV1(a.projectId)||!refV1(a.ref)||!isoV1(a.observedAt))fail('RESULT_CRITERIA_ASSIGNMENT_INVALID');const s=a.snapshot;
  if(!recordV1(s,['draftRef','definition','reviewRefs','reason','confirmedBy','confirmedAt','contentConfirmed','readinessIssues','ready','executionAuthorized','dispatchPerformed'])||hash(s)!==a.ref.contentHash||!refV1(s.draftRef)||s.draftRef.id!==a.ref.id||s.draftRef.version!==a.ref.version||!arrayV1(s.reviewRefs,200)||!s.reviewRefs.length||!s.reviewRefs.every(refV1)||!recordV1(s.confirmedBy,['kind','userId'])||s.confirmedBy.kind!=='HUMAN'||!uuidV1(s.confirmedBy.userId)||!isoV1(s.confirmedAt)||Date.parse(s.confirmedAt)>Date.parse(a.observedAt)||!arrayV1(s.readinessIssues,1000)||s.contentConfirmed!==true||s.ready!==false||s.executionAuthorized!==false||s.dispatchPerformed!==false)fail('RESULT_CRITERIA_ASSIGNMENT_INVALID');
  const d=readAssignmentDraftInput({baseRef:null,definition:s.definition,reason:s.reason}).input.definition;
  if(!d.environmentRef)fail('RESULT_CRITERIA_ENVIRONMENT_REQUIRED');
  if(!d.baselineRefs.length||!d.acceptanceCriteria.length||!d.verificationRequirements.length||[...d.acceptanceCriteria,...d.verificationRequirements].some(text=>!text.trim()))fail('RESULT_CRITERIA_SOURCE_INCOMPLETE');
  if(!recordV1(v,['assignmentRef','baseRef','items','reason'])||!same(v.assignmentRef,a.ref)||v.baseRef!==null&&!refV1(v.baseRef)||!arrayV1(v.items,100)||!v.items.length||typeof v.reason!=='string'||!v.reason.trim()||v.reason.length>20000)fail('RESULT_CRITERIA_INPUT_INVALID');
  assertKnowledgeTextSafe(v.reason);
  const ids=new Set<string>(),covered=new Set<string>();
  for(const item of v.items){
   if(!recordV1(item,['criterionId','testId','kind','environmentRef','sources'])||!code(item.criterionId)||!code(item.testId)||ids.has(item.criterionId)||!['BUILD','TYPECHECK','UNIT','INTEGRATION','BROWSER','AGENT','DEPLOYMENT','SECURITY'].includes(item.kind)||!refV1(item.environmentRef)||!same(item.environmentRef,d.environmentRef)||!arrayV1(item.sources,20)||!item.sources.length)fail('RESULT_CRITERIA_ITEM_INVALID');
   ids.add(item.criterionId);const local=new Set<string>();
   for(const source of item.sources){
    if(!recordV1(source,['field','index','contentHash'])||!['acceptanceCriteria','verificationRequirements'].includes(source.field)||!Number.isSafeInteger(source.index)||source.index<0||!hashV1(source.contentHash))fail('RESULT_CRITERIA_SOURCE_INVALID');
    const texts=d[source.field as SourceField],key=source.field+':'+source.index;
    if(source.index>=texts.length||source.contentHash!==hash(texts[source.index])||local.has(key))fail('RESULT_CRITERIA_SOURCE_INVALID');local.add(key);covered.add(key);
   }
  }
  for(const field of ['acceptanceCriteria','verificationRequirements'] as const)for(let i=0;i<d[field].length;i++)if(!covered.has(field+':'+i))fail('RESULT_CRITERIA_SOURCE_MISSING');
  const input=v as CriteriaInput,criteriaSnapshot={assignmentRef:cloneV1(a.ref),baselineRefs:cloneV1(d.baselineRefs),items:input.items.map(item=>({criterionId:item.criterionId,testId:item.testId,kind:item.kind,environmentRef:cloneV1(item.environmentRef),required:true}))},sourceBindings=input.items.map(item=>({criterionId:item.criterionId,sources:cloneV1(item.sources)}));
  return cloneV1({projectId:a.projectId,input,criteriaSnapshot,sourceBindings,contentHash:hash(criteriaSnapshot),status:'CRITERIA_DRAFT' as const,registryStored:false as const,completionAccepted:false as const,executionAuthorized:false as const,dispatchPerformed:false as const});
 }catch(error){if(error instanceof ResultCriteriaFailure)throw error;fail('RESULT_CRITERIA_INPUT_INVALID');}
}
