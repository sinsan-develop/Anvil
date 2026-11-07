import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceContentScopeV1} from '../../../../contracts/runtime/source-content-report-v1.ts';
import {readRootDeclaration} from '../connections/source-root-input.ts';

interface ReadClient {query(sql:string,args:unknown[]):Promise<{rows:unknown[]}>}
interface RootRef {id:string;version:number;contentHash:string}
const result=(status:'UNVERIFIED'|'UNAVAILABLE'|'DENIED',reason:string,sourceRootRef:RootRef|null=null)=>({status,reason,sourceRootRef,
 currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const});
const number=(v:unknown):number|null=>{if(typeof v==='string'&&/^[1-9][0-9]*$/.test(v))v=Number(v);return typeof v==='number'&&Number.isSafeInteger(v)&&v>0?v:null;};
/** 최신 선언과 scope의 결박만 확인하는 비활성 SOURCE. 등록 키·OS/경로·파일·현재 권위는 증명하지 않는다.
 * 좋은 상태/기대 버전으로 SQL을 선별하거나 과거 선언으로 fallback하지 않는다. 실제 route/DB에는 미연결이다. */
export async function readSourceContentRootHeadCandidate(db:ReadClient,value:unknown,nowMs:number){
 if(!Number.isSafeInteger(nowMs))throw Error('SOURCE_CONTENT_ROOT_INPUT_INVALID');
 const scope=readSourceContentScopeV1(value);
 if(nowMs<Date.parse(scope.requestedAt)||nowMs>=Date.parse(scope.expiresAt))return result('DENIED','REQUEST_OUTSIDE_ORIGINAL_LIFETIME');
 const rows=(await db.query(`SELECT r.project_id,r.id root_id,r.head_version,v.version,v.content_hash,v.declaration_json,
 v.status,v.authority,v.readiness,v.reason,v.connector_id
 FROM anvil.source_roots r LEFT JOIN anvil.source_root_versions v ON v.project_id=r.project_id AND v.root_id=r.id AND v.version=r.head_version
 WHERE r.project_id=$1 AND r.id=$2`,[scope.projectId,scope.sourceRootRef.id])).rows;
 if(rows.length===0)return result('UNAVAILABLE','SOURCE_ROOT_ABSENT');
 try{
  if(rows.length!==1||!recordV1(rows[0],['project_id','root_id','head_version','version','content_hash','declaration_json','status','authority','readiness','reason','connector_id']))return result('DENIED','SOURCE_ROOT_HEAD_INVALID');
  // 기존 선언의 두 reason 각20,000자·pathHint4,096자·label/name 각200자와 JSON 구조를 수용한다.
  const raw=canonicalJson(rows[0]);if(Buffer.byteLength(raw,'utf8')>262144)return result('DENIED','SOURCE_ROOT_HEAD_INVALID');
  const r=JSON.parse(raw),head=number(r.head_version),version=number(r.version);
  if(r.project_id!==scope.projectId||r.root_id!==scope.sourceRootRef.id||head===null||version!==head
   ||!['DECLARED','REVOKED'].includes(r.status)||r.authority!=='USER_DECLARED'||r.readiness!=='UNVERIFIED'
   ||typeof r.reason!=='string'||!r.reason.trim()||r.reason.length>20000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(r.reason))return result('DENIED','SOURCE_ROOT_HEAD_INVALID');
  const declaration=readRootDeclaration(r.declaration_json),snapshot={declaration,status:r.status,authority:r.authority,readiness:r.readiness,reason:r.reason};
  if(contentHash(canonicalJson(snapshot))!==r.content_hash||r.connector_id!==declaration.connectorId)return result('DENIED','SOURCE_ROOT_HEAD_INVALID');
  if(r.status==='REVOKED')return result('DENIED','SOURCE_ROOT_REVOKED');
  if(version!==scope.sourceRootRef.version||r.content_hash!==scope.sourceRootRef.contentHash)return result('DENIED','SOURCE_ROOT_REF_CHANGED');
  if(declaration.connectorId!==scope.connectorRef.id||contentHash(declaration.pathHint)!==scope.pathHintHash)return result('DENIED','SOURCE_ROOT_DECLARATION_MISMATCH');
  return result('UNVERIFIED','SOURCE_ROOT_DECLARATION_ONLY',{...scope.sourceRootRef});
 }catch{return result('DENIED','SOURCE_ROOT_HEAD_INVALID');}
}
