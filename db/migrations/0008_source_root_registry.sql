-- A-2R: 소스 위치의 사용자 선언만 저장한다. OS 관측/파일 grant/Agent 실행과 무관하다.
CREATE TABLE anvil.source_roots(
 project_id uuid NOT NULL REFERENCES anvil.projects(id),id uuid NOT NULL,
 head_version bigint NOT NULL CHECK(head_version BETWEEN 1 AND 9007199254740991),
 created_by uuid NOT NULL,client_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,id),FOREIGN KEY(project_id,created_by) REFERENCES anvil.project_members(project_id,user_id),
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id)
);
CREATE TABLE anvil.source_root_versions(
 project_id uuid NOT NULL,root_id uuid NOT NULL,version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),declaration_json jsonb NOT NULL CHECK(jsonb_typeof(declaration_json)='object'),
 status text NOT NULL CHECK(status IN('DECLARED','REVOKED')),authority text NOT NULL CHECK(authority='USER_DECLARED'),readiness text NOT NULL CHECK(readiness='UNVERIFIED'),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 20000),actor_id uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL,connector_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(project_id,root_id,version),UNIQUE(project_id,command_id),
 FOREIGN KEY(project_id,root_id) REFERENCES anvil.source_roots(project_id,id),
 FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id),FOREIGN KEY(actor_id,client_id) REFERENCES anvil.clients(user_id,id),
 FOREIGN KEY(project_id,connector_id) REFERENCES anvil.connectors(project_id,id)
);
ALTER TABLE anvil.source_roots ADD CONSTRAINT source_root_head_fk FOREIGN KEY(project_id,id,head_version)
 REFERENCES anvil.source_root_versions(project_id,root_id,version) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX source_roots_project_order ON anvil.source_roots(project_id,created_at DESC,id DESC);
GRANT SELECT,INSERT,UPDATE ON anvil.source_roots TO anvil_v3_app;
GRANT SELECT,INSERT ON anvil.source_root_versions TO anvil_v3_app;
REVOKE DELETE ON anvil.source_roots FROM anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.source_root_versions FROM anvil_v3_app;

-- 키는 고정 ASCII 순서다. jsonb string 값의 JSON escape를 사용하고 공백 없는 canonical snapshot을 해시한다.
CREATE FUNCTION anvil.source_root_snapshot_hash(d jsonb,s text,r text) RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT encode(sha256(convert_to('{"authority":"USER_DECLARED","declaration":{"connectorId":'||(d->'connectorId')::text||',"displayName":'||(d->'displayName')::text||',"hostLabel":'||(d->'hostLabel')::text||',"pathHint":'||(d->'pathHint')::text||',"reason":'||(d->'reason')::text||'},"readiness":"UNVERIFIED","reason":'||to_jsonb(r)::text||',"status":'||to_jsonb(s)::text||'}','UTF8')),'hex');
$$;
CREATE FUNCTION anvil.source_root_authorized(pid uuid,op text) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id AND ar.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.projects p ON p.id=c.project_id AND p.archived_at IS NULL
 JOIN anvil.permission_policies pp ON pp.project_id=c.project_id AND pp.id::text=c.policy_ref->>'id' AND pp.head_version::text=c.policy_ref->>'version'
 JOIN anvil.permission_policy_versions pv ON pv.project_id=pp.project_id AND pv.policy_id=pp.id AND pv.version=pp.head_version AND pv.content_hash=c.policy_ref->>'contentHash'
 WHERE c.id::text=current_setting('anvil.command_id',true) AND c.project_id=pid AND c.operation=op AND op IN('saveSourceRoot','reviseSourceRoot','revokeSourceRoot') AND c.state='APPLIED'
 AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.approval_consumption_id IS NULL AND c.payload_ref IS NULL AND ar.approval_decision_ref IS NULL
 AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND EXISTS(SELECT 1 FROM anvil.audit_events a WHERE a.project_id=pid AND a.command_id=c.id AND a.operation_id=c.operation_id AND a.outcome='APPLIED' AND a.source_kind='HUMAN_COMMAND')
 AND EXISTS(SELECT 1 FROM anvil.auth_sessions s JOIN anvil.users u ON u.id=s.user_id JOIN anvil.clients cl ON cl.id=s.client_id AND cl.user_id=s.user_id
  WHERE s.user_id=c.actor_id AND s.client_id=c.client_id AND s.revoked_at IS NULL AND u.status='ACTIVE' AND u.revoked_at IS NULL AND cl.revoked_at IS NULL
  AND s.credential_generation=u.credential_generation AND s.reauth_until>clock_timestamp() AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp())
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? op AND rule->>'disposition'='AUTO' AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? op AND rule->>'disposition' IN('DENY','REQUIRE_APPROVAL') AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 );
$$;
CREATE FUNCTION anvil.guard_source_root() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;data jsonb;snapshot jsonb;decl jsonb;rid uuid;v bigint;oldv anvil.source_root_versions%ROWTYPE;keys text[];
BEGIN
 IF TG_OP='DELETE' OR TG_TABLE_NAME='source_root_versions' AND TG_OP='UPDATE' THEN RAISE EXCEPTION 'SOURCE_ROOT_IMMUTABLE' USING ERRCODE='42501';END IF;
 SELECT * INTO cmd FROM anvil.commands WHERE id::text=current_setting('anvil.command_id',true);data=cmd.result_ref->'data';snapshot=data->'snapshot';decl=snapshot->'declaration';
 IF TG_TABLE_NAME='source_roots' THEN
  rid=NEW.id;v=NEW.head_version;
  IF TG_OP='INSERT' THEN
   IF v<>1 OR NEW.created_by IS DISTINCT FROM cmd.actor_id OR NEW.client_id IS DISTINCT FROM cmd.client_id THEN RAISE EXCEPTION 'SOURCE_ROOT_CREATOR_REQUIRED' USING ERRCODE='42501';END IF;
  ELSE
   IF NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.id IS DISTINCT FROM OLD.id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.created_at IS DISTINCT FROM OLD.created_at OR v<>OLD.head_version+1 THEN RAISE EXCEPTION 'SOURCE_ROOT_HEAD_CAS_REQUIRED' USING ERRCODE='42501';END IF;
  END IF;
 ELSE
  rid=NEW.root_id;v=NEW.version;
  IF NEW.command_id IS DISTINCT FROM cmd.id OR NEW.actor_id IS DISTINCT FROM cmd.actor_id OR NEW.client_id IS DISTINCT FROM cmd.client_id
   OR NEW.declaration_json IS DISTINCT FROM decl OR NEW.status IS DISTINCT FROM snapshot->>'status' OR NEW.authority<>'USER_DECLARED' OR NEW.readiness<>'UNVERIFIED' OR NEW.reason IS DISTINCT FROM snapshot->>'reason'
   OR data->'ref' IS DISTINCT FROM jsonb_build_object('id',rid,'version',v,'contentHash',NEW.content_hash)
   OR NEW.content_hash IS DISTINCT FROM anvil.source_root_snapshot_hash(NEW.declaration_json,NEW.status,NEW.reason)
   OR NEW.connector_id IS DISTINCT FROM NULLIF(NEW.declaration_json->>'connectorId','')::uuid
   OR NOT EXISTS(SELECT 1 FROM anvil.source_roots r WHERE r.project_id=NEW.project_id AND r.id=rid AND r.head_version=v) THEN RAISE EXCEPTION 'SOURCE_ROOT_VERSION_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;
 SELECT array_agg(k ORDER BY k) INTO keys FROM jsonb_object_keys(decl) k;
 IF cmd.id IS NULL OR cmd.project_id IS DISTINCT FROM NEW.project_id OR cmd.expected_version IS DISTINCT FROM v-1 OR cmd.result_ref->>'status' IS DISTINCT FROM 'APPLIED'
  OR data->>'status' IS DISTINCT FROM 'SOURCE_ROOT_VERSION_STORED' OR data->'ref'->>'id' IS DISTINCT FROM rid::text OR data->'ref'->>'version' IS DISTINCT FROM v::text
  OR data->>'protectedRef' IS DISTINCT FROM 'db-source-root-version:'||rid::text||':'||v::text
  OR snapshot->>'authority' IS DISTINCT FROM 'USER_DECLARED' OR snapshot->>'readiness' IS DISTINCT FROM 'UNVERIFIED'
  OR keys IS DISTINCT FROM ARRAY['connectorId','displayName','hostLabel','pathHint','reason']::text[]
  OR jsonb_typeof(decl->'displayName') IS DISTINCT FROM 'string' OR length(trim(decl->>'displayName')) NOT BETWEEN 1 AND 200
  OR jsonb_typeof(decl->'hostLabel') IS DISTINCT FROM 'string' OR length(trim(decl->>'hostLabel')) NOT BETWEEN 1 AND 200
  OR jsonb_typeof(decl->'pathHint') IS DISTINCT FROM 'string' OR length(trim(decl->>'pathHint')) NOT BETWEEN 1 AND 4096
  OR jsonb_typeof(decl->'reason') IS DISTINCT FROM 'string' OR length(trim(decl->>'reason')) NOT BETWEEN 1 AND 20000
  OR NOT anvil.source_root_authorized(NEW.project_id,cmd.operation) THEN RAISE EXCEPTION 'SOURCE_ROOT_CURRENT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 IF v=1 THEN
  IF cmd.operation<>'saveSourceRoot' OR snapshot->>'status' IS DISTINCT FROM 'DECLARED' OR data->'previousRef' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'SOURCE_ROOT_BASE_REQUIRED' USING ERRCODE='42501';END IF;
 ELSE
  SELECT * INTO oldv FROM anvil.source_root_versions WHERE project_id=NEW.project_id AND root_id=rid AND version=v-1;
  IF oldv.root_id IS NULL OR oldv.status<>'DECLARED' OR cmd.operation NOT IN('reviseSourceRoot','revokeSourceRoot') OR data->'previousRef' IS DISTINCT FROM jsonb_build_object('id',rid,'version',oldv.version,'contentHash',oldv.content_hash)
   OR snapshot->>'status' IS DISTINCT FROM (CASE WHEN cmd.operation='revokeSourceRoot' THEN 'REVOKED' ELSE 'DECLARED' END)
   OR cmd.operation='revokeSourceRoot' AND decl IS DISTINCT FROM oldv.declaration_json THEN RAISE EXCEPTION 'SOURCE_ROOT_BASE_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;
 IF cmd.operation<>'revokeSourceRoot' AND decl->>'connectorId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM anvil.connectors c JOIN anvil.connector_registrations r ON r.project_id=c.project_id AND r.connector_id=c.id WHERE c.project_id=NEW.project_id AND c.id=(decl->>'connectorId')::uuid AND c.status='TRUSTED' AND c.revoked_at IS NULL AND anvil.connector_basis_current(r.id,false)) THEN RAISE EXCEPTION 'SOURCE_ROOT_CONNECTOR_UNAVAILABLE' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER source_root_identity_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.source_roots FOR EACH ROW EXECUTE FUNCTION anvil.guard_source_root();
CREATE TRIGGER source_root_version_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.source_root_versions FOR EACH ROW EXECUTE FUNCTION anvil.guard_source_root();
