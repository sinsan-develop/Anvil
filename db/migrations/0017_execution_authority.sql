-- 승인 P1 C2의 비실행 한도 작성 부분 후보. 실제 적용/SQL 검수는 미실행이다.
-- execution/grant/outbox/usage reservation은 후속 C2이며 이 파일만으로 실행 허가가 생기지 않는다.
CREATE TABLE anvil.limit_policy_versions (
 project_id uuid NOT NULL REFERENCES anvil.projects(id),policy_id uuid NOT NULL,version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL CHECK(jsonb_typeof(snapshot_json)='object'),
 scope_json jsonb GENERATED ALWAYS AS (snapshot_json->'scope') STORED,
 created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,policy_id,version),UNIQUE(project_id,scope_json,version),UNIQUE(project_id,command_id),
 FOREIGN KEY(project_id,created_by) REFERENCES anvil.project_members(project_id,user_id),
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id),FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id)
);
GRANT SELECT,INSERT ON anvil.limit_policy_versions TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.limit_policy_versions FROM anvil_v3_app;

-- 기존 초안 canonical은 safe 정수 전용이다. 이 정책의 비용에는 IEEE754 소수도 있으므로
-- 지역 함수에서 shortest float8 표기의 소수점/지수를 JSON.stringify 경계로 정규화한다.
-- 기존 적용 SQL/공유 canonical은 교체하지 않는다. 실제 PG 교차 벡터 검수 전 후보이다.
CREATE FUNCTION anvil.execution_authority_number(value jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT SET extra_float_digits=3 AS $$
DECLARE raw text;parts text[];digits text;sign text;power integer;zero_prefix integer;
BEGIN
 IF jsonb_typeof(value)<>'number' THEN RAISE EXCEPTION 'EXECUTION_AUTHORITY_NUMBER_INVALID';END IF;
 raw=(value::text)::double precision::text;
 IF raw IN('0','-0') THEN RETURN '0';END IF;
 parts=regexp_match(raw,'^(-?)([0-9]+)(?:\.([0-9]+))?(?:e([+-]?[0-9]+))?$');
 IF parts IS NULL THEN RAISE EXCEPTION 'EXECUTION_AUTHORITY_NUMBER_INVALID';END IF;
 sign=parts[1];digits=parts[2]||COALESCE(parts[3],'');power=length(parts[2])-1+COALESCE(parts[4],'0')::integer;
 zero_prefix=length(digits)-length(ltrim(digits,'0'));power=power-zero_prefix;digits=rtrim(ltrim(digits,'0'),'0');
 IF digits='' THEN RETURN '0';END IF;
 IF power < -6 OR power >=21 THEN
  RETURN sign||left(digits,1)||(CASE WHEN length(digits)>1 THEN '.'||substr(digits,2) ELSE '' END)||'e'||(CASE WHEN power>=0 THEN '+' ELSE '' END)||power::text;
 ELSIF power<0 THEN RETURN sign||'0.'||repeat('0',-power-1)||digits;
 ELSIF power>=length(digits)-1 THEN RETURN sign||digits||repeat('0',power-length(digits)+1);
 ELSE RETURN sign||left(digits,power+1)||'.'||substr(digits,power+2);END IF;
END;
$$;
CREATE FUNCTION anvil.execution_authority_canonical(value jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE encoded text;
BEGIN
 CASE jsonb_typeof(value)
 WHEN 'object' THEN SELECT '{'||COALESCE(string_agg(to_jsonb(key)::text||':'||anvil.execution_authority_canonical(v),',' ORDER BY key COLLATE "C"),'')||'}' INTO encoded FROM jsonb_each(value) item(key,v);
 WHEN 'array' THEN SELECT '['||COALESCE(string_agg(anvil.execution_authority_canonical(v),',' ORDER BY ordinal),'')||']' INTO encoded FROM jsonb_array_elements(value) WITH ORDINALITY item(v,ordinal);
 WHEN 'number' THEN encoded=anvil.execution_authority_number(value);
 ELSE encoded=value::text;
 END CASE;
 RETURN encoded;
END;
$$;
CREATE FUNCTION anvil.limit_policy_state_valid(state jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT COALESCE(jsonb_typeof(state)='string' AND (state#>>'{}') IN('APPLIED','REVOKED'),false);
$$;

CREATE FUNCTION anvil.limit_policy_limits_valid(limits jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE item text;amount numeric;
BEGIN
 IF jsonb_typeof(limits) IS DISTINCT FROM 'object' OR NOT(limits ?& ARRAY['maxAttempts','maxElapsedMs','maxCalls','maxConcurrentAssignments','maxSpoolBytes','maxOfflineMs'])
  OR (SELECT count(*) FROM jsonb_object_keys(limits)) NOT IN(6,8)
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(limits) key WHERE key NOT IN('maxAttempts','maxElapsedMs','maxCalls','maxConcurrentAssignments','maxSpoolBytes','maxOfflineMs','maxCost','currency'))
  OR (limits ? 'maxCost') IS DISTINCT FROM (limits ? 'currency') THEN RETURN false;END IF;
 FOREACH item IN ARRAY ARRAY['maxAttempts','maxElapsedMs','maxCalls','maxConcurrentAssignments','maxSpoolBytes','maxOfflineMs'] LOOP
  IF jsonb_typeof(limits->item) IS DISTINCT FROM 'number' THEN RETURN false;END IF;
  amount=(limits->>item)::numeric;
  IF amount<>trunc(amount) OR amount<(CASE WHEN item='maxOfflineMs' THEN 0 ELSE 1 END)
   OR amount>(CASE item WHEN 'maxAttempts' THEN 3 WHEN 'maxElapsedMs' THEN 7200000 WHEN 'maxCalls' THEN 50
    WHEN 'maxConcurrentAssignments' THEN 1 WHEN 'maxSpoolBytes' THEN 1073741824 WHEN 'maxOfflineMs' THEN 300000 END) THEN RETURN false;END IF;
 END LOOP;
 IF (limits->>'maxOfflineMs')::numeric>(limits->>'maxElapsedMs')::numeric THEN RETURN false;END IF;
 IF limits ? 'maxCost' THEN
  IF jsonb_typeof(limits->'maxCost') IS DISTINCT FROM 'number' OR jsonb_typeof(limits->'currency') IS DISTINCT FROM 'string'
   OR limits->>'currency' !~ '^[A-Z]{3}$' OR (limits->>'maxCost')::numeric<0 OR (limits->>'maxCost')::numeric>9007199254740991 THEN RETURN false;END IF;
 END IF;
 RETURN true;
END;
$$;

-- 현재 HUMAN 세션/제어/정책/명령/감사 결박만 허용한다. 문서 정책의 null 제한을 바꾸지 않는다.
CREATE FUNCTION anvil.limit_policy_authorized(pid uuid,op text) RETURNS boolean LANGUAGE sql AS $$
 SELECT op IN('applyLimitPolicy','revokeLimitPolicy') AND EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id AND ar.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.projects p ON p.id=c.project_id AND p.archived_at IS NULL
 JOIN anvil.permission_policies pp ON pp.project_id=c.project_id AND pp.id::text=c.policy_ref->>'id' AND pp.head_version::text=c.policy_ref->>'version'
 JOIN anvil.permission_policy_versions pv ON pv.project_id=pp.project_id AND pv.policy_id=pp.id AND pv.version=pp.head_version AND pv.content_hash=c.policy_ref->>'contentHash'
 WHERE c.id::text=current_setting('anvil.command_id',true) AND c.project_id=pid AND c.scope_kind='PROJECT' AND c.scope_id=pid AND c.operation=op AND c.state='APPLIED'
 AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.approval_consumption_id IS NULL AND c.payload_ref IS NULL AND ar.approval_decision_ref IS NULL
 AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND EXISTS(SELECT 1 FROM anvil.audit_events a WHERE a.project_id=pid AND a.command_id=c.id AND a.operation_id=c.operation_id AND a.outcome='APPLIED' AND a.source_kind='HUMAN_COMMAND' AND a.scope_digest=ar.scope_digest)
 AND EXISTS(SELECT 1 FROM anvil.auth_sessions s JOIN anvil.users u ON u.id=s.user_id JOIN anvil.clients cl ON cl.id=s.client_id AND cl.user_id=s.user_id
  WHERE s.user_id=c.actor_id AND s.client_id=c.client_id AND s.revoked_at IS NULL AND u.status='ACTIVE' AND u.revoked_at IS NULL AND cl.revoked_at IS NULL
  AND s.credential_generation=u.credential_generation AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp())
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? op AND rule->>'disposition'='AUTO' AND rule->'limitPolicyRef'='null'::jsonb AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? op AND rule->>'disposition' IN('DENY','REQUIRE_APPROVAL') AND (rule->>'expiresAt')::timestamptz>clock_timestamp()));
$$;

CREATE FUNCTION anvil.guard_limit_policy_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;previous anvil.limit_policy_versions%ROWTYPE;s jsonb;scope jsonb;ref jsonb;previous_ref jsonb;payload jsonb;op text;status text;target jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'LIMIT_POLICY_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 PERFORM id FROM anvil.projects WHERE id=NEW.project_id FOR UPDATE;
 s=NEW.snapshot_json;scope=s->'scope';
 IF jsonb_typeof(s) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(s))<>11
  OR NOT(s ?& ARRAY['limits','scope','reason','policyBaseVersion','state','previousRef','decidedBy','decidedAt','expiresAt','executionAuthorized','dispatchPerformed'])
  OR scope IS DISTINCT FROM jsonb_build_object('kind','PROJECT','projectId',NEW.project_id)
  OR NOT COALESCE(anvil.limit_policy_limits_valid(s->'limits'),false) OR NOT anvil.limit_policy_state_valid(s->'state')
  OR s->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR s->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR jsonb_typeof(s->'reason') IS DISTINCT FROM 'string' OR NOT COALESCE(anvil.assignment_content_reason(s->>'reason'),false)
  OR jsonb_typeof(s->'decidedAt') IS DISTINCT FROM 'string' OR jsonb_typeof(s->'expiresAt') IS DISTINCT FROM 'string'
  THEN RAISE EXCEPTION 'LIMIT_POLICY_INPUT_INVALID' USING ERRCODE='42501';END IF;
 op=(CASE WHEN s->>'state'='APPLIED' THEN 'applyLimitPolicy' ELSE 'revokeLimitPolicy' END);
 status=(CASE WHEN s->>'state'='APPLIED' THEN 'LIMIT_POLICY_APPLIED' ELSE 'LIMIT_POLICY_REVOKED' END);
 ref=jsonb_build_object('id',NEW.policy_id,'version',NEW.version,'contentHash',NEW.content_hash);
 SELECT * INTO cmd FROM anvil.commands WHERE id::text=current_setting('anvil.command_id',true);
 IF NOT COALESCE(anvil.limit_policy_authorized(NEW.project_id,op),false) OR cmd.id IS NULL OR NEW.command_id IS DISTINCT FROM cmd.id
  OR cmd.project_id IS DISTINCT FROM NEW.project_id OR NEW.created_by IS DISTINCT FROM cmd.actor_id OR NEW.client_id IS DISTINCT FROM cmd.client_id
  OR NEW.content_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.execution_authority_canonical(s),'UTF8')),'hex') OR octet_length(anvil.execution_authority_canonical(s))>2097152
  OR cmd.result_ref->>'status' IS DISTINCT FROM 'APPLIED' OR cmd.result_ref->>'projectId' IS DISTINCT FROM NEW.project_id::text
  OR cmd.result_ref->'targetId' IS DISTINCT FROM to_jsonb(NEW.policy_id) OR cmd.result_ref->'version' IS DISTINCT FROM to_jsonb(NEW.version)
  OR cmd.result_ref->'data'->>'status' IS DISTINCT FROM status OR cmd.result_ref->'data'->'ref' IS DISTINCT FROM ref OR cmd.result_ref->'data'->'snapshot' IS DISTINCT FROM s
  OR s->'decidedBy' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',cmd.actor_id)
  OR (s->>'decidedAt')::timestamptz IS DISTINCT FROM date_trunc('milliseconds',transaction_timestamp())
  THEN RAISE EXCEPTION 'LIMIT_POLICY_EXACT_CURRENT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 -- BEFORE trigger에서 생성열 NEW.scope_json은 아직 없으므로 검증된 JSON local scope만 쓴다.
 SELECT * INTO previous FROM anvil.limit_policy_versions v WHERE v.project_id=NEW.project_id AND v.scope_json=scope ORDER BY v.version DESC LIMIT 1;
 IF previous.policy_id IS NULL THEN
  IF NEW.version<>1 OR s->>'state' IS DISTINCT FROM 'APPLIED' OR s->'previousRef' IS DISTINCT FROM 'null'::jsonb
   OR EXISTS(SELECT 1 FROM anvil.limit_policy_versions v WHERE v.project_id=NEW.project_id AND v.policy_id=NEW.policy_id)
   THEN RAISE EXCEPTION 'LIMIT_POLICY_INITIAL_VERSION_REQUIRED' USING ERRCODE='42501';END IF;
  target='null'::jsonb;
 ELSE
  previous_ref=jsonb_build_object('id',previous.policy_id,'version',previous.version,'contentHash',previous.content_hash);
  IF NEW.policy_id IS DISTINCT FROM previous.policy_id OR NEW.version<>previous.version+1 OR s->'previousRef' IS DISTINCT FROM previous_ref
   OR (s->>'state'='REVOKED' AND (previous.snapshot_json->>'state' IS DISTINCT FROM 'APPLIED' OR s->'limits' IS DISTINCT FROM previous.snapshot_json->'limits'
    OR s->'expiresAt' IS DISTINCT FROM previous.snapshot_json->'expiresAt')) THEN RAISE EXCEPTION 'LIMIT_POLICY_BASE_VERSION_CONFLICT' USING ERRCODE='42501';END IF;
  target=to_jsonb(previous.policy_id);
 END IF;
 IF s->'policyBaseVersion' IS DISTINCT FROM to_jsonb(NEW.version-1) OR cmd.expected_version IS DISTINCT FROM NEW.version-1
  OR (s->>'state'='APPLIED' AND (s->>'expiresAt')::timestamptz IS DISTINCT FROM (s->>'decidedAt')::timestamptz+((s->'limits'->>'maxElapsedMs')::bigint*interval '1 millisecond'))
  THEN RAISE EXCEPTION 'LIMIT_POLICY_FINITE_VERSION_REQUIRED' USING ERRCODE='42501';END IF;
 payload=jsonb_build_object('scope',scope,'reason',s->'reason','policyBaseVersion',s->'policyBaseVersion');
 IF s->>'state'='APPLIED' THEN payload=payload||jsonb_build_object('limits',s->'limits');END IF;
 IF cmd.request_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.execution_authority_canonical(jsonb_build_object(
  'schemaVersion',1,'projectId',NEW.project_id,'commandId',cmd.command_id,'clientId',cmd.client_id,'controlGeneration',cmd.control_generation,
  'operation',op,'targetId',target,'expectedVersion',NEW.version-1,'baselineRefs','[]'::jsonb,'approvalRef','null'::jsonb,'payload',payload)),'UTF8')),'hex')
  THEN RAISE EXCEPTION 'LIMIT_POLICY_REQUEST_HASH_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER limit_policy_version_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.limit_policy_versions FOR EACH ROW EXECUTE FUNCTION anvil.guard_limit_policy_version();

-- C2 예산 계획의 원문 이력 모델. runtime grant/queue의 정확 명령·허가·감사 저장을 연결하기 전에는
-- app의 mutation을 열지 않는다. 아래 SELECT/계획이 예약 저장 성공이나 실행 허가를 뜻하지 않는다.
CREATE TABLE anvil.usage_reservations (
 project_id uuid NOT NULL REFERENCES anvil.projects(id),reservation_id uuid NOT NULL,version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),
 server_sequence bigint NOT NULL CHECK(server_sequence BETWEEN 1 AND 9007199254740991),command_id uuid NOT NULL,
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL CHECK(jsonb_typeof(snapshot_json)='object'),
 policy_id uuid GENERATED ALWAYS AS ((snapshot_json->'claim'->'policyRef'->>'id')::uuid) STORED,
 policy_version bigint GENERATED ALWAYS AS ((snapshot_json->'claim'->'policyRef'->>'version')::bigint) STORED,
 PRIMARY KEY(project_id,reservation_id,version),UNIQUE(project_id,server_sequence),UNIQUE(project_id,command_id,version),
 FOREIGN KEY(project_id,policy_id,policy_version) REFERENCES anvil.limit_policy_versions(project_id,policy_id,version)
);
GRANT SELECT ON anvil.usage_reservations TO anvil_v3_app;
REVOKE INSERT,UPDATE,DELETE ON anvil.usage_reservations FROM anvil_v3_app;

-- C2 최초 합성 queue의 저장 모델. 실제 credential/Agent 집행 테이블이 아니다.
-- 정확 receipt·전체 graph deferred guard를 연결하기 전 app mutation은 fail-closed로 유지한다.
CREATE TABLE anvil.executions (
 project_id uuid NOT NULL REFERENCES anvil.projects(id),id uuid NOT NULL,generation bigint NOT NULL CHECK(generation BETWEEN 1 AND 9007199254740991),
 transport text NOT NULL CHECK(transport='SYNTHETIC_ONLY'),state text NOT NULL CHECK(state='SYNTHETIC_QUEUED'),
 created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(project_id,id,generation),UNIQUE(project_id,command_id),
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id),
 FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id)
);
CREATE TABLE anvil.execution_grants (
 project_id uuid NOT NULL,id uuid NOT NULL,version bigint NOT NULL CHECK(version=1),execution_id uuid NOT NULL,generation bigint NOT NULL,
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL CHECK(jsonb_typeof(snapshot_json)='object'),
 created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,id,version),UNIQUE(project_id,id,version,execution_id,generation),UNIQUE(project_id,command_id),
 FOREIGN KEY(project_id,execution_id,generation) REFERENCES anvil.executions(project_id,id,generation),
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id),FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id)
);
CREATE TABLE anvil.writer_claims (
 project_id uuid NOT NULL,id uuid NOT NULL,execution_id uuid NOT NULL,generation bigint NOT NULL,grant_id uuid NOT NULL,grant_version bigint NOT NULL,
 scope_json jsonb NOT NULL CHECK(jsonb_typeof(scope_json)='array'),expires_at timestamptz NOT NULL,
 ownership_state text NOT NULL CHECK(ownership_state='SYNTHETIC_CLAIM'),created_command_id uuid NOT NULL,
 issued_at timestamptz NOT NULL DEFAULT now(),reclaimed_at timestamptz,
 PRIMARY KEY(project_id,id),UNIQUE(project_id,created_command_id),
 FOREIGN KEY(project_id,grant_id,grant_version,execution_id,generation) REFERENCES anvil.execution_grants(project_id,id,version,execution_id,generation),
 FOREIGN KEY(project_id,created_command_id) REFERENCES anvil.commands(project_id,id)
);
-- 만료만으로 미확인 소유를 새 writer에게 넘기지 않는다. 실제 OS/경로 통제의 증명은 별도다.
CREATE UNIQUE INDEX execution_single_unreclaimed_writer ON anvil.writer_claims(project_id) WHERE reclaimed_at IS NULL;
CREATE TABLE anvil.execution_commands (
 project_id uuid NOT NULL,id uuid NOT NULL,version bigint NOT NULL CHECK(version=1),execution_id uuid NOT NULL,generation bigint NOT NULL,
 grant_id uuid NOT NULL,grant_version bigint NOT NULL,content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),
 envelope_hash text NOT NULL CHECK(envelope_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL CHECK(jsonb_typeof(snapshot_json)='object'),
 authorization_ref jsonb NOT NULL CHECK(jsonb_typeof(authorization_ref)='object'),created_command_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,id,version),UNIQUE(project_id,created_command_id),
 FOREIGN KEY(project_id,grant_id,grant_version,execution_id,generation) REFERENCES anvil.execution_grants(project_id,id,version,execution_id,generation),
 FOREIGN KEY(project_id,created_command_id) REFERENCES anvil.commands(project_id,id)
);
ALTER TABLE anvil.usage_reservations ADD COLUMN created_command_id uuid NOT NULL;
ALTER TABLE anvil.usage_reservations ADD CONSTRAINT usage_reservation_queue_command_fk
 FOREIGN KEY(project_id,created_command_id) REFERENCES anvil.commands(project_id,id);
GRANT SELECT ON anvil.executions,anvil.execution_grants,anvil.writer_claims,anvil.execution_commands TO anvil_v3_app;
REVOKE INSERT,UPDATE,DELETE ON anvil.executions,anvil.execution_grants,anvil.writer_claims,anvil.execution_commands FROM anvil_v3_app;

-- 신규 초기 queue graph guard용 순수 정책 경계. 이 함수 자체는 INSERT 권한/실행 허가를 발급하지 않는다.
CREATE FUNCTION anvil.execution_source_scopes_valid(scopes jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE source_scope jsonb;target jsonb;field text;relative_file text;segment text;roots text[]=ARRAY[]::text[];paths text[];total integer=0;utf16_length integer;
BEGIN
 IF jsonb_typeof(scopes) IS DISTINCT FROM 'array' OR jsonb_array_length(scopes) NOT BETWEEN 1 AND 200 THEN RETURN false;END IF;
 FOR source_scope IN SELECT value FROM jsonb_array_elements(scopes) LOOP
  IF jsonb_typeof(source_scope) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(source_scope))<>5
   OR NOT(source_scope ?& ARRAY['sourceRootRef','mappingRef','observationRef','baselineRef','targets']) THEN RETURN false;END IF;
  FOREACH field IN ARRAY ARRAY['sourceRootRef','observationRef','baselineRef'] LOOP
   IF NOT anvil.execution_preparation_ref_valid(source_scope->field) THEN RETURN false;END IF;
  END LOOP;
  IF source_scope->'mappingRef'<>'null'::jsonb AND NOT anvil.execution_preparation_ref_valid(source_scope->'mappingRef') THEN RETURN false;END IF;
  IF source_scope->'sourceRootRef'->>'id'=ANY(roots) THEN RETURN false;END IF;
  roots=array_append(roots,source_scope->'sourceRootRef'->>'id');paths=ARRAY[]::text[];
  IF jsonb_typeof(source_scope->'targets') IS DISTINCT FROM 'array' OR jsonb_array_length(source_scope->'targets') NOT BETWEEN 1 AND 200 THEN RETURN false;END IF;
  FOR target IN SELECT value FROM jsonb_array_elements(source_scope->'targets') LOOP
   total=total+1;
   IF total>200 OR jsonb_typeof(target) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(target))<>4
    OR NOT(target ?& ARRAY['relativePath','kind','access','recursive']) OR target->'kind' IS DISTINCT FROM '"FILE"'::jsonb
    OR target->'recursive' IS DISTINCT FROM 'false'::jsonb OR jsonb_typeof(target->'access') IS DISTINCT FROM 'string' OR target->>'access' NOT IN('READ','WRITE')
    OR jsonb_typeof(target->'relativePath') IS DISTINCT FROM 'string' THEN RETURN false;END IF;
   relative_file=target->>'relativePath';
   IF octet_length(relative_file) NOT BETWEEN 1 AND 1024 OR relative_file IS DISTINCT FROM normalize(relative_file,NFC)
    OR relative_file ~ '[[:cntrl:]\\:%?*"<>|]' OR upper(relative_file)=ANY(paths) THEN RETURN false;END IF;
   paths=array_append(paths,upper(relative_file));
   FOREACH segment IN ARRAY string_to_array(relative_file,'/') LOOP
    SELECT char_length(segment)+count(*) FILTER(WHERE ascii(substr(segment,n,1))>65535) INTO utf16_length FROM generate_series(1,char_length(segment)) n;
    IF segment IN('','.','..') OR utf16_length>255 OR segment ~ '[. ]$'
     OR segment ~* '^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(\.|$)' THEN RETURN false;END IF;
   END LOOP;
  END LOOP;
 END LOOP;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.execution_source_target_matches(base jsonb,requested jsonb,target jsonb,restrictive boolean) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT COALESCE((CASE WHEN restrictive THEN base->'sourceRootRef'->>'id'=requested->'sourceRootRef'->>'id' ELSE base-'targets'=requested-'targets' END)
  AND EXISTS(SELECT 1 FROM jsonb_array_elements(base->'targets') t WHERE t->'kind'=target->'kind' AND t->'access'=target->'access' AND t->'recursive'=target->'recursive'
   AND CASE WHEN restrictive THEN upper(t->>'relativePath')=upper(target->>'relativePath') ELSE t->'relativePath'=target->'relativePath' END),false);
$$;
CREATE FUNCTION anvil.execution_policy_deadline(rules jsonb,pid uuid,eid uuid,generation bigint,actor uuid,op text,budget_ref jsonb,scopes jsonb,at_time timestamptz)
 RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE rule jsonb;scope jsonb;requested jsonb;target jsonb;base jsonb;allowed_scopes jsonb='[]'::jsonb;rule_deadline timestamptz;deadline timestamptz;overlap boolean;
BEGIN
 IF rules IS NULL OR pid IS NULL OR eid IS NULL OR actor IS NULL OR at_time IS NULL OR generation IS NULL OR generation NOT BETWEEN 1 AND 9007199254740991
  OR op IS NULL OR op NOT IN('authorizeExecution','queueExecutionCommand') OR jsonb_typeof(rules) IS DISTINCT FROM 'array' OR jsonb_array_length(rules)>200
  OR NOT anvil.execution_preparation_ref_valid(budget_ref) OR NOT anvil.execution_source_scopes_valid(scopes) THEN RETURN NULL;END IF;
 FOR rule IN SELECT value FROM jsonb_array_elements(rules) LOOP
  IF jsonb_typeof(rule) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(rule))<>7
   OR NOT(rule ?& ARRAY['ruleId','subjectRef','operations','targetScopes','disposition','limitPolicyRef','expiresAt'])
   OR jsonb_typeof(rule->'disposition') IS DISTINCT FROM 'string' OR rule->>'disposition' NOT IN('AUTO','DENY','REQUIRE_APPROVAL')
   OR jsonb_typeof(rule->'operations') IS DISTINCT FROM 'array' OR jsonb_array_length(rule->'operations') NOT BETWEEN 1 AND 200
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(rule->'operations') x WHERE jsonb_typeof(x)<>'string')
   OR jsonb_typeof(rule->'targetScopes') IS DISTINCT FROM 'array' OR jsonb_array_length(rule->'targetScopes')<>1 THEN RETURN NULL;END IF;
  scope=rule->'targetScopes'->0;
  IF scope->>'kind'='PROJECT' THEN
   IF rule->'limitPolicyRef' IS DISTINCT FROM 'null'::jsonb OR (rule->'operations') ?| ARRAY['authorizeExecution','queueExecutionCommand','revokeExecutionGrant','requestExecutionStop','authorizeExecutionRecovery'] THEN RETURN NULL;END IF;
   CONTINUE;
  END IF;
  IF jsonb_typeof(scope) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(scope))<>5
   OR NOT(scope ?& ARRAY['kind','projectId','executionId','executionGeneration','sourceScopes']) OR scope->'kind' IS DISTINCT FROM '"EXECUTION"'::jsonb
   OR NOT anvil.execution_preparation_ref_valid(rule->'limitPolicyRef') OR NOT anvil.execution_source_scopes_valid(scope->'sourceScopes')
   OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(rule->'operations') x WHERE x NOT IN('authorizeExecution','queueExecutionCommand','revokeExecutionGrant','requestExecutionStop','authorizeExecutionRecovery')) THEN RETURN NULL;END IF;
  IF rule->'subjectRef' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',actor) OR scope->'projectId' IS DISTINCT FROM to_jsonb(pid)
   OR scope->'executionId' IS DISTINCT FROM to_jsonb(eid) OR scope->'executionGeneration' IS DISTINCT FROM to_jsonb(generation) OR NOT((rule->'operations') ? op) THEN CONTINUE;END IF;
  IF jsonb_typeof(rule->'expiresAt') IS DISTINCT FROM 'string' OR rule->>'expiresAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' THEN RETURN NULL;END IF;
  rule_deadline=(rule->>'expiresAt')::timestamptz;IF rule_deadline<=at_time THEN CONTINUE;END IF;
  overlap=false;
  FOR requested IN SELECT value FROM jsonb_array_elements(scopes) LOOP
   FOR target IN SELECT value FROM jsonb_array_elements(requested->'targets') LOOP
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(scope->'sourceScopes') b WHERE anvil.execution_source_target_matches(b,requested,target,true)) THEN overlap=true;END IF;
   END LOOP;
  END LOOP;
  IF rule->>'disposition'='DENY' AND overlap THEN RETURN NULL;END IF;
  IF rule->'limitPolicyRef' IS DISTINCT FROM budget_ref THEN CONTINUE;END IF;
  IF rule->>'disposition'='REQUIRE_APPROVAL' AND overlap THEN RETURN NULL;END IF;
  IF rule->>'disposition' IN('AUTO','REQUIRE_APPROVAL') THEN
   deadline=CASE WHEN deadline IS NULL THEN rule_deadline ELSE LEAST(deadline,rule_deadline) END;
   IF rule->>'disposition'='AUTO' THEN allowed_scopes=allowed_scopes||(scope->'sourceScopes');END IF;
  END IF;
 END LOOP;
 FOR requested IN SELECT value FROM jsonb_array_elements(scopes) LOOP
  FOR target IN SELECT value FROM jsonb_array_elements(requested->'targets') LOOP
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(allowed_scopes) b WHERE anvil.execution_source_target_matches(b,requested,target,false)) THEN RETURN NULL;END IF;
  END LOOP;
 END LOOP;
 RETURN deadline;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;
