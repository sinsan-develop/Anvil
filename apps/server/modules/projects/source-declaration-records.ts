import type{PoolClient}from'pg';
import{AuthFailure,type AuthenticatedIdentity}from'../access/repository.ts';
import{canonicalJson,contentHash}from'../../../../contracts/canonical.ts';
import{readSourceDeclaration,type SourceDeclaration}from'./source-declaration.ts';
export function sourceDeclarationView(draftId:string,version:number,declaration:unknown){
 const input=readSourceDeclaration(declaration);
 return{ref:{id:draftId,version,contentHash:contentHash(canonicalJson(input))},authority:'USER_DECLARED' as const,readiness:'UNVERIFIED' as const,declaration:input};
}
export async function storeSourceDeclaration(db:PoolClient,actor:AuthenticatedIdentity,draftId:string,version:number,input:SourceDeclaration,commandId:string){
 const view=sourceDeclarationView(draftId,version,input);
 await db.query("SELECT set_config('anvil.actor_id',$1,true),set_config('anvil.client_id',$2,true),set_config('anvil.source_declaration_command_id',$3,true)",[actor.actorId,actor.clientId,commandId]);
 await db.query('INSERT INTO anvil.source_declarations(id,version,draft_id,draft_version,declared_by,client_id,content_hash,declaration_json,command_id) VALUES($1,$2,$1,$2,$3,$4,$5,$6,$7)',[draftId,version,actor.actorId,actor.clientId,view.ref.contentHash,JSON.stringify(view.declaration),commandId]);
 return view;
}
export async function readSourceDeclarationRecord(db:PoolClient,draftId:string,version:number){
 const row=(await db.query('SELECT s.*,c.operation,c.actor_id,c.client_id command_client,c.expected_version,c.result_ref FROM anvil.source_declarations s JOIN anvil.commands c ON c.id=s.command_id AND c.draft_id=s.draft_id JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id WHERE s.id=$1 AND s.version=$2',[draftId,version])).rows[0];
 if(!row)throw new AuthFailure('SOURCE_DECLARATION_INTEGRITY_FAILED',503);
 let view:ReturnType<typeof sourceDeclarationView>;try{view=sourceDeclarationView(draftId,version,row.declaration_json);}catch{throw new AuthFailure('SOURCE_DECLARATION_INTEGRITY_FAILED',503);}
 if(row.authority!=='USER_DECLARED'||row.readiness!=='UNVERIFIED'||row.declared_by!==row.actor_id||row.client_id!==row.command_client||row.draft_id!==draftId||Number(row.draft_version)!==version||Number(row.expected_version)!==version-1||!['createProjectDraft','saveProjectDraft'].includes(row.operation)||row.content_hash!==view.ref.contentHash||row.result_ref?.draftId!==draftId||row.result_ref?.version!==version||row.result_ref?.input?.sourceMode!=='EXISTING'||canonicalJson(row.result_ref?.input?.sourceDeclaration??null)!==canonicalJson(view.declaration)||canonicalJson(row.result_ref?.sourceDeclaration??null)!==canonicalJson(view))throw new AuthFailure('SOURCE_DECLARATION_INTEGRITY_FAILED',503);
 return view;
}
