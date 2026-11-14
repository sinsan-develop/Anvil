import test from 'node:test';
import assert from 'node:assert/strict';
const options:any=await import('../../../apps/connector/adapters/secondary/start-options.ts');
test('Claude 원 Options 순수 검산은 세 필드만 보존하고 기본값/실행권한을 만들지 않는다',()=>{
 assert.equal(typeof options.readClaudeQueryParams,'function');
 assert.deepEqual(options.readClaudeQueryParams({claudeQueryParams:{model:'auto'}}),{model:'auto'});
 assert.deepEqual(options.readClaudeQueryParams({claudeQueryParams:{model:'qa',maxTurns:2,maxBudgetUsd:0}}),{model:'qa',maxTurns:2,maxBudgetUsd:0});
 for(const raw of [{claudeQueryParams:{model:'qa',tools:[]}},{claudeQueryParams:{model:'qa',cwd:'x'}},{claudeQueryParams:{model:'qa',maxTurns:0}},{claudeQueryParams:{model:'qa',maxBudgetUsd:-1}},{claudeQueryParams:{model:''}},{model:'qa'}])assert.throws(()=>options.readClaudeQueryParams(raw));
});
