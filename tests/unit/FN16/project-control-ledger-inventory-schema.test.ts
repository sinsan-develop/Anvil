import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
test('controlLedger schema exact three tables and no resources or authority restoration',()=>{const u=new URL('../../../apps/server/modules/backups/project-control-ledger-inventory.ts',import.meta.url);assert(existsSync(u));const s=readFileSync(u,'utf8');for(const table of['commands','authorization_receipts','audit_events'])assert(s.includes(table));assert(!/currentPolicy\(|authorizeMaterial\(|Date\.now\(|readFile|SELECT \*/.test(s));assert(!/\b(?:INSERT INTO|UPDATE anvil|DELETE FROM|CREATE TABLE|GRANT SELECT)\b/.test(s));assert(!/auth_audit_events|authentication_sessions|permission_policies/.test(s));assert(s.includes('draft_id'));});
