import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

// 미적용 후보의 배선·회귀 방지 검사일 뿐 SQL 구문/권한/COMMIT/경합 시험이 아니다.
const candidate = new URL('../../../db/migrations/0031_empty_project_methodology_application.sql.pending', import.meta.url);
test('후보는 옛 초기 생성 함수·권한을 바꾸지 않고 별도 적용 guard와 양방향 deferred 검사를 배선한다', async () => {
  const sql = await readFile(candidate, 'utf8');
  assert.doesNotMatch(sql, /CREATE\s+OR\s+REPLACE\s+FUNCTION|GRANT\s|SECURITY\s+DEFINER|UPDATE\s+anvil\.|DELETE\s+FROM/i);
  assert.match(sql, /EXECUTE FUNCTION anvil\.guard_initial_project_methodology\(\)/);
  assert.match(sql, /WHEN\s*\(NOT anvil\.fn02_is_apply_command\(\)\)/);
  assert.match(sql, /CREATE CONSTRAINT TRIGGER fn02_application_complete[\s\S]*?ON anvil\.project_methodologies[\s\S]*?DEFERRABLE INITIALLY DEFERRED/);
  assert.match(sql, /CREATE CONSTRAINT TRIGGER fn02_command_complete[\s\S]*?ON anvil\.commands[\s\S]*?DEFERRABLE INITIALLY DEFERRED/);
  assert.match(sql, /CREATE TRIGGER fn02_command_immutable BEFORE UPDATE OR DELETE ON anvil\.commands/);
});
test('7원장 각각의 선행 잠금과 잠금 뒤 별도 부재 조회를 후보에 남긴다', async () => {
  const sql = await readFile(candidate, 'utf8');
  const tables = ['assignment_drafts','execution_preparations','agent_sessions','executions','execution_grants','writer_claims','execution_commands'];
  for (const table of tables) {
    assert.ok(sql.includes(`'${table}'`), table + ' INSERT trigger 대상');
    assert.ok(sql.includes(`EXISTS(SELECT 1 FROM anvil.${table} WHERE project_id=pid)`), table + ' 직접 부재 조회');
  }
  assert.ok(sql.indexOf('PERFORM anvil.fn02_lock_project(pid)') < sql.indexOf('IF NOT anvil.fn02_history_empty(pid)'));
  assert.match(sql, /transaction_isolation[\s\S]*?read committed/);
  assert.match(sql, /CREATE TRIGGER aa_fn02_project_lock BEFORE INSERT/);
});
test('수신 원 command·이유·이전 적용·현재 권한·양식/검토를 후보가 결박하며 runner에 등록하지 않는다', async () => {
  const sql = await readFile(candidate, 'utf8');
  for (const needle of ['request_hash','previousApplicationRef','expectedApplicationVersion','EXPLICIT_EMPTY_PROJECT_METHODOLOGY_APPLICATION','authorization_receipts','scope_digest','permission_policy_versions','auth_sessions','methodology_reviews','form_reviews','user_common_audit_events','P01_APPROVED_SOURCE','REQUIRE_APPROVAL']) assert.ok(sql.includes(needle),needle);
  assert.match(sql, /fn02_assert_application\(NEW\.project_id,NEW\.id,cmd\.id,true\)/);
  assert.match(sql, /fn02_assert_application\(cmd\.project_id,application_id,cmd\.id,false\)/);
  for (const file of ['migrate-development.ts','source-root-migration.ts','source-read-migration.ts']) {
    const runner = await readFile(new URL('../../../scripts/' + file, import.meta.url),'utf8');
    assert.ok(!runner.includes('0031_empty_project_methodology_application'),file);
    assert.ok(!runner.includes('.sql.pending'),file);
  }
});
test('적용 후보는 확정 boolean을 신뢰하지 않고 그래프·5개 검토 항목을 별도 재검사한다',async()=>{
  const sql=await readFile(candidate,'utf8');
  assert.match(sql,/anvil\.fn02_graph_valid\(mv\.graph_json\) IS NOT TRUE/);
  assert.match(sql,/anvil\.fn02_accepted_items\(latest\.items_json\) IS NOT TRUE/);
  for(const id of ['METHOD_PURPOSE_SCOPE','METHOD_FLOW_CONTROL','METHOD_INPUT_OUTPUT','METHOD_COMPLETION_APPROVAL','METHOD_RECORD_LIMITS'])assert.ok(sql.includes(id));
});
