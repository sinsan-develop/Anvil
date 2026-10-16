ALTER TABLE anvil.knowledge_events ADD COLUMN review_refs jsonb;
ALTER TABLE anvil.knowledge_events ADD CONSTRAINT knowledge_confirmation_review_refs CHECK((kind='CONFIRMED' AND review_refs IS NOT NULL AND jsonb_typeof(review_refs)='array') OR (kind<>'CONFIRMED' AND review_refs IS NULL));
CREATE UNIQUE INDEX knowledge_one_confirmation ON anvil.knowledge_events(project_id,entry_id,version) WHERE kind='CONFIRMED';
-- 기존 다른 PROJECT 대상은 원 DOCUMENT guard의 거절 경계를 보존한다.
DROP TRIGGER project_document_content_review_guard ON anvil.content_reviews;
CREATE TRIGGER project_document_content_review_guard BEFORE INSERT ON anvil.content_reviews FOR EACH ROW WHEN (NEW.scope_kind='PROJECT' AND NEW.target_kind<>'KNOWLEDGE') EXECUTE FUNCTION anvil.guard_project_document_review();
CREATE FUNCTION anvil.guard_project_knowledge_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE snapshot jsonb;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 SELECT c.result_ref->'data'->'review' INTO snapshot FROM anvil.commands c
 JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.permission_policies p ON p.project_id=c.project_id AND p.id::text=c.policy_ref->>'id' AND p.head_version=(c.policy_ref->>'version')::bigint
 JOIN anvil.knowledge_entries k ON k.project_id=c.project_id AND k.id=NEW.target_id AND k.head_version=NEW.target_version
 JOIN anvil.knowledge_versions v ON v.project_id=k.project_id AND v.entry_id=k.id AND v.version=NEW.target_version AND v.content_hash=NEW.target_hash
 WHERE c.id=NEW.command_id AND c.id::text=current_setting('anvil.command_id',true) AND c.project_id=NEW.project_id
 AND c.actor_id=NEW.reviewer_user_id AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id=NEW.client_id AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.operation='recordContentReview' AND c.state='APPLIED' AND c.expected_version=NEW.target_version
 AND c.result_ref->'data'->>'status'='REVIEW_RECORDED'
 AND c.result_ref->'data'->'ref'=jsonb_build_object('id',NEW.target_id,'version',NEW.target_version,'contentHash',NEW.target_hash)
 AND c.result_ref->'data'->'reviewRef'=jsonb_build_object('id',NEW.id,'targetRef',jsonb_build_object('id',NEW.target_id,'version',NEW.target_version,'contentHash',NEW.target_hash),'criteriaVersion',1,'outcome',NEW.outcome)
 AND NEW.reviewer_subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'sameAsTargetRecorder',v.created_by=c.actor_id)
 AND NEW.criteria_snapshot_json->>'knowledgeKind'=k.kind
 AND NOT EXISTS(SELECT 1 FROM anvil.knowledge_events e WHERE e.project_id=k.project_id AND e.entry_id=k.id AND e.version=NEW.target_version AND e.kind='EXCLUDED');
 IF snapshot IS NULL OR NEW.scope_kind<>'PROJECT' OR NEW.target_kind<>'KNOWLEDGE' OR NEW.source_kind<>'HUMAN_REVIEW' OR NEW.criteria_version<>1
  OR snapshot->'criteria' IS DISTINCT FROM NEW.criteria_snapshot_json OR snapshot->'items' IS DISTINCT FROM NEW.items_json
  OR snapshot->'reviewer' IS DISTINCT FROM NEW.reviewer_subject_ref OR snapshot->>'sourceKind' IS DISTINCT FROM NEW.source_kind OR snapshot->>'reason' IS DISTINCT FROM NEW.reason
  OR jsonb_typeof(NEW.items_json) IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.items_json)<>5 THEN RAISE EXCEPTION 'KNOWLEDGE_REVIEW_EXACT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER project_knowledge_content_review_guard BEFORE INSERT ON anvil.content_reviews FOR EACH ROW WHEN (NEW.scope_kind='PROJECT' AND NEW.target_kind='KNOWLEDGE') EXECUTE FUNCTION anvil.guard_project_knowledge_review();
-- CONFIRMED만 별도 guard로 분리하며 다른 사건의 기존 실패 폐쇄는 유지한다.
DROP TRIGGER knowledge_event_guard ON anvil.knowledge_events;
CREATE TRIGGER knowledge_event_guard BEFORE INSERT ON anvil.knowledge_events FOR EACH ROW WHEN (NEW.kind<>'CONFIRMED') EXECUTE FUNCTION anvil.guard_knowledge_draft_write();
CREATE FUNCTION anvil.guard_knowledge_confirmation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;latest_review uuid;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 SELECT c.* INTO cmd FROM anvil.commands c
 JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.permission_policies p ON p.project_id=c.project_id AND p.id::text=c.policy_ref->>'id' AND p.head_version=(c.policy_ref->>'version')::bigint
 JOIN anvil.knowledge_entries k ON k.project_id=c.project_id AND k.id=NEW.entry_id AND k.head_version=NEW.version
 JOIN anvil.knowledge_versions v ON v.project_id=k.project_id AND v.entry_id=k.id AND v.version=NEW.version
 WHERE c.id=NEW.command_id AND c.id::text=current_setting('anvil.command_id',true) AND c.project_id=NEW.project_id
 AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id=NEW.client_id AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.operation='confirmKnowledge' AND c.state='APPLIED' AND c.expected_version=NEW.version
 AND c.result_ref->'data'->>'status'='CONFIRMED' AND c.result_ref->'data'->'ref'=jsonb_build_object('id',NEW.entry_id,'version',NEW.version,'contentHash',v.content_hash)
 AND NOT EXISTS(SELECT 1 FROM anvil.knowledge_events e WHERE e.project_id=k.project_id AND e.entry_id=k.id AND e.version=NEW.version AND e.kind='EXCLUDED');
 IF cmd.id IS NULL THEN RAISE EXCEPTION 'KNOWLEDGE_CONFIRMATION_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT r.id INTO latest_review FROM anvil.content_reviews r JOIN anvil.audit_events a ON a.project_id=r.project_id AND a.command_id=r.command_id
 WHERE r.scope_kind='PROJECT' AND r.project_id=NEW.project_id AND r.target_kind='KNOWLEDGE' AND r.target_id=NEW.entry_id AND r.target_version=NEW.version AND r.target_hash=cmd.result_ref->'data'->'ref'->>'contentHash' AND r.criteria_version=1 AND r.source_kind='HUMAN_REVIEW'
 ORDER BY a.server_sequence DESC LIMIT 1;
 IF NEW.kind<>'CONFIRMED' OR NEW.id::text IS DISTINCT FROM cmd.result_ref->'data'->>'eventId' OR NEW.id::text IS DISTINCT FROM cmd.result_ref->'data'->>'confirmationId'
  OR NEW.reason IS DISTINCT FROM cmd.result_ref->'data'->>'reason' OR NEW.review_refs IS DISTINCT FROM cmd.result_ref->'data'->'reviewRefs'
  OR NEW.actor_ref IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',cmd.actor_id) OR NEW.base_ref IS NOT NULL OR NEW.change_sources IS NOT NULL OR NEW.approval_ref IS NOT NULL OR NEW.target_refs IS NOT NULL
  OR jsonb_typeof(NEW.review_refs) IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.review_refs)<1 OR jsonb_array_length(NEW.review_refs)>200 OR latest_review IS NULL
  OR NOT EXISTS(SELECT 1 FROM anvil.content_reviews r WHERE r.id=latest_review AND r.outcome='ACCEPTED' AND NEW.review_refs @> jsonb_build_array(jsonb_build_object('id',r.id,'targetRef',cmd.result_ref->'data'->'ref','criteriaVersion',1,'outcome','ACCEPTED')))
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.review_refs) chosen WHERE NOT EXISTS(SELECT 1 FROM anvil.content_reviews r WHERE r.id::text=chosen->>'id' AND r.scope_kind='PROJECT' AND r.project_id=NEW.project_id AND r.target_kind='KNOWLEDGE' AND r.target_id=NEW.entry_id AND r.target_version=NEW.version AND r.target_hash=cmd.result_ref->'data'->'ref'->>'contentHash' AND r.criteria_version=1 AND r.outcome='ACCEPTED' AND r.source_kind='HUMAN_REVIEW' AND chosen=jsonb_build_object('id',r.id,'targetRef',cmd.result_ref->'data'->'ref','criteriaVersion',1,'outcome','ACCEPTED')))
 THEN RAISE EXCEPTION 'KNOWLEDGE_EXACT_ACCEPTED_REVIEW_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER knowledge_confirmation_guard BEFORE INSERT ON anvil.knowledge_events FOR EACH ROW WHEN (NEW.kind='CONFIRMED') EXECUTE FUNCTION anvil.guard_knowledge_confirmation();
