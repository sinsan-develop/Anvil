-- DB 초기 queue guard의 runtime 정책 판정. 실제 Agent/사용자 허가 부여 시험이 아니다.
DO $$
DECLARE pid uuid='11111111-1111-4111-8111-111111111111';eid uuid='22222222-2222-4222-8222-222222222222';
 at_time timestamptz='2026-10-19T12:00:00.000Z';deadline timestamptz='2026-10-19T12:05:00.000Z';
 ref jsonb;scopes jsonb;allow_rule jsonb;deny_rule jsonb;input_rules jsonb;result_time timestamptz;item jsonb;
BEGIN
 ref=jsonb_build_object('id',pid,'version',1,'contentHash',repeat('a',64));
 scopes=jsonb_build_array(jsonb_build_object('sourceRootRef',ref,'mappingRef',NULL,'observationRef',ref,'baselineRef',ref,
  'targets',jsonb_build_array(jsonb_build_object('relativePath','src/main.ts','kind','FILE','access','READ','recursive',false))));
 allow_rule=jsonb_build_object('ruleId','allow','subjectRef',jsonb_build_object('kind','HUMAN','userId',pid),
  'operations',jsonb_build_array('authorizeExecution','queueExecutionCommand'),'targetScopes',jsonb_build_array(jsonb_build_object('kind','EXECUTION','projectId',pid,'executionId',eid,'executionGeneration',1,'sourceScopes',scopes)),
  'disposition','AUTO','limitPolicyRef',ref,'expiresAt','2026-10-19T12:05:00.000Z');
 result_time=anvil.execution_policy_deadline(jsonb_build_array(allow_rule),pid,eid,1,pid,'authorizeExecution',ref,scopes,at_time);
 IF result_time IS DISTINCT FROM deadline THEN RAISE EXCEPTION 'RUNTIME_POLICY_VALID_SCOPE_FAILED';END IF;
 -- 제한 일부의 잘못된 값도 broad AUTO와 병존해 우회되지 않는다.
 FOREACH item IN ARRAY ARRAY['["DENY"]'::jsonb,'["REQUIRE_APPROVAL"]'::jsonb,'null'::jsonb,'true'::jsonb,'{}'::jsonb] LOOP
  input_rules=jsonb_build_array(allow_rule,jsonb_set(jsonb_set(allow_rule,'{ruleId}','"invalid"'),'{disposition}',item));
  IF anvil.execution_policy_deadline(input_rules,pid,eid,1,pid,'authorizeExecution',ref,scopes,at_time) IS NOT NULL THEN RAISE EXCEPTION 'RUNTIME_POLICY_MALFORMED_DISPOSITION_OPEN';END IF;
 END LOOP;
 deny_rule=jsonb_set(jsonb_set(allow_rule,'{ruleId}','"deny"'),'{disposition}','"DENY"');
 deny_rule=jsonb_set(deny_rule,'{limitPolicyRef,version}','2');
 deny_rule=jsonb_set(deny_rule,'{targetScopes,0,sourceScopes,0,targets,0,relativePath}','"SRC/MAIN.TS"');
 IF anvil.execution_policy_deadline(jsonb_build_array(allow_rule,deny_rule),pid,eid,1,pid,'authorizeExecution',ref,scopes,at_time) IS NOT NULL THEN RAISE EXCEPTION 'RUNTIME_POLICY_DENY_ALIAS_OPEN';END IF;
 IF anvil.execution_policy_deadline(jsonb_build_array(allow_rule),pid,pid,1,pid,'authorizeExecution',ref,scopes,at_time) IS NOT NULL THEN RAISE EXCEPTION 'RUNTIME_POLICY_OTHER_EXECUTION_OPEN';END IF;
 IF anvil.execution_policy_deadline(jsonb_build_array(allow_rule),pid,eid,2,pid,'authorizeExecution',ref,scopes,at_time) IS NOT NULL THEN RAISE EXCEPTION 'RUNTIME_POLICY_OLD_GENERATION_OPEN';END IF;
 IF anvil.execution_policy_deadline(jsonb_build_array(allow_rule),pid,eid,1,pid,'authorizeExecution',ref,scopes,deadline) IS NOT NULL THEN RAISE EXCEPTION 'RUNTIME_POLICY_EXPIRED_OPEN';END IF;
 IF anvil.execution_policy_deadline(jsonb_build_array(allow_rule),pid,eid,1,pid,'authorizeExecution',jsonb_set(ref,'{version}','2'),scopes,at_time) IS NOT NULL THEN RAISE EXCEPTION 'RUNTIME_POLICY_BUDGET_REF_OPEN';END IF;
 IF anvil.execution_policy_deadline(jsonb_build_array(allow_rule),pid,eid,1,pid,'authorizeExecution',ref,jsonb_set(scopes,'{0,targets,0,access}','"WRITE"'),at_time) IS NOT NULL THEN RAISE EXCEPTION 'RUNTIME_POLICY_READ_WRITE_OPEN';END IF;
 IF anvil.execution_policy_deadline(jsonb_build_array(allow_rule),pid,eid,1,pid,'authorizeExecution',ref,jsonb_set(scopes,'{0,baselineRef,version}','2'),at_time) IS NOT NULL THEN RAISE EXCEPTION 'RUNTIME_POLICY_SOURCE_REF_OPEN';END IF;
 IF anvil.execution_policy_deadline(jsonb_build_array(allow_rule),pid,eid,1,pid,'authorizeExecution',ref,jsonb_set(scopes,'{0,targets,0,relativePath}','"src/outside.ts"'),at_time) IS NOT NULL THEN RAISE EXCEPTION 'RUNTIME_POLICY_FILE_SCOPE_OPEN';END IF;
 IF anvil.execution_policy_deadline(jsonb_build_array(allow_rule,jsonb_set(jsonb_set(deny_rule,'{limitPolicyRef}',ref),'{disposition}','"REQUIRE_APPROVAL"')),pid,eid,1,pid,'authorizeExecution',ref,scopes,at_time) IS NOT NULL THEN RAISE EXCEPTION 'RUNTIME_POLICY_PENDING_APPROVAL_OPEN';END IF;
END;
$$;
SELECT 'C2_RUNTIME_POLICY_SQL_BOUNDARIES_PASS';
