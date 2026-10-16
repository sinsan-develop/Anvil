import type { PoolClient } from 'pg';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { projectMember } from '../access/project-command.ts';
import { ProjectListCodec } from '../projects/service.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { importUuid } from './project-imports.ts';

export async function listDocumentMaterials(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, kind: 'IMPORTS' | 'PROPOSALS', query: Record<string, unknown>, codec: ProjectListCodec) {
  await projectMember(db, actor, projectId);
  const statuses = kind === 'IMPORTS' ? ['READY','FAILED','UNSUPPORTED'] : ['PENDING','SELECTED'];
  if (Object.keys(query).some(k => !['limit','cursor','status', kind === 'IMPORTS' ? 'formId' : 'documentId'].includes(k)) || query.limit !== undefined && (typeof query.limit !== 'string' || !/^[1-9][0-9]{0,2}$/.test(query.limit) || Number(query.limit) > 200) || query.cursor !== undefined && (typeof query.cursor !== 'string' || query.cursor.length > 4096) || query.status !== undefined && (typeof query.status !== 'string' || !statuses.includes(query.status))) throw new AuthFailure('INPUT_INVALID', 400);
  const target = query[kind === 'IMPORTS' ? 'formId' : 'documentId'];
  if (target !== undefined && (typeof target !== 'string' || !importUuid.test(target))) throw new AuthFailure('INPUT_INVALID', 400);
  const limit = query.limit === undefined ? 50 : Number(query.limit), status = query.status ?? null;
  const filter = { query: canonicalJson({ projectId, kind, status, target: target ?? null }), archived: false, limit };
  let position: { at: string; id: string } | null = null;
  if (query.cursor !== undefined) { try { position = codec.read(String(query.cursor), actor.actorId, filter); } catch { throw new AuthFailure('CURSOR_INVALID', 400); } }
  const rows = kind === 'IMPORTS'
    ? (await db.query("SELECT i.*,to_char(i.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') cursor_at FROM anvil.document_imports i WHERE i.project_id=$1 AND ($2::text IS NULL OR i.candidate_json->>'status'=$2) AND ($3::uuid IS NULL OR i.form_definition_id=$3 OR i.form_definition_id IS NULL) AND ($4::timestamptz IS NULL OR (i.created_at,i.id)<($4::timestamptz,$5::uuid)) ORDER BY i.created_at DESC,i.id DESC LIMIT $6", [projectId, status, target ?? null, position?.at ?? null, position?.id ?? null, limit + 1])).rows
    : (await db.query("SELECT p.*,v.title,EXISTS(SELECT 1 FROM anvil.document_proposal_selections s WHERE s.project_id=p.project_id AND s.proposal_id=p.id) selected,to_char(p.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') cursor_at FROM anvil.document_proposals p JOIN anvil.document_versions v ON v.project_id=p.project_id AND v.document_id=p.document_id AND v.version=p.base_version WHERE p.project_id=$1 AND ($2::text IS NULL OR ($2='SELECTED')=EXISTS(SELECT 1 FROM anvil.document_proposal_selections s WHERE s.project_id=p.project_id AND s.proposal_id=p.id)) AND ($3::uuid IS NULL OR p.document_id=$3) AND ($4::timestamptz IS NULL OR (p.created_at,p.id)<($4::timestamptz,$5::uuid)) ORDER BY p.created_at DESC,p.id DESC LIMIT $6", [projectId, status, target ?? null, position?.at ?? null, position?.id ?? null, limit + 1])).rows;
  const hasMore = rows.length > limit, visible = rows.slice(0,limit), last = visible.at(-1);
  const items = visible.map(row => {
    if (kind === 'IMPORTS') {
      if (contentHash(canonicalJson(row.candidate_json)) !== row.content_hash) throw new AuthFailure('IMPORT_INTEGRITY_FAILED', 503);
      return { ...row.candidate_json, createdAt: row.created_at.toISOString(), integrity: 'NOT_RECHECKED' };
    }
    if (contentHash(canonicalJson({ proposal: row.proposal_json, content: row.content_json, reason: row.reason })) !== row.content_hash) throw new AuthFailure('PROPOSAL_INTEGRITY_FAILED', 503);
    return { ...row.proposal_json, status: row.selected ? 'SELECTED' : 'PENDING', title: row.title, createdAt: row.created_at.toISOString(), integrity: 'NOT_RECHECKED' };
  });
  return { items, hasMore, nextCursor: hasMore ? codec.create(actor.actorId, filter, { at: last!.cursor_at, id: last!.id }) : null, observedAt: new Date().toISOString() };
}
