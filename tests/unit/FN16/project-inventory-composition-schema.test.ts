import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
const source=new URL('../../../apps/server/modules/backups/project-inventory-composition.ts',import.meta.url);
test('projectCompositionSchema 고정19 실제imports·새공개API/SQL쓰기0',()=>{assert(existsSync(source),'조합 제품 미구현');const s=readFileSync(source,'utf8');for(const name of ['document','conversation','knowledge','work-plan','design-trace','design-change','baseline','project-methodology','methodology-application','notification','assignment','responsible-session','context-preparation','execution-control','stage-budget','observation','understanding-permit','result-submission','result-review-history'])assert(s.includes(`from './${name}-inventory.ts'`),name);assert(!/\b(?:INSERT INTO|UPDATE anvil|DELETE FROM|CREATE TABLE|GRANT SELECT)\b/.test(s));assert(!/readFile|process\.dlopen|createBackup|saveBackupPolicy|app\.get|app\.post/.test(s));});
