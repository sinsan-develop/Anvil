import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { persistProjectReceipt, projectMember, type ProjectCommand } from '../access/project-command.ts';
import type { ProjectDocuments } from '../documents/project-documents.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';

const exact=(v:unknown,keys:string[]):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const code=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v);
const text=(v:unknown,limit:number):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=limit&&v.isWellFormed();
function anchored(body:string,anchor:unknown,localCode:string,title?:string) {
  if(typeof anchor!=='string'||!/^line:[1-9][0-9]{0,7}$/.test(anchor)) throw new AuthFailure('DESIGN_ANCHOR_INVALID',422);
  const line=body.split(/\r\n|\r|\n/)[Number(anchor.slice(5))-1];
  if(line===undefined||!new RegExp('(?<![A-Za-z0-9_-])'+localCode+'(?![A-Za-z0-9_-])').test(line)||title&&!line.includes(title)) throw new AuthFailure('DESIGN_ANCHOR_INVALID',422);
}
export class ProjectDesignIndex {
  #documents:ProjectDocuments;
  constructor(documents:ProjectDocuments) {this.#documents=documents;}
  async #source(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,ref:VersionRef,formCode:string) {
    const document=await this.#documents.version(db,actor,projectId,ref.id,ref.version);
    if(document.contentHash!==ref.contentHash) throw new AuthFailure('VERSION_CONFLICT',409);
    const form=(await db.query("SELECT definition_json->>'formCode' code FROM anvil.form_versions WHERE definition_id=$1 AND version=$2 AND content_hash=$3",[document.formRef.id,document.formRef.version,document.formRef.contentHash])).rows[0];
    if(form?.code!==formCode) throw new AuthFailure('DESIGN_DOCUMENT_KIND_INVALID',422);
    const body=await this.#documents.originalText(db,projectId,document.content.body);
    return {document,body};
  }
  async write(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,policyRef:VersionRef) {
    const p=request.payload;
    if(!exact(p,['documentRef','items','screens','reason'])||!isVersionRef(p.documentRef)||request.targetId!==p.documentRef.id||request.expectedVersion!==p.documentRef.version||!Array.isArray(p.items)||!p.items.length||p.items.length>200||!Array.isArray(p.screens)||p.screens.length>200||!text(p.reason,20_000)) throw new AuthFailure('DESIGN_INDEX_INPUT_INVALID',422);
    const ref=p.documentRef, head=(await db.query('SELECT head_version FROM anvil.documents WHERE project_id=$1 AND id=$2 FOR UPDATE',[request.projectId,ref.id])).rows[0];
    if(!head) throw new AuthFailure('NOT_FOUND',404);
    if(Number(head.head_version)!==ref.version) throw new AuthFailure('VERSION_CONFLICT',409);
    const source=await this.#source(db,actor,request.projectId,ref,'AF02');
    if((await db.query('SELECT 1 FROM anvil.design_items WHERE project_id=$1 AND design_document_id=$2 AND document_version=$3 LIMIT 1',[request.projectId,ref.id,ref.version])).rowCount) throw new AuthFailure('DESIGN_INDEX_ALREADY_EXISTS',409);
    const seen=new Set<string>(), items:{id:string;documentRef:VersionRef;localCode:string;title:string;anchor:string;itemHash:string}[]=[];
    for(const value of p.items) {
      if(!exact(value,['localCode','title','anchor'])||!code(value.localCode)||!text(value.title,200)||seen.has(value.localCode)) throw new AuthFailure('DESIGN_INDEX_INPUT_INVALID',422);
      anchored(source.body,value.anchor,value.localCode,value.title); seen.add(value.localCode);
      const data={documentRef:ref,localCode:value.localCode,title:value.title,anchor:value.anchor as string};
      items.push({id:randomUUID(),...data,itemHash:contentHash(canonicalJson(data))});
    }
    const screens:any[]=[], seenScreens=new Set<string>();
    for(const value of p.screens) {
      if(!exact(value,['designLocalCode','screenCode','documentRef','anchor'])||!code(value.designLocalCode)||!code(value.screenCode)||!isVersionRef(value.documentRef)||!seen.has(value.designLocalCode)) throw new AuthFailure('SCREEN_REGION_INPUT_INVALID',422);
      const key=JSON.stringify([value.designLocalCode,value.screenCode,value.anchor]); if(seenScreens.has(key)) throw new AuthFailure('SCREEN_REGION_INPUT_INVALID',422);
      const screen=await this.#source(db,actor,request.projectId,value.documentRef,'AF03'); anchored(screen.body,value.anchor,value.screenCode); seenScreens.add(key);
      const data={designItemId:items.find(i=>i.localCode===value.designLocalCode)!.id,screenCode:value.screenCode,documentRef:value.documentRef,artifactRef:screen.document.content.body,anchor:value.anchor as string};
      screens.push({id:randomUUID(),...data,regionHash:contentHash(canonicalJson(data))});
    }
    const receipt=await persistProjectReceipt(db,actor,request,ref,{status:'DESIGN_INDEXED',designItems:items,screenRegions:screens},policyRef,'EXPLICIT_DESIGN_SOURCE_INDEX');
    for(const i of items) await db.query('INSERT INTO anvil.design_items(id,project_id,design_document_id,document_version,document_hash,local_code,title,anchor,item_hash,item_json,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[i.id,request.projectId,ref.id,ref.version,ref.contentHash,i.localCode,i.title,i.anchor,i.itemHash,JSON.stringify(i),actor.actorId,actor.clientId,receipt.id]);
    for(const s of screens) await db.query('INSERT INTO anvil.screen_regions(id,project_id,design_item_id,screen_code,source_document_id,source_version,source_hash,artifact_id,anchor,region_hash,region_json,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[s.id,request.projectId,s.designItemId,s.screenCode,s.documentRef.id,s.documentRef.version,s.documentRef.contentHash,s.artifactRef.artifactId,s.anchor,s.regionHash,JSON.stringify(s),actor.actorId,actor.clientId,receipt.id]);
    return receipt.result;
  }
  async read(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,id:string,version:number) {
    await projectMember(db,actor,projectId);
    const document=await this.#documents.version(db,actor,projectId,id,version), ref={id,version,contentHash:document.contentHash};
    const source=await this.#source(db,actor,projectId,ref,'AF02');
    const rows=(await db.query('SELECT item_json FROM anvil.design_items WHERE project_id=$1 AND design_document_id=$2 AND document_version=$3 ORDER BY local_code',[projectId,id,version])).rows;
    const items=rows.map(row=>row.item_json);
    for(const i of items) {
      const data={documentRef:ref,localCode:i.localCode,title:i.title,anchor:i.anchor};
      if(contentHash(canonicalJson(data))!==i.itemHash||canonicalJson(i.documentRef)!==canonicalJson(ref)) throw new AuthFailure('DESIGN_INDEX_INTEGRITY_FAILED',503);
      anchored(source.body,i.anchor,i.localCode,i.title);
    }
    const screenRegions=(await db.query('SELECT s.region_json FROM anvil.screen_regions s JOIN anvil.design_items d ON d.project_id=s.project_id AND d.id=s.design_item_id WHERE d.project_id=$1 AND d.design_document_id=$2 AND d.document_version=$3 ORDER BY s.screen_code',[projectId,id,version])).rows.map(row=>row.region_json);
    for(const s of screenRegions) {
      const data={designItemId:s.designItemId,screenCode:s.screenCode,documentRef:s.documentRef,artifactRef:s.artifactRef,anchor:s.anchor};
      if(contentHash(canonicalJson(data))!==s.regionHash||!items.some(i=>i.id===s.designItemId)) throw new AuthFailure('DESIGN_INDEX_INTEGRITY_FAILED',503);
      const screen=await this.#source(db,actor,projectId,s.documentRef,'AF03'); if(canonicalJson(screen.document.content.body)!==canonicalJson(s.artifactRef)) throw new AuthFailure('DESIGN_INDEX_INTEGRITY_FAILED',503); anchored(screen.body,s.anchor,s.screenCode);
    }
    return {documentRef:ref,items,screenRegions,status:items.length?'INDEXED':'NOT_INDEXED',observedAt:new Date().toISOString()};
  }
}
