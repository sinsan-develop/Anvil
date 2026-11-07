import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {transferFixture,pid,at} from './transfer-fixture.ts';
import {fixtureData} from '../FN05/knowledge-conversation-source-fixture.ts';
import {impactDocumentFixture} from '../UI07/impact-document-fixture.ts';
import {knowledgeCriterionIds} from '../../../apps/web/src/features/knowledge/review-view.ts';
import {contextSlotCodes,readContextPreparationInput} from '../../../apps/server/modules/context/context-input.ts';
import {planContextText} from '../../../apps/server/modules/context/context-text-plan.ts';
import {buildContextManifest} from '../../../apps/server/modules/context/context-manifest.ts';
export function originalFixture(kind:'DOCUMENT_VERSION'|'KNOWLEDGE_VERSION'|'USER_INSTRUCTION'='USER_INSTRUCTION'){
 const f=transferFixture(),source=fixtureData(),doc=impactDocumentFixture(),knowledge:any=source.knowledge;
 const reviewer={kind:'HUMAN',userId:pid},reviewRef={id:'99999999-9999-4999-8999-999999999999',targetRef:knowledge.ref,criteriaVersion:1,outcome:'ACCEPTED'};
 const confirmation={eventId:'88888888-8888-4888-8888-888888888888',reviewRefs:[reviewRef],reason:'내용 확인',actorRef:reviewer,recordedAt:at};
 knowledge.state='CONFIRMED';knowledge.currentConfirmationValid=true;knowledge.contentReviewCriteria={criteriaVersion:1,knowledgeKind:knowledge.entry.kind,items:knowledgeCriterionIds.map(criterionId=>({criterionId,title:criterionId}))};
 knowledge.contentReviews=[{ref:reviewRef,criteria:knowledge.contentReviewCriteria,items:knowledgeCriterionIds.map(criterionId=>({criterionId,outcome:'ACCEPTED',evidenceRefs:[],reason:'사람 확인'})),reviewer:{...reviewer,sameAsTargetRecorder:false},sourceKind:'HUMAN_REVIEW',reason:'확인',reviewedAt:at,serverSequence:2}];
 knowledge.confirmation=confirmation;knowledge.history.push({id:confirmation.eventId,kind:'CONFIRMED',reason:confirmation.reason,actorRef:reviewer,recordedAt:at,reviewRefs:[reviewRef]});
 const document:any=doc.document;document.confirmed=true;document.validation.validForConfirmation=true;document.contentReviews=[{ref:{id:reviewRef.id,criteriaVersion:1,targetRef:{id:document.id,version:1,contentHash:document.contentHash},outcome:'ACCEPTED'},items:[],reviewer:{...reviewer,sameAsTargetRecorder:false},sourceKind:'HUMAN_REVIEW',reason:'사람 확인',reviewedAt:at,serverSequence:1}];
 const selection:any=kind==='DOCUMENT_VERSION'?{kind,versionRef:{id:document.id,version:1,contentHash:document.contentHash}}:kind==='KNOWLEDGE_VERSION'?{kind,versionRef:knowledge.ref}:{kind,conversationId:source.conversation.conversationId,messageRef:source.conversation.sourceRef};
 const code=kind==='DOCUMENT_VERSION'?'CURRENT_POSITION':kind==='KNOWLEDGE_VERSION'?'PURPOSE_REASON':'LATEST_INSTRUCTIONS',body=kind==='DOCUMENT_VERSION'?doc.body:kind==='KNOWLEDGE_VERSION'?knowledge.body:source.conversation.body,bodyRef=kind==='DOCUMENT_VERSION'?document.content.body:kind==='KNOWLEDGE_VERSION'?knowledge.entry.contentRef:source.conversation.message.bodyRef;
 const input=readContextPreparationInput({assignmentRef:f.confirmed.ref,budgetRef:null,slots:contextSlotCodes.map(c=>({code:c,sources:c===code?[selection]:[],reason:c===code?'고정 원문 연결':'미선택 보존'})),limits:{maxPartBytes:1024,maxParts:20},reason:'인계 원문 조회'});
 const originals=input.slots.map(slot=>({itemId:slot.code+(slot.sources.length?'_1':''),category:slot.code,required:true,sourceRef:slot.sources.length?(selection.versionRef??selection.messageRef):null,reason:slot.reason,state:slot.sources.length?'AVAILABLE':'MISSING',bodyRef:slot.sources.length?bodyRef:null,body:slot.sources.length?body:null}));
 const planned=planContextText(originals,input.limits),prepared:any={preparationInput:input,assignmentRef:f.confirmed.ref,baselineRefs:[],constitutionRef:null,budgetRef:null,bindings:originals.map((item,index)=>({itemId:item.itemId,selection:input.slots[index]!.sources[0]??null,bodyRef:item.bodyRef,sourceState:item.bodyRef?(kind==='USER_INSTRUCTION'?'STORED_NOT_EFFECTIVENESS_APPROVED':'CONFIRMED'):'NOT_SELECTED'})),...planned,unverified:[]};
 const built=buildContextManifest(f.context.ref.id,pid,prepared),context={...f.context,...built};f.responses['context/'+context.ref.id+'/versions/1']=context;f.responses.context={...f.contexts,items:[{ref:context.ref,missingRequired:context.manifest.missingRequired,excluded:context.manifest.excluded,currentCheck:context.currentCheck}]};
 f.responses['documents/'+document.id+'/versions/1']=document;f.responses['knowledge/'+knowledge.ref.id+'/versions/1']=knowledge;f.responses['conversations/'+source.conversation.conversationId+'/messages/'+source.conversation.sourceRef.id]=source.conversation;
 return{...f,context,knowledge,document,conversation:source.conversation,selection,itemId:code+'_1',body,bodyRef,filePath:'files/'+document.content.body.artifactId,fileBytes:doc.bytes,rehash:()=>{context.ref.contentHash=contentHash(canonicalJson(context.manifest));}};
}
