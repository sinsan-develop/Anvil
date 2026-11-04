import { ApiClient, ApiError } from '../../api/client.ts';

export interface ProjectSummary { id: string; name: string; purpose: string; version: number; updatedAt: string }
export interface ProjectPage { items: ProjectSummary[]; nextCursor: string | null; hasMore: boolean; observedAt: string; baselineVersion: null }
export async function listProjects(client: ApiClient, query: string, archived: boolean, cursor: string | null): Promise<ProjectPage> {
  const params = new URLSearchParams({ query, archived: String(archived) });
  if (cursor) params.set('cursor', cursor);
  const value = await client.get<ProjectPage>('/api/v1/projects?' + params.toString());
  if (!value || !Array.isArray(value.items) || value.items.length > 200 || typeof value.hasMore !== 'boolean'
    || value.hasMore !== (typeof value.nextCursor === 'string' && value.nextCursor.length > 0)
    || !value.hasMore && value.nextCursor !== null || value.baselineVersion !== null
    || !Number.isFinite(Date.parse(value.observedAt)) || new Set(value.items.map(item => item.id)).size !== value.items.length
    || value.items.some(item => !item || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(item.id)
      || typeof item.name !== 'string' || typeof item.purpose !== 'string' || !Number.isSafeInteger(item.version) || item.version < 1 || !Number.isFinite(Date.parse(item.updatedAt)))) throw new ApiError('RESPONSE_INVALID');
  return value;
}

import {readSetupCopyRefs,type SetupCopyRef} from '../project-create/common-setup-api.ts';
export async function readProjectSetupRefs(client:ApiClient,projectId:string,active:()=>boolean=()=>true):Promise<SetupCopyRef[]|undefined>{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(projectId))throw new ApiError('CLIENT_PATH_INVALID');const transport=client.transport;
 const current=()=>{if(!active()||transport!==client.transport)throw new ApiError('COMMON_SETUP_CONTEXT_CHANGED',412);};current();const value=await client.get<any>('/api/v1/projects/'+projectId);current();if(!value||value.id!==projectId)throw new ApiError('RESPONSE_INVALID');return Object.hasOwn(value,'setupCopyRefs')?readSetupCopyRefs(value.setupCopyRefs):undefined;
}
