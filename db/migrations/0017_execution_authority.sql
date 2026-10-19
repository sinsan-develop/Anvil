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

-- P1 최초 합성 queue만 연다. 직접 app INSERT도 현재 영수증·전체 graph 검사를 우회하지 않는다.
-- 실제 OS/source/Agent 현재성은 이 SQL이 증명하지 않으며 outbox는 항상 보류한다.
CREATE FUNCTION anvil.execution_json_shape(value jsonb,fields text[]) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
 RETURN COALESCE(jsonb_typeof(value)='object' AND (SELECT count(*) FROM jsonb_object_keys(value))=cardinality(fields) AND value ?& fields,false);
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.execution_json_hash(value jsonb) RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT encode(sha256(convert_to(anvil.execution_authority_canonical(value),'UTF8')),'hex');
$$;

-- 호출 시점의 현재 HUMAN/session/control·두 실행 정책·유한 예산과 정확 영수증을 대조한다.
CREATE FUNCTION anvil.execution_queue_authorized(pid uuid,cid uuid) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE c anvil.commands%ROWTYPE;r anvil.authorization_receipts%ROWTYPE;q jsonb;pv anvil.permission_policy_versions%ROWTYPE;
 s anvil.auth_sessions%ROWTYPE;b anvil.limit_policy_versions%ROWTYPE;at_time timestamptz=clock_timestamp();d1 timestamptz;d2 timestamptz;
BEGIN
 PERFORM id FROM anvil.projects WHERE id=pid AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 SELECT * INTO c FROM anvil.commands WHERE project_id=pid AND id=cid;
 IF c.id IS NULL OR c.id::text IS DISTINCT FROM current_setting('anvil.command_id',true)
  OR c.actor_id::text IS DISTINCT FROM current_setting('anvil.actor_id',true) OR c.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true)
  OR c.operation IS DISTINCT FROM 'queueExecutionCommand' OR c.state IS DISTINCT FROM 'APPLIED' OR c.scope_kind IS DISTINCT FROM 'PROJECT'
  OR c.scope_id IS DISTINCT FROM pid OR c.expected_version IS DISTINCT FROM 0 OR c.approval_consumption_id IS NOT NULL OR c.payload_ref IS NOT NULL
  THEN RETURN false;END IF;
 q=c.result_ref->'data'->'snapshot';
 IF NOT anvil.execution_json_shape(q,ARRAY['transport','executionId','executionGeneration','state','grantRef','reservationRef','executorRegistrationRef','operation','payload','humanSessionId','sourceScopes','budgetPolicyRef','queuedAt','executionAuthorized','dispatchPerformed'])
  OR q->'transport' IS DISTINCT FROM '"SYNTHETIC_ONLY"'::jsonb OR q->'state' IS DISTINCT FROM '"SYNTHETIC_QUEUED"'::jsonb
  OR q->'operation' IS DISTINCT FROM '"START_SESSION"'::jsonb OR q->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR q->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR NOT anvil.execution_source_scopes_valid(q->'sourceScopes')
  OR NOT anvil.execution_preparation_ref_valid(q->'grantRef') OR NOT anvil.execution_preparation_ref_valid(q->'reservationRef')
  OR NOT anvil.execution_preparation_ref_valid(q->'executorRegistrationRef') OR NOT anvil.execution_preparation_ref_valid(q->'budgetPolicyRef')
  OR NOT anvil.execution_preparation_ref_valid(c.policy_ref) OR NOT anvil.execution_preparation_ref_valid(c.result_ref->'data'->'ref')
  OR NOT anvil.execution_json_shape(q->'payload',ARRAY['contextBundleRef','optionsRef'])
  OR NOT anvil.execution_preparation_ref_valid(q->'payload'->'contextBundleRef') OR NOT anvil.execution_preparation_ref_valid(q->'payload'->'optionsRef')
  OR c.result_ref->'data'->>'status' IS DISTINCT FROM 'SYNTHETIC_QUEUE_STORED'
  OR c.result_ref->'data'->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR c.result_ref->'data'->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR c.result_ref->>'status' IS DISTINCT FROM 'APPLIED' OR c.result_ref->>'commandId' IS DISTINCT FROM c.command_id::text
  OR c.result_ref->>'operationId' IS DISTINCT FROM c.operation_id::text OR c.result_ref->>'projectId' IS DISTINCT FROM pid::text
  OR c.result_ref->'targetId' IS DISTINCT FROM c.result_ref->'data'->'ref'->'id' OR c.result_ref->'version' IS DISTINCT FROM '1'::jsonb
  OR c.result_ref->'data'->'ref'->>'contentHash' IS DISTINCT FROM anvil.execution_json_hash(q)
  OR (q->>'queuedAt')::timestamptz>at_time OR (q->>'queuedAt')::timestamptz<at_time-interval '30 seconds'
  OR octet_length(anvil.execution_authority_canonical(q))>2097152 THEN RETURN false;END IF;
 IF NOT EXISTS(SELECT 1 FROM anvil.project_control pc JOIN anvil.project_members m ON m.project_id=pc.project_id AND m.user_id=pc.actor_id
  WHERE pc.project_id=pid AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
   AND m.participation='OWNER' AND m.revoked_at IS NULL FOR SHARE OF pc,m) THEN RETURN false;END IF;
 SELECT s0.* INTO s FROM anvil.auth_sessions s0 JOIN anvil.users u ON u.id=s0.user_id JOIN anvil.clients cl ON cl.id=s0.client_id AND cl.user_id=s0.user_id
  WHERE s0.id::text=q->>'humanSessionId' AND s0.user_id=c.actor_id AND s0.client_id=c.client_id AND s0.revoked_at IS NULL
   AND u.status='ACTIVE' AND u.revoked_at IS NULL AND cl.revoked_at IS NULL AND u.credential_generation=s0.credential_generation
   AND s0.idle_expires_at>at_time AND s0.absolute_expires_at>at_time FOR SHARE OF s0,u,cl;
 IF s.id IS NULL THEN RETURN false;END IF;
 SELECT v.* INTO pv FROM anvil.permission_policies pp JOIN anvil.permission_policy_versions v ON v.project_id=pp.project_id AND v.policy_id=pp.id AND v.version=pp.head_version
  WHERE pp.project_id=pid AND pp.id::text=c.policy_ref->>'id' AND pp.head_version::text=c.policy_ref->>'version' AND v.content_hash=c.policy_ref->>'contentHash' FOR SHARE OF pp;
 IF pv.policy_id IS NULL OR pv.content_hash IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('rules',pv.rules_json,'reason',pv.reason,'reviewRefs',pv.review_refs)) THEN RETURN false;END IF;
 SELECT * INTO b FROM anvil.limit_policy_versions v WHERE v.project_id=pid AND v.scope_json=jsonb_build_object('kind','PROJECT','projectId',pid) ORDER BY version DESC LIMIT 1;
 IF b.policy_id IS NULL OR q->'budgetPolicyRef' IS DISTINCT FROM jsonb_build_object('id',b.policy_id,'version',b.version,'contentHash',b.content_hash)
  OR b.snapshot_json->>'state' IS DISTINCT FROM 'APPLIED' OR b.content_hash IS DISTINCT FROM anvil.execution_json_hash(b.snapshot_json)
  OR NOT anvil.limit_policy_limits_valid(b.snapshot_json->'limits') OR (b.snapshot_json->>'expiresAt')::timestamptz<=at_time
  OR (b.snapshot_json->>'decidedAt')::timestamptz>at_time THEN RETURN false;END IF;
 d1=anvil.execution_policy_deadline(pv.rules_json,pid,(q->>'executionId')::uuid,(q->>'executionGeneration')::bigint,c.actor_id,'authorizeExecution',q->'budgetPolicyRef',q->'sourceScopes',at_time);
 d2=anvil.execution_policy_deadline(pv.rules_json,pid,(q->>'executionId')::uuid,(q->>'executionGeneration')::bigint,c.actor_id,'queueExecutionCommand',q->'budgetPolicyRef',q->'sourceScopes',at_time);
 IF d1 IS NULL OR d2 IS NULL THEN RETURN false;END IF;
 SELECT * INTO r FROM anvil.authorization_receipts WHERE id=c.authorization_receipt_id AND command_id=c.id AND scope_kind='PROJECT' AND scope_id=pid;
 IF r.id IS NULL OR r.policy_ref IS DISTINCT FROM c.policy_ref OR r.approval_decision_ref IS NOT NULL
  OR r.subject_ref IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
  OR r.scope_digest IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('projectId',pid,'actorId',c.actor_id,'clientId',c.client_id,'controlGeneration',c.control_generation,
   'requestHash',c.request_hash,'policyRef',c.policy_ref,'targetRef',c.result_ref->'data'->'ref'))
  OR (SELECT count(*) FROM anvil.audit_events a WHERE a.project_id=pid AND a.command_id=c.id AND a.operation_id=c.operation_id AND a.outcome='APPLIED'
   AND a.source_kind='HUMAN_COMMAND' AND a.actor_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND a.client_ref=c.client_id
   AND a.target_ref=c.result_ref->'data'->'ref' AND a.policy_ref=c.policy_ref AND a.approval_ref IS NULL AND a.scope_digest=r.scope_digest)<>1 THEN RETURN false;END IF;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;

CREATE FUNCTION anvil.guard_initial_execution_row() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_value jsonb;cid uuid;pid uuid;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'EXECUTION_QUEUE_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 row_value=to_jsonb(NEW);pid=(row_value->>'project_id')::uuid;cid=COALESCE(row_value->>'created_command_id',row_value->>'command_id')::uuid;
 IF NOT anvil.execution_queue_authorized(pid,cid) THEN RAISE EXCEPTION 'EXECUTION_QUEUE_CURRENT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'EXECUTION_QUEUE_CURRENT_RECEIPT_REQUIRED' USING ERRCODE='42501';
END;
$$;

-- 완전한 graph를 INSERT 이후/COMMIT 직전 검증한다. 중간 insert 생략도 영수증만 남겨 완료할 수 없다.
CREATE FUNCTION anvil.check_initial_execution_graph(pid uuid,cid uuid) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE c anvil.commands%ROWTYPE;e anvil.executions%ROWTYPE;g anvil.execution_grants%ROWTYPE;
 u anvil.usage_reservations%ROWTYPE;w anvil.writer_claims%ROWTYPE;x anvil.execution_commands%ROWTYPE;o anvil.delivery_outbox%ROWTYPE;
 q jsonb;f jsonb;gs jsonb;us jsonb;env jsonb;intent jsonb;claim jsonb;auth_ref jsonb;deadline timestamptz;at_time timestamptz=clock_timestamp();
 policy anvil.permission_policy_versions%ROWTYPE;budget anvil.limit_policy_versions%ROWTYPE;session anvil.auth_sessions%ROWTYPE;field text;check_value jsonb;
BEGIN
 IF NOT anvil.execution_queue_authorized(pid,cid) THEN RETURN false;END IF;
 SELECT * INTO c FROM anvil.commands WHERE id=cid AND project_id=pid;q=c.result_ref->'data'->'snapshot';
 SELECT * INTO e FROM anvil.executions WHERE project_id=pid AND command_id=cid;
 SELECT * INTO g FROM anvil.execution_grants WHERE project_id=pid AND command_id=cid;
 SELECT * INTO u FROM anvil.usage_reservations WHERE project_id=pid AND created_command_id=cid;
 SELECT * INTO w FROM anvil.writer_claims WHERE project_id=pid AND created_command_id=cid;
 SELECT * INTO x FROM anvil.execution_commands WHERE project_id=pid AND created_command_id=cid;
 SELECT * INTO o FROM anvil.delivery_outbox WHERE project_id=pid AND command_id=cid;
 IF e.id IS NULL OR g.id IS NULL OR u.reservation_id IS NULL OR w.id IS NULL OR x.id IS NULL OR o.id IS NULL
  OR (SELECT count(*) FROM anvil.usage_reservations WHERE project_id=pid AND created_command_id=cid)<>1
  OR (SELECT count(*) FROM anvil.delivery_outbox WHERE project_id=pid AND command_id=cid)<>1 THEN RETURN false;END IF;
 gs=g.snapshot_json;f=gs->'binding';intent=f->'intent';us=u.snapshot_json;claim=us->'claim';env=x.snapshot_json->'envelope';
 IF e.id::text IS DISTINCT FROM q->>'executionId' OR to_jsonb(e.generation) IS DISTINCT FROM q->'executionGeneration'
  OR e.transport IS DISTINCT FROM 'SYNTHETIC_ONLY' OR e.state IS DISTINCT FROM 'SYNTHETIC_QUEUED' OR e.created_by IS DISTINCT FROM c.actor_id OR e.client_id IS DISTINCT FROM c.client_id
  OR g.execution_id IS DISTINCT FROM e.id OR g.generation IS DISTINCT FROM e.generation OR g.version<>1 OR g.created_by IS DISTINCT FROM c.actor_id OR g.client_id IS DISTINCT FROM c.client_id
  OR q->'grantRef' IS DISTINCT FROM jsonb_build_object('id',g.id,'version',g.version,'contentHash',g.content_hash)
  OR g.content_hash IS DISTINCT FROM anvil.execution_json_hash(gs)
  OR NOT anvil.execution_json_shape(gs,ARRAY['kind','state','transport','binding','allowedOperations','expiresAt','scopeDigest','factHash','plannedAt','executionAuthorized','dispatchPerformed'])
  OR gs->>'kind' IS DISTINCT FROM 'EXECUTION' OR gs->>'state' IS DISTINCT FROM 'SYNTHETIC_PLAN' OR gs->>'transport' IS DISTINCT FROM 'SYNTHETIC_ONLY'
  OR gs->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR gs->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR gs->'allowedOperations' IS DISTINCT FROM '["START_SESSION","SEND_INSTRUCTION","REQUEST_STOP"]'::jsonb
  OR gs->'plannedAt' IS DISTINCT FROM q->'queuedAt' OR gs->>'factHash' IS DISTINCT FROM anvil.execution_json_hash(f)
  OR gs->>'scopeDigest' IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('binding',f,'allowedOperations',gs->'allowedOperations','expiresAt',gs->'expiresAt'))
  OR f->'schemaVersion' IS DISTINCT FROM '1'::jsonb OR f->>'purpose' IS DISTINCT FROM 'SERVER_EXECUTION_CURRENTNESS' OR f->>'transport' IS DISTINCT FROM 'SYNTHETIC_ONLY'
  OR f->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR f->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb OR f->>'writerState' IS DISTINCT FROM 'NONE'
  OR f->>'projectId' IS DISTINCT FROM pid::text OR f->>'executionId' IS DISTINCT FROM e.id::text OR f->'executionGeneration' IS DISTINCT FROM to_jsonb(e.generation)
  OR f->'permissionPolicyRef' IS DISTINCT FROM c.policy_ref OR f->'budgetReservationRef' IS DISTINCT FROM q->'reservationRef'
  OR f->'subject'->>'userId' IS DISTINCT FROM c.actor_id::text OR f->'subject'->>'clientId' IS DISTINCT FROM c.client_id::text
  OR f->'subject'->>'humanSessionId' IS DISTINCT FROM q->>'humanSessionId' OR f->'subject'->'controlGeneration' IS DISTINCT FROM to_jsonb(c.control_generation)
  OR intent->>'projectId' IS DISTINCT FROM pid::text OR intent->'budgetPolicyRef' IS DISTINCT FROM q->'budgetPolicyRef' OR intent->'sourceScopes' IS DISTINCT FROM q->'sourceScopes'
  OR intent->'contextBundleRef' IS DISTINCT FROM q->'payload'->'contextBundleRef' OR intent->'roleBindingRef' IS DISTINCT FROM f->'agentSession'->'roleBindingRef'
  OR f->'registration'->'ref' IS DISTINCT FROM q->'executorRegistrationRef' OR (f->>'checkedAt')::timestamptz>(q->>'queuedAt')::timestamptz
  OR (f->>'checkedAt')::timestamptz<(q->>'queuedAt')::timestamptz-interval '30 seconds' THEN RETURN false;END IF;
 IF NOT anvil.execution_json_shape(f->'checks',ARRAY['subject','session','registration','permissionPolicy','basis','context','capability','source','osFence','budget','storage','understanding'])
  OR NOT anvil.execution_json_shape(f->'expires',ARRAY['humanSession','permissionPolicy','registration','budget','automaticScope']) THEN RETURN false;END IF;
 FOREACH field IN ARRAY ARRAY['subject','session','registration','permissionPolicy','basis','context','capability','source','osFence','budget','storage'] LOOP
  check_value=f->'checks'->field;
  IF NOT anvil.execution_json_shape(check_value,ARRAY['state','evidenceRefs']) OR check_value->>'state' IS DISTINCT FROM 'VERIFIED_CURRENT'
   OR jsonb_typeof(check_value->'evidenceRefs') IS DISTINCT FROM 'array' OR jsonb_array_length(check_value->'evidenceRefs')<1 THEN RETURN false;END IF;
 END LOOP;
 IF intent->>'mode'='CONTEXT_REVIEW' THEN
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(q->'sourceScopes') s,jsonb_array_elements(s->'targets') t WHERE t->>'access' IS DISTINCT FROM 'READ') THEN RETURN false;END IF;
 ELSIF intent->>'mode'='WORK' THEN
  IF NOT anvil.execution_preparation_ref_valid(f->'understandingReviewRef') OR f->'checks'->'understanding'->>'state' IS DISTINCT FROM 'VERIFIED_CURRENT' THEN RETURN false;END IF;
 ELSE RETURN false;END IF;
 SELECT * INTO session FROM anvil.auth_sessions WHERE id::text=q->>'humanSessionId';
 IF f->'subject'->'credentialGeneration' IS DISTINCT FROM to_jsonb(session.credential_generation) THEN RETURN false;END IF;
 SELECT * INTO policy FROM anvil.permission_policy_versions WHERE project_id=pid AND policy_id::text=c.policy_ref->>'id' AND version::text=c.policy_ref->>'version';
 SELECT * INTO budget FROM anvil.limit_policy_versions WHERE project_id=pid AND policy_id::text=q->'budgetPolicyRef'->>'id' AND version::text=q->'budgetPolicyRef'->>'version';
 deadline=LEAST((q->>'queuedAt')::timestamptz+interval '2 hours',session.idle_expires_at,session.absolute_expires_at,(budget.snapshot_json->>'expiresAt')::timestamptz,
  anvil.execution_policy_deadline(policy.rules_json,pid,e.id,e.generation,c.actor_id,'authorizeExecution',q->'budgetPolicyRef',q->'sourceScopes',at_time),
  anvil.execution_policy_deadline(policy.rules_json,pid,e.id,e.generation,c.actor_id,'queueExecutionCommand',q->'budgetPolicyRef',q->'sourceScopes',at_time));
 FOREACH field IN ARRAY ARRAY['humanSession','permissionPolicy','registration','budget','automaticScope'] LOOP
  IF jsonb_typeof(f->'expires'->field) IS DISTINCT FROM 'string' THEN RETURN false;END IF;
  deadline=LEAST(deadline,(f->'expires'->>field)::timestamptz);
 END LOOP;
 IF (gs->>'expiresAt')::timestamptz IS DISTINCT FROM deadline OR deadline<=at_time THEN RETURN false;END IF;
 -- 실제 original request의 hash: 준비 ref는 불변 grant의 binding에서만 복원한다.
 IF NOT anvil.execution_preparation_ref_valid(f->'preparationRef') OR c.request_hash IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object(
  'schemaVersion',1,'projectId',pid,'commandId',c.command_id,'clientId',c.client_id,'controlGeneration',c.control_generation,'operation','queueExecutionCommand','targetId',NULL,
  'expectedVersion',0,'baselineRefs','[]'::jsonb,'approvalRef',NULL,'payload',jsonb_build_object('preparationRef',f->'preparationRef','executionId',e.id,
  'executionGeneration',e.generation,'permissionPolicyRef',c.policy_ref,'budgetPolicyRef',q->'budgetPolicyRef','operation','START_SESSION','payload',q->'payload'))) THEN RETURN false;END IF;
 auth_ref=jsonb_build_object('id',c.authorization_receipt_id,'version',1,'contentHash',(SELECT scope_digest FROM anvil.authorization_receipts WHERE id=c.authorization_receipt_id));
 IF x.id::text IS DISTINCT FROM c.result_ref->>'targetId' OR x.execution_id IS DISTINCT FROM e.id OR x.generation IS DISTINCT FROM e.generation
  OR x.grant_id IS DISTINCT FROM g.id OR x.grant_version IS DISTINCT FROM g.version OR x.version<>1 OR x.snapshot_json-'envelope' IS DISTINCT FROM q
  OR x.content_hash IS DISTINCT FROM anvil.execution_json_hash(q) OR x.authorization_ref IS DISTINCT FROM auth_ref
  OR x.envelope_hash IS DISTINCT FROM env->>'envelopeHash' OR x.envelope_hash IS DISTINCT FROM anvil.execution_json_hash(env-'envelopeHash')
  OR env-'envelopeHash' IS DISTINCT FROM jsonb_build_object('schemaVersion',1,'commandId',c.command_id,'issuedAt',q->'queuedAt','expiresAt',gs->'expiresAt',
   'executorRegistrationRef',q->'executorRegistrationRef','operation','START_SESSION','payload',q->'payload','context',jsonb_build_object('projectId',pid,'assignmentId',intent->'assignmentRef'->'id',
   'executionId',e.id,'executionGeneration',e.generation,'connectionRef',intent->'connectionRef','environmentRef',intent->'environmentRef','authorizationReceiptRef',auth_ref,
   'capabilityRef',intent->'capabilityRef','budgetRef',q->'reservationRef','sourceScopes',q->'sourceScopes')) THEN RETURN false;END IF;
 IF q->'reservationRef' IS DISTINCT FROM jsonb_build_object('id',u.reservation_id,'version',u.version,'contentHash',u.content_hash) OR u.version<>1
  OR u.command_id IS DISTINCT FROM c.command_id OR u.content_hash IS DISTINCT FROM anvil.execution_json_hash(us)
  OR NOT anvil.execution_json_shape(us,ARRAY['sequence','claim','state','usage','previousRef','checkedAt','evidenceRef','executionAuthorized','dispatchPerformed'])
  OR us->'sequence' IS DISTINCT FROM to_jsonb(u.server_sequence) OR us->>'state' IS DISTINCT FROM 'RESERVED' OR us->'usage' IS DISTINCT FROM 'null'::jsonb
  OR us->'previousRef' IS DISTINCT FROM 'null'::jsonb OR us->'evidenceRef' IS DISTINCT FROM 'null'::jsonb
  OR us->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR us->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR claim->>'projectId' IS DISTINCT FROM pid::text OR claim->>'executionId' IS DISTINCT FROM e.id::text OR claim->'executionGeneration' IS DISTINCT FROM to_jsonb(e.generation)
  OR claim->>'commandId' IS DISTINCT FROM c.command_id::text OR claim->'policyRef' IS DISTINCT FROM q->'budgetPolicyRef' OR claim->'assignmentRef' IS DISTINCT FROM intent->'assignmentRef'
  OR claim->>'operation' IS DISTINCT FROM 'START_SESSION' OR (us->>'checkedAt')::timestamptz>(q->>'queuedAt')::timestamptz
  OR (us->>'checkedAt')::timestamptz<(q->>'queuedAt')::timestamptz-interval '30 seconds'
  OR NOT anvil.execution_json_shape(claim->'demand',ARRAY['attempts','calls','spoolBytes','cost','costStatus'])
  OR claim->'demand'->'attempts' IS DISTINCT FROM '1'::jsonb OR jsonb_typeof(claim->'demand'->'calls') IS DISTINCT FROM 'number'
  OR (claim->'demand'->>'calls')::numeric NOT BETWEEN 1 AND (budget.snapshot_json->'limits'->>'maxCalls')::numeric
  OR (claim->'demand'->>'calls')::numeric<>trunc((claim->'demand'->>'calls')::numeric)
  OR jsonb_typeof(claim->'demand'->'spoolBytes') IS DISTINCT FROM 'number'
  OR (claim->'demand'->>'spoolBytes')::numeric NOT BETWEEN 0 AND (budget.snapshot_json->'limits'->>'maxSpoolBytes')::numeric
  OR (claim->'demand'->>'spoolBytes')::numeric<>trunc((claim->'demand'->>'spoolBytes')::numeric) THEN RETURN false;END IF;
 IF claim->'demand'->>'costStatus'='VERIFIED_NO_CHARGE' THEN
  IF claim->'demand'->'cost' IS DISTINCT FROM 'null'::jsonb THEN RETURN false;END IF;
 ELSIF claim->'demand'->>'costStatus'='FINITE_CAP' THEN
  IF NOT anvil.execution_json_shape(claim->'demand'->'cost',ARRAY['amount','currency']) OR jsonb_typeof(claim->'demand'->'cost'->'amount') IS DISTINCT FROM 'number'
   OR NOT(budget.snapshot_json->'limits' ? 'maxCost') OR claim->'demand'->'cost'->'currency' IS DISTINCT FROM budget.snapshot_json->'limits'->'currency'
   OR (claim->'demand'->'cost'->>'amount')::numeric NOT BETWEEN 0 AND (budget.snapshot_json->'limits'->>'maxCost')::numeric THEN RETURN false;END IF;
 ELSE RETURN false;END IF;
 -- 초기 기능에는 종료/반환 연산이 없다. 기존 미회수 실행 또는 불명 예산이 하나라도 있으면 새 초기 graph는 거절한다.
 IF (SELECT count(*) FROM anvil.usage_reservations WHERE project_id=pid)<>1 OR u.server_sequence<>1
  OR (SELECT count(*) FROM anvil.writer_claims WHERE project_id=pid AND reclaimed_at IS NULL)<>1
  OR w.reclaimed_at IS NOT NULL OR w.ownership_state IS DISTINCT FROM 'SYNTHETIC_CLAIM' OR w.execution_id IS DISTINCT FROM e.id OR w.generation IS DISTINCT FROM e.generation
  OR w.grant_id IS DISTINCT FROM g.id OR w.grant_version IS DISTINCT FROM g.version OR w.scope_json IS DISTINCT FROM q->'sourceScopes' OR w.expires_at IS DISTINCT FROM deadline
  OR o.kind IS DISTINCT FROM 'EXECUTION_SYNTHETIC_ONLY' OR o.state IS DISTINCT FROM 'HELD_SYNTHETIC_ONLY' OR o.attempt_count<>0 OR o.next_attempt_at IS NOT NULL OR o.last_error_code IS NOT NULL
  OR o.scope_digest IS DISTINCT FROM gs->>'scopeDigest' OR o.destination_ref IS DISTINCT FROM jsonb_build_object('transport','SYNTHETIC_ONLY','registrationRef',q->'executorRegistrationRef','executionId',e.id,'generation',e.generation)
  OR o.payload_ref IS DISTINCT FROM jsonb_build_object('commandRef',c.result_ref->'data'->'ref','grantRef',q->'grantRef','envelopeHash',x.envelope_hash) THEN RETURN false;END IF;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.guard_initial_execution_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_value jsonb;pid uuid;cid uuid;operation text;
BEGIN
 row_value=to_jsonb(NEW);pid=(row_value->>'project_id')::uuid;
 cid=(CASE WHEN TG_TABLE_NAME='commands' THEN row_value->>'id' ELSE COALESCE(row_value->>'created_command_id',row_value->>'command_id') END)::uuid;
 SELECT c.operation INTO operation FROM anvil.commands c WHERE c.id=cid;
 IF operation='queueExecutionCommand' THEN
  IF NOT anvil.check_initial_execution_graph(pid,cid) THEN RAISE EXCEPTION 'EXECUTION_QUEUE_COMPLETE_GRAPH_REQUIRED' USING ERRCODE='42501';END IF;
 ELSIF TG_TABLE_NAME NOT IN('commands','delivery_outbox') OR row_value->>'kind'='EXECUTION_SYNTHETIC_ONLY' THEN
  RAISE EXCEPTION 'EXECUTION_QUEUE_EXACT_COMMAND_REQUIRED' USING ERRCODE='42501';
 END IF;
 RETURN NULL;
END;
$$;
CREATE FUNCTION anvil.guard_initial_execution_shared_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_value jsonb=to_jsonb(OLD);new_value jsonb=to_jsonb(NEW);cid uuid;
BEGIN
 IF TG_TABLE_NAME='commands' THEN
  IF TG_OP<>'INSERT' AND (old_value->>'operation'='queueExecutionCommand' OR new_value->>'operation'='queueExecutionCommand') THEN
   RAISE EXCEPTION 'EXECUTION_QUEUE_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 ELSE
  cid=COALESCE(new_value->>'command_id',old_value->>'command_id')::uuid;
  IF old_value->>'kind'='EXECUTION_SYNTHETIC_ONLY' OR new_value->>'kind'='EXECUTION_SYNTHETIC_ONLY'
   OR EXISTS(SELECT 1 FROM anvil.commands WHERE id=cid AND operation='queueExecutionCommand') THEN
   IF TG_OP<>'INSERT' OR NOT anvil.execution_queue_authorized((new_value->>'project_id')::uuid,cid) THEN
    RAISE EXCEPTION 'EXECUTION_QUEUE_OUTBOX_GUARD' USING ERRCODE='42501';END IF;
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END;
$$;
CREATE TRIGGER initial_execution_command_history BEFORE UPDATE OR DELETE ON anvil.commands FOR EACH ROW EXECUTE FUNCTION anvil.guard_initial_execution_shared_history();
CREATE TRIGGER initial_execution_outbox_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.delivery_outbox FOR EACH ROW EXECUTE FUNCTION anvil.guard_initial_execution_shared_history();
DO $$
DECLARE table_name text;
BEGIN
 FOREACH table_name IN ARRAY ARRAY['executions','execution_grants','usage_reservations','writer_claims','execution_commands'] LOOP
  EXECUTE format('CREATE TRIGGER initial_execution_row_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.%I FOR EACH ROW EXECUTE FUNCTION anvil.guard_initial_execution_row()',table_name);
  EXECUTE format('CREATE CONSTRAINT TRIGGER initial_execution_complete AFTER INSERT ON anvil.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_initial_execution_complete()',table_name);
 END LOOP;
END;
$$;
CREATE CONSTRAINT TRIGGER initial_execution_command_complete AFTER INSERT ON anvil.commands DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_initial_execution_complete();
CREATE CONSTRAINT TRIGGER initial_execution_outbox_complete AFTER INSERT ON anvil.delivery_outbox DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_initial_execution_complete();
GRANT INSERT ON anvil.executions,anvil.execution_grants,anvil.usage_reservations,anvil.writer_claims,anvil.execution_commands TO anvil_v3_app;
