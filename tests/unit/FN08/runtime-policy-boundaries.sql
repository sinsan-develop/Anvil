-- 새 빈 격리 DB에 후보의 순수 canonical/state 함수만 생성한 뒤 실행할 벡터.
-- 정식 DB/계정/정책/명령은 읽거나 쓰지 않는다. 실행 전이며 PASS 자료가 아니다.
DO $$
DECLARE item record;actual text;
BEGIN
 FOR item IN SELECT * FROM (VALUES
  ('null'::jsonb,false),('"APPLIED"'::jsonb,true),('"REVOKED"'::jsonb,true),('"UNKNOWN"'::jsonb,false),('false'::jsonb,false),('1'::jsonb,false),('{}'::jsonb,false)
 ) v(value,expected) LOOP
  IF anvil.limit_policy_state_valid(item.value) IS DISTINCT FROM item.expected THEN RAISE EXCEPTION 'LIMIT_POLICY_STATE_VECTOR';END IF;
 END LOOP;
 IF anvil.limit_policy_state_valid(NULL) IS DISTINCT FROM false THEN RAISE EXCEPTION 'LIMIT_POLICY_MISSING_STATE_VECTOR';END IF;
 FOR item IN SELECT * FROM (VALUES
  ('0'::jsonb,'0'),('-0'::jsonb,'0'),('0.1'::jsonb,'0.1'),('1e-7'::jsonb,'1e-7'),('1e-6'::jsonb,'0.000001'),
  ('0.0000012'::jsonb,'0.0000012'),('1.2e-7'::jsonb,'1.2e-7'),('1e15'::jsonb,'1000000000000000'),
  ('5e-324'::jsonb,'5e-324'),('9007199254740991'::jsonb,'9007199254740991'),('1.0000000000000002'::jsonb,'1.0000000000000002')
 ) v(value,expected) LOOP
  actual=anvil.execution_authority_canonical(jsonb_build_object('maxCost',item.value,'currency','USD'));
  IF actual IS DISTINCT FROM ('{"currency":"USD","maxCost":'||item.expected||'}') THEN RAISE EXCEPTION 'LIMIT_POLICY_NUMBER_VECTOR';END IF;
 END LOOP;
END;
$$;
SELECT 'LIMIT_POLICY_PURE_BOUNDARY_VECTORS_PASS' AS marker;
