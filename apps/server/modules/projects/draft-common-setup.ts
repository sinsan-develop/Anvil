import type {PoolClient} from 'pg';
import type {AuthenticatedIdentity} from '../access/repository.ts';import {AuthFailure} from '../access/repository.ts';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {readSetupSelection,type SetupSelection,type SetupSlot,type SetupRef,type CommonSetupSnapshot} from '../../../../contracts/runtime/user-common-setup-v1.ts';
import {chargeCommonSetup,commonSetupContext} from '../user-common-setup/storage.ts';import {readCommonSetupVersion} from '../user-common-setup/repository.ts';
export interface DraftSetupSources{selection:SetupSelection;sources:{slot:SetupSlot;ref:SetupRef;snapshot:CommonSetupSnapshot}[]}
export async function resolveDraftSetupSelection(db:PoolClient,actor:AuthenticatedIdentity,raw:unknown):Promise<DraftSetupSources|undefined>{
 if(raw===undefined)return undefined;
 let selection:SetupSelection;try{selection=readSetupSelection(raw)!;}catch{throw new AuthFailure('COMMON_SETUP_SELECTION_INVALID',422);}
 await commonSetupContext(db,actor,true);
 const slots=[['COORDINATOR_TOOL',selection.coordinatorToolRef],['CODING_TOOL',selection.codingToolRef],['ENVIRONMENT',selection.environmentRef]] as const;
 const ids=[...new Set(slots.flatMap(([,ref])=>ref?[ref.id]:[]))].sort();
 for(const id of ids){const rows=(await db.query('SELECT id,kind,head_version,state FROM anvil.common_setup_heads WHERE owner_user_id=$1 AND id=$2 FOR UPDATE',[actor.actorId,id])).rows;if(rows.length!==1)throw new AuthFailure('COMMON_SETUP_SELECTION_CONFLICT',409);}
 const sources:DraftSetupSources['sources']=[];
 for(const [slot,ref] of slots){if(!ref)continue;const v=await readCommonSetupVersion(db,actor,ref.id,ref.version);if(!v.configurationCurrent||v.status!=='ACTIVE'||canonicalJson(v.ref)!==canonicalJson(ref)||v.snapshot.kind!==(slot==='ENVIRONMENT'?'ENVIRONMENT':'TOOL'))throw new AuthFailure('COMMON_SETUP_SELECTION_CONFLICT',409);sources.push({slot,ref:{...ref},snapshot:v.snapshot});}
 return{selection,sources};
}

/** 원 초안 명령/receipt/audit 저장 이후 같은 인증 Tx에서 선택 포함 version만 계상한다. */
export async function recordDraftSetupSelection(db:PoolClient,actor:AuthenticatedIdentity,draftId:string,version:number,selection:SetupSelection|undefined,serverCommandId:string,request:unknown,result:unknown){
 if(selection===undefined)return;
 await commonSetupContext(db,actor,true);
 await db.query('INSERT INTO anvil.draft_common_setup_selections(owner_user_id,draft_id,version,selection_json,command_id,request_json,request_canonical,result_canonical) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[actor.actorId,draftId,version,JSON.stringify(selection),serverCommandId,JSON.stringify(request),canonicalJson(request),canonicalJson(result)]);
 await chargeCommonSetup(db,actor,serverCommandId);
}

/** 이력 GET는 최초 저장의 물리 증거만 검산한다. 원형의 현재 회수/개정은 새 저장/생성에서 별도로 거절한다. */
export async function assertDraftSetupHistory(db:PoolClient,actor:AuthenticatedIdentity,draftId:string,version:number,input:{setupSelection?:unknown}){
 if(input.setupSelection===undefined)return;
 await commonSetupContext(db,actor);
 const rows=(await db.query('SELECT selection_json,request_json,request_canonical,result_canonical FROM anvil.draft_common_setup_selections WHERE owner_user_id=$1 AND draft_id=$2 AND version=$3',[actor.actorId,draftId,version])).rows;
 if(rows.length!==1)throw new AuthFailure('COMMON_SETUP_SELECTION_INTEGRITY_FAILED',503);const row=rows[0];
 try{const selection=readSetupSelection(row.selection_json),result=JSON.parse(row.result_canonical),request=row.request_json;
 if(canonicalJson(selection)!==canonicalJson(input.setupSelection)||row.request_canonical!==canonicalJson(request)||canonicalJson(result)!==row.result_canonical||canonicalJson(result.input?.setupSelection)!==canonicalJson(selection)||canonicalJson(request.input?.setupSelection??request.setupSelection)!==canonicalJson(selection))throw Error();
 }catch{throw new AuthFailure('COMMON_SETUP_SELECTION_INTEGRITY_FAILED',503);}
 const proof=(await db.query('SELECT anvil.fn75_draft_selection_complete($1,$2,$3) AS complete',[actor.actorId,draftId,version])).rows;if(proof.length!==1||proof[0].complete!==true)throw new AuthFailure('COMMON_SETUP_SELECTION_INTEGRITY_FAILED',503);
}

/** 선택을 소비한 원 DRAFT 생성 명령/receipt/audit만 개인 추가 비용에 한 번 연결한다. */
export async function chargeDraftSetupConsumption(db:PoolClient,actor:AuthenticatedIdentity,draftId:string,externalCommandId:string){
 const rows=(await db.query("SELECT id FROM anvil.commands WHERE scope_kind='DRAFT' AND draft_id=$1 AND actor_id=$2 AND command_id=$3 AND operation='createProject'",[draftId,actor.actorId,externalCommandId])).rows;
 if(rows.length!==1)throw new AuthFailure('COMMON_SETUP_SELECTION_INTEGRITY_FAILED',503);await commonSetupContext(db,actor,true);await chargeCommonSetup(db,actor,rows[0].id);
}
