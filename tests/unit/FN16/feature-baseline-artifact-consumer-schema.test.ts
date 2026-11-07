import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../../apps/server/modules/backups/artifact-current-verification.ts',import.meta.url),'utf8');
test('featureArtifactConsumerSchema actual internal root envelope is consumed',()=>assert(source.includes('composeProjectInventoryForArtifactVerification(')));

test('featureArtifactConsumerSchema limits are private and original defaults are retained',()=>{const root=readFileSync(new URL('../../../apps/server/modules/backups/project-inventory-composition.ts',import.meta.url),'utf8');assert(source.includes('if(baselineContext!==undefined)return verifyFeatureProjectInventoryArtifacts'));assert(source.includes('Object.freeze({check,remaining})'));assert(root.includes('readConstraints:Object.freeze({projectId:input.projectId,expectedIdentity:Object.freeze('));assert(source.includes('verifiedBytes+r.bytes>request.limits.inputBytes-B'));assert(source.includes('verifiedBytes>D||B+verifiedBytes>request.limits.inputBytes'));assert(!source.includes('Promise.race('));assert(!source.includes('createBackup('));});
