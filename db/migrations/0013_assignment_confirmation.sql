-- FN09 내용 검토·별도 확정 후보. 정식 DB 적용 승인이 아니며 기존0012는 보존한다.
CREATE TABLE anvil.assignment_content_reviews(
 project_id uuid NOT NULL,review_id uuid NOT NULL,draft_id uuid NOT NULL,draft_version bigint NOT NULL,draft_hash text NOT NULL CHECK(draft_hash~'^[0-9a-f]{64}$'),
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),review_json jsonb NOT NULL CHECK(jsonb_typeof(review_json)='object'),
 created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,review_id),UNIQUE(project_id,command_id),
 FOREIGN KEY(project_id,draft_id,draft_version) REFERENCES anvil.assignment_draft_versions(project_id,draft_id,version),
 FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id),FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id)
);
CREATE TABLE anvil.assignment_versions(
 project_id uuid NOT NULL,assignment_id uuid NOT NULL,version bigint NOT NULL,
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),version_json jsonb NOT NULL CHECK(jsonb_typeof(version_json)='object'),
 created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL,confirmation_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,assignment_id,version),UNIQUE(project_id,command_id),UNIQUE(project_id,confirmation_id),
 FOREIGN KEY(project_id,assignment_id,version) REFERENCES anvil.assignment_draft_versions(project_id,draft_id,version),
 FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id),FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id),
 CHECK(COALESCE(version_json->'contentConfirmed'='true'::jsonb AND version_json->'ready'='false'::jsonb AND version_json->'executionAuthorized'='false'::jsonb AND version_json->'dispatchPerformed'='false'::jsonb,false))
);
CREATE INDEX assignment_review_target ON anvil.assignment_content_reviews(project_id,draft_id,draft_version);
GRANT SELECT,INSERT ON anvil.assignment_content_reviews,anvil.assignment_versions TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.assignment_content_reviews,anvil.assignment_versions FROM anvil_v3_app;

CREATE FUNCTION anvil.assignment_content_authorized(pid uuid,op text) RETURNS boolean LANGUAGE sql AS $$
 SELECT op IN('reviewAssignmentContent','confirmAssignment') AND EXISTS(SELECT 1 FROM anvil.commands c
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
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? op AND rule->>'disposition'='AUTO' AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? op AND rule->>'disposition' IN('DENY','REQUIRE_APPROVAL') AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 );
$$;
-- JavaScript String.length와 trim의 UTF-16/공백 계약을 직접 DML에서도 유지한다.
CREATE FUNCTION anvil.assignment_content_reason(value text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT value IS NOT NULL AND COALESCE((SELECT sum(CASE WHEN ascii(c)>65535 THEN 2 ELSE 1 END) FROM regexp_split_to_table(value,'') c),0)<=20000
 AND length(btrim(value,chr(9)||chr(10)||chr(11)||chr(12)||chr(13)||chr(32)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279)))>0;
$$;
CREATE FUNCTION anvil.assignment_content_review_valid(s jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE item jsonb;seen text[]='{}';
BEGIN
 IF jsonb_typeof(s) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(s))<>8 OR s->'criteriaVersion' IS DISTINCT FROM '1'::jsonb
  OR jsonb_typeof(s->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(s->'items')<>6
  OR s->>'outcome' IS NULL OR s->>'outcome' NOT IN('ACCEPTED','REWORK','BLOCKED','NOT_EXECUTED')
  OR jsonb_typeof(s->'reason') IS DISTINCT FROM 'string' OR NOT anvil.assignment_content_reason(s->>'reason')
  OR octet_length(anvil.assignment_draft_canonical(s))>2097152 OR s->>'independence' IS DISTINCT FROM 'NOT_CLAIMED' THEN RETURN false;END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(s->'items') LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(item))<>4 OR item->>'criterionId' IS NULL OR item->>'criterionId' NOT IN('PURPOSE_SCOPE','BASELINE_TASK','INPUT_OUTPUT','COMPLETION_VERIFICATION','BOUNDARIES','RECORD_RECOVERY')
   OR (item->>'criterionId')=ANY(seen) OR item->>'outcome' IS NULL OR item->>'outcome' NOT IN('ACCEPTED','REWORK','BLOCKED','NOT_EXECUTED') OR item->'evidenceRefs' IS DISTINCT FROM '[]'::jsonb
   OR jsonb_typeof(item->'reason') IS DISTINCT FROM 'string' OR NOT anvil.assignment_content_reason(item->>'reason')
   OR s->>'outcome'='ACCEPTED' AND item->>'outcome'<>'ACCEPTED' THEN RETURN false;END IF;
  seen=array_append(seen,item->>'criterionId');
 END LOOP;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.guard_assignment_content() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;draft anvil.assignment_draft_versions%ROWTYPE;head bigint;s jsonb;ref jsonb;payload jsonb;rid uuid;dv bigint;op text;latest jsonb;chosen jsonb;review_row anvil.assignment_content_reviews%ROWTYPE;field text;
BEGIN
 IF current_user<>'anvil_v3_app' THEN IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'ASSIGNMENT_CONTENT_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 PERFORM id FROM anvil.projects WHERE id=NEW.project_id FOR UPDATE;
 SELECT * INTO cmd FROM anvil.commands WHERE id::text=current_setting('anvil.command_id',true);
 IF TG_TABLE_NAME='assignment_content_reviews' THEN op='reviewAssignmentContent';rid=NEW.draft_id;dv=NEW.draft_version;s=NEW.review_json;
 ELSE op='confirmAssignment';rid=NEW.assignment_id;dv=NEW.version;s=NEW.version_json;END IF;
 SELECT head_version INTO head FROM anvil.assignment_drafts WHERE project_id=NEW.project_id AND id=rid FOR UPDATE;
 SELECT * INTO draft FROM anvil.assignment_draft_versions WHERE project_id=NEW.project_id AND draft_id=rid AND version=dv;
 IF cmd.id IS NULL OR NOT anvil.assignment_content_authorized(NEW.project_id,op) OR cmd.project_id IS DISTINCT FROM NEW.project_id OR cmd.expected_version IS DISTINCT FROM dv OR head IS DISTINCT FROM dv OR draft.draft_id IS NULL
  OR NEW.command_id IS DISTINCT FROM cmd.id OR NEW.created_by IS DISTINCT FROM cmd.actor_id OR NEW.client_id IS DISTINCT FROM cmd.client_id
  OR s->'draftRef' IS DISTINCT FROM jsonb_build_object('id',rid,'version',dv,'contentHash',draft.content_hash)
  OR NOT anvil.assignment_draft_basis_current(NEW.project_id,draft.version_json->'basis')
  OR NEW.content_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.assignment_draft_canonical(s),'UTF8')),'hex')
  THEN RAISE EXCEPTION 'ASSIGNMENT_CONTENT_EXACT_CURRENT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='assignment_content_reviews' THEN
  ref=jsonb_build_object('id',NEW.review_id,'version',1,'contentHash',NEW.content_hash);
  IF NEW.draft_hash IS DISTINCT FROM draft.content_hash OR NOT anvil.assignment_content_review_valid(s)
   OR s->'reviewedBy' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',cmd.actor_id) OR (s->>'reviewedAt')::timestamptz IS DISTINCT FROM date_trunc('milliseconds',transaction_timestamp())
   THEN RAISE EXCEPTION 'ASSIGNMENT_CONTENT_REVIEW_REQUIRED' USING ERRCODE='42501';END IF;
  payload=s-ARRAY['reviewedBy','reviewedAt','independence'];
  IF cmd.result_ref->'data'->>'status' IS DISTINCT FROM 'ASSIGNMENT_CONTENT_REVIEWED' THEN RAISE EXCEPTION 'ASSIGNMENT_CONTENT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 ELSE
  ref=jsonb_build_object('id',rid,'version',dv,'contentHash',NEW.content_hash);
  IF (SELECT count(*) FROM jsonb_object_keys(s))<>11 OR s->'definition' IS DISTINCT FROM draft.version_json->'definition' OR s->'readinessIssues' IS DISTINCT FROM draft.version_json->'readinessIssues'
   OR s->'contentConfirmed' IS DISTINCT FROM 'true'::jsonb OR s->'ready' IS DISTINCT FROM 'false'::jsonb OR s->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR s->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
   OR s->'confirmedBy' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',cmd.actor_id) OR (s->>'confirmedAt')::timestamptz IS DISTINCT FROM date_trunc('milliseconds',transaction_timestamp())
   OR jsonb_typeof(s->'reason') IS DISTINCT FROM 'string' OR NOT anvil.assignment_content_reason(s->>'reason') OR octet_length(anvil.assignment_draft_canonical(s))>2097152
   OR jsonb_typeof(s->'reviewRefs') IS DISTINCT FROM 'array' OR jsonb_array_length(s->'reviewRefs') NOT BETWEEN 1 AND 200
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(draft.version_json->'readinessIssues') i WHERE i->>'code' IN('REQUIRED_TEXT_MISSING','REQUIRED_LIST_MISSING','SOURCE_SCOPE_MISSING','BASELINE_REFERENCE_MISSING'))
   THEN RAISE EXCEPTION 'ASSIGNMENT_CONTENT_INCOMPLETE' USING ERRCODE='42501';END IF;
  FOREACH field IN ARRAY ARRAY['purpose','goal','ownerRole','integrationResponsibility'] LOOP
   IF length(btrim(s->'definition'->>field))=0 OR s->'definition'->>field IS NULL THEN RAISE EXCEPTION 'ASSIGNMENT_CONTENT_INCOMPLETE' USING ERRCODE='42501';END IF;
  END LOOP;
  FOREACH field IN ARRAY ARRAY['inputs','outputs','acceptanceCriteria','verificationRequirements','included','excluded','requiredCapabilities','allowedScopes'] LOOP
   IF jsonb_typeof(s->'definition'->field) IS DISTINCT FROM 'array' OR jsonb_array_length(s->'definition'->field)=0 THEN RAISE EXCEPTION 'ASSIGNMENT_CONTENT_INCOMPLETE' USING ERRCODE='42501';END IF;
  END LOOP;
  SELECT jsonb_build_object('id',r.review_id,'version',1,'contentHash',r.content_hash) INTO latest FROM anvil.assignment_content_reviews r JOIN anvil.audit_events a ON a.project_id=r.project_id AND a.command_id=r.command_id AND a.outcome='APPLIED'
   WHERE r.project_id=NEW.project_id AND r.draft_id=rid AND r.draft_version=dv ORDER BY a.server_sequence DESC LIMIT 1;
  IF latest IS NULL OR NOT (s->'reviewRefs') @> jsonb_build_array(latest) THEN RAISE EXCEPTION 'ASSIGNMENT_LATEST_REVIEW_REQUIRED' USING ERRCODE='42501';END IF;
  FOR chosen IN SELECT value FROM jsonb_array_elements(s->'reviewRefs') LOOP
   SELECT * INTO review_row FROM anvil.assignment_content_reviews WHERE project_id=NEW.project_id AND review_id::text=chosen->>'id';
   IF review_row.review_id IS NULL OR chosen IS DISTINCT FROM jsonb_build_object('id',review_row.review_id,'version',1,'contentHash',review_row.content_hash)
    OR review_row.draft_id IS DISTINCT FROM rid OR review_row.draft_version IS DISTINCT FROM dv OR review_row.draft_hash IS DISTINCT FROM draft.content_hash
    OR review_row.review_json->>'outcome' IS DISTINCT FROM 'ACCEPTED' OR NOT anvil.assignment_content_review_valid(review_row.review_json)
    OR review_row.content_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.assignment_draft_canonical(review_row.review_json),'UTF8')),'hex')
    OR NOT EXISTS(SELECT 1 FROM anvil.commands rc JOIN anvil.audit_events ra ON ra.project_id=rc.project_id AND ra.command_id=rc.id AND ra.outcome='APPLIED' WHERE rc.project_id=NEW.project_id AND rc.id=review_row.command_id AND rc.operation='reviewAssignmentContent' AND rc.state='APPLIED' AND rc.result_ref->'data'->'snapshot'=review_row.review_json AND rc.result_ref->'data'->'ref'=chosen)
    THEN RAISE EXCEPTION 'ASSIGNMENT_CONTENT_REVIEW_REQUIRED' USING ERRCODE='42501';END IF;
  END LOOP;
  IF (SELECT count(DISTINCT value) FROM jsonb_array_elements(s->'reviewRefs'))<>jsonb_array_length(s->'reviewRefs') THEN RAISE EXCEPTION 'ASSIGNMENT_CONTENT_REVIEW_DUPLICATE' USING ERRCODE='42501';END IF;
  payload=jsonb_build_object('draftRef',s->'draftRef','reviewRefs',s->'reviewRefs','reason',s->'reason','acknowledged',true);
  IF cmd.result_ref->'data'->>'status' IS DISTINCT FROM 'ASSIGNMENT_CONTENT_CONFIRMED' OR cmd.result_ref->'data'->>'confirmationId' IS DISTINCT FROM NEW.confirmation_id::text THEN RAISE EXCEPTION 'ASSIGNMENT_CONTENT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;
 IF cmd.result_ref->>'status' IS DISTINCT FROM 'APPLIED' OR cmd.result_ref->>'projectId' IS DISTINCT FROM NEW.project_id::text OR cmd.result_ref->>'targetId' IS DISTINCT FROM ref->>'id' OR cmd.result_ref->'version' IS DISTINCT FROM ref->'version'
  OR cmd.result_ref->'data'->'ref' IS DISTINCT FROM ref OR cmd.result_ref->'data'->'snapshot' IS DISTINCT FROM s
  OR cmd.request_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.assignment_draft_canonical(jsonb_build_object('schemaVersion',1,'projectId',NEW.project_id,'commandId',cmd.command_id,'clientId',cmd.client_id,'controlGeneration',cmd.control_generation,'operation',op,'targetId',rid,'expectedVersion',dv,'baselineRefs','[]'::jsonb,'approvalRef','null'::jsonb,'payload',payload)),'UTF8')),'hex')
  THEN RAISE EXCEPTION 'ASSIGNMENT_CONTENT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER assignment_content_review_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.assignment_content_reviews FOR EACH ROW EXECUTE FUNCTION anvil.guard_assignment_content();
CREATE TRIGGER assignment_version_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.assignment_versions FOR EACH ROW EXECUTE FUNCTION anvil.guard_assignment_content();
