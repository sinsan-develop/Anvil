import { ApiClient, ApiError } from '../../api/client.ts';
import { documentControl, type DocumentSession } from '../design-trace/editor-api.ts';
import type { MethodCommand, CommonCommandReceipt } from './common-api.ts';
import { validateMethodVersion, type MethodVersion } from './api.ts';
import type { VersionRef } from '../../../../../contracts/generated-types.ts';
import { ordered } from '../knowledge/review-view.ts';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export async function readMethodApplicationRef(client: ApiClient, pid: string): Promise<VersionRef | null> {
  if (!uuid.test(pid)) throw new ApiError('CLIENT_PATH_INVALID');
  const project = await client.get<{ id: string; currentMethodologyRef: VersionRef | null }>(`/api/v1/projects/${pid}`);
  if (!project || project.id !== pid || project.currentMethodologyRef !== null && !validRef(project.currentMethodologyRef)) throw new ApiError('RESPONSE_INVALID');
  return project.currentMethodologyRef;
}
const validRef = (ref: VersionRef) => !!ref && uuid.test(ref.id) && Number.isSafeInteger(ref.version) && ref.version > 0 && /^[0-9a-f]{64}$/.test(ref.contentHash);
export interface MethodApplicationCommand {
  schemaVersion:1;projectId:string;commandId:string;clientId:string;controlGeneration:number;operation:'applyMethodology';targetId:string;expectedVersion:number;baselineRefs:[];approvalRef:null;
  payload:{methodologyRef:VersionRef;expectedApplicationVersion:number;reason:string};
}
const sameRef=(a:VersionRef|null,b:VersionRef|null)=>a===null?b===null:b!==null&&a.id===b.id&&a.version===b.version&&a.contentHash===b.contentHash;
export async function prepareMethodApplication(client:ApiClient,pid:string,session:DocumentSession,methodologyRef:VersionRef,previous:VersionRef|null,reason:string):Promise<MethodApplicationCommand>{
  try{session=structuredClone(session);methodologyRef=structuredClone(methodologyRef);previous=structuredClone(previous);}catch{throw new ApiError('CLIENT_PATH_INVALID');}
  if(!uuid.test(pid)||!uuid.test(session.user.id)||!uuid.test(session.clientId)||!validRef(methodologyRef)||previous!==null&&!validRef(previous)||typeof reason!=='string'||!reason.trim()||reason.length>20000||!reason.isWellFormed()||(previous?.version??0)>=Number.MAX_SAFE_INTEGER)throw new ApiError('CLIENT_PATH_INVALID');
  const current=await client.get<any>(`/api/v1/projects/${pid}`),state=current?.controlState;
  if(current?.id!==pid||current.currentMethodologyRef!==null&&!validRef(current.currentMethodologyRef)||!state||!Number.isSafeInteger(state.generation)||state.generation<1)throw new ApiError('RESPONSE_INVALID');
  if(current.participation!=='OWNER'||state.status!=='HELD'||state.actorId!==session.user.id||state.clientId!==session.clientId)throw new ApiError('PROJECT_CONTROL_REQUIRED',403);
  if(!sameRef(current.currentMethodologyRef,previous))throw new ApiError('VERSION_CONFLICT',409);
  return {schemaVersion:1,projectId:pid,commandId:crypto.randomUUID(),clientId:session.clientId,controlGeneration:state.generation,operation:'applyMethodology',targetId:pid,expectedVersion:previous?.version??0,baselineRefs:[],approvalRef:null,payload:{methodologyRef:structuredClone(methodologyRef),expectedApplicationVersion:previous?.version??0,reason}};
}
export async function writeMethodApplication(client:ApiClient,request:MethodApplicationCommand,previous:VersionRef|null,csrf:string):Promise<{data:{ref:VersionRef;status:'METHODOLOGY_APPLIED';snapshot:unknown;reason:string;previousApplicationRef:VersionRef|null}}>{
  try{request=structuredClone(request);previous=structuredClone(previous);}catch{throw new ApiError('CLIENT_PATH_INVALID');}
  const p=request?.payload;
  if(!request||request.schemaVersion!==1||!uuid.test(request.projectId)||!uuid.test(request.commandId)||!uuid.test(request.clientId)||request.operation!=='applyMethodology'||request.targetId!==request.projectId||!Number.isSafeInteger(request.controlGeneration)||request.controlGeneration<1||!Number.isSafeInteger(request.expectedVersion)||request.expectedVersion<0||request.expectedVersion>=Number.MAX_SAFE_INTEGER||!p||Object.keys(p).sort().join(',')!=='expectedApplicationVersion,methodologyRef,reason'||!validRef(p.methodologyRef)||p.expectedApplicationVersion!==request.expectedVersion||typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>20000||!p.reason.isWellFormed()||previous!==null&&!validRef(previous)||(previous?.version??0)!==request.expectedVersion||!Array.isArray(request.baselineRefs)||request.baselineRefs.length||request.approvalRef!==null||!/^[A-Za-z0-9_-]{43}$/.test(csrf))throw new ApiError('CLIENT_PATH_INVALID');
  let response:Response;
  try{response=await client.transport.call(globalThis,`/api/v1/projects/${request.projectId}/commands`,{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json','X-Anvil-CSRF':csrf},body:JSON.stringify(request)});}catch{throw new ApiError('CONNECTION_LOST');}
  let body:any;try{if(!/^application\/json\b/i.test(response.headers.get('content-type')??''))throw Error();body=await response.json();}catch{throw new ApiError('RESPONSE_INVALID',response.status);}
  if(!response.ok)throw new ApiError(typeof body?.code==='string'&&/^[A-Z_]{1,64}$/.test(body.code)?body.code:'REQUEST_FAILED',response.status);
  try{
    const ref=body?.data?.ref,snapshot=body?.data?.snapshot,old=body?.data?.previousApplicationRef;
    if(body?.commandId!==request.commandId||body?.projectId!==request.projectId||body?.status!=='APPLIED'||!uuid.test(body?.operationId)||!validRef(ref)||ref.version!==request.expectedVersion+1||body.targetId!==ref.id||body.version!==ref.version||body.data.status!=='METHODOLOGY_APPLIED'||body.data.reason!==p.reason||old!==null&&!validRef(old)||!sameRef(old,previous)||!Number.isFinite(Date.parse(body.serverReceivedAt))||!snapshot||Object.keys(snapshot).sort().join(',')!=='graph,name,purpose,sourceRef'||typeof snapshot.name!=='string'||snapshot.name.length>200||!snapshot.name.isWellFormed()||typeof snapshot.purpose!=='string'||snapshot.purpose.length>20000||!snapshot.purpose.isWellFormed()||!validRef(snapshot.sourceRef)||!sameRef(snapshot.sourceRef,p.methodologyRef)||await graphHash(snapshot)!==ref.contentHash||await graphHash(snapshot.graph)!==p.methodologyRef.contentHash)throw Error();
    return body;
  }catch{throw new ApiError('RESPONSE_INVALID',response.status);}
}
async function graphHash(graph: unknown) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ordered(graph))))].map(value => value.toString(16).padStart(2, '0')).join(''); }
export async function prepareProjectMethod(client: ApiClient, pid: string, session: DocumentSession, request: MethodCommand): Promise<MethodCommand> {
  if (!uuid.test(pid) || request.clientId !== session.clientId) throw new ApiError('CLIENT_PATH_INVALID');
  if (request.projectId !== undefined) { if (request.projectId !== pid || !Number.isSafeInteger(request.controlGeneration) || Number(request.controlGeneration) < 1) throw new ApiError('CLIENT_PATH_INVALID'); return request; }
  return { ...structuredClone(request), projectId: pid, controlGeneration: await documentControl(client, pid, session), baselineRefs: [], approvalRef: null };
}
export async function writeProjectMethod(client: ApiClient, request: MethodCommand, csrf: string): Promise<CommonCommandReceipt> {
  if (!uuid.test(request.projectId ?? '') || !uuid.test(request.commandId) || !uuid.test(request.clientId) || !Number.isSafeInteger(request.controlGeneration) || Number(request.controlGeneration) < 1 || !['copyMethodology', 'saveMethodologyDraft', 'recordContentReview', 'confirmMethodology'].includes(request.operation) || !/^[A-Za-z0-9_-]{43}$/.test(csrf)) throw new ApiError('CLIENT_PATH_INVALID');
  let response: Response;
  try { response = await client.transport.call(globalThis, `/api/v1/projects/${request.projectId}/commands`, { method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Anvil-CSRF': csrf }, body: JSON.stringify(request) }); }
  catch { throw new ApiError('CONNECTION_LOST'); }
  let body: any;
  try { if (!/^application\/json\b/i.test(response.headers.get('content-type') ?? '')) throw Error(); body = await response.json(); } catch { throw new ApiError('RESPONSE_INVALID', response.status); }
  if (!response.ok) throw new ApiError(typeof body?.code === 'string' && /^[A-Z_]{1,64}$/.test(body.code) ? body.code : 'REQUEST_FAILED', response.status);
  const ref = body?.data?.ref, review = request.operation === 'recordContentReview', confirmation = request.operation === 'confirmMethodology';
  const expectedVersion = review || confirmation ? request.expectedVersion : request.expectedVersion + 1;
  const hash = request.operation === 'copyMethodology' ? (request.payload.sourceRef as VersionRef)?.contentHash : request.operation === 'saveMethodologyDraft' ? await graphHash(request.payload.graph) : (request.payload[review ? 'targetRef' : 'versionRef'] as VersionRef)?.contentHash;
  if (!body || body.commandId !== request.commandId || body.projectId !== request.projectId || body.status !== 'APPLIED' || !uuid.test(body.operationId) || !validRef(ref) || ref.version !== expectedVersion || ref.contentHash !== hash || request.targetId !== null && ref.id !== request.targetId || body.targetId !== ref.id || body.version !== ref.version || body.data.status !== (review ? 'REVIEW_RECORDED' : confirmation ? 'CONFIRMED' : 'DRAFT') || !Number.isFinite(Date.parse(body.serverReceivedAt))) throw new ApiError('RESPONSE_INVALID');
  if (review && (!uuid.test(body.data.reviewRef?.id ?? '') || ordered(body.data.reviewRef.targetRef) !== ordered(ref) || body.data.reviewRef.outcome !== request.payload.outcome || body.data.reviewRef.criteriaVersion !== 1) || confirmation && !uuid.test(body.data.confirmationId ?? '')) throw new ApiError('RESPONSE_INVALID');
  return body;
}
export interface ProjectMethodPage { projectId: string; items: { ref: VersionRef; name: string; purpose: string; scope: 'PROJECT' }[]; hasMore: boolean; nextAfterId: string | null; observedAt: string; applicationTransition: 'EXECUTION_STATE_UNVERIFIED' }
export async function listProjectMethods(client: ApiClient, pid: string, afterId: string | null = null): Promise<ProjectMethodPage> {
  if (!uuid.test(pid) || afterId !== null && !uuid.test(afterId)) throw new ApiError('CLIENT_PATH_INVALID');
  const page = await client.get<ProjectMethodPage>(`/api/v1/projects/${pid}/methodologies?limit=20${afterId ? '&afterId=' + afterId : ''}`);
  if (!page || page.projectId !== pid || page.applicationTransition !== 'EXECUTION_STATE_UNVERIFIED' || !Array.isArray(page.items) || page.items.length > 20 || page.items.some(item => !item || !validRef(item.ref) || item.scope !== 'PROJECT' || typeof item.name !== 'string' || typeof item.purpose !== 'string') || new Set(page.items.map(item => item.ref.id)).size !== page.items.length || typeof page.hasMore !== 'boolean' || (page.hasMore ? !page.items.length || page.nextAfterId !== page.items.at(-1)!.ref.id : page.nextAfterId !== null) || !Number.isFinite(Date.parse(page.observedAt))) throw new ApiError('RESPONSE_INVALID');
  return page;
}
export async function readProjectMethod(client: ApiClient, pid: string, ref: VersionRef, name?: string, purpose?: string): Promise<MethodVersion> {
  if (!uuid.test(pid) || !validRef(ref)) throw new ApiError('CLIENT_PATH_INVALID');
  const value = await readProjectMethodAtVersion(client, pid, ref.id, ref.version);
  return validateMethodVersion(value, { ref, name: name ?? value.name, purpose: purpose ?? value.purpose, scope: 'PROJECT', systemCode: null });
}
export async function readProjectMethodAtVersion(client: ApiClient, pid: string, id: string, version: number): Promise<MethodVersion> {
  if (!uuid.test(pid) || !uuid.test(id) || !Number.isSafeInteger(version) || version < 1) throw new ApiError('CLIENT_PATH_INVALID');
  const value = await client.get<MethodVersion & { projectId: string; headVersion: number; applicationTransition: string }>(`/api/v1/projects/${pid}/methodologies/${id}/versions/${version}`);
  if (!value || value.projectId !== pid || !validRef(value.ref) || value.ref.id !== id || value.ref.version !== version || value.scope !== 'PROJECT' || value.applicationTransition !== 'EXECUTION_STATE_UNVERIFIED' || !Number.isSafeInteger(value.headVersion) || value.headVersion < version || await graphHash(value.graph) !== value.ref.contentHash) throw new ApiError('RESPONSE_INVALID');
  return validateMethodVersion(value, { ref: value.ref, name: value.name, purpose: value.purpose, scope: 'PROJECT', systemCode: null });
}
