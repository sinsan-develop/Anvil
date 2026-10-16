-- 신산님 직접 승인 FN02: 새 프로젝트 전용 개정/사람 검토/확정만 연다.
-- 기존 공통·초안 생성·고정 적용 guard와 적용 이력은 보존한다. 실행/적용 전환은 열지 않는다.
ALTER TABLE anvil.methodology_reviews ADD COLUMN project_id uuid REFERENCES anvil.projects(id);

CREATE FUNCTION anvil.project_method_authorized(pid uuid,mid uuid,v bigint,h text,op text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts r ON r.command_id=c.id AND r.id=c.authorization_receipt_id AND r.scope_kind='PROJECT' AND r.scope_id=c.project_id AND r.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.projects pr ON pr.id=c.project_id AND pr.archived_at IS NULL
 JOIN anvil.permission_policies p ON p.project_id=c.project_id AND p.id::text=c.policy_ref->>'id' AND p.head_version=(c.policy_ref->>'version')::bigint
 JOIN anvil.permission_policy_versions pv ON pv.project_id=p.project_id AND pv.policy_id=p.id AND pv.version=p.head_version AND pv.content_hash=c.policy_ref->>'contentHash'
 WHERE c.id::text=current_setting('anvil.command_id',true) AND c.project_id=pid AND c.scope_kind='PROJECT'
 AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.state='APPLIED' AND c.operation=op AND c.expected_version=CASE WHEN op IN('copyMethodology','saveMethodologyDraft') THEN v-1 ELSE v END
 AND c.result_ref->'data'->'ref'=jsonb_build_object('id',mid,'version',v,'contentHash',h)
 AND r.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND rule->'operations' @> to_jsonb(ARRAY[op]) AND rule->>'disposition'='AUTO' AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND rule->'operations' @> to_jsonb(ARRAY[op]) AND rule->>'disposition' IN('DENY','REQUIRE_APPROVAL') AND (rule->>'expiresAt')::timestamptz>clock_timestamp()));
$$;

-- 새 분기는 실제 PROJECT receipt가 있어야 하며 GUC 단독 위장으로는 통과할 수 없다.
DROP TRIGGER common_methodology_definition_guard ON anvil.methodology_definitions;
DROP TRIGGER common_methodology_version_guard ON anvil.methodology_versions;
CREATE TRIGGER common_methodology_definition_guard BEFORE INSERT OR UPDATE ON anvil.methodology_definitions FOR EACH ROW WHEN(current_setting('anvil.methodology_command',true) IS DISTINCT FROM 'PROJECT') EXECUTE FUNCTION anvil.guard_common_methodology_write();
CREATE TRIGGER common_methodology_version_guard BEFORE INSERT ON anvil.methodology_versions FOR EACH ROW WHEN(current_setting('anvil.methodology_command',true) IS DISTINCT FROM 'PROJECT') EXECUTE FUNCTION anvil.guard_common_methodology_write();
CREATE FUNCTION anvil.guard_project_method_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pid uuid;mid uuid;v bigint;h text;cmd anvil.commands%ROWTYPE;body jsonb;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 SELECT * INTO cmd FROM anvil.commands WHERE id::text=current_setting('anvil.command_id',true);
 body=cmd.result_ref->'data'->'snapshot';h=cmd.result_ref->'data'->'ref'->>'contentHash';
 IF TG_TABLE_NAME='methodology_definitions' THEN
   pid=NEW.project_id;mid=NEW.id;v=NEW.head_version;
   IF NEW.scope<>'PROJECT' OR NEW.owner_user_id IS NOT NULL OR NEW.system_code IS NOT NULL THEN RAISE EXCEPTION 'PROJECT_METHOD_REQUIRED' USING ERRCODE='42501';END IF;
   IF TG_OP='INSERT' THEN
     IF v<>1 OR NEW.name IS DISTINCT FROM body->>'name' OR NEW.purpose IS DISTINCT FROM body->>'purpose' THEN RAISE EXCEPTION 'PROJECT_METHOD_SNAPSHOT_REQUIRED' USING ERRCODE='42501';END IF;
   ELSE
     IF OLD.scope<>'PROJECT' OR OLD.project_id IS DISTINCT FROM pid OR v<>OLD.head_version+1 THEN RAISE EXCEPTION 'PROJECT_METHOD_HEAD_CONFLICT' USING ERRCODE='42501';END IF;
   END IF;
 ELSE
   mid=NEW.definition_id;v=NEW.version;
   SELECT project_id INTO pid FROM anvil.methodology_definitions WHERE id=mid AND scope='PROJECT';
   IF NEW.created_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true) OR NEW.content_hash IS DISTINCT FROM h
     OR body IS DISTINCT FROM jsonb_build_object('name',NEW.name,'purpose',NEW.purpose,'graph',NEW.graph_json,'origin',NEW.origin_ref_json,'reason',NEW.reason)
     OR NOT EXISTS(SELECT 1 FROM anvil.methodology_definitions d WHERE d.id=mid AND d.head_version=CASE WHEN v=1 THEN 1 ELSE v-1 END) THEN RAISE EXCEPTION 'PROJECT_METHOD_SNAPSHOT_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;
 IF pid IS NULL OR cmd.operation NOT IN('copyMethodology','saveMethodologyDraft') OR cmd.result_ref->'data'->>'status' IS DISTINCT FROM 'DRAFT' OR NOT anvil.project_method_authorized(pid,mid,v,h,cmd.operation) THEN RAISE EXCEPTION 'PROJECT_METHOD_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER project_method_definition_guard BEFORE INSERT OR UPDATE ON anvil.methodology_definitions FOR EACH ROW WHEN(current_setting('anvil.methodology_command',true)='PROJECT') EXECUTE FUNCTION anvil.guard_project_method_write();
CREATE TRIGGER project_method_version_guard BEFORE INSERT ON anvil.methodology_versions FOR EACH ROW WHEN(current_setting('anvil.methodology_command',true)='PROJECT') EXECUTE FUNCTION anvil.guard_project_method_write();

DROP TRIGGER common_method_review_guard ON anvil.methodology_reviews;
CREATE TRIGGER common_method_review_guard BEFORE INSERT ON anvil.methodology_reviews FOR EACH ROW WHEN(NEW.project_id IS NULL) EXECUTE FUNCTION anvil.guard_common_form_review();
DROP TRIGGER project_document_content_review_guard ON anvil.content_reviews;
CREATE TRIGGER project_document_content_review_guard BEFORE INSERT ON anvil.content_reviews FOR EACH ROW WHEN(NEW.scope_kind='PROJECT' AND NEW.target_kind NOT IN('KNOWLEDGE','WORK_PLAN','METHODOLOGY')) EXECUTE FUNCTION anvil.guard_project_document_review();
CREATE FUNCTION anvil.guard_project_method_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pid uuid;mid uuid;v bigint;h text;op text;cmd_id uuid;review_actor uuid;cmd anvil.commands%ROWTYPE;latest_review anvil.content_reviews%ROWTYPE;body jsonb;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 pid=NEW.project_id;cmd_id=NEW.command_id;
 IF TG_TABLE_NAME='content_reviews' THEN
   mid=NEW.target_id;v=NEW.target_version;h=NEW.target_hash;op='recordContentReview';review_actor=NEW.reviewer_user_id;
   IF NEW.scope_kind<>'PROJECT' OR NEW.target_kind<>'METHODOLOGY' OR NEW.source_kind<>'HUMAN_REVIEW' OR NEW.criteria_version<>1 OR jsonb_array_length(NEW.items_json)<>5 OR NEW.reviewer_subject_ref->>'userId' IS DISTINCT FROM review_actor::text THEN RAISE EXCEPTION 'PROJECT_METHOD_REVIEW_REQUIRED' USING ERRCODE='42501';END IF;
 ELSE
   mid=NEW.definition_id;v=NEW.version;h=NEW.target_hash;op='confirmMethodology';review_actor=NEW.decided_by;
   IF NEW.decision<>'CONFIRMED' OR NEW.validation_json->'validForConfirmation' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'PROJECT_METHOD_CONFIRMATION_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;
 IF cmd_id::text IS DISTINCT FROM current_setting('anvil.command_id',true) OR review_actor::text IS DISTINCT FROM current_setting('anvil.actor_id',true) OR NEW.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true) OR NOT anvil.project_method_authorized(pid,mid,v,h,op)
 OR NOT EXISTS(SELECT 1 FROM anvil.methodology_definitions d JOIN anvil.methodology_versions mv ON mv.definition_id=d.id AND mv.version=v AND mv.content_hash=h WHERE d.id=mid AND d.project_id=pid AND d.scope='PROJECT' AND d.head_version=v) THEN RAISE EXCEPTION 'PROJECT_METHOD_REVIEW_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO cmd FROM anvil.commands WHERE id=cmd_id;
 IF TG_TABLE_NAME='content_reviews' THEN
   body=jsonb_build_object('targetKind','METHODOLOGY','targetRef',jsonb_build_object('id',mid,'version',v,'contentHash',h),'criteriaVersion',1,'items',NEW.items_json,'outcome',NEW.outcome,'reason',NEW.reason);
   IF cmd.result_ref->'data'->'review' IS DISTINCT FROM body OR cmd.result_ref->'data'->'reviewRef'->>'id' IS DISTINCT FROM NEW.id::text THEN RAISE EXCEPTION 'PROJECT_METHOD_REVIEW_SNAPSHOT_REQUIRED' USING ERRCODE='42501';END IF;
 ELSE
   SELECT r.* INTO latest_review FROM anvil.content_reviews r JOIN anvil.audit_events a ON a.command_id=r.command_id AND a.project_id=r.project_id WHERE r.project_id=pid AND r.target_kind='METHODOLOGY' AND r.target_id=mid AND r.target_version=v AND r.target_hash=h ORDER BY a.server_sequence DESC LIMIT 1;
   IF latest_review.outcome IS DISTINCT FROM 'ACCEPTED' OR NOT NEW.review_refs @> jsonb_build_array(jsonb_build_object('id',latest_review.id,'criteriaVersion',1,'targetRef',jsonb_build_object('id',mid,'version',v,'contentHash',h),'outcome','ACCEPTED'))
     OR cmd.result_ref->'data'->'reviewRefs' IS DISTINCT FROM NEW.review_refs OR cmd.result_ref->'data'->>'confirmationId' IS DISTINCT FROM NEW.id::text THEN RAISE EXCEPTION 'PROJECT_METHOD_CONFIRMATION_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER project_method_content_review_guard BEFORE INSERT ON anvil.content_reviews FOR EACH ROW WHEN(NEW.scope_kind='PROJECT' AND NEW.target_kind='METHODOLOGY') EXECUTE FUNCTION anvil.guard_project_method_review();
CREATE TRIGGER project_method_confirmation_guard BEFORE INSERT ON anvil.methodology_reviews FOR EACH ROW WHEN(NEW.project_id IS NOT NULL) EXECUTE FUNCTION anvil.guard_project_method_review();
-- UPDATE/DELETE의 기존 회수와 initial_project_methodology_guard는 변경하지 않는다.
