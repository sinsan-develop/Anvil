-- 기존 공통/초안 guard는 그대로 유지하고 PROJECT DOCUMENT 사람 검토만 별도로 허용한다.
DROP TRIGGER draft_content_review_guard ON anvil.content_reviews;
CREATE TRIGGER draft_content_review_guard BEFORE INSERT ON anvil.content_reviews
  FOR EACH ROW WHEN (NEW.scope_kind='DRAFT') EXECUTE FUNCTION anvil.guard_draft_method_review();
CREATE FUNCTION anvil.guard_project_document_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user<>'anvil_v3_app' THEN RETURN NEW; END IF;
  IF NEW.scope_kind<>'PROJECT' OR NEW.target_kind<>'DOCUMENT' OR NEW.source_kind<>'HUMAN_REVIEW'
    OR NEW.reviewer_user_id::text IS DISTINCT FROM current_setting('anvil.actor_id',true)
    OR NEW.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true)
    OR NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true)
    OR NEW.reviewer_subject_ref->>'kind' IS DISTINCT FROM 'HUMAN'
    OR NEW.reviewer_subject_ref->>'userId' IS DISTINCT FROM NEW.reviewer_user_id::text
    OR NOT EXISTS(SELECT 1 FROM anvil.commands c
      JOIN anvil.authorization_receipts r ON r.command_id=c.id AND r.id=c.authorization_receipt_id AND r.policy_ref=c.policy_ref
      JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
      JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
      JOIN anvil.permission_policies p ON p.project_id=c.project_id AND p.id::text=c.policy_ref->>'id' AND p.head_version=(c.policy_ref->>'version')::bigint
      JOIN anvil.documents d ON d.project_id=c.project_id AND d.id=NEW.target_id AND d.head_version=NEW.target_version
      JOIN anvil.document_versions v ON v.project_id=d.project_id AND v.document_id=d.id AND v.version=NEW.target_version AND v.content_hash=NEW.target_hash
      WHERE c.id=NEW.command_id AND c.project_id=NEW.project_id AND c.actor_id=NEW.reviewer_user_id AND c.client_id=NEW.client_id
        AND c.state='APPLIED' AND c.operation='recordContentReview' AND c.expected_version=NEW.target_version
        AND c.result_ref->'data'->'ref'=jsonb_build_object('id',NEW.target_id,'version',NEW.target_version,'contentHash',NEW.target_hash)
        AND c.result_ref->'data'->'reviewRef'->>'id'=NEW.id::text
        AND c.result_ref->'data'->'reviewRef'->>'outcome'=NEW.outcome
        AND NEW.criteria_snapshot_json->'formRef'=jsonb_build_object('id',v.form_definition_id,'version',v.form_version,'contentHash',v.form_hash)) THEN
    RAISE EXCEPTION 'PROJECT_DOCUMENT_REVIEW_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER project_document_content_review_guard BEFORE INSERT ON anvil.content_reviews
  FOR EACH ROW WHEN (NEW.scope_kind='PROJECT') EXECUTE FUNCTION anvil.guard_project_document_review();
-- 검토는 append-only다. 문서 head/confirmed pointer·실행 권한은 변경하지 않는다.
