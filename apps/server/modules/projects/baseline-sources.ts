import {assertArtifactBackupReadBudget,type ArtifactBackupReadBudget} from '../../storage/artifact-backup-budget-read.ts';
import type { PoolClient } from 'pg';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { projectMember } from '../access/project-command.ts';
import type { SourceReadRecords } from '../connections/source-read-records.ts';
import type { ArtifactStore } from '../../storage/artifact-store.ts';
import { assertStoredArtifactReadable } from '../../storage/sensitive-inspection.ts';
import { readSourceDeclarationRecord } from './source-declaration-records.ts';
import { readBaselineDraftInput, type BaselineEvidenceRef } from './baseline-input.ts';

interface BaselineSourceReaders {
 snapshots: Pick<SourceReadRecords, 'readSnapshot'>;
 artifacts: Pick<ArtifactStore, 'read'> | null;
 declaration?: typeof readSourceDeclarationRecord;
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
/** 현재 인증 transaction의 보호 reader·원문만 소비하며 관측/내용/실행 권한을 발급하지 않는다. */
export class ProjectBaselineSources {
 readonly readers: BaselineSourceReaders;
 constructor(readers: BaselineSourceReaders) { this.readers = readers; }
 async resolve(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, value: unknown, backupBudget?: ArtifactBackupReadBudget) {
 if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
  const analysis = readBaselineDraftInput(value), input = analysis.input;
  if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
  const member = await projectMember(db, actor, projectId, true);
  if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
  if (member.id !== projectId || member.participation !== 'OWNER') throw new AuthFailure('PROJECT_WRITE_DENIED', 403);
  if (member.archived_at) throw new AuthFailure('PROJECT_ARCHIVED', 412);
  const bindings = (await db.query(`SELECT b.*,c.operation,c.state command_state,c.actor_id command_actor,c.client_id command_client,c.result_ref command_result,r.command_id receipt_command
   FROM anvil.project_source_declarations b LEFT JOIN anvil.commands c ON c.id=b.command_id AND c.project_id=b.project_id
   LEFT JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id
   WHERE b.project_id=$1 FOR SHARE OF b`, [projectId])).rows;
   if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
  if (bindings.length > 1) throw new AuthFailure('SOURCE_DECLARATION_INTEGRITY_FAILED', 503);
  const binding = bindings[0];
  let declaration: { ref: NonNullable<typeof input.source.declarationRef>; authority: 'USER_DECLARED'; readiness: 'UNVERIFIED' } | null = null;
  if (binding) {
   if (binding.project_id !== projectId || binding.operation !== 'createProject' || binding.command_state !== 'APPLIED'
    || binding.command_actor !== binding.created_by || binding.command_client !== binding.client_id || binding.command_result?.id !== projectId
    || binding.receipt_command !== binding.command_id) throw new AuthFailure('SOURCE_DECLARATION_INTEGRITY_FAILED', 503);
   if (!input.source.declarationRef) throw new AuthFailure('BASELINE_SOURCE_DECLARATION_REQUIRED', 412);
   if (input.source.declarationRef.id !== binding.declaration_id || input.source.declarationRef.version !== Number(binding.declaration_version)) throw new AuthFailure('BASELINE_SOURCE_MISMATCH', 409);
   const original = await (this.readers.declaration ?? readSourceDeclarationRecord)(db, binding.declaration_id, Number(binding.declaration_version));
   if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
   if (!same(original.ref, input.source.declarationRef) || original.authority !== 'USER_DECLARED' || original.readiness !== 'UNVERIFIED') throw new AuthFailure('BASELINE_SOURCE_MISMATCH', 409);
   declaration = { ref: structuredClone(original.ref), authority: original.authority, readiness: original.readiness };
  } else if (input.source.declarationRef !== null) throw new AuthFailure('NOT_FOUND', 404);

  let observation: {
   snapshotRef: NonNullable<typeof input.source.snapshotRef>; grantRef: NonNullable<typeof input.source.grantRef>;
   sourceRootRef: NonNullable<typeof input.source.sourceRootRef>; connectorRef: { id: string; version: number };
   observedSummary: Awaited<ReturnType<SourceReadRecords['readSnapshot']>>['observedSummary'];
   observedAt: string; finishedAt: string; receivedAt: string; evidenceClass: 'CONNECTOR_REPORTED'; osVerification: 'UNVERIFIED'; executionAuthorized: false;
  } | null = null;
  if (input.source.kind === 'ATTRIBUTE_REPORT') {
   const stored = await this.readers.snapshots.readSnapshot(db, actor, projectId, input.source.snapshotRef!.id);
   if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
   if (stored.projectId !== projectId || !same(stored.snapshotRef, input.source.snapshotRef) || !same(stored.grantRef, input.source.grantRef)
    || !same(stored.sourceRootRef, input.source.sourceRootRef) || stored.rawAllowed !== true || stored.evidenceClass !== 'CONNECTOR_REPORTED'
    || stored.osVerification !== 'UNVERIFIED' || stored.executionAuthorized !== false || stored.agentDispatchPerformed !== false || stored.baselineConfirmed !== false) throw new AuthFailure('BASELINE_SOURCE_MISMATCH', 409);
   observation = { snapshotRef: structuredClone(input.source.snapshotRef!), grantRef: structuredClone(input.source.grantRef!), sourceRootRef: structuredClone(input.source.sourceRootRef!),
    connectorRef: structuredClone(stored.connectorRef), observedSummary: structuredClone(stored.observedSummary), observedAt: stored.observedAt, finishedAt: stored.finishedAt, receivedAt: stored.receivedAt,
    evidenceClass: 'CONNECTOR_REPORTED', osVerification: 'UNVERIFIED', executionAuthorized: false };
  }
  const evidenceBindings: { itemId: string; evidenceRefs: BaselineEvidenceRef[] }[] = [];
  for (const item of input.items) {
   for (const ref of item.evidenceRefs) {
    const rows = (await db.query('SELECT * FROM anvil.artifacts WHERE project_id=$1 AND id=$2 FOR SHARE', [projectId, ref.artifactId])).rows;
    if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
    if (!rows.length) throw new AuthFailure('NOT_FOUND', 404);
    if (rows.length !== 1) throw new AuthFailure('ARTIFACT_INTEGRITY_FAILED', 503);
    const row = rows[0];
    if (row.project_id !== projectId || row.id !== ref.artifactId || Number(row.bytes) !== ref.bytes || row.content_hash !== ref.contentHash
     || row.media_type !== ref.mediaType || row.storage_key !== `blobs/${projectId}/${ref.artifactId}`) throw new AuthFailure('ARTIFACT_INTEGRITY_FAILED', 503);
    if (row.state === 'QUARANTINED') throw new AuthFailure('ARTIFACT_QUARANTINED', 412);
    if (!this.readers.artifacts) throw new AuthFailure('ARTIFACT_STORAGE_UNCONFIGURED', 412);
    const bytes = await (backupBudget===undefined?this.readers.artifacts.read(projectId, ref.artifactId, { bytes: ref.bytes, contentHash: ref.contentHash }):this.readers.artifacts.read(projectId, ref.artifactId, { bytes: ref.bytes, contentHash: ref.contentHash },backupBudget));
    if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
    if (bytes.length !== ref.bytes || contentHash(bytes) !== ref.contentHash) throw new AuthFailure('ARTIFACT_INTEGRITY_FAILED', 503);
    assertStoredArtifactReadable(row, bytes);
    if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
   }
   evidenceBindings.push({ itemId: item.itemId, evidenceRefs: structuredClone(item.evidenceRefs) });
  }
  if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
  return { ...analysis, sourceBinding: { kind: input.source.kind, declaration, observation, declarationReportRelation: 'UNVERIFIED' as const }, evidenceBindings };
 }
}
