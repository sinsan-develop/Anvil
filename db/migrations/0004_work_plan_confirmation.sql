-- 이전 migration·불변 원문·초안·선택 이력은 변경하지 않는다.
CREATE TABLE anvil.work_plan_confirmations (
 id uuid PRIMARY KEY,project_id uuid NOT NULL,plan_id uuid NOT NULL,version bigint NOT NULL,target_hash text NOT NULL,
 review_refs jsonb NOT NULL CHECK(jsonb_typeof(review_refs)='array'),validation_json jsonb NOT NULL CHECK(jsonb_typeof(validation_json)='object'),
 confirmed_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id,plan_id,version),
 FOREIGN KEY(project_id,plan_id,version,target_hash) REFERENCES anvil.work_plan_versions(project_id,plan_id,version,content_hash),
 FOREIGN KEY(confirmed_by,client_id) REFERENCES anvil.clients(user_id,id)
);
GRANT SELECT,INSERT ON anvil.work_plan_confirmations TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.work_plan_confirmations FROM anvil_v3_app;
GRANT UPDATE(confirmed_version) ON anvil.work_plans TO anvil_v3_app;
CREATE FUNCTION anvil.work_plan_decision_authorized(pid uuid,wid uuid,v bigint,op text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.permission_policies p ON p.project_id=c.project_id AND p.id::text=c.policy_ref->>'id' AND p.head_version=(c.policy_ref->>'version')::bigint
 JOIN anvil.work_plans w ON w.project_id=c.project_id AND w.id=wid AND w.head_version=v
 JOIN anvil.work_plan_versions pv ON pv.project_id=w.project_id AND pv.plan_id=w.id AND pv.version=v
 WHERE c.id::text=current_setting('anvil.command_id',true) AND c.project_id=pid
 AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.state='APPLIED' AND c.operation=op AND c.expected_version=v
 AND c.result_ref->'data'->'ref'=jsonb_build_object('id',wid,'version',v,'contentHash',pv.content_hash));
$$;
DROP TRIGGER project_document_content_review_guard ON anvil.content_reviews;
CREATE TRIGGER project_document_content_review_guard BEFORE INSERT ON anvil.content_reviews FOR EACH ROW WHEN(NEW.scope_kind='PROJECT' AND NEW.target_kind NOT IN('KNOWLEDGE','WORK_PLAN')) EXECUTE FUNCTION anvil.guard_project_document_review();
CREATE FUNCTION anvil.guard_work_plan_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE snapshot jsonb;recorder uuid;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 SELECT c.result_ref->'data'->'review',v.created_by INTO snapshot,recorder FROM anvil.commands c JOIN anvil.work_plan_versions v ON v.project_id=c.project_id AND v.plan_id=NEW.target_id AND v.version=NEW.target_version WHERE c.id=NEW.command_id;
 IF NOT anvil.work_plan_decision_authorized(NEW.project_id,NEW.target_id,NEW.target_version,'recordContentReview')
 OR NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true) OR NEW.reviewer_user_id::text IS DISTINCT FROM current_setting('anvil.actor_id',true) OR NEW.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true)
 OR NEW.scope_id IS DISTINCT FROM NEW.project_id OR NEW.source_kind<>'HUMAN_REVIEW' OR NEW.criteria_version<>1 OR snapshot IS NULL
 OR snapshot->'ref' IS DISTINCT FROM jsonb_build_object('id',NEW.id,'targetRef',jsonb_build_object('id',NEW.target_id,'version',NEW.target_version,'contentHash',NEW.target_hash),'criteriaVersion',1,'outcome',NEW.outcome)
 OR snapshot->'criteria' IS DISTINCT FROM NEW.criteria_snapshot_json OR snapshot->'items' IS DISTINCT FROM NEW.items_json OR snapshot->'reviewer' IS DISTINCT FROM NEW.reviewer_subject_ref OR snapshot->>'sourceKind' IS DISTINCT FROM NEW.source_kind OR snapshot->>'reason' IS DISTINCT FROM NEW.reason
 OR NEW.reviewer_subject_ref IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',NEW.reviewer_user_id,'sameAsTargetRecorder',recorder=NEW.reviewer_user_id)
 OR jsonb_array_length(NEW.items_json)<>5 THEN RAISE EXCEPTION 'WORK_PLAN_REVIEW_EXACT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER work_plan_content_review_guard BEFORE INSERT ON anvil.content_reviews FOR EACH ROW WHEN(NEW.scope_kind='PROJECT' AND NEW.target_kind='WORK_PLAN') EXECUTE FUNCTION anvil.guard_work_plan_review();
CREATE FUNCTION anvil.guard_work_plan_confirmation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE result jsonb;pv anvil.work_plan_versions%ROWTYPE;latest_review uuid;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 SELECT c.result_ref->'data' INTO result FROM anvil.commands c WHERE c.id=NEW.command_id;
 SELECT * INTO pv FROM anvil.work_plan_versions WHERE project_id=NEW.project_id AND plan_id=NEW.plan_id AND version=NEW.version AND content_hash=NEW.target_hash;
 SELECT r.id INTO latest_review FROM anvil.content_reviews r JOIN anvil.audit_events a ON a.project_id=r.project_id AND a.command_id=r.command_id WHERE r.scope_kind='PROJECT' AND r.project_id=NEW.project_id AND r.target_kind='WORK_PLAN' AND r.target_id=NEW.plan_id AND r.target_version=NEW.version AND r.target_hash=NEW.target_hash AND r.criteria_version=1 AND r.source_kind='HUMAN_REVIEW' ORDER BY a.server_sequence DESC LIMIT 1;
 IF NOT anvil.work_plan_decision_authorized(NEW.project_id,NEW.plan_id,NEW.version,'confirmWorkPlan')
 OR NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true) OR NEW.confirmed_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true) OR NEW.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true)
 OR result IS NULL OR result->>'status' IS DISTINCT FROM 'CONFIRMED' OR result->>'confirmationId' IS DISTINCT FROM NEW.id::text
 OR result->'reviewRefs' IS DISTINCT FROM NEW.review_refs OR result->'validation' IS DISTINCT FROM NEW.validation_json OR result->>'activatedAsBaseline' IS DISTINCT FROM 'false'
 OR NEW.validation_json->>'validForConfirmation' IS DISTINCT FROM 'true' OR NEW.validation_json->'issues' IS DISTINCT FROM '[]'::jsonb
 OR NEW.validation_json->'sourceRefs' IS DISTINCT FROM jsonb_build_array(pv.version_json->'documentRef',pv.version_json->'designRef') OR NEW.validation_json->'screenReviewRefs' IS DISTINCT FROM pv.screen_review_refs
 OR pv.version_json->>'relationalProjection' IS DISTINCT FROM 'STORED' OR jsonb_array_length(pv.version_json->'tasks')=0
 OR (SELECT count(*) FROM anvil.plan_tasks WHERE project_id=NEW.project_id AND plan_id=NEW.plan_id AND plan_version=NEW.version)<>jsonb_array_length(pv.version_json->'tasks')
 OR jsonb_array_length(NEW.review_refs)<1 OR jsonb_array_length(NEW.review_refs)>200 OR latest_review IS NULL
 OR NOT EXISTS(SELECT 1 FROM anvil.content_reviews r WHERE r.id=latest_review AND r.outcome='ACCEPTED' AND NEW.review_refs @> jsonb_build_array(jsonb_build_object('id',r.id,'targetRef',result->'ref','criteriaVersion',1,'outcome','ACCEPTED')))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.review_refs) chosen WHERE NOT EXISTS(SELECT 1 FROM anvil.content_reviews r WHERE r.id::text=chosen->>'id' AND r.scope_kind='PROJECT' AND r.project_id=NEW.project_id AND r.target_kind='WORK_PLAN' AND r.target_id=NEW.plan_id AND r.target_version=NEW.version AND r.target_hash=NEW.target_hash AND r.criteria_version=1 AND r.source_kind='HUMAN_REVIEW' AND r.outcome='ACCEPTED' AND chosen=jsonb_build_object('id',r.id,'targetRef',result->'ref','criteriaVersion',1,'outcome','ACCEPTED')))
 THEN RAISE EXCEPTION 'WORK_PLAN_CONFIRMATION_EXACT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 -- source refs의 현재 head·확정 포인터·최신 내용검토를 DB에서도 다시 확인한다.
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.validation_json->'sourceRefs') ref WHERE NOT EXISTS(
 SELECT 1 FROM anvil.documents d JOIN anvil.document_versions v ON v.project_id=d.project_id AND v.document_id=d.id AND v.version=d.head_version
 WHERE d.project_id=NEW.project_id AND d.id::text=ref->>'id' AND d.head_version=(ref->>'version')::bigint AND d.confirmed_version=d.head_version AND v.content_hash=ref->>'contentHash'
 AND (SELECT r.outcome FROM anvil.content_reviews r JOIN anvil.audit_events a ON a.project_id=r.project_id AND a.command_id=r.command_id WHERE r.scope_kind='PROJECT' AND r.project_id=d.project_id AND r.target_kind='DOCUMENT' AND r.target_id=d.id AND r.target_version=d.head_version AND r.target_hash=v.content_hash AND r.criteria_version=1 AND r.source_kind='HUMAN_REVIEW' ORDER BY a.server_sequence DESC LIMIT 1)='ACCEPTED'))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(pv.screen_review_refs) chosen WHERE NOT EXISTS(
 SELECT 1 FROM anvil.content_reviews r WHERE r.id::text=chosen->>'id' AND r.project_id=NEW.project_id AND r.scope_kind='PROJECT' AND r.target_kind='DOCUMENT' AND r.criteria_version=1 AND r.source_kind='HUMAN_REVIEW' AND r.outcome='ACCEPTED' AND chosen=jsonb_build_object('id',r.id,'targetRef',jsonb_build_object('id',r.target_id,'version',r.target_version,'contentHash',r.target_hash),'criteriaVersion',1,'outcome','ACCEPTED')
 AND r.id=(SELECT r2.id FROM anvil.content_reviews r2 JOIN anvil.audit_events a ON a.project_id=r2.project_id AND a.command_id=r2.command_id WHERE r2.scope_kind='PROJECT' AND r2.project_id=r.project_id AND r2.target_kind='DOCUMENT' AND r2.target_id=r.target_id AND r2.target_version=r.target_version AND r2.target_hash=r.target_hash ORDER BY a.server_sequence DESC LIMIT 1)))
 THEN RAISE EXCEPTION 'WORK_PLAN_CURRENT_SOURCE_REVIEW_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER work_plan_confirmation_guard BEFORE INSERT ON anvil.work_plan_confirmations FOR EACH ROW EXECUTE FUNCTION anvil.guard_work_plan_confirmation();
CREATE FUNCTION anvil.guard_work_plan_confirmed_head() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 IF NOT anvil.work_plan_decision_authorized(NEW.project_id,NEW.id,NEW.head_version,'confirmWorkPlan') OR NEW.confirmed_version IS DISTINCT FROM NEW.head_version
 OR (to_jsonb(NEW)-ARRAY['confirmed_version','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['confirmed_version','updated_at'])
 OR NOT EXISTS(SELECT 1 FROM anvil.work_plan_confirmations f WHERE f.project_id=NEW.project_id AND f.plan_id=NEW.id AND f.version=NEW.head_version AND f.command_id::text=current_setting('anvil.command_id',true)) THEN RAISE EXCEPTION 'WORK_PLAN_CONFIRMED_POINTER_PROTECTED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER work_plan_head_guard ON anvil.work_plans;
CREATE TRIGGER work_plan_insert_guard BEFORE INSERT ON anvil.work_plans FOR EACH ROW EXECUTE FUNCTION anvil.guard_work_plan_write();
CREATE TRIGGER work_plan_draft_head_guard BEFORE UPDATE ON anvil.work_plans FOR EACH ROW WHEN(NEW.head_version IS DISTINCT FROM OLD.head_version) EXECUTE FUNCTION anvil.guard_work_plan_write();
CREATE TRIGGER work_plan_confirmed_head_guard BEFORE UPDATE ON anvil.work_plans FOR EACH ROW WHEN(NEW.head_version IS NOT DISTINCT FROM OLD.head_version) EXECUTE FUNCTION anvil.guard_work_plan_confirmed_head();
