import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../../apps/server/modules/backups/project-inventory-composition.ts',import.meta.url),'utf8');
test('feature composition optional trusted class context exists',()=>assert(source.includes('baselineContext')));

test('feature composition source profiles keep exact projection and fixed actual methods',()=>{for(const name of ['readDraftHistoryInventory','readDecisionHistoryInventory','authenticateInTransaction','assertArtifactBackupReadBudgetBinding','tightenArtifactBackupReadDeadline','readArtifactBackupReadUsage'])assert(source.includes(name));assert(source.includes("['projectId',...arrays,'selectedEvidenceHash','metadataObservationHash','scope','notCollected','atomicSnapshotVerified','fullProjectCoverage','restorable','authorizationRestoration','executionAuthorized','dispatchPerformed']"));assert(source.includes("metadataAccounting:'CHILD_24_DTO_PLUS_FEATURE_REPORTED_METADATA_PLUS_FINAL_ROOT_DTO'"));assert(source.includes("observationExport:'NOT_EXPORTED'"));assert(source.includes("fileCountMeaning:'DECLARED_24_UNIQUE_PLUS_CHILD_UNIQUE_SUM_UPPER_BOUND'"));assert(!source.includes('Promise.all('));});
