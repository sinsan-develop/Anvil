import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

type Row=Record<string,unknown>;
type Write={sql:string;args:unknown[]};
const H=(v:unknown)=>contentHash(canonicalJson(v));
const json=(v:unknown)=>v===null?null:JSON.parse(String(v));

// 기존 합성 버전을 만들 때만 그 원 저장 명령·인증·감사를 함께 등록한다.
export function seedDocumentReceipt(row:Row,projectId:string,actorId:string,clientId:string,writes:Write[]){
  const id=randomUUID(),commandId=randomUUID(),operationId=randomUUID(),auth=randomUUID(),ref={id:row.document_id,version:Number(row.version),contentHash:row.content_hash};
  Object.assign(row,{project_id:projectId,command_id:id,client_id:clientId,reason:row.reason??'합성 원본 저장'});
  const formRef={id:row.form_definition_id,version:row.form_version,contentHash:row.form_hash},stageNodeRef=row.stage_ref_json;
  const request={schemaVersion:1,projectId,commandId,clientId,controlGeneration:1,operation:'saveDocumentDraft',targetId:ref.version===1?null:ref.id,expectedVersion:ref.version-1,baselineRefs:[],approvalRef:null,
    payload:{title:row.title,formRef,content:row.content_json,stageNodeRef,reason:row.reason,importCandidateRef:null}};
  const hash=H(request),subject={kind:'HUMAN',userId:actorId},policy={id:randomUUID(),version:1,contentHash:H({rules:[]})},digest=H({projectId,actorId,clientId,controlGeneration:1,requestHash:hash,policyRef:policy,targetRef:ref});
  const result={projectId,commandId,operationId,status:'APPLIED',targetId:ref.id,version:ref.version,data:{ref,status:'DRAFT',stageNodeRef,stageBinding:null,importCandidateRef:null,proposalRef:null,validation:row.validation_json},warnings:[],evidenceRefs:[],serverReceivedAt:'2026-11-01T00:00:00.000Z'};
  writes.push({sql:'INSERT INTO anvil.commands(',args:[id,projectId,actorId,clientId,'saveDocumentDraft',commandId,hash,operationId,auth,null,ref.version-1,1,JSON.stringify(policy),null,JSON.stringify(result)]},
    {sql:'INSERT INTO anvil.authorization_receipts(',args:[auth,projectId,id,JSON.stringify({...subject,clientId}),JSON.stringify(policy),digest,null]},
    {sql:'INSERT INTO anvil.audit_events(',args:[projectId,randomUUID(),JSON.stringify(subject),clientId,id,operationId,JSON.stringify(ref),JSON.stringify(policy),null,'EXPLICIT_DOCUMENT_DRAFT',digest]});
}

export const stageProofQuery=(sql:string)=>sql.startsWith('SELECT v.document_id,v.version,v.content_hash,v.stage_ref_json')&&sql.includes('JOIN anvil.authorization_receipts ar')&&sql.includes('JOIN anvil.audit_events a');
export function documentReceiptRows(row:Row|undefined,args:unknown[],writes:Write[]){
  if(!row||row.project_id!==args[0]||row.document_id!==args[1]||row.version!==args[2])return [];
  const commands=writes.filter(w=>w.sql.startsWith('INSERT INTO anvil.commands(')&&w.args[0]===row.command_id&&w.args[1]===row.project_id&&w.args[4]==='saveDocumentDraft');
  return commands.flatMap(({args:c})=>writes.filter(w=>w.sql.startsWith('INSERT INTO anvil.authorization_receipts(')&&w.args[0]===c[8]&&w.args[2]===c[0]&&w.args[1]===row.project_id).flatMap(({args:ar})=>
    writes.filter(w=>w.sql.startsWith('INSERT INTO anvil.audit_events(')&&w.args[0]===row.project_id&&w.args[4]===c[0]&&w.args[5]===c[7]&&w.args[10]===ar[5]).map(({args:a})=>({
      ...row,command_id:c[5],actor_id:c[2],client_id:c[3],request_hash:c[6],operation_id:c[7],control_generation:c[11],policy_ref:json(c[12]),payload_ref:json(c[13]),result_ref:json(c[14]),
      reason_code:a[9],approval_ref:json(a[8]),approval_consumption_id:c[9],approval_decision_ref:ar[6],scope_digest:ar[5],consumed:null,consumed_digest:null,
      import_id:writes.find(w=>w.sql.startsWith('INSERT INTO anvil.document_import_selections(')&&w.args[7]===c[0])?.args[2]??null,
      proposal_id:writes.find(w=>w.sql.startsWith('INSERT INTO anvil.document_proposal_selections(')&&w.args[7]===c[0])?.args[2]??null,
    }))));
}
