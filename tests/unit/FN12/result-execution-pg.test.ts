import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {resultExecutionFixture} from './result-execution-fixture.ts';
import {readSyntheticResultExecutionReference} from '../../../apps/server/modules/results/result-execution-reference.ts';
const mod:any=await import('../../../apps/server/modules/results/result-execution-pg.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const id=(n:number)=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`,hash=(v:unknown)=>contentHash(canonicalJson(v));
import {pgExecutionFixture as fixture} from './result-execution-pg-fixture.ts';
async function read(f:ReturnType<typeof fixture>){assert.equal(typeof mod.readPgResultExecution,'function','결과의 실제 PG 원행 대조 연결 누락');return mod.readPgResultExecution(f.db,f.scope);}
test('PG의정확실행/원START/grant/명령/영수증/감사를대조하고현재실행허가로승격하지않는다',async()=>{
 const f=fixture(),value=await read(f);assert.deepEqual(value.scope,f.scope);assert.equal(value.currentAuthorizationVerified,false);assert.equal(value.executionAuthorized,false);assert.equal(value.dispatchPerformed,false);assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].values,[f.scope.projectId,f.scope.executionRef.id,f.scope.executionRef.version]);assert.match(f.calls[0].sql,/anvil\.execution_commands/);assert.match(f.calls[0].sql,/anvil\.authorization_receipts/);assert.doesNotMatch(f.calls[0].sql,/\b(INSERT|UPDATE|DELETE|BEGIN|COMMIT)\b/i);
});
test('없는행/중복/다른scope·명령/봉투·영수증/감사불일치는원기록으로반환하지않는다',async()=>{
 for(const mutate of [(f:any)=>f.rows([]),(f:any)=>f.rows([f.row,f.row]),(f:any)=>f.row.execution.project_id=id(70),(f:any)=>f.row.command.actor_id=id(71),(f:any)=>f.row.receipt.scope_digest='f'.repeat(64),(f:any)=>f.row.queued.envelope_hash='f'.repeat(64),(f:any)=>f.row.command.result_ref.data.snapshot.state='OTHER',(f:any)=>f.row.audit_count=0,(f:any)=>f.scope.executionRef.contentHash='f'.repeat(64)]){const f=fixture();mutate(f);await assert.rejects(read(f),/RESULT_EXECUTION_SOURCE_INVALID/);}
});
