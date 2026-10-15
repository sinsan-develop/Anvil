import { AccessRepository, AuthFailure } from '../access/repository.ts';
import { ProjectListCodec, projectListFilter } from './service.ts';

function integer(value: string | number): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 1) throw Error('STORED_VERSION_INVALID');
  return result;
}
export class ProjectsRepository {
  #access: AccessRepository;
  #cursor: ProjectListCodec;
  constructor(access: AccessRepository) { this.#access = access; this.#cursor = new ProjectListCodec(value => access.signProjectCursor(value)); }
  async list(token: string, raw: Record<string, unknown>) {
    return this.#access.authenticated(token, null, async (db, identity) => {
      let filter: ReturnType<typeof projectListFilter>, position: { at: string; id: string } | undefined;
      try {
        filter = projectListFilter(raw);
        if (raw.cursor) position = this.#cursor.read(String(raw.cursor), identity.actorId, filter);
      } catch { throw new AuthFailure('CURSOR_OR_FILTER_INVALID', 400); }
      const pattern = '%' + filter.query.replace(/[\\%_]/g, '\\$&') + '%';
      const result = await db.query(`SELECT p.id,p.name,p.purpose,p.version,to_char(p.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at
        FROM anvil.projects p JOIN anvil.project_members m ON m.project_id=p.id
        WHERE m.user_id=$1 AND m.revoked_at IS NULL AND ((p.archived_at IS NOT NULL)=$2)
          AND (p.name ILIKE $3 OR p.purpose ILIKE $3)
          AND ($4::timestamptz IS NULL OR (p.updated_at,p.id)<($4::timestamptz,$5::uuid))
        ORDER BY p.updated_at DESC,p.id DESC LIMIT $6`, [identity.actorId, filter.archived, pattern, position?.at ?? null, position?.id ?? null, filter.limit + 1]);
      const hasMore = result.rows.length > filter.limit, selected = result.rows.slice(0, filter.limit);
      const items = selected.map(row => ({ id: row.id, name: row.name, purpose: row.purpose, version: integer(row.version), updatedAt: row.at }));
      const last = selected.at(-1);
      return { items, nextCursor: hasMore && last ? this.#cursor.create(identity.actorId, filter, { id: last.id, at: last.at }) : null, hasMore, observedAt: new Date().toISOString(), baselineVersion: null };
    });
  }
  async detail(token: string, projectId: string) {
    return this.#access.authenticated(token, null, async (db, identity) => {
      const row = (await db.query(`SELECT p.*,m.participation,pc.actor_id,pc.client_id,pc.generation,pc.revoked_at AS control_revoked_at,
        cu.status AS controller_status,cu.revoked_at AS controller_revoked_at,cc.revoked_at AS controller_client_revoked_at,
        pp.id AS policy_id FROM anvil.projects p JOIN anvil.project_members m ON m.project_id=p.id
        LEFT JOIN anvil.project_control pc ON pc.project_id=p.id
        LEFT JOIN anvil.users cu ON cu.id=pc.actor_id LEFT JOIN anvil.clients cc ON cc.id=pc.client_id AND cc.user_id=pc.actor_id
        LEFT JOIN anvil.permission_policies pp ON pp.project_id=p.id
        WHERE p.id=$1 AND m.user_id=$2 AND m.revoked_at IS NULL`, [projectId, identity.actorId])).rows[0];
      if (!row) throw new AuthFailure('NOT_FOUND', 404);
      const activeControl = !!row.generation && !row.control_revoked_at && row.controller_status === 'ACTIVE' && !row.controller_revoked_at && !row.controller_client_revoked_at;
      return {
        id: row.id, name: row.name, purpose: row.purpose, desiredOutcome: row.desired_outcome, version: integer(row.version),
        createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), currentMethodologyRef: null, baselineRef: null,
        readinessIssues: [{ code: 'METHODOLOGY_CONNECTION_PENDING' }, ...(!row.policy_id ? [{ code: 'PERMISSION_POLICY_UNCONFIGURED' }] : [])],
        viewerPermissions: ['READ_PROJECT'], participation: row.participation,
        controlState: { actorId: row.actor_id ?? null, clientId: row.client_id ?? null, generation: row.generation ? integer(row.generation) : null, status: activeControl ? row.actor_id === identity.actorId && row.client_id === identity.clientId ? 'HELD' : 'OTHER_CLIENT' : 'UNASSIGNED' },
      };
    });
  }
}
