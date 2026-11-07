import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
test('permissionPolicySchema 고정5표·현재권한/쓰기/실자원0',()=>{const u=new URL('../../../apps/server/modules/backups/permission-policy-inventory.ts',import.meta.url);assert(existsSync(u));const s=readFileSync(u,'utf8');for(const table of['permission_policies','permission_policy_versions','commands','authorization_receipts','audit_events'])assert(s.includes(table));assert(!/materialRules\(|currentPolicy\(|authorizeMaterial\(|Date\.now\(/.test(s));assert(!/\b(?:INSERT INTO|UPDATE anvil|DELETE FROM|CREATE TABLE|GRANT SELECT)\b/.test(s));assert(!/readFile|\.connect\([^)]*postgres|auth_audit_events|SELECT \*/.test(s));});
